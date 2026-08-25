import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { applyV1ClinicalEvidenceAudit, createV1ClinicalEvidenceAudit } from './v1-clinical-evidence-audit.mjs'
import { loadVerifiedV1FinalConditionConfirmation } from './v1-final-condition-confirmation.mjs'
import { loadOptionalV1IndependentFinalRecommendations } from './v1-independent-final-recommendations.mjs'

export const V1_PUBLICATION_REGIONS = Object.freeze(['cervical', 'shoulder', 'elbow'])
export const V1_REVIEW_DECISIONS = Object.freeze({
  clinical: ['acceptable', 'changes-required', 'blocked'],
  evidence: ['acceptable-for-v1', 'follow-up-non-blocking', 'changes-required', 'blocked'],
  publication: ['recommend-publish', 'recommend-hold'],
})

const knownEvidenceFindings = Object.freeze({
  'https://cks.nice.org.uk/topics/peripheral-neuropathy/': Object.freeze({
    id: 'obsolete-nice-cks-peripheral-neuropathy',
    status: 'publication-blocker',
    automatedFinding: 'The cited NICE CKS topic URL resolves to a NICE page-not-found response in an ordinary browser.',
    claimAssociation: 'The bibliography entry is not connected to an inline citation, so the repository cannot identify one exact supported claim.',
    candidateClaimLocations: [
      'Management & Treatment > Community Physiotherapy: activity modification and splinting',
      'Conservative Management > Activity Modification: avoiding sustained flexion and medial elbow pressure',
      'Conservative Management > Elbow Extension Splinting at Night',
      'Onward Referral Criteria',
    ],
    replacementAssessment: {
      decision: 'PARTIAL SUPPORT — HUMAN EVIDENCE DECISION REQUIRED',
      proposedSource: 'NICE NG127: Suspected neurological conditions: recognition and referral, recommendations 1.7.9–1.7.10',
      proposedUrl: 'https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16#compression-neuropathy',
      directlySupports: [
        'splint referral for clear ulnar compression neuropathy without radiculopathy',
        'review after 6 weeks and neurological assessment if there is no improvement',
        'avoiding activities that add pressure to the affected nerve',
      ],
      doesNotEstablish: [
        'the page’s detailed splint angle or minimum 3-month duration',
        'the neurodynamic exercise prescription',
        'the page’s 3–6 month surgical-referral threshold',
        'the page’s electrodiagnostic or operative thresholds',
      ],
      sourceChangePrepared: false,
      humanDecisionRequired: true,
    },
  }),
})

const standardSections = Object.freeze([
  ['overview', /^overview(?:\s*&\s*pathophysiology)?$/i],
  ['special-tests', /^special tests$/i],
  ['red-flags', /^red flags$/i],
  ['clinical-frameworks', /^clinical frameworks$/i],
  ['outcome-measures', /^outcome measures$/i],
  ['evidence-based-diagnosis', /^evidence-based diagnosis$/i],
  ['differential-diagnosis', /^differential diagnosis$/i],
  ['management-and-treatment', /^management\s*&\s*treatment$/i],
  ['key-references', /^key references$/i],
])

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/')
}

