import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  ROOT,
  assertNoPrivateAbsolutePath,
  collectFiles,
  canonicalFileByteSize,
  loadProgrammeSchemas,
  normaliseIdPart,
  readJson,
  relative,
  sha256File,
  stableJson,
  writeText,
} from './shared.mjs'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const outputRoot = getArgument('--output-root') ?? ROOT
const schemas = await loadProgrammeSchemas()
const policyFile = path.join(ROOT, 'content', 'curriculum', 'upper-quadrant-production-policy.json')
const mcqPlanFile = path.join(ROOT, 'content', 'assessment', 'mcq-plan.json')
const mcqExampleFile = path.join(ROOT, 'content', 'assessment', 'private', 'mcq-contract-example.json')
const branchFile = path.join(ROOT, 'content', 'learning', 'private', 'branching-reasoning-example.json')
const sourceRegistryFile = path.join(ROOT, 'content', 'imports', 'source-registry.json')
const stationIndexFile = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'extracted', 'station-index.json')
const domainMatchers = {
  'functional-anatomy': /anatomy|pathophysiology/i,
  'landmarks-palpation': /landmark|palpation/i,
  'muscle-roles': /muscle|movement|biomechan/i,
  presentation: /presentation|symptom|clinical feature/i,
  'subjective-assessment': /subjective|history|questions/i,
  'objective-assessment': /objective|physical examination|assessment/i,
  'neurological-screening': /neurolog|myotome|dermatome|reflex/i,
  'special-tests': /special test|test cluster|provocative test/i,
  'differential-diagnoses': /differential/i,
  'red-flags-escalation': /red flag|safety|referral/i,
  imaging: /imaging|investigation/i,
  management: /management|treatment|rehabilitation/i,
  'prognosis-reassessment': /prognosis|reassessment|outcome/i,
  'patient-communication': /communication|education|advice/i,
  references: /reference|evidence base/i,
  'evidence-limitations': /limitation|uncertainty/i,
}
const policy = schemas.upperQuadrantProductionPolicySchema.parse(readJson(policyFile))
const mcqPlan = schemas.mcqPlanSchema.parse(readJson(mcqPlanFile))
schemas.governedMcqSchema.parse(readJson(mcqExampleFile))
schemas.branchingCaseModelSchema.parse(readJson(branchFile))

const taxonomyModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'data', 'taxonomy.ts'),
  path.join(ROOT, 'src'),
)
const publicConditionModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'publicConditions.ts'),
  path.join(ROOT, 'src'),
)

const upperQuadrant = buildUpperQuadrantReport()
const legacyBatches = buildLegacyBatchCatalog()
const legacyReadiness = buildLegacyReadiness(legacyBatches)
const regionCurriculum = buildRegionCurriculum()
const mcqSummary = buildMcqSummary()
const summary = renderSummary()

for (const [label, value] of [
  ['upper-quadrant production report', upperQuadrant],
  ['legacy batch catalogue', legacyBatches],
  ['legacy batch readiness', legacyReadiness],
  ['region curriculum', regionCurriculum],
  ['MCQ summary', mcqSummary],
  ['content production summary', summary],
]) assertNoPrivateAbsolutePath(value, label)

const batchResult = schemas.legacyCaseBatchCatalogSchema.safeParse(legacyBatches)
if (!batchResult.success) {
  throw new Error(formatIssues('legacy batch catalogue', batchResult.error.issues))
}

writeText(outputRoot, 'reports/programmes/upper-quadrant-production.json', stableJson(upperQuadrant))
writeText(outputRoot, 'reports/programmes/legacy-case-batches.json', stableJson(legacyBatches))
writeText(outputRoot, 'reports/programmes/legacy-case-readiness.json', stableJson(legacyReadiness))
writeText(outputRoot, 'reports/programmes/full-region-curriculum.json', stableJson(regionCurriculum))
writeText(outputRoot, 'reports/programmes/mcq-governance-summary.json', stableJson(mcqSummary))
writeText(outputRoot, 'reports/programmes/content-production-summary.md', summary)

console.log(`Upper-quadrant production report: ${upperQuadrant.conditions.length} conditions.`)
console.log(`Legacy batch plan: ${legacyBatches.batches.length} batches, ${legacyBatches.heldUnbatchedStationIds.length} held unbatched.`)
console.log(`MCQ plan: ${mcqSummary.plannedSlots} review-required slots, ${mcqSummary.publicQuestions} public questions.`)

