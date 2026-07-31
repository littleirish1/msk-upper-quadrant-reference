import fs from 'node:fs'
import path from 'node:path'
import {
  CONFIG_FILE,
  ROOT,
  assertNoPrivateAbsolutePath,
  collectFiles,
  loadProgrammeSchemas,
  normaliseIdPart,
  packageVersion,
  readJson,
  relative,
  sha256File,
  stableJson,
  writeText,
} from './shared.mjs'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const outputRoot = getArgument('--output-root') ?? ROOT
const config = readJson(CONFIG_FILE)
const schemas = await loadProgrammeSchemas()
const items = []
const sourceRegistry = readJson(path.join(ROOT, 'content', 'imports', 'source-registry.json'))
const legacyIndex = readJson(path.join(ROOT, 'content', 'imports', 'html-case-bank', 'extracted', 'station-index.json'))
const sourceManifest = readJson(path.join(ROOT, 'ai-manager', 'reports', 'source-intake-pilot', 'source-manifest.json'))
const lock = readJson(path.join(ROOT, 'package-lock.json'))
const publicConditionModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'publicConditions.ts'),
  path.join(ROOT, 'src'),
)
const taxonomyModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'data', 'taxonomy.ts'),
  path.join(ROOT, 'src'),
)
const anatomyModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'data', 'anatomy.ts'),
  path.join(ROOT, 'src'),
)

addConditions()
addGuidedCases()
addLegacyStations()
addPrivateStructuredRecords()
addEvidenceHubRecords()
addCataloguedSources()
addPublicRoutes()
addSearchEntries()
addVisualAssets()

items.sort((left, right) => left.id.localeCompare(right.id))
assertUnique(items.map((item) => item.id), 'inventory ID')
for (const item of items) {
  const result = schemas.projectInventoryItemSchema.safeParse(item)
  if (!result.success) throw new Error(formatIssues(`inventory item ${item.id}`, result.error.issues))
}

const byContentType = countBy(items, (item) => item.contentType)
const byPublicationState = countBy(items, (item) => item.publicationState)
const inventory = {
  schemaVersion: 1,
  baselineCommit: config.baselineCommit,
  generatedFromTrackedFilesOnly: true,
  items,
  summary: {
    total: items.length,
    byContentType,
    byPublicationState,
    publicItems: byPublicationState.public ?? 0,
    blockedItems: byPublicationState.blocked ?? 0,
    unaccountedLegacyItems: items.filter((item) =>
      item.contentType === 'legacy-station'
      && item.blockers.includes('Legacy source is not linked to a governed case or explicit disposition.'),
    ).length,
  },
}
const inventoryResult = schemas.projectInventorySchema.safeParse(inventory)
if (!inventoryResult.success) throw new Error(formatIssues('project inventory', inventoryResult.error.issues))

const dependencyRiskRegister = buildDependencyRiskRegister()
const riskResult = schemas.dependencyRiskRegisterSchema.safeParse(dependencyRiskRegister)
if (!riskResult.success) throw new Error(formatIssues('dependency risk register', riskResult.error.issues))

const governanceDashboard = buildGovernanceDashboard(inventory, dependencyRiskRegister)
const reviewQueues = buildReviewQueues(inventory, dependencyRiskRegister)
const inventorySummary = buildInventorySummary(inventory)

for (const [label, value] of [
  ['project inventory', inventory],
  ['dependency risk register', dependencyRiskRegister],
  ['governance dashboard', governanceDashboard],
  ['review queues', reviewQueues],
  ['inventory summary', inventorySummary],
]) {
  assertNoPrivateAbsolutePath(value, label)
}

writeText(outputRoot, 'reports/governance/project-inventory.json', stableJson(inventory))
writeText(outputRoot, 'reports/governance/dependency-risk-register.json', stableJson(dependencyRiskRegister))
writeText(outputRoot, 'reports/governance/governance-dashboard.json', stableJson(governanceDashboard))
writeText(outputRoot, 'reports/governance/review-queues.md', reviewQueues)
writeText(outputRoot, 'reports/governance/project-inventory-summary.md', inventorySummary)

