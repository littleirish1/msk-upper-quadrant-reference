import crypto from 'node:crypto'

export const V1_CLAIM_CLASSES = Object.freeze({
  A: 'Emergency / red flag',
  B: 'Referral / escalation',
  C: 'Imaging / investigation',
  D: 'Diagnostic test accuracy',
  E: 'Medication / prescribing',
  F: 'Contraindication / precaution',
  G: 'Surgical/interventional threshold',
})

export const V1_CLAIM_REVIEW_OPTIONS = Object.freeze({
  evidenceRelationship: Object.freeze(['confirm-supported', 'partial-support', 'unsupported', 'needs-alternative-evidence']),
  clinicalWording: Object.freeze(['accept-as-written', 'soften-wording', 'change-required', 'remove']),
})

const classByCategory = Object.freeze({
  'emergency-red-flag': 'A',
  'referral-criterion': 'B',
  'imaging-indication': 'C',
  'diagnostic-accuracy': 'D',
  prescribing: 'E',
  contraindication: 'F',
  'surgical-threshold': 'G',
})

const classPrecedence = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
const severityOrder = Object.freeze({ CRITICAL: 0, MAJOR: 1, SUPPORTING: 2 })

const directMappings = Object.freeze([
  mapping('AHA-2024-ANTITHROMBOTIC-DURATION', /AHA scientific statement[\s\S]*antithrombotic[\s\S]*3\s*(?:â€“|–|-)\s*6 months/i, 'ahaCad2024', 'Abstract / antithrombotic-treatment statement', 'Scientific statement', 'The learner wording directly reproduces the statement that treatment choice is individualised and generally continued for at least 3–6 months.'),
  mapping('NG127-1.10.11-CERVICAL-RADICULOPATHY', /NG127\s*\(?1\.10\.11\)?[\s\S]*do not routinely refer[\s\S]*6 weeks/i, 'niceNg127', 'Recommendation 1.10.11', 'National guideline', 'The learner wording directly states the stable cervical-radiculopathy referral exceptions in recommendation 1.10.11.'),
  mapping('NG127-1.7.9-ULNAR-COMPRESSION', /NG127[\s\S]*(?:1\.7\.9|splint)[\s\S]*(?:6 weeks|six-week|six week)/i, 'niceNg127', 'Recommendations 1.7.9–1.7.10', 'National guideline', 'The claim directly reflects splint referral, six-week review and avoidance of further pressure for clear ulnar compression neuropathy.'),
  mapping('NG127-1.7.9-ULNAR-SIX-WEEK-REVIEW', /no improvement after the 6-week NG127 review[\s\S]*neurological assessment/i, 'niceNg127', 'Recommendation 1.7.9', 'National guideline', 'The learner wording directly reflects neurological assessment when symptoms show no improvement after the six-week review.'),
  mapping('NG127-1.7.10-AVOID-PRESSURE', /avoid medial elbow pressure/i, 'niceNg127', 'Recommendation 1.7.10', 'National guideline', 'The learner wording directly reflects advice to avoid activity that causes further pressure on the affected ulnar nerve.'),
  mapping('HTG645-RESEARCH-ONLY', /HTG645[\s\S]*(?:only in the context of research|research-only|must not be offered[\s\S]*routine)/i, 'niceHtg645', 'Recommendation 1.1', 'National HealthTech guidance', 'The learner wording directly reflects the NICE research-only restriction.'),
  mapping('IFOMPT-POSITIONAL-TESTING', /IFOMPT[\s\S]*(?:provocative positional testing|positional testing)[\s\S]*(?:not recommended|do not use)/i, 'ifompt2020', 'Clinical reasoning and physical examination sections', 'International professional framework', 'The claim directly reflects the framework-based removal of provocative positional testing as a vascular clearance screen.'),
  mapping('AO-SPINE-DCM-MODERATE-SEVERE', /(?:moderate|severe)[\s\S]*(?:DCM|myelopathy)[\s\S]*(?:surg|operative)|(?:surg|operative)[\s\S]*(?:moderate|severe)[\s\S]*(?:DCM|myelopathy)/i, 'aoSpineDcm2017', 'Summary of recommendations', 'International clinical practice guideline', 'The claim directly concerns the guideline recommendation for surgical intervention in moderate or severe DCM.'),
  mapping('AO-SPINE-DCM-MILD', /mild[\s\S]*(?:DCM|myelopathy)[\s\S]*(?:structured rehabilitation|neurological deterioration|fails? to improve)/i, 'aoSpineDcm2017', 'Summary of recommendations / mild DCM', 'International clinical practice guideline', 'The claim directly concerns the options and escalation criteria stated for mild DCM.'),
  mapping('ICHD3-CERVICOGENIC-HEADACHE', /ICHD-?3[\s\S]*(?:diagnostic criteria|causation|diagnostic blockade|reduced cervical range|provocative manoeuvre)/i, 'ichd3Cgh', '11.2.1 Diagnostic criteria and notes', 'International diagnostic classification', 'The learner wording directly references the ICHD-3 criteria or an explicit ICHD-3 diagnostic caveat.'),
])