function normalizeHeading(value) {
  return value.replace(/[`*_]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function headingRecords(body) {
  return [...body.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map((match) => ({
    level: match[1].length,
    title: normalizeHeading(match[2]),
    index: match.index,
    bodyStart: match.index + match[0].length,
  }))
}

function sectionBody(body, headings, index) {
  const current = headings[index]
  const next = headings.slice(index + 1).find((heading) => heading.level <= current.level)
  return body.slice(current.bodyStart, next?.index ?? body.length).trim()
}

function extractLinks(body) {
  const links = []
  for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    links.push({ label: normalizeHeading(match[1]), url: match[2] })
  }
  return links
}

function extractReferenceEntries(body, headings) {
  const referenceIndex = headings.findIndex((heading) => heading.level === 2 && /^key references$/i.test(heading.title))
  if (referenceIndex === -1) return []
  const section = sectionBody(body, headings, referenceIndex)
  const links = extractLinks(section)
  const lines = section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line))
  return lines.map((line, index) => {
    const link = links.find((candidate) => line.includes(candidate.url)) ?? null
    const plainUrl = line.match(/https?:\/\/[^\s)]+/)?.[0]?.replace(/[.,;]+$/, '') ?? null
    const clean = normalizeHeading(line.replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
    const year = clean.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null
    return {
      id: `reference-${String(index + 1).padStart(2, '0')}`,
      title: clean,
      organisationOrJournal: null,
      year,
      urlOrDoi: link?.url ?? plainUrl,
      supportingSections: [],
      sourcePresent: true,
      claimSourceRelationshipVerified: false,
      humanEvidenceReviewComplete: false,
      metadataSufficientToIdentify: Boolean(clean && (year || link?.url || plainUrl)),
    }
  })
}

function loadEvidenceHubConditions(root) {
  const directory = path.join(root, 'content', 'evidence-hub', 'conditions')
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => {
    const file = path.join(directory, name)
    return { sourceFile: relative(root, file), record: JSON.parse(fs.readFileSync(file, 'utf8')) }
  })
}

function evidenceHubMatches(records, id, region, slug) {
  return records.filter(({ record, sourceFile }) => {
    const text = JSON.stringify(record).toLowerCase()
    return text.includes(id.toLowerCase()) || text.includes(`condition.${region}.${slug}`) || sourceFile.includes(`${region}.${slug}`)
  }).map(({ sourceFile, record }) => ({
    sourceFile,
    recordId: record.id ?? record.conditionId ?? null,
    lifecycleStatus: record.lifecycleStatus ?? record.status ?? null,
    reviewStatus: record.reviewStatus ?? null,
    publicEligibility: record.publicEligibility ?? null,
    claimSourceRelationshipVerified: false,
    humanEvidenceReviewComplete: false,
  }))
}

function inspectCondition(root, region, filename, evidenceHubRecords) {
  const file = path.join(root, 'content', region, filename)
  const source = fs.readFileSync(file, 'utf8')
  const parsed = matter(source)
  const slug = filename.slice(0, -4)
  const id = `condition.${region}.${slug}`
  const headings = headingRecords(parsed.content)
  const h2 = headings.filter((heading) => heading.level === 2)
  const sectionTitles = h2.map((heading) => heading.title)
  const missingStandardSections = standardSections
    .filter(([, pattern]) => !sectionTitles.some((title) => pattern.test(title)))
    .map(([name]) => name)
  const blankSections = headings.filter((heading, index) => !sectionBody(parsed.content, headings, index)).map((heading) => heading.title)
  const headingCounts = new Map()
  for (const heading of headings) {
    const key = heading.title.toLowerCase()
    headingCounts.set(key, (headingCounts.get(key) ?? 0) + 1)
  }
  const duplicateSections = [...headingCounts].filter(([, count]) => count > 1).map(([title, count]) => ({ title, count }))
  const placeholderMatches = [...parsed.content.matchAll(/\b(?:TODO|TBD|FIXME|LOREM IPSUM|INSERT (?:TEXT|LINK|REFERENCE)|PLACEHOLDER)\b/gi)].map((match) => match[0])
  const encodingCorruption = [...parsed.content.matchAll(/(?:\uFFFD|â(?:€™|€œ|€|€“|€”|€¦)|Ã[A-Za-z])/g)].map((match) => match[0])
  const h1 = headings.filter((heading) => heading.level === 1)
  const references = extractReferenceEntries(parsed.content, headings)
  const evidenceHub = evidenceHubMatches(evidenceHubRecords, id, region, slug)
  const evidenceFindings = references
    .map((reference) => knownEvidenceFindings[reference.urlOrDoi])
    .filter(Boolean)
    .map((finding) => structuredClone(finding))
  const findings = []
  if (parsed.data.region !== region) findings.push(`region-label-mismatch:${parsed.data.region ?? 'missing'}`)
  if (parsed.data.category !== 'condition') findings.push(`category-mismatch:${parsed.data.category ?? 'missing'}`)
  if (missingStandardSections.length) findings.push(`missing-standard-sections:${missingStandardSections.join(',')}`)
  if (blankSections.length) findings.push(`blank-sections:${blankSections.join(',')}`)
  if (duplicateSections.length) findings.push(`duplicate-headings:${duplicateSections.map((item) => item.title).join(',')}`)
  if (h1.length) findings.push(`duplicate-page-title-h1:${h1.map((item) => item.title).join(',')}`)
  if (placeholderMatches.length) findings.push(`unresolved-placeholders:${[...new Set(placeholderMatches)].join(',')}`)
  if (encodingCorruption.length) findings.push(`encoding-corruption:${[...new Set(encodingCorruption)].join(',')}`)
  if (!references.length) findings.push('no-structured-reference-entries-detected')
  const blockers = [
    'explicit-clinical-review-decision-not-recorded',
    'explicit-evidence-review-decision-not-recorded',
    'explicit-publication-recommendation-not-recorded',
    ...findings.map((finding) => `technical-review:${finding}`),
    ...evidenceFindings.filter((finding) => finding.status === 'publication-blocker').map((finding) => `evidence-review:${finding.id}`),
  ]
  const reviewCategory = evidenceFindings.some((finding) => finding.status === 'publication-blocker')
    ? 'publication-blocker'
    : evidenceFindings.length
      ? 'evidence-follow-up-required'
      : findings.length
        ? 'clinical-content-issue-detected'
        : 'no-automated-issue-detected-human-confirmation-only'
  return {
    id,
    conditionId: slug,
    title: parsed.data.title ?? slug,
    region,
    sourceFile: relative(root, file),
    learnerRoute: `/${region}/${slug}`,
    exactRevisionHash: sha256(source),
    currentPublicationExposure: 'public-by-default-taxonomy-selection',
    lifecycle: 'review-required',
    publicationState: 'legacy-publication-review-required',
    clinicalReviewStatus: 'not-recorded',
    evidenceReviewStatus: 'not-recorded',
    publicationDecisionStatus: 'not-recorded',
    completeness: {
      status: findings.length ? 'technical-findings-present' : 'standard-sections-present',
      standardSections: standardSections.map(([name]) => name),
      presentSections: sectionTitles,
      missingStandardSections,
      blankSections,
      duplicateSections,
      duplicateH1Count: h1.length,
      unresolvedPlaceholders: [...new Set(placeholderMatches)],
      encodingCorruption: [...new Set(encodingCorruption)],
      staleInternalLinks: [],
      regionLabelCorrect: parsed.data.region === region,
    },
    evidence: {
      declaredEvidenceLevel: parsed.data.evidence_level ?? null,
      sources: references,
      sourcePresent: references.length > 0,
      claimSourceRelationshipVerified: false,
      humanEvidenceReviewComplete: false,
      evidenceHubRelationships: evidenceHub,
      evidenceFindings,
      unresolvedGaps: [
        'claim-to-source relationships have not been human-verified',
        ...(evidenceHub.length ? [] : ['no condition-specific Evidence Hub relationship is recorded']),
      ],
    },
    contradictionsOrFindings: findings,
    obsoleteOrRestrictedLinks: evidenceFindings.map((finding) => ({
      id: finding.id,
      status: finding.status,
      claimAssociation: finding.claimAssociation,
      replacementAssessment: finding.replacementAssessment,
    })),
    reviewCategory,
    reviewPriority: reviewCategory === 'publication-blocker' ? 0 : reviewCategory === 'evidence-follow-up-required' ? 1 : reviewCategory === 'clinical-content-issue-detected' ? 2 : 3,
    reviewTasks: [
      { kind: 'clinical-review', requiredDecision: [...V1_REVIEW_DECISIONS.clinical] },
      { kind: 'evidence-review', requiredDecision: [...V1_REVIEW_DECISIONS.evidence] },
      { kind: 'publication-recommendation', requiredDecision: [...V1_REVIEW_DECISIONS.publication] },
    ],
    reviewerNotes: [],
    finalBlockers: blockers,
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

export function loadV1ConditionReviewRecords(repositoryRoot) {
  const evidenceHubRecords = loadEvidenceHubConditions(repositoryRoot)
  return V1_PUBLICATION_REGIONS.flatMap((region) => {
    const directory = path.join(repositoryRoot, 'content', region)
    return fs.readdirSync(directory).filter((name) => name.endsWith('.mdx')).sort()
      .map((filename) => inspectCondition(repositoryRoot, region, filename, evidenceHubRecords))
      .sort((left, right) => left.reviewPriority - right.reviewPriority || left.title.localeCompare(right.title))
  })
}

export function loadAuditedV1ConditionReviewRecords(repositoryRoot) {
  const records = loadV1ConditionReviewRecords(repositoryRoot)
  const audit = createV1ClinicalEvidenceAudit(repositoryRoot, records)
  const auditByCondition = new Map(audit.conditions.map((item) => [item.conditionId, item]))
  return records.map((record) => applyV1ClinicalEvidenceAudit(record, auditByCondition.get(record.id)))
}

export function createLegacyConditionGovernanceOverlay(record) {
  return {
    conditionId: record.id,
    exactRevisionHash: record.exactRevisionHash,
    existingPublicExposure: record.currentPublicationExposure,
    clinicalReview: 'review-required',
    evidenceReview: 'review-required',
    publicationReview: 'legacy-publication-review-required',
    historicalPublicExposure: true,
    transitionActivated: false,
    learnerExposureChanged: false,
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

export function createConditionReviewCard(record) {
  return {
    condition: record.title,
    conditionId: record.id,
    region: record.region,
    exactRevision: record.exactRevisionHash,
    publicRoute: record.learnerRoute,
    reviewCategory: record.reviewCategory,
    clinicalContentFindings: record.contradictionsOrFindings,
    evidenceFindings: record.evidence.evidenceFindings,
    unresolvedEvidenceRelationships: record.evidence.unresolvedGaps,
    obsoleteOrRestrictedLinks: record.obsoleteOrRestrictedLinks,
    contradictions: record.contradictionsOrFindings.filter((finding) => finding.startsWith('contradiction:')),
    missingSections: record.completeness.missingStandardSections,
    automatedReviewStatement: record.reviewCategory === 'no-automated-issue-detected-human-confirmation-only'
      ? 'NO STRUCTURAL OR CONTENT DEFECT DETECTED'
      : null,
    publicationRecommendationOptions: [...V1_REVIEW_DECISIONS.publication],
    priorityAReviewTasks: record.clinicalEvidenceAudit?.priorityAClaims ?? [],
    priorityAClaimsRequiringHumanVerification: record.clinicalEvidenceAudit?.priorityAClaimsRequiringHumanVerification ?? 0,
    canonicalClaims: record.clinicalEvidenceAudit?.canonicalClaims ?? [],
    canonicalClaimsRequiringHumanVerification: record.clinicalEvidenceAudit?.canonicalClaimsRequiringHumanVerification ?? 0,
    clinicalEvidenceReadiness: record.clinicalEvidenceAudit?.readiness ?? 'not-audited',
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

export function createV1PublicationReviewAdapter(createItem) {
  return {
    id: 'v1-publication-review-read-only',
    regions: [...V1_PUBLICATION_REGIONS],
    load({ repositoryRoot }) {
      const finalConfirmation = loadVerifiedV1FinalConditionConfirmation(repositoryRoot)
      const finalByCondition = new Map((finalConfirmation?.conditions ?? []).map((item) => [item.conditionId, item]))
      const independentRecommendations = loadOptionalV1IndependentFinalRecommendations(repositoryRoot, finalConfirmation?.conditions ?? [])
      const independentByCondition = new Map(independentRecommendations.conditions.map((item) => [item.conditionId, item]))
      return loadAuditedV1ConditionReviewRecords(repositoryRoot).map((record) => createItem({
        id: record.id,
        region: record.region,
        contentType: 'conditions',
        title: record.title,
        lifecycle: record.lifecycle,
        publicationState: record.publicationState,
        clinicalReview: record.clinicalReviewStatus,
        evidenceReview: record.evidenceReviewStatus,
        accessibilityReview: 'manual-exact-build-review-required',
        licensingReview: 'baseline-public-source-review-required',
        blockers: record.finalBlockers,
        reviewTasks: record.reviewTasks,
        sourceLinks: [record.sourceFile, ...record.evidence.evidenceHubRelationships.map((item) => item.sourceFile)],
        revisionHash: record.exactRevisionHash,
        currentContent: {
          v1PublicationReview: record,
          finalConditionConfirmation: finalByCondition.get(record.id) ?? null,
          independentFinalRecommendation: independentByCondition.get(record.id) ?? null,
          independentRecommendationAvailability: independentRecommendations.available ? 'revision-matched' : 'not-available',
        },
        learnerPreview: { route: record.learnerRoute, label: 'Open current learner condition' },
        missingFields: record.finalBlockers,
      }))
    },
  }
}

export function summarizeV1PublicationReview(records, actions = []) {
  const latestByTarget = new Map()
  for (const action of actions.filter((item) => item.type === 'record-v1-publication-review')) {
    if (!latestByTarget.has(action.targetId) || String(latestByTarget.get(action.targetId).createdAt) < String(action.createdAt)) latestByTarget.set(action.targetId, action)
  }
  const regions = Object.fromEntries(V1_PUBLICATION_REGIONS.map((region) => {
    const items = records.filter((record) => record.region === region)
    const decisions = items.map((record) => latestByTarget.get(record.id)).filter(Boolean)
    return [region, {
      conditionsReviewed: decisions.length,
      totalConditions: items.length,
      clinicalReviewed: decisions.filter((decision) => V1_REVIEW_DECISIONS.clinical.includes(decision.clinicalDecision)).length,
      evidenceReviewed: decisions.filter((decision) => V1_REVIEW_DECISIONS.evidence.includes(decision.evidenceDecision)).length,
      publicationRecommendationsRecorded: decisions.filter((decision) => V1_REVIEW_DECISIONS.publication.includes(decision.publicationRecommendation)).length,
      clinicalDecisions: countBy(decisions, 'clinicalDecision'),
      evidenceDecisions: countBy(decisions, 'evidenceDecision'),
      publicationRecommendations: countBy(decisions, 'publicationRecommendation'),
      remainingDecisionBlockers: items.length - decisions.length,
    }]
  }))
  const canonicalClaims = [...new Map(records.flatMap((record) => record.clinicalEvidenceAudit?.canonicalClaims ?? []).map((claim) => [claim.id, claim])).values()]
  const currentClaimById = new Map(canonicalClaims.map((claim) => [claim.id, claim]))
  const reviewedCanonicalClaimIds = new Set(actions.filter((item) => item.type === 'record-v1-claim-review')
    .filter((item) => currentClaimById.get(item.targetId)?.revisionHash === item.exactRevisionKey)
    .map((item) => item.targetId))
  return {
    schemaVersion: 1,
    regions,
    reviewOrder: V1_PUBLICATION_REGIONS.flatMap((region) => records.filter((record) => record.region === region).map((record) => record.id)),
    categoryCounts: Object.fromEntries([
      'no-automated-issue-detected-human-confirmation-only',
      'evidence-follow-up-required',
      'clinical-content-issue-detected',
      'publication-blocker',
    ].map((category) => [category, records.filter((record) => record.reviewCategory === category).length])),
    canonicalReview: {
      priorityARawTasks: records.reduce((total, record) => total + (record.clinicalEvidenceAudit?.priorityAClaims.length ?? 0), 0),
      canonicalClaims: canonicalClaims.length,
      duplicatesAndOverlapsCollapsed: records.reduce((total, record) => total + (record.clinicalEvidenceAudit?.priorityAClaims.length ?? 0), 0) - canonicalClaims.length,
      evidenceMappedAutomatically: canonicalClaims.filter((claim) => claim.claimSourceRelationshipVerified).length,
      humanReviewed: reviewedCanonicalClaimIds.size,
      humanReviewRemaining: canonicalClaims.filter((claim) => !reviewedCanonicalClaimIds.has(claim.id)).length,
      critical: canonicalClaims.filter((claim) => claim.severity === 'CRITICAL' && !reviewedCanonicalClaimIds.has(claim.id)).length,
      major: canonicalClaims.filter((claim) => claim.severity === 'MAJOR' && !reviewedCanonicalClaimIds.has(claim.id)).length,
      supporting: canonicalClaims.filter((claim) => claim.severity === 'SUPPORTING' && !reviewedCanonicalClaimIds.has(claim.id)).length,
      reviewedCanonicalClaimIds: [...reviewedCanonicalClaimIds].sort(),
      grantsApproval: false,
      publicationAuthorized: false,
    },
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

function countBy(records, field) {
  return Object.fromEntries([...new Set(records.map((record) => record[field]).filter(Boolean))].sort().map((value) => [value, records.filter((record) => record[field] === value).length]))
}
