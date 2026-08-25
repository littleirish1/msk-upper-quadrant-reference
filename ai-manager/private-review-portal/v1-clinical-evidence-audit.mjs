import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { canonicalizePriorityAClaims } from './v1-claim-canonicalization.mjs'

export const AUTHORITATIVE_V1_SOURCES = Object.freeze({
  ifompt2020: Object.freeze({ title: 'International IFOMPT Cervical Framework (accepted October 2020)', url: 'https://www.ifompt.org/site/ifompt/IFOMPT%20Cervical%20Framework%20final%20September%202020.pdf' }),
  ahaCad2024: Object.freeze({ title: 'Treatment and Outcomes of Cervical Artery Dissection in Adults (AHA, 2024)', url: 'https://doi.org/10.1161/STR.0000000000000457' }),
  aoSpineDcm2017: Object.freeze({ title: 'Clinical practice guideline for degenerative cervical myelopathy (2017)', url: 'https://doi.org/10.1177/2192568217701914' }),
  niceNg127: Object.freeze({ title: 'NICE NG127: Suspected neurological conditions', url: 'https://www.nice.org.uk/guidance/ng127/chapter/Recommendations-for-adults-aged-over-16' }),
  niceCg173: Object.freeze({ title: 'NICE CG173: Neuropathic pain in adults', url: 'https://www.nice.org.uk/guidance/cg173/chapter/Recommendations' }),
  niceNg193: Object.freeze({ title: 'NICE NG193: Chronic pain', url: 'https://www.nice.org.uk/guidance/ng193/chapter/recommendations' }),
  ichd3Cgh: Object.freeze({ title: 'ICHD-3 11.2.1 Cervicogenic headache', url: 'https://ichd-3.org/11-headache-or-facial-pain-attributed-to-disorder-of-the-cranium-neck-eyes-ears-nose-sinuses-teeth-mouth-or-other-facial-or-cervical-structure/11-2-headache-attributed-to-disorder-of-the-neck/11-2-1-cervicogenic-headache/' }),
  bessShoulder: Object.freeze({ title: 'BESS/BOA Patient Care Pathways and Guidelines', url: 'https://bess.ac.uk/patient-care-pathways-and-guidelines/' }),
  bessPrimaryShoulder: Object.freeze({ title: 'BESS/BOA Shoulder Pain – Primary, Community and Intermediate Care Guidelines', url: 'https://bess.ac.uk/bess-boa-primary-intermediate-care-shoulder-pain-guidelines/' }),
  bessSaps2025: Object.freeze({ title: 'BESS Subacromial Shoulder Pain – 2025', url: 'https://bess.ac.uk/patient-care-pathways-and-guidelines/' }),
  josptRct2025: Object.freeze({ title: 'Rotator Cuff Tendinopathy CPG (JOSPT, 2025)', url: 'https://doi.org/10.2519/jospt.2025.13182' }),
  niceHtg645: Object.freeze({ title: 'NICE HTG645: ESWT for calcific tendinopathy in the shoulder', url: 'https://www.nice.org.uk/guidance/htg645' }),
  bessTennisElbow2023: Object.freeze({ title: 'BESS patient care pathway: Tennis elbow (2023)', url: 'https://doi.org/10.1177/17585732231170793' }),
  niceNg226: Object.freeze({ title: 'NICE NG226: Osteoarthritis in over 16s', url: 'https://www.nice.org.uk/guidance/ng226/chapter/recommendations' }),
})

