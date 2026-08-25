import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const EXPECTED_REVIEW_SHA256 = '1075f06adca7ac06919fcbc127f3f629c9e7a19bf3db07185d0f065cb4636873'
const reviewArgument = process.argv.find((argument) => argument.startsWith('--review='))
if (!reviewArgument) throw new Error('Pass --review=<independent-review-json>')

const root = process.cwd()
const reviewPath = path.resolve(reviewArgument.slice('--review='.length))
const reviewBytes = fs.readFileSync(reviewPath)
const reviewHash = sha256(reviewBytes)
if (reviewHash !== EXPECTED_REVIEW_SHA256) throw new Error(`Unexpected independent-review packet hash: ${reviewHash}`)
const review = JSON.parse(reviewBytes)
if (review.packetType !== 'independent-major-evidence-review-recommendations' || review.recommendations?.length !== 23) throw new Error('Expected exactly 23 Major recommendations')
if (review.authority?.recommendationOnly !== true || review.authority?.grantsApproval !== false || review.authority?.publicationAuthorized !== false) throw new Error('Independent packet authority boundary is invalid')

const packetPath = path.join(root, 'reports', 'publication-readiness', 'V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json')
const adoptionPath = path.join(root, 'reports', 'publication-readiness', 'V1-MAJOR-INDEPENDENT-REVIEW-ADOPTION.json')
const criticalAdoptionPath = path.join(root, 'reports', 'publication-readiness', 'V1-CRITICAL-INDEPENDENT-REVIEW-ADOPTION.json')
const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'))
const currentMajor = packet.humanDecisions.filter((decision) => decision.severity === 'MAJOR')
const existingAdoption = fs.existsSync(adoptionPath) ? JSON.parse(fs.readFileSync(adoptionPath, 'utf8')) : null
const sourceDecisions = currentMajor.length === 23 ? currentMajor : existingAdoption?.recommendations
if (sourceDecisions?.length !== 23) throw new Error('Current packet does not contain the expected 23 Major decisions and no valid prior adoption is available')
const sourceById = new Map(sourceDecisions.map((decision) => [decision.id, decision]))
const reviewIds = new Set(review.recommendations.map((recommendation) => recommendation.id))
if (reviewIds.size !== 23 || sourceDecisions.some((decision) => !reviewIds.has(decision.id))) throw new Error('Major recommendation IDs do not exactly match the current decision packet')
for (const recommendation of review.recommendations) {
  const source = sourceById.get(recommendation.id)
  if (!source || source.severity !== 'MAJOR') throw new Error(`Stale or unknown Major recommendation: ${recommendation.id}`)
  if (!['supported', 'partial', 'unsupported'].includes(recommendation.evidenceRecommendation)) throw new Error(`Invalid evidence disposition: ${recommendation.id}`)
  if (!['accept', 'accept-softened-wording', 'modify'].includes(recommendation.wordingRecommendation)) throw new Error(`Invalid wording disposition: ${recommendation.id}`)
}

const operations = new Map()
const add = (id, relativePath, description, transform) => {
  const list = operations.get(relativePath) ?? []
  list.push({ id, description, transform })
  operations.set(relativePath, list)
}

add('v1-human-034eae0bddad2bb3', 'content/cervical/cervicogenic-headache.mdx', 'Narrow NICE CG150 to secondary-headache investigation/referral and individual review need.', (text) => {
  text = replaceLiteral(text,
    '- Use NICE CG150 to determine the need for investigation or referral for secondary-headache warning features.',
    '- Use NICE CG150 to identify headache features that warrant further investigation or referral.')
  return replaceLiteral(text,
    '- Seek medical/specialist assessment for diagnostic uncertainty, substantial change in headache pattern, or symptoms that remain disabling despite an appropriate plan.',
    '- Seek medical/specialist review when diagnosis remains uncertain, the headache pattern changes substantially, or symptoms remain disabling despite an appropriate management plan.')
})

add('v1-human-0d2bfb68f56aafe9', 'content/shoulder/acromioclavicular-joint.mdx', 'Retain non-automatic Rockwood grade management principle.', (text) => replaceLine(text, /^> \*\*Clinical Note:\*\* Grades I.+orthopaedic assessment\.$/m,
  '> **Clinical Note:** Rockwood I–II injuries are generally managed non-operatively. Grade III is usually managed non-operatively initially and individualised if symptoms persist. Grades IV–VI warrant orthopaedic assessment; this does not make surgery automatic.'))

