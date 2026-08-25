import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'

const BASENAME = 'V1-PRIORITY-A-CLAIM-REVIEW'

export function buildPriorityAClaimReviewPacket(root) {
  const audit = createV1ClinicalEvidenceAudit(root, loadV1ConditionReviewRecords(root))
  const claims = audit.canonicalReview.canonicalClaims.filter((claim) => !claim.humanEvidenceReviewComplete)
  return {
    schemaVersion: 1,
    packetType: 'v1-canonical-priority-a-claim-review',
    scope: { regions: ['cervical', 'shoulder', 'elbow'], conditions: 20, priority: 'A' },
    summary: {
      originalPriorityATasks: audit.canonicalReview.rawTaskCount,
      canonicalDistinctClaims: audit.canonicalReview.canonicalClaimCount,
      duplicatesAndOverlapsCollapsed: audit.canonicalReview.collapsedTaskCount,
      evidenceMappedAutomatically: audit.canonicalReview.evidenceMappedAutomatically,
      humanReviewRemaining: claims.length,
      verificationStatusCounts: audit.canonicalReview.verificationStatusCounts,
      severityCounts: audit.canonicalReview.severityCounts,
      classCounts: audit.canonicalReview.classCounts,
      localServiceReviewRequired: audit.canonicalReview.localServiceReviewRequired,
      allRawTasksRepresented: audit.canonicalReview.allRawTasksRepresented,
    },
    reviewOrder: ['CRITICAL', 'MAJOR', 'SUPPORTING'],
    reviewerAuthority: {
      evidenceRelationshipOptions: ['confirm-supported', 'partial-support', 'unsupported', 'needs-alternative-evidence'],
      clinicalWordingOptions: ['accept-as-written', 'soften-wording', 'change-required', 'remove'],
      decisionsAreRecommendationsOnly: true,
      grantsApproval: false,
      publicationAuthorized: false,
    },
    claims,
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    publicationAuthorized: false,
    grantsApproval: false,
  }
}

export function renderPriorityAClaimReviewMarkdown(packet) {
  const lines = [
    '# Version 1 Priority A Canonical Claim Review',
    '',
    '> Private, revision-bound review packet. Decisions recorded here are recommendations only. `grantsApproval=false`; `publicationAuthorized=false`.',
    '',
    '## Progress',
    '',
    `- Priority A raw tasks: **${packet.summary.originalPriorityATasks}**`,
    `- Canonical claims: **${packet.summary.canonicalDistinctClaims}**`,
    `- Duplicate/overlap tasks collapsed: **${packet.summary.duplicatesAndOverlapsCollapsed}**`,
    `- Evidence relationships mapped automatically: **${packet.summary.evidenceMappedAutomatically}**`,
    `- Human review remaining: **${packet.summary.humanReviewRemaining}**`,
    `- Local service claims requiring an exact local source: **${packet.summary.localServiceReviewRequired}**`,
    '',
  ]
  for (const severity of packet.reviewOrder) {
    const claims = packet.claims.filter((claim) => claim.severity === severity)
    lines.push(`## ${severity} (${claims.length})`, '')
    for (const claim of claims) appendClaim(lines, claim)
  }
  return `${lines.join('\n').trim()}\n`
}

export function writePriorityAClaimReviewPacket(root) {
  const packet = buildPriorityAClaimReviewPacket(root)
  const directory = path.join(root, 'reports', 'publication-readiness')
  const json = `${JSON.stringify(packet, null, 2)}\n`
  const markdown = renderPriorityAClaimReviewMarkdown(packet)
  fs.mkdirSync(directory, { recursive: true })
  const files = {
    json: path.join(directory, `${BASENAME}.json`),
    markdown: path.join(directory, `${BASENAME}.md`),
  }
  fs.writeFileSync(files.json, json)
  fs.writeFileSync(files.markdown, markdown)
  return {
    packet,
    files: {
      json: { path: files.json, sha256: hash(json), bytes: Buffer.byteLength(json) },
      markdown: { path: files.markdown, sha256: hash(markdown), bytes: Buffer.byteLength(markdown) },
    },
  }
}

function appendClaim(lines, claim) {
  lines.push(`### ${claim.id}`, '', claim.canonicalClaim, '')
  lines.push(`- Primary class: **${claim.primaryClass.code}. ${claim.primaryClass.label}**`)
  lines.push(`- Severity: **${claim.severity}**`)
  lines.push(`- Verification: **${claim.verificationStatus}**`)
  lines.push(`- Local service status: **${claim.localServiceStatus}**`)
  lines.push(`- Conditions: ${claim.occurrences.map((item) => `${item.conditionTitle} (${item.region})`).filter((value, index, all) => all.indexOf(value) === index).join('; ')}`)
  lines.push(`- Canonical revision: \`${claim.revisionHash}\``)
  lines.push(`- Proposed source: ${claim.evidenceRelationship.proposedSources.length ? claim.evidenceRelationship.proposedSources.map((source) => `[${source.title}](${source.url})`).join('; ') : 'None identified'}`)
  lines.push(`- Exact supporting section: ${claim.evidenceRelationship.exactSection ?? 'Not deterministically mapped'}`)
  lines.push(`- Mapping rationale: ${claim.evidenceRelationship.reviewerRationale}`)
  lines.push('- Exact learner claim occurrence(s):')
  for (const occurrence of claim.occurrences) lines.push(`  - \`${occurrence.sourceFile}:${occurrence.sourceLine}\` · \`${occurrence.exactRevisionHash}\` · task \`${occurrence.taskId}\` — ${occurrence.exactClaim}`)
  lines.push('- Evidence relationship decision: [ ] Confirm supported  [ ] Partial support  [ ] Unsupported  [ ] Needs alternative evidence')
  lines.push('- Clinical wording decision: [ ] Accept as written  [ ] Soften wording  [ ] Change required  [ ] Remove')
  lines.push('- Reviewer notes:')
  lines.push('')
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const result = writePriorityAClaimReviewPacket(process.cwd())
  console.log(`Version 1 canonical Priority A review packet generated: ${result.packet.summary.originalPriorityATasks} raw tasks -> ${result.packet.summary.canonicalDistinctClaims} canonical claims; ${result.packet.summary.humanReviewRemaining} human decisions remain.`)
}
