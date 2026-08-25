import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRegistryItem, loadContentRegistry } from '../ai-manager/private-review-portal/content-studio.mjs'
import {
  createConditionReviewCard,
  createLegacyConditionGovernanceOverlay,
  createV1PublicationReviewAdapter,
  loadAuditedV1ConditionReviewRecords,
  loadV1ConditionReviewRecords,
  summarizeV1PublicationReview,
  V1_REVIEW_DECISIONS,
} from '../ai-manager/private-review-portal/v1-publication-review.mjs'

const root = process.cwd()
const store = { read: () => ({ extraMaterials: [] }) }
const records = loadV1ConditionReviewRecords(root)
const auditedRecords = loadAuditedV1ConditionReviewRecords(root)
assert.equal(records.length, 20)
assert.deepEqual(Object.fromEntries(['cervical', 'shoulder', 'elbow'].map((region) => [region, records.filter((item) => item.region === region).length])), { cervical: 6, shoulder: 8, elbow: 6 })
assert.ok(records.every((item) => item.exactRevisionHash.startsWith('sha256:') && item.grantsApproval === false))
assert.ok(records.every((item) => item.publicationState === 'legacy-publication-review-required' && item.lifecycle === 'review-required'))
assert.ok(records.every((item) => item.clinicalReviewStatus === 'not-recorded' && item.evidenceReviewStatus === 'not-recorded' && item.publicationDecisionStatus === 'not-recorded'))
assert.ok(records.every((item) => item.evidence.sourcePresent && !item.evidence.claimSourceRelationshipVerified && !item.evidence.humanEvidenceReviewComplete))
assert.ok(records.every((item) => item.finalBlockers.includes('explicit-clinical-review-decision-not-recorded')))
assert.deepEqual(V1_REVIEW_DECISIONS.publication, ['recommend-publish', 'recommend-hold'])
assert.ok(records.every((item) => item.publicationAuthorized === false))

const cubital = records.find((item) => item.conditionId === 'cubital-tunnel-syndrome')
assert.ok(cubital)
assert.equal(cubital.reviewCategory, 'no-automated-issue-detected-human-confirmation-only')
assert.equal(cubital.evidence.evidenceFindings.length, 0)
assert.equal(records.filter((item) => item.reviewCategory === 'no-automated-issue-detected-human-confirmation-only').length, 20)
assert.equal(records.filter((item) => item.reviewCategory === 'publication-blocker').length, 0)
assert.equal(records.filter((item) => item.reviewCategory === 'evidence-follow-up-required').length, 0)
assert.equal(records.filter((item) => item.reviewCategory === 'clinical-content-issue-detected').length, 0)
assert.equal(records.filter((item) => item.region === 'elbow')[0].conditionId, 'cubital-tunnel-syndrome')

assert.equal(auditedRecords.filter((item) => item.reviewCategory === 'publication-blocker').length, 20)
assert.ok(auditedRecords.every((item) => item.clinicalEvidenceAudit.priorityAClaims.length > 0))
assert.ok(auditedRecords.every((item) => item.clinicalEvidenceAudit.canonicalClaims.length > 0))
assert.ok(auditedRecords.every((item) => item.finalBlockers.includes('publication-critical-claim-source-verification-incomplete')))

const cards = auditedRecords.map(createConditionReviewCard)
assert.equal(cards.length, 20)
assert.equal(cards.filter((item) => item.automatedReviewStatement === 'NO STRUCTURAL OR CONTENT DEFECT DETECTED').length, 0)
assert.ok(cards.every((item) => item.priorityAClaimsRequiringHumanVerification > 0 && item.clinicalEvidenceReadiness === 'changes-still-required'))
const overlays = records.map(createLegacyConditionGovernanceOverlay)
assert.equal(overlays.length, 20)
assert.ok(overlays.every((item) => item.clinicalReview === 'review-required' && item.evidenceReview === 'review-required'))
assert.ok(overlays.every((item) => item.publicationReview === 'legacy-publication-review-required' && item.historicalPublicExposure === true))
assert.ok(overlays.every((item) => item.grantsApproval === false && item.publicationAuthorized === false && item.transitionActivated === false && item.learnerExposureChanged === false))

const registry = loadContentRegistry({ repositoryRoot: root, store })
const conditions = registry.items.filter((item) => item.contentType === 'conditions' && ['cervical', 'shoulder', 'elbow'].includes(item.region))
assert.equal(conditions.length, 20)
assert.equal(new Set(conditions.map((item) => item.id)).size, 20)
assert.ok(conditions.every((item) => item.grantsApproval === false && item.publicationState === 'legacy-publication-review-required'))

