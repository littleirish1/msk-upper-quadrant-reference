import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { HUB_LIB_DIR, buildJsonSchemaDocument, containsEvidenceHubImport, loadEvidenceHubModule } from './shared.mjs'

const hub = await loadEvidenceHubModule()
let passed = 0
const failures = []

const checksum = `sha256:${'0'.repeat(64)}`
const provenance = {
  sourceId: 'source.fixture.one',
  checksum,
  locator: 'section 1',
  locationCategory: 'repository-reviewed-source',
  eligibilityStatus: 'cleared-for-private-evidence-processing',
  clearanceScope: ['private-proposal-support'],
}
const base = (id, entityType) => ({
  schemaVersion: 1,
  id,
  entityType,
  revision: 1,
  lifecycleStatus: 'draft',
  reviewStatus: 'unreviewed',
  publicEligibility: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  provenance: [provenance],
  supersedesRevision: null,
  changeSummary: 'Non-clinical validation fixture.',
})
const related = { title: 'Fixture', slug: 'fixture', claimIds: ['claim.fixture.statement'], relatedContentIds: [], mediaAssetIds: [] }

const reference = {
  ...base('reference.fixture.work', 'reference'),
  citationAsPresented: 'Fictional fixture citation.',
  referenceType: 'fixture',
  verificationStatus: 'candidate',
  sourceProvenance: [provenance],
  authors: [],
}
const evidence = {
  ...base('evidence.fixture.appraisal', 'evidence'),
  title: 'Fixture evidence',
  evidenceType: 'other',
  referenceIds: [reference.id],
  sourceLocators: [provenance],
  verificationStatus: 'extracted-unverified',
  appraisalStatus: 'not-appraised',
  applicability: '',
  limitations: [],
}
const claim = {
  ...base('claim.fixture.statement', 'claim'),
  statement: 'Structural fixture statement.',
  claimType: 'educational',
  scope: { regions: [], qualifiers: [] },
  support: [{ evidenceId: evidence.id, evidenceRevision: 1, role: 'supports', locator: 'section 1', applicability: 'fixture only' }],
  strength: 'pending',
  limitations: [],
  clinicalReviewRequired: true,
  diagnosisBearing: false,
}
const condition = {
  ...base('condition.fixture.topic', 'condition'), ...related,
  region: 'shoulder',
  sectionClaims: { overview: [claim.id] },
  reviewSummary: { reviewedRevision: null, reviewDue: null },
}
const anatomy = {
  ...base('anatomy.muscle.fixture', 'anatomy'), ...related,
  category: 'muscle', regions: ['shoulder'], anatomyRelationshipIds: [],
}
const exercise = {
  ...base('exercise.fixture.activity', 'exercise'), ...related,
  regions: ['shoulder'], purposeClaimIds: [claim.id], instructionClaimIds: [claim.id], safetyClaimIds: [claim.id], dosageStatus: 'not-specified',
}
const clinicalTest = {
  ...base('test.fixture.procedure', 'clinical-test'), ...related,
  regions: ['shoulder'], testKind: 'single-test', purposeClaimIds: [claim.id], techniqueClaimIds: [claim.id], interpretationClaimIds: [claim.id], limitationClaimIds: [claim.id],
}
const outcome = {
  ...base('outcome.fixture.measure', 'outcome-measure'), ...related,
  licenceStatus: 'unknown', constructClaimIds: [claim.id], populationClaimIds: [claim.id], scoringClaimIds: [claim.id],
}
const guidedCase = {
  ...base('case.shoulder.fixture-01', 'guided-case'),
  internalTitle: 'Internal fixture', neutralTitle: 'Neutral fixture', neutralPublicSlug: 'fixture-01', region: 'shoulder', linkedConditionId: condition.id,
  stages: [
    { id: 'presentation', type: 'presentation', prompt: 'Fixture prompt', claimIds: [], revealPolicy: 'initial' },
    { id: 'diagnosis', type: 'expert-comparison', prompt: 'Fixture reveal', claimIds: [claim.id], revealPolicy: 'diagnosis-reveal' },
  ],
  diagnosisRevealStageId: 'diagnosis',
}
const media = {
  ...base('media.diagram.fixture', 'media-asset'),
  title: 'Fixture media', assetType: 'diagram', checksum, storageClass: 'tracked-metadata', sourceProvenance: [provenance],
  rightsStatus: 'unknown', attribution: '', accessibilityStatus: 'not-reviewed',
}
const records = [reference, evidence, claim, condition, anatomy, exercise, clinicalTest, outcome, guidedCase, media]
const relationships = [
  relationship('relationship.fixture.evidence-claim', evidence.id, claim.id, 'supports', { evidenceLocator: 'section 1' }),
  relationship('relationship.fixture.condition-claim', condition.id, claim.id, 'uses'),
  relationship('relationship.fixture.case-condition', guidedCase.id, condition.id, 'references', { revealStageId: 'diagnosis' }),
  relationship('relationship.fixture.evidence-reference', evidence.id, reference.id, 'references'),
]
const dataset = { records, relationships, reviewDecisions: [], proposals: [] }