const guidelineCorrections = Object.freeze([
  correction('condition.cervical.cervical-myelopathy', 'Urgent MRI for suspected cervical myelopathy was attributed partly to NG59.', 'NICE NG59 (Low back pain and sciatica)', 'Removed the NG59 authority; DCM management is anchored to the AO Spine/Global Spine Journal guideline.', ['aoSpineDcm2017']),
  correction('condition.cervical.cervical-radiculopathy', 'Imaging and neck-pain management were attributed to NG59.', 'NICE NG59 (Low back pain and sciatica)', 'Replaced the referral anchor with NG127 1.10.11; imaging remains context-specific and review-required.', ['niceNg127']),
  correction('condition.cervical.mechanical-neck-pain', 'Neck imaging and multimodal treatment were presented as NG59 recommendations.', 'NICE NG59 (Low back pain and sciatica)', 'Removed the false neck-guideline attribution; no substitute NICE neck guideline was invented.', []),
  correction('condition.cervical.cervical-myelopathy', 'Neuropathic-pain treatment was labelled NG173.', 'NICE NG173 (identifier does not denote the neuropathic-pain guideline)', 'Corrected to CG173 only for a confirmed neuropathic-pain indication; no dose is prescribed.', ['niceCg173']),
  correction('condition.cervical.cervical-radiculopathy', 'Exact gabapentin, pregabalin and amitriptyline doses were attributed to NG173.', 'NICE NG173', 'Corrected the identity to CG173 and removed condition-specific dose claims.', ['niceCg173']),
  correction('condition.cervical.whiplash-associated-disorders', 'Sensory hypersensitivity medicines were attributed to NG173.', 'NICE NG173', 'Corrected to CG173 only if neuropathic pain is actually established; removed exact doses.', ['niceCg173']),
  correction('condition.shoulder.adhesive-capsulitis', 'Shoulder analgesia and injection care were labelled NG194.', 'NICE NG194 (Postnatal care)', 'Removed the false NICE attribution and added the BESS/BOA Frozen Shoulder pathway as a review anchor.', ['bessShoulder']),
  correction('condition.shoulder.rotator-cuff-tear', 'Rotator-cuff medicines and injections were labelled NG194.', 'NICE NG194 (Postnatal care)', 'Removed the false NICE attribution and added the BESS/BOA shoulder pathway.', ['bessPrimaryShoulder']),
  correction('condition.shoulder.rotator-cuff-tendinopathy', 'Rotator-cuff tendinopathy nonsurgical care was labelled NG194.', 'NICE NG194 (Postnatal care)', 'Replaced with BESS 2025 and the 2025 JOSPT condition-specific guideline anchors.', ['bessSaps2025', 'josptRct2025']),
  correction('condition.shoulder.subacromial-pain-syndrome', 'Imaging, medicines and injections were labelled NG194.', 'NICE NG194 (Postnatal care)', 'Replaced with current BESS/JOSPT anchors; unsupported fixed prescribing details were removed.', ['bessSaps2025', 'josptRct2025']),
  correction('condition.shoulder.shoulder-instability', 'Acute instability pharmacology was labelled NG194.', 'NICE NG194 (Postnatal care)', 'Removed the false NICE attribution and added BESS instability pathways.', ['bessShoulder']),
  correction('condition.shoulder.calcific-tendinitis', 'The management pathway was labelled NG233 and ESWT was presented as routine escalation.', 'NICE NG233 (Otitis media with effusion in under 12s)', 'Replaced the false citation with HTG645; ESWT is now explicitly research-only.', ['niceHtg645']),
  correction('condition.shoulder.labral-tears', 'A shoulder/labral guideline was attributed to NG233.', 'NICE NG233 (Otitis media with effusion in under 12s)', 'Removed the invented NICE shoulder guideline; BESS instability pathways are review anchors only.', ['bessShoulder']),
])

