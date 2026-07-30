import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  canonicalCaseHash,
  PUBLIC_REGISTRY_FILE,
  RECORDS_DIR,
  ROOT,
  fileCanonicalTextSha256,
  loadGuidedCaseModule,
  readJson,
  stableJson,
} from './shared.mjs'

const CASES_DIR = path.join(ROOT, 'content', 'cases')
const PILOT_FILE = path.join(ROOT, 'content', 'guided-cases', 'pilot-definitions.json')
const STATIONS_DIR = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'extracted', 'stations')
const PUBLIC = [
  ['cervical/cervical-radiculopathy-case-01.mdx', 'case.cervical.case-01', 'Case 01', 'Neck and arm symptoms'],
  ['cervical/early-degenerative-cervical-myelopathy-case-01.mdx', 'case.cervical.case-02', 'Case 02', 'Hand clumsiness and heavy legs'],
  ['elbow/distal-biceps-rupture-case-01.mdx', 'case.elbow.case-03', 'Case 03', 'Sudden anterior elbow pain after lifting'],
  ['shoulder/rcrsp-case-01.mdx', 'case.shoulder.case-04', 'Case 04', 'Lateral shoulder pain with overhead activity'],
  ['shoulder/adhesive-capsulitis-case-01.mdx', 'case.shoulder.case-05', 'Case 05', 'Progressive shoulder stiffness'],
  ['thoracic/visceral-referral-mimicking-thoracic-msk-case-01.mdx', 'case.thoracic.case-06', 'Case 06', 'Thoracic pain with broader screening cues'],
]