function buildUpperQuadrantReport() {
  const conditions = publicConditionModule.getPublicConditionRecords().map((record) => {
    const raw = fs.readFileSync(record.filePath, 'utf8')
    const parsed = matter(raw)
    const content = parsed.content
    const headings = [...content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim())
    const presentDomains = policy.requiredDomains.filter((domain) =>
      headings.some((heading) => domainMatchers[domain].test(heading)),
    )
    const missingDomains = policy.requiredDomains.filter((domain) => !presentDomains.includes(domain))
    const blankSections = findBlankSections(content)
    const issues = [
      ...missingDomains.map((domain) => `Review-required structural gap: ${domain}.`),
      ...blankSections.map((heading) => `Blank authored section: ${heading}.`),
    ]
    if (/\bBASH\b/i.test(content)) {
      issues.push('Headache timing wording requires source-specific evidence and clinician review.')
    }
    return {
      contentId: parsed.data.contentId ?? `condition.${record.region}.${record.condition}`,
      region: record.region,
      slug: record.condition,
      route: `/${record.region}/${record.condition}`,
      sourcePath: relative(record.filePath),
      sourceChecksum: sha256File(record.filePath),
      presentDomains,
      missingDomains,
      blankSections,
      referenceMarkers: countReferenceMarkers(content),
      clinicalReviewState: parsed.data.clinicianReviewStatus ?? 'baseline-not-recorded',
      evidenceRelationshipState: 'gap-record-required',
      publicBaselinePreserved: true,
      substantiveChangeAllowedWithoutHumanReview: false,
      issues,
    }
  }).sort((left, right) =>
    left.region.localeCompare(right.region) || left.slug.localeCompare(right.slug),
  )
  return {
    schemaVersion: 1,
    policySource: relative(policyFile),
    canonicalTaxonomySource: policy.canonicalTaxonomySource,
    generatedClinicalContent: false,
    conditions,
    summary: {
      conditionCount: conditions.length,
      conditionsWithStructuralGaps: conditions.filter((condition) => condition.missingDomains.length > 0).length,
      blankSectionCount: conditions.reduce((sum, condition) => sum + condition.blankSections.length, 0),
      conditionsWithRecordedClinicianReview: conditions.filter((condition) =>
        condition.clinicalReviewState !== 'baseline-not-recorded'
      ).length,
      totalReferenceMarkers: conditions.reduce((sum, condition) => sum + condition.referenceMarkers, 0),
    },
  }
}

function buildLegacyBatchCatalog() {
  const sourceRegistry = readJson(sourceRegistryFile)
  const stationIndex = readJson(stationIndexFile)
  const stationById = new Map(stationIndex.stations.map((station) => [station.id, station]))
  const conditionByNormalisedTitle = new Map(
    taxonomyModule.REGIONS.flatMap((region) =>
      region.conditions.map((condition) => [
        normaliseComparison(condition.label),
        `condition.${region.slug}.${condition.slug}`,
      ]),
    ),
  )
  const pending = sourceRegistry.sources
    .filter((source) => source.sourceStatus === 'pending-review')
    .sort((left, right) => numericStation(left.sourceId) - numericStation(right.sourceId))
  const sizes = batchSizes(pending.length)
  const batches = []
  let offset = 0
  for (const [index, size] of sizes.entries()) {
    const sources = pending.slice(offset, offset + size)
    offset += size
    const records = sources.map((source) => {
      const station = stationById.get(source.sourceId)
      const duplicateTarget = station
        ? conditionByNormalisedTitle.get(normaliseComparison(station.title)) ?? null
        : null
      return {
        stationId: source.sourceId,
        proposedRegion: station?.suggestedRegion && station.suggestedRegion !== 'unknown'
          ? station.suggestedRegion
          : null,
        classification: duplicateTarget ? 'duplicate-merge-candidate' : 'awaiting-source-clearance',
        sourceExtractionStatus: 'repository-extracted-not-reviewed',
        anonymisationStatus: 'required',
        schemaMappingStatus: 'not-started',
        publicEligibility: false,
        blockers: [
          ...(duplicateTarget ? [`Potential overlap requires comparison with ${duplicateTarget}.`] : []),
          'Source clearance is not established.',
          'Clinical and evidence review have not started.',
          'No governed draft has been generated.',
        ],
      }
    })
    batches.push({
      batchId: `legacy-batch.programme-2.${String(index + 1).padStart(2, '0')}`,
      status: 'planned-private-review',
      stationIds: records.map((record) => record.stationId),
      records,
    })
  }
  return {
    schemaVersion: 1,
    sourceId: 'legacy-html-case-bank-v1',
    batchSizePolicy: { minimum: 3, maximum: 5 },
    batches,
    heldUnbatchedStationIds: pending.slice(offset).map((source) => source.sourceId),
  }
}