console.log(`Generated project inventory: ${inventory.summary.total} items.`)
console.log(`Legacy stations: ${byContentType['legacy-station'] ?? 0}; conditions: ${byContentType.condition ?? 0}; guided cases: ${byContentType['guided-case'] ?? 0}.`)
console.log(`Catalogued private evidence sources: ${byContentType['evidence-source'] ?? 0}.`)
console.log(`Open dependency risks: ${dependencyRiskRegister.risks.filter((risk) => risk.status === 'open').length}.`)
console.log(`Output root: ${path.resolve(outputRoot) === path.resolve(ROOT) ? 'repository' : 'temporary'}.`)

function addConditions() {
  for (const record of publicConditionModule.getPublicConditionRecords()) {
    const file = record.filePath
    const contentId = record.frontmatter.contentId ?? `condition.${record.region}.${record.condition}`
    const evidenceGap = !record.frontmatter.citations?.length
    items.push(item({
      id: contentId,
      region: record.region,
      contentType: 'condition',
      title: record.frontmatter.title,
      file,
      sourceId: contentId,
      lifecycleState: 'published',
      clinicalReviewState: 'approved',
      evidenceReviewState: evidenceGap ? 'required' : 'in-review',
      sourceClearanceState: 'unknown',
      publicationState: 'public',
      destinationRoute: `/${record.region}/${record.condition}`,
      blockers: evidenceGap ? ['No revision-pinned Evidence Hub relationship is recorded.'] : [],
      nextAction: evidenceGap
        ? 'Record and review an Evidence Hub evidence gap before proposing evidence relationships.'
        : 'Verify citations and add revision-pinned Evidence Hub relationships.',
    }))
  }
}

function addGuidedCases() {
  const recordFiles = collectFiles(
    path.join(ROOT, 'content', 'guided-cases', 'records'),
    (file) => file.endsWith('.json'),
  )
  for (const file of recordFiles) {
    const record = readJson(file)
    const isPublic = record.lifecycleState === 'published' && record.publicationEligibility
    items.push(item({
      id: record.caseId,
      region: record.region,
      contentType: 'guided-case',
      title: record.neutralTitle,
      file,
      sourceId: record.provenance?.legacySourceId ?? record.caseId,
      revision: String(record.contentRevision),
      lifecycleState: isPublic ? 'published' : 'draft',
      clinicalReviewState: isPublic ? 'approved' : 'required',
      evidenceReviewState: record.evidenceHub?.unresolvedEvidenceGaps?.length ? 'required' : 'in-review',
      sourceClearanceState: isPublic ? 'approved-for-public-use' : 'review-required',
      publicationState: isPublic ? 'public' : 'blocked',
      destinationRoute: isPublic ? `/cases/${record.region}/${record.publicSlug}` : null,
      blockers: isPublic
        ? (record.evidenceHub?.unresolvedEvidenceGaps ?? [])
        : [
            ...(record.governance?.unresolvedIssues ?? []),
            ...(record.evidenceHub?.unresolvedEvidenceGaps ?? []),
          ],
      nextAction: isPublic
        ? 'Maintain exact-revision review and resolve the recorded Evidence Hub gap.'
        : 'Complete source clearance, evidence review, clinical review, and independent publication review.',
    }))
  }
}

