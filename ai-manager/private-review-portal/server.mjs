import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'
import { contentRevisionHash, findContentItem, loadContentRegistry, loadStudioConfig } from './content-studio.mjs'
import { deriveProjectSnapshot, initializeFutureBuild } from './domain.mjs'
import { regenerateSafePreview } from './derived.mjs'
import { intakeUpload } from './intake.mjs'
import { PrivateStore, resolveInside } from './store.mjs'
import { SlidingWindowRateLimiter, SessionStore, createPassphraseVerifier, csrfMatches, expiredSessionCookie, isAllowedHost, isAllowedOrigin, parseCookies, securityHeaders, sessionCookie } from './security.mjs'
import { V1_CLAIM_REVIEW_OPTIONS } from './v1-claim-canonicalization.mjs'
import { loadVerifiedV1FinalConditionConfirmation, V1_FINAL_CONFIRMATION_DECISIONS } from './v1-final-condition-confirmation.mjs'
import { V1_REVIEW_DECISIONS } from './v1-publication-review.mjs'

const portalDirectory = path.dirname(fileURLToPath(import.meta.url))
const staticDirectory = path.join(portalDirectory, 'static')
const staticRoutes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
])
const actionTypes = new Set(['queue-extraction', 'add-note', 'create-human-review-task', 'mark-review-complete', 'submit-integration-proposal', 'record-v1-publication-review', 'record-v1-claim-review', 'record-v1-final-condition-confirmation'])

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
    reviewDeclaration: input.reviewDeclaration === true,
    clinicalDecision: clean(input.clinicalDecision, 80),
    evidenceDecision: clean(input.evidenceDecision, 80),
    publicationRecommendation: clean(input.publicationRecommendation, 80),
    confirmationRevisionKey: clean(input.confirmationRevisionKey, 300),
    clinicalAccuracyDecision: clean(input.clinicalAccuracyDecision, 80),
    evidenceSufficiencyDecision: clean(input.evidenceSufficiencyDecision, 80),
    clinicalCompletenessDecision: clean(input.clinicalCompletenessDecision, 80),
    evidenceRelationshipDecision: clean(input.evidenceRelationshipDecision, 80),
    clinicalWordingDecision: clean(input.clinicalWordingDecision, 80),
  }
}

function clientProposal(proposal) {
  const { relativePath, ...safe } = proposal
  return { ...safe, downloadUrl: `/api/integration-proposals/${proposal.id}/download` }
}

function actorFields(config) {
  return { actorId: config.actorId, actorRoles: [...config.actorRoles], actorRole: config.actorRoles[0] }
}

function safeExtraMaterial(input, studioConfig) {
  const clean = (value, maximum = 1000) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum)
  const materialType = clean(input.materialType, 40)
  const region = clean(input.region, 80)
  if (!studioConfig.extraMaterialTypes.includes(materialType)) throw new Error('Unknown extra-material type.')
  if (!studioConfig.regions.some((item) => item.id === region)) throw new Error('Unknown Content Studio region.')
  const title = clean(input.title, 180)
  if (!title) throw new Error('Extra-material title is required.')
  const documentId = clean(input.documentId, 80)
  if (documentId && !/^[a-f0-9-]{36}$/.test(documentId)) throw new Error('Invalid private document identifier.')
  return { title, materialType, region, documentId: documentId || null, notes: clean(input.notes, 3000) }
}

