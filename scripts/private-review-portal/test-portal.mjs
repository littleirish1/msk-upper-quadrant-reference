import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { loadConfig, repositoryRoot } from '../../ai-manager/private-review-portal/config.mjs'
import { createRegistryItem, createShoulderAdapter, deriveStudioSummary, loadContentRegistry, loadStudioConfig } from '../../ai-manager/private-review-portal/content-studio.mjs'
import { intakeUpload } from '../../ai-manager/private-review-portal/intake.mjs'
import { buildFeatureBranchPlan, buildReviewAdoptionManifest, loadIntegrationPolicy, prepareIntegrationPacket, validateQueuedIntegration } from '../../ai-manager/private-review-portal/integration.mjs'
import { allowedExtensions, inspectFile, sanitizeFilename } from '../../ai-manager/private-review-portal/mime.mjs'
import { createPortalServer } from '../../ai-manager/private-review-portal/server.mjs'
import { SessionStore, SlidingWindowRateLimiter, isAllowedHost, securityHeaders } from '../../ai-manager/private-review-portal/security.mjs'
import { PrivateStore, privateFolders, resolveInside } from '../../ai-manager/private-review-portal/store.mjs'
import { V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH, loadOptionalV1IndependentFinalRecommendations } from '../../ai-manager/private-review-portal/v1-independent-final-recommendations.mjs'

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-private-portal-test-'))
const passphrase = 'synthetic-review-passphrase-2026'
const shoulderSourcePaths = [
  'reports/guided-cases/summary.json',
  'ai-manager/clinical-platform/shoulder/movement-library.json',
  'ai-manager/clinical-platform/shoulder/module-library.json',
  'ai-manager/clinical-platform/anatomy-3d/registry.json',
  'ai-manager/clinical-platform/shoulder/mcq-plan.json',
  'ai-manager/clinical-platform/shoulder/source-inventory.json',
  'ai-manager/clinical-platform/shoulder/evidence-map.json',
  'ai-manager/clinical-platform/shoulder/compatibility-rules.json',
  'ai-manager/clinical-platform/anatomy-3d/source-candidates.json',
  ...fs.readdirSync(path.join(repositoryRoot, 'content', 'shoulder')).filter((name) => name.endsWith('.mdx')).sort().map((name) => `content/shoulder/${name}`),
]
const sourceHashes = () => Object.fromEntries(shoulderSourcePaths.map((relativePath) => [relativePath, crypto.createHash('sha256').update(fs.readFileSync(path.join(repositoryRoot, ...relativePath.split('/')))).digest('hex')]))
const originalSourceHashes = sourceHashes()
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
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: passphrase, MSK_REVIEW_PORTAL_ACTOR_ROLES: 'content-reviewer,integration-proposer' }), /explicit MSK_REVIEW_PORTAL_ACTOR_ID/)
  assert.throws(() => loadConfig({ MSK_REVIEW_PORTAL_PASSPHRASE: passphrase, MSK_REVIEW_PORTAL_ACTOR_ID: 'synthetic-reviewer', MSK_REVIEW_PORTAL_ACTOR_ROLES: 'publisher' }), /unsupported role/)

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
  const studioConfig = loadStudioConfig()
  for (const region of ['cervical', 'thoracic', 'shoulder', 'elbow', 'wrist-hand', 'lumbar', 'hip', 'knee', 'ankle-foot', 'neuro', 'anatomy-only', 'non-region-specific']) assert.ok(studioConfig.regions.some((item) => item.id === region))
  for (const contentType of ['cases', 'conditions', 'movements', 'anatomy', '3d-assets', 'mcqs', 'evidence', 'extra-materials', 'modules', 'compatibility-rules']) assert.ok(studioConfig.contentTypes.includes(contentType))
  const registry = loadContentRegistry({ repositoryRoot, store })
  assert.equal(registry.items.filter((item) => item.id.startsWith('movement.shoulder.')).length, 20)
  assert.equal(registry.items.filter((item) => item.region === 'shoulder' && item.contentType === '3d-assets').length, 16)
  assert.ok(registry.items.filter((item) => item.id.startsWith('3d-plan.')).every((item) => item.currentContent.assetPath === null && item.currentContent.actualStructureCount === 0))
  assert.equal(registry.items.filter((item) => item.region === 'shoulder' && item.contentType === 'mcqs').length, 10)
  assert.ok(registry.items.filter((item) => item.contentType === 'mcqs').every((item) => item.currentContent.authoredContent === null))
  assert.equal(registry.items.filter((item) => item.region === 'shoulder' && item.contentType === 'compatibility-rules').length, 12)
  const sourceCandidates = registry.items.filter((item) => ['upstream-source-archive', 'derived-candidate-archive', 'derived-glb', 'movement-definition'].includes(item.currentContent.candidateType))
  assert.equal(sourceCandidates.length, 26)
  assert.equal(sourceCandidates.filter((item) => item.contentType === '3d-assets').length, 8)
  assert.equal(sourceCandidates.filter((item) => item.contentType === 'movements').length, 18)
  assert.ok(sourceCandidates.every((item) => item.publicationState === 'private' && item.grantsApproval === false && item.currentContent.repositoryAssetPath === null))
  assert.ok(sourceCandidates.every((item) => !item.sourceLinks.some((link) => /^[a-z]:[\\/]/i.test(link))))
  assert.equal(sourceCandidates.find((item) => item.id.startsWith('candidate3d.z-anatomy.')).currentContent.upstream.exactArchiveMatch, true)
  const zBiomechanics = sourceCandidates.find((item) => item.id.startsWith('candidate3d.z-biomechanics.'))
  assert.equal(zBiomechanics.currentContent.sha256, '0a74b2fa3c47db925b06241fa38c89b0811e58a78ee28ec440cd460e279cf22b')
  assert.equal(zBiomechanics.currentContent.upstream.archiveGitBlobSha1, '0a59584deaf21773ffa3acb063f2cd06f3485a98')
  assert.equal(zBiomechanics.currentContent.upstream.wipIsClinicalEvidence, false)
  assert.equal(sourceCandidates.filter((item) => item.currentContent.candidateType === 'derived-glb').length, 5)
  assert.equal(sourceCandidates.filter((item) => item.currentContent.candidateType === 'movement-definition' && item.currentContent.existingMovementSlotId).length, 5)
  assert.ok(sourceCandidates.filter((item) => item.currentContent.candidateType === 'movement-definition').every((item) => item.currentContent.adoptedMovementData === null && item.currentContent.claimEvidenceRecordIds.length === 0))
  assert.ok(registry.items.filter((item) => item.contentType === 'cases' && item.learnerPreview).every((item) => item.learnerPreview.route.startsWith(`/cases/${item.region}/`)))
  assert.ok(registry.items.filter((item) => item.contentType === 'compatibility-rules').every((item) => item.currentContent.enabled === false))
  assert.equal(deriveStudioSummary(registry).readyForApproval, 0)
  assert.ok(registry.items.every((item) => item.grantsApproval === false))
  const publicationSnapshot = Object.fromEntries(registry.items.map((item) => [item.id, item.publicationState]))

  const recommendationFixtureRoot = path.join(temporaryRoot, 'recommendation-fixture')
  const recommendationFixturePath = path.join(recommendationFixtureRoot, ...V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH.split('/'))
  const expectedRecommendationConditions = Array.from({ length: 20 }, (_, index) => ({
    conditionId: `condition.synthetic.${String(index + 1).padStart(2, '0')}`,
    exactCurrentRevisionHash: `sha256:${String(index + 1).padStart(64, '0')}`,
  }))
  assert.equal(loadOptionalV1IndependentFinalRecommendations(recommendationFixtureRoot, expectedRecommendationConditions).available, false)
  fs.mkdirSync(path.dirname(recommendationFixturePath), { recursive: true })
  const recommendationFixture = {
    packetType: 'v1-independent-final-20-condition-recommendations',
    conditions: expectedRecommendationConditions.map((condition) => ({
      ...condition,
      recommendations: {
        clinicalAccuracy: 'acceptable-for-v1',
        evidenceSufficiency: 'changes-required',
        clinicalCompleteness: 'future-expansion-non-blocking',
        publicationRecommendation: 'recommend-hold',
      },
      reviewerNote: 'Synthetic independent recommendation for interface testing only.',
    })),
    grantsApproval: false,
    publicationAuthorized: false,
    publicationStateChanged: false,
  }
  fs.writeFileSync(recommendationFixturePath, `${JSON.stringify(recommendationFixture, null, 2)}\n`)
  const loadedRecommendationFixture = loadOptionalV1IndependentFinalRecommendations(recommendationFixtureRoot, expectedRecommendationConditions)
  assert.equal(loadedRecommendationFixture.available, true)
  assert.equal(loadedRecommendationFixture.conditions.length, 20)
  assert.equal(loadedRecommendationFixture.conditions[0].reviewerNote, 'Synthetic independent recommendation for interface testing only.')
  const staleRecommendationFixture = structuredClone(recommendationFixture)
  staleRecommendationFixture.conditions[0].exactCurrentRevisionHash = `sha256:${'f'.repeat(64)}`
  fs.writeFileSync(recommendationFixturePath, `${JSON.stringify(staleRecommendationFixture, null, 2)}\n`)
  assert.throws(() => loadOptionalV1IndependentFinalRecommendations(recommendationFixtureRoot, expectedRecommendationConditions), /Stale independent recommendation/)
  const overreachingRecommendationFixture = structuredClone(recommendationFixture)
  overreachingRecommendationFixture.grantsApproval = true
  fs.writeFileSync(recommendationFixturePath, `${JSON.stringify(overreachingRecommendationFixture, null, 2)}\n`)
  assert.throws(() => loadOptionalV1IndependentFinalRecommendations(recommendationFixtureRoot, expectedRecommendationConditions), /exceeds recommendation-only authority/)

  const mockConfig = { ...studioConfig, regions: [...studioConfig.regions, { id: 'mock-region', label: 'Mock region', availability: 'test-only' }] }
  const mockAdapter = { id: 'mock-adapter', regions: ['mock-region'], load: () => [createRegistryItem({ id: 'mock.item.1', region: 'mock-region', contentType: 'modules', title: 'Synthetic registry fixture', lifecycle: 'draft', publicationState: 'private', clinicalReview: 'required', evidenceReview: 'required', accessibilityReview: 'required', licensingReview: 'required', blockers: ['synthetic-test-blocker'], sourceLinks: [], currentContent: { synthetic: true }, missingFields: ['synthetic content'] })] }
  const mockRegistry = loadContentRegistry({ repositoryRoot, store, adapters: [createShoulderAdapter(), mockAdapter], config: mockConfig })
  assert.ok(mockRegistry.items.some((item) => item.region === 'mock-region'))
  const config = {
    ...loadConfig({
      MSK_REVIEW_PORTAL_PASSPHRASE: passphrase,
      MSK_REVIEW_PORTAL_DATA_ROOT: store.root,
      MSK_REVIEW_PORTAL_MAX_FILE_BYTES: '1024',
      MSK_REVIEW_PORTAL_MAX_BATCH_BYTES: '4096',
      MSK_REVIEW_PORTAL_ACTOR_ID: 'synthetic-reviewer',
      MSK_REVIEW_PORTAL_ACTOR_ROLES: 'content-reviewer,integration-proposer',
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
    const reviewLedger = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'ai-manager', 'clinical-platform', 'reviews', 'review-ledger.json'), 'utf8'))
    const releaseCandidate = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'ai-manager', 'clinical-platform', 'release', 'v1-release-candidate.json'), 'utf8'))
    const evidencePopulation = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'reports', 'clinical-platform', 'evidence-hub-population.json'), 'utf8'))
    const reviewQueues = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'reports', 'clinical-platform', 'review-queues.json'), 'utf8'))
    const dependencies = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'reports', 'private-review-portal', 'dependency-classification.json'), 'utf8'))
    assert.equal(dashboardBody.headline.reviewTargets, reviewLedger.reviews.length)
    assert.equal(dashboardBody.headline.pendingReviews, reviewLedger.reviews.reduce((total, item) => total + item.decisions.filter((decision) => decision.state !== 'approved').length, 0))
    assert.equal(dashboardBody.headline.releaseBlockers, releaseCandidate.blockers.length)
    assert.equal(dashboardBody.headline.evidenceRecords, Array.isArray(evidencePopulation.evidenceRecords) ? evidencePopulation.evidenceRecords.length : Number(evidencePopulation.evidenceRecords))
    assert.equal(dashboardBody.datasets.find((dataset) => dataset.id === 'source-clearance').count, reviewQueues.queue.filter((item) => item.reviewKind === 'source').length)
    assert.equal(dashboardBody.datasets.find((dataset) => dataset.id === 'dependencies').count, dependencies.findings.length)
    assert.equal(dashboardBody.studio.summary.totalItems, registry.items.length)
    assert.equal(dashboardBody.studio.summary.readyForApproval, 0)
    assert.equal(dashboardBody.studio.summary.integrationProposals, 0)
    assert.equal(dashboardBody.studio.summary.queuedForIntegration, 0)
    assert.deepEqual(dashboardBody.studio.integrationProposals, [])
    assert.deepEqual(dashboardBody.studio.integrationQueue, [])
    assert.deepEqual(dashboardBody.studio.actor, { id: 'synthetic-reviewer', roles: ['content-reviewer', 'integration-proposer'] })
    assert.equal(dashboardBody.studio.capabilities.submitIntegrationProposal, true)
    assert.ok(dashboardBody.studio.items.every((item) => item.currentContent === undefined && item.grantsApproval === false))
    assert.equal(dashboardBody.v1PublicationReview.scope.conditions, 20)
    assert.equal(dashboardBody.v1PublicationReview.scope.baselineCases, 5)
    assert.deepEqual(dashboardBody.v1PublicationReview.scope.futureFeaturesRequiredForV1, { movements: false, mcqs: false, modules: false, anatomy3d: false })
    assert.equal(dashboardBody.v1PublicationReview.grantsApproval, false)
    assert.equal(dashboardBody.v1PublicationReview.publicationAuthorized, false)
    assert.deepEqual(dashboardBody.v1PublicationReview.categoryCounts, {
      'no-automated-issue-detected-human-confirmation-only': 0,
      'evidence-follow-up-required': 0,
      'clinical-content-issue-detected': 0,
      'publication-blocker': 20,
    })
    assert.ok(dashboardBody.v1PublicationReview.conditions.every((item) => item.reviewCard.priorityAClaimsRequiringHumanVerification > 0))
    assert.ok(dashboardBody.v1PublicationReview.conditions.every((item) => item.reviewCard.grantsApproval === false && item.reviewCard.publicationAuthorized === false))
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.startingCanonicalClaims, 304)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.currentCanonicalClaims, 217)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.finalHumanEvidenceDecisionsRemaining, 0)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.humanDecisions.length, 0)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.criticalOwnerAdoption.recommendationCount, 47)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.criticalOwnerAdoption.resultingFileCount, 20)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.criticalOwnerAdoption.grantsApproval, false)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.majorOwnerAdoption.recommendationCount, 23)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.majorOwnerAdoption.resultingFileCount, 15)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.majorOwnerAdoption.grantsApproval, false)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.grantsApproval, false)
    assert.equal(dashboardBody.v1PublicationReview.publicationMinimumEvidence.publicationAuthorized, false)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.conditionsIncluded, 20)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.validReviewLineage, 20)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.confirmationsRecorded, 0)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.blankDecisionFieldsRemaining, 80)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.manualBrowserChecksRemaining, 90)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.manualAccessibilityChecksRemaining, 13)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.grantsApproval, false)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.publicationAuthorized, false)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.independentRecommendations.available, false)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.independentRecommendations.conditionCount, 0)
    assert.equal(dashboardBody.v1PublicationReview.finalConditionConfirmation.conditions.length, 20)
    assert.ok(dashboardBody.v1PublicationReview.finalConditionConfirmation.conditions.every((condition) => condition.independentRecommendation === null && condition.independentRecommendationStatus === 'not-available'))
    assert.ok(dashboardBody.v1PublicationReview.finalConditionConfirmation.conditions.every((condition) => condition.ownerDecision === null && condition.technicalAudit.canonicalConditionId === condition.conditionId))
    assert.ok(dashboardBody.v1PublicationReview.finalConditionConfirmation.conditions.every((condition) => condition.lineageValid && condition.lineage.valid))
    assert.deepEqual(dashboardBody.v1PublicationReview.humanReviewItemsRemaining, {
      conditionDecisionFields: 80,
      browserViewportThemeReviews: 6,
      accessibilityChecks: 13,
    })
    const movementSummary = dashboardBody.studio.items.find((item) => item.contentType === 'movements')
    const contentDetail = await request(`/api/content/${encodeURIComponent(movementSummary.id)}`, { headers: { Cookie: cookie } })
    assert.equal(contentDetail.status, 200)
    const contentItem = await contentDetail.json()
    assert.equal(contentItem.id, movementSummary.id)
    assert.equal(contentItem.currentContent.publicEligibility, false)
    assert.deepEqual(contentItem.privateReviewActions, [])
    assert.deepEqual(contentItem.integrationProposals, [])
    assert.deepEqual(contentItem.integrationQueue, [])
    const missingCsrf = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add-note' }) })
    assert.equal(missingCsrf.status, 403)
    const upload = await request('/api/uploads', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'X-File-Name': 'phone upload.txt', 'X-Upload-Batch': 'mobile-batch', 'Content-Type': 'text/plain', 'X-Upload-Metadata': Buffer.from(JSON.stringify({ title: 'Phone synthetic' })).toString('base64url') },
      body: fixtures.get('notes.txt'),
    })
    assert.equal(upload.status, 201)
    const uploaded = await upload.json()
    const prohibited = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'accept-proposal', targetType: 'document', targetId: uploaded.id, note: 'Must remain prohibited' }) })
    assert.equal(prohibited.status, 400)
    const staleAction = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add-note', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: 'sha256:stale', note: 'Synthetic stale action' }) })
    assert.equal(staleAction.status, 409)
    const action = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add-note', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: contentItem.revisionHash, note: 'Private synthetic review note' }) })
    assert.equal(action.status, 201)
    assert.equal((await action.json()).grantsApproval, false)
    const task = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'create-human-review-task', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: contentItem.revisionHash, note: 'Private synthetic review task' }) })
    assert.equal(task.status, 201)
    assert.equal((await task.json()).grantsApproval, false)
    const v1Condition = registry.items.find((item) => item.contentType === 'conditions' && item.region === 'cervical')
    const invalidV1Review = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-publication-review', targetType: 'content-item', targetId: v1Condition.id, exactRevisionKey: v1Condition.revisionHash, clinicalDecision: 'approved', evidenceDecision: 'acceptable-for-v1', publicationRecommendation: 'recommend-publish', reviewDeclaration: true }) })
    assert.equal(invalidV1Review.status, 400)
    const v1Review = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-publication-review', targetType: 'content-item', targetId: v1Condition.id, exactRevisionKey: v1Condition.revisionHash, clinicalDecision: 'acceptable', evidenceDecision: 'follow-up-non-blocking', publicationRecommendation: 'recommend-publish', note: 'Synthetic reviewer recommendation only', reviewDeclaration: true }) })
    assert.equal(v1Review.status, 201)
    const v1ReviewBody = await v1Review.json()
    assert.equal(v1ReviewBody.grantsApproval, false)
    assert.equal(v1ReviewBody.publicationAuthorized, false)
    assert.equal(v1ReviewBody.publicationStateChanged, false)
    const finalCondition = v1Condition.currentContent.finalConditionConfirmation
    assert.ok(finalCondition?.lineage.valid)
    const invalidFinalConfirmation = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-final-condition-confirmation', targetType: 'v1-final-condition', targetId: finalCondition.conditionId, exactRevisionKey: finalCondition.exactCurrentRevisionHash, confirmationRevisionKey: finalCondition.confirmationRevisionKey, clinicalAccuracyDecision: 'approved', evidenceSufficiencyDecision: 'acceptable-for-v1', clinicalCompletenessDecision: 'acceptable-for-v1', publicationRecommendation: 'recommend-publish', reviewDeclaration: true }) })
    assert.equal(invalidFinalConfirmation.status, 400)
    const staleFinalConfirmation = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-final-condition-confirmation', targetType: 'v1-final-condition', targetId: finalCondition.conditionId, exactRevisionKey: 'sha256:stale', confirmationRevisionKey: finalCondition.confirmationRevisionKey, clinicalAccuracyDecision: 'acceptable-for-v1', evidenceSufficiencyDecision: 'acceptable-for-v1', clinicalCompletenessDecision: 'future-expansion-non-blocking', publicationRecommendation: 'recommend-publish', reviewDeclaration: true }) })
    assert.equal(staleFinalConfirmation.status, 409)
    const finalConfirmationResponse = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-final-condition-confirmation', targetType: 'v1-final-condition', targetId: finalCondition.conditionId, exactRevisionKey: finalCondition.exactCurrentRevisionHash, confirmationRevisionKey: finalCondition.confirmationRevisionKey, clinicalAccuracyDecision: 'acceptable-for-v1', evidenceSufficiencyDecision: 'acceptable-for-v1', clinicalCompletenessDecision: 'future-expansion-non-blocking', publicationRecommendation: 'recommend-publish', note: 'Synthetic final confirmation only', reviewDeclaration: true }) })
    assert.equal(finalConfirmationResponse.status, 201)
    const finalConfirmationBody = await finalConfirmationResponse.json()
    assert.equal(finalConfirmationBody.finalHumanConditionConfirmationComplete, true)
    assert.equal(finalConfirmationBody.clinicalApprovalGranted, false)
    assert.equal(finalConfirmationBody.evidenceApprovalGranted, false)
    assert.equal(finalConfirmationBody.grantsApproval, false)
    assert.equal(finalConfirmationBody.publicationAuthorized, false)
    assert.equal(finalConfirmationBody.publicationStateChanged, false)
    const ownerDecisionDashboard = await request('/api/dashboard', { headers: { Cookie: cookie } })
    const ownerDecisionDashboardBody = await ownerDecisionDashboard.json()
    const recordedOwnerDecision = ownerDecisionDashboardBody.v1PublicationReview.finalConditionConfirmation.conditions.find((condition) => condition.conditionId === finalCondition.conditionId).ownerDecision
    assert.deepEqual({
      clinicalAccuracy: recordedOwnerDecision.clinicalAccuracy,
      evidenceSufficiency: recordedOwnerDecision.evidenceSufficiency,
      clinicalCompleteness: recordedOwnerDecision.clinicalCompleteness,
      publicationRecommendation: recordedOwnerDecision.publicationRecommendation,
      grantsApproval: recordedOwnerDecision.grantsApproval,
      publicationAuthorized: recordedOwnerDecision.publicationAuthorized,
    }, {
      clinicalAccuracy: 'acceptable-for-v1',
      evidenceSufficiency: 'acceptable-for-v1',
      clinicalCompleteness: 'future-expansion-non-blocking',
      publicationRecommendation: 'recommend-publish',
      grantsApproval: false,
      publicationAuthorized: false,
    })
    const canonicalClaim = v1Condition.currentContent.v1PublicationReview.clinicalEvidenceAudit.canonicalClaims[0]
    const invalidClaimReview = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-claim-review', targetType: 'canonical-claim', targetId: canonicalClaim.id, exactRevisionKey: canonicalClaim.revisionHash, evidenceRelationshipDecision: 'approved', clinicalWordingDecision: 'accept-as-written', reviewDeclaration: true }) })
    assert.equal(invalidClaimReview.status, 400)
    const staleClaimReview = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-claim-review', targetType: 'canonical-claim', targetId: canonicalClaim.id, exactRevisionKey: 'sha256:stale', evidenceRelationshipDecision: 'partial-support', clinicalWordingDecision: 'soften-wording', reviewDeclaration: true }) })
    assert.equal(staleClaimReview.status, 409)
    const claimReview = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'record-v1-claim-review', targetType: 'canonical-claim', targetId: canonicalClaim.id, exactRevisionKey: canonicalClaim.revisionHash, evidenceRelationshipDecision: 'partial-support', clinicalWordingDecision: 'soften-wording', note: 'Synthetic canonical claim recommendation', reviewDeclaration: true }) })
    assert.equal(claimReview.status, 201)
    const claimReviewBody = await claimReview.json()
    assert.equal(claimReviewBody.humanEvidenceReviewComplete, true)
    assert.equal(claimReviewBody.grantsApproval, false)
    assert.equal(claimReviewBody.publicationAuthorized, false)
    const missingDeclaration = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'mark-review-complete', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: contentItem.revisionHash, note: 'Synthetic completed review' }) })
    assert.equal(missingDeclaration.status, 400)
    const completion = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'mark-review-complete', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: contentItem.revisionHash, note: 'Synthetic completed review', reviewDeclaration: true }) })
    assert.equal(completion.status, 201)
    const completionBody = await completion.json()
    assert.equal(completionBody.grantsApproval, false)
    assert.equal(completionBody.status, 'review-completed-proposal-created')
    assert.equal(completionBody.integrationProposal.targetId, contentItem.id)
    assert.equal(completionBody.integrationProposal.exactRevisionKey, contentItem.revisionHash)
    assert.equal(completionBody.integrationProposal.controls.grantsApproval, false)
    assert.equal(completionBody.integrationProposal.controls.publicationAuthorized, false)
    assert.equal(completionBody.integrationProposal.controls.repositoryModified, false)
    assert.equal(completionBody.integrationProposal.controls.clinicalContentCopied, false)
    assert.equal(completionBody.integrationProposal.currentContent, undefined)
    assert.equal(completionBody.integrationProposal.relativePath, undefined)
    const duplicateCompletion = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'mark-review-complete', targetType: 'content-item', targetId: contentItem.id, exactRevisionKey: contentItem.revisionHash, note: 'Duplicate synthetic review', reviewDeclaration: true }) })
    assert.equal(duplicateCompletion.status, 409)
    const proposalRecord = serverStore.read().integrationProposals.find((proposal) => proposal.id === completionBody.integrationProposal.id)
    assert.ok(proposalRecord)
    assert.ok(fs.existsSync(resolveInside(serverStore.root, proposalRecord.relativePath)))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(resolveInside(serverStore.root, proposalRecord.relativePath))).digest('hex'), proposalRecord.sha256)
    const proposalDownload = await request(completionBody.integrationProposal.downloadUrl, { headers: { Cookie: cookie } })
    assert.equal(proposalDownload.status, 200)
    const proposalDocument = await proposalDownload.json()
    assert.equal(proposalDocument.targetId, contentItem.id)
    assert.equal(proposalDocument.exactRevisionKey, contentItem.revisionHash)
    assert.equal(proposalDocument.controls.publicationAuthorized, false)
    assert.equal(proposalDocument.currentContent, undefined)
    const refreshedDetail = await request(`/api/content/${encodeURIComponent(contentItem.id)}`, { headers: { Cookie: cookie } })
    const refreshedItem = await refreshedDetail.json()
    assert.ok(refreshedItem.privateReviewActions.some((entry) => entry.type === 'mark-review-complete' && entry.grantsApproval === false))
    assert.ok(refreshedItem.integrationProposals.some((entry) => entry.id === completionBody.integrationProposal.id && entry.relativePath === undefined))
    const refreshedDashboard = await request('/api/dashboard', { headers: { Cookie: cookie } })
    const refreshedDashboardBody = await refreshedDashboard.json()
    assert.equal(refreshedDashboardBody.studio.summary.integrationProposals, 1)
    assert.equal(refreshedDashboardBody.studio.integrationProposals[0].relativePath, undefined)
    const missingIntegrationDeclaration = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'submit-integration-proposal', targetType: 'integration-proposal', targetId: completionBody.integrationProposal.id, exactRevisionKey: contentItem.revisionHash, note: 'Synthetic integration request' }) })
    assert.equal(missingIntegrationDeclaration.status, 400)
    const submission = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'submit-integration-proposal', targetType: 'integration-proposal', targetId: completionBody.integrationProposal.id, exactRevisionKey: contentItem.revisionHash, note: 'Synthetic integration request', reviewDeclaration: true }) })
    assert.equal(submission.status, 201)
    const submissionBody = await submission.json()
    assert.equal(submissionBody.grantsApproval, false)
    assert.equal(submissionBody.queueEntry.operation, 'review-adoption-only')
    assert.equal(submissionBody.queueEntry.controls.directMainPush, false)
    assert.equal(submissionBody.queueEntry.controls.autoMerge, false)
    assert.equal(submissionBody.queueEntry.controls.publicationStateChangesAllowed, false)
    assert.equal(submissionBody.queueEntry.controls.resourceImportAllowed, false)
    const duplicateSubmission = await request('/api/actions', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'submit-integration-proposal', targetType: 'integration-proposal', targetId: completionBody.integrationProposal.id, exactRevisionKey: contentItem.revisionHash, note: 'Duplicate integration request', reviewDeclaration: true }) })
    assert.equal(duplicateSubmission.status, 409)
    const integrationRegistry = loadContentRegistry({ repositoryRoot, store: serverStore })
    const integrationPolicy = loadIntegrationPolicy()
    const validatedIntegration = validateQueuedIntegration({ store: serverStore, registry: integrationRegistry, queueId: submissionBody.queueEntry.id, policy: integrationPolicy })
    const integrationManifest = buildReviewAdoptionManifest({ ...validatedIntegration })
    assert.deepEqual(integrationManifest.candidateChanges, [`reports/content-integration/proposals/${completionBody.integrationProposal.id}.json`])
    assert.equal(integrationManifest.controls.directMainPush, false)
    assert.equal(integrationManifest.controls.autoMerge, false)
    assert.equal(integrationManifest.controls.resourceImportAllowed, false)
    assert.equal(integrationManifest.reviewNote, undefined)
    assert.equal(integrationManifest.actorId, undefined)
    const integrationPacket = prepareIntegrationPacket({ store: serverStore, ...validatedIntegration, manifest: integrationManifest })
    const integrationPlan = buildFeatureBranchPlan({ repositoryRoot, store: serverStore, packet: integrationPacket, policy: integrationPolicy })
    assert.ok(integrationPlan.branch.startsWith('content-review/'))
    assert.equal(integrationPlan.controls.directMainPush, false)
    assert.equal(integrationPlan.controls.autoMerge, false)
    assert.ok(integrationPlan.commands.some(([command, args]) => command === 'git' && args[0] === 'push' && args[2] === `${integrationPlan.branch}:${integrationPlan.branch}`))
    assert.ok(integrationPlan.commands.some(([command, args]) => command === 'gh' && args[0] === 'pr' && args[1] === 'create' && args.includes('--base') && args.includes('main')))
    assert.ok(!integrationPlan.commands.some(([, args]) => args.includes('merge') || args.includes('main:main') || args.includes('--force')))
    const queuedDashboard = await request('/api/dashboard', { headers: { Cookie: cookie } })
    const queuedDashboardBody = await queuedDashboard.json()
    assert.equal(queuedDashboardBody.studio.summary.queuedForIntegration, 1)
    assert.equal(queuedDashboardBody.studio.integrationQueue[0].proposalId, completionBody.integrationProposal.id)
    const materialResponse = await request('/api/extra-materials', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': loginBody.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Synthetic teaching reference', materialType: 'teaching-notes', region: 'non-region-specific', documentId: uploaded.id, notes: 'Private metadata only' }) })
    assert.equal(materialResponse.status, 201)
    const material = await materialResponse.json()
    assert.equal(material.publicationState, 'private')
    assert.equal(material.grantsApproval, false)
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
  const portalApp = fs.readFileSync(path.join(repositoryRoot, 'ai-manager', 'private-review-portal', 'static', 'app.js'), 'utf8')
  assert.match(portalHtml, /capture="environment"/)
  assert.match(portalHtml, /MSK Content Review Studio/)
  assert.match(portalHtml, /v1-condition-summary-table/)
  assert.match(portalHtml, /Condition recommendations and owner decisions/)
  assert.match(portalApp, /Publication-minimum evidence/)
  assert.match(portalApp, /alternative evidence needed/)
  for (const clinicianFirstLabel of ['Independent reviewer recommendation', 'Clinical accuracy', 'Evidence sufficiency', 'Clinical completeness', 'Publication recommendation', 'Owner decision', 'Technical \/ audit details']) assert.match(portalApp, new RegExp(clinicianFirstLabel))
  for (const readableStatus of ['✓ Accept V1', '⚠ Changes required', '⛔ Blocked', '↗ Future expansion', '✓ Recommend publish', '⏸ Recommend hold']) assert.match(portalApp, new RegExp(readableStatus))
  assert.doesNotMatch(portalApp, /I reviewed exact condition revision \$\{/)
  for (const actionType of ['add-note', 'create-human-review-task', 'mark-review-complete', 'submit-integration-proposal', 'record-v1-publication-review', 'record-v1-claim-review', 'record-v1-final-condition-confirmation']) assert.match(portalApp, new RegExp(`['"]${actionType}['"]`))
  for (const prohibitedAction of ['accept-proposal', 'reject-proposal', 'defer-proposal', 'mark-superseded', 'archive', 'approve-content', 'publish-content', 'change-publication-state']) assert.doesNotMatch(portalApp, new RegExp(`['"]${prohibitedAction}['"]`))
  assert.doesNotMatch(portalApp, /mock-region/)
  assert.doesNotMatch(portalApp, /candidate-movement\.synthetic|region\s*===\s*['"](?:shoulder|hip)['"]/)
  assert.deepEqual(Object.fromEntries(loadContentRegistry({ repositoryRoot, store }).items.filter((item) => publicationSnapshot[item.id] !== undefined).map((item) => [item.id, item.publicationState])), publicationSnapshot)
  assert.deepEqual(sourceHashes(), originalSourceHashes)
  for (const script of ['tailscale-serve-start.ps1', 'tailscale-serve-stop.ps1', 'tailscale-serve-reset.ps1']) {
    const content = fs.readFileSync(path.join(repositoryRoot, 'scripts', 'private-review-portal', script), 'utf8')
    assert.ok(!/\bfunnel\s+(?:on|reset|--bg|--https)/i.test(content), `${script} must never configure Funnel`)
  }
  console.log(`Private portal tests passed: ${fixtures.size} allowed synthetic types, security/session controls, quarantine, duplicates, immutable originals, safe preview/download, mobile upload, and zero automatic approvals.`)
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