function addLegacyStations() {
  const registryById = new Map(sourceRegistry.sources.map((source) => [source.sourceId, source]))
  for (const station of legacyIndex.stations) {
    const source = registryById.get(station.id)
    const sourceStatus = source?.sourceStatus ?? station.status ?? 'pending-review'
    const blockers = []
    if (sourceStatus === 'pending-review') {
      blockers.push('Legacy source is not linked to a governed case or explicit disposition.')
    }
    if (sourceStatus === 'draft-created') blockers.push('Governed draft remains review-required and private.')
    items.push(item({
      id: `legacy-station.${station.id}`,
      region: station.suggestedRegion === 'unknown' ? null : station.suggestedRegion,
      contentType: 'legacy-station',
      title: `Legacy station ${station.id}`,
      file: path.join(ROOT, 'content', 'imports', 'html-case-bank', 'extracted', 'station-index.json'),
      sourceId: `${legacyIndex.sourceId}:${station.id}`,
      checksum: `sha256:${legacyIndex.sha256}`,
      revision: legacyIndex.gitBlobId,
      provenanceStatus: 'legacy-accounted',
      lifecycleState: sourceStatus === 'converted' ? 'archived' : 'draft',
      clinicalReviewState: 'required',
      evidenceReviewState: 'required',
      sourceClearanceState: 'restricted-pending-clearance',
      publicationState: 'private',
      destinationRoute: null,
      blockers,
      nextAction: sourceStatus === 'converted'
        ? 'Retain source accounting and audit trail.'
        : sourceStatus === 'draft-created'
          ? 'Complete the governed draft review workflow.'
          : 'Classify in a controlled 3-5 station batch.',
    }))
  }
}

function addPrivateStructuredRecords() {
  const definitions = [
    ['content/anatomy/private', 'anatomy'],
    ['content/special-tests/private', 'special-test'],
    ['content/outcome-measures/private', 'outcome-measure'],
    ['content/learning/private', 'learning-record'],
    ['content/assessment/private', 'mcq'],
    ['content/plans/regions', 'region-plan'],
  ]
  for (const [directory, contentType] of definitions) {
    for (const file of collectFiles(path.join(ROOT, directory), (item) => item.endsWith('.json'))) {
      const record = readJson(file)
      const actualType = record.recordType === 'quiz-question' ? 'mcq' : contentType
      const recordId = record.contentId ?? record.id
      items.push(item({
        id: recordId,
        region: record.region ?? record.regions?.[0] ?? null,
        contentType: actualType,
        title: record.title,
        file,
        sourceId: recordId,
        lifecycleState: record.status === 'planned' ? 'planned' : 'private',
        clinicalReviewState: record.reviewStatus === 'reviewed' || record.reviewState === 'approved'
          ? 'approved'
          : 'required',
        evidenceReviewState: record.references?.length ? 'in-review' : 'required',
        sourceClearanceState: 'review-required',
        publicationState: record.status === 'planned' ? 'planned' : 'private',
        destinationRoute: null,
        blockers: [
          'Private structured record is not approved for publication.',
          ...(record.references?.length ? [] : ['No verified evidence relationship is recorded.']),
        ],
        nextAction: 'Complete source, evidence, clinical, and publication review for the exact revision.',
      }))
    }
  }
}

function addEvidenceHubRecords() {
  const directories = [
    'anatomy', 'claims', 'clinical-tests', 'evidence', 'exercises',
    'guided-cases', 'media-assets', 'outcome-measures', 'references',
  ]
  for (const directory of directories) {
    for (const file of collectFiles(
      path.join(ROOT, 'content', 'evidence-hub', directory),
      (item) => item.endsWith('.json'),
    )) {
      const record = readJson(file)
      items.push(item({
        id: `inventory.${record.id}`,
        region: record.region ?? record.regions?.[0] ?? null,
        contentType: 'evidence-hub-record',
        title: record.title ?? record.statement ?? record.id,
        file,
        sourceId: record.id,
        revision: String(record.revision),
        lifecycleState: record.lifecycleStatus === 'active' ? 'active' : record.lifecycleStatus,
        clinicalReviewState: record.reviewStatus === 'approved' ? 'approved' : 'required',
        evidenceReviewState: record.reviewStatus === 'approved' ? 'approved' : 'required',
        sourceClearanceState: record.provenance?.every((source) =>
          source.eligibilityStatus === 'cleared-for-private-evidence-processing'
        ) ? 'cleared-for-private-processing' : 'review-required',
        publicationState: record.publicEligibility ? 'blocked' : 'private',
        destinationRoute: null,
        blockers: record.publicEligibility
          ? ['Evidence Hub public publication is disabled in Programme v1.']
          : ['Evidence Hub record is private and requires exact-revision review.'],
        nextAction: 'Complete the Evidence Hub review workflow without creating a public route.',
      }))
    }
  }
}