const softenedClaims = Object.freeze([
  ['condition.cervical.cervical-artery-dysfunction', 'Removed unreliable manipulation-incidence, positional-onset, modality-sensitivity and fixed return-to-manual-therapy claims; medical dosing is now specialist-led.'],
  ['condition.cervical.cervical-myelopathy', 'Removed the invented AO Spine 0–5 grading label and fixed collar, monitoring and referral timing.'],
  ['condition.cervical.cervical-radiculopathy', 'Removed universal diagnostic-gold-standard wording, fixed medicine doses and fixed injection/surgical timelines.'],
  ['condition.cervical.cervicogenic-headache', 'Added ICHD-3 caveats; CFRT/manual-therapy/triptan response is no longer presented as definitive; fixed drug and block regimens were removed.'],
  ['condition.cervical.mechanical-neck-pain', 'Removed NG59 extrapolation and fixed medicine/PPI/acupuncture-session claims.'],
  ['condition.cervical.whiplash-associated-disorders', 'Updated vascular framing to IFOMPT 2020 and removed fixed WAD medicine doses.'],
  ['condition.shoulder.calcific-tendinitis', 'Changed ESWT from routine care to NICE HTG645 research-only and removed unsupported protocols and fixed prescribing.'],
  ['condition.shoulder.subacromial-pain-syndrome', 'Removed fixed doses, PPI age threshold, injection limit and waiting-period claims.'],
  ['condition.shoulder.rotator-cuff-tendinopathy', 'Removed fixed doses, PPI age threshold and injection-limit claims.'],
  ['condition.shoulder.adhesive-capsulitis', 'Removed false NICE alignment and unsupported fixed repeat-injection claims.'],
  ['condition.shoulder.rotator-cuff-tear', 'Removed false NICE alignment and unsupported fixed injection-limit claims.'],
  ['condition.shoulder.shoulder-instability', 'Removed false NICE acute-drug guidance and fixed opioid duration.'],
  ['condition.shoulder.labral-tears', 'Removed invented NICE guideline and fixed drug durations.'],
  ['condition.shoulder.acromioclavicular-joint', 'Removed unsupported fixed analgesic/injection doses and annual limits.'],
  ['condition.elbow.cubital-tunnel-syndrome', 'Mapped only the NG127-supported splint referral, six-week review and pressure avoidance; removed unsupported angles, durations, doses and thresholds.'],
  ['condition.elbow.lateral-epicondylalgia', 'Added BESS 2023 and removed unsupported medicine schedules and GTN dose.'],
  ['condition.elbow.medial-epicondylalgia', 'Removed unsupported medicine/injection/GTN doses and limits.'],
  ['condition.elbow.olecranon-bursitis', 'Removed learner-facing antibiotic, gout and injection dosing; suspected infection is medical-team-led.'],
  ['condition.elbow.radial-tunnel-syndrome', 'Removed unsupported injection composition, response percentage, repeat limit and neuropathic-drug suggestion.'],
  ['condition.elbow.elbow-osteoarthritis', 'Distinguished general NG226 recommendations from elbow-specific extrapolation and corrected its medicine table.'],
].map(([conditionId, change]) => Object.freeze({ conditionId, change })))

