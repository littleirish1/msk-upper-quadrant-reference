import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const reviews = read('ai-manager/clinical-platform/reviews/review-ledger.json')
const gaps = read('content/evidence-hub/gaps/index.json')
const sources = read('ai-manager/clinical-platform/ingestion/register.json')
const quality = read('reports/clinical-platform/accessibility-mobile-performance.json')
const beta = read('reports/clinical-platform/beta-readiness.json')
const risks = read('reports/governance/dependency-risk-register.json')

const blockers = []
const add = (gate, target, humanControlled = true) => blockers.push({ blockerId: `${gate}:${target}`, gate, target, humanControlled, state: 'open' })

for (const review of reviews.reviews) {
  for (const decision of review.decisions.filter((item) => item.state !== 'approved')) {
    add('exact-revision-review', `${decision.reviewKind}:${review.target.exactRevisionKey}`)
  }
}
for (const gap of gaps.gaps.filter((item) => item.reviewState !== 'resolved')) add('evidence-gap', `${gap.gapId}@${gap.contentRevision}`)
for (const source of sources.sources.filter((item) => item.sourceClearance !== 'approved-public-use')) add('source-clearance', `${source.sourceId}@${source.revision}`)
for (const item of quality.manualMatrix) add('quality-sign-off', `${item.viewport}:${item.theme}`)
for (const item of beta.blockers) add('beta-governance', item)
for (const risk of risks.risks.filter((item) => item.status !== 'resolved')) add('dependency-security', risk.riskId, false)
add('independent-review', 'exact-final-commit')
add('publication', 'human-publication-decision')
blockers.sort((a, b) => a.blockerId.localeCompare(b.blockerId))

const blockerCounts = Object.fromEntries([...new Set(blockers.map((item) => item.gate))].sort().map((gate) => [gate, blockers.filter((item) => item.gate === gate).length]))
const digestInput = { reviews, gaps, sources, quality, beta, risks }
const candidateDigest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(digestInput)).digest('hex')}`
const candidate = {
  schemaVersion: 1,
  candidateId: 'release.v1-conversational-clinical-platform',
  candidateDigest,
  repositoryCommit: null,
  status: 'blocked',
  automatedValidationStatus: 'pending-final-exact-commit-validation',
  publicationApproved: false,
  deploymentAllowed: false,
  blockers,
  blockerCounts,
}
const dryRun = {
  schemaVersion: 1,
  candidateId: candidate.candidateId,
  outcome: 'blocked-before-publication',
  deploymentAttempted: false,
  pushAttempted: false,
  tagAttempted: false,
  evaluatedBlockerCount: blockers.length,
  stopReason: 'open-release-gates',
}

function write(relativePath, value) {
  const destination = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`)
}

write('ai-manager/clinical-platform/release/v1-release-candidate.json', candidate)
write('reports/clinical-platform/v1-release-dry-run.json', dryRun)
console.log(`V1 release dry run stopped safely: ${blockers.length} exact blockers across ${Object.keys(blockerCounts).length} gates; no publication action attempted.`)
