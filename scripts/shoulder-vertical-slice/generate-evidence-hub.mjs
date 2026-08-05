import fs from 'node:fs'
import path from 'node:path'
import { loadEvidenceHubModule } from '../evidence-hub/shared.mjs'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, sha256File, writeJson } from './shared.mjs'

const hub = await loadEvidenceHubModule()
const shoulder = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'),
  path.join(ROOT, 'src'),
)
const sourceInventory = read('ai-manager/clinical-platform/shoulder/source-inventory.json')
const date = '2026-08-05'

const configurations = [
  {
    conditionId: 'condition.shoulder.rcrsp',
    title: 'Rotator cuff related shoulder pain',
    slug: 'rcrsp',
    publicContentIds: ['rotator-cuff-tendinopathy', 'subacromial-pain-syndrome'],
    caseId: 'guided-case.shoulder.case-04',
    caseRecordPath: 'content/guided-cases/records/published/case.shoulder.case-04.json',
    conditionSourceId: 'source.repository.shoulder.rotator-cuff-reference',
  },
  {
    conditionId: 'condition.shoulder.adhesive-capsulitis',
    title: 'Adhesive capsulitis',
    slug: 'adhesive-capsulitis',
    publicContentIds: ['adhesive-capsulitis'],
    caseId: 'guided-case.shoulder.case-05',
    caseRecordPath: 'content/guided-cases/records/published/case.shoulder.case-05.json',
    conditionSourceId: 'source.repository.shoulder.adhesive-capsulitis-reference',
  },
]

const records = []
const relationships = []
for (const config of configurations) {
  const caseRecord = read(config.caseRecordPath)
  const source = sourceInventory.records.find((item) => item.sourceId === config.conditionSourceId)
  if (!source) throw new Error(`Missing shoulder source ${config.conditionSourceId}`)
  const provenance = [{
    sourceId: source.sourceId,
    checksum: source.checksum,
    locator: source.locators[0] ?? config.caseRecordPath,
    locationCategory: 'repository-reviewed-source',
    eligibilityStatus: 'metadata-only',
    clearanceScope: ['private-topic-mapping'],
  }]
  const condition = hub.conditionSchema.parse({
    schemaVersion: 1,
    id: config.conditionId,
    entityType: 'condition',
    revision: 1,
    lifecycleStatus: 'draft',
    reviewStatus: 'structural-review',
    publicEligibility: false,
    createdAt: date,
    updatedAt: date,
    provenance,
    supersedesRevision: null,
    changeSummary: 'Registered a private shoulder condition shell and explicit evidence gaps; no clinical claim or approval was created.',
    title: config.title,
    slug: config.slug,
    claimIds: [],
    relatedContentIds: [],
    mediaAssetIds: [],
    region: 'shoulder',
    sectionClaims: {},
    reviewSummary: { reviewedRevision: null, reviewDue: null },
    codes: {},
    synonyms: [],
    tags: ['shoulder', 'private-evidence-workflow'],
    guidedCaseIds: [],
    anatomyIds: [],
    exerciseIds: [],
    clinicalTestIds: [],
    outcomeMeasureIds: [],
  })

  const stages = caseRecord.reasoningStages.map((stage) => ({
    id: stage.id,
    type: mapStageType(stage.type),
    prompt: stage.learnerQuestion,
    claimIds: [],
    revealPolicy: 'learner-action',
  }))
  stages.push({
    id: 'diagnosis-reveal',
    type: 'expert-comparison',
    prompt: 'Use the governed case reveal only after the learner requests the final comparison.',
    claimIds: [],
    revealPolicy: 'diagnosis-reveal',
  })
  const caseEntity = hub.guidedCaseSchema.parse({
    schemaVersion: 1,
    id: config.caseId,
    entityType: 'guided-case',
    revision: 1,
    lifecycleStatus: 'draft',
    reviewStatus: 'structural-review',
    publicEligibility: false,
    createdAt: date,
    updatedAt: date,
    provenance: [{
      sourceId: caseRecord.caseId,
      checksum: `sha256:${sha256File(path.join(ROOT, config.caseRecordPath)).replace(/^sha256:/, '')}`,
      locator: config.caseRecordPath,
      locationCategory: 'repository-reviewed-source',
      eligibilityStatus: 'metadata-only',
      clearanceScope: ['private-topic-mapping'],
    }],
    supersedesRevision: null,
    changeSummary: 'Registered a private revision-pinned case relationship without changing the published guided case.',
    internalTitle: caseRecord.privateDiagnosticIdentity.internalTitle,
    neutralTitle: caseRecord.neutralTitle,
    neutralPublicSlug: caseRecord.publicSlug,
    region: 'shoulder',
    linkedConditionId: config.conditionId,
    stages,
    diagnosisRevealStageId: 'diagnosis-reveal',
    anatomyIds: [],
    exerciseIds: [],
    clinicalTestIds: [],
    outcomeMeasureIds: [],
    mediaAssetIds: [],
    learningModeIds: [],
    estimatedTime: caseRecord.estimatedTime,
    difficulty: caseRecord.difficulty,
  })
  records.push(condition, caseEntity)
  relationships.push(
    hub.hubRelationshipSchema.parse({
      schemaVersion: 1,
      id: `relationship.${config.caseId}.condition-reveal`,
      fromId: config.caseId,
      toId: config.conditionId,
      role: 'references',
      fromRevision: 1,
      toRevision: 1,
      revealStageId: 'diagnosis-reveal',
      lifecycleStatus: 'draft',
      reviewStatus: 'structural-review',
    }),
  )
}