export function canonicalizePriorityAClaims(conditionAudits, authoritativeSources) {
  const rawClaims = conditionAudits.flatMap((condition) => condition.priorityAClaims.map((claim) => ({
    ...claim,
    conditionId: condition.conditionId,
    conditionTitle: condition.title,
    region: condition.region,
    learnerRoute: condition.learnerRoute,
  })))
  const buckets = new Map()
  for (const raw of rawClaims) {
    const classification = primaryClassification(raw)
    const semantic = semanticGroup(raw, classification.code)
    const key = `${classification.code}:${semantic.key}`
    if (!buckets.has(key)) buckets.set(key, { key, classification, semantic, raw: [] })
    buckets.get(key).raw.push(raw)
  }

  const canonicalClaims = [...buckets.values()].map((bucket) => createCanonicalClaim(bucket, authoritativeSources))
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]
      || left.primaryClass.code.localeCompare(right.primaryClass.code)
      || left.canonicalClaim.localeCompare(right.canonicalClaim)
      || left.id.localeCompare(right.id))
  const canonicalByRawTask = new Map(canonicalClaims.flatMap((claim) => claim.rawTaskIds.map((taskId) => [taskId, claim.id])))
  const claimsByCondition = new Map(conditionAudits.map((condition) => [condition.conditionId, []]))
  for (const claim of canonicalClaims) {
    for (const conditionId of claim.conditionIds) claimsByCondition.get(conditionId)?.push(claim)
  }
  const represented = new Set(canonicalClaims.flatMap((claim) => claim.rawTaskIds))
  if (represented.size !== rawClaims.length || rawClaims.some((claim) => !represented.has(claim.id))) throw new Error('Canonical claim grouping did not preserve every Priority A raw task.')
  return {
    schemaVersion: 1,
    rawTaskCount: rawClaims.length,
    canonicalClaimCount: canonicalClaims.length,
    collapsedTaskCount: rawClaims.length - canonicalClaims.length,
    evidenceMappedAutomatically: canonicalClaims.filter((claim) => claim.claimSourceRelationshipVerified).length,
    humanReviewRemaining: canonicalClaims.filter((claim) => !claim.humanEvidenceReviewComplete).length,
    verificationStatusCounts: countBy(canonicalClaims, 'verificationStatus'),
    severityCounts: countBy(canonicalClaims, 'severity'),
    classCounts: Object.fromEntries(Object.keys(V1_CLAIM_CLASSES).map((code) => [code, canonicalClaims.filter((claim) => claim.primaryClass.code === code).length])),
    localServiceReviewRequired: canonicalClaims.filter((claim) => claim.localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED').length,
    canonicalClaims,
    canonicalByRawTask,
    claimsByCondition,
    allRawTasksRepresented: true,
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    publicationAuthorized: false,
    grantsApproval: false,
  }
}