run('all ten entity schemas accept governed draft fixtures', () => {
  for (const record of records) assert.equal(hub.evidenceHubRecordSchema.safeParse(record).success, true, record.entityType)
  assert.equal(new Set(records.map((record) => record.entityType)).size, 10)
})
run('missing lifecycle state fails closed', () => {
  const { lifecycleStatus, ...invalid } = evidence
  void lifecycleStatus
  assert.equal(hub.evidenceSchema.safeParse(invalid).success, false)
})
run('public eligibility cannot be attached to draft data', () => {
  assert.equal(hub.evidenceSchema.safeParse({ ...evidence, publicEligibility: true }).success, false)
})
run('complete relationship graph validates', () => {
  const result = hub.validateEvidenceHubGraph(dataset)
  assert.equal(result.valid, true, result.findings.map((item) => item.message).join('; '))
})
run('duplicate entity IDs fail', () => {
  assert.equal(hub.validateEvidenceHubGraph({ ...dataset, records: [...records, reference] }).findings.some((item) => item.code === 'duplicate-record-id'), true)
})
run('dangling and stale relationships fail', () => {
  const missing = relationship('relationship.fixture.missing', condition.id, 'claim.fixture.missing', 'uses')
  const stale = { ...relationships[0], id: 'relationship.fixture.stale', fromRevision: 2 }
  const findings = hub.validateEvidenceHubGraph({ ...dataset, relationships: [...relationships, missing, stale] }).findings
  assert.equal(findings.some((item) => item.code === 'missing-to-record'), true)
  assert.equal(findings.some((item) => item.code === 'stale-from-revision'), true)
})
run('matching condition relationship before reveal fails', () => {
  const early = { ...relationships[2], id: 'relationship.fixture.early', revealStageId: 'presentation' }
  const replaced = relationships.map((item) => item.id === relationships[2].id ? early : item)
  assert.equal(hub.validateEvidenceHubGraph({ ...dataset, relationships: replaced }).findings.some((item) => item.code === 'condition-link-before-reveal'), true)
})
run('review and lifecycle transitions are explicit', () => {
  assert.equal(hub.canTransitionReview('unreviewed', 'structural-review'), true)
  assert.equal(hub.canTransitionReview('unreviewed', 'approved'), false)
  assert.equal(hub.canTransitionLifecycle('draft', 'active'), true)
  assert.equal(hub.canTransitionLifecycle('archived', 'active'), false)
})
run('review approval is revision and hash scoped', () => {
  const decision = {
    schemaVersion: 1,
    id: 'review.fixture.one',
    entityId: claim.id,
    entityRevision: claim.revision,
    canonicalRecordHash: hub.canonicalRecordHash(claim),
    reviewerRole: 'clinician',
    decision: 'approve',
    scope: ['clinical-meaning'],
    decisionDate: '2026-01-01',
    notes: 'Fixture approval only.',
  }
  assert.equal(hub.decisionMatchesRecord(decision, claim), true)
  assert.equal(hub.decisionMatchesRecord(decision, { ...claim, revision: 2 }), false)
})
run('publication gate rejects private dependencies and missing approval', () => {
  const markedPublic = { ...claim, lifecycleStatus: 'active', reviewStatus: 'approved', publicEligibility: true, strength: 'limited' }
  const decision = hub.evaluatePublication(markedPublic, { ...dataset, records: records.map((item) => item.id === claim.id ? markedPublic : item) })
  assert.equal(decision.eligible, false)
  assert.equal(decision.reasons.some((reason) => reason.includes('clinician approval')), true)
  assert.throws(() => hub.buildPublicProjection({ ...dataset, records: records.map((item) => item.id === claim.id ? markedPublic : item) }))
})
run('private-processing clearance alone cannot make Evidence public', () => {
  const publicCandidate = {
    ...evidence,
    lifecycleStatus: 'active',
    reviewStatus: 'approved',
    publicEligibility: true,
    verificationStatus: 'full-text-reviewed',
    appraisalStatus: 'appraised',
  }
  const result = hub.evidenceSchema.safeParse(publicCandidate)
  assert.equal(result.success, false)
  assert.equal(result.error.issues.some((issue) => issue.path[0] === 'sourceLocators' && issue.message.includes('public-evidence-use')), true)
})
run('Reference dependencies require explicit graph edges', () => {
  const withoutReferenceEdge = relationships.filter((item) => item.id !== 'relationship.fixture.evidence-reference')
  const findings = hub.validateEvidenceHubGraph({ ...dataset, relationships: withoutReferenceEdge }).findings
  assert.equal(findings.some((item) => item.code === 'evidence-reference-edge-missing'), true)
})
run('invalid relationship roles fail closed', () => {
  const invalid = relationship('relationship.fixture.invalid-role', condition.id, claim.id, 'supports', { evidenceLocator: 'section 1' })
  const findings = hub.validateEvidenceHubGraph({ ...dataset, relationships: [...relationships, invalid] }).findings
  assert.equal(findings.some((item) => item.code === 'invalid-evidence-claim-direction'), true)
})
run('supersession cycles are prohibited', () => {
  const secondReference = { ...reference, id: 'reference.fixture.second', citationAsPresented: 'Second fictional fixture citation.' }
  const forward = relationship('relationship.fixture.supersedes-forward', reference.id, secondReference.id, 'supersedes')
  const reverse = relationship('relationship.fixture.supersedes-reverse', secondReference.id, reference.id, 'supersedes')
  const findings = hub.validateEvidenceHubGraph({ ...dataset, records: [...records, secondReference], relationships: [...relationships, forward, reverse] }).findings
  assert.equal(findings.some((item) => item.code === 'supersession-cycle'), true)
})
run('review decisions with stale hashes fail graph validation', () => {
  const decision = approval('review.fixture.stale-hash', claim, 'clinician', 'clinical-meaning')
  const stale = { ...decision, canonicalRecordHash: checksum }
  const findings = hub.validateEvidenceHubGraph({ ...dataset, reviewDecisions: [stale] }).findings
  assert.equal(findings.some((item) => item.code === 'review-hash-stale'), true)
})
run('eligible publication is reference-backed and strips private fields', () => {
  const publicProvenance = {
    ...provenance,
    clearanceScope: ['private-proposal-support', 'public-evidence-use'],
  }
  const publicReference = {
    ...reference,
    lifecycleStatus: 'active',
    reviewStatus: 'approved',
    publicEligibility: true,
    provenance: [publicProvenance],
    sourceProvenance: [publicProvenance],
    verificationStatus: 'bibliographic-verified',
    verificationEvidence: 'Verified against a fictional test fixture.',
  }
  const publicEvidence = {
    ...evidence,
    lifecycleStatus: 'active',
    reviewStatus: 'approved',
    publicEligibility: true,
    provenance: [publicProvenance],
    sourceLocators: [publicProvenance],
    verificationStatus: 'full-text-reviewed',
    appraisalStatus: 'appraised',
  }
  const publicClaim = {
    ...claim,
    lifecycleStatus: 'active',
    reviewStatus: 'approved',
    publicEligibility: true,
    provenance: [publicProvenance],
    strength: 'limited',
  }
  const publicRecords = records.map((item) => {
    if (item.id === reference.id) return publicReference
    if (item.id === evidence.id) return publicEvidence
    if (item.id === claim.id) return publicClaim
    return item
  })
  const publicDataset = {
    ...dataset,
    records: publicRecords,
    reviewDecisions: [
      approval('review.fixture.evidence', publicEvidence, 'evidence-reviewer', 'evidence'),
      approval('review.fixture.claim', publicClaim, 'clinician', 'clinical-meaning'),
    ],
  }
  assert.equal(hub.evaluatePublication(publicClaim, publicDataset).eligible, true)
  const projection = hub.buildPublicProjection(publicDataset)
  const serialized = JSON.stringify(projection)
  for (const forbidden of ['sourceId', 'sourceLocators', 'sourceProvenance', 'checksum', 'locator', 'reviewStatus', 'verificationEvidence']) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})