export function createV1ClinicalEvidenceAudit(repositoryRoot, conditionRecords) {
  const rawAudits = conditionRecords.map((condition) => inspectCondition(repositoryRoot, condition))
  const canonical = canonicalizePriorityAClaims(rawAudits, AUTHORITATIVE_V1_SOURCES)
  const audits = rawAudits.map((audit) => {
    const canonicalClaims = canonical.claimsByCondition.get(audit.conditionId) ?? []
    const priorityAClaims = audit.priorityAClaims.map((claim) => ({ ...claim, canonicalClaimId: canonical.canonicalByRawTask.get(claim.id) }))
    const criticalOrMajor = canonicalClaims.filter((claim) => ['CRITICAL', 'MAJOR'].includes(claim.severity) && !claim.humanEvidenceReviewComplete)
    return {
      ...audit,
      priorityAClaims,
      canonicalClaims,
      canonicalClaimsRequiringHumanVerification: canonicalClaims.filter((claim) => !claim.humanEvidenceReviewComplete).length,
      readiness: criticalOrMajor.length <= 3 ? 'limited-human-evidence-review' : 'changes-still-required',
      publicationStatus: criticalOrMajor.length ? 'publication-blocker' : 'human-confirmation-required',
    }
  })
  return {
    schemaVersion: 1,
    generatedFromRevision: conditionRecords.map((condition) => condition.exactRevisionHash).sort(),
    scope: ['cervical', 'shoulder', 'elbow'],
    guidelineIdentities: {
      NG194: 'Postnatal care',
      NG233: 'Otitis media with effusion in under 12s',
      NG59: 'Low back pain and sciatica in over 16s',
      CG173: 'Neuropathic pain in adults: pharmacological management in non-specialist settings',
    },
    authoritativeSources: AUTHORITATIVE_V1_SOURCES,
    guidelineCorrections: guidelineCorrections.map(resolveSources),
    softenedOrRemovedClaims: [...softenedClaims],
    conditions: audits,
    canonicalReview: {
      rawTaskCount: canonical.rawTaskCount,
      canonicalClaimCount: canonical.canonicalClaimCount,
      collapsedTaskCount: canonical.collapsedTaskCount,
      evidenceMappedAutomatically: canonical.evidenceMappedAutomatically,
      humanReviewRemaining: canonical.humanReviewRemaining,
      verificationStatusCounts: canonical.verificationStatusCounts,
      severityCounts: canonical.severityCounts,
      classCounts: canonical.classCounts,
      localServiceReviewRequired: canonical.localServiceReviewRequired,
      canonicalClaims: canonical.canonicalClaims,
      allRawTasksRepresented: canonical.allRawTasksRepresented,
      grantsApproval: false,
      publicationAuthorized: false,
    },
    summary: {
      conditions: audits.length,
      correctedGuidelineMappings: guidelineCorrections.length,
      softenedOrRemovedClaimGroups: softenedClaims.length,
      priorityAClaims: audits.reduce((sum, audit) => sum + audit.priorityAClaims.length, 0),
      priorityAClaimsRequiringHumanVerification: audits.reduce((sum, audit) => sum + audit.priorityAClaims.filter((claim) => !claim.humanEvidenceReviewComplete).length, 0),
      canonicalClaims: canonical.canonicalClaimCount,
      collapsedPriorityATasks: canonical.collapsedTaskCount,
      canonicalClaimsRequiringHumanVerification: canonical.humanReviewRemaining,
      evidenceMappedAutomatically: canonical.evidenceMappedAutomatically,
      prescribingClaims: audits.reduce((sum, audit) => sum + audit.priorityAClaims.filter((claim) => claim.category === 'prescribing').length, 0),
      publicationBlockedConditions: audits.filter((audit) => audit.publicationStatus === 'publication-blocker').length,
    },
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    publicationAuthorized: false,
    grantsApproval: false,
  }
}

export function applyV1ClinicalEvidenceAudit(record, audit) {
  const clone = structuredClone(record)
  clone.clinicalEvidenceAudit = audit
  clone.reviewCategory = audit.publicationStatus === 'publication-blocker' ? 'publication-blocker' : clone.reviewCategory
  clone.reviewPriority = clone.reviewCategory === 'publication-blocker' ? 0 : clone.reviewPriority
  clone.evidence.unresolvedGaps = [...new Set([
    ...clone.evidence.unresolvedGaps,
    ...audit.priorityAClaims.filter((claim) => !claim.humanEvidenceReviewComplete).map((claim) => `priority-a:${claim.category}:${claim.id}`),
  ])]
  if (audit.priorityAClaims.length) clone.reviewTasks.push({
    kind: 'claim-source-review',
    exactRevisionHash: clone.exactRevisionHash,
    grantsApproval: false,
    tasks: audit.priorityAClaims.map((claim) => claim.id),
  })
  if (audit.publicationStatus === 'publication-blocker') clone.finalBlockers.push('publication-critical-claim-source-verification-incomplete')
  return clone
}

