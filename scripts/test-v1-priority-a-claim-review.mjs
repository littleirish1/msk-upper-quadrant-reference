import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { canonicalizePriorityAClaims } from '../ai-manager/private-review-portal/v1-claim-canonicalization.mjs'
import { AUTHORITATIVE_V1_SOURCES, createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'
import { buildPriorityAClaimReviewPacket, renderPriorityAClaimReviewMarkdown, writePriorityAClaimReviewPacket } from './generate-v1-priority-a-claim-review.mjs'

const root = process.cwd()
const audit = createV1ClinicalEvidenceAudit(root, loadV1ConditionReviewRecords(root))
const canonical = audit.canonicalReview
assert.equal(canonical.rawTaskCount, 395)
assert.equal(canonical.canonicalClaimCount, canonical.canonicalClaims.length)
assert.equal(canonical.collapsedTaskCount, 395 - canonical.canonicalClaimCount)
assert.equal(canonical.allRawTasksRepresented, true)
assert.ok(canonical.canonicalClaimCount < 395)
assert.equal(canonical.humanReviewRemaining, canonical.canonicalClaimCount)
assert.ok(canonical.evidenceMappedAutomatically > 0)
assert.equal(canonical.canonicalClaims.filter((claim) => claim.claimSourceRelationshipVerified).length, canonical.evidenceMappedAutomatically)

const allRaw = audit.conditions.flatMap((condition) => condition.priorityAClaims)
const represented = canonical.canonicalClaims.flatMap((claim) => claim.rawTaskIds)
assert.equal(represented.length, 395)
assert.equal(new Set(represented).size, 395)
assert.deepEqual([...represented].sort(), allRaw.map((claim) => claim.id).sort())
assert.ok(allRaw.every((claim) => claim.canonicalClaimId))

for (const claim of canonical.canonicalClaims) {
  assert.ok(['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(claim.primaryClass.code))
  assert.ok(['CRITICAL', 'MAJOR', 'SUPPORTING'].includes(claim.severity))
  assert.ok(['VERIFIED', 'PARTIAL SUPPORT', 'EXTRAPOLATED', 'UNVERIFIED'].includes(claim.verificationStatus))
  assert.match(claim.revisionHash, /^sha256:[a-f0-9]{64}$/)
  assert.equal(claim.humanEvidenceReviewComplete, false)
  assert.equal(claim.grantsApproval, false)
  assert.equal(claim.publicationAuthorized, false)
  assert.ok(claim.occurrences.length > 0)
  assert.equal(claim.rawTaskIds.length, claim.occurrences.length)
  assert.ok(claim.occurrences.every((item) => item.taskId && item.conditionId && item.sourceFile && item.sourceLine > 0 && item.exactRevisionHash && item.exactClaim))
  if (claim.verificationStatus === 'VERIFIED') {
    assert.equal(claim.claimSourceRelationshipVerified, true)
    assert.equal(claim.evidenceRelationship.directSupport, true)
    assert.equal(claim.evidenceRelationship.extrapolation, false)
    assert.ok(claim.evidenceRelationship.exactSection)
    assert.ok(claim.evidenceRelationship.proposedSources.length > 0)
  } else assert.equal(claim.claimSourceRelationshipVerified, false)
}

const localClaims = canonical.canonicalClaims.filter((claim) => claim.localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED')
assert.ok(localClaims.length > 0)
assert.ok(localClaims.every((claim) => claim.verificationStatus === 'UNVERIFIED' && !claim.claimSourceRelationshipVerified))
const extrapolated = canonical.canonicalClaims.filter((claim) => claim.verificationStatus === 'EXTRAPOLATED')
assert.ok(extrapolated.length > 0)
assert.ok(extrapolated.every((claim) => !claim.claimSourceRelationshipVerified && claim.evidenceRelationship.extrapolation))

const repeated = canonicalizePriorityAClaims(audit.conditions, AUTHORITATIVE_V1_SOURCES)
assert.deepEqual(repeated.canonicalClaims, canonical.canonicalClaims, 'canonical mapping must be deterministic')
const staleInput = structuredClone(audit.conditions)
const staleRaw = staleInput.find((condition) => condition.priorityAClaims.length).priorityAClaims[0]
const originalCanonical = canonical.canonicalClaims.find((claim) => claim.rawTaskIds.includes(staleRaw.id))
staleRaw.revisionHash = `sha256:${'0'.repeat(64)}`
const stale = canonicalizePriorityAClaims(staleInput, AUTHORITATIVE_V1_SOURCES)
const staleCanonical = stale.canonicalClaims.find((claim) => claim.rawTaskIds.includes(staleRaw.id))
assert.notEqual(staleCanonical.revisionHash, originalCanonical.revisionHash, 'changed source revision must stale the canonical decision')
assert.equal(staleCanonical.humanEvidenceReviewComplete, false)
assert.equal(staleCanonical.publicationAuthorized, false)

const first = writePriorityAClaimReviewPacket(root)
const json1 = fs.readFileSync(first.files.json.path, 'utf8')
const markdown1 = fs.readFileSync(first.files.markdown.path, 'utf8')
const second = writePriorityAClaimReviewPacket(root)
assert.equal(hash(fs.readFileSync(second.files.json.path, 'utf8')), hash(json1))
assert.equal(hash(fs.readFileSync(second.files.markdown.path, 'utf8')), hash(markdown1))
const packet = buildPriorityAClaimReviewPacket(root)
assert.equal(packet.claims.length, canonical.canonicalClaimCount)
assert.equal(packet.summary.originalPriorityATasks, 395)
assert.equal(packet.grantsApproval, false)
assert.equal(packet.publicationAuthorized, false)
assert.equal(renderPriorityAClaimReviewMarkdown(packet), markdown1)
assert.ok(!packet.claims.some((claim) => claim.humanEvidenceReviewComplete))

console.log(`Version 1 canonical Priority A claim review passed: 395 raw tasks -> ${canonical.canonicalClaimCount} canonical claims; ${canonical.evidenceMappedAutomatically} direct mappings; all revisions fail closed.`)

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