const questions = [
  ['question.shoulder.terminology', 'Terminology and classification'],
  ['question.shoulder.presentation', 'Clinical presentation and important variants'],
  ['question.shoulder.assessment', 'Assessment and diagnostic-test limitations'],
  ['question.shoulder.differential', 'Differential diagnosis and cervical or neurological mimics'],
  ['question.shoulder.red-flags', 'Red flags and escalation'],
  ['question.shoulder.movement', 'Movement and functional limitation'],
  ['question.shoulder.management', 'Management principles'],
  ['question.shoulder.prognosis', 'Prognosis and reassessment'],
  ['question.shoulder.communication', 'Patient communication'],
].map(([id, topic]) => ({ id, topic, status: 'evidence-review-required' }))

const gaps = questions.map((question) => ({
  id: `gap.${question.id}`,
  topic: question.topic,
  reason: 'No selected source is cleared, locator-verified and appraised for a new shoulder claim in this task.',
  requiredReview: ['source-clearance', 'evidence', 'clinical'],
  blocksClaims: true,
  blocksPublication: true,
}))
const evidenceMap = shoulder.shoulderEvidenceMapSchema.parse({
  schemaVersion: 1,
  authority: 'private-shoulder-evidence-map',
  privateAuthoringOnly: true,
  sourceRevisionIds: sourceInventory.records.map((source) => `${source.sourceId}@${source.checksum}`).sort(),
  conditionIds: configurations.map((item) => item.conditionId),
  guidedCaseIds: configurations.map((item) => item.caseId),
  clinicalQuestions: questions,
  claims: [],
  evidenceSummaries: [],
  diagnosticTestEvidence: [],
  conflicts: [],
  gaps,
  reviewState: 'review-required',
  publicEligibility: false,
})

for (const record of records) {
  const directory = record.entityType === 'condition' ? 'conditions' : 'guided-cases'
  writeJson(path.join(ROOT, 'content', 'evidence-hub', directory, `${record.id}.json`), record)
}
writeJson(path.join(ROOT, 'content', 'evidence-hub', 'relationships', 'index.json'), { schemaVersion: 1, relationships })
writeJson(path.join(ROOT, 'content', 'evidence-hub', 'pilots', 'rcrsp.json'), {
  schemaVersion: 1,
  pilotId: 'pilot.shoulder.rcrsp',
  title: 'Rotator Cuff Related Shoulder Pain',
  pilotStatus: 'active',
  lifecycleStatus: 'draft',
  reviewStatus: 'structural-review',
  publicEligibility: false,
  ingestionAllowed: false,
  entityIds: ['condition.shoulder.rcrsp', 'guided-case.shoulder.case-04'],
  notes: 'Private structural pilot only. Claims, source clearance, evidence review, clinical review and publication approval remain outstanding.',
})
writeJson(path.join(ROOT, 'content', 'evidence-hub', 'pilots', 'shoulder-vertical-slice.json'), {
  schemaVersion: 1,
  pilotId: 'pilot.shoulder.vertical-slice',
  title: 'Shoulder vertical slice',
  pilotStatus: 'active',
  lifecycleStatus: 'draft',
  reviewStatus: 'structural-review',
  publicEligibility: false,
  ingestionAllowed: false,
  entityIds: records.map((record) => record.id).sort(),
  notes: 'Private structural integration manifest. It creates no clinical claim, evidence approval, source clearance or publication approval.',
})
writeJson(path.join(SHOULDER_ROOT, 'evidence-map.json'), evidenceMap)

const markdown = `# Shoulder Evidence Hub gaps\n\n` +
  `- Private records created: ${records.length}\n` +
  `- Revision-pinned relationships: ${relationships.length}\n` +
  `- Clinical questions queued: ${questions.length}\n` +
  `- Claims created: 0\n` +
  `- Evidence summaries created: 0\n` +
  `- Public records: 0\n\n` +
  `All ${gaps.length} topic gaps block claim creation and publication until source-clearance, evidence and clinical review are complete.\n`
fs.mkdirSync(SHOULDER_REPORT_ROOT, { recursive: true })
fs.writeFileSync(path.join(SHOULDER_REPORT_ROOT, 'evidence-gaps.md'), markdown, 'utf8')

console.log(`Private shoulder Evidence Hub generated: ${records.length} records; ${relationships.length} relationships; ${gaps.length} gaps; 0 claims; 0 public records.`)

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
}

function mapStageType(type) {
  const mapping = {
    'initial-hypothesis': 'differential',
    'subjective-assessment': 'history-reveal',
    'objective-assessment': 'examination',
    'differential-diagnosis': 'differential',
    'red-flag-escalation': 'red-flags',
    'investigation-reasoning': 'investigation',
    'management-reasoning': 'management',
    'patient-communication': 'patient-explanation',
    'safety-netting': 'management',
    'referral-threshold': 'management',
    'reassessment-progression': 'reflection',
  }
  return mapping[type] ?? 'reflection'
}
