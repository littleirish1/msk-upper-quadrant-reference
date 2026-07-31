import assert from 'node:assert/strict'
import { loadProgrammeSchemas } from './shared.mjs'

const schemas = await loadProgrammeSchemas()
let assertions = 0
const gap = {
  schemaVersion: 1,
  gapId: 'gap.condition.shoulder.example',
  contentId: 'condition.shoulder.example',
  contentRevision: 'revision-1',
  gapTypes: ['missing-evidence-record'],
  lifecycleState: 'active',
  reviewState: 'recorded',
  publicEligibility: false,
  blockers: ['Evidence record is absent.'],
  nextAction: 'Human evidence review is required.',
}
assert.equal(schemas.evidenceGapSchema.safeParse(gap).success, true); assertions++
assert.equal(schemas.evidenceGapSchema.safeParse({ ...gap, publicEligibility: true }).success, false); assertions++

const proposal = {
  schemaVersion: 1,
  proposalId: 'proposal.gap.condition.shoulder.example',
  proposalType: 'evidence-gap-follow-up',
  targetContentIds: ['condition.shoulder.example'],
  sourceRecordIds: [],
  previousVersionIds: [],
  proposedVersionIds: [],
  lifecycleState: 'draft',
  reviewState: 'required',
  publicEligibility: false,
  networkLookupCompleted: false,
  autonomousChangeAllowed: false,
  unresolvedQuestions: ['Which reviewed source supports this revision?'],
}
assert.equal(schemas.evidenceSurveillanceProposalSchema.safeParse(proposal).success, true); assertions++
assert.equal(schemas.evidenceSurveillanceProposalSchema.safeParse({ ...proposal, publicEligibility: true }).success, false); assertions++
assert.equal(schemas.evidenceSurveillanceProposalSchema.safeParse({ ...proposal, autonomousChangeAllowed: true }).success, false); assertions++
assert.equal(schemas.evidenceSurveillanceProposalSchema.safeParse({ ...proposal, networkLookupCompleted: true }).success, false); assertions++

console.log(`Evidence foundation tests passed. Assertions: ${assertions}.`)