function addCataloguedSources() {
  const manifestFile = path.join(ROOT, 'ai-manager', 'reports', 'source-intake-pilot', 'source-manifest.json')
  for (const record of sourceManifest.records) {
    const clearance = record.sensitivity === 'quarantine'
      ? 'quarantined'
      : record.sensitivity === 'restricted'
        ? 'restricted-pending-clearance'
        : 'review-required'
    items.push(item({
      id: `evidence-source.${record.sourceId}`,
      region: record.regionTags?.[0] ?? null,
      contentType: 'evidence-source',
      title: `${record.sourceType} ${record.sourceId}`,
      file: manifestFile,
      sourceId: record.sourceId,
      checksum: record.checksum,
      revision: sourceManifest.sourceSetFingerprint,
      provenanceStatus: 'catalogued-private-source',
      lifecycleState: record.extractionStatus === 'failed' ? 'source-insufficient' : 'private',
      clinicalReviewState: 'not-applicable',
      evidenceReviewState: 'required',
      sourceClearanceState: clearance,
      publicationState: 'private',
      destinationRoute: null,
      duplicateOf: null,
      blockers: [
        `Source governance status: ${record.sensitivity}.`,
        'Catalogued source cannot support publication without explicit clearance and evidence review.',
      ],
      nextAction: clearance === 'quarantined'
        ? 'Retain in quarantine pending authorised review.'
        : 'Complete manual sensitivity, rights, and evidence eligibility review.',
    }))
  }
}

