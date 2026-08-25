import crypto from 'node:crypto'

export const V1_SOURCE_BUNDLES = Object.freeze({
  cervicalVascular: bundle('Cervical vascular safety', [
    source('ifompt2020', 'International IFOMPT Cervical Framework', 2020, 'https://www.ifompt.org/site/ifompt/IFOMPT%20Cervical%20Framework%20final%20September%202020.pdf', 'History, risk assessment, clinical examination and clinical reasoning framework'),
    source('ahaCad2024', 'Treatment and Outcomes of Cervical Artery Dissection in Adults', 2024, 'https://doi.org/10.1161/STR.0000000000000457', 'Abstract and diagnosis/treatment sections'),
  ], ['Risk-based cervical vascular clinical reasoning', 'Neurological/vascular feature recognition', 'Avoiding positional testing as a clearance screen', 'Specialist-led dissection treatment'], ['A fixed manipulation-causation rate', 'A single symptom checklist as a diagnostic rule', 'Automatic clearance for manual therapy after dissection']),
  dcm: bundle('Degenerative cervical myelopathy', [source('aoSpineDcm2017', 'Clinical practice guideline for degenerative cervical myelopathy', 2017, 'https://doi.org/10.1177/2192568217701914', 'Summary of recommendations; mild, moderate and severe DCM sections')], ['Surgery for moderate/severe DCM', 'Mild DCM options and escalation after deterioration/failure to improve', 'Nonmyelopathic cord-compression counselling'], ['Fixed local referral times', 'Collar protocols', 'Postoperative rehabilitation timelines', 'Drug regimens']),
  neurologicalReferral: bundle('Neurological recognition and referral', [source('niceNg127', 'NICE NG127: Suspected neurological conditions', 2019, 'https://www.nice.org.uk/guidance/ng127/chapter/Recommendations-for-adults-aged-over-16', '1.7.9–1.7.10 compression neuropathy; 1.10.11–1.10.12 cervical radiculopathy')], ['Stable cervical-radiculopathy referral exceptions', 'Ulnar compression splint referral, six-week review and pressure avoidance'], ['Cubital-tunnel splint angle or duration', 'Electrodiagnostic thresholds', 'Surgical thresholds', 'Drug or injection regimens']),
  neuropathicPain: bundle('Neuropathic pain prescribing boundary', [source('niceCg173', 'NICE CG173: Neuropathic pain in adults', 2013, 'https://www.nice.org.uk/guidance/cg173/chapter/Recommendations', '1.1 pharmacological management')], ['Medicine choices for an established neuropathic-pain indication under current prescribing guidance'], ['Condition-specific dosing outside the guideline scope', 'Automatic diagnosis of neuropathic pain', 'Injection or surgical management']),
  cervicogenicHeadache: bundle('Cervicogenic headache classification', [source('ichd3Cgh', 'ICHD-3 11.2.1 Cervicogenic headache', 2018, 'https://ichd-3.org/11-headache-or-facial-pain-attributed-to-disorder-of-the-cranium-neck-eyes-ears-nose-sinuses-teeth-mouth-or-other-facial-or-cervical-structure/11-2-headache-attributed-to-disorder-of-the-neck/11-2-1-cervicogenic-headache/', 'Diagnostic criteria and notes')], ['Secondary-headache definition', 'Diagnostic criteria and causation evidence', 'Caveats about imaging and provocative manoeuvres'], ['CFRT as a definitive standalone diagnosis', 'A fixed manual-therapy response', 'Medication regimens']),
  shoulderPathways: bundle('BESS shoulder pathways', [
    source('bessPathways', 'BESS Patient Care Pathways and Guidelines', 2025, 'https://bess.ac.uk/patient-care-pathways-and-guidelines/', 'Condition-specific frozen shoulder, instability and subacromial pathways'),
    source('josptRct2025', 'Rotator Cuff Tendinopathy Clinical Practice Guideline', 2025, 'https://doi.org/10.2519/jospt.2025.13182', 'Diagnosis, nonsurgical management and return-to-function recommendations'),
  ], ['Condition-specific clinical pathways where the named pathway applies', 'Exercise-led rotator-cuff tendinopathy care', 'Appropriate referral/escalation concepts'], ['Applying the subacromial pathway to every shoulder condition', 'Fixed injection doses', 'Unsupported local waiting times', 'A universal operative threshold']),
  calcificTendinopathy: bundle('Calcific tendinopathy / ESWT', [source('niceHtg645', 'NICE HTG645: ESWT for calcific tendinopathy in the shoulder', 2022, 'https://www.nice.org.uk/guidance/htg645', 'Recommendation 1.1')], ['ESWT research-only governance position'], ['A routine ESWT protocol', 'A precise lavage or injection protocol', 'Comparative efficacy not established by the recommendation']),
  osteoarthritis: bundle('General osteoarthritis management', [source('niceNg226', 'NICE NG226: Osteoarthritis in over 16s', 2022, 'https://www.nice.org.uk/guidance/ng226/chapter/recommendations', '1.2 core treatments; 1.4 medicines/injections; 1.6 referral')], ['General OA education/exercise and medicine recommendations', 'Short-term nature of intra-articular corticosteroid relief'], ['Elbow-specific efficacy where evidence was derived from other joints', 'A local elbow pathway', 'A fixed injection protocol']),
  tennisElbow: bundle('Lateral elbow tendinopathy', [source('bessTennisElbow2023', 'BESS patient care pathway: Tennis elbow', 2023, 'https://doi.org/10.1177/17585732231170793', 'Red flags, primary/community care, referral and treatment pathway')], ['Lateral elbow tendinopathy red flags and pathway-level management'], ['Medial epicondylalgia as automatically equivalent', 'Fixed medicine/injection regimens', 'Local provider availability']),
})