const records = PUBLIC.map(([relativePath, caseId, learnerCaseNumber, neutralTitle]) => {
  const file = path.join(CASES_DIR, relativePath)
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = matter(raw)
  const frontmatter = parsed.data
  const region = relativePath.split('/')[0]
  const stages = extractStages(parsed.content, relativePath)
  const record = {
    schemaVersion: 2,
    caseId,
    learnerCaseNumber,
    neutralTitle,
    region,
    publicSlug: frontmatter.publicSlug,
    contentRevision: 1,
    contentHash: '0'.repeat(64),
    lifecycleState: 'published',
    publicationEligibility: true,
    ...(frontmatter.difficulty ? { difficulty: frontmatter.difficulty } : {}),
    ...(frontmatter.estimatedTime ? { estimatedTime: frontmatter.estimatedTime } : {}),
    privateDiagnosticIdentity: {
      internalTitle: frontmatter.title,
      likelyDiagnosis: titleCase(frontmatter.condition),
      associatedConditionId: frontmatter.condition,
      evidenceHubConditionId: null,
      privateLearningFocus: frontmatter.learningFocus ?? [],
      internalSourceStationId: frontmatter.sourceId ?? null,
    },
    learnerPresentation: {
      initialPresentation: extractPresentation(parsed.content),
      aggravatingFactors: [],
      easingFactors: [],
      stagedDisclosure: [],
    },
    reasoningStages: stages,
    governance: {
      authoringStatus: 'approved',
      clinicalReviewStatus: 'baseline-reviewed',
      evidenceReviewStatus: 'baseline-preserved',
      sourceClearanceStatus: 'baseline-public-content',
      reviewerRole: 'existing reviewed baseline',
      reviewDate: frontmatter.lastReviewed ?? null,
      nextReviewDate: null,
      unresolvedIssues: [],
      knownLimitations: [
        'This migration preserves the reviewed baseline and does not constitute new clinical approval.',
        'Evidence Hub relationships remain unresolved until governed records exist.',
      ],
      publicationDecision: {
        status: 'baseline-carried-forward',
        approvedRevision: 1,
        approvedContentHash: '0'.repeat(64),
        rationale: 'Existing reviewed public case carried forward without changing clinical meaning.',
      },
    },
    provenance: {
      sourceRecordIds: frontmatter.sourceId ? [frontmatter.sourceId] : [],
      legacySourceId: frontmatter.sourceType === 'legacy-html-case-bank'
        ? 'legacy-html-case-bank-v1'
        : null,
      sourceType: frontmatter.sourceType ?? 'existing-public-mdx',
      extractionDate: null,
      sourceRevisionOrHash: fileCanonicalTextSha256(file),
      citationReferenceIds: [],
      transformationHistory: [{
        action: 'governed-schema-migration',
        detail: 'Mapped the existing reviewed case to v2 without changing clinical meaning.',
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
      unresolvedEvidenceGaps: [
        'No approved Evidence Hub condition or evidence record is available for this case.',
      ],
    },
  }
  pinHash(record)
  return record
})

const pilotDefinitions = readJson(PILOT_FILE).pilots
for (const [pilotIndex, pilot] of pilotDefinitions.entries()) {
  const sourceFile = findStationFile(pilot.sourceStationId)
  const record = {
    schemaVersion: 2,
    caseId: pilot.caseId,
    learnerCaseNumber: pilot.learnerCaseNumber,
    neutralTitle: pilot.neutralTitle,
    region: pilot.region,
    publicSlug: pilot.publicSlug,
    contentRevision: 1,
    contentHash: '0'.repeat(64),
    lifecycleState: 'draft',
    publicationEligibility: false,
    difficulty: pilot.difficulty,
    estimatedTime: pilot.estimatedTime,
    privateDiagnosticIdentity: {
      internalTitle: `Legacy pilot ${pilot.sourceStationId}`,
      likelyDiagnosis: pilot.likelyDiagnosis,
      associatedConditionId: pilot.associatedConditionId,
      evidenceHubConditionId: null,
      privateLearningFocus: ['Legacy conversion pilot', 'Clinical reasoning structure'],
      internalSourceStationId: pilot.sourceStationId,
    },
    learnerPresentation: {
      initialPresentation: pilot.initialPresentation,
      aggravatingFactors: [],
      easingFactors: [],
      stagedDisclosure: [],
    },
    reasoningStages: pilot.stages.map((stage, stageIndex) => ({
      ...stage,
      order: stageIndex + 1,
      expectedReasoningThemes: [],
      modelReasoningChecklist: [],
      commonPitfalls: [],
      feedback: 'Source-supported model reasoning has not yet been clinically and evidentially reviewed.',
      revealState: 'public-after-reveal',
      humanReviewRequired: true,
    })),
    governance: {
      authoringStatus: 'draft',
      clinicalReviewStatus: 'clinician-review-required',
      evidenceReviewStatus: 'evidence-review-required',
      sourceClearanceStatus: 'source-clearance-required',
      reviewerRole: null,
      reviewDate: null,
      nextReviewDate: null,
      unresolvedIssues: [
        'Clinical reasoning and safety statements require clinician review.',
        'Citations and evidence claims in the legacy source require independent verification.',
        'Source clearance for derivative publication has not been established.',
      ],
      knownLimitations: [
        pilot.selectionRationale,
        'Missing model answers are intentionally not invented.',
      ],
      publicationDecision: {
        status: 'blocked',
        approvedRevision: null,
        approvedContentHash: null,
        rationale: 'Mechanically converted pilot; human clinical, evidence and source-clearance review are required.',
      },
    },
    provenance: {
      sourceRecordIds: [pilot.sourceStationId],
      legacySourceId: 'legacy-html-case-bank-v1',
      sourceType: 'legacy-html-case-bank',
      extractionDate: null,
      sourceRevisionOrHash: fileCanonicalTextSha256(sourceFile),
      citationReferenceIds: [],
      transformationHistory: [
        {
          action: 'personal-identifier-redaction',
          detail: 'Removed the source display name and retained only clinically relevant anonymised attributes.',
          reviewRequired: true,
        },
        {
          action: 'structured-draft-conversion',
          detail: 'Mapped source-supported presentation facts into the governed draft structure without filling evidence gaps.',
          reviewRequired: true,
        },
      ],
      aiAssisted: true,
      humanEdited: false,
    },
    evidenceHub: {
      conditionRecordId: null,
      evidenceRecordIds: [],
      relationshipIds: [],
      reviewDecisionId: null,
      pinnedCaseRevision: 1,
      pinnedCaseHash: '0'.repeat(64),
      unresolvedEvidenceGaps: [
        'No governed Evidence Hub condition record exists for this pilot.',
        'No source citation has been verified into an approved Evidence Hub evidence record.',
      ],
    },
  }
  void pilotIndex
  pinHash(record)
  records.push(record)
}

fs.rmSync(RECORDS_DIR, { recursive: true, force: true })
for (const record of records.sort((left, right) => left.caseId.localeCompare(right.caseId))) {
  const folder = record.publicationEligibility ? 'published' : 'drafts'
  const directory = path.join(RECORDS_DIR, folder)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, `${record.caseId}.json`), stableJson(record), 'utf8')
}

