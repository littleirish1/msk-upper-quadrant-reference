import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, sha256File, toPosix, writeJson } from './shared.mjs'

const schema = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'),
  path.join(ROOT, 'src'),
)

const manifestPath = path.join(ROOT, 'ai-manager', 'reports', 'source-intake-pilot', 'source-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const repositoryInputs = [
  { id: 'source.repository.shoulder.rotator-cuff-reference', path: 'content/shoulder/rotator-cuff-tendinopathy.mdx', type: 'published-condition-content', topics: ['rotator-cuff-related-shoulder-pain', 'assessment', 'management'] },
  { id: 'source.repository.shoulder.adhesive-capsulitis-reference', path: 'content/shoulder/adhesive-capsulitis.mdx', type: 'published-condition-content', topics: ['adhesive-capsulitis', 'assessment', 'management'] },
  { id: 'source.repository.shoulder.acromioclavicular-reference', path: 'content/shoulder/acromioclavicular-joint.mdx', type: 'published-condition-content', topics: ['acute-traumatic-presentation', 'acromioclavicular-presentation'] },
  { id: 'source.repository.shoulder.instability-reference', path: 'content/shoulder/shoulder-instability.mdx', type: 'published-condition-content', topics: ['shoulder-instability', 'assessment'] },
  { id: 'source.repository.shoulder.cervical-mimic-reference', path: 'content/cervical/cervical-radiculopathy.mdx', type: 'published-condition-content', topics: ['cervical-neurological-mimics', 'neurological-screen'] },
  { id: 'source.repository.shoulder.case-04', path: 'content/guided-cases/records/published/case.shoulder.case-04.json', type: 'published-guided-case-record', topics: ['rotator-cuff-related-shoulder-pain', 'guided-case'] },
  { id: 'source.repository.shoulder.case-05', path: 'content/guided-cases/records/published/case.shoulder.case-05.json', type: 'published-guided-case-record', topics: ['adhesive-capsulitis', 'guided-case'] },
]

