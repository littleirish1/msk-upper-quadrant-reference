import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveState, exactRevisionKey } from './review-governance.mjs'
import { canonicalBytes } from './canonical-hash.mjs'

const root = process.cwd()
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'ai-manager', 'clinical-platform', 'reviews', 'review-ledger.json'), 'utf8'))
const queues = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'clinical-platform', 'review-queues.json'), 'utf8'))
const packets = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'clinical-platform', 'review-packet-index.json'), 'utf8'))
const requiredTypes = ['module', 'truth-record', 'rule', 'tutor-transcript', 'mcq', 'movement', 'anatomy-3d', 'evidence', 'visual-asset']

assert.equal(ledger.policy, 'exact-revision-fail-closed')
assert.ok(ledger.reviews.length > 0)
for (const type of requiredTypes) assert.ok(ledger.reviews.some((review) => review.target.entityType === type), `missing ${type}`)
for (const review of ledger.reviews) {
  assert.match(review.target.contentHash, /^[a-f0-9]{64}$/)
  assert.equal(review.target.exactRevisionKey, exactRevisionKey(review.target.entityType, review.target.entityId, review.target.revision, review.target.contentHash))
  assert.equal(review.eligibleForPublication, false)
  assert.ok(review.decisions.every((decision) => decision.state === 'pending' && decision.reviewerId === null && decision.approvedExactRevisionKey === null))
}
assert.equal(queues.total, ledger.reviews.reduce((total, review) => total + review.decisions.length, 0))
assert.equal(new Set(queues.queue.map((item) => item.queueId)).size, queues.total)
assert.ok(packets.packets.every((packet) => packet.reviewerAssignment === null && packet.status === 'awaiting-human-review'))
const helperFile = fileURLToPath(new URL('./canonical-hash.mjs', import.meta.url))
assert.deepEqual(canonicalBytes(helperFile), Buffer.from(fs.readFileSync(helperFile, 'utf8').replace(/\r\n/g, '\n'), 'utf8'))

const target = ledger.reviews[0].target
const previouslyApproved = deriveState({
  target: { ...target, contentHash: 'f'.repeat(64), exactRevisionKey: exactRevisionKey(target.entityType, target.entityId, target.revision + 1, 'f'.repeat(64)) },
  decisions: [{ reviewKind: 'clinical', state: 'approved', reviewerId: 'synthetic-reviewer', decidedAt: '2026-01-01T00:00:00.000Z', approvedExactRevisionKey: target.exactRevisionKey, notes: [] }],
  eligibleForPublication: true,
  blockers: [],
})
assert.equal(previouslyApproved.decisions[0].state, 'stale')
assert.equal(previouslyApproved.eligibleForPublication, false)

console.log(`Review governance tests passed: ${ledger.reviews.length} exact targets, ${queues.total} derived queue entries, stale approval fails closed.`)
