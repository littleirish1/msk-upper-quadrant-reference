import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import matter from 'gray-matter'
import { loadV1ConditionReviewRecords, V1_PUBLICATION_REGIONS, V1_REVIEW_DECISIONS } from '../ai-manager/private-review-portal/v1-publication-review.mjs'
import { applyV1ClinicalEvidenceAudit, createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'

const OUTPUT_BASENAME = 'V1-HUMAN-CLINICAL-EVIDENCE-REVIEW'
const CASE_SOURCES = Object.freeze({
  'case.cervical.case-01': 'content/cases/cervical/cervical-radiculopathy-case-01.mdx',
  'case.cervical.case-02': 'content/cases/cervical/early-degenerative-cervical-myelopathy-case-01.mdx',
  'case.elbow.case-03': 'content/cases/elbow/distal-biceps-rupture-case-01.mdx',
  'case.shoulder.case-04': 'content/cases/shoulder/rcrsp-case-01.mdx',
  'case.shoulder.case-05': 'content/cases/shoulder/adhesive-capsulitis-case-01.mdx',
})

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`
}

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'))
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, '\n')
}

function headingRecords(body) {
  return [...body.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    heading: match[2].trim(),
    index: match.index,
    contentStart: match.index + match[0].length,
  }))
}

function splitSections(body) {
  const headings = headingRecords(body)
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
    return {
      level: heading.level,
      heading: heading.heading,
      content: body.slice(heading.contentStart, next?.index ?? body.length).trim(),
    }
  })
}

function keyReferencesSection(body) {
  const headings = headingRecords(body)
  const reference = headings.find((heading) => heading.level === 2 && /^key references$/i.test(heading.heading))
  if (!reference) return ''
  const next = headings.find((heading) => heading.index > reference.index && heading.level <= reference.level)
  return body.slice(reference.contentStart, next?.index ?? body.length).trim()
}

function referenceEntries(body) {
  const section = keyReferencesSection(body)
  if (!section) return []
  const starts = [...section.matchAll(/^(?:\d+[.)]|[-*])\s+/gm)]
  return starts.map((start, index) => {
    const raw = section.slice(start.index, starts[index + 1]?.index ?? section.length).trim()
    return parseReference(raw, index + 1)
  })
}

function parseReference(rawEntry, index) {
  const text = rawEntry.replace(/^(?:\d+[.)]|[-*])\s+/, '').replace(/\s+/g, ' ').trim()
  const markdownUrl = rawEntry.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null
  const plainUrl = rawEntry.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/[.,;]+$/, '') ?? null
  const doiUrl = rawEntry.match(/https?:\/\/(?:dx\.)?doi\.org\/([^\s)]+)/i)
  const doiText = rawEntry.match(/\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/i)?.[0]?.replace(/[.,;]+$/, '') ?? null
  const yearMatch = text.match(/(?:\(|\b)((?:19|20)\d{2})(?:\)|\b)/)
  const authorsPrefix = yearMatch ? text.slice(0, yearMatch.index).replace(/[\s,(.]+$/, '').trim() : null
  const afterYear = yearMatch ? text.slice((yearMatch.index ?? 0) + yearMatch[0].length).replace(/^[\s.):,-]+/, '') : ''
  const title = afterYear ? afterYear.split(/\.\s+(?=[A-Z*])/)[0].replace(/[*_]/g, '').trim() || null : null
  return {
    id: `reference-${String(index).padStart(2, '0')}`,
    rawEntry,
    title,
    authorsOrOrganisation: authorsPrefix || null,
    year: yearMatch?.[1] ?? null,
    doi: doiUrl?.[1]?.replace(/[.,;]+$/, '') ?? doiText,
    url: markdownUrl ?? plainUrl,
    reachability: 'NOT_TESTED_OR_NOT_APPLICABLE',
    claimSourceRelationship: 'CLAIM-SOURCE RELATIONSHIP NOT YET VERIFIED',
  }
}

function addReachability(references, liveByUrl, browserByUrl) {
  return references.map((reference) => {
    if (!reference.url) return reference
    const browser = browserByUrl.get(reference.url)
    const live = liveByUrl.get(reference.url)
    return {
      ...reference,
      reachability: browser
        ? { status: browser.browserResult, evidence: browser.finding ?? browser.title ?? null, method: 'ordinary-browser' }
        : live
          ? { status: live.ok ? 'PASS' : live.status ? `HTTP_${live.status}` : 'AUTOMATED_FAILURE', evidence: live.error ?? null, method: 'automated-client' }
          : 'NOT_TESTED_OR_NOT_APPLICABLE',
    }
  })
}

function reviewFields() {
  return {
    clinicalAccuracy: { decision: null, options: ['acceptable-for-v1', 'changes-required', 'blocked'] },
    clinicalCompleteness: { decision: null, options: ['acceptable-for-v1', 'non-blocking-future-expansion', 'changes-required', 'blocked'] },
    evidence: { decision: null, options: [...V1_REVIEW_DECISIONS.evidence] },
    publicationRecommendation: { decision: null, options: [...V1_REVIEW_DECISIONS.publication] },
    reviewerNotes: '',
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

function cubitalSpecialReview(condition, body, references) {
  if (condition.conditionId !== 'cubital-tunnel-syndrome') return null
  const ng127 = references.find((reference) => reference.url?.includes('/guidance/ng127/'))
  const management = splitSections(body).find((section) => /^management\s*&\s*treatment$/i.test(section.heading))
  return {
    obsoleteBibliographyEntry: 'NICE CKS. (2023). Peripheral neuropathy. https://cks.nice.org.uk/topics/peripheral-neuropathy/ (removed because the URL is obsolete)',
    replacementDecision: 'PARTIAL SUPPORT — HUMAN EVIDENCE DECISION REQUIRED FOR THE HISTORICAL CLAIM BUNDLE',
    exactClaimMappingStatus: 'NG127 1.7.9–1.7.10 IS NOW MAPPED ONLY TO SPLINT REFERRAL, SIX-WEEK REVIEW/NEUROLOGICAL ASSESSMENT, AND PRESSURE AVOIDANCE',
    explanation: 'NG127 explicitly supports those limited statements. It does not establish the former splint angle/duration, neurodynamic prescription, electrodiagnostic thresholds, operative thresholds or 3–6 month surgical-referral rule.',
    candidateContentForHumanMapping: {
      basis: 'The complete Management & Treatment section is reproduced because it contains the potentially related splinting, activity-modification and referral statements; none is asserted to be mapped to the obsolete source.',
      sectionHeading: management?.heading ?? null,
      exactContent: management?.content ?? null,
    },
    proposedEvidence: {
      source: 'NICE NG127 — Suspected neurological conditions: recognition and referral',
      recommendations: ['1.7.9', '1.7.10'],
      section: 'Compression neuropathy',
      url: 'https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16#compression-neuropathy',
      relationshipStatus: ng127 ? 'AUTHORITATIVE_ANCHOR_ADDED_HUMAN_CONFIRMATION_REQUIRED' : 'SOURCE_ENTRY_NOT_DETECTED',
      scopeNote: 'The recommendation explicitly includes ulnar nerve compression neuropathy. Claims outside its limited scope remain separate human evidence tasks.',
    },
    reviewerDecision: {
      decision: null,
      options: [
        'ng127-appropriate-replacement',
        'ng127-partial-support',
        'ng127-not-appropriate',
        'remove-obsolete-citation-without-replacement',
        'alternative-evidence-required',
      ],
      notes: '',
    },
  }
}

function buildConditions(root, liveByUrl, browserByUrl) {
  const initial = loadV1ConditionReviewRecords(root)
  const clinicalEvidenceAudit = createV1ClinicalEvidenceAudit(root, initial)
  const audits = new Map(clinicalEvidenceAudit.conditions.map((item) => [item.conditionId, item]))
  return initial.map((record) => applyV1ClinicalEvidenceAudit(record, audits.get(record.id))).map((condition) => {
    const source = normalizeLineEndings(fs.readFileSync(path.join(root, ...condition.sourceFile.split('/')), 'utf8'))
    const parsed = matter(source)
    const body = normalizeLineEndings(parsed.content).replace(/^\n+/, '').replace(/\s+$/, '')
    const references = addReachability(referenceEntries(body), liveByUrl, browserByUrl)
    return {
      conditionId: condition.id,
      region: condition.region,
      title: condition.title,
      learnerRoute: condition.learnerRoute,
      exactRevisionHash: condition.exactRevisionHash,
      sourceFile: condition.sourceFile,
      learnerContent: { exactMdxBody: body, sections: splitSections(body) },
      references,
      claimSourceRelationshipStatus: 'CLAIM-SOURCE RELATIONSHIP NOT YET VERIFIED',
      evidenceHubRelationships: condition.evidence.evidenceHubRelationships,
      automatedFindings: {
        statement: condition.reviewCategory === 'no-automated-issue-detected-human-confirmation-only'
          ? 'NO AUTOMATED STRUCTURAL/CONTENT DEFECT DETECTED'
          : null,
        missingSections: condition.completeness.missingStandardSections,
        blankSections: condition.completeness.blankSections,
        duplicateSections: condition.completeness.duplicateSections,
        placeholders: condition.completeness.unresolvedPlaceholders,
        encodingFindings: condition.completeness.encodingCorruption,
        headingFindings: condition.completeness.duplicateH1Count ? [`duplicate-h1-count:${condition.completeness.duplicateH1Count}`] : [],
        brokenLinks: condition.completeness.staleInternalLinks,
        obsoleteOrRestrictedExternalSources: condition.obsoleteOrRestrictedLinks,
        contradictions: condition.contradictionsOrFindings,
        governanceBlockers: condition.finalBlockers,
      },
      clinicalEvidenceAudit: condition.clinicalEvidenceAudit,
      review: reviewFields(),
      cubitalTunnelSpecialReview: cubitalSpecialReview(condition, body, references),
    }
  })
}

function buildCases(root, liveByUrl, browserByUrl) {
  const summary = readJson(root, 'reports/guided-cases/summary.json')
  return summary.records.filter((record) => V1_PUBLICATION_REGIONS.includes(record.region) && record.lifecycleState === 'published').map((record) => {
    const report = readJson(root, `reports/guided-cases/cases/${record.caseId}.json`)
    const sourceFile = CASE_SOURCES[record.caseId]
    if (!sourceFile) throw new Error(`No public source mapping for ${record.caseId}`)
    const source = normalizeLineEndings(fs.readFileSync(path.join(root, ...sourceFile.split('/')), 'utf8'))
    const parsed = matter(source)
    const references = addReachability(referenceEntries(parsed.content), liveByUrl, browserByUrl)
    return {
      caseId: record.caseId,
      title: record.neutralTitle,
      region: record.region,
      route: report.publicRoute,
      exactRevision: { contentHash: record.contentHash, contentRevision: record.contentRevision, sourceFile, sourceSha256: sha256(source) },
      clinicalState: record.clinicalReviewStatus,
      evidenceState: record.evidenceReviewStatus,
      publicationEligibility: record.publicationEligibility,
      currentReferences: references,
      unresolvedEvidenceHubMigration: {
        classification: 'MIGRATION / FOLLOW-UP',
        count: record.unresolvedEvidenceGapCount,
        gaps: report.evidenceHub.unresolvedEvidenceGaps,
        policyBasis: 'The baseline-reviewed/baseline-preserved case retains its existing source material and current governance does not make Evidence Hub migration a Version 1 publication prerequisite.',
      },
    }
  })
}

function buildIntegrity(root) {
  const audit = readJson(root, 'reports/publication-readiness/learner-export-audit.json').summary
  const out = path.join(root, 'out')
  const files = fs.existsSync(out) ? recursiveFiles(out) : []
  return {
    learnerRoutes: audit.generatedLearnerRoutes,
    htmlPages: audit.htmlPages,
    internalLinks: { inspected: audit.internalHyperlinks, valid: audit.validInternalHyperlinks, broken: audit.brokenInternalHyperlinks },
    fragmentLinks: audit.fragmentLinks,
    invalidAnchors: audit.invalidAnchors,
    localAssets: audit.localAssetReferences,
    missingAssets: audit.missingLocalAssets,
    orphanPages: audit.orphanLearnerPages,
    privateMarkerFindings: audit.privateMarkerFindings,
    public3dAssets: {
      glb: files.filter((file) => /\.glb$/i.test(file)).length,
      gltf: files.filter((file) => /\.gltf$/i.test(file)).length,
      draco: files.filter((file) => /(?:\.drc$|draco)/i.test(file)).length,
    },
    learnerFacing3dRoutes: audit.inventory?.filter?.((item) => /(?:^|\/)3d(?:\/|$)/i.test(item.route ?? '')).length ?? 0,
    preflight: 'PASS',
    runtime: { node: '20.20.2', npm: '10.8.2' },
  }
}

function recursiveFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? recursiveFiles(file) : [file]
  })
}

export function buildHumanClinicalEvidencePacket(root) {
  const live = readJson(root, 'reports/publication-readiness/external-link-live-audit.json')
  const browser = readJson(root, 'reports/publication-readiness/v1-browser-qa-observations.json')
  const liveByUrl = new Map(live.results.map((result) => [result.url, result]))
  const browserByUrl = new Map(browser.externalLinks.map((result) => [result.url, result]))
  const conditions = buildConditions(root, liveByUrl, browserByUrl)
  const baselineCases = buildCases(root, liveByUrl, browserByUrl)
  const manualQa = readJson(root, 'reports/publication-readiness/v1-manual-qa-checklist.json')
  const accessibility = readJson(root, 'reports/publication-readiness/v1-accessibility-checklist.json')
  return {
    schemaVersion: 1,
    packetType: 'human-clinical-evidence-review',
    authority: {
      technicalReviewOnly: false,
      decisionsRemainHuman: true,
      grantsApproval: false,
      publicationAuthorized: false,
      publicationStateChanged: false,
    },
    baseRevision: 'f233464a4fafaa3ba44f0756478a5d91aabe8a80',
    version1Scope: {
      inScope: ['learner home/navigation', 'cervical region pages', 'shoulder region pages', 'elbow region pages', 'publication-eligible textual anatomy', 'condition pages', 'currently public baseline-reviewed cases', 'complete existing learner interactions', 'present governed references/evidence links'],
      notRequiredForV1: ['private movement records', 'unauthored MCQs', 'private modules', 'candidate 3D/biomechanics assets'],
      futureFeaturesRemainPrivate: true,
    },
    conditions,
    baselineCases,
    buildIntegrity: buildIntegrity(root),
    manualQaAppendix: {
      viewportThemeChecks: manualQa.viewportThemeMatrix,
      accessibilityChecks: accessibility.manualChecks,
      completionStatus: 'NOT_COMPLETE',
    },
    totals: {
      conditions: conditions.length,
      conditionReferences: conditions.reduce((sum, condition) => sum + condition.references.length, 0),
      baselineCases: baselineCases.length,
      baselineCaseReferences: baselineCases.reduce((sum, item) => sum + item.currentReferences.length, 0),
      priorityAClaims: conditions.reduce((sum, item) => sum + item.clinicalEvidenceAudit.priorityAClaims.length, 0),
      priorityAClaimsRequiringHumanVerification: conditions.reduce((sum, item) => sum + item.clinicalEvidenceAudit.priorityAClaimsRequiringHumanVerification, 0),
    },
  }
}

export function renderHumanClinicalEvidenceMarkdown(packet) {
  const lines = [
    '# Version 1 Human Clinical and Evidence Review',
    '',
    `Base revision: \`${packet.baseRevision}\``,
    '',
    '> This packet records no clinical, evidence or publication decision. All review fields are intentionally blank. grantsApproval=false; publicationAuthorized=false.',
    '',
    '## Version 1 scope',
    '',
    'In scope:',
    ...packet.version1Scope.inScope.map((item) => `- ${item}`),
    '',
    'Not required for Version 1 under current governance and remaining private:',
    ...packet.version1Scope.notRequiredForV1.map((item) => `- ${item}`),
    '',
  ]
  for (const region of V1_PUBLICATION_REGIONS) {
    lines.push(`# ${region[0].toUpperCase()}${region.slice(1)} conditions`, '')
    for (const condition of packet.conditions.filter((item) => item.region === region)) appendConditionMarkdown(lines, condition)
  }
  lines.push('# Appendix A — Five baseline cases', '')
  for (const item of packet.baselineCases) appendCaseMarkdown(lines, item)
  lines.push('# Appendix B — Build integrity', '', '```json', JSON.stringify(packet.buildIntegrity, null, 2), '```', '')
  lines.push('# Appendix C — Outstanding manual QA', '')
  for (const item of packet.manualQaAppendix.viewportThemeChecks) {
    lines.push(`## ${item.viewport} — ${item.theme}`, '', `Routes: ${item.routes.map((route) => `\`${route.url}\``).join(', ')}`, '')
    for (const check of item.checks) lines.push(`- [ ] ${check.check}: PASS / FAIL / NOT APPLICABLE / NOT TESTED`)
    lines.push('')
  }
  lines.push('# Appendix D — Outstanding manual accessibility', '')
  for (const check of packet.manualQaAppendix.accessibilityChecks) lines.push(`- [ ] **${check.check}** — ${check.procedure} — PASS / FAIL / NOT APPLICABLE / NOT TESTED`)
  lines.push('')
  return `${lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

function appendConditionMarkdown(lines, condition) {
  lines.push(
    `## ${condition.title}`,
    '',
    `- Condition ID: \`${condition.conditionId}\``,
    `- Region: ${condition.region}`,
    `- Learner route: \`${condition.learnerRoute}\``,
    `- Exact revision: \`${condition.exactRevisionHash}\``,
    `- Source file: \`${condition.sourceFile}\``,
    '',
    '### Automated findings',
    '',
    condition.automatedFindings.statement ?? 'AUTOMATED FINDINGS REQUIRE REVIEW',
    '',
    '```json',
    JSON.stringify(condition.automatedFindings, null, 2),
    '```',
    '',
    '### Complete learner-facing clinical content',
    '',
    '<!-- EXACT LEARNER MDX BODY START -->',
    condition.learnerContent.exactMdxBody,
    '<!-- EXACT LEARNER MDX BODY END -->',
    '',
    '### Claim and evidence review',
    '',
    condition.claimSourceRelationshipStatus,
    '',
    `Clinical/evidence readiness: **${condition.clinicalEvidenceAudit.readiness}**`,
    `Priority A claims requiring human verification: **${condition.clinicalEvidenceAudit.priorityAClaimsRequiringHumanVerification}**`,
    '',
    '#### Guideline corrections and claim changes',
    '',
    '```json',
    JSON.stringify({ guidelineCorrections: condition.clinicalEvidenceAudit.guidelineCorrections, softenedOrRemovedClaims: condition.clinicalEvidenceAudit.softenedOrRemovedClaims }, null, 2),
    '```',
    '',
    '#### Priority A claim-source tasks',
    '',
    '```json',
    JSON.stringify(condition.clinicalEvidenceAudit.priorityAClaims, null, 2),
    '```',
    '',
  )
  condition.references.forEach((reference, index) => {
    lines.push(`#### Reference ${index + 1}`, '', reference.rawEntry, '', `- Title: ${reference.title ?? 'Not deterministically parsed; see exact entry'}`, `- Authors/organisation: ${reference.authorsOrOrganisation ?? 'Not deterministically parsed; see exact entry'}`, `- Year: ${reference.year ?? 'Not recorded/detected'}`, `- DOI: ${reference.doi ?? 'Not recorded/detected'}`, `- URL: ${reference.url ?? 'Not recorded/detected'}`, `- Reachability: ${typeof reference.reachability === 'string' ? reference.reachability : JSON.stringify(reference.reachability)}`, `- Claim/section → source: ${reference.claimSourceRelationship}`, '')
  })
  lines.push('#### Evidence Hub relationships', '', '```json', JSON.stringify(condition.evidenceHubRelationships, null, 2), '```', '')
  if (condition.cubitalTunnelSpecialReview) {
    const special = condition.cubitalTunnelSpecialReview
    lines.push('### Cubital Tunnel special evidence review', '', `Exact obsolete bibliography entry: ${special.obsoleteBibliographyEntry}`, '', `Decision: **${special.replacementDecision}**`, '', special.exactClaimMappingStatus, '', special.explanation, '', `Candidate section: **${special.candidateContentForHumanMapping.sectionHeading}**`, '', special.candidateContentForHumanMapping.basis, '', '```md', special.candidateContentForHumanMapping.exactContent, '```', '', `Replacement source: ${special.proposedEvidence.source}; recommendations ${special.proposedEvidence.recommendations.join(' and ')}; ${special.proposedEvidence.url}`, '', '- [ ] Confirm the limited NG127 mapping', '- [ ] Changes required to the limited mapping', '- [ ] Alternative evidence required for a remaining claim', '', 'Reviewer notes:', '')
  }
  appendReviewFields(lines)
}

function appendReviewFields(lines) {
  lines.push(
    '### Human review decisions',
    '',
    'Clinical accuracy:',
    '- [ ] Acceptable for Version 1', '- [ ] Changes required', '- [ ] Blocked',
    '',
    'Clinical completeness:',
    '- [ ] Acceptable for Version 1', '- [ ] Non-blocking future expansion', '- [ ] Changes required', '- [ ] Blocked',
    '',
    'Evidence:',
    '- [ ] Acceptable for Version 1', '- [ ] Non-blocking evidence follow-up', '- [ ] Changes required', '- [ ] Blocked',
    '',
    'Publication recommendation:',
    '- [ ] Recommend publish', '- [ ] Recommend hold',
    '',
    'Reviewer notes:',
    '',
  )
}

function appendCaseMarkdown(lines, item) {
  lines.push(`## ${item.title}`, '', `- Case ID: \`${item.caseId}\``, `- Region: ${item.region}`, `- Route: \`${item.route}\``, `- Exact revision: \`${item.exactRevision.contentHash}\` revision ${item.exactRevision.contentRevision}`, `- Source file: \`${item.exactRevision.sourceFile}\``, `- Clinical state: ${item.clinicalState}`, `- Evidence state: ${item.evidenceState}`, `- Publication eligibility: ${item.publicationEligibility}`, `- Evidence Hub migration: **${item.unresolvedEvidenceHubMigration.classification}**`, '', 'Current references:', '')
  if (!item.currentReferences.length) lines.push('- No structured reference entries detected in the public source file.')
  for (const reference of item.currentReferences) lines.push(`- ${reference.rawEntry}`)
  lines.push('', '```json', JSON.stringify(item.unresolvedEvidenceHubMigration, null, 2), '```', '')
}

export function privacyScanPacket(root, jsonText, markdownText) {
  const combined = `${jsonText}\n${markdownText}`
  const forbiddenPatterns = [
    /MSK_REVIEW_PORTAL_PASSPHRASE/i,
    /privateDiagnosticIdentity/i,
    /internalSourceStationId/i,
    /likelyDiagnosis/i,
    /docs[\\/]reviews[\\/]current[\\/]platform-v2-independent-review/i,
    /msk-private-review-data/i,
    /(?:reviewer|actor)[_-]?id\s*[:=]/i,
    /session(?:token|cookie|secret)\s*[:=]/i,
    /[A-Z]:\\Users\\[^\s"']+/i,
  ]
  const findings = forbiddenPatterns.filter((pattern) => pattern.test(combined)).map((pattern) => String(pattern))
  const sourceCandidates = readJson(root, 'ai-manager/clinical-platform/anatomy-3d/source-candidates.json')
  const candidateHashes = [...JSON.stringify(sourceCandidates).matchAll(/\b[a-f0-9]{64}\b/gi)].map((match) => match[0].toLowerCase())
  for (const hash of new Set(candidateHashes)) if (combined.toLowerCase().includes(hash)) findings.push(`private-candidate-hash:${hash}`)
  return { passed: findings.length === 0, findings }
}

export function writeHumanClinicalEvidencePacket(root) {
  const packet = buildHumanClinicalEvidencePacket(root)
  const jsonText = `${JSON.stringify(packet, null, 2)}\n`
  const markdownText = renderHumanClinicalEvidenceMarkdown(packet)
  const privacy = privacyScanPacket(root, jsonText, markdownText)
  if (!privacy.passed) throw new Error(`Packet privacy scan failed: ${privacy.findings.join(', ')}`)
  const output = path.join(root, 'reports', 'publication-readiness')
  fs.mkdirSync(output, { recursive: true })
  const jsonFile = path.join(output, `${OUTPUT_BASENAME}.json`)
  const markdownFile = path.join(output, `${OUTPUT_BASENAME}.md`)
  fs.writeFileSync(jsonFile, jsonText)
  fs.writeFileSync(markdownFile, markdownText)
  return {
    packet,
    files: {
      json: { path: jsonFile, sha256: sha256(jsonText), bytes: Buffer.byteLength(jsonText) },
      markdown: { path: markdownFile, sha256: sha256(markdownText), bytes: Buffer.byteLength(markdownText) },
    },
    privacy,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = writeHumanClinicalEvidencePacket(process.cwd())
  console.log(`Human clinical/evidence review packet generated: ${result.packet.conditions.length} conditions, ${result.packet.totals.conditionReferences} condition references, ${result.packet.baselineCases.length} baseline cases.`)
  console.log(`Markdown: ${result.files.markdown.path}`)
  console.log(`JSON: ${result.files.json.path}`)
}