function buildRegionCurriculum() {
  const live = taxonomyModule.REGIONS.map((region) => ({
    regionId: `region.${region.slug}`,
    slug: region.slug,
    label: region.label,
    lifecycleState: 'active',
    routeState: 'live',
    conditionCount: region.conditions.length,
    contentTemplate: 'content/_TEMPLATE/overview.mdx',
    publicEligibility: true,
    blockers: [],
  }))
  const planned = taxonomyModule.PLANNED_REGIONS.map((region) => {
    const planPath = path.join(ROOT, 'content', 'plans', 'regions', `${region.slug}.json`)
    return {
      regionId: `region.${region.slug}`,
      slug: region.slug,
      label: region.label,
      lifecycleState: 'planned',
      routeState: 'roadmap-only',
      conditionCount: 0,
      contentTemplate: 'content/_TEMPLATE/overview.mdx',
      planSource: relative(planPath),
      planChecksum: sha256File(planPath),
      publicEligibility: false,
      blockers: [
        'No reviewed public condition library exists.',
        'Clinical, evidence, source-clearance, route, Search, and publication review remain required.',
      ],
    }
  })
  return {
    schemaVersion: 1,
    canonicalTaxonomySource: 'src/data/taxonomy.ts',
    separateRuntimeStackCreated: false,
    regions: [...live, ...planned].sort((left, right) => left.slug.localeCompare(right.slug)),
    publicPlannedRoutes: 0,
  }
}

