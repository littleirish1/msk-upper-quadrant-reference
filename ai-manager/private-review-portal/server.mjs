import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'
import { deriveProjectSnapshot, exactRevisionExists, initializeFutureBuild } from './domain.mjs'
import { regenerateSafePreview } from './derived.mjs'
import { intakeUpload } from './intake.mjs'
import { PrivateStore, resolveInside } from './store.mjs'
import { SlidingWindowRateLimiter, SessionStore, createPassphraseVerifier, csrfMatches, expiredSessionCookie, isAllowedHost, isAllowedOrigin, parseCookies, securityHeaders, sessionCookie } from './security.mjs'

const portalDirectory = path.dirname(fileURLToPath(import.meta.url))
const staticDirectory = path.join(portalDirectory, 'static')
const staticRoutes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
])
const actionTypes = new Set(['queue-extraction', 'queue-proposal', 'link-exact-revision', 'add-note', 'accept-proposal', 'reject-proposal', 'defer-proposal', 'create-human-review-task', 'request-focused-packet', 'mark-superseded', 'archive'])

function respond(response, status, headers = {}, body = '') {
  response.writeHead(status, { ...securityHeaders, ...headers })
  response.end(body)
}

function json(response, status, value, headers = {}) {
  respond(response, status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }, `${JSON.stringify(value)}\n`)
}

async function readJsonBody(request, limit) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > limit) throw new Error('Request body exceeds the configured limit.')
    chunks.push(chunk)
  }
  if (!bytes) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function metadataHeader(request) {
  const encoded = request.headers['x-upload-metadata']
  if (!encoded) return {}
  if (typeof encoded !== 'string' || encoded.length > 8192) throw new Error('Upload metadata header is invalid.')
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
}

function remoteKey(request) {
  return request.socket.remoteAddress ?? 'unknown'
}

function safeActionPayload(input) {
  const clean = (value, maximum = 1000) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum)
  return {
    targetType: clean(input.targetType, 80),
    targetId: clean(input.targetId, 180),
    exactRevisionKey: clean(input.exactRevisionKey, 300),
    note: clean(input.note, 3000),
  }
}