add('v1-human-108d28ff370a695a', 'content/shoulder/subacromial-pain-syndrome.mdx', 'Remove prescriptive investigation assignments from the differential table.', (text) => replaceSection(text, '## Differential Diagnosis', '## Management & Treatment', `## Differential Diagnosis

| Diagnosis | Key Features | Differentiating assessment |
|---|---|---|
| Rotator cuff tendinopathy | Overlaps significantly with SAPS | Load response and muscle tests interpreted with the history |
| Full-thickness rotator-cuff tear | Significant weakness; lag signs may be present | Lag/drop-arm findings and the overall traumatic or degenerative presentation |
| Adhesive capsulitis | Global restriction with a capsular pattern | Restriction across directions |
| AC-joint pathology | Direct AC tenderness and cross-body pain | AC palpation and cross-body loading |
| Calcific tendinopathy | Acute severe pain that can mimic infection | Clinical context and the presence of a calcium deposit when investigated |
| Glenohumeral OA | Gradual restriction, crepitus and stiffness | Joint pattern and clinical context |
| Cervical radiculopathy | Neck/arm symptoms and neurological signs | Cervical and neurological examination |
| Labral pathology or instability | Trauma, apprehension, catching or recurrent instability | Instability/labral assessment interpreted in context |
| Thoracic outlet syndrome | Positional neurovascular symptoms | Neurovascular assessment and subtype-specific specialist evaluation |
| Brachial neuritis | Severe pain followed by rapid weakness | Neurological pattern and medical assessment |

Investigation choice should follow the suspected diagnosis, red-flag assessment and appropriate specialist pathway; no imaging or electrodiagnostic test in this table is an automatic confirmatory step.

---

`))

add('v1-human-1f8b4164ed9dc6a9', 'content/elbow/cubital-tunnel-syndrome.mdx', 'Replace fixed thoracic-outlet test/imaging package with subtype-specific clinical assessment.', (text) => replaceLine(text, /^\| Thoracic outlet syndrome \|.*$/m,
  '| Thoracic outlet syndrome | Consider when symptoms are positional and suggest neurovascular compression | Diagnosis is primarily clinical; investigations depend on the suspected neurogenic, arterial or venous subtype and specialist pathway |'))

add('v1-human-2b4fd70f92ce18d7', 'content/shoulder/rotator-cuff-tendinopathy.mdx', 'Remove automatic investigation assignments from the rotator-cuff differential table.', (text) => replaceSection(text, '## Differential Diagnosis', '## Management & Treatment', `## Differential Diagnosis

| Diagnosis | Key differentiating features | Clinical assessment |
|---|---|---|
| Subacromial pain syndrome | Painful arc and pain with overhead activity | Load response and muscle tests interpreted with the history |
| Full-thickness rotator-cuff tear | Significant weakness; lag signs may be present | Lag/drop-arm findings and traumatic or degenerative context |
| Adhesive capsulitis | Global restriction with a capsular pattern | Restriction across directions |
| Glenohumeral arthritis | Gradual restriction, crepitus and stiffness | Joint pattern and clinical context |
| Cervical radiculopathy | Arm symptoms, neurological signs and neck-related reproduction | Cervical and neurological examination |
| AC-joint pathology | Superior pain and direct AC-joint tenderness | AC palpation and cross-body loading |
| Biceps or calcific pathology | Anterior pain or acute severe presentation | Condition-appropriate assessment |
| Instability or thoracic outlet syndrome | Apprehension, hyperlaxity or positional neurovascular features | Context-specific instability or neurovascular assessment |
| Brachial neuritis | Acute severe pain followed by rapid weakness | Neurological pattern and medical assessment |

Investigation choice should follow the clinical context, red-flag assessment and appropriate specialist pathway; no imaging modality is an automatic confirmatory test for every differential.

---

`))

add('v1-human-3187854b07c777e5', 'content/elbow/lateral-epicondylalgia.mdx', 'Retain supported BESS referral boundary without content change.', assertText('persistent disabling symptoms or diagnostic uncertainty despite appropriate conservative care'))
add('v1-human-3701e80e4669c077', 'content/shoulder/rotator-cuff-tendinopathy.mdx', 'Retain supported prescribing/injection governance boundary without content change.', assertText('They do not justify carrying forward unsupported fixed doses'))

