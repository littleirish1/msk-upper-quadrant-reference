import assert from 'node:assert/strict'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, loadProgrammeSchemas } from './shared.mjs'
import path from 'node:path'

const schemas = await loadProgrammeSchemas()
const governance = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'programmes', 'reviewGovernance.ts'),
  path.join(ROOT, 'src'),
)
let assertions = 0
const review = schemas.exactRevisionReviewSchema.parse({
  schemaVersion: 1,
  reviewId: 'review.condition.shoulder.example',
  targetId: 'condition.shoulder.example',
  targetRevision: 'revision-1',
  targetChecksum: `sha256:${'1'.repeat(64)}`,
  domain: 'management',
  reviewerRole: 'clinician',
  reviewerId: 'reviewer-opaque-1',
  reviewDate: '2026-07-31',
  decision: 'approve',
  limitations: ['Applies only to this revision.'],
  nextReviewDate: '2027-07-31',
  stale: false,
})
const target = { id: review.targetId, revision: review.targetRevision, checksum: review.targetChecksum }
assert.equal(governance.reviewAppliesToTarget(review, target), true); assertions++
assert.equal(governance.reviewAppliesToTarget(review, { ...target, revision: 'revision-2' }), false); assertions++
const invalidated = governance.invalidateReviewForChangedTarget(review, { ...target, checksum: `sha256:${'2'.repeat(64)}` })
assert.equal(invalidated.stale, true); assertions++
assert.equal(invalidated.decision, 'pending'); assertions++
assert.equal(review.decision, 'approve'); assertions++

const beta = {
  schemaVersion: 1,
  status: 'planned',
  participantGroups: ['physiotherapy-student', 'band-5-clinician', 'experienced-msk-clinician', 'clinical-educator'],
  resultsRecorded: false,
  feedbackItems: [],
  consentReviewRequired: true,
  privacyReviewRequired: true,
  publicationApprovalGranted: false,
}
assert.equal(schemas.betaFrameworkSchema.safeParse(beta).success, true); assertions++
assert.equal(schemas.betaFrameworkSchema.safeParse({ ...beta, resultsRecorded: true }).success, false); assertions++
console.log(`Release governance tests passed. Assertions: ${assertions}.`)
