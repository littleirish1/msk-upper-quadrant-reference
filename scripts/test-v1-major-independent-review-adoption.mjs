import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { loadVerifiedCriticalReviewAdoption, criticalClaimCoveredByOwnerAdoption } from '../ai-manager/private-review-portal/v1-critical-review-adoption.mjs'
import { loadVerifiedMajorReviewAdoption, majorClaimCoveredByOwnerAdoption } from '../ai-manager/private-review-portal/v1-major-review-adoption.mjs'
import { createPublicationMinimumReview } from '../ai-manager/private-review-portal/v1-publication-minimum.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'
import { buildFinalHumanEvidenceDecisionPacket } from './generate-v1-final-human-evidence-decisions.mjs'

const root = process.cwd()
const major = loadVerifiedMajorReviewAdoption(root)
const critical = loadVerifiedCriticalReviewAdoption(root)
assert.ok(major && critical)
assert.equal(major.independentReviewPacket.sha256, '1075f06adca7ac06919fcbc127f3f629c9e7a19bf3db07185d0f065cb4636873')
assert.equal(major.recommendations.length, 23)
assert.equal(new Set(major.recommendations.map((item) => item.id)).size, 23)
assert.equal(major.recommendations.filter((item) => item.contentChanged).length, 19)
assert.equal(major.recommendations.filter((item) => !item.contentChanged).length, 4)
assert.equal(major.implementation.resultingFiles.length, 15)
assert.equal(critical.verifiedThroughMajorAdoption, true)
for (const flag of ['clinicalApprovalGranted', 'evidenceApprovalGranted', 'grantsApproval', 'publicationAuthorized', 'publicationStateChanged']) assert.equal(major[flag], false)

const audit = createV1ClinicalEvidenceAudit(root, loadV1ConditionReviewRecords(root))
const review = createPublicationMinimumReview(audit.canonicalReview.canonicalClaims, {
  criticalOwnerAdoption: critical,
  criticalClaimCoveredByOwnerAdoption,
  majorOwnerAdoption: major,
  majorClaimCoveredByOwnerAdoption,
})
assert.equal(review.severityOutcomes.CRITICAL['OWNER-CONFIRMED RECOMMENDATION IMPLEMENTED'], 48)
assert.equal(review.severityOutcomes.MAJOR['OWNER-CONFIRMED MAJOR RECOMMENDATION IMPLEMENTED'], 46)
assert.equal(review.humanDecisions.some((decision) => ['CRITICAL', 'MAJOR'].includes(decision.severity)), false)
const packet = buildFinalHumanEvidenceDecisionPacket(root)
assert.equal(packet.summary.finalHumanEvidenceDecisionsRemaining, 0)
assert.equal(packet.summary.conditionsReadyForHumanConfirmation, 20)
assert.equal(packet.grantsApproval, false)
assert.equal(packet.publicationAuthorized, false)

const read = (relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8')
assert.doesNotMatch(read('content/elbow/elbow-osteoarthritis.mdx'), /up to \*\*20% of elbow OA cases|requested prior to surgical referral/i)
assert.doesNotMatch(read('content/cervical/cervicogenic-headache.mdx'), /Reduction to <10 days\/month|Monthly review \| Screen for medication overuse/i)
assert.doesNotMatch(read('content/shoulder/adhesive-capsulitis.mdx'), /aggressive stretching/i)
assert.match(read('content/elbow/lateral-epicondylalgia.mdx'), /recommends physiotherapy and recommends against corticosteroid injection/i)
assert.doesNotMatch(read('content/elbow/cubital-tunnel-syndrome.mdx'), /Adson's\/ROOS positive|Cervical X-ray; vascular duplex; NCS/i)
assert.match(read('content/shoulder/subacromial-pain-syndrome.mdx'), /no imaging or electrodiagnostic test.+automatic confirmatory step/i)
assert.match(read('content/shoulder/rotator-cuff-tendinopathy.mdx'), /no imaging modality is an automatic confirmatory test/i)
assert.match(read('content/cervical/cervical-myelopathy.mdx'), /MRI is the principal imaging modality.+clinical–radiological correlation/i)
assert.match(read('content/shoulder/acromioclavicular-joint.mdx'), /does not make surgery automatic/i)
assert.match(read('content/cervical/cervical-artery-dysfunction.mdx'), /negative historical symptom mnemonic.+possible cervical vascular pathology/i)
assert.doesNotMatch(read('content/shoulder/labral-tears.mdx'), /Recurrence or failure of conservative.+Orthopaedic referral/i)

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-major-adoption-stale-'))
try {
  for (const relativePath of [major.path, major.predecessorCriticalAdoption.path, ...major.implementation.resultingFiles.map((item) => item.relativePath)]) {
    const destination = path.join(temporaryRoot, ...relativePath.split('/'))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(root, ...relativePath.split('/')), destination)
  }
  assert.ok(loadVerifiedMajorReviewAdoption(temporaryRoot))
  const staleFile = path.join(temporaryRoot, ...major.implementation.resultingFiles[0].relativePath.split('/'))
  fs.appendFileSync(staleFile, '\nstale-change\n')
  assert.throws(() => loadVerifiedMajorReviewAdoption(temporaryRoot), /Stale Major-review implementation/)
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}

console.log('Major independent-review adoption passed: 23/23 recommendations, 19 wording changes, 4 retained decisions, exact hashes, stale revisions fail closed, and zero approvals granted.')