add('v1-human-3b853e6ab780beca', 'content/cervical/cervical-artery-dysfunction.mdx', 'Clarify that positional testing and a negative historical mnemonic cannot reduce vascular concern.', (text) => replaceLiteral(text,
  'Positional testing and historical symptom checklists must not be used to downgrade referral urgency.',
  'Do not use positional testing or a negative historical symptom mnemonic to reduce concern when the history or examination suggests possible cervical vascular pathology.'))

add('v1-human-4b2c1f3f7db592ad', 'content/cervical/cervicogenic-headache.mdx', 'Make medication-overuse frequency a screening threshold rather than a taper target.', (text) => replaceLine(text, /^\| \*\*Medication Use\*\* \(days\/month\).*$/m,
  '| **Medication use** (days/month) | Screening context | NICE CG150 uses ≥10 days/month for triptans, opioids, ergots or combination analgesics for ≥3 months as a threshold to suspect medication-overuse headache | Review in the clinical context | This is not a taper target or treatment rule |'))

add('v1-human-5f8d37819c5eca03', 'content/cervical/whiplash-associated-disorders.mdx', 'Retain individual need/current-pathway referral wording without fixed timing.', (text) => replaceLine(text, /^- \*\*Individual onward referral:\*\*.*$/m,
  '- **Individual onward referral:** consider referral when symptoms remain disabling, significant psychological distress is present, or PTSD is suspected, using the current local pathway.'))

add('v1-human-63cff227682942f1', 'content/cervical/whiplash-associated-disorders.mdx', 'Move vascular imaging choice into the acute medical/stroke pathway.', (text) => replaceLine(text, /^- CTA\/MRA: Suspected traumatic vertebral or internal carotid artery dissection.*$/m,
  '- Suspected traumatic cervical artery dissection requires urgent/emergency medical assessment; vascular imaging such as CTA or MRI/MRA should be selected within the acute medical/stroke pathway.'))

add('v1-human-6b0bfed498e376ab', 'content/cervical/cervical-myelopathy.mdx', 'Clarify MRI primacy and specialist-selected alternative imaging.', (text) => {
  text = replaceLiteral(text, '**MRI (principal structural investigation):**', '**MRI (principal structural investigation):**\nMRI is the principal imaging modality for suspected DCM because diagnosis requires clinical–radiological correlation.')
  return replaceLiteral(text, '**CT Myelography:**\n- Used when MRI contraindicated or inconclusive\n- Identifies bony compression, OPLL, calcified disc herniation with high resolution',
    '**Alternative imaging:**\n- If MRI cannot be performed or does not answer the clinical question, alternative imaging such as CT ± myelography may be considered by the specialist/radiology pathway.\n- The choice depends on the clinical question; it is not an automatic routine second-line step.')
})

add('v1-human-6eec280d2dedaa6c', 'content/cervical/cervical-myelopathy.mdx', 'Use individual functional-need wording for gait, mobility aids and orthotics.', (text) => replaceLine(text, /^- \*\*Gait retraining\*\*:.*$/m,
  '- **Gait and mobility:** where rehabilitation is appropriate, it should be individualised and may include gait/balance retraining and mobility aids according to functional need; orthotic assessment may be considered when clinically indicated.'))

add('v1-human-72c88d0ca3bb2225', 'content/shoulder/adhesive-capsulitis.mdx', 'Replace unsupported inflammation mechanism with irritability/tolerability dosing.', (text) => replaceLine(text, /^\| Stage 1 \(Painful\).*$/m,
  '| Stage 1 (Painful/irritable) | Pain; sleep disruption | Symptom control; consider glenohumeral corticosteroid injection for short-term improvement; tolerable ROM/exercise | Dose exercise to irritability rather than forcing painful end range |').replace(
    '- Avoid aggressive stretching — counterproductive in Stage 1',
    '- Dose stretching and ROM to irritability; do not force painful end range in Stage 1'))

add('v1-human-7a91c9af7c65ec16', 'content/elbow/olecranon-bursitis.mdx', 'Use consider-specialist language and retain clinician-led intervention boundary.', (text) => replaceLine(text, /^- \*\*Specialist assessment:\*\* persistent\/recurrent disabling bursitis.*$/m,
  '- **Consider specialist assessment:** persistent/recurrent disabling bursitis, a mass lesion, diagnostic uncertainty or malignancy concern under applicable criteria.'))

add('v1-human-817b6491b2b50e9a', 'content/cervical/mechanical-neck-pain.mdx', 'Use reassess/consider wording based on individual need rather than duration.', (text) => replaceLine(text, /^- \*\*Routine reassessment\/referral:\*\*.*$/m,
  '- **Reassess and consider onward referral:** when diagnosis remains uncertain or symptoms remain substantially disabling despite an appropriate conservative plan.'))