function createCanonicalClaim(bucket, authoritativeSources) {
  const occurrences = bucket.raw.map((raw) => ({
    taskId: raw.id,
    conditionId: raw.conditionId,
    conditionTitle: raw.conditionTitle,
    region: raw.region,
    learnerRoute: raw.learnerRoute,
    sourceFile: raw.sourceFile,
    sourceLine: raw.sourceLine,
    sectionPath: raw.sectionPath,
    exactClaim: raw.exactClaim,
    exactRevisionHash: raw.revisionHash,
  })).sort((left, right) => left.sourceFile.localeCompare(right.sourceFile) || left.sourceLine - right.sourceLine || left.taskId.localeCompare(right.taskId))
  const combined = occurrences.map((item) => item.exactClaim).join('\n')
  const localServiceStatus = /\b(?:HSC\s*NI|Northern Ireland|Belfast|Ulster Hospital|Craigavon|Royal Victoria|Altnagelvin|most HSC|local (?:pathway|service|trust)|waiting[- ]?time|\d+[- ]week wait)\b/i.test(combined)
    ? 'LOCAL SERVICE REVIEW REQUIRED'
    : 'NOT A LOCAL SERVICE CLAIM'
  const relationship = evidenceRelationship(combined, bucket.raw, authoritativeSources, localServiceStatus)
  const revisionHash = `sha256:${hash(JSON.stringify(occurrences.map((item) => [item.taskId, item.exactRevisionHash, item.exactClaim])))} `
    .trim()
  const id = `canonical-${bucket.classification.code.toLowerCase()}-${hash(bucket.key).slice(0, 16)}`
  return {
    id,
    canonicalClaim: bucket.semantic.label ?? occurrences[0].exactClaim,
    primaryClass: { code: bucket.classification.code, label: V1_CLAIM_CLASSES[bucket.classification.code] },
    secondaryTags: [...new Set(bucket.raw.flatMap((item) => item.categories))].sort(),
    severity: severityFor(bucket.classification.code, combined),
    verificationStatus: relationship.status,
    evidenceRelationship: relationship,
    claimSourceRelationshipVerified: relationship.status === 'VERIFIED',
    directSupport: relationship.status === 'VERIFIED',
    extrapolation: relationship.status === 'EXTRAPOLATED',
    humanEvidenceReviewComplete: false,
    humanDecisionRequired: true,
    evidenceRelationshipDecision: null,
    clinicalWordingDecision: null,
    reviewOptions: structuredClone(V1_CLAIM_REVIEW_OPTIONS),
    localServiceStatus,
    conditionIds: [...new Set(occurrences.map((item) => item.conditionId))].sort(),
    regions: [...new Set(occurrences.map((item) => item.region))].sort(),
    exactLearnerClaims: [...new Set(occurrences.map((item) => item.exactClaim))],
    rawTaskIds: occurrences.map((item) => item.taskId),
    occurrences,
    revisionHash,
    publicationBlocker: true,
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    grantsApproval: false,
    publicationAuthorized: false,
  }
}

function primaryClassification(raw) {
  const codes = raw.categories.map((category) => classByCategory[category]).filter(Boolean)
  const code = codes.includes('A') ? 'A'
    : /\b(?:refer|referral|escalat)\b/i.test(raw.exactClaim) ? 'B'
      : classPrecedence.find((candidate) => codes.includes(candidate)) ?? classByCategory[raw.category]
  if (!code) throw new Error(`Unknown Priority A claim category: ${raw.category}`)
  return { code, label: V1_CLAIM_CLASSES[code] }
}