function buildLegacyReadiness(batchCatalog) {
  const stationsDirectory = path.join(
    ROOT,
    'content',
    'imports',
    'html-case-bank',
    'extracted',
    'stations',
  )
  const hygienePolicy = readJson(path.join(ROOT, 'ai-manager', 'content-hygiene-names.json'))
  const governedTerms = hygienePolicy.termsToFlag.map((term) => String(term).toLowerCase())
  const records = batchCatalog.batches.flatMap((batch) =>
    batch.stationIds.map((stationId) => {
      const matches = fs.readdirSync(stationsDirectory)
        .filter((name) => name.startsWith(`${stationId}-`) && name.endsWith('.md'))
      if (matches.length !== 1) throw new Error(`expected one extracted source for ${stationId}`)
      const file = path.join(stationsDirectory, matches[0])
      const source = fs.readFileSync(file, 'utf8')
      const lower = source.toLowerCase()
      const governedNameMatchCount = governedTerms.reduce(
        (count, term) => count + countOccurrences(lower, term),
        0,
      )
      return {
        stationId,
        batchId: batch.batchId,
        sourceChecksum: sha256File(file),
        sourceByteSize: canonicalFileByteSize(file),
        sourceBodyStoredInReport: false,
        privatePathStored: false,
        governedNameMatchCount,
        sourceIdentityMarkerCount: /^#\s+.+$/m.test(source) ? 1 : 0,
        mappedFieldAvailability: {
          subjectiveOrHistory: /^(?:##|###|\*\*)[^\n]*(?:history|subjective|presentation)/im.test(source),
          objectiveOrExamination: /^(?:##|###|\*\*)[^\n]*(?:objective|examination|findings)/im.test(source),
          differentialReasoning: /^(?:##|###|\*\*)[^\n]*differential/im.test(source),
          redFlagOrSafety: /^(?:##|###|\*\*)[^\n]*(?:red flag|safety|referral)/im.test(source),
          investigation: /^(?:##|###|\*\*)[^\n]*(?:investigation|imaging)/im.test(source),
          management: /^(?:##|###|\*\*)[^\n]*(?:management|treatment|rehabilitation)/im.test(source),
          references: /^(?:##|###|\*\*)[^\n]*(?:reference|evidence)/im.test(source),
        },
        anonymisationStatus: 'required',
        clinicalMappingStatus: 'not-started-human-review-required',
        publicEligibility: false,
        blockers: [
          'Source identity markers require redaction before derivative drafting.',
          'Clinical mapping and source sufficiency require human review.',
          'Evidence and source clearance are not established.',
        ],
      }
    }),
  )
  return {
    schemaVersion: 1,
    sourceId: 'legacy-html-case-bank-v1',
    records: records.sort((left, right) => numericStation(left.stationId) - numericStation(right.stationId)),
    summary: {
      sourcesChecked: records.length,
      sourceBodiesStored: 0,
      publicEligible: 0,
      governedNameMatchesReportedAsCountsOnly: records.reduce(
        (sum, record) => sum + record.governedNameMatchCount,
        0,
      ),
      recordsRequiringAnonymisation: records.filter((record) =>
        record.sourceIdentityMarkerCount > 0 || record.governedNameMatchCount > 0
      ).length,
    },
  }
}

function buildMcqSummary() {
  const example = readJson(mcqExampleFile)
  return {
    schemaVersion: 1,
    targetDecision: mcqPlan.scopeDecision,
    targetCount: mcqPlan.targetCount,
    plannedSlots: mcqPlan.slots.length,
    authoredGovernedExamples: 1,
    publicQuestions: 0,
    publicEligibility: false,
    exampleId: example.id,
    answerRevealPolicy: example.answerRevealPolicy,
    competenceClaimAllowed: example.competenceClaimAllowed,
    blockers: [
      'The 20-item baseline is an authoring plan, not completed clinical content.',
      'Every clinical question requires evidence, source clearance, clinical review, and exact-revision publication approval.',
    ],
  }
}

function renderSummary() {
  return [
    '# Programme 2 Content Production Summary',
    '',
    'This report describes governed production capability. It does not certify clinical completeness or approve publication.',
    '',
    `- Upper-quadrant conditions reconciled: ${upperQuadrant.conditions.length}`,
    `- Conditions with recommended structural gaps: ${upperQuadrant.summary.conditionsWithStructuralGaps}`,
    `- Blank authored condition sections: ${upperQuadrant.summary.blankSectionCount}`,
    `- Remaining legacy stations assigned to controlled batches: ${legacyBatches.batches.reduce((sum, batch) => sum + batch.stationIds.length, 0)}`,
    `- Controlled batches: ${legacyBatches.batches.length}`,
    `- Planned lower-quadrant/spinal regions: ${regionCurriculum.regions.filter((region) => !region.publicEligibility).length}`,
    `- MCQ authoring target: ${mcqSummary.plannedSlots}`,
    `- Public new MCQs: ${mcqSummary.publicQuestions}`,
    '',
    'No clinical facts, model answers, evidence approvals, source clearances, routes, or publication decisions were generated.',
    '',
  ].join('\n')
}

function findBlankSections(content) {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)]
  return matches.filter((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? content.length
    const body = content.slice(start, end)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    return body.length === 0
  }).map((match) => match[1].trim())
}

function countReferenceMarkers(content) {
  const doi = content.match(/\b10\.\d{4,9}\/[\w.()/:;-]+/gi)?.length ?? 0
  const links = content.match(/https?:\/\//gi)?.length ?? 0
  const referenceLines = content.match(/^\s*(?:\d+\.|-\s+).*(?:19|20)\d{2}/gm)?.length ?? 0
  return doi + links + referenceLines
}

function batchSizes(total) {
  if (total === 0) return []
  if (total < 3) return []
  const sizes = []
  let remaining = total
  while (remaining > 0) {
    if (remaining <= 5 && remaining >= 3) {
      sizes.push(remaining)
      break
    }
    if (remaining === 6) {
      sizes.push(3, 3)
      break
    }
    if (remaining === 7) {
      sizes.push(4, 3)
      break
    }
    sizes.push(5)
    remaining -= 5
  }
  return sizes
}

function numericStation(value) {
  return Number(String(value).replace(/\D+/g, ''))
}

function normaliseComparison(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function countOccurrences(source, term) {
  if (!term) return 0
  let count = 0
  let index = 0
  while ((index = source.indexOf(term, index)) >= 0) {
    count++
    index += term.length
  }
  return count
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