const { createPublicImmediateCase, guidedCaseRecordSchema } = await loadGuidedCaseModule()
const publicRegistry = records
  .filter((record) => record.publicationEligibility)
  .map((record) => createPublicImmediateCase(guidedCaseRecordSchema.parse(record)))
  .sort((left, right) => left.learnerCaseNumber.localeCompare(right.learnerCaseNumber))
fs.mkdirSync(path.dirname(PUBLIC_REGISTRY_FILE), { recursive: true })
fs.writeFileSync(PUBLIC_REGISTRY_FILE, stableJson(publicRegistry), 'utf8')

console.log(`Generated governed guided-case records: ${records.length}.`)
console.log(`Published baseline records: ${records.filter((record) => record.publicationEligibility).length}.`)
console.log(`New private pilot records: ${pilotDefinitions.length}.`)

function pinHash(record) {
  const hash = canonicalCaseHash(record)
  record.contentHash = hash
  record.evidenceHub.pinnedCaseHash = hash
  if (record.publicationEligibility) {
    record.governance.publicationDecision.approvedContentHash = hash
  }
}

function findStationFile(stationId) {
  const matches = fs.readdirSync(STATIONS_DIR)
    .filter((name) => name.startsWith(`${stationId}-`) && name.endsWith('.md'))
  if (matches.length !== 1) throw new Error(`Expected exactly one extracted source for ${stationId}`)
  return path.join(STATIONS_DIR, matches[0])
}

function extractPresentation(content) {
  const start = content.search(/^## Case presentation\s*$/im)
  const source = start >= 0
    ? content.slice(start).replace(/^## Case presentation\s*$/im, '')
    : content.replace(/^#\s+.+(?:\r?\n)+/m, '')
  const end = source.search(/^(?:##\s+|<ReasoningPrompt\b)/m)
  return markdownToText(end >= 0 ? source.slice(0, end) : source)
}

function extractStages(content, sourceLabel) {
  const prompts = [...content.matchAll(/<ReasoningPrompt\s+question="([^"]+)"\s*\/>/gu)]
  const stages = []
  for (const [index, match] of prompts.entries()) {
    const body = content.slice(match.index + match[0].length, prompts[index + 1]?.index ?? content.length)
    const preceding = content.slice(0, match.index)
    const heading = [...preceding.matchAll(/^##\s+(.+)$/gm)].at(-1)?.[1] ?? `Reasoning prompt ${index + 1}`
    const reveal = /<RevealAnswer(?:\s+[^>]*)?>([\s\S]*?)<\/RevealAnswer>/u.exec(body)?.[1] ?? ''
    const checklist = reveal.split(/\r?\n/)
      .filter((line) => /^\s*-\s+/.test(line))
      .map((line) => markdownToText(line.replace(/^\s*-\s+/, '')))
      .filter(Boolean)
    const type = stageType(`${heading} ${match[1]}`)
    stages.push({
      id: `${type}-${stages.length + 1}`,
      type,
      order: stages.length + 1,
      learnerQuestion: match[1],
      expectedReasoningThemes: checklist.slice(0, 4),
      modelReasoningChecklist: checklist,
      commonPitfalls: [],
      feedback: checklist.length
        ? 'Compare the reasoning themes with the case information rather than treating them as a rigid marking rubric.'
        : 'Use the existing reviewed reveal discussion for comparison.',
      revealState: 'public-after-reveal',
      sourceSectionHeading: heading.trim(),
      humanReviewRequired: false,
    })
  }
  if (stages.length === 0) throw new Error(`Published case has no reasoning stages: ${sourceLabel}`)
  return stages
}

function stageType(heading) {
  const value = heading.toLowerCase()
  if (value.includes('differential')) return 'differential-diagnosis'
  if (value.includes('red flag') || value.includes('concern')) return 'red-flag-escalation'
  if (value.includes('objective') || value.includes('finding')) return 'objective-assessment'
  if (value.includes('management')) return 'management-reasoning'
  if (value.includes('referral')) return 'referral-threshold'
  if (value.includes('communication')) return 'patient-communication'
  return 'initial-hypothesis'
}

function markdownToText(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value) {
  return String(value).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