function inspectCondition(root, condition) {
  const file = path.join(root, ...condition.sourceFile.split('/'))
  const source = fs.readFileSync(file, 'utf8')
  const parsed = matter(source)
  const body = parsed.content.split(/^## Key References\s*$/m)[0]
  const bodyOffset = source.slice(0, source.indexOf(parsed.content)).split(/\r?\n/).length - 1
  const claims = []
  const headings = []
  for (const [index, raw] of body.split(/\r?\n/).entries()) {
    const claim = raw.replace(/<[^>]+>/g, '').trim()
    const heading = claim.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      headings.splice(level - 1)
      headings[level - 1] = heading[2]
      continue
    }
    if (!claim || /^import\s/.test(claim) || /^[-*_]{3,}$/.test(claim) || /^\*\*[^*]+:\*\*$/.test(claim) || /^\|[-:| ]+\|$/.test(claim) || /^```/.test(claim) || isTableHeader(claim) || /^(?:[-*]\s*)?(?:[^:]{0,80}\s+)?referral(?:\s+(?:indicated|criteria))?(?:\s+if)?\s*:$|^refer when (?:the following )?criteria are met\s*:/i.test(claim)) continue
    const categories = classifyPriorityAClaim(claim, headings.filter(Boolean).join(' > '))
    if (!categories.length) continue
    const category = categories[0]
    const support = authoritativeAnchor(claim)
    claims.push({
      id: `claim-${crypto.createHash('sha256').update(`${condition.id}:${index + 1}:${claim}`).digest('hex').slice(0, 16)}`,
      priority: 'A',
      category,
      categories,
      conditionId: condition.id,
      conditionTitle: condition.title,
      region: condition.region,
      sourceFile: condition.sourceFile,
      sourceLine: bodyOffset + index + 1,
      sectionPath: headings.filter(Boolean).join(' > '),
      exactClaim: claim,
      supportStatus: support.length ? 'authoritative-anchor-added-human-confirmation-required' : 'human-verification-required',
      proposedSources: support.map((key) => ({ key, ...AUTHORITATIVE_V1_SOURCES[key] })),
      claimSourceRelationshipVerified: false,
      humanEvidenceReviewComplete: false,
      publicationBlocker: true,
      revisionHash: condition.exactRevisionHash,
    })
  }
  const requiringHuman = claims.filter((claim) => !claim.humanEvidenceReviewComplete)
  return {
    conditionId: condition.id,
    title: condition.title,
    region: condition.region,
    sourceFile: condition.sourceFile,
    learnerRoute: condition.learnerRoute,
    exactRevisionHash: condition.exactRevisionHash,
    priorityAClaims: claims,
    priorityAClaimsRequiringHumanVerification: requiringHuman.length,
    prescribingSafetyClaims: claims.filter((claim) => claim.category === 'prescribing').map((claim) => claim.id),
    guidelineCorrections: guidelineCorrections.filter((item) => item.conditionId === condition.id).map(resolveSources),
    softenedOrRemovedClaims: softenedClaims.filter((item) => item.conditionId === condition.id),
    readiness: requiringHuman.length ? 'changes-still-required' : 'clinically-evidence-ready-for-human-confirmation',
    publicationStatus: requiringHuman.length ? 'publication-blocker' : 'human-confirmation-required',
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    publicationAuthorized: false,
    grantsApproval: false,
  }
}

function classifyPriorityAClaim(claim, sectionPath) {
  const categories = []
  const prescribingSubject = /\b(?:paracetamol|nsaid|ibuprofen|naproxen|diclofenac|ppi|opioid|codeine|tramadol|morphine|gabapentin|pregabalin|diazepam|amitriptyline|duloxetine|antibiotic|anticoagul|antiplatelet|corticosteroid|steroid|medicine|medication|drug|injection)\b/i
  const recommendation = /\b(?:recommend|offer|consider|prescrib|use|avoid|do not|must not|contraindicat|short[- ]term|course|maximum|limit|repeat|medical[- ]team|specialist|clinician[- ]led)\b/i
  const doseOrSchedule = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b|\b(?:once|twice|three times|daily|weekly|qds|tds|bd)\b/i
  if (prescribingSubject.test(claim) && (recommendation.test(claim) || doseOrSchedule.test(claim))) categories.push('prescribing')

  if (/(?:red flags?|emergency|urgent safety|serious pathology)/i.test(sectionPath)
      || /\b(?:call 999|a&e|emergency referral|same-day assessment|acute stroke|septic joint|spinal cord compression)\b/i.test(claim)) categories.push('emergency-red-flag')

  if (/(?:onward referral|referral criteria|when to refer|urgent referral)/i.test(sectionPath)
      || /\b(?:refer|referral)\b/i.test(claim) && /\b(?:urgent|immediate|same-day|within|after|if|when|failure|failed|progressive)\b/i.test(claim)) categories.push('referral-criterion')

  const imagingSubject = /\b(?:mri|mra|cta|ct scan|x-ray|radiograph|ultrasound|uss|imaging|electrodiagnostic|ncs|emg)\b/i
  if (imagingSubject.test(claim) && (/(?:imaging|investigation|evidence-based diagnosis|diagnosis)/i.test(sectionPath)
      || /\b(?:indicat|recommend|request|offer|routine|first[- ]line|preferred|urgent|not required|do not)\b/i.test(claim))) categories.push('imaging-indication')

  if (/\b(?:sensitivity|specificity|\+lr|−lr|-lr|gold standard|definitive|diagnostic criteria)\b/i.test(claim)
      && /\d|gold standard|definitive|diagnostic criteria/i.test(claim)) categories.push('diagnostic-accuracy')

  if (/\b(?:contraindicat|must not|do not|never)\b/i.test(claim)
      || /\bavoid\b/i.test(claim) && /(?:manual therapy|manipulation|mobilisation|exercise|traction|injection|medicine|pressure|movement)/i.test(claim)) categories.push('contraindication')

  const surgerySubject = /\b(?:surgery|surgical|operative|arthroplasty|decompression|repair|latarjet|acromioplasty|capsular release|manipulation under anaesthesia)\b/i
  if (surgerySubject.test(claim) && (/(?:surgical|onward referral|referral criteria)/i.test(sectionPath)
      || /\b(?:indicat|consider|refer|threshold|failure|failed|after|within|urgent|candidate)\b/i.test(claim))) categories.push('surgical-threshold')

  return [...new Set(categories)]
}

function isTableHeader(claim) {
  if (!claim.startsWith('|')) return false
  return /^\|[^\d]+\|$/.test(claim) && /\b(?:test|treatment|procedure|indication|sensitivity|specificity|evidence|notes|feature|condition|medication|urgency|criteria|diagnosis|assessment)\b/i.test(claim)
}

function authoritativeAnchor(claim) {
  const anchors = []
  if (/IFOMPT.*2020|2020.*IFOMPT/i.test(claim)) anchors.push('ifompt2020')
  if (/2024 AHA|AHA scientific statement/i.test(claim)) anchors.push('ahaCad2024')
  if (/NICE NG127.*1\.10\.11/i.test(claim)) anchors.push('niceNg127')
  if (/NICE NG127.*1\.7\.9|NG127 recommendation 1\.7\.9/i.test(claim)) anchors.push('niceNg127')
  if (/NICE HTG645|HTG645/i.test(claim)) anchors.push('niceHtg645')
  if (/ICHD-3 caveats|under ICHD-3/i.test(claim)) anchors.push('ichd3Cgh')
  if (/NG226 says to \*\*consider\*\* a topical NSAID|short-term relief \(2–10 weeks\)|Do not offer for OA management/i.test(claim)) anchors.push('niceNg226')
  return [...new Set(anchors)]
}

function correction(conditionId, existingClaim, incorrectCitation, resultingChange, sourceKeys) {
  return Object.freeze({ conditionId, existingClaim, incorrectCitation, resultingChange, sourceKeys, supportStatus: sourceKeys.length ? 'authoritative-anchor-added-human-confirmation-required' : 'unsupported-claim-removed-no-replacement-invented', resultingBlocker: 'human-clinical-and-evidence-review-required' })
}

function resolveSources(item) {
  return { ...item, replacementSources: item.sourceKeys.map((key) => ({ key, ...AUTHORITATIVE_V1_SOURCES[key] })) }
}
