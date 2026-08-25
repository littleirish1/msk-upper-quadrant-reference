import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { createPublicationMinimumReview, V1_SOURCE_BUNDLES } from '../ai-manager/private-review-portal/v1-publication-minimum.mjs'
import { criticalClaimCoveredByOwnerAdoption, loadVerifiedCriticalReviewAdoption } from '../ai-manager/private-review-portal/v1-critical-review-adoption.mjs'
import { loadVerifiedMajorReviewAdoption, majorClaimCoveredByOwnerAdoption } from '../ai-manager/private-review-portal/v1-major-review-adoption.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'

const BASENAME = 'V1-FINAL-HUMAN-EVIDENCE-DECISIONS'
const STARTING_SEVERITY = Object.freeze({ CRITICAL: 62, MAJOR: 240, SUPPORTING: 2 })
const STARTING_DIAGNOSTIC_ACCURACY = 53
const STARTING_LOCAL_SERVICE_GROUPS = 9

export function buildFinalHumanEvidenceDecisionPacket(root) {
  const audit = createV1ClinicalEvidenceAudit(root, loadV1ConditionReviewRecords(root))
  const criticalOwnerAdoption = loadVerifiedCriticalReviewAdoption(root)
  const majorOwnerAdoption = loadVerifiedMajorReviewAdoption(root)
  const review = createPublicationMinimumReview(audit.canonicalReview.canonicalClaims, { criticalOwnerAdoption, criticalClaimCoveredByOwnerAdoption, majorOwnerAdoption, majorClaimCoveredByOwnerAdoption })
  const currentCritical = review.triagedClaims.filter((claim) => claim.severity === 'CRITICAL').length
  const currentMajor = review.triagedClaims.filter((claim) => claim.severity === 'MAJOR').length
  const currentSupporting = review.triagedClaims.filter((claim) => claim.severity === 'SUPPORTING').length
  const decisions = review.humanDecisions.map((decision) => ({
    ...decision,
    reviewerDecision: {
      evidence: null,
      evidenceOptions: ['supported', 'partial', 'unsupported', 'alternative-evidence-needed'],
      wording: null,
      wordingOptions: ['accept', 'accept-softened-wording', 'modify', 'remove'],
      notes: null,
    },
  }))
  const conditions = loadV1ConditionReviewRecords(root).map((condition) => {
    const unresolved = decisions.filter((decision) => decision.conditionIds.includes(condition.id))
    const critical = unresolved.filter((decision) => decision.severity === 'CRITICAL').length
    const major = unresolved.filter((decision) => decision.severity === 'MAJOR').length
    return {
      conditionId: condition.id,
      title: condition.title,
      region: condition.region,
      learnerRoute: condition.learnerRoute,
      exactRevisionHash: condition.exactRevisionHash,
      outstandingHumanDecisions: unresolved.length,
      critical,
      major,
      readiness: unresolved.length === 0 ? 'READY FOR HUMAN CONFIRMATION' : unresolved.length <= 3 ? 'LIMITED REVIEW REQUIRED' : 'CHANGES REQUIRED',
      grantsApproval: false,
      publicationAuthorized: false,
    }
  })
  const classD = review.triagedClaims.filter((claim) => claim.primaryClass.code === 'D')
  const classE = review.triagedClaims.filter((claim) => claim.primaryClass.code === 'E')
  const local = review.triagedClaims.filter((claim) => claim.localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED')
  return {
    schemaVersion: 1,
    packetType: 'v1-final-human-evidence-decisions',
    authority: 'private-revision-bound-review-preparation-only',
    scope: { regions: ['cervical', 'shoulder', 'elbow'], conditions: 20 },
    summary: {
      startingCanonicalClaims: review.startingCanonicalClaims,
      currentCanonicalClaims: review.currentCanonicalClaims,
      canonicalClaimsRemovedOrCollapsedByContentHardening: review.canonicalClaimsRemovedOrCollapsedByContentHardening,
      necessityCounts: review.necessityCounts,
      outcomeCounts: review.outcomeCounts,
      startingSeverityCounts: STARTING_SEVERITY,
      currentSeverityCounts: { CRITICAL: currentCritical, MAJOR: currentMajor, SUPPORTING: currentSupporting },
      critical: {
        starting: STARTING_SEVERITY.CRITICAL,
        directlyVerified: review.severityOutcomes.CRITICAL?.['DIRECTLY VERIFIED'] ?? 0,
        safelyRewrittenOrRemoved: STARTING_SEVERITY.CRITICAL - currentCritical,
        scopeBoundaryRecorded: review.severityOutcomes.CRITICAL?.['SCOPE BOUNDARY RECORDED'] ?? 0,
        ownerConfirmedRecommendationImplemented: review.severityOutcomes.CRITICAL?.['OWNER-CONFIRMED RECOMMENDATION IMPLEMENTED'] ?? 0,
        humanConfirmationRemaining: decisions.filter((decision) => decision.severity === 'CRITICAL' && decision.outcome === 'HUMAN CONFIRMATION').length,
        contentChangeRequired: decisions.filter((decision) => decision.severity === 'CRITICAL' && decision.outcome === 'CONTENT CHANGE REQUIRED').length,
        blocked: decisions.filter((decision) => decision.severity === 'CRITICAL' && decision.outcome === 'BLOCKED').length,
      },
      major: {
        starting: STARTING_SEVERITY.MAJOR,
        current: currentMajor,
        directlyResolved: review.triagedClaims.filter((claim) => claim.severity === 'MAJOR' && ['DIRECTLY VERIFIED', 'SCOPE BOUNDARY RECORDED', 'FUTURE EVIDENCE EXPANSION'].includes(claim.outcome)).length + (STARTING_SEVERITY.MAJOR - currentMajor),
        ownerConfirmedRecommendationImplemented: review.severityOutcomes.MAJOR?.['OWNER-CONFIRMED MAJOR RECOMMENDATION IMPLEMENTED'] ?? 0,
        humanDecisionsRemaining: decisions.filter((decision) => decision.severity === 'MAJOR').length,
      },
      supporting: { starting: STARTING_SEVERITY.SUPPORTING, publicationBlockers: 0, futureEvidenceFollowUp: currentSupporting },
      diagnosticAccuracy: { startingCanonicalDecisions: STARTING_DIAGNOSTIC_ACCURACY, exactNumericStatisticsRetained: 0, currentQualitativeLimitations: classD.length, removedOrSoftened: STARTING_DIAGNOSTIC_ACCURACY },
      prescribing: { currentClaims: classE.length, outcomes: countBy(classE, 'outcome') },
      localService: { startingGroups: STARTING_LOCAL_SERVICE_GROUPS, currentDurableBoundaryRecords: local.length, currentHumanDecisions: decisions.filter((decision) => decision.learnerClaims.some((claim) => /HSC|Trust|Belfast|waiting time/i.test(claim))).length, disposition: 'volatile named services, waiting times and mandatory local steps were removed or replaced by current-local-pathway wording' },
      finalHumanEvidenceDecisionsRemaining: decisions.length,
      conditionsReadyForHumanConfirmation: conditions.filter((condition) => condition.readiness === 'READY FOR HUMAN CONFIRMATION').length,
    },
    sourceBundles: V1_SOURCE_BUNDLES,
    criticalOwnerAdoption: criticalOwnerAdoption ? {
      path: criticalOwnerAdoption.path,
      independentReviewPacket: criticalOwnerAdoption.independentReviewPacket,
      ownerConfirmation: criticalOwnerAdoption.ownerConfirmation,
      resultingFileCount: criticalOwnerAdoption.implementation.resultingFiles.length,
      grantsApproval: false,
      publicationAuthorized: false,
    } : null,
    majorOwnerAdoption: majorOwnerAdoption ? {
      path: majorOwnerAdoption.path,
      independentReviewPacket: majorOwnerAdoption.independentReviewPacket,
      ownerConfirmation: majorOwnerAdoption.ownerConfirmation,
      resultingFileCount: majorOwnerAdoption.implementation.resultingFiles.length,
      grantsApproval: false,
      publicationAuthorized: false,
    } : null,
    conditionReadiness: conditions,
    humanDecisions: decisions,
    resolvedAudit: review.triagedClaims.filter((claim) => !['HUMAN CONFIRMATION', 'CONTENT CHANGE REQUIRED', 'BLOCKED'].includes(claim.outcome)).map((claim) => ({ id: claim.id, severity: claim.severity, conditionIds: claim.conditionIds, outcome: claim.outcome, necessity: claim.necessity, sourceBundle: claim.sourceBundle, revisionHash: claim.revisionHash })),
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

export function renderFinalHumanEvidenceDecisionMarkdown(packet) {
  const s = packet.summary
  const lines = [
    '# Version 1 Final Human Evidence Decisions',
    '',
    '> Private, revision-bound evidence-preparation packet for cervical, shoulder and elbow. It grants no clinical, evidence or publication approval.',
    '',
    '## Review reduction',
    '',
    `- Starting canonical claims: **${s.startingCanonicalClaims}**`,
    `- Current canonical claims after content hardening: **${s.currentCanonicalClaims}**`,
    `- Removed/collapsed through safe wording hardening: **${s.canonicalClaimsRemovedOrCollapsedByContentHardening}**`,
    `- Final human evidence decisions: **${s.finalHumanEvidenceDecisionsRemaining}**`,
    `- Necessity: ${Object.entries(s.necessityCounts).map(([key, value]) => `${key} ${value}`).join('; ')}`,
    '',
    '## Critical safety disposition',
    '',
    `- Starting: ${s.critical.starting}`,
    `- Directly verified: ${s.critical.directlyVerified}`,
    `- Safely rewritten/removed: ${s.critical.safelyRewrittenOrRemoved}`,
    `- Explicit scope boundaries: ${s.critical.scopeBoundaryRecorded}`,
    `- Human confirmations remaining: ${s.critical.humanConfirmationRemaining}`,
    `- Blocked: ${s.critical.blocked}`,
    '',
    '## How to review',
    '',
    'For each item select one evidence decision (supported / partial / unsupported / alternative evidence needed) and one wording decision (accept / accept softened wording / modify / remove). A decision is valid only for the recorded revision hash.',
    '',
  ]
  for (const severity of ['CRITICAL', 'MAJOR']) {
    const decisions = packet.humanDecisions.filter((decision) => decision.severity === severity)
    lines.push(`## ${severity} (${decisions.length})`, '')
    for (const decision of decisions) appendDecision(lines, decision)
  }
  lines.push('## Condition readiness', '')
  for (const condition of packet.conditionReadiness) lines.push(`- **${condition.title}** (${condition.region}): ${condition.readiness}; ${condition.outstandingHumanDecisions} decision(s), revision \`${condition.exactRevisionHash}\`.`)
  lines.push('', '## Authority boundary', '', '- `grantsApproval: false`', '- `publicationAuthorized: false`', '- Evidence preparation is not evidence approval.', '- Wording hardening is not clinical approval.', '')
  return `${lines.join('\n').trim()}\n`
}

export function writeFinalHumanEvidenceDecisionPacket(root) {
  const packet = buildFinalHumanEvidenceDecisionPacket(root)
  const directory = path.join(root, 'reports', 'publication-readiness')
  const json = `${JSON.stringify(packet, null, 2)}\n`
  const markdown = renderFinalHumanEvidenceDecisionMarkdown(packet)
  fs.mkdirSync(directory, { recursive: true })
  const jsonPath = path.join(directory, `${BASENAME}.json`)
  const markdownPath = path.join(directory, `${BASENAME}.md`)
  fs.writeFileSync(jsonPath, json)
  fs.writeFileSync(markdownPath, markdown)
  return { packet, files: { json: record(jsonPath, json), markdown: record(markdownPath, markdown) } }
}

function appendDecision(lines, decision) {
  lines.push(`### ${decision.id}`, '')
  lines.push(`- Conditions: ${decision.conditionIds.join(', ')}`)
  lines.push(`- Regions: ${decision.regions.join(', ')}`)
  lines.push(`- Why it matters: ${decision.whyItMatters}`)
  lines.push(`- Evidence bundle: ${decision.proposedEvidenceBundle ?? 'No authoritative bundle mapped'}`)
  lines.push(`- Exact source section: ${decision.exactSourceSections.join('; ') || 'Human mapping required'}`)
  lines.push(`- Evidence status: ${decision.supportStatuses.join(', ')}`)
  lines.push(`- Revision: \`${decision.revisionHash}\``)
  lines.push('- Exact learner wording:')
  for (const claim of decision.learnerClaims) lines.push(`  - ${claim}`)
  if (decision.suggestedSafeWording.length) lines.push(`- Suggested safe wording: ${decision.suggestedSafeWording.join(' / ')}`)
  lines.push(`- Recommended action: ${decision.recommendedActions.join(' / ')}`)
  lines.push('- Evidence: [ ] supported  [ ] partial  [ ] unsupported  [ ] alternative evidence needed')
  lines.push('- Wording: [ ] accept  [ ] accept softened wording  [ ] modify  [ ] remove')
  lines.push('- Reviewer notes:', '')
}

function record(filePath, content) {
  return { path: filePath, sha256: crypto.createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content) }
}

function countBy(records, field) {
  return Object.fromEntries([...new Set(records.map((record) => record[field]))].sort().map((value) => [value, records.filter((record) => record[field] === value).length]))
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const result = writeFinalHumanEvidenceDecisionPacket(process.cwd())
  console.log(`Version 1 final human evidence packet generated: ${result.packet.summary.startingCanonicalClaims} starting claims -> ${result.packet.summary.finalHumanEvidenceDecisionsRemaining} human decisions.`)
}