run('AI proposal cannot claim approval or publication', () => {
  const proposal = {
    schemaVersion: 1,
    id: 'proposal.fixture.one',
    proposalType: 'claim',
    targetIds: [claim.id],
    sourceIds: ['source.fixture.one'],
    sourceChecksums: [checksum],
    proposedRecord: claim,
    confidence: 'low',
    limitations: ['Fixture only.'],
    status: 'draft',
    publicEligibility: true,
    clinicalApprovalRepresented: false,
    autonomousPublicationAllowed: false,
    reviewerDecisionId: null,
  }
  assert.equal(hub.aiProposalSchema.safeParse(proposal).success, false)
})
run('pilot placeholder is empty and ingestion-disabled', () => {
  const pilot = {
    schemaVersion: 1, pilotId: 'pilot.fixture.one', title: 'Fixture pilot', pilotStatus: 'placeholder', lifecycleStatus: 'draft',
    reviewStatus: 'unreviewed', publicEligibility: false, ingestionAllowed: false, entityIds: [], notes: 'Fixture placeholder.',
  }
  assert.equal(hub.pilotPlaceholderSchema.safeParse(pilot).success, true)
  assert.equal(hub.pilotPlaceholderSchema.safeParse({ ...pilot, entityIds: [claim.id] }).success, false)
})
run('generated JSON Schema contains every entity and workflow definition', () => {
  const document = buildJsonSchemaDocument(hub)
  for (const key of ['evidence', 'claim', 'condition', 'anatomy', 'exercise', 'clinicalTest', 'outcomeMeasure', 'guidedCase', 'reference', 'mediaAsset', 'relationship', 'reviewDecision', 'aiProposal', 'pilot']) {
    assert.ok(document.$defs[key], key)
  }
  assert.equal(fs.existsSync(path.join(HUB_LIB_DIR, 'evidence-hub-v1.schema.json')), true)
})
run('public runtime import detection is narrow and deterministic', () => {
  assert.equal(containsEvidenceHubImport("import { x } from '@/lib/evidence-hub'"), true)
  assert.equal(containsEvidenceHubImport("const hub = await import('../lib/evidence-hub/publication')"), true)
  assert.equal(containsEvidenceHubImport("import { evidence } from './ordinary-evidence'"), false)
  assert.equal(containsEvidenceHubImport("const label = 'evidence-hub'"), false)
})

if (failures.length) {
  console.error('Evidence Hub tests failed.')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}
console.log(`Evidence Hub tests passed. Deterministic assertions: ${passed}.`)

function relationship(id, fromId, toId, role, extra = {}) {
  return { schemaVersion: 1, id, fromId, toId, role, fromRevision: 1, toRevision: 1, lifecycleStatus: 'draft', reviewStatus: 'unreviewed', ...extra }
}

function approval(id, record, reviewerRole, scope) {
  return {
    schemaVersion: 1,
    id,
    entityId: record.id,
    entityRevision: record.revision,
    canonicalRecordHash: hub.canonicalRecordHash(record),
    reviewerRole,
    decision: 'approve',
    scope: [scope],
    decisionDate: '2026-01-01',
    notes: 'Fictional deterministic fixture approval.',
  }
}

function run(name, action) {
  try {
    action()
    passed++
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
  }
}
