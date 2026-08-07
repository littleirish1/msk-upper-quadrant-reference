import fs from 'node:fs'
import path from 'node:path'
import { deriveStudioSummary, loadContentRegistry } from './content-studio.mjs'

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'))
}

const datasetDefinitions = Object.freeze([
  { id: 'modules', label: 'Clinical Modules', path: 'ai-manager/clinical-platform/modules/module-library.json', collection: 'modules' },
  { id: 'truth-records', label: 'Patient Truth Records', path: 'ai-manager/clinical-platform/truth/patient-truth-records.json', collection: 'records' },
  { id: 'compatibility-rules', label: 'Compatibility rules', path: 'ai-manager/clinical-platform/rules/compatibility-rules.json', collection: 'rules' },
  { id: 'recipes', label: 'Generated recipes', path: 'ai-manager/clinical-platform/generator/patient-recipes.json', collection: 'recipes' },
  { id: 'cases', label: 'Public/private cases', path: 'reports/guided-cases/summary.json', collection: 'records' },
  { id: 'evidence', label: 'Evidence Hub records', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'evidenceRecords' },
  { id: 'evidence-proposals', label: 'Evidence-to-module proposals', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'relationships' },
  { id: 'evidence-gaps', label: 'Evidence Hub explicit gaps', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'explicitGapCollections' },
  { id: 'anatomy-3d', label: '3D slots/assets', path: 'ai-manager/clinical-platform/anatomy-3d/registry.json', collection: 'assets' },
  { id: 'movement', label: 'Movement slots/records', path: 'ai-manager/clinical-platform/movement/movement-library.json', collection: 'records' },
  { id: 'mcq', label: 'MCQ slots/questions', path: 'ai-manager/clinical-platform/mcq/bank.json', collection: 'records' },
  { id: 'reviews', label: 'Exact-revision reviews', path: 'ai-manager/clinical-platform/reviews/review-ledger.json', collection: 'reviews' },
  { id: 'review-queues', label: 'Review queues', path: 'reports/clinical-platform/review-queues.json', collection: 'queue' },
  { id: 'source-clearance', label: 'Source-clearance reviews', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'source' },
  { id: 'licensing', label: 'Licensing reviews', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'licensing' },
  { id: 'accessibility', label: 'Accessibility sign-offs', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'accessibility' },
  { id: 'dependencies', label: 'Dependency findings', path: 'reports/private-review-portal/dependency-classification.json', collection: 'findings' },
  { id: 'beta', label: 'Beta', path: 'ai-manager/clinical-platform/beta/programme.json', collection: 'taskScripts' },
  { id: 'release-blockers', label: 'Release blockers', path: 'ai-manager/clinical-platform/release/v1-release-candidate.json', collection: 'blockers' },
  { id: 'technical-findings', label: 'Independent technical findings', path: 'ai-manager/clinical-platform/reviews/independent-review-findings.json', collection: 'findings' },
])

function compactItem(item) {
  if (!item || typeof item !== 'object') return item
  const fields = ['id', 'moduleId', 'truthRecordId', 'ruleId', 'recipeId', 'caseId', 'assetId', 'movementId', 'questionId', 'taskId', 'queueId', 'neutralTitle', 'title', 'name', 'region', 'status', 'lifecycleState', 'publicationState', 'revision', 'exactRevisionKey', 'severity', 'subsystem', 'reviewKind', 'state']
  const compact = {}
  for (const field of fields) if (item[field] !== undefined) compact[field] = item[field]
  if (item.target) compact.target = compactItem(item.target)
  if (item.decisions) compact.pendingDecisions = item.decisions.filter((decision) => decision.state !== 'approved').length
  return Object.keys(compact).length ? compact : { summary: JSON.stringify(item).slice(0, 300) }
}

