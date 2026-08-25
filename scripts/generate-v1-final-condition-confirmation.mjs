import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { criticalClaimCoveredByOwnerAdoption, loadVerifiedCriticalReviewAdoption } from '../ai-manager/private-review-portal/v1-critical-review-adoption.mjs'
import { createV1FinalConditionConfirmationPacket } from '../ai-manager/private-review-portal/v1-final-condition-confirmation.mjs'
import { loadVerifiedMajorReviewAdoption, majorClaimCoveredByOwnerAdoption } from '../ai-manager/private-review-portal/v1-major-review-adoption.mjs'
import { createPublicationMinimumReview, V1_SOURCE_BUNDLES } from '../ai-manager/private-review-portal/v1-publication-minimum.mjs'
import { loadAuditedV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportRoot = path.join(root, 'reports', 'publication-readiness')
const jsonPath = path.join(reportRoot, 'V1-FINAL-20-CONDITION-HUMAN-CONFIRMATION.json')
const markdownPath = path.join(reportRoot, 'V1-FINAL-20-CONDITION-HUMAN-CONFIRMATION.md')

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'))
}

export function buildV1FinalConditionConfirmationPacket(repositoryRoot = root) {
  const conditions = loadAuditedV1ConditionReviewRecords(repositoryRoot)
  const claims = [...new Map(conditions.flatMap((condition) => condition.clinicalEvidenceAudit.canonicalClaims).map((claim) => [claim.id, claim])).values()]
  const criticalAdoption = loadVerifiedCriticalReviewAdoption(repositoryRoot)
  const majorAdoption = loadVerifiedMajorReviewAdoption(repositoryRoot)
  const publicationMinimum = createPublicationMinimumReview(claims, {
    criticalOwnerAdoption: criticalAdoption,
    criticalClaimCoveredByOwnerAdoption,
    majorOwnerAdoption: majorAdoption,
    majorClaimCoveredByOwnerAdoption,
  })
  publicationMinimum.sourceBundles = V1_SOURCE_BUNDLES
  return createV1FinalConditionConfirmationPacket({
    repositoryRoot,
    conditionRecords: conditions,
    publicationMinimum,
    criticalAdoption,
    majorAdoption,
    finalEvidencePacket: readJson('reports/publication-readiness/V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json'),
    manualQa: readJson('reports/publication-readiness/v1-manual-qa-checklist.json'),
    accessibility: readJson('reports/publication-readiness/v1-accessibility-checklist.json'),
    buildIntegrity: readJson('reports/publication-readiness/v1-build-integrity-summary.json'),
    evidenceHub: readJson('reports/clinical-platform/evidence-hub-population.json'),
  })
}

