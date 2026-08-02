import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
const candidate = read('ai-manager/clinical-platform/release/v1-release-candidate.json')
const dryRun = read('reports/clinical-platform/v1-release-dry-run.json')
const queues = read('reports/clinical-platform/review-queues.json')

assert.equal(candidate.status, 'blocked')
assert.equal(candidate.repositoryCommit, null)
assert.equal(candidate.publicationApproved, false)
assert.equal(candidate.deploymentAllowed, false)
assert.match(candidate.candidateDigest, /^sha256:[a-f0-9]{64}$/)
assert.equal(candidate.blockerCounts['exact-revision-review'], queues.total)
for (const queued of queues.queue) {
  assert.ok(candidate.blockers.some((blocker) => blocker.target === `${queued.reviewKind}:${queued.target.exactRevisionKey}`))
}
for (const gate of ['evidence-gap', 'source-clearance', 'quality-sign-off', 'beta-governance', 'dependency-security', 'independent-review', 'publication']) {
  assert.ok(candidate.blockerCounts[gate] > 0, `missing ${gate}`)
}
assert.equal(dryRun.evaluatedBlockerCount, candidate.blockers.length)
assert.equal(dryRun.outcome, 'blocked-before-publication')
assert.equal(dryRun.deploymentAttempted || dryRun.pushAttempted || dryRun.tagAttempted, false)
console.log(`V1 release candidate tests passed: ${candidate.blockers.length} blockers, all ${queues.total} review decisions traced, publication fails closed.`)
