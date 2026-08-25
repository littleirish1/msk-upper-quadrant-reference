import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { criticalClaimCoveredByOwnerAdoption, loadVerifiedCriticalReviewAdoption } from '../ai-manager/private-review-portal/v1-critical-review-adoption.mjs'
import { createPublicationMinimumReview } from '../ai-manager/private-review-portal/v1-publication-minimum.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'
import { buildFinalHumanEvidenceDecisionPacket } from './generate-v1-final-human-evidence-decisions.mjs'

const root = process.cwd()
const adoption = loadVerifiedCriticalReviewAdoption(root)
assert.ok(adoption)
assert.equal(adoption.independentReviewPacket.sha256, '4757cec86671d15105c9fe6fe399d4c082ad880a3aa9cb391139a9a19e954c10')
assert.equal(adoption.recommendations.length, 47)
assert.equal(adoption.implementation.touchedFiles.length, 20)
assert.equal(adoption.implementation.resultingFiles.length, 20)
assert.equal(adoption.ownerConfirmation.actor, 'Eoin Casey')
assert.equal(adoption.ownerConfirmation.statement, 'I Eoin confirm the recommended changes')
assert.equal(adoption.ownerConfirmation.authority, 'wording-change-and-removal-implementation-only')
for (const flag of ['clinicalApprovalGranted', 'evidenceApprovalGranted', 'grantsApproval', 'publicationAuthorized', 'publicationStateChanged']) assert.equal(adoption[flag], false)

const audit = createV1ClinicalEvidenceAudit(root, loadV1ConditionReviewRecords(root))
const review = createPublicationMinimumReview(audit.canonicalReview.canonicalClaims, { criticalOwnerAdoption: adoption, criticalClaimCoveredByOwnerAdoption })
const critical = review.triagedClaims.filter((claim) => claim.severity === 'CRITICAL')
assert.equal(critical.length, 48)
assert.ok(critical.every((claim) => claim.outcome === 'OWNER-CONFIRMED RECOMMENDATION IMPLEMENTED'))
assert.ok(critical.every((claim) => claim.ownerConfirmation?.grantsApproval === false && claim.ownerConfirmation?.publicationAuthorized === false))
assert.equal(review.humanDecisions.some((decision) => decision.severity === 'CRITICAL'), false)

const packet = buildFinalHumanEvidenceDecisionPacket(root)
assert.equal(packet.summary.critical.ownerConfirmedRecommendationImplemented, 48)
assert.equal(packet.summary.critical.humanConfirmationRemaining, 0)
assert.equal(packet.summary.critical.contentChangeRequired, 0)
assert.equal(packet.summary.critical.blocked, 0)
assert.equal(packet.summary.finalHumanEvidenceDecisionsRemaining, 0)
assert.ok(adoption.recommendations.every((recommendation) => !packet.humanDecisions.some((decision) => decision.id === recommendation.id)), 'pre-change Critical decisions must be stale after the revision-bound implementation')

const targets = adoption.implementation.touchedFiles.map((relativePath) => fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8')).join('\n')
for (const unsupported of ['NEXUS Criteria', 'Failure of 12 weeks', 'urgent neurophysiology', 'cauda equina equivalent']) assert.equal(targets.includes(unsupported), false, `unsupported wording remains: ${unsupported}`)
const mnemonicLines = targets.split(/\r?\n/).filter((line) => /5Ds\/3Ns/i.test(line))
assert.ok(mnemonicLines.length > 0)
assert.ok(mnemonicLines.every((line) => /\b(?:not|do not|historical|absence)\b/i.test(line)), '5Ds/3Ns may be mentioned only to reject their use as a clearance rule')

console.log('Critical independent-review adoption passed: 47 owner-confirmed recommendations, 20 exact resulting files, 48 current Critical claims implemented, zero approvals granted.')
