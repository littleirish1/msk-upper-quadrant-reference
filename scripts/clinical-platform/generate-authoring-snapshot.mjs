import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'workspace', 'snapshot.json')
const modules = read('ai-manager/clinical-platform/modules/module-library.json').modules
const truth = read('ai-manager/clinical-platform/truth/patient-truth-records.json').records
const rules = read('ai-manager/clinical-platform/rules/compatibility-rules.json').rules
const recipes = read('ai-manager/clinical-platform/generator/patient-recipes.json').recipes
const transcripts = read('reports/clinical-platform/provider-free-transcripts.json').transcripts
const regions = read('reports/clinical-platform/regional-content-matrix.json').regions
const mcqs = read('ai-manager/clinical-platform/mcq/bank.json').records
const evidenceSummary = read('reports/clinical-platform/evidence-hub-population.json')
const ingestion = read('ai-manager/clinical-platform/ingestion/register.json')
const movement = read('ai-manager/clinical-platform/movement/movement-library.json').records
const anatomy3d = read('ai-manager/clinical-platform/anatomy-3d/registry.json').assets
const dependency = read('reports/governance/dependency-risk-register.json')
const legacy = read('reports/clinical-platform/legacy-case-reconciliation.json').records
const beta = read('ai-manager/clinical-platform/beta/programme.json')

const groups = {
  modules: modules.map((item) => record(item.id, item.revision, item.lifecycle, item.relationships.sources[0]?.hash, item.publicationState)),
  truthRecords: truth.map((item) => record(item.recordId, item.caseRevision, item.lifecycle, item.authoritativeHash, item.publicModeEligibility ? 'baseline-public-mode' : 'private')),
  rules: rules.map((item) => record(item.id, item.revision, item.lifecycle, item.approval.ruleHash, item.enabled ? 'enabled' : 'disabled')),
  recipes: recipes.map((item) => record(item.recipeId, item.recipeRevision, item.lifecycle, item.governance.recipeApprovalHash, 'private')),
  transcripts: transcripts.map((item) => record(`transcript.${item.caseId}`, 1, 'provider-free-fixture', item.truthHash, 'private')),
  regions: regions.map((item) => record(item.regionId, 1, item.routeState, null, item.publicNewRoutes === 0 ? 'no-new-route' : 'changed')),
  mcqs: mcqs.map((item) => record(item.id, item.revision, item.lifecycle, null, 'private')),
  evidence: Array.from({ length: evidenceSummary.evidenceRecords }, (_, index) => record(`evidence.metadata.${index + 1}`, 1, 'unreviewed', null, 'private')),
  ingestion: ingestion.proposals.map((item) => record(item.proposalId, item.sourceRevision, item.reviewState, null, 'private')),
  movement: movement.map((item) => record(item.id, item.revision, item.lifecycle, null, 'private')),
  anatomy3d: anatomy3d.map((item) => record(item.id, item.revision, 'blocked', item.assetHash, 'private')),
  legacy: legacy.map((item) => record(`legacy.${item.stationId}`, 1, item.classification, item.sourceRevision, item.publicEligibility ? 'baseline-public' : 'private')),
  betaTasks: beta.taskScripts.map((item) => record(item.taskId, item.revision, item.status, null, 'private')),
}

const queues = {
  clinical: [...modules.map((item) => item.id), ...rules.map((item) => item.id), ...recipes.map((item) => item.recipeId), ...movement.map((item) => item.id), ...mcqs.map((item) => item.id)],
  evidence: [...modules.map((item) => item.id), ...rules.map((item) => item.id), ...movement.map((item) => item.id), ...mcqs.map((item) => item.id), ...ingestion.proposals.map((item) => item.proposalId)],
  source: ingestion.sources.filter((item) => item.sourceClearance !== 'approved-public-use').map((item) => item.sourceId),
  licensing: anatomy3d.filter((item) => item.reviews.licence !== 'approved').map((item) => item.id),
  accessibility: [...anatomy3d.filter((item) => item.reviews.accessibility !== 'approved').map((item) => item.id), ...movement.filter((item) => item.reviews.accessibility !== 'approved').map((item) => item.id), ...mcqs.filter((item) => item.reviews.accessibility !== 'approved').map((item) => item.id)],
  anatomy: anatomy3d.filter((item) => item.reviews.anatomy !== 'approved').map((item) => item.id),
  movement: movement.filter((item) => item.reviews.movement !== 'approved').map((item) => item.id),
  staleApproval: [...modules.filter((item) => item.lifecycle === 'stale').map((item) => item.id), ...rules.filter((item) => item.lifecycle === 'stale').map((item) => item.id)],
  betaIssue: ['beta.programme.real-results-pending', ...beta.taskScripts.map((item) => item.taskId)],
  dependencyRisk: dependency.risks.filter((item) => item.status !== 'resolved').map((item) => item.riskId),
  publicationDecision: [...modules.map((item) => item.id), ...recipes.map((item) => item.recipeId), ...movement.map((item) => item.id), ...anatomy3d.map((item) => item.id), ...mcqs.map((item) => item.id)],
}
for (const value of Object.values(queues)) value.sort()
const snapshot = {
  schemaVersion: 1,
  authority: 'private-clinical-authoring-workspace',
  publicRoute: null,
  providerCallsEnabled: false,
  persistence: 'ephemeral-browser-drafts-and-downloaded-packets-only',
  groups,
  counts: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, values.length])),
  queues,
  queueCounts: Object.fromEntries(Object.entries(queues).map(([key, values]) => [key, values.length])),
  actions: ['inspect-exact-revision', 'filter-queues', 'draft-ephemeral-note', 'download-review-packet'],
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sortKeys(snapshot), null, 2)}\n`, 'utf8')
console.log(`Private authoring snapshot generated: ${Object.values(groups).reduce((sum, items) => sum + items.length, 0)} records; ${Object.values(queues).reduce((sum, items) => sum + items.length, 0)} queue entries.`)

function read(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')) }
function record(id, revision, lifecycle, hash, publication) { return { id, revision, lifecycle, hash, publication } }
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