export const V1_NECESSITY = Object.freeze(['ESSENTIAL', 'USEFUL BUT NON-ESSENTIAL', 'OUT-OF-SCOPE PRECISION'])
export const V1_STARTING_CANONICAL_CLAIMS = 304

export function createPublicationMinimumReview(canonicalClaims, options = {}) {
  const triagedClaims = canonicalClaims.map(triageClaim)
  const resolution = triagedClaims.map((claim) => {
    const resolved = resolveClaim(claim)
    if (options.criticalOwnerAdoption && options.criticalClaimCoveredByOwnerAdoption?.(claim, options.criticalOwnerAdoption)) return ownerConfirmed(resolved, 'OWNER-CONFIRMED RECOMMENDATION IMPLEMENTED', options.criticalOwnerAdoption)
    if (options.majorOwnerAdoption && options.majorClaimCoveredByOwnerAdoption?.(claim, options.majorOwnerAdoption)) return ownerConfirmed(resolved, 'OWNER-CONFIRMED MAJOR RECOMMENDATION IMPLEMENTED', options.majorOwnerAdoption)
    return resolved
  })
  const humanCandidates = resolution.filter((claim) => claim.outcome === 'HUMAN CONFIRMATION' || claim.outcome === 'CONTENT CHANGE REQUIRED' || claim.outcome === 'BLOCKED')
  const humanDecisions = groupHumanDecisions(humanCandidates)
  return {
    schemaVersion: 1,
    startingCanonicalClaims: V1_STARTING_CANONICAL_CLAIMS,
    currentCanonicalClaims: triagedClaims.length,
    canonicalClaimsRemovedOrCollapsedByContentHardening: V1_STARTING_CANONICAL_CLAIMS - triagedClaims.length,
    necessityCounts: countBy(triagedClaims, 'necessity'),
    outcomeCounts: countBy(resolution, 'outcome'),
    severityOutcomes: Object.fromEntries(['CRITICAL', 'MAJOR', 'SUPPORTING'].map((severity) => [severity, countBy(resolution.filter((item) => item.severity === severity), 'outcome')])),
    directEvidenceRelationships: resolution.filter((item) => item.outcome === 'DIRECTLY VERIFIED').length,
    automaticV1Exclusions: resolution.filter((item) => ['REMOVE FROM V1', 'FUTURE EVIDENCE EXPANSION'].includes(item.outcome)).length,
    humanDecisionCount: humanDecisions.length,
    triagedClaims: resolution,
    humanDecisions,
    grantsApproval: false,
    publicationAuthorized: false,
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
  }
}

function ownerConfirmed(resolved, outcome, adoption) {
  return {
    ...resolved,
    outcome,
    recommendedAction: 'The independent recommendation and resulting wording/evidence disposition were confirmed by the human owner and verified against the resulting file hash. This grants no clinical, evidence or publication approval.',
    ownerConfirmation: {
      actor: adoption.ownerConfirmation.actor,
      confirmedDate: adoption.ownerConfirmation.confirmedDate,
      grantsApproval: false,
      publicationAuthorized: false,
    },
  }
}