function addPublicRoutes() {
  const routeSources = {
    taxonomy: path.join(ROOT, 'src', 'data', 'taxonomy.ts'),
    caseRegistry: path.join(ROOT, 'src', 'data', 'public-case-registry.json'),
  }
  const routes = new Map([
    ['/', routeSources.taxonomy],
    ['/anatomy', routeSources.taxonomy],
    ['/cases', routeSources.caseRegistry],
    ['/demo', routeSources.taxonomy],
    ['/future', routeSources.taxonomy],
    ['/learning', routeSources.taxonomy],
    ['/red-flags', routeSources.taxonomy],
    ['/search', path.join(ROOT, 'public', 'search-index.json')],
  ])
  for (const region of taxonomyModule.REGIONS) routes.set(`/${region.slug}`, routeSources.taxonomy)
  for (const condition of publicConditionModule.getPublicConditionRecords()) {
    routes.set(`/${condition.region}/${condition.condition}`, condition.filePath)
  }
  for (const category of anatomyModule.ANATOMY_CATEGORIES) {
    routes.set(`/anatomy/${category.slug}`, path.join(ROOT, 'src', 'data', 'anatomy.ts'))
  }
  for (const record of items.filter((entry) => entry.contentType === 'guided-case' && entry.publicationState === 'public')) {
    routes.set(record.destinationRoute, path.join(ROOT, record.sources[0].repositoryPath))
  }

  for (const [route, file] of [...routes.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    items.push(item({
      id: `route.public.${normaliseIdPart(route === '/' ? 'home' : route)}`,
      region: route.split('/').filter(Boolean)[0] ?? null,
      contentType: route === '/red-flags' ? 'differential-red-flag' : 'public-route',
      title: `Public route ${route}`,
      file,
      sourceId: `route:${route}`,
      provenanceStatus: 'generated',
      lifecycleState: 'active',
      clinicalReviewState: 'not-applicable',
      evidenceReviewState: 'not-applicable',
      sourceClearanceState: 'not-applicable',
      publicationState: 'public',
      destinationRoute: route,
      blockers: [],
      nextAction: 'Retain exact-route reconciliation and public-boundary checks.',
    }))
  }
}

function addSearchEntries() {
  const file = path.join(ROOT, 'public', 'search-index.json')
  const searchIndex = readJson(file)
  const records = Array.isArray(searchIndex) ? searchIndex : searchIndex.entries ?? searchIndex.records ?? []
  for (const record of records) {
    const identifier = record.id ?? `${record.region}-${record.slug ?? record.title}`
    items.push(item({
      id: `search-entry.${normaliseIdPart(identifier)}`,
      region: record.region ?? null,
      contentType: 'search-entry',
      title: record.title,
      file,
      sourceId: `search:${identifier}`,
      provenanceStatus: 'generated',
      lifecycleState: 'active',
      clinicalReviewState: 'not-applicable',
      evidenceReviewState: 'not-applicable',
      sourceClearanceState: 'not-applicable',
      publicationState: 'public',
      destinationRoute: record.href ?? null,
      blockers: [],
      nextAction: 'Regenerate deterministically from public-safe condition projections.',
    }))
  }
}

function addVisualAssets() {
  const registryFile = path.join(ROOT, 'content', 'visual-assets', 'private', 'registry.json')
  if (fs.existsSync(registryFile)) {
    const registry = readJson(registryFile)
    for (const asset of registry.assets ?? []) {
      items.push(item({
        id: asset.id,
        region: null,
        contentType: 'visual-asset',
        title: asset.title,
        file: registryFile,
        sourceId: asset.id,
        lifecycleState: 'private',
        clinicalReviewState: asset.clinicalReviewState,
        evidenceReviewState: 'not-applicable',
        sourceClearanceState: asset.ownershipOrLicence === 'approved' ? 'approved-for-public-use' : 'review-required',
        publicationState: asset.publicationState,
        destinationRoute: null,
        blockers: asset.blockers,
        nextAction: 'Resolve rights, clinical, accessibility, and publication review.',
      }))
    }
  }
  const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.glb', '.gltf'])
  for (const file of collectFiles(path.join(ROOT, 'public'), (item) => extensions.has(path.extname(item).toLowerCase()))) {
    const extension = path.extname(file).toLowerCase()
    const id = `visual-asset.public.${normaliseIdPart(relative(file))}`
    items.push(item({
      id,
      region: null,
      contentType: 'visual-asset',
      title: `Public visual asset ${path.basename(file)}`,
      file,
      sourceId: id,
      lifecycleState: 'active',
      clinicalReviewState: 'not-applicable',
      evidenceReviewState: 'not-applicable',
      sourceClearanceState: 'unknown',
      publicationState: 'blocked',
      destinationRoute: null,
      blockers: [
        `Asset type ${extension || 'unknown'} requires an explicit rights and accessibility registry decision.`,
      ],
      nextAction: 'Record ownership, licence, permitted use, alt text, and review decisions.',
    }))
  }
}

function item({
  id,
  region,
  contentType,
  title,
  file,
  sourceId,
  checksum = null,
  revision = '1',
  provenanceStatus = 'repository-tracked',
  lifecycleState,
  clinicalReviewState,
  evidenceReviewState,
  sourceClearanceState,
  publicationState,
  destinationRoute,
  duplicateOf = null,
  supersedes = [],
  supersededBy = [],
  blockers,
  nextAction,
}) {
  const repositoryPath = file ? relative(file) : null
  return {
    schemaVersion: 1,
    id,
    region,
    contentType,
    title,
    sources: [{
      sourceId,
      repositoryPath,
      checksum: checksum ?? sha256File(file),
      revision,
      provenanceStatus,
    }],
    lifecycleState,
    clinicalReviewState,
    evidenceReviewState,
    sourceClearanceState,
    publicationState,
    destinationRoute,
    duplicateOf,
    supersedes,
    supersededBy,
    blockers: [...new Set(blockers)].sort(),
    nextAction,
  }
}

function buildDependencyRiskRegister() {
  const risks = config.dependencyRisks.map((risk) => ({
    schemaVersion: 1,
    ...risk,
    installedVersion: packageVersion(lock, risk.packageName),
  })).sort((left, right) => left.riskId.localeCompare(right.riskId))
  return {
    schemaVersion: 1,
    observedOn: config.observedOn,
    sourceCommand: 'npm audit --json',
    automatedUpgradePerformed: false,
    historyRemediationHumanControlled: true,
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 11,
      critical: 0,
      total: 11,
    },
    risks,
  }
}