export function createPortalServer(options = {}) {
  const config = options.config ?? loadConfig()
  const store = options.store ?? new PrivateStore(config.dataRoot)
  initializeFutureBuild(store)
  const sessions = options.sessions ?? new SessionStore(config)
  const verifyPassphrase = options.verifyPassphrase ?? createPassphraseVerifier(config.passphrase)
  const limiter = new SlidingWindowRateLimiter(config.rateLimitPerMinute)
  const loginLimiter = new SlidingWindowRateLimiter(Math.min(10, config.rateLimitPerMinute))
  const batchBytes = new Map()

  const server = http.createServer(async (request, response) => {
    const requestId = crypto.randomUUID()
    try {
      if (!isAllowedHost(request, config.origins)) return json(response, 421, { error: 'misdirected-request', requestId })
      if (!limiter.consume(remoteKey(request))) return json(response, 429, { error: 'rate-limit-exceeded', requestId }, { 'Retry-After': '60' })
      const url = new URL(request.url ?? '/', 'http://portal.invalid')
      const secureCookie = config.networkExposure === 'tailscale-serve'

      if (request.method === 'GET' || request.method === 'HEAD') {
        const asset = staticRoutes.get(url.pathname)
        if (asset) {
          const [name, contentType] = asset
          const file = path.join(staticDirectory, name)
          if (!fs.existsSync(file)) return json(response, 503, { error: 'portal-assets-unavailable', requestId })
          response.writeHead(200, { ...securityHeaders, 'Content-Type': contentType })
          if (request.method === 'HEAD') return response.end()
          return fs.createReadStream(file).pipe(response)
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        if (!isAllowedOrigin(request, config.origins)) return json(response, 403, { error: 'origin-rejected', requestId })
        if (!loginLimiter.consume(remoteKey(request))) return json(response, 429, { error: 'login-rate-limit-exceeded', requestId }, { 'Retry-After': '60' })
        const body = await readJsonBody(request, 4096)
        if (!verifyPassphrase(body.passphrase)) {
          store.audit('login-rejected', { requestId })
          return json(response, 401, { error: 'authentication-failed', requestId })
        }
        const session = sessions.create('reviewer')
        store.audit('login-succeeded', { requestId, role: session.role })
        return json(response, 200, { authenticated: true, csrf: session.csrf, role: session.role }, { 'Set-Cookie': sessionCookie(session.token, secureCookie) })
      }

      const token = parseCookies(request.headers.cookie).msk_review_session
      const session = sessions.get(token)
      if (!session) return json(response, 401, { error: 'authentication-required', requestId }, { 'Set-Cookie': expiredSessionCookie(secureCookie) })

      if (request.method === 'GET' && url.pathname === '/api/session') return json(response, 200, { authenticated: true, csrf: session.csrf, role: session.role })
      if (request.method === 'POST') {
        if (!isAllowedOrigin(request, config.origins)) return json(response, 403, { error: 'origin-rejected', requestId })
        if (!csrfMatches(session, request)) return json(response, 403, { error: 'csrf-rejected', requestId })
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        sessions.revoke(token)
        store.audit('logout', { requestId, role: session.role })
        return json(response, 200, { authenticated: false }, { 'Set-Cookie': expiredSessionCookie(secureCookie) })
      }
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return json(response, 200, deriveProjectSnapshot(config.repositoryRoot, store))

      if (request.method === 'POST' && url.pathname === '/api/uploads') {
        const filename = request.headers['x-file-name']
        if (typeof filename !== 'string') return json(response, 400, { error: 'filename-required', requestId })
        const batchId = String(request.headers['x-upload-batch'] ?? crypto.randomUUID())
        if (!/^[a-zA-Z0-9_-]{1,80}$/.test(batchId)) return json(response, 400, { error: 'invalid-batch-id', requestId })
        const contentLength = Number(request.headers['content-length'] ?? Number.NaN)
        const key = `${session.idHash}:${batchId}`
        const projected = (batchBytes.get(key) ?? 0) + (Number.isFinite(contentLength) ? contentLength : config.maxFileBytes)
        if (projected > config.maxBatchBytes) return json(response, 413, { error: 'batch-size-limit', requestId })
        const document = await intakeUpload({
          stream: request,
          originalName: filename,
          declaredType: request.headers['content-type'],
          contentLength,
          metadata: metadataHeader(request),
          store,
          config,
          actor: session.role,
          scan: options.scan,
        })
        batchBytes.set(key, (batchBytes.get(key) ?? 0) + document.bytes)
        const { relativePath, ...safeDocument } = document
        return json(response, 201, safeDocument)
      }

      const download = url.pathname.match(/^\/api\/documents\/([a-f0-9-]{36})\/download$/)
      if (request.method === 'GET' && download) {
        const document = store.read().documents.find((item) => item.id === download[1])
        if (!document || document.scan.status !== 'clean') return json(response, 404, { error: 'download-unavailable', requestId })
        const file = resolveInside(store.root, document.relativePath)
        store.audit('original-downloaded', { requestId, role: session.role, documentId: document.id })
        response.writeHead(200, { ...securityHeaders, 'Content-Type': document.detectedType, 'Content-Length': document.bytes, 'Content-Disposition': `attachment; filename="${document.originalName.replaceAll('"', '_')}"` })
        return fs.createReadStream(file).pipe(response)
      }

      const preview = url.pathname.match(/^\/api\/documents\/([a-f0-9-]{36})\/preview$/)
      if (request.method === 'GET' && preview) {
        const document = store.read().documents.find((item) => item.id === preview[1])
        const derived = document?.derivedFiles.find((item) => item.type === 'safe-text-preview')
        if (!derived) return json(response, 404, { error: 'preview-unavailable', requestId })
        return respond(response, 200, { 'Content-Type': 'text/plain; charset=utf-8' }, fs.readFileSync(resolveInside(store.root, derived.relativePath), 'utf8'))
      }

      if (request.method === 'POST' && url.pathname === '/api/actions') {
        const body = await readJsonBody(request, config.jsonBodyBytes)
        if (!actionTypes.has(body.type)) return json(response, 400, { error: 'action-not-permitted', requestId })
        const payload = safeActionPayload(body)
        if (body.type === 'link-exact-revision' && !exactRevisionExists(config.repositoryRoot, payload.exactRevisionKey)) return json(response, 400, { error: 'unknown-exact-revision', requestId })
        const action = { id: crypto.randomUUID(), type: body.type, ...payload, actorRole: session.role, createdAt: new Date().toISOString(), grantsApproval: false, status: 'recorded' }
        if (body.type === 'queue-extraction') {
          try {
            regenerateSafePreview(store, payload.targetId)
            action.status = 'safe-text-preview-generated'
          } catch (error) {
            action.status = 'human-reviewed-extraction-required'
            action.note = `${action.note} ${error.message}`.trim().slice(0, 3000)
          }
        }
        if (body.type === 'archive') store.updateDocumentWorkflow(payload.targetId, { archivedAt: new Date().toISOString() })
        if (body.type === 'mark-superseded') store.updateDocumentWorkflow(payload.targetId, { supersededBy: payload.exactRevisionKey || 'pending-replacement' })
        store.addAction(action)
        store.audit('review-action-recorded', { requestId, actionId: action.id, type: action.type, targetId: action.targetId, grantsApproval: false })
        return json(response, 201, action)
      }

      return json(response, 404, { error: 'not-found', requestId })
    } catch (error) {
      const status = /limit|exceeds/i.test(error.message) ? 413 : /JSON|filename|file|MIME|content|document|path|upload|extension|package|empty/i.test(error.message) ? 400 : 500
      store.audit('request-error', { requestId, category: status === 500 ? 'internal' : 'rejected-request' })
      return json(response, status, { error: status === 500 ? 'internal-error' : 'request-rejected', requestId })
    }
  })
  return { server, config, store, sessions }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const portal = createPortalServer()
  portal.server.listen(portal.config.port, portal.config.host, () => {
    console.log(`Private review portal listening on ${portal.config.host}:${portal.config.port}; exposure=${portal.config.networkExposure}; dataRoot=${portal.config.dataRoot}`)
  })
}
