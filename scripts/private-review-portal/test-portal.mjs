import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { loadConfig, repositoryRoot } from '../../ai-manager/private-review-portal/config.mjs'
import { intakeUpload } from '../../ai-manager/private-review-portal/intake.mjs'
import { allowedExtensions, inspectFile, sanitizeFilename } from '../../ai-manager/private-review-portal/mime.mjs'
import { createPortalServer } from '../../ai-manager/private-review-portal/server.mjs'
import { SessionStore, SlidingWindowRateLimiter, isAllowedHost, securityHeaders } from '../../ai-manager/private-review-portal/security.mjs'
import { PrivateStore, privateFolders, resolveInside } from '../../ai-manager/private-review-portal/store.mjs'

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-private-portal-test-'))
const passphrase = 'synthetic-review-passphrase-2026'
const writeFixture = (name, bytes) => {
  const file = path.join(temporaryRoot, name)
  fs.writeFileSync(file, bytes)
  return file
}
const fixtures = new Map([
  ['paper.pdf', Buffer.from('%PDF-1.4\n% synthetic\n')],
  ['slides.pptx', Buffer.from('PK\u0003\u0004[Content_Types].xml ppt/slides/slide1.xml')],
  ['document.docx', Buffer.from('PK\u0003\u0004[Content_Types].xml word/document.xml')],
  ['notes.md', Buffer.from('# Synthetic\nNo patient data.')],
  ['notes.txt', Buffer.from('Synthetic project notes.')],
  ['table.csv', Buffer.from('heading,value\nsynthetic,1\n')],
  ['image.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
  ['image.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00])],
  ['image.webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from('synthetic')])],
])

try {
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: passphrase, MSK_REVIEW_PORTAL_HOST: '0.0.0.0' }), /loopback/)
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: 'too-short' }), /at least 16/)
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: passphrase, MSK_REVIEW_PORTAL_DATA_ROOT: path.join(repositoryRoot, 'private-data') }), /outside/)
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: passphrase, MSK_REVIEW_PORTAL_NETWORK_EXPOSURE: 'tailscale-serve' }), /HTTPS origin/)

  assert.equal(sanitizeFilename('../unsafe\\patient:name?.txt'), 'patient_name_.txt')
  assert.throws(() => sanitizeFilename('../..'), /safe filename/)
  assert.ok(sanitizeFilename(`${'資料'.repeat(100)}.txt`).length <= 120)
  for (const [name, bytes] of fixtures) {
    const inspected = inspectFile(writeFixture(name, bytes), name, allowedExtensions.get(path.extname(name)))
    assert.equal(inspected.detectedType, allowedExtensions.get(path.extname(name)))
  }
  assert.throws(() => inspectFile(writeFixture('active.svg', Buffer.from('<svg><script>alert(1)</script></svg>')), 'active.svg', 'image/svg+xml'), /extension/)
  assert.throws(() => inspectFile(writeFixture('active.txt', Buffer.from('<!doctype html><script>alert(1)</script>')), 'active.txt', 'text/plain'), /Active HTML/)
  assert.throws(() => inspectFile(writeFixture('macro.docm', fixtures.get('document.docx')), 'macro.docm', 'application/octet-stream'), /extension/)
  assert.throws(() => inspectFile(writeFixture('mismatch.pdf', fixtures.get('image.jpg')), 'mismatch.pdf', 'application/pdf'), /does not match/)
  assert.throws(() => inspectFile(writeFixture('embedded.docx', Buffer.from('PK\u0003\u0004[Content_Types].xml word/embeddings/vbaProject.bin')), 'embedded.docx', 'application/octet-stream'), /embedded/)

  const store = new PrivateStore(path.join(temporaryRoot, 'private-data'))
  assert.deepEqual(privateFolders.filter((folder) => fs.existsSync(path.join(store.root, folder))), privateFolders)
  assert.throws(() => resolveInside(store.root, '..', 'escape'), /escapes/)
  const config = {
    ...loadConfig({
      MSK_REVIEW_PORTAL_PASSPHRASE: passphrase,
      MSK_REVIEW_PORTAL_DATA_ROOT: store.root,
      MSK_REVIEW_PORTAL_MAX_FILE_BYTES: '1024',
      MSK_REVIEW_PORTAL_MAX_BATCH_BYTES: '4096',
    }),
    repositoryRoot,
  }
  const cleanScan = async () => ({ status: 'clean', scanner: 'synthetic-scanner', version: '1', detail: 'test-clean' })
  const first = await intakeUpload({ stream: Readable.from(fixtures.get('notes.txt')), originalName: 'mobile notes.txt', declaredType: 'text/plain', contentLength: fixtures.get('notes.txt').length, metadata: { title: 'Synthetic notes', tags: ['test'] }, store, config, scan: cleanScan })
  assert.equal(first.scan.status, 'clean')
  assert.equal(first.provenance.immutableOriginal, true)
  assert.ok(fs.existsSync(resolveInside(store.root, first.relativePath)))
  assert.throws(() => store.updateDocumentWorkflow(first.id, { originalName: 'changed.txt' }), /Immutable/)
  const duplicate = await intakeUpload({ stream: Readable.from(fixtures.get('notes.txt')), originalName: 'duplicate.txt', declaredType: 'text/plain', contentLength: fixtures.get('notes.txt').length, metadata: {}, store, config, scan: cleanScan })
  assert.equal(duplicate.duplicateOf, first.id)
  const unscanned = await intakeUpload({ stream: Readable.from(fixtures.get('paper.pdf')), originalName: 'held.pdf', declaredType: 'application/pdf', contentLength: fixtures.get('paper.pdf').length, metadata: {}, store, config, scan: async () => ({ status: 'unscanned', scanner: 'synthetic-scanner', version: null, detail: 'unavailable' }) })
  assert.equal(unscanned.quarantine, 'held')
  assert.match(unscanned.relativePath, /^quarantine[\\/]/)
  const rejected = await intakeUpload({ stream: Readable.from(fixtures.get('image.jpg')), originalName: 'rejected.jpg', declaredType: 'image/jpeg', contentLength: fixtures.get('image.jpg').length, metadata: {}, store, config, scan: async () => ({ status: 'rejected', scanner: 'synthetic-scanner', version: '1', detail: 'synthetic-threat' }) })
  assert.equal(rejected.quarantine, 'held')
  await assert.rejects(() => intakeUpload({ stream: Readable.from(Buffer.alloc(2048)), originalName: 'large.txt', declaredType: 'text/plain', contentLength: 2048, metadata: {}, store, config, scan: cleanScan }), /limit/)
  const interrupted = Readable.from((async function * () { yield Buffer.from('partial'); throw new Error('synthetic interruption') })())
  await assert.rejects(() => intakeUpload({ stream: interrupted, originalName: 'interrupted.txt', declaredType: 'text/plain', contentLength: Number.NaN, metadata: {}, store, config, scan: cleanScan }), /interruption/)
  const partials = fs.readdirSync(path.join(store.root, 'quarantine')).filter((name) => name.endsWith('.part'))
  assert.deepEqual(partials, [], `interrupted upload left quarantine partials: ${partials.join(', ')}`)

  let clock = 1000
  const sessions = new SessionStore({ inactivityMs: 100, absoluteSessionMs: 1000, now: () => clock })
  const created = sessions.create()
  assert.ok(sessions.get(created.token))
  clock += 101
  assert.equal(sessions.get(created.token), null)
  const revoked = sessions.create()
  assert.equal(sessions.revoke(revoked.token), true)
  assert.equal(sessions.get(revoked.token), null)
  const rate = new SlidingWindowRateLimiter(2, 100, () => clock)
  assert.equal(rate.consume('client'), true)
  assert.equal(rate.consume('client'), true)
  assert.equal(rate.consume('client'), false)
  assert.match(securityHeaders['Content-Security-Policy'], /object-src 'none'/)
  assert.equal(securityHeaders['Cache-Control'], 'no-store, max-age=0')
  assert.equal(isAllowedHost({ headers: { host: 'attacker.invalid' } }, new Set(['http://127.0.0.1:4379'])), false)

  const serverStore = new PrivateStore(path.join(temporaryRoot, 'server-data'))
  const serverConfig = { ...config, dataRoot: serverStore.root, origins: new Set(), port: 0, rateLimitPerMinute: 100 }
  const portal = createPortalServer({ config: serverConfig, store: serverStore, scan: cleanScan })
  await new Promise((resolve) => portal.server.listen(0, '127.0.0.1', resolve))
  const address = portal.server.address()
  const origin = `http://127.0.0.1:${address.port}`
  serverConfig.origins.add(origin)
  const request = (route, options = {}) => fetch(`${origin}${route}`, { ...options, headers: { Origin: origin, ...options.headers } })
  try {
    const wrongLogin = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: 'wrong-passphrase-value' }) })
    assert.equal(wrongLogin.status, 401)
    const badOrigin = await fetch(`${origin}/api/login`, { method: 'POST', headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) })
    assert.equal(badOrigin.status, 403)
    const login = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase }) })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
    const loginBody = await login.json()
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const authenticated = await request('/api/session', { headers: { Cookie: cookie } })
    assert.equal(authenticated.status, 200)
    const dashboard = await request('/api/dashboard', { headers: { Cookie: cookie } })
    const dashboardBody = await dashboard.json()
    assert.equal(dashboardBody.headline.reviewTargets, 96)
    assert.equal(dashboardBody.headline.pendingReviews, 431)
    assert.equal(dashboardBody.headline.releaseBlockers, 500)
    const missingCsrf = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add-note' }) })
    assert.equal(missingCsrf.status, 403)
    const upload = await request('/api/uploads', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'X-File-Name': 'phone upload.txt', 'X-Upload-Batch': 'mobile-batch', 'Content-Type': 'text/plain', 'X-Upload-Metadata': Buffer.from(JSON.stringify({ title: 'Phone synthetic' })).toString('base64url') },
      body: fixtures.get('notes.txt'),
    })
    assert.equal(upload.status, 201)
    const uploaded = await upload.json()
    const action = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'accept-proposal', targetType: 'document', targetId: uploaded.id, note: 'Technical disposition only' }) })
    assert.equal(action.status, 201)
    assert.equal((await action.json()).grantsApproval, false)
    const unknownRevision = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'link-exact-revision', targetType: 'document', targetId: uploaded.id, exactRevisionKey: 'unknown@1#sha256:none' }) })
    assert.equal(unknownRevision.status, 400)
    const exactRevisionKey = dashboardBody.datasets.find((dataset) => dataset.id === 'reviews').items[0].target.exactRevisionKey
    const knownRevision = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'link-exact-revision', targetType: 'document', targetId: uploaded.id, exactRevisionKey }) })
    assert.equal(knownRevision.status, 201)
    assert.equal((await knownRevision.json()).grantsApproval, false)
    const extraction = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'queue-extraction', targetType: 'document', targetId: uploaded.id }) })
    assert.equal((await extraction.json()).status, 'safe-text-preview-generated')
    const regeneration = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'queue-extraction', targetType: 'document', targetId: uploaded.id }) })
    assert.equal((await regeneration.json()).status, 'safe-text-preview-generated')
    assert.equal(serverStore.read().documents.find((item) => item.id === uploaded.id).derivedFiles.length, 2)
    const preview = await request(`/api/documents/${uploaded.id}/preview`, { headers: { Cookie: cookie } })
    assert.equal(await preview.text(), fixtures.get('notes.txt').toString())
    const download = await request(`/api/documents/${uploaded.id}/download`, { headers: { Cookie: cookie } })
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), fixtures.get('notes.txt'))
    const traversal = await request('/api/documents/../../package.json/download', { headers: { Cookie: cookie } })
    assert.equal(traversal.status, 404)
    const logout = await request('/api/logout', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf } })
    assert.equal(logout.status, 200)
    const afterLogout = await request('/api/session', { headers: { Cookie: cookie } })
    assert.equal(afterLogout.status, 401)
  } finally {
    await new Promise((resolve) => portal.server.close(resolve))
  }

  const tracked = await new Promise((resolve, reject) => {
    import('node:child_process').then(({ spawn }) => {
      const child = spawn('git', ['ls-files'], { cwd: repositoryRoot, shell: false })
      let output = ''
      child.stdout.on('data', (chunk) => { output += chunk })
      child.on('error', reject)
      child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error('git ls-files failed')))
    })
  })
  assert.ok(!tracked.includes('msk-private-review-data'))
  const portalHtml = fs.readFileSync(path.join(repositoryRoot, 'ai-manager', 'private-review-portal', 'static', 'index.html'), 'utf8')
  assert.match(portalHtml, /capture="environment"/)
  for (const script of ['tailscale-serve-start.ps1', 'tailscale-serve-stop.ps1', 'tailscale-serve-reset.ps1']) {
    const content = fs.readFileSync(path.join(repositoryRoot, 'scripts', 'private-review-portal', script), 'utf8')
    assert.ok(!/\bfunnel\s+(?:on|reset|--bg|--https)/i.test(content), `${script} must never configure Funnel`)
  }
  console.log(`Private portal tests passed: ${fixtures.size} allowed synthetic types, security/session controls, quarantine, duplicates, immutable originals, safe preview/download, mobile upload, and zero automatic approvals.`)
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
