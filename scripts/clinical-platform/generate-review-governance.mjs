import fs from 'node:fs'
import path from 'node:path'
import { deriveState, exactRevisionKey, hashValue } from './review-governance.mjs'
import { canonicalBytes } from './canonical-hash.mjs'

const ROOT = process.cwd()
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'workspace', 'snapshot.json'), 'utf8'))

const definitions = [
  { group: 'modules', entityType: 'module', reviews: ['clinical', 'evidence', 'publication'] },
  { group: 'truthRecords', entityType: 'truth-record', reviews: ['clinical', 'source', 'publication'] },
  { group: 'rules', entityType: 'rule', reviews: ['clinical', 'safety', 'evidence', 'publication'] },
  { group: 'transcripts', entityType: 'tutor-transcript', reviews: ['clinical', 'conversation', 'tutor', 'safety', 'publication'] },
  { group: 'mcqs', entityType: 'mcq', reviews: ['clinical', 'evidence', 'accessibility', 'publication'] },
  { group: 'movement', entityType: 'movement', reviews: ['movement', 'anatomy', 'clinical', 'evidence', 'accessibility', 'publication'] },
  { group: 'anatomy3d', entityType: 'anatomy-3d', reviews: ['anatomy', 'clinical', 'licensing', 'accessibility', 'publication'] },
  { group: 'evidence', entityType: 'evidence', reviews: ['source', 'evidence', 'publication'] },
  { group: 'shoulderSources', entityType: 'evidence', reviews: ['source', 'evidence', 'publication'] },
  { group: 'shoulderModules', entityType: 'module', reviews: ['clinical', 'evidence', 'publication'] },
  { group: 'shoulderRules', entityType: 'rule', reviews: ['clinical', 'safety', 'evidence', 'publication'] },
  { group: 'shoulderMovement', entityType: 'movement', reviews: ['movement', 'anatomy', 'clinical', 'evidence', 'accessibility', 'publication'] },
  { group: 'shoulderMcqs', entityType: 'mcq', reviews: ['clinical', 'evidence', 'accessibility', 'publication'] },
]

const records = definitions.flatMap(({ group, entityType, reviews }) => (snapshot.groups[group] ?? []).map((item) => ({ item, entityType, reviews })))
const visualFiles = ['src/app/page.tsx', 'src/app/cases/page.tsx', 'src/app/anatomy/page.tsx', 'src/components/layout/Header.tsx', 'src/app/globals.css']
const visualDigest = hashValue(visualFiles.map((file) => ({ file, sha256: hashValue(canonicalBytes(path.join(ROOT, file)).toString('base64')) })))
records.push({
  entityType: 'visual-asset',
  reviews: ['accessibility', 'clinical', 'publication'],
  item: { id: 'visual-system.learner-v1', revision: 1, publication: 'candidate', hash: visualDigest },
})

const reviewRecords = records.map(({ item, entityType, reviews }) => {
  const contentHash = item.hash && /^[a-f0-9]{64}$/.test(item.hash) ? item.hash : hashValue(item)
  const target = {
    entityType,
    entityId: item.id,
    revision: item.revision,
    contentHash,
    exactRevisionKey: exactRevisionKey(entityType, item.id, item.revision, contentHash),
    publicationState: item.publication,
  }
  return deriveState({
    target,
    decisions: reviews.map((reviewKind) => ({ reviewKind, state: 'pending', reviewerId: null, decidedAt: null, approvedExactRevisionKey: null, notes: [] })),
    eligibleForPublication: false,
    blockers: [],
  })
}).sort((a, b) => a.target.exactRevisionKey.localeCompare(b.target.exactRevisionKey))

const ledger = { schemaVersion: 1, policy: 'exact-revision-fail-closed', generatedAt: null, reviews: reviewRecords }
const queue = reviewRecords.flatMap((review) => review.decisions.filter((decision) => decision.state !== 'approved').map((decision) => ({
  queueId: `${decision.reviewKind}:${review.target.exactRevisionKey}`,
  reviewKind: decision.reviewKind,
  state: decision.state,
  target: review.target,
}))).sort((a, b) => a.queueId.localeCompare(b.queueId))
const reviewKinds = [...new Set(queue.map((item) => item.reviewKind))].sort()
const packetIndex = {
  schemaVersion: 1,
  packetPolicy: 'focused-exact-revision-targets-only',
  packets: reviewKinds.map((reviewKind) => ({
    packetId: `review-packet.${reviewKind}.v1`,
    reviewKind,
    targetCount: queue.filter((item) => item.reviewKind === reviewKind).length,
    targets: queue.filter((item) => item.reviewKind === reviewKind).map((item) => item.target.exactRevisionKey),
    reviewerAssignment: null,
    status: 'awaiting-human-review',
  })),
}

function write(relativePath, value) {
  const destination = path.join(ROOT, relativePath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`)
}

write('ai-manager/clinical-platform/reviews/review-ledger.json', ledger)
write('reports/clinical-platform/review-queues.json', { schemaVersion: 1, source: 'review-ledger', total: queue.length, queue })
write('reports/clinical-platform/review-packet-index.json', packetIndex)

console.log(`Exact-revision review governance generated: ${reviewRecords.length} targets, ${queue.length} pending decisions, ${packetIndex.packets.length} focused packets.`)