add('v1-human-8311172f5649a9e9', 'content/shoulder/labral-tears.mdx', 'Use context-specific specialist assessment and remove blanket referral rule.', (text) => {
  text = replaceLine(text, /^Recurrence or failure of conservative.*$/m, 'Persistent or recurrent instability, neurological deficit or other concerning traumatic findings → context-specific specialist assessment')
  text = replaceLine(text, /^- \*\*Prompt specialist assessment:\*\*.*$/m, '- **Prompt specialist assessment:** persistent neurological deficit, unreduced or traumatic instability, or other concerning traumatic findings.')
  return replaceLine(text, /^- \*\*Routine specialist assessment:\*\*.*$/m, '- **Consider routine specialist shoulder assessment:** recurrent/persistent instability, diagnostic uncertainty or persistent disabling symptoms despite rehabilitation.')
})

add('v1-human-b14c0bc38a972bb9', 'content/shoulder/adhesive-capsulitis.mdx', 'Retain supported frozen-shoulder injection governance boundary without content change.', assertText('intra-articular corticosteroid injection and physiotherapy in appropriate patients'))
add('v1-human-baa5a8f34ab80f39', 'content/elbow/elbow-osteoarthritis.mdx', 'Retain supported NICE NG226 NSAID boundary without content change.', assertText('NG226 recommends gastroprotection while an NSAID is taken'))

add('v1-human-c9138a6211084878', 'content/elbow/lateral-epicondylalgia.mdx', 'Represent BESS physiotherapy and corticosteroid-injection recommendations directly.', (text) => replaceLiteral(text,
  'The BESS Tennis Elbow 2023 pathway is the current UK condition-specific evidence anchor. Medicine and injection choices remain clinician-led. Fixed application schedules, PPI thresholds and injection recommendations require mapping to the exact BESS recommendation or primary study before publication.',
  'The BESS Tennis Elbow 2023 pathway recommends physiotherapy and recommends against corticosteroid injection for lateral elbow tendinopathy. Other medication decisions remain clinician/prescriber-led; no fixed application schedule or PPI threshold is asserted without an exact source.'))

add('v1-human-cea968e6457a92e5', 'content/shoulder/adhesive-capsulitis.mdx', 'Use seek/consider wording for systemic and specialist assessment.', (text) => {
  text = replaceLine(text, /^- \*\*Medical\/rheumatology assessment:\*\*.*$/m, '- **Seek medical/rheumatology assessment:** when inflammatory polyarthritis or systemic disease is suspected.')
  return replaceLine(text, /^- \*\*Specialist shoulder assessment:\*\*.*$/m, '- **Consider specialist shoulder assessment:** when diagnosis remains uncertain or disabling restriction persists despite an appropriate conservative plan.')
})

add('v1-human-e5cd1da1e449b20f', 'content/shoulder/calcific-tendinitis.mdx', 'Use consider-specialist wording while retaining HTG645 research-only restriction.', (text) => replaceLine(text, /^- \*\*Specialist shoulder assessment:\*\*.*$/m,
  '- **Consider specialist shoulder assessment:** for persistent disabling symptoms, diagnostic uncertainty or when a specialist procedure is being considered.'))

add('v1-human-ea2de5c78ce109b6', 'content/elbow/elbow-osteoarthritis.mdx', 'Remove unsupported prevalence and mandatory NCS instruction.', (text) => replaceLiteral(text,
  'Indicated when cubital tunnel syndrome (ulnar neuropathy) is suspected as a co-pathology — present in up to **20% of elbow OA cases** (Takahara et al., 2006). Should be requested prior to surgical referral if neurological symptoms are present.',
  'Elbow OA can coexist with or contribute to ulnar neuropathy. If ulnar neuropathy is suspected, assess clinically and consider electrodiagnostic testing when needed to clarify diagnosis or severity, or to support specialist planning.'))

const changedFiles = []
const changeById = new Map()
for (const [relativePath, fileOperations] of operations) {
  const absolutePath = path.join(root, ...relativePath.split('/'))
  let content = fs.readFileSync(absolutePath, 'utf8').replaceAll('\r\n', '\n')
  const original = content
  for (const operation of fileOperations) {
    const before = content
    content = operation.transform(content)
    changeById.set(operation.id, { relativePath, description: operation.description, contentChanged: content !== before })
  }
  if (content !== original) {
    fs.writeFileSync(absolutePath, content)
    changedFiles.push(relativePath)
  }
}