function human(value) {
  return String(value).replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function markdown(packet) {
  const lines = [
    '# Version 1 Final 20-Condition Human Confirmation',
    '',
    '> Exact-revision clinical/evidence confirmation worksheet. All decisions are intentionally blank. This packet grants no clinical approval, evidence approval, publication authority or publication-state change.',
    '',
    `- Conditions: ${packet.summary.conditionsIncluded}/20`,
    `- Valid Critical → Major → current-revision lineage: ${packet.summary.validReviewLineage}/20`,
    '- CRITICAL human evidence decisions remaining: 0',
    '- MAJOR human evidence decisions remaining: 0',
    '- Final condition confirmations complete: 0/20',
    '- Publication authorised: false',
    '',
  ]
  for (const region of packet.scope.regions) {
    lines.push(`## ${human(region)}`, '')
    for (const condition of packet.conditions.filter((item) => item.region === region)) {
      lines.push(
        `### ${condition.title}`,
        '',
        `- **Condition ID:** \`${condition.conditionId}\``,
        `- **Learner route:** \`${condition.learnerRoute}\``,
        `- **Source:** \`${condition.sourceFile}\``,
        `- **Exact revision:** \`${condition.exactCurrentRevisionHash}\``,
        `- **Confirmation key:** \`${condition.confirmationRevisionKey}\``,
        `- **Status:** ${condition.status}`,
        `- **Why:** ${condition.why}`,
        `- **Resolved Critical claims:** ${condition.audit.criticalDecisionsResolved}`,
        `- **Resolved Major claims:** ${condition.audit.majorDecisionsResolved}`,
        `- **Critical recommendation groups:** ${condition.lineage.criticalAdoption.recommendationIds.join(', ') || 'None for this condition'}`,
        `- **Major recommendation groups:** ${condition.lineage.majorAdoption.recommendationIds.join(', ') || 'None for this condition'}`,
        '',
        '**Key adopted safety/content changes**',
        '',
        ...(condition.audit.contentSafelyRemovedOrSoftened.length
          ? condition.audit.contentSafelyRemovedOrSoftened.map((item) => `- ${item.id}: ${item.change}`)
          : ['- No wording change was required by the adopted recommendation set.']),
        '',
        '**Authoritative evidence anchors**',
        '',
        ...(condition.audit.authoritativeEvidenceAnchors.length
          ? condition.audit.authoritativeEvidenceAnchors.map((item) => `- ${item.title} (${item.year}) — ${item.relevantSection}`)
          : ['- No additional source-bundle anchor was needed for the current publication-minimum claims.']),
        '',
        `**Non-blocking future evidence expansion:** ${condition.audit.futureEvidenceExpansion.length} item(s)`,
        '',
        ...condition.audit.futureEvidenceExpansion.map((item) => `- ${item.canonicalId}: ${item.topic} — ${item.status}`),
        '',
        `- **Local-service wording:** ${condition.audit.localServiceWordingStatus}`,
        `- **Prescribing boundary:** ${condition.audit.prescribingBoundaryStatus}`,
        `- **Remaining automated warning:** ${condition.audit.automatedWarning ?? 'None'}`,
        '',
        '**CLINICAL ACCURACY** — choose one:',
        '- [ ] Confirm acceptable for Version 1',
        '- [ ] Changes required',
        '- [ ] Blocked',
        '',
        '**EVIDENCE SUFFICIENCY** — choose one:',
        '- [ ] Confirm acceptable for Version 1',
        '- [ ] Changes required',
        '- [ ] Blocked',
        '',
        '**CLINICAL COMPLETENESS** — choose one:',
        '- [ ] Acceptable for Version 1',
        '- [ ] Non-blocking future expansion',
        '- [ ] Changes required',
        '- [ ] Blocked',
        '',
        '**PUBLICATION RECOMMENDATION** — choose one:',
        '- [ ] Recommend publish',
        '- [ ] Recommend hold',
        '',
        '**REVIEWER NOTES**',
        '',
        '________________________________________________________________________',
        '',
      )
    }
  }
  lines.push(
    '## Manual QA appendix',
    '',
    `- Status: ${packet.manualQaAppendix.status}`,
    `- Viewport/theme combinations remaining: ${packet.manualQaAppendix.viewportThemeCombinationsRemaining}`,
    `- Individual browser checks remaining: ${packet.manualQaAppendix.individualChecksRemaining}`,
    `- Manual accessibility checks remaining: ${packet.manualAccessibilityAppendix.checksRemaining}`,
    '- Manual QA and accessibility sign-off are separate from these clinical/evidence confirmations.',
    '',
    '## Build and governance appendix',
    '',
    `- Runtime: Node ${packet.buildGovernanceAppendix.runtime.node} / npm ${packet.buildGovernanceAppendix.runtime.npm}`,
    `- Full preflight: ${packet.buildGovernanceAppendix.fullPreflight}`,
    `- Learner routes: ${packet.buildGovernanceAppendix.learnerRoutes}`,
    `- Static HTML pages: ${packet.buildGovernanceAppendix.staticHtmlPages}`,
    `- Production build static pages: ${packet.buildGovernanceAppendix.productionBuildStaticPages}`,
    `- Internal links: ${packet.buildGovernanceAppendix.internalHyperlinks}`,
    `- Invalid anchors: ${packet.buildGovernanceAppendix.invalidAnchors}`,
    `- Local assets: ${packet.buildGovernanceAppendix.localAssetReferences}`,
    `- Private leakage findings: ${packet.buildGovernanceAppendix.privateLeakageFindings}`,
    `- Public 3D assets: ${packet.buildGovernanceAppendix.public3dAssets}`,
    `- Learner-facing 3D routes: ${packet.buildGovernanceAppendix.learnerFacing3dRoutes}`,
    `- Evidence Hub: ${packet.buildGovernanceAppendix.evidenceHub.state}; public records ${packet.buildGovernanceAppendix.evidenceHub.publicRecords}; claims ${packet.buildGovernanceAppendix.evidenceHub.claims}; relationships ${packet.buildGovernanceAppendix.evidenceHub.relationships}`,
    '',
    'Generating or completing this worksheet does not itself authorise publication.',
    '',
  )
  return `${lines.map((line) => line.trimEnd()).join('\n').trimEnd()}\n`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packet = buildV1FinalConditionConfirmationPacket(root)
  fs.mkdirSync(reportRoot, { recursive: true })
  fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`)
  fs.writeFileSync(markdownPath, markdown(packet))
  const jsonHash = crypto.createHash('sha256').update(fs.readFileSync(jsonPath)).digest('hex')
  const markdownHash = crypto.createHash('sha256').update(fs.readFileSync(markdownPath)).digest('hex')
  console.log(`Final 20-condition confirmation packet generated: ${packet.conditions.length}/20 valid lineages; decisions blank; JSON ${jsonHash}; Markdown ${markdownHash}.`)
}
