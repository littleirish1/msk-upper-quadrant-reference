import fs from 'node:fs'
import path from 'node:path'
import { loadEvidenceHubModule } from '../evidence-hub/shared.mjs'

const ROOT = process.cwd()
const hub = await loadEvidenceHubModule()
const ingestion = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'ingestion', 'register.json'), 'utf8'))
const moduleLibrary = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'modules', 'module-library.json'), 'utf8'))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))
const movement = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'movement', 'movement-library.json'), 'utf8'))
const anatomy3d = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'anatomy-3d', 'registry.json'), 'utf8'))
const mcqPlan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'assessment', 'mcq-plan.json'), 'utf8'))
const evidenceDirectory = path.join(ROOT, 'content', 'evidence-hub', 'evidence')
const graphOutput = path.join(ROOT, 'reports', 'clinical-platform', 'evidence-hub-graph.json')
const summaryOutput = path.join(ROOT, 'reports', 'clinical-platform', 'evidence-hub-population.json')

const titleByPath = new Map([
  ['content/evidence-hub/pilots/lateral-ankle-sprain.json', 'Registered repository pilot: lateral ankle sprain'],
  ['content/evidence-hub/pilots/rcrsp.json', 'Registered repository pilot: shoulder pain'],
  ['content/imports/source-registry.json', 'Registered legacy source catalogue'],
])

const records = ingestion.sources.map((source) => hub.evidenceSchema.parse({
  schemaVersion: 1,
  id: `evidence.${source.sourceId.slice('source.'.length)}`,
  entityType: 'evidence',
  revision: 1,
  lifecycleStatus: 'draft',
  reviewStatus: 'unreviewed',
  publicEligibility: false,
  createdAt: '2026-08-02',
  updatedAt: '2026-08-02',
  provenance: [{
    sourceId: source.sourceId,
    checksum: `sha256:${source.hash}`,
    locator: source.repositoryPath,
    locationCategory: 'repository-reviewed-source',
    eligibilityStatus: 'metadata-only',
    clearanceScope: [],
  }],
  supersedesRevision: null,
  changeSummary: 'Registered exact repository source metadata; no clinical claim or bibliographic approval created.',
  title: titleByPath.get(source.repositoryPath) ?? 'Registered repository source',
  evidenceType: source.educationalSecondarySource ? 'teaching-source' : 'other',
  referenceIds: [],
  sourceLocators: [{
    sourceId: source.sourceId,
    checksum: `sha256:${source.hash}`,
    locator: source.repositoryPath,
    locationCategory: 'repository-reviewed-source',
    eligibilityStatus: 'metadata-only',
    clearanceScope: [],
  }],
  verificationStatus: 'extracted-unverified',
  appraisalStatus: 'not-appraised',
  applicability: '',
  limitations: [
    'This record proves only the tracked source identity and checksum.',
    'Bibliographic identity, claims, study design, population, applicability and source clearance are not verified.',
  ],
  outcomes: [],
  supersededByEvidenceIds: [],
  notes: 'Private metadata-only record. It must not support a public claim without exact-locator extraction and human review.',
}))

fs.mkdirSync(evidenceDirectory, { recursive: true })
for (const record of records) write(path.join(evidenceDirectory, `${record.id.replaceAll('.', '-')}.json`), record)

const graph = {
  schemaVersion: 1,
  nodes: records.map((record) => ({ id: record.id, entityType: record.entityType, revision: record.revision, reviewStatus: record.reviewStatus, publicEligibility: record.publicEligibility })),
  relationships: [],
  unresolvedExternalCoverage: {
    modules: moduleLibrary.modules.map((item) => ({ id: item.id, revision: item.revision, evidenceRecordIds: item.relationships.evidenceRecordIds, gapIds: item.relationships.evidenceGapIds })),
    truthRecords: truth.records.map((item) => ({ id: item.recordId, hash: item.authoritativeHash, unresolvedIssues: item.governance.unresolvedIssues })),
    movement: movement.records.map((item) => ({ id: item.id, revision: item.revision, evidenceRecordIds: item.evidenceRecordIds, gapIds: item.evidenceGapIds })),
    anatomy3d: anatomy3d.assets.map((item) => ({ id: item.id, revision: item.revision, publicEligibility: item.publicEligibility, blockers: item.blockers })),
    mcqSlots: mcqPlan.slots.map((item) => ({ id: item.id, blockers: item.blockers })),
  },
}
const summary = {
  schemaVersion: 1,
  genuineRegisteredSources: records.length,
  evidenceRecords: records.length,
  conditions: 0,
  clinicalQuestions: 0,
  guidelines: 0,
  systematicReviews: 0,
  primaryStudies: 0,
  educationalSources: records.filter((record) => record.evidenceType === 'teaching-source').length,
  claims: 0,
  presentationVariants: 0,
  approvedMovementEvidence: 0,
  approvedAnatomyEvidence: 0,
  reviewDecisions: 0,
  relationships: 0,
  supersededRecords: 0,
  publicRecords: 0,
  exactRevisionCoverage: 0,
  explicitGapCollections: {
    modules: moduleLibrary.modules.reduce((sum, item) => sum + item.relationships.evidenceGapIds.length, 0),
    truthRecords: truth.records.reduce((sum, item) => sum + item.gaps.length, 0),
    movement: movement.records.reduce((sum, item) => sum + item.evidenceGapIds.length, 0),
    anatomy3d: anatomy3d.assets.length,
    mcq: mcqPlan.slots.length,
  },
  blockers: [
    'No source has verified bibliographic identity, full-text appraisal, exact claim locators or public-use clearance.',
    'No human evidence, clinical or publication decision has been recorded.',
  ],
}
write(graphOutput, graph)
write(summaryOutput, summary)
console.log(`Private Evidence Hub populated: ${records.length} metadata-only records; claims: 0; relationships: 0; public: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