const mock = loadContentRegistry({ repositoryRoot: root, store, adapters: [createV1PublicationReviewAdapter(createRegistryItem)] })
assert.equal(mock.items.length, 20)
const summary = summarizeV1PublicationReview(auditedRecords, [{ type: 'record-v1-publication-review', targetId: auditedRecords[0].id, createdAt: '2026-08-17T00:00:00.000Z', clinicalDecision: 'acceptable', evidenceDecision: 'follow-up-non-blocking', publicationRecommendation: 'recommend-publish', grantsApproval: false }])
assert.equal(summary.regions.cervical.conditionsReviewed, 1)
assert.equal(summary.regions.cervical.clinicalReviewed, 1)
assert.equal(summary.regions.cervical.evidenceReviewed, 1)
assert.equal(summary.regions.cervical.publicationRecommendationsRecorded, 1)
assert.equal(summary.regions.cervical.remainingDecisionBlockers, 5)
assert.equal(summary.categoryCounts['no-automated-issue-detected-human-confirmation-only'], 0)
assert.equal(summary.categoryCounts['publication-blocker'], 20)
assert.equal(summary.grantsApproval, false)
assert.equal(summary.publicationAuthorized, false)
assert.equal(summary.canonicalReview.priorityARawTasks, 395)
assert.equal(summary.canonicalReview.canonicalClaims, 217)
assert.equal(summary.canonicalReview.duplicatesAndOverlapsCollapsed, 395 - summary.canonicalReview.canonicalClaims)
assert.equal(summary.canonicalReview.humanReviewRemaining, summary.canonicalReview.canonicalClaims)
assert.equal(summary.canonicalReview.grantsApproval, false)

for (const report of ['v1-clinical-evidence-audit.json', 'v1-publication-scope.json', 'v1-condition-review-pack.json', 'v1-baseline-case-assessment.json', 'v1-governance-migration.json', 'v1-manual-qa-checklist.json', 'v1-accessibility-checklist.json', 'v1-external-link-manual-review.json', 'v1-build-integrity-summary.json']) {
  assert.ok(fs.existsSync(path.join(root, 'reports', 'publication-readiness', report)), `missing generated report: ${report}`)
}

const generatedReviewPack = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-condition-review-pack.json'), 'utf8'))
assert.deepEqual(generatedReviewPack.categoryCounts, {
  'no-automated-issue-detected-human-confirmation-only': 0,
  'evidence-follow-up-required': 0,
  'clinical-content-issue-detected': 0,
  'publication-blocker': 20,
})
assert.deepEqual({
  conditionDecisionFields: generatedReviewPack.humanReviewItemsRemaining.conditionDecisionFields,
  browserViewportThemeReviews: generatedReviewPack.humanReviewItemsRemaining.browserViewportThemeReviews,
  accessibilityChecks: generatedReviewPack.humanReviewItemsRemaining.accessibilityChecks,
  total: generatedReviewPack.humanReviewItemsRemaining.total,
}, { conditionDecisionFields: 60, browserViewportThemeReviews: 6, accessibilityChecks: 13, total: 79 })
const generatedMigration = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-governance-migration.json'), 'utf8'))
assert.equal(generatedMigration.overlayCount, 20)
assert.equal(generatedMigration.recommendedMigration.transitionActivated, false)
const generatedQa = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-manual-qa-checklist.json'), 'utf8'))
assert.equal(generatedQa.viewportThemeMatrix.length, 6)
assert.equal(new Set(generatedQa.viewportThemeMatrix.flatMap((item) => item.routes.map((route) => route.name))).size, 11)
assert.ok(generatedQa.viewportThemeMatrix.every((item) => item.checks.every((check) => check.status === 'NOT_TESTED' && check.allowed.includes('NOT_TESTED'))))
const generatedAccessibility = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-accessibility-checklist.json'), 'utf8'))
assert.equal(generatedAccessibility.manualChecks.length, 13)
assert.ok(generatedAccessibility.manualChecks.every((item) => item.procedure && item.status === 'NOT_TESTED' && item.allowed.includes('NOT_TESTED')))
const generatedExternal = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-external-link-manual-review.json'), 'utf8'))
assert.deepEqual(generatedExternal.summary, { total: 3, complete: 3, remaining: 0, pass: 3, fail: 0 })
assert.equal(generatedExternal.links.some((item) => item.targetUrl === 'https://cks.nice.org.uk/topics/peripheral-neuropathy/'), false)

console.log('Version 1 publication review tests passed: 20 revision-bound conditions, fail-closed recommendations, no publication authority.')