const repositoryRecords = repositoryInputs.map((input) => {
  const file = path.join(ROOT, input.path)
  const isMdx = file.endsWith('.mdx')
  const value = isMdx ? matter(fs.readFileSync(file, 'utf8')) : JSON.parse(fs.readFileSync(file, 'utf8'))
  const title = isMdx ? value.data.title : value.neutralTitle
  const locators = isMdx
    ? fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n')
      .filter((line) => /^##\s+/.test(line))
      .map((line) => `${input.path}#${line.replace(/^##\s+/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)
    : [`${input.path}#learnerPresentation`, `${input.path}#reasoningStages`, `${input.path}#governance`]
  return {
    sourceId: input.id,
    sourceType: input.type,
    title,
    authors: [],
    year: null,
    identifiers: { doi: null, stableIdentifier: null },
    checksum: sha256File(file),
    locators,
    locatorStatus: 'exact-repository-locator',
    population: null,
    setting: 'learner-facing repository content',
    studyType: null,
    topics: input.topics,
    reviewState: 'baseline-carried-forward',
    sourceClearanceState: 'baseline-public-content',
    copyrightOrLicenceStatus: 'repository baseline use only; no external source rights inferred',
    limitations: [
      'This artefact can preserve existing reviewed public meaning but cannot establish a new evidence claim.',
      'Bibliographic identity and underlying source locators are not inferred from the published page.',
    ],
    duplicateGroupId: null,
    supersededBySourceId: null,
    carryForwardEligible: true,
    evidenceProcessingEligible: false,
    publicEvidenceEligible: false,
  }
})

const intakeRecords = manifest.records
  .filter((record) => record.sensitivity !== 'quarantined')
  .filter((record) => (record.regionTags ?? []).includes('shoulder') || (record.topicTags ?? []).some((tag) => /shoulder|rotator|subacromial|adhesive|instability/i.test(tag)))
  .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  .slice(0, 3)
  .map((record) => {
    const clearance = normaliseClearance(record)
    return {
      sourceId: record.sourceId,
      sourceType: record.sourceType || record.fileType || 'unknown',
      title: null,
      authors: [],
      year: null,
      identifiers: { doi: null, stableIdentifier: null },
      checksum: `sha256:${String(record.checksum).replace(/^sha256:/, '')}`,
      locators: [],
      locatorStatus: 'withheld-pending-clearance',
      population: null,
      setting: null,
      studyType: null,
      topics: [...new Set([...(record.regionTags ?? []), ...(record.topicTags ?? [])])].sort(),
      reviewState: clearance === 'restricted-pending-clearance' ? 'restricted-pending-clearance' : 'review-required',
      sourceClearanceState: clearance,
      copyrightOrLicenceStatus: record.copyrightOrLicenceStatus || 'unknown',
      limitations: [
        'Tracked metadata proves source identity and checksum only.',
        'Title, authors, year, identifiers, source locators and claims remain withheld or unknown pending source clearance and human review.',
      ],
      duplicateGroupId: record.duplicateGroup || null,
      supersededBySourceId: null,
      carryForwardEligible: false,
      evidenceProcessingEligible: clearance === 'cleared-for-private-evidence-processing',
      publicEvidenceEligible: false,
    }
  })

const records = [...repositoryRecords, ...intakeRecords]
const inventory = schema.shoulderSourceInventorySchema.parse({
  schemaVersion: 1,
  authority: 'governed-shoulder-source-inventory',
  privateAuthoringOnly: true,
  generatedFrom: [
    toPosix(path.relative(ROOT, manifestPath)),
    ...repositoryInputs.map((input) => input.path),
  ],
  records,
  summary: {
    total: records.length,
    repositoryBaseline: repositoryRecords.length,
    intakeMetadata: intakeRecords.length,
    evidenceProcessingEligible: records.filter((record) => record.evidenceProcessingEligible).length,
    publicEvidenceEligible: 0,
    titlesUnknown: records.filter((record) => record.title === null).length,
    locatorsWithheld: records.filter((record) => record.locatorStatus === 'withheld-pending-clearance').length,
  },
  governance: {
    clinicalApprovalCreated: false,
    evidenceApprovalCreated: false,
    sourceClearanceCreated: false,
    publicationApprovalCreated: false,
    sourceBodiesCopied: false,
    externalVerificationPerformed: false,
  },
})

const topicCoverage = [
  'shoulder-anatomy', 'rotator-cuff-related-shoulder-pain', 'adhesive-capsulitis',
  'instability', 'acute-traumatic-presentation', 'cervical-neurological-mimics',
  'red-flags', 'diagnostic-tests', 'movement-functional-limitation',
  'management-prognosis', 'patient-communication',
].map((topic) => ({
  topic,
  cataloguedSourceIds: records.filter((record) => record.topics.some((value) => value.includes(topic.split('-')[0]))).map((record) => record.sourceId).sort(),
  clearedForPrivateEvidenceProcessing: records.filter((record) => record.evidenceProcessingEligible && record.topics.includes(topic)).length,
  status: 'source-and-evidence-review-required',
  blocker: 'No selected source is cleared and reviewed for new evidence claims in this task.',
}))

writeJson(path.join(SHOULDER_ROOT, 'source-inventory.json'), inventory)
writeJson(path.join(SHOULDER_REPORT_ROOT, 'source-gap-report.json'), {
  schemaVersion: 1,
  authority: 'shoulder-source-gap-report',
  sourceCount: records.length,
  eligibleEvidenceSourceCount: inventory.summary.evidenceProcessingEligible,
  topicCoverage,
  claimsPermitted: 0,
  nextActions: [
    'Complete source-clearance review for selected intake records.',
    'Verify bibliographic metadata and exact locators without importing source bodies.',
    'Complete evidence appraisal and clinician review before drafting claims.',
  ],
})

const markdown = `# Shoulder source audit\n\n` +
  `- Governed sources inventoried: ${records.length}\n` +
  `- Repository baseline artefacts: ${repositoryRecords.length}\n` +
  `- Intake metadata records: ${intakeRecords.length}\n` +
  `- Cleared for private evidence processing: ${inventory.summary.evidenceProcessingEligible}\n` +
  `- New clinical claims permitted: 0\n` +
  `- External verification performed: no\n\n` +
  `The selected intake records are represented by source ID and checksum only. Private filenames, paths, locators and source bodies are not reproduced. Existing public repository artefacts may preserve their reviewed baseline meaning, but they do not approve a new Evidence Hub claim.\n`
fs.mkdirSync(SHOULDER_REPORT_ROOT, { recursive: true })
fs.writeFileSync(path.join(SHOULDER_REPORT_ROOT, 'source-audit.md'), markdown, 'utf8')

console.log(`Shoulder source audit generated: ${records.length} sources; ${inventory.summary.evidenceProcessingEligible} cleared for evidence processing; 0 claims permitted.`)

function normaliseClearance(record) {
  const candidates = [record.sensitivity, record.reviewStatus, ...(record.clearanceScopes ?? [])]
  if (candidates.includes('cleared-for-private-evidence-processing')) return 'cleared-for-private-evidence-processing'
  if (candidates.includes('restricted-pending-clearance') || candidates.includes('restricted')) return 'restricted-pending-clearance'
  if (candidates.includes('metadata-only')) return 'metadata-only'
  return 'review-required'
}
