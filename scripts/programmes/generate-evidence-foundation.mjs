import path from 'node:path'
import {
  EVIDENCE_HUB_OUTPUTS,
  ROOT,
  loadProgrammeSchemas,
  readJson,
  sha256File,
  stableJson,
  writeText,
} from './shared.mjs'

const outputArgument = process.argv.find((item) => item.startsWith('--output='))
const outputRoot = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : ROOT
const schemas = await loadProgrammeSchemas()
const inventory = readJson(path.join(ROOT, 'reports', 'governance', 'project-inventory.json'))

const eligibleContent = inventory.items
  .filter((item) =>
    ['condition', 'guided-case'].includes(item.contentType)
    && item.publicationState === 'public'
    && item.destinationRoute,
  )
  .sort((left, right) => left.id.localeCompare(right.id))

const gaps = eligibleContent.map((item) => ({
  schemaVersion: 1,
  gapId: `gap.${item.id}`,
  contentId: item.id,
  contentRevision: item.sources[0]?.revision ?? sha256File(path.join(ROOT, item.sources[0].repositoryPath)),
  gapTypes: [
    'missing-evidence-record',
    'missing-evidence-review',
    'missing-revision-pinned-relationship',
  ],
  lifecycleState: 'active',
  reviewState: 'recorded',
  publicEligibility: false,
  blockers: [
    'No approved Evidence Hub evidence record is pinned to this exact content revision.',
    'Evidence review remains a human-controlled gate.',
  ],
  nextAction: 'Create and independently review a revision-pinned evidence relationship.',
}))

const gapCatalog = schemas.evidenceGapCatalogSchema.parse({ schemaVersion: 1, gaps })
const surveillance = schemas.evidenceSurveillanceCatalogSchema.parse({
  schemaVersion: 1,
  adapters: [
    {
      adapterId: 'adapter.evidence.offline-fixture',
      mode: 'offline-fixture',
      enabled: false,
      networkRequired: false,
    },
  ],
  proposals: gaps.map((gap) => ({
    schemaVersion: 1,
    proposalId: `proposal.${gap.gapId}`,
    proposalType: 'evidence-gap-follow-up',
    targetContentIds: [gap.contentId],
    sourceRecordIds: [],
    previousVersionIds: [],
    proposedVersionIds: [],
    lifecycleState: 'draft',
    reviewState: 'required',
    publicEligibility: false,
    networkLookupCompleted: false,
    autonomousChangeAllowed: false,
    unresolvedQuestions: [
      'Which governed evidence record supports this exact content revision?',
      'Has an authorised reviewer approved the relationship and its limitations?',
    ],
  })),
})

const coverage = {
  schemaVersion: 1,
  generatedFrom: 'reports/governance/project-inventory.json',
  content: eligibleContent.map((item) => ({
    contentId: item.id,
    contentRevision: item.sources[0]?.revision ?? null,
    contentType: item.contentType,
    destinationRoute: item.destinationRoute,
    evidenceRelationshipCount: 0,
    evidenceGapIds: [`gap.${item.id}`],
    relationshipStatus: 'explicit-gap',
    publicEligibilityChanged: false,
  })),
  counts: {
    publicContent: eligibleContent.length,
    revisionPinnedEvidenceRelationships: 0,
    explicitEvidenceGaps: gaps.length,
    publicEvidenceHubRecords: 0,
  },
}

const gapSummary = [
  '# Evidence Gap Summary',
  '',
  'This private report records absence; it does not supply evidence or approval.',
  '',
  `- Public conditions and cases assessed: ${eligibleContent.length}`,
  `- Exact-revision evidence gaps: ${gaps.length}`,
  '- Approved revision-pinned Evidence Hub relationships: 0',
  '- Public Evidence Hub records: 0',
  '- Automatic clinical or evidence approval: prohibited',
  '',
].join('\n')

const surveillanceSummary = [
  '# Evidence Surveillance Summary',
  '',
  '- Mode: offline proposal generation',
  '- Network adapters enabled: 0',
  `- Review-required gap proposals: ${surveillance.proposals.length}`,
  '- Autonomous content changes: prohibited',
  '- Google Scholar: discovery documentation only; no scraping performed',
  '',
].join('\n')

const values = new Map([
  [EVIDENCE_HUB_OUTPUTS[0], stableJson(gapCatalog)],
  [EVIDENCE_HUB_OUTPUTS[1], stableJson(surveillance)],
  [EVIDENCE_HUB_OUTPUTS[2], gapSummary],
  [EVIDENCE_HUB_OUTPUTS[3], stableJson(coverage)],
  [EVIDENCE_HUB_OUTPUTS[4], surveillanceSummary],
])
for (const [file, text] of values) writeText(outputRoot, file, text)

console.log(`Evidence gaps generated: ${gaps.length}; approved relationships: 0; public Hub records: 0.`)
