import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import {
  RELEASE_OUTPUTS,
  ROOT,
  loadProgrammeSchemas,
  readJson,
  stableJson,
  writeText,
} from './shared.mjs'

const outputArgument = process.argv.find((item) => item.startsWith('--output='))
const outputRoot = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : ROOT
const schemas = await loadProgrammeSchemas()
const inventory = readJson(path.join(ROOT, 'reports', 'governance', 'project-inventory.json'))
const gaps = readJson(path.join(ROOT, 'content', 'evidence-hub', 'gaps', 'index.json'))
const risks = readJson(path.join(ROOT, 'reports', 'governance', 'dependency-risk-register.json'))
const baseline = git('merge-base', 'main', 'HEAD')
const inputDigest = `sha256:${crypto.createHash('sha256')
  .update(stableJson({ inventory, gaps, risks }))
  .digest('hex')}`

const reviewableTypes = new Set(['condition', 'guided-case', 'anatomy', 'assessment', 'evidence-source', 'visual-asset'])
const domainByType = {
  condition: 'pathology',
  'guided-case': 'case-reasoning',
  anatomy: 'anatomy',
  assessment: 'mcq',
  'evidence-source': 'evidence-summary',
  'visual-asset': 'visual-asset',
}
const reviews = inventory.items
  .filter((item) => reviewableTypes.has(item.contentType))
  .map((item) => schemas.exactRevisionReviewSchema.parse({
    schemaVersion: 1,
    reviewId: `review.${item.id}`,
    targetId: item.id,
    targetRevision: item.sources[0].revision,
    targetChecksum: item.sources[0].checksum,
    domain: domainByType[item.contentType],
    reviewerRole: 'unassigned-human-reviewer',
    reviewerId: 'unassigned',
    reviewDate: null,
    decision: 'pending',
    limitations: ['No Programme 6 human decision has been recorded for this exact revision.'],
    nextReviewDate: null,
    stale: false,
  }))
  .sort((left, right) => left.reviewId.localeCompare(right.reviewId))
const reviewMatrix = schemas.exactRevisionReviewMatrixSchema.parse({ schemaVersion: 1, reviews })

const beta = schemas.betaFrameworkSchema.parse({
  schemaVersion: 1,
  status: 'planned',
  participantGroups: [
    'physiotherapy-student',
    'band-5-clinician',
    'experienced-msk-clinician',
    'clinical-educator',
  ],
  resultsRecorded: false,
  feedbackItems: [],
  consentReviewRequired: true,
  privacyReviewRequired: true,
  publicationApprovalGranted: false,
})

const publicationGovernance = {
  schemaVersion: 1,
  privateRepositoryRequired: true,
  publicRuntime: 'static-export',
  analyticsEnabled: false,
  cookiesRequired: false,
  learnerAccountsEnabled: false,
  learnerHealthDataStored: false,
  formsEnabled: false,
  privateToolsPubliclyRoutable: false,
  incidentAndTakedownReviewRequired: true,
  legalApprovalClaimed: false,
  humanPublicationDecisionRequired: true,
  protectedAreas: ['Evidence Hub', 'AI manager', 'source intake', 'authoring workspace', '3D prototype'],
}

const maintenance = {
  schemaVersion: 1,
  generatedFromInputDigest: inputDigest,
  reviewItemsPending: reviews.length,
  evidenceGapsOpen: gaps.gaps.filter((gap) => gap.reviewState !== 'resolved').length,
  dependencyRisksOpen: risks.risks.filter((finding) => finding.status !== 'resolved').length,
  checks: [
    'evidence-review-due',
    'clinical-review-due',
    'stale-approval',
    'dependency-update',
    'broken-link',
    'accessibility-regression',
    'search-and-route',
    'backup-review',
    'security-review',
    'feedback-triage',
    'content-retirement',
  ],
  automaticPublicationAllowed: false,
}

const candidate = schemas.releaseCandidateSchema.parse({
  schemaVersion: 1,
  candidateId: 'release.programmes-1-6-v1',
  baselineCommit: baseline,
  inputDigest,
  status: 'blocked',
  publicRouteCount: inventory.items.filter((item) => item.contentType === 'public-route').length,
  publishedCaseCount: inventory.items.filter((item) =>
    item.contentType === 'guided-case' && item.publicationState === 'public',
  ).length,
  draftCaseCount: inventory.items.filter((item) =>
    item.contentType === 'guided-case' && item.publicationState !== 'public',
  ).length,
  publicEvidenceHubRecordCount: 0,
  blockers: [
    { gate: 'clinical-review', count: reviews.length, humanControlled: true, summary: 'Exact-revision human review queue remains open.' },
    { gate: 'evidence-review', count: gaps.gaps.length, humanControlled: true, summary: 'Explicit Evidence Hub gaps remain unresolved.' },
    { gate: 'source-clearance', count: 1, humanControlled: true, summary: 'Source-clearance decisions remain outside automation.' },
    { gate: 'licensing', count: 1, humanControlled: true, summary: 'The private visual prototype has unknown rights.' },
    { gate: 'beta', count: 1, humanControlled: true, summary: 'No beta sessions or results are represented.' },
    { gate: 'security', count: Math.max(1, maintenance.dependencyRisksOpen), humanControlled: false, summary: 'Dependency risks require separate reviewed remediation.' },
    { gate: 'independent-review', count: 1, humanControlled: true, summary: 'This branch has not passed independent external review.' },
    { gate: 'publication', count: 1, humanControlled: true, summary: 'No human publication decision has been recorded.' },
  ],
  automatedValidationComplete: false,
  publicationApproved: false,
})

const summary = [
  '# Release Candidate Status',
  '',
  `- Candidate: ${candidate.candidateId}`,
  `- Input digest: ${candidate.inputDigest}`,
  `- Status: ${candidate.status}`,
  `- Human review queue: ${reviews.length}`,
  `- Evidence gaps: ${gaps.gaps.length}`,
  `- Dependency risks: ${maintenance.dependencyRisksOpen}`,
  '- Beta results: none recorded',
  '- Publication approval: not granted',
  '',
  'Automated validation cannot clear human-controlled gates.',
  '',
].join('\n')

const values = new Map([
  [RELEASE_OUTPUTS[0], stableJson(beta)],
  [RELEASE_OUTPUTS[1], stableJson(reviewMatrix)],
  [RELEASE_OUTPUTS[2], stableJson(maintenance)],
  [RELEASE_OUTPUTS[3], stableJson(publicationGovernance)],
  [RELEASE_OUTPUTS[4], stableJson(candidate)],
  [RELEASE_OUTPUTS[5], summary],
])
for (const [file, text] of values) writeText(outputRoot, file, text)
console.log(`Release governance generated. Reviews pending: ${reviews.length}; status: blocked.`)
if (process.argv.includes('--assert-candidate')) process.exit(2)

function git(...args) {
  const run = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', shell: false })
  if (run.status !== 0) throw new Error(run.stderr || run.stdout)
  return run.stdout.trim()
}