function triageClaim(claim) {
  const text = claim.exactLearnerClaims.join('\n')
  const local = claim.localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED'
  const boundaryStatement = isScopeBoundary(text)
  const exactPrecision = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mm|cm|degrees?|sessions?|weeks?|months?|days?)\b|\b(?:sensitivity|specificity|likelihood ratio|\+lr|-lr|mcid|minimal clinically important|\d+%)\b/i.test(text)
  const specialistTechnique = /\b(?:18g|needle technique|lavage|operative technique|suture|anchor placement|injection composition|hydrodilatation volume)\b/i.test(text)
  let necessity = 'ESSENTIAL'
  let necessityRationale = 'The claim affects safety recognition, escalation, material diagnostic reasoning or an essential management boundary.'
  if (boundaryStatement) {
    necessity = 'ESSENTIAL'
    necessityRationale = 'This wording records a fail-closed clinical, evidence, prescribing or service boundary rather than asserting the removed detail.'
  } else if (local && /\b(?:wait|hospital|trust|session|service|pathway|required|before referral|clinic destination)\b/i.test(text)) {
    necessity = 'OUT-OF-SCOPE PRECISION'
    necessityRationale = 'Operational local-service detail is volatile and is not required to teach the durable clinical escalation principle.'
  } else if (claim.primaryClass.code === 'D' || (claim.primaryClass.code === 'F' && claim.severity !== 'CRITICAL') || claim.severity === 'SUPPORTING') {
    necessity = 'USEFUL BUT NON-ESSENTIAL'
    necessityRationale = 'Exact test-performance, non-critical precaution or supporting detail can add context but is not required for a safe Version 1 page.'
  } else if (claim.primaryClass.code === 'E' && exactPrecision) {
    necessity = 'OUT-OF-SCOPE PRECISION'
    necessityRationale = 'Exact prescribing or treatment timing belongs in current prescribing/specialist guidance, not this physiotherapy learning page.'
  } else if (specialistTechnique) {
    necessity = 'OUT-OF-SCOPE PRECISION'
    necessityRationale = 'Specialist procedural technique is outside the Version 1 physiotherapy teaching objective.'
  } else if (claim.primaryClass.code === 'G' && exactPrecision && !/\b(?:moderate|severe|progressive|deteriorat|acute traumatic)\b/i.test(text)) {
    necessity = 'USEFUL BUT NON-ESSENTIAL'
    necessityRationale = 'A fixed operative threshold or timeline is not required for safe recognition and specialist referral.'
  } else if (claim.primaryClass.code === 'C' && !/\b(?:urgent|emergency|suspected fracture|cord compression|myelopath|vascular|stroke|progressive neurological)\b/i.test(text)) {
    necessity = 'USEFUL BUT NON-ESSENTIAL'
    necessityRationale = 'Detailed imaging or investigation material adds context but is not required for the core safety and referral objective.'
  }
  return { ...claim, necessity, necessityRationale, sourceBundle: sourceBundleFor(claim), scopeBoundaryStatement: boundaryStatement }
}

function resolveClaim(claim) {
  if (claim.scopeBoundaryStatement) return { ...claim, outcome: 'SCOPE BOUNDARY RECORDED', recommendedAction: 'Retain the explicit fail-closed boundary. It does not assert that the removed precision is supported or approved.', suggestedSafeWording: null }
  if (claim.verificationStatus === 'VERIFIED') return { ...claim, outcome: 'DIRECTLY VERIFIED', recommendedAction: 'Retain the revision-bound wording and mapping for human confirmation; this is not clinical approval.', suggestedSafeWording: null }
  if (claim.necessity === 'OUT-OF-SCOPE PRECISION') return { ...claim, outcome: 'CONTENT CHANGE REQUIRED', recommendedAction: 'Remove the operational, prescribing or specialist precision while preserving any separate durable escalation principle.', suggestedSafeWording: safeWording(claim) }
  if (claim.necessity === 'USEFUL BUT NON-ESSENTIAL') return { ...claim, outcome: 'FUTURE EVIDENCE EXPANSION', recommendedAction: 'Do not make the exact unsupported precision publication-essential; retain only a qualitative limitation if needed.', suggestedSafeWording: safeWording(claim) }
  if (claim.verificationStatus === 'PARTIAL SUPPORT' || claim.verificationStatus === 'EXTRAPOLATED') return { ...claim, outcome: 'HUMAN CONFIRMATION', recommendedAction: 'Confirm the source scope and wording; do not upgrade partial or extrapolated support automatically.', suggestedSafeWording: safeWording(claim) }
  return { ...claim, outcome: claim.severity === 'CRITICAL' ? 'HUMAN CONFIRMATION' : 'CONTENT CHANGE REQUIRED', recommendedAction: claim.severity === 'CRITICAL' ? 'A clinician must confirm the safety wording and authoritative source relationship.' : 'Confirm, simplify or remove the material assertion before publication.', suggestedSafeWording: safeWording(claim) }
}