export function deriveProjectSnapshot(repositoryRoot, store, portalConfig = { actorId: 'local-reviewer', actorRoles: ['content-reviewer'] }) {
  const datasets = datasetDefinitions.map((definition) => {
    const source = readJson(repositoryRoot, definition.path)
    const collection = source[definition.collection]
    const records = Array.isArray(collection) ? collection.filter((item) => !definition.filterField || item[definition.filterField] === definition.filterValue) : []
    const count = Array.isArray(collection)
      ? records.length
      : typeof collection === 'number'
        ? collection
        : collection && typeof collection === 'object'
          ? Object.values(collection).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0)
          : 0
    const summary = Object.fromEntries(Object.entries(source).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value)))
    if (collection && typeof collection === 'object' && !Array.isArray(collection)) summary.breakdown = Object.entries(collection).map(([key, value]) => `${key}:${value}`).join(', ')
    return { id: definition.id, label: definition.label, sourcePath: definition.path, count, summary, items: records.slice(0, 500).map(compactItem) }
  })
  const evidence = readJson(repositoryRoot, 'reports/clinical-platform/evidence-hub-population.json')
  const cases = readJson(repositoryRoot, 'reports/guided-cases/summary.json')
  const reviews = readJson(repositoryRoot, 'ai-manager/clinical-platform/reviews/review-ledger.json')
  const release = readJson(repositoryRoot, 'ai-manager/clinical-platform/release/v1-release-candidate.json')
  const database = store.read()
  const registry = loadContentRegistry({ repositoryRoot, store })
  const integrationProposals = database.integrationProposals.map(({ relativePath, ...proposal }) => ({
    ...proposal,
    downloadUrl: `/api/integration-proposals/${proposal.id}/download`,
  }))
  const integrationQueue = database.integrationQueue.map((entry) => structuredClone(entry))
  return {
    generatedAt: new Date().toISOString(),
    authority: 'derived-read-only-from-repository-and-private-database',
    notice: 'Research and project material only. Uploading or reviewing here does not create clinical or evidence approval.',
    headline: {
      documents: database.documents.length,
      quarantined: database.documents.filter((item) => item.quarantine === 'held').length,
      reviewTargets: reviews.reviews.length,
      pendingReviews: reviews.reviews.reduce((total, item) => total + item.decisions.filter((decision) => decision.state !== 'approved').length, 0),
      releaseBlockers: release.blockers.length,
      publicCases: cases.records.filter((item) => item.lifecycleState === 'published').length,
      privateCases: cases.records.filter((item) => item.lifecycleState !== 'published').length,
      evidenceRecords: Array.isArray(evidence.evidenceRecords) ? evidence.evidenceRecords.length : Number(evidence.evidenceRecords ?? 0),
      evidenceProposals: Array.isArray(evidence.relationships) ? evidence.relationships.length : Number(evidence.relationships ?? 0),
    },
    datasets,
    studio: {
      schemaVersion: registry.schemaVersion,
      summary: { ...deriveStudioSummary(registry), integrationProposals: integrationProposals.length, queuedForIntegration: integrationQueue.filter((entry) => !['pull-request-open', 'rejected'].includes(entry.status)).length },
      regions: registry.regions,
      contentTypes: registry.contentTypes,
      extraMaterialTypes: registry.extraMaterialTypes,
      items: registry.items.map(({ currentContent, ...item }) => item),
      integrationProposals,
      integrationQueue,
      actor: { id: portalConfig.actorId, roles: portalConfig.actorRoles },
      capabilities: { submitIntegrationProposal: portalConfig.actorRoles.includes('integration-proposer') },
      grantsApproval: false,
    },
    documents: database.documents.map(({ relativePath, ...document }) => document),
    actions: database.actions,
    futureItems: database.futureItems,
  }
}

export function exactRevisionExists(repositoryRoot, exactRevisionKey) {
  if (!exactRevisionKey) return false
  const ledger = readJson(repositoryRoot, 'ai-manager/clinical-platform/reviews/review-ledger.json')
  return ledger.reviews.some((review) => review.target.exactRevisionKey === exactRevisionKey)
}

const futureDefinitions = [
  ['evidence-population', 'Evidence population', 'evidence-reviewer'],
  ['module-expansion', 'Module expansion', 'clinical-author'],
  ['authored-mcqs', 'Authored MCQs', 'clinical-author'],
  ['licensed-3d-assets', 'Licensed 3D assets', 'licensing-reviewer'],
  ['reviewed-movement-records', 'Reviewed movement records', 'clinical-reviewer'],
  ['legacy-case-work', 'Legacy-case work', 'content-reviewer'],
  ['regional-content', 'Regional content', 'clinical-author'],
  ['real-beta', 'Real beta', 'beta-lead'],
  ['dependency-remediation', 'Dependency remediation', 'technical-lead'],
  ['manual-accessibility', 'Manual accessibility', 'accessibility-reviewer'],
  ['publication-release-decision', 'Publication/release decision', 'release-authority'],
]

export function initializeFutureBuild(store) {
  const database = store.read()
  if (database.futureItems.length) return database.futureItems
  return store.replaceFutureItems(futureDefinitions.map(([id, title, ownerRole], index) => ({
    id,
    title,
    status: 'not-started',
    priority: index < 3 ? 'high' : 'medium',
    dependencies: [],
    ownerRole,
    milestone: 'post-v1-technical-integration',
    blockers: ['human-authority-review-required'],
    linkedFiles: [],
    linkedFindings: [],
    linkedCommits: [],
    notes: [],
    nextAction: 'Assign an authorised owner and define an exact-revision work packet.',
  })))
}
