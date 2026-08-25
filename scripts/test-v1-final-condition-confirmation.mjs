import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadVerifiedV1FinalConditionConfirmation, V1_FINAL_CONFIRMATION_DECISIONS } from '../ai-manager/private-review-portal/v1-final-condition-confirmation.mjs'
import { buildV1FinalConditionConfirmationPacket } from './generate-v1-final-condition-confirmation.mjs'

const root = process.cwd()
const packet = buildV1FinalConditionConfirmationPacket(root)
assert.equal(packet.conditions.length, 20)
assert.equal(new Set(packet.conditions.map((item) => item.conditionId)).size, 20)
assert.deepEqual(Object.fromEntries(['cervical', 'shoulder', 'elbow'].map((region) => [region, packet.conditions.filter((item) => item.region === region).length])), { cervical: 6, shoulder: 8, elbow: 6 })
assert.equal(packet.summary.validReviewLineage, 20)
assert.equal(packet.summary.staleConditionsRejected, 0)
assert.equal(packet.summary.criticalHumanEvidenceDecisionsRemaining, 0)
assert.equal(packet.summary.majorHumanEvidenceDecisionsRemaining, 0)
assert.equal(packet.summary.conditionsReadyForFinalHumanConfirmation, 20)
assert.equal(packet.summary.blankClinicalAccuracyDecisions, 20)
assert.equal(packet.summary.blankEvidenceSufficiencyDecisions, 20)
assert.equal(packet.summary.blankClinicalCompletenessDecisions, 20)
assert.equal(packet.summary.blankPublicationRecommendations, 20)
for (const condition of packet.conditions) {
  assert.equal(condition.status, 'READY FOR FINAL HUMAN CONFIRMATION')
  assert.equal(condition.lineage.valid, true)
  assert.ok(condition.lineage.criticalAdoption.recommendationIds.length > 0)
  assert.match(condition.confirmationRevisionKey, /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual(condition.allowedDecisions, V1_FINAL_CONFIRMATION_DECISIONS)
  assert.deepEqual(condition.decisions, { clinicalAccuracy: null, evidenceSufficiency: null, clinicalCompleteness: null, publicationRecommendation: null, reviewerNotes: '' })
  assert.equal(condition.grantsApproval, false)
  assert.equal(condition.publicationAuthorized, false)
  assert.equal(condition.publicationStateChanged, false)
  assert.ok(condition.audit.futureEvidenceExpansion.every((item) => item.status === 'NON-BLOCKING FUTURE EVIDENCE EXPANSION'))
}
for (const flag of ['clinicalApprovalGranted', 'evidenceApprovalGranted', 'grantsApproval', 'publicationAuthorized', 'publicationStateChanged']) assert.equal(packet[flag], false)
assert.equal(packet.scope.futureFeaturesRequiredForV1.movements, false)
assert.equal(packet.scope.futureFeaturesRequiredForV1.mcqs, false)
assert.equal(packet.scope.futureFeaturesRequiredForV1.modules, false)
assert.equal(packet.scope.futureFeaturesRequiredForV1.anatomy3d, false)
assert.equal(packet.manualQaAppendix.viewportThemeCombinationsRemaining, 6)
assert.equal(packet.manualQaAppendix.individualChecksRemaining, 90)
assert.equal(packet.manualAccessibilityAppendix.checksRemaining, 13)
assert.equal(packet.buildGovernanceAppendix.brokenInternalHyperlinks, 0)
assert.equal(packet.buildGovernanceAppendix.invalidAnchors, 0)
assert.equal(packet.buildGovernanceAppendix.missingLocalAssets, 0)
assert.equal(packet.buildGovernanceAppendix.privateLeakageFindings, 0)
assert.equal(packet.buildGovernanceAppendix.public3dAssets, 0)
assert.equal(packet.buildGovernanceAppendix.learnerFacing3dRoutes, 0)
assert.equal(packet.buildGovernanceAppendix.evidenceHub.state, 'FAIL CLOSED')

const verified = loadVerifiedV1FinalConditionConfirmation(root)
assert.equal(verified.verifiedAgainstCurrentFiles, true)
assert.match(verified.sha256, /^[a-f0-9]{64}$/)
const markdown = fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'V1-FINAL-20-CONDITION-HUMAN-CONFIRMATION.md'), 'utf8')
assert.equal((markdown.match(/^### /gm) ?? []).length, 20)
assert.equal((markdown.match(/- \[x\]/gi) ?? []).length, 0)
assert.match(markdown, /Final condition confirmations complete: 0\/20/)

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-final-condition-stale-'))
try {
  const packetRelative = 'reports/publication-readiness/V1-FINAL-20-CONDITION-HUMAN-CONFIRMATION.json'
  for (const relativePath of [packetRelative, ...packet.conditions.map((item) => item.sourceFile)]) {
    const source = path.join(root, ...relativePath.split('/'))
    const destination = path.join(temporaryRoot, ...relativePath.split('/'))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  }
  assert.equal(loadVerifiedV1FinalConditionConfirmation(temporaryRoot).conditions.length, 20)
  const stale = path.join(temporaryRoot, ...packet.conditions[0].sourceFile.split('/'))
  fs.appendFileSync(stale, '\nstale-clinical-revision\n')
  assert.throws(() => loadVerifiedV1FinalConditionConfirmation(temporaryRoot), /Stale final condition confirmation/)
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}

console.log('Final 20-condition confirmation packet passed: 20 valid lineages, 80 blank governed decisions, stale revisions rejected, and zero approvals granted.')