function semanticGroup(raw, code) {
  const text = clean(raw.exactClaim)
  const section = clean(raw.sectionPath || 'unsectioned')
  const direct = directMappings.find((candidate) => candidate.pattern.test(raw.exactClaim))
  if (direct) return { key: `direct:${direct.id}` }
  const local = /\b(?:hsc ni|northern ireland|belfast|ulster hospital|craigavon|royal victoria|altnagelvin|local pathway|most hsc|waiting time|week wait)\b/.test(text)
  const concepts = [
    ['suspected-malignancy', /\b(?:malignan|cancer|tumou?r|unexplained weight loss|night pain)\b/],
    ['infection-or-sepsis', /\b(?:infection|septic|sepsis|fever|immunosuppress|iv drug|recent surgery)\b/],
    ['fracture-or-major-trauma', /\b(?:fracture|major trauma|dislocation)\b/],
    ['spinal-cord-compression-or-myelopathy', /\b(?:spinal cord compression|myelopath|cord compression|long tract|upper motor neurone)\b/],
    ['acute-stroke-or-cervical-artery-pathology', /\b(?:stroke|cervical artery|arterial dissection|vascular pathology|5ds|3ns|cranial nerve)\b/],
    ['cauda-or-bladder-bowel-neurology', /\b(?:bladder|bowel|saddle|cauda)\b/],
    ['progressive-neurological-deficit', /\b(?:progressive|worsening|rapidly evolving)[^\n]{0,80}\b(?:neurolog|weakness|motor|sensory|deficit)\b|\b(?:neurolog|weakness|motor|sensory|deficit)[^\n]{0,80}\b(?:progressive|worsening|rapidly evolving)\b/],
    ['inflammatory-arthropathy', /\b(?:inflammatory arthropathy|rheumat|multiple joints|systemic inflammatory)\b/],
  ]
  const concept = concepts.find(([, pattern]) => pattern.test(text))?.[0]
  if (code === 'A' && concept && !local) return { key: `generic:${concept}`, label: `Repeated learner claims concerning ${humaniseConcept(concept)} recognition and escalation` }
  if (code === 'B' && concept && !local) return { key: `generic:${concept}`, label: `Repeated learner referral/escalation claims concerning ${humaniseConcept(concept)}` }
  if (code === 'A') return perCondition(raw, code, local ? 'local-service-red-flag-cluster' : 'condition-red-flag-cluster', section)
  if (code === 'B') return perCondition(raw, code, local ? 'local-service-referral-cluster' : 'condition-referral-cluster', section)
  if (local) return perCondition(raw, code, 'local-service-claim', section)

  const modality = firstMatch(text, [
    ['mri', /\bmri\b/], ['cta-or-mra', /\b(?:cta|mra)\b/], ['ct', /\bct(?: scan)?\b/], ['xray', /\b(?:x-ray|xray|radiograph)\b/], ['ultrasound', /\b(?:ultrasound|uss)\b/], ['electrodiagnostics', /\b(?:ncs|emg|electrodiagnostic)\b/],
  ])
  if (code === 'C' && modality) return perCondition(raw, code, modality, section)

  if (code === 'D') return perCondition(raw, code, diagnosticFingerprint(text), section)

  if (code === 'E') {
    const prescribing = firstMatch(text, [
      ['antithrombotic', /\b(?:antithrombotic|antiplatelet|anticoagul)\b/], ['antibiotic', /\bantibiotic\b/], ['opioid', /\b(?:opioid|codeine|tramadol|morphine)\b/], ['gabapentinoid', /\b(?:gabapentin|pregabalin|gabapentinoid)\b/], ['antidepressant', /\b(?:amitriptyline|duloxetine|antidepressant)\b/], ['nsaid', /\b(?:nsaid|ibuprofen|naproxen|diclofenac)\b/], ['steroid-or-injection', /\b(?:corticosteroid|steroid|injection|hydrodilatation)\b/], ['prescriber-led-governance', /\b(?:prescriber|medical-team|specialist-led|does not prescribe|current prescribing guidance)\b/],
    ])
    return perCondition(raw, code, prescribing ?? fallbackFingerprint(text), section)
  }

  if (code === 'F') {
    const precaution = firstMatch(text, [
      ['vascular-manual-therapy', /\b(?:vascular|ifompt|cervical artery)[\s\S]*(?:manual|manip|mobil|hvla|positional)|(?:manual|manip|mobil|hvla|positional)[\s\S]*(?:vascular|ifompt|cervical artery)\b/],
      ['eswt-research-only', /\b(?:eswt|shockwave)\b/], ['injection-precaution', /\binjection\b/], ['medication-precaution', /\b(?:nsaid|opioid|medicine|medication|drug)\b/], ['exercise-or-movement-precaution', /\b(?:exercise|movement|traction|stretch|loading)\b/],
    ])
    return perCondition(raw, code, precaution ?? concept ?? fallbackFingerprint(text), section)
  }

  if (code === 'G') {
    const procedure = firstMatch(text, [
      ['decompression', /\bdecompression\b/], ['repair', /\brepair\b/], ['arthroplasty', /\barthroplasty\b/], ['latarjet', /\blatarjet\b/], ['capsular-release-or-mua', /\b(?:capsular release|manipulation under anaesthesia)\b/], ['acromioplasty', /\bacromioplasty\b/], ['generic-surgery', /\b(?:surgery|surgical|operative)\b/],
    ])
    return perCondition(raw, code, procedure ?? fallbackFingerprint(text), section)
  }

  return perCondition(raw, code, concept ?? fallbackFingerprint(text), section)
}

function perCondition(raw, code, concept, section) {
  return { key: `${raw.conditionId}:${code}:${sectionLeaf(section)}:${concept}` }
}