const recommendations = review.recommendations.map((recommendation) => {
  const source = sourceById.get(recommendation.id)
  const change = changeById.get(recommendation.id)
  if (!change) throw new Error(`No implementation mapping for ${recommendation.id}`)
  const resultingFileSha256 = sha256(fs.readFileSync(path.join(root, ...change.relativePath.split('/'))))
  const previousImplementation = existingAdoption?.recommendations?.find((item) => item.id === recommendation.id)
  const contentChanged = previousImplementation?.contentChanged ?? change.contentChanged
  return {
    id: recommendation.id,
    severity: 'MAJOR',
    primaryClass: source.primaryClass?.label ?? source.primaryClass,
    priorRevisionHash: source.revisionHash ?? source.priorRevisionHash,
    ownerAdoptionStatus: 'owner-confirmed-recommendation-implemented',
    evidenceDisposition: recommendation.evidenceRecommendation,
    wordingDisposition: recommendation.wordingRecommendation,
    affectedConditions: source.conditionIds ?? source.affectedConditions,
    affectedFile: change.relativePath,
    resultingFileSha256,
    resultingRevisionHash: `sha256:${sha256(`${recommendation.id}\n${resultingFileSha256}`)}`,
    contentChange: contentChanged ? change.description : `No content change: ${change.description}`,
    contentChanged,
    grantsApproval: false,
    publicationAuthorized: false,
  }
})

const adoption = {
  schemaVersion: 1,
  packetType: 'v1-major-independent-review-owner-adoption',
  independentReviewPacket: { filename: path.basename(reviewPath), sha256: reviewHash, majorRecommendations: 23 },
  predecessorCriticalAdoption: {
    path: 'reports/publication-readiness/V1-CRITICAL-INDEPENDENT-REVIEW-ADOPTION.json',
    sha256: sha256(fs.readFileSync(criticalAdoptionPath)),
  },
  ownerConfirmation: { actor: 'Eoin Casey', confirmedDate: '2026-08-18', statement: 'Apply the attached V1 MAJOR independent evidence review recommendations', authority: 'wording-and-evidence-disposition-implementation-only' },
  sourceDecisionPacket: { path: 'reports/publication-readiness/V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json', majorDecisionCount: 23 },
  recommendations,
  implementation: {
    touchedFiles: [...operations.keys()],
    filesChangedByThisRun: changedFiles,
    resultingFiles: [...operations.keys()].map((relativePath) => ({ relativePath, sha256: sha256(fs.readFileSync(path.join(root, ...relativePath.split('/')))) })),
    exactRevisionDecisionsMustBeRecomputed: true,
  },
  clinicalApprovalGranted: false,
  evidenceApprovalGranted: false,
  grantsApproval: false,
  publicationAuthorized: false,
  publicationStateChanged: false,
}
fs.writeFileSync(adoptionPath, `${JSON.stringify(adoption, null, 2)}\n`)
console.log(`Applied ${recommendations.length} owner-confirmed Major recommendations; ${changedFiles.length} condition files changed.`)
console.log(`Adoption record: ${path.relative(root, adoptionPath)} (${sha256(fs.readFileSync(adoptionPath))})`)

function assertText(expected) {
  return (text) => {
    if (!text.includes(expected)) throw new Error(`Accepted wording not found: ${expected}`)
    return text
  }
}

function replaceLiteral(text, before, after) {
  if (text.includes(after)) return text
  const index = text.indexOf(before)
  if (index < 0) throw new Error(`Expected wording not found: ${before.slice(0, 120)}`)
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`Expected wording is not unique: ${before.slice(0, 120)}`)
  return `${text.slice(0, index)}${after}${text.slice(index + before.length)}`
}

function replaceLine(text, pattern, replacement) {
  if (text.includes(replacement)) return text
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
  if (matches.length !== 1) throw new Error(`Expected one line for ${pattern}; found ${matches.length}`)
  return text.replace(pattern, replacement)
}

function replaceSection(text, startHeading, endHeading, replacement) {
  if (text.includes(replacement.trim())) return text
  const start = text.indexOf(`${startHeading}\n`)
  const end = text.indexOf(`${endHeading}\n`, start + startHeading.length)
  if (start < 0 || end < 0) throw new Error(`Cannot replace section ${startHeading} -> ${endHeading}`)
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
