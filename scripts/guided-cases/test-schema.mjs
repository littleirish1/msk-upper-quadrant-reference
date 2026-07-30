import assert from 'node:assert/strict'
import {
  canonicalCaseHash,
  loadGuidedCaseModule,
} from './shared.mjs'

const module = await loadGuidedCaseModule()
let assertions = 0

const minimum = makeRecord()
minimum.contentHash = canonicalCaseHash(minimum)
minimum.evidenceHub.pinnedCaseHash = minimum.contentHash
minimum.governance.publicationDecision.approvedContentHash = minimum.contentHash

assert.equal(module.guidedCaseRecordSchema.safeParse(minimum).success, true)
assertions += 1
assert.deepEqual(
  module.createPublicImmediateCase(minimum),
  module.createPublicImmediateCase(structuredClone(minimum)),
)
assertions += 1
assert.equal(module.createPublicRevealPayload(minimum).likelyDiagnosis, 'Restricted diagnosis')
assertions += 1

const unknown = { ...minimum, futureField: 'unclassified' }
assert.equal(module.guidedCaseRecordSchema.safeParse(unknown).success, false)
assertions += 1

for (const mutation of [
  (record) => { record.schemaVersion = 99 },
  (record) => { record.governance.clinicalReviewStatus = 'clinician-review-required' },
  (record) => { record.governance.publicationDecision.approvedRevision = 2 },
  (record) => { record.reasoningStages.push({ ...record.reasoningStages[0] }) },
  (record) => { record.reasoningStages.push({ ...record.reasoningStages[0], id: 'other', order: 1 }) },
]) {
  const invalid = structuredClone(minimum)
  mutation(invalid)
  assert.equal(module.guidedCaseRecordSchema.safeParse(invalid).success, false)
  assertions += 1
}

const draft = makeRecord()
draft.lifecycleState = 'draft'
draft.publicationEligibility = false
draft.governance.clinicalReviewStatus = 'clinician-review-required'
draft.governance.evidenceReviewStatus = 'evidence-review-required'
draft.governance.sourceClearanceStatus = 'source-clearance-required'
draft.governance.publicationDecision = {
  status: 'blocked',
  approvedRevision: null,
  approvedContentHash: null,
  rationale: 'Human review is required.',
}
draft.governance.unresolvedIssues = ['Clinical review is incomplete.']
draft.contentHash = canonicalCaseHash(draft)
draft.evidenceHub.pinnedCaseHash = draft.contentHash
assert.equal(module.guidedCaseRecordSchema.safeParse(draft).success, true)
assert.throws(() => module.createPublicImmediateCase(draft), /not publication eligible/)
assert.throws(() => module.createPublicRevealPayload(draft), /not publication eligible/)
assertions += 3

const input = structuredClone(minimum)
const before = JSON.stringify(input)
module.createInternalCaseReviewModel(input)
assert.equal(JSON.stringify(input), before)
assertions += 1

const reveal = module.createPublicRevealPayload(minimum)
assert.equal('privateLearningFocus' in reveal, false)
assert.equal('evidenceHub' in reveal, false)
assert.equal('governance' in reveal, false)
assertions += 3

console.log(`Guided-case schema tests passed. Assertions: ${assertions}.`)

function makeRecord() {
  return {
    schemaVersion: 2,
    caseId: 'case.shoulder.case-01',
    learnerCaseNumber: 'Case 01',
    neutralTitle: 'Neutral shoulder presentation',
    region: 'shoulder',
    publicSlug: 'case-01-neutral-shoulder-presentation',
    contentRevision: 1,
    contentHash: '0'.repeat(64),
    lifecycleState: 'published',
    publicationEligibility: true,
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    privateDiagnosticIdentity: {
      internalTitle: 'Internal title',
      likelyDiagnosis: 'Restricted diagnosis',
      associatedConditionId: 'condition-slug',
      evidenceHubConditionId: null,
      privateLearningFocus: ['Restricted focus'],
      internalSourceStationId: null,
    },
    learnerPresentation: {
      initialPresentation: 'A neutral presentation.',
      aggravatingFactors: [],
      easingFactors: [],
      stagedDisclosure: [],
    },
    reasoningStages: [{
      id: 'initial-hypothesis',
      type: 'initial-hypothesis',
      order: 1,
      learnerQuestion: 'What is your initial hypothesis?',
      expectedReasoningThemes: ['Compare the available features.'],
      modelReasoningChecklist: ['Use the supplied case findings.'],
      commonPitfalls: [],
      revealState: 'public-after-reveal',
      humanReviewRequired: false,
    }],
    governance: {
      authoringStatus: 'approved',
      clinicalReviewStatus: 'baseline-reviewed',
      evidenceReviewStatus: 'baseline-preserved',
      sourceClearanceStatus: 'baseline-public-content',
      reviewerRole: 'reviewed baseline',
      reviewDate: '2026-07-29',
      nextReviewDate: null,
      unresolvedIssues: [],
      knownLimitations: ['Schema validation is not clinical approval.'],
      publicationDecision: {
        status: 'baseline-carried-forward',
        approvedRevision: 1,
        approvedContentHash: '0'.repeat(64),
        rationale: 'Unchanged reviewed baseline migration.',
      },
    },
    provenance: {
      sourceRecordIds: [],
      legacySourceId: null,
      sourceType: 'existing-public-mdx',
      extractionDate: null,
      sourceRevisionOrHash: null,
      citationReferenceIds: [],
      transformationHistory: [{
        action: 'schema-migration',
        detail: 'Mapped without changing clinical meaning.',
        reviewRequired: false,
      }],
      aiAssisted: false,
      humanEdited: true,
    },
    evidenceHub: {
      conditionRecordId: null,
      evidenceRecordIds: [],
      relationshipIds: [],
      reviewDecisionId: null,
      pinnedCaseRevision: 1,
      pinnedCaseHash: '0'.repeat(64),
      unresolvedEvidenceGaps: ['No approved Evidence Hub relationship exists.'],
    },
  }
}