function evidenceRelationship(combined, rawClaims, sources, localServiceStatus) {
  if (localServiceStatus === 'LOCAL SERVICE REVIEW REQUIRED') return relationship('UNVERIFIED', [], null, null, 'A national or journal source cannot verify a local HSC/NI service pathway. An exact current local service source is required.')
  if (/\bNG226\b/i.test(combined) && rawClaims.some((item) => item.conditionId.includes('elbow-osteoarthritis'))) {
    return relationship('EXTRAPOLATED', sourceRecords(['niceNg226'], sources), 'Recommendations 1.4.3–1.4.10', 'National guideline', 'NG226 applies to osteoarthritis generally, but the learner application to elbow-specific effectiveness is explicitly extrapolated.')
  }
  for (const candidate of directMappings) {
    if (rawClaims.every((claim) => candidate.pattern.test(claim.exactClaim))) return relationship('VERIFIED', sourceRecords([candidate.sourceKey], sources), candidate.section, candidate.evidenceType, candidate.rationale)
  }
  const proposed = [...new Set(rawClaims.flatMap((item) => item.proposedSources.map((source) => source.key)))]
  if (proposed.length || /\b(?:NICE|BESS|JOSPT|IFOMPT|AHA|AO Spine|ICHD-3)\b/i.test(combined)) {
    return relationship('PARTIAL SUPPORT', sourceRecords(proposed, sources), null, null, 'An authoritative topic anchor is present, but the exact learner assertion is not deterministically established by the recorded source passage.')
  }
  return relationship('UNVERIFIED', [], null, null, 'No sufficiently direct authoritative claim-source relationship has been identified automatically.')
}

function relationship(status, proposedSources, exactSection, evidenceType, reviewerRationale) {
  return { status, proposedSources, exactSection, evidenceType, directSupport: status === 'VERIFIED', extrapolation: status === 'EXTRAPOLATED', reviewerRationale }
}

function sourceRecords(keys, sources) {
  return [...new Set(keys)].map((key) => sources[key] ? ({ key, ...sources[key] }) : null).filter(Boolean)
}

function severityFor(code, combined) {
  if (code === 'A') return 'CRITICAL'
  if (code === 'B' && /\b(?:urgent|immediate|same-day|emergency|progressive|worsening|malignan|cancer|septic|spinal cord|myelopath|stroke|fracture)\b/i.test(combined)) return 'CRITICAL'
  if (code === 'E' && /\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)|anticoagul|antiplatelet|antibiotic|opioid|benzodiazepine|diazepam|steroid regimen)\b/i.test(combined)) return 'CRITICAL'
  if (code === 'F' && /\b(?:must not|never|vascular|cervical artery|septic|instability)\b/i.test(combined)) return 'CRITICAL'
  if (/\b(?:outcome measure|monitor|follow-up measure|patient education)\b/i.test(combined) && !/\b(?:refer|imaging|diagnos|contraindicat|surgery|medication|drug|injection)\b/i.test(combined)) return 'SUPPORTING'
  return 'MAJOR'
}

function diagnosticFingerprint(text) {
  const testName = text.match(/\b(?:spurling|distraction|upper limb tension|ultt|hoffmann|babinski|clonus|inverted supinator|arm squeeze|cervical flexion rotation|cfrt|hawkins|neer|painful arc|external rotation lag|drop arm|apprehension|relocation|obrien|crank|speed|yergason|cozen|mills|maudsley|tinel|elbow flexion|pressure provocation|scratch collapse|ulnar nerve tension|middle finger extension|resisted supination)\b/i)?.[0]
  return testName ? clean(testName) : fallbackFingerprint(text)
}

function fallbackFingerprint(text) {
  return text.replace(/\b\d+(?:\.\d+)?\b/g, '<n>').split(' ').filter((word) => word.length > 3 && !/^(?:with|from|that|this|when|where|should|would|could|into|after|before|their|there|which|have|been|than|then|only|also|most|more|less|each|using|used|based|current)$/.test(word)).slice(0, 12).join('-') || hash(text).slice(0, 16)
}

function sectionLeaf(section) {
  return section.split('>').map((part) => part.trim()).filter(Boolean).at(-1) || 'unsectioned'
}

function firstMatch(text, options) {
  return options.find(([, pattern]) => pattern.test(text))?.[0]
}

function clean(value) {
  return String(value ?? '').normalize('NFKC').replace(/[*_`|>#()[\]{}]/g, ' ').replace(/[â€“–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
}

function humaniseConcept(value) {
  return value.replaceAll('-', ' ')
}

function mapping(id, pattern, sourceKey, section, evidenceType, rationale) {
  return Object.freeze({ id, pattern, sourceKey, section, evidenceType, rationale })
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function countBy(records, field) {
  return Object.fromEntries([...new Set(records.map((record) => record[field]))].sort().map((value) => [value, records.filter((record) => record[field] === value).length]))
}