function buildGovernanceDashboard(inventory, dependencyRiskRegister) {
  const queue = (predicate) => inventory.items.filter(predicate).map((item) => item.id).sort()
  return {
    schemaVersion: 1,
    privateOnly: true,
    publicRoute: null,
    baselineCommit: inventory.baselineCommit,
    queues: {
      clinicalReview: queue((item) => ['required', 'blocked', 'stale'].includes(item.clinicalReviewState)),
      evidenceReview: queue((item) => ['required', 'blocked', 'stale'].includes(item.evidenceReviewState)),
      sourceClearance: queue((item) => !['approved-for-public-use', 'cleared-for-private-processing', 'not-applicable'].includes(item.sourceClearanceState)),
      staleApprovals: queue((item) => item.clinicalReviewState === 'stale' || item.evidenceReviewState === 'stale'),
      publicationBlockers: queue((item) => item.publicationState === 'blocked'),
      unaccountedLegacy: queue((item) =>
        item.contentType === 'legacy-station'
        && item.blockers.includes('Legacy source is not linked to a governed case or explicit disposition.'),
      ),
      contentDueForReview: [],
      dependencySecurity: dependencyRiskRegister.risks
        .filter((risk) => risk.status === 'open')
        .map((risk) => risk.riskId)
        .sort(),
    },
    notes: [
      'No due-date queue is inferred where an authoritative next-review date is absent.',
      'Queue membership is technical governance evidence, not clinical, evidence, legal, or publication approval.',
    ],
  }
}

function buildReviewQueues(inventory, risks) {
  const rows = [
    ['Clinical review', inventory.items.filter((item) => ['required', 'blocked', 'stale'].includes(item.clinicalReviewState)).length],
    ['Evidence review', inventory.items.filter((item) => ['required', 'blocked', 'stale'].includes(item.evidenceReviewState)).length],
    ['Source clearance', inventory.items.filter((item) => !['approved-for-public-use', 'cleared-for-private-processing', 'not-applicable'].includes(item.sourceClearanceState)).length],
    ['Publication blockers', inventory.items.filter((item) => item.publicationState === 'blocked').length],
    ['Unaccounted legacy', inventory.summary.unaccountedLegacyItems],
    ['Open dependency risks', risks.risks.filter((risk) => risk.status === 'open').length],
  ]
  return [
    '# Private Governance Review Queues',
    '',
    'This generated report is a private status surface. It does not grant clinical, evidence, source-clearance, legal, or publication approval.',
    '',
    '| Queue | Items |',
    '|---|---:|',
    ...rows.map(([label, count]) => `| ${label} | ${count} |`),
    '',
    'The machine-readable queue membership is in `governance-dashboard.json`.',
    '',
  ].join('\n')
}

function buildInventorySummary(inventory) {
  return [
    '# MSK Project Inventory Summary',
    '',
    `Baseline: \`${inventory.baselineCommit}\``,
    '',
    `Total governed inventory items: ${inventory.summary.total}.`,
    '',
    '## Content Types',
    '',
    '| Content type | Count |',
    '|---|---:|',
    ...Object.entries(inventory.summary.byContentType).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '## Publication States',
    '',
    '| State | Count |',
    '|---|---:|',
    ...Object.entries(inventory.summary.byPublicationState).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    `Unaccounted legacy stations: ${inventory.summary.unaccountedLegacyItems}.`,
    '',
    'Inventory presence is not approval. Review and source-clearance states remain independent and fail closed.',
    '',
  ].join('\n')
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function countBy(values, selector) {
  return Object.fromEntries(
    [...values.reduce((counts, value) => {
      const key = selector(value)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return counts
    }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

function getArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function formatIssues(label, issues) {
  return [
    `${label} failed validation:`,
    ...issues.map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`),
  ].join('\n')
}