export function createPortalServer(options = {}) {
  const config = options.config ?? loadConfig()
  const store = options.store ?? new PrivateStore(config.dataRoot)
  const studioConfig = options.studioConfig ?? loadStudioConfig()
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
        store.audit('login-succeeded', { requestId, role: session.role, actorId: config.actorId })
        return json(response, 200, { authenticated: true, csrf: session.csrf, role: session.role, actorId: config.actorId, actorRoles: config.actorRoles }, { 'Set-Cookie': sessionCookie(session.token, secureCookie) })
      }

      const token = parseCookies(request.headers.cookie).msk_review_session
      const session = sessions.get(token)
      if (!session) return json(response, 401, { error: 'authentication-required', requestId }, { 'Set-Cookie': expiredSessionCookie(secureCookie) })

      if (request.method === 'GET' && url.pathname === '/api/session') return json(response, 200, { authenticated: true, csrf: session.csrf, role: session.role, actorId: config.actorId, actorRoles: config.actorRoles })
      if (request.method === 'POST') {
        if (!isAllowedOrigin(request, config.origins)) return json(response, 403, { error: 'origin-rejected', requestId })
        if (!csrfMatches(session, request)) return json(response, 403, { error: 'csrf-rejected', requestId })
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        sessions.revoke(token)
        store.audit('logout', { requestId, role: session.role })
        return json(response, 200, { authenticated: false }, { 'Set-Cookie': expiredSessionCookie(secureCookie) })
      }
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return json(response, 200, deriveProjectSnapshot(config.repositoryRoot, store, config))

      const contentDetail = url.pathname.match(/^\/api\/content\/([^/]+)$/)
      if (request.method === 'GET' && contentDetail) {
        const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
        const item = findContentItem(registry, decodeURIComponent(contentDetail[1]))
        if (!item) return json(response, 404, { error: 'content-item-not-found', requestId })
        const database = store.read()
        return json(response, 200, {
          ...item,
          privateReviewActions: database.actions.filter((action) => action.targetType === 'content-item' && action.targetId === item.id),
          integrationProposals: database.integrationProposals.filter((proposal) => proposal.targetId === item.id).map(clientProposal),
          integrationQueue: database.integrationQueue.filter((entry) => entry.targetId === item.id),
        })
      }

      if (request.method === 'POST' && url.pathname === '/api/extra-materials') {
        const body = await readJsonBody(request, config.jsonBodyBytes)
        const payload = safeExtraMaterial(body, studioConfig)
        if (payload.documentId && !store.read().documents.some((item) => item.id === payload.documentId)) return json(response, 400, { error: 'private-document-not-found', requestId })
        const material = {
          id: `extra-material.${crypto.randomUUID()}`,
          ...payload,
          lifecycle: 'registered',
          publicationState: 'private',
          createdAt: new Date().toISOString(),
          ...actorFields(config),
          grantsApproval: false,
        }
        material.revisionHash = contentRevisionHash(material)
        store.addExtraMaterial(material)
        store.audit('extra-material-registered', { requestId, materialId: material.id, materialType: material.materialType, grantsApproval: false })
        return json(response, 201, material)
      }

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

      const proposalDownload = url.pathname.match(/^\/api\/integration-proposals\/([a-f0-9-]{36})\/download$/)
      if (request.method === 'GET' && proposalDownload) {
        const proposal = store.read().integrationProposals.find((item) => item.id === proposalDownload[1])
        if (!proposal) return json(response, 404, { error: 'integration-proposal-not-found', requestId })
        const file = resolveInside(store.root, proposal.relativePath)
        store.audit('integration-proposal-downloaded', { requestId, role: session.role, proposalId: proposal.id, grantsApproval: false })
        return respond(response, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="content-integration-proposal-${proposal.id}.json"` }, fs.readFileSync(file, 'utf8'))
      }

      if (request.method === 'POST' && url.pathname === '/api/actions') {
        const body = await readJsonBody(request, config.jsonBodyBytes)
        if (!actionTypes.has(body.type)) return json(response, 400, { error: 'action-not-permitted', requestId })
        const payload = safeActionPayload(body)
        if (body.type === 'mark-review-complete' && (payload.targetType !== 'content-item' || !payload.note || !payload.reviewDeclaration)) return json(response, 400, { error: 'review-completion-declaration-required', requestId })
        if (body.type === 'submit-integration-proposal') {
          if (!config.actorRoles.includes('integration-proposer')) return json(response, 403, { error: 'integration-proposer-role-required', requestId })
          if (payload.targetType !== 'integration-proposal' || !/^[a-f0-9-]{36}$/.test(payload.targetId) || !payload.note || !payload.reviewDeclaration) return json(response, 400, { error: 'integration-submission-declaration-required', requestId })
          const database = store.read()
          const proposal = database.integrationProposals.find((item) => item.id === payload.targetId)
          if (!proposal) return json(response, 400, { error: 'integration-proposal-not-found', requestId })
          if (payload.exactRevisionKey !== proposal.exactRevisionKey) return json(response, 409, { error: 'stale-integration-proposal', requestId })
          if (database.integrationQueue.some((entry) => entry.proposalId === proposal.id)) return json(response, 409, { error: 'integration-proposal-already-queued', requestId })
          const proposalFile = resolveInside(store.root, proposal.relativePath)
          const proposalHash = crypto.createHash('sha256').update(fs.readFileSync(proposalFile)).digest('hex')
          if (proposalHash !== proposal.sha256) return json(response, 409, { error: 'integration-proposal-integrity-failed', requestId })
          const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
          const item = findContentItem(registry, proposal.targetId)
          if (!item || item.revisionHash !== proposal.exactRevisionKey) return json(response, 409, { error: 'stale-content-revision', requestId })
          if (item.contentType === 'extra-materials') return json(response, 409, { error: 'cleared-resource-adapter-required', requestId })
          const createdAt = new Date().toISOString()
          const action = { id: crypto.randomUUID(), type: body.type, ...payload, ...actorFields(config), createdAt, grantsApproval: false, status: 'integration-queued' }
          const queueEntry = {
            id: crypto.randomUUID(), proposalId: proposal.id, targetId: item.id, exactRevisionKey: item.revisionHash,
            operation: 'review-adoption-only', status: 'queued', submittedAt: createdAt, submittedBy: { id: config.actorId, roles: [...config.actorRoles] }, note: payload.note,
            controls: { grantsApproval: false, publicationAuthorized: false, publicationStateChangesAllowed: false, resourceImportAllowed: false, directMainPush: false, autoMerge: false },
          }
          store.enqueueIntegration(action, queueEntry)
          store.audit('integration-proposal-queued', { requestId, actionId: action.id, queueId: queueEntry.id, proposalId: proposal.id, targetId: item.id, exactRevisionKey: item.revisionHash, actorId: config.actorId, grantsApproval: false, directMainPush: false })
          return json(response, 201, { ...action, queueEntry })
        }
        if (body.type === 'record-v1-publication-review') {
          const allowed = V1_REVIEW_DECISIONS
          if (payload.targetType !== 'content-item' || !payload.reviewDeclaration
            || !allowed.clinical.includes(payload.clinicalDecision)
            || !allowed.evidence.includes(payload.evidenceDecision)
            || !allowed.publication.includes(payload.publicationRecommendation)) {
            return json(response, 400, { error: 'v1-publication-review-declaration-required', requestId })
          }
          const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
          const item = findContentItem(registry, payload.targetId)
          if (!item || item.contentType !== 'conditions' || !['cervical', 'shoulder', 'elbow'].includes(item.region)) return json(response, 400, { error: 'v1-condition-review-target-required', requestId })
          if (payload.exactRevisionKey !== item.revisionHash) return json(response, 409, { error: 'stale-content-revision', requestId })
          const action = {
            id: crypto.randomUUID(), type: body.type, ...payload, ...actorFields(config), createdAt: new Date().toISOString(),
            grantsApproval: false, publicationAuthorized: false, publicationStateChanged: false, status: 'v1-review-recorded',
          }
          store.addAction(action)
          store.audit('v1-publication-review-recorded', { requestId, actionId: action.id, targetId: item.id, exactRevisionKey: item.revisionHash, actorId: config.actorId, grantsApproval: false, publicationAuthorized: false })
          return json(response, 201, action)
        }
        if (body.type === 'record-v1-claim-review') {
          if (payload.targetType !== 'canonical-claim' || !payload.reviewDeclaration
            || !V1_CLAIM_REVIEW_OPTIONS.evidenceRelationship.includes(payload.evidenceRelationshipDecision)
            || !V1_CLAIM_REVIEW_OPTIONS.clinicalWording.includes(payload.clinicalWordingDecision)) {
            return json(response, 400, { error: 'v1-claim-review-declaration-required', requestId })
          }
          const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
          const canonicalClaims = [...new Map(registry.items.flatMap((item) => item.currentContent?.v1PublicationReview?.clinicalEvidenceAudit?.canonicalClaims ?? []).map((claim) => [claim.id, claim])).values()]
          const claim = canonicalClaims.find((item) => item.id === payload.targetId)
          if (!claim) return json(response, 400, { error: 'v1-canonical-claim-target-required', requestId })
          if (payload.exactRevisionKey !== claim.revisionHash) return json(response, 409, { error: 'stale-canonical-claim-revision', requestId })
          const action = {
            id: crypto.randomUUID(), type: body.type, ...payload, ...actorFields(config), createdAt: new Date().toISOString(),
            humanEvidenceReviewComplete: true, grantsApproval: false, publicationAuthorized: false, publicationStateChanged: false, status: 'v1-claim-review-recorded',
          }
          store.addAction(action)
          store.audit('v1-canonical-claim-review-recorded', { requestId, actionId: action.id, targetId: claim.id, exactRevisionKey: claim.revisionHash, actorId: config.actorId, grantsApproval: false, publicationAuthorized: false })
          return json(response, 201, action)
        }
        if (body.type === 'record-v1-final-condition-confirmation') {
          if (payload.targetType !== 'v1-final-condition' || !payload.reviewDeclaration
            || !V1_FINAL_CONFIRMATION_DECISIONS.clinicalAccuracy.includes(payload.clinicalAccuracyDecision)
            || !V1_FINAL_CONFIRMATION_DECISIONS.evidenceSufficiency.includes(payload.evidenceSufficiencyDecision)
            || !V1_FINAL_CONFIRMATION_DECISIONS.clinicalCompleteness.includes(payload.clinicalCompletenessDecision)
            || !V1_FINAL_CONFIRMATION_DECISIONS.publicationRecommendation.includes(payload.publicationRecommendation)) {
            return json(response, 400, { error: 'v1-final-condition-confirmation-declaration-required', requestId })
          }
          const packet = loadVerifiedV1FinalConditionConfirmation(config.repositoryRoot)
          const condition = packet?.conditions.find((item) => item.conditionId === payload.targetId)
          if (!condition || !condition.lineage.valid) return json(response, 400, { error: 'v1-final-condition-target-required', requestId })
          if (payload.exactRevisionKey !== condition.exactCurrentRevisionHash || payload.confirmationRevisionKey !== condition.confirmationRevisionKey) return json(response, 409, { error: 'stale-final-condition-revision', requestId })
          const action = {
            id: crypto.randomUUID(), type: body.type, ...payload, ...actorFields(config), createdAt: new Date().toISOString(),
            finalHumanConditionConfirmationComplete: true,
            clinicalApprovalGranted: false,
            evidenceApprovalGranted: false,
            grantsApproval: false,
            publicationAuthorized: false,
            publicationStateChanged: false,
            status: 'v1-final-condition-confirmation-recorded',
          }
          store.addAction(action)
          store.audit('v1-final-condition-confirmation-recorded', { requestId, actionId: action.id, targetId: condition.conditionId, exactRevisionKey: condition.exactCurrentRevisionHash, confirmationRevisionKey: condition.confirmationRevisionKey, actorId: config.actorId, grantsApproval: false, publicationAuthorized: false })
          return json(response, 201, action)
        }
        if (body.type === 'queue-extraction') {
          if (payload.targetType !== 'document' || !store.read().documents.some((item) => item.id === payload.targetId)) return json(response, 400, { error: 'private-document-not-found', requestId })
        } else if (payload.targetType === 'content-item') {
          const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
          const item = findContentItem(registry, payload.targetId)
          if (!item) return json(response, 400, { error: 'content-item-not-found', requestId })
          if (payload.exactRevisionKey !== item.revisionHash) return json(response, 409, { error: 'stale-content-revision', requestId })
        } else if (payload.targetType !== 'document' || !store.read().documents.some((item) => item.id === payload.targetId)) {
          return json(response, 400, { error: 'review-target-not-found', requestId })
        }
        const action = { id: crypto.randomUUID(), type: body.type, ...payload, ...actorFields(config), createdAt: new Date().toISOString(), grantsApproval: false, status: 'recorded' }
        if (body.type === 'mark-review-complete') {
          const database = store.read()
          if (database.integrationProposals.some((item) => item.targetId === payload.targetId && item.exactRevisionKey === payload.exactRevisionKey)) return json(response, 409, { error: 'integration-proposal-already-exists', requestId })
          const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: studioConfig })
          const item = findContentItem(registry, payload.targetId)
          const proposalId = crypto.randomUUID()
          const proposalDocument = {
            schemaVersion: 1,
            kind: 'content-integration-proposal',
            id: proposalId,
            status: 'ready-for-integration-assessment',
            targetId: item.id,
            exactRevisionKey: item.revisionHash,
            item: {
              region: item.region,
              contentType: item.contentType,
              title: item.title,
              lifecycleAtReview: item.lifecycle,
              publicationStateAtReview: item.publicationState,
              sourceLinks: item.sourceLinks,
            },
            review: { actionId: action.id, completedAt: action.createdAt, actorId: config.actorId, actorRoles: [...config.actorRoles], note: payload.note },
            controls: {
              grantsApproval: false,
              publicationAuthorized: false,
              repositoryModified: false,
              clinicalContentCopied: false,
              requiredNextSteps: ['inspect-authoritative-source-diff', 'create-feature-branch', 'run-public-boundary-validation', 'obtain-explicit-publication-authority-if-publication-is-proposed'],
            },
          }
          const bytes = `${JSON.stringify(proposalDocument, null, 2)}\n`
          const file = store.generatedPath('exports', proposalId, '.json')
          fs.writeFileSync(file, bytes, { encoding: 'utf8', flag: 'wx' })
          const proposal = { ...proposalDocument, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), relativePath: path.relative(store.root, file) }
          action.status = 'review-completed-proposal-created'
          try {
            store.recordReviewCompletion(action, proposal)
          } catch (error) {
            fs.rmSync(file, { force: true })
            throw error
          }
          store.audit('review-completed-integration-proposal-created', { requestId, actionId: action.id, proposalId, targetId: item.id, exactRevisionKey: item.revisionHash, grantsApproval: false, publicationAuthorized: false })
          return json(response, 201, { ...action, integrationProposal: clientProposal(proposal) })
        }
        if (body.type === 'queue-extraction') {
          try {
            regenerateSafePreview(store, payload.targetId)
            action.status = 'safe-text-preview-generated'
          } catch (error) {
            action.status = 'human-reviewed-extraction-required'
            action.note = `${action.note} ${error.message}`.trim().slice(0, 3000)
          }
        }
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
