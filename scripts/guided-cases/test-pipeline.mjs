import assert from 'node:assert/strict'
import { canonicalText, sha256 } from './shared.mjs'
import { validateRecordSet } from './validator-lib.mjs'

const base = {
  caseId: 'case.test.case-01',
  learnerCaseNumber: 'Case 01',
  neutralTitle: 'Neutral presentation',
  region: 'shoulder',
  publicSlug: 'case-01-neutral-presentation',
  contentRevision: 1,
  contentHash: 'a'.repeat(64),
  lifecycleState: 'published',
  publicationEligibility: true,
  privateDiagnosticIdentity: { associatedConditionId: 'private-condition' },
  governance: { publicationDecision: { status: 'approved' } },
  evidenceHub: {
    pinnedCaseRevision: 1,
    pinnedCaseHash: 'a'.repeat(64),
    conditionRecordId: null,
    evidenceRecordIds: [],
    relationshipIds: [],
    reviewDecisionId: null,
  },
}

assert.deepEqual(validateRecordSet([base], { expectedPublic: 1, expectedDraft: 0 }).findings, [])
assert.match(validateRecordSet([base, structuredClone(base)]).findings.join('\n'), /duplicate case ID/)
const diagnosticSlug = structuredClone(base)
diagnosticSlug.publicSlug = 'private-condition'
assert.match(validateRecordSet([diagnosticSlug]).findings.join('\n'), /associated condition ID/)
const draft = structuredClone(base)
draft.caseId = 'case.test.pilot-01'
draft.learnerCaseNumber = 'Pilot 01'
draft.lifecycleState = 'draft'
draft.publicationEligibility = false
draft.governance.publicationDecision.status = 'blocked'
assert.deepEqual(validateRecordSet([draft], { expectedPublic: 0, expectedDraft: 1 }).findings, [])
const stale = structuredClone(base)
stale.evidenceHub.pinnedCaseHash = 'b'.repeat(64)
assert.match(validateRecordSet([stale]).findings.join('\n'), /pin is stale/)
const inventedLink = structuredClone(base)
inventedLink.evidenceHub.conditionRecordId = 'condition.fake'
assert.match(validateRecordSet([inventedLink]).findings.join('\n'), /zero-record baseline/)
assert.equal(
  sha256(canonicalText('first\r\nsecond\r\n')),
  sha256(canonicalText('first\nsecond\n')),
)

console.log('Guided-case pipeline regression tests passed. Assertions: 7.')