function isScopeBoundary(text) {
  return /\b(?:does not (?:provide|establish|justify|prescribe|supply|specify|determine|confirm)|do not (?:use in isolation|use (?:it )?as|confirm|assume|establish|determine)|not (?:a standalone|definitive|diagnostic alone|required for routine|specified here|a mandatory)|no (?:single|fixed|condition-specific)[^\n]{0,80}(?:diagnos|protocol|regimen|threshold)|requires? (?:separate evidence|specialist interpretation|confirmation|trained interpretation|exact source verification)|must (?:be confirmed|not be extrapolated)|has been removed|have been removed|remain(?:s)? (?:under source review|unverified)|is (?:prescriber|specialist|medical-team|surgeon|service)-led|(?:is|are) determined by (?:the )?(?:specialist|service|medical|emergency|prescribing|surgical)|the (?:specialist|service|medical team|surgeon) determines|specialist decision|follow the current local pathway[^\n]{0,120}clinically indicated|only when clinically indicated|do not assume|does not assert|not automatically|future evidence expansion|this learner page does not)\b/i.test(text)
}

function groupHumanDecisions(claims) {
  const groups = new Map()
  for (const claim of claims) {
    const concept = sharedConcept(claim)
    const bundleKey = claim.sourceBundle ?? 'unmapped'
    const conditionKey = concept.startsWith('shared:') ? 'cross-condition' : claim.conditionIds.join('+')
    const key = `${claim.severity}:${claim.outcome}:${bundleKey}:${conditionKey}:${concept}:${claim.primaryClass.code}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(claim)
  }
  return [...groups.entries()].map(([key, groupedClaims]) => {
    const occurrences = groupedClaims.flatMap((claim) => claim.occurrences).sort((a, b) => a.sourceFile.localeCompare(b.sourceFile) || a.sourceLine - b.sourceLine)
    const revisionHash = `sha256:${hash(JSON.stringify(groupedClaims.map((claim) => [claim.id, claim.revisionHash]).sort()))}`
    return {
      id: `v1-human-${hash(key).slice(0, 16)}`,
      severity: highestSeverity(groupedClaims),
      primaryClass: groupedClaims[0].primaryClass,
      outcome: mostRestrictiveOutcome(groupedClaims),
      necessity: [...new Set(groupedClaims.map((claim) => claim.necessity))],
      whyItMatters: groupedClaims[0].necessityRationale,
      canonicalClaimIds: groupedClaims.map((claim) => claim.id).sort(),
      regions: [...new Set(groupedClaims.flatMap((claim) => claim.regions))].sort(),
      conditionIds: [...new Set(groupedClaims.flatMap((claim) => claim.conditionIds))].sort(),
      learnerClaims: [...new Set(groupedClaims.flatMap((claim) => claim.exactLearnerClaims))],
      proposedEvidenceBundle: groupedClaims[0].sourceBundle,
      proposedEvidence: uniqueSources(groupedClaims),
      exactSourceSections: [...new Set(groupedClaims.map((claim) => claim.evidenceRelationship.exactSection).filter(Boolean))],
      supportStatuses: [...new Set(groupedClaims.map((claim) => claim.verificationStatus))].sort(),
      recommendedActions: [...new Set(groupedClaims.map((claim) => claim.recommendedAction))],
      suggestedSafeWording: [...new Set(groupedClaims.map((claim) => claim.suggestedSafeWording).filter(Boolean))],
      occurrences,
      revisionHash,
      reviewerDecision: { evidence: null, wording: null, notes: null },
      grantsApproval: false,
      publicationAuthorized: false,
    }
  }).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id))
}

function sourceBundleFor(claim) {
  const text = `${claim.conditionIds.join(' ')} ${claim.exactLearnerClaims.join(' ')}`.toLowerCase()
  if (/cervical-artery|ifompt|arterial dissection|vascular pathology|5ds|3ns/.test(text)) return 'cervicalVascular'
  if (/cervical-myelopathy|\bdcm\b|myelopath/.test(text)) return 'dcm'
  if (/cervical-radiculopathy|cubital-tunnel|ulnar compression|ng127/.test(text)) return 'neurologicalReferral'
  if (/neuropathic pain|cg173|gabapentin|pregabalin|amitriptyline|duloxetine/.test(text)) return 'neuropathicPain'
  if (/cervicogenic-headache|ichd|cgh|cfrt/.test(text)) return 'cervicogenicHeadache'
  if (/calcific-tendinitis|calcific tendinopathy|htg645|eswt/.test(text)) return 'calcificTendinopathy'
  if (/elbow-osteoarthritis|\bng226\b/.test(text)) return 'osteoarthritis'
  if (/lateral-epicondylalgia|tennis elbow/.test(text)) return 'tennisElbow'
  if (/condition\.shoulder|rotator cuff|shoulder|labral|instability|adhesive capsulitis|acromioclavicular/.test(text)) return 'shoulderPathways'
  return null
}

function sharedConcept(claim) {
  const text = claim.exactLearnerClaims.join(' ').toLowerCase()
  const concepts = [
    ['shared:suspected-malignancy', /malignan|cancer|tumou?r|unexplained weight loss/],
    ['shared:serious-infection', /septic|sepsis|serious infection|fever.*immun/],
    ['shared:fracture-major-trauma', /fracture|major trauma/],
    ['shared:progressive-neurological-deficit', /progressive|worsening neurological|motor deficit/],
    ['shared:cord-compression-myelopathy', /cord compression|myelopath/],
    ['shared:vascular-stroke', /stroke|cervical artery|arterial dissection|vascular pathology/],
  ]
  return concepts.find(([, pattern]) => pattern.test(text))?.[0] ?? `condition:${claim.conditionIds.join('+')}:class-${claim.primaryClass.code}`
}

function safeWording(claim) {
  const text = claim.exactLearnerClaims.join(' ')
  if (claim.localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED') return 'Use the appropriate current local urgent or specialist pathway; confirm operational routes and timelines locally.'
  if (claim.primaryClass.code === 'E') return 'Medical or pharmacological management should follow current prescribing guidance and individual prescriber assessment.'
  if (claim.primaryClass.code === 'D') return 'Use the finding as part of the overall clinical assessment; exact performance estimates vary by population and reference standard and are not retained for Version 1.'
  if (claim.primaryClass.code === 'G') return 'Persistent, progressive or clinically significant symptoms may require specialist assessment; the specialist determines operative suitability.'
  if (claim.primaryClass.code === 'C' && /\d/.test(text)) return 'Investigation choice should follow the clinical context, red-flag assessment and appropriate specialist pathway.'
  return null
}

function uniqueSources(claims) {
  return [...new Map(claims.flatMap((claim) => claim.evidenceRelationship.proposedSources).map((source) => [source.key, source])).values()]
}

function bundle(title, sources, canSupport, cannotSupport) {
  return Object.freeze({ title, sources: Object.freeze(sources), canSupport: Object.freeze(canSupport), cannotSupport: Object.freeze(cannotSupport) })
}

function source(key, title, year, url, relevantSections) {
  return Object.freeze({ key, title, year, url, relevantSections })
}

function highestSeverity(claims) {
  return ['CRITICAL', 'MAJOR', 'SUPPORTING'].find((severity) => claims.some((claim) => claim.severity === severity))
}

function mostRestrictiveOutcome(claims) {
  return ['BLOCKED', 'CONTENT CHANGE REQUIRED', 'HUMAN CONFIRMATION'].find((outcome) => claims.some((claim) => claim.outcome === outcome)) ?? 'HUMAN CONFIRMATION'
}

function severityRank(severity) {
  return { CRITICAL: 0, MAJOR: 1, SUPPORTING: 2 }[severity] ?? 3
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function countBy(records, field) {
  return Object.fromEntries([...new Set(records.map((record) => record[field]))].sort().map((value) => [value, records.filter((record) => record[field] === value).length]))
}
