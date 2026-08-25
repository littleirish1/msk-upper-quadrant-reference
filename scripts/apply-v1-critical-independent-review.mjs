import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const EXPECTED_REVIEW_SHA256 = '4757cec86671d15105c9fe6fe399d4c082ad880a3aa9cb391139a9a19e954c10'
const reviewArgument = process.argv.find((argument) => argument.startsWith('--review='))
if (!reviewArgument) throw new Error('Pass --review=<independent-review-json>')

const root = process.cwd()
const reviewPath = path.resolve(reviewArgument.slice('--review='.length))
const reviewBytes = fs.readFileSync(reviewPath)
const reviewHash = sha256(reviewBytes)
if (reviewHash !== EXPECTED_REVIEW_SHA256) throw new Error(`Unexpected independent-review packet hash: ${reviewHash}`)

const review = JSON.parse(reviewBytes)
const sourcePacketPath = path.join(root, 'reports', 'publication-readiness', 'V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json')
const adoptionPath = path.join(root, 'reports', 'publication-readiness', 'V1-CRITICAL-INDEPENDENT-REVIEW-ADOPTION.json')
const sourcePacket = JSON.parse(fs.readFileSync(sourcePacketPath, 'utf8'))
const critical = sourcePacket.humanDecisions.filter((decision) => decision.severity === 'CRITICAL')
const existingAdoption = fs.existsSync(adoptionPath) ? JSON.parse(fs.readFileSync(adoptionPath, 'utf8')) : null
const sourceDecisions = critical.length === 47 ? critical : existingAdoption?.recommendations
if (review.recommendations.length !== 47 || sourceDecisions?.length !== 47) throw new Error('Expected exactly 47 critical recommendations')
const sourceById = new Map(sourceDecisions.map((decision) => [decision.id, decision]))
for (const recommendation of review.recommendations) {
  const source = sourceById.get(recommendation.id)
  if (!source || source.revisionHash !== recommendation.revisionHash) throw new Error(`Stale or unknown recommendation: ${recommendation.id}`)
  if (recommendation.severity !== 'CRITICAL' || recommendation.grantsApproval !== false || recommendation.publicationAuthorized !== false) throw new Error(`Authority boundary failed: ${recommendation.id}`)
}
if (review.authority?.humanOwnerDecisionStillRequired !== true || review.authority?.grantsApproval !== false || review.authority?.publicationAuthorized !== false) throw new Error('Independent packet authority boundary is invalid')

const replacements = {
  'content/cervical/cervical-artery-dysfunction.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Use the International IFOMPT Cervical Framework (2020) to reason about possible vascular pathology. Concerning presentations include new severe or unusual neck pain or headache together with focal neurological features, ataxia, new cranial nerve dysfunction, Horner syndrome or other acute stroke features.

- If acute cervical artery dissection or stroke is suspected, stop cervical treatment and arrange emergency medical assessment.
- Call 999 for acute focal neurological or stroke features. Do not delay emergency care to complete a musculoskeletal examination.
- Do not use symptom provocation in sustained rotation or extension, or the absence of the historical “5Ds/3Ns”, as vascular clearance.
- Do not proceed with cervical manipulation when vascular pathology, instability, myelopathy, fracture or another serious contraindication is suspected.

The “5Ds/3Ns” may help explain historical teaching but they are not a diagnostic or clearance rule.`),
    section('### Acute Safety Pathway', '### Conservative Management', `### Acute Safety Pathway

**Suspected acute cervical artery dissection or stroke**

- Stop cervical treatment and arrange emergency medical assessment.
- Call 999 for acute focal neurological or stroke features.
- Emergency destination, investigation and treatment are determined by the emergency stroke/vascular pathway.

**Confirmed dissection**

Antithrombotic choice, duration, imaging and any endovascular intervention are specialist medical decisions. Physiotherapy may contribute to subsequent neurological rehabilitation. Later cervical treatment requires individual neurovascular review and shared planning; this page does not prescribe a fixed interval or technique.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency:** suspected acute dissection or stroke, especially with acute focal neurological features, new cranial nerve dysfunction, ataxia or Horner syndrome with concerning head/neck pain.
- **Prompt medical assessment:** a concerning vascular presentation without acute stroke features, with urgency determined by the clinical presentation.
- **Specialist follow-up:** confirmed dissection, chronic vascular symptoms or post-stroke rehabilitation needs.

Positional testing and historical symptom checklists must not be used to downgrade referral urgency.`),
  ],
  'content/cervical/cervical-myelopathy.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Suspected degenerative cervical myelopathy (DCM) requires prompt medical or spinal assessment. Warning features include worsening hand function, gait disturbance, upper motor neuron findings, progressive limb weakness and new bladder or bowel disturbance.

- Arrange emergency medical assessment for acute neurological deterioration, acute cord-compression features or neurological deficit after trauma.
- Do not apply cervical manipulation or aggressive mobilisation where DCM or cord compression is suspected.
- Do not delay assessment when neurological function is deteriorating.

DCM severity and rate of change determine management. Mild DCM is not automatically an emergency and may, following specialist assessment and shared decision-making, be managed with a supervised structured rehabilitation trial. Moderate/severe DCM and deterioration during non-operative care require surgical assessment under the AO Spine guideline.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

- Suspected DCM: arrange prompt spinal/specialist assessment through the current local pathway.
- Acute neurological deterioration or neurological deficit after trauma: use the emergency medical/spinal pathway.
- Moderate or severe DCM: the AO Spine guideline recommends surgery.
- Mild DCM: specialist-led shared decision-making may include surgery or a supervised structured rehabilitation trial. Deterioration during non-operative care requires operative assessment; lack of improvement prompts reconsideration.

Physiotherapy may support function, gait and hand use within the specialist plan. It must not delay escalation or include cervical manipulation where cord compromise is suspected.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency medical/spinal assessment:** acute deterioration, new bladder or bowel disturbance, or neurological deficit after trauma.
- **Prompt spinal assessment:** suspected DCM, progressive neurological change, worsening hand function, gait disturbance or upper motor neuron findings.
- **Surgical assessment:** moderate/severe DCM, or deterioration during supervised non-operative care.
- **Shared specialist decision:** mild DCM; a supervised structured rehabilitation trial may be considered, with reassessment if the person does not improve.

No fixed local route or universal conservative-treatment duration is asserted.`),
  ],
  'content/cervical/cervical-radiculopathy.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Screen separately for:

- **DCM/cord involvement:** gait disturbance, clumsy or weak hands or legs, brisk reflexes, extensor plantar responses, progressive neurological change, or new bladder/bowel disturbance. Arrange prompt specialist assessment; use emergency assessment for acute deterioration.
- **Trauma:** apply the Canadian C-Spine Rule in an appropriate trauma presentation. NICE NG41 recommends CT for adults when imaging is indicated by that rule.
- **Vascular pathology:** use the IFOMPT 2020 risk-based history and examination. Do not use positional testing or the historical “5Ds/3Ns” as clearance.
- **Other serious pathology:** suspected fracture, serious infection or malignancy requires medical assessment with urgency determined by the presentation.

Do not prescribe a specific imaging modality from a general red-flag label unless the relevant guideline supports it.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Stable cervical radiculopathy can usually begin with conservative care. Under NICE NG127, symptoms stable for 6 weeks or more are not routinely referred unless pain is uncontrolled, symptoms are disabling, or specified neurological warning features are present.

Progressive motor or neurological deficit requires prompt reassessment and condition-appropriate specialist assessment. Atypical cord, vascular, trauma, infection or malignancy features follow their own pathways.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

Follow NICE NG127 recommendation 1.10.11 for stable cervical radiculopathy of 6 weeks or more. Refer when pain is not controlled, symptoms are disabling, or there is a specified neurological feature such as gait disturbance, clumsy/weak hands or legs, brisk reflexes, extensor plantar responses, or new bladder/bowel disturbance.

- **Prompt specialist assessment:** progressive motor or neurological deficit, atypical presentation or suspected cord involvement.
- **Emergency assessment:** acute neurological deterioration or an applicable trauma/vascular emergency.

This Version 1 page does not prescribe generic pain-clinic, injection, epidural, spinal-cord-stimulation or fixed 6–12-week surgical pathways.`),
  ],
  'content/cervical/cervicogenic-headache.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Evaluate headache presentations for current NICE CG150 secondary-headache warning features, including:

- worsening headache with fever;
- sudden-onset headache reaching maximum intensity within 5 minutes;
- new neurological deficit, cognitive dysfunction, altered consciousness or substantial change in headache characteristics;
- recent head trauma;
- headache triggered by cough, Valsalva or exercise, or an orthostatic headache;
- features suggesting giant cell arteritis or acute glaucoma.

Urgency depends on the actual feature; not every red flag has the same pathway. Suspected meningitis, stroke, arterial dissection or another acute neurological emergency requires emergency medical assessment.

Before upper-cervical manual therapy, use the IFOMPT 2020 risk-based history and examination. Do not document a negative “5Ds/3Ns” checklist or sustained positional test as vascular clearance.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

First determine whether the headache presentation is compatible with ICHD-3 cervicogenic headache and whether a secondary-headache warning feature requires medical assessment. Physiotherapy may address a clinically supported cervical contribution after serious pathology has been considered.

Manual therapy, exercise and self-management choices should be individualised. Procedural blocks, radiofrequency treatment, preventive medicines and other specialist interventions require separate specialist assessment and evidence; they are not Version 1 physiotherapy referral thresholds.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- Use NICE CG150 to determine the need for investigation or referral for secondary-headache warning features.
- Arrange emergency assessment for an acute neurological emergency, suspected meningitis, stroke or cervical artery dissection.
- Seek medical/specialist assessment for diagnostic uncertainty, substantial change in headache pattern, or symptoms that remain disabling despite an appropriate plan.

Version 1 does not use fixed treatment-session percentages, fixed physiotherapy-failure intervals, diagnostic-block thresholds, spinal-cord stimulation or other procedure criteria as referral rules.`),
  ],
  'content/cervical/mechanical-neck-pain.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Screen for serious pathology, including neurological/cord involvement, vascular pathology, significant trauma, fracture, infection, malignancy and inflammatory disease.

- Apply the Canadian C-Spine Rule only in an appropriate trauma presentation; it is not a general neck-pain screening rule.
- Use IFOMPT 2020 risk-based reasoning for possible vascular pathology. New cranial nerve dysfunction is concerning when it occurs within a vascular or neurological presentation; the historical “5Ds/3Ns” are not a clearance rule.
- Suspected meningitis, acute neurological deterioration or another emergency presentation requires emergency assessment. Other concerns require medical assessment with urgency matched to the presentation.

Assess psychosocial prognostic factors where useful, but do not use an unsupported fixed STarT MSK threshold to prescribe a treatment package.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Mechanical neck pain without serious-pathology features is generally managed with education, activity, exercise and individualised adjunctive care. Access routes and service capacity vary; use the current local musculoskeletal pathway.

Psychosocial assessment may inform shared planning, but Version 1 does not prescribe fixed session allocations or a threshold-based treatment package.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency or urgent assessment:** according to the actual suspected pathology, including acute neurological deterioration, meningitis, significant trauma, fracture or vascular emergency.
- **Prompt medical/specialist assessment:** suspected DCM, progressive neurological change, serious infection or malignancy.
- **Routine reassessment/referral:** diagnostic uncertainty or persistent disabling symptoms despite an appropriate conservative plan.

Occupational, psychological and pain-service referrals should be based on individual need and the current local pathway, not a fixed treatment duration.`),
  ],
  'content/cervical/whiplash-associated-disorders.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

For suspected cervical spine injury after trauma, apply the Canadian C-Spine Rule as described in NICE NG41. Adults should receive CT when imaging is indicated by that rule. Do not use NEXUS as an alternative Version 1 rule unless it is separately sourced and governed.

- Suspected fracture/dislocation or neurological deficit after trauma: protect the cervical spine and use the emergency trauma pathway.
- Possible cervical artery dissection: use IFOMPT 2020 risk-based reasoning. Severe unusual head/neck pain with acute focal neurological, cranial nerve, ataxic or Horner features requires emergency medical assessment.
- Possible cord injury: bilateral or multisegmental neurological change, gait disturbance or new bladder/bowel disturbance requires prompt escalation; acute deterioration is an emergency.

Keep vascular, cord and trauma-imaging decisions separate. Do not use positional testing or the historical “5Ds/3Ns” as vascular clearance.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

After serious injury has been excluded, WAD I–II may be managed using education, activity, exercise and individualised physiotherapy. Psychological distress and possible PTSD should be assessed and referred according to clinical need and the current local pathway.

Progressive neurological deficit, suspected cord injury or possible cervical artery dissection requires condition-appropriate prompt or emergency assessment. Version 1 does not prescribe fixed pain-clinic, psychology or surgery timelines.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency:** suspected fracture/dislocation, acute spinal cord injury, or suspected cervical artery dissection/stroke with acute neurological features.
- **Prompt specialist assessment:** progressive neurological or motor deficit.
- **Individual onward referral:** persistent disabling symptoms, significant psychological distress or suspected PTSD, using the current local pathway.

Version 1 does not use fixed 4-week, 12-week, WAD-grade surgery or PiP/CBT timing rules.`),
  ],
  'content/shoulder/acromioclavicular-joint.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Severe traumatic ACJ injury, open injury, skin compromise, associated fracture/dislocation or neurovascular compromise requires urgent or emergency assessment according to the presentation.
- Systemic inflammatory features across multiple joints should prompt appropriate medical/rheumatology assessment; do not use a rigid morning-stiffness threshold in isolation.
- Suspected infection or malignancy requires medical assessment under the applicable current pathway and criteria.

Distal-clavicle osteolysis, PVNS and metabolic bone disease are differentials, not automatic red-flag pathways. Investigation and referral should follow the clinical presentation and appropriate specialist guidance.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management (Grades I–III)', `### Governed Care Pathway

Use the current local shoulder pathway. Urgent escalation is based on neurovascular compromise, open injury, severe traumatic deformity or associated fracture/dislocation. Other ACJ presentations may begin with individualised conservative management when appropriate.`),
    section('### Onward Referral Criteria', '### Surgical Options (for reference)', `### Onward Referral Criteria

- **Emergency/urgent assessment:** neurovascular compromise, open injury, threatened skin, severe traumatic ACJ injury or associated fracture/dislocation.
- **Specialist assessment:** persistent disabling symptoms, diagnostic uncertainty or a presentation requiring consideration of operative management.
- **Medical/rheumatology assessment:** systemic inflammatory features, infection concern or suspected malignancy under applicable criteria.

No fixed “within days”, injection-count, 6–12-week or 3–6-month threshold is asserted.`),
  ],
  'content/shoulder/adhesive-capsulitis.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Consider alternative or serious pathology when the presentation suggests infection, unreduced dislocation, tumour/malignancy, inflammatory polyarthritis or an acute traumatic rotator-cuff tear. Escalate according to the actual presentation.

Progressive focal neurological deficit requires prompt medical/specialist assessment. Age at onset alone does not mandate MRI, and Version 1 does not prescribe Paget-specific testing or a separate CRPS pathway without an appropriate clinical indication and source.`),
    section('### Care Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current BESS/local frozen-shoulder pathway. After serious or alternative pathology has been considered, care may include education, exercise and other individually assessed nonsurgical options. Investigation and intervention choices remain clinician/specialist-led.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Urgent assessment:** infection, unreduced dislocation, acute traumatic cuff-tear presentation, neurovascular compromise or another serious presentation.
- **Medical/rheumatology assessment:** inflammatory polyarthritis or suspected systemic disease.
- **Specialist shoulder assessment:** diagnostic uncertainty or persistent disabling restriction despite an appropriate conservative plan.

Investigation and intervention choices remain clinician/specialist-led; no universal fixed timeframe is asserted.`),
  ],
  'content/shoulder/calcific-tendinitis.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

Escalate genuine systemic/infective features, suspected malignancy, acute neurological deficit, fracture/dislocation or another serious presentation according to clinical urgency. Progressive focal weakness requires prompt medical/specialist assessment.

Version 1 does not infer reactive arthritis from recent dental, gastrointestinal or urinary symptoms, mandate MRI after a fixed interval, or prescribe a cortical-erosion pathway without separate evidence.`),
    section('### HSC NI Pathway', '### Conservative Management', `### Governed Care Pathway

Begin with clinically appropriate conservative care when serious pathology has been excluded. NICE HTG645 retains extracorporeal shockwave therapy for calcific tendinopathy in research-only governance. Specialist procedures require separate assessment and evidence.`),
    section('### Onward Referral Criteria (HSC NI)', '## Key References', `### Onward Referral Criteria

- **Urgent assessment:** infection/systemic illness, acute neurological deficit, fracture/dislocation or another serious presentation.
- **Suspected malignancy:** follow the current suspected-cancer pathway only when applicable NICE/local criteria are met.
- **Specialist shoulder assessment:** persistent disabling symptoms, diagnostic uncertainty or consideration of a specialist procedure.

No fixed imaging or procedure timeline is asserted.`),
  ],
  'content/shoulder/labral-tears.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Unreduced dislocation, fracture-dislocation or neurovascular compromise requires urgent/emergency assessment.
- Progressive focal neurological deficit requires prompt medical/specialist assessment.
- After reduction, early mobilisation should follow the current BESS shoulder pathway; prolonged default immobilisation is not used to reduce recurrence.

Glenoid bone loss, Hill-Sachs lesions and procedure selection belong to specialist planning rather than the red-flag list. Version 1 does not prescribe Latarjet, remplissage or another procedure from a fixed threshold.`),
    section('### HSC NI Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current BESS/local shoulder pathway. Acute dislocation care includes reduction through an appropriate emergency pathway, post-reduction neurovascular examination and individualised rehabilitation. Specialist imaging and operative planning are separate decisions.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency/urgent assessment:** unreduced dislocation, fracture-dislocation or neurovascular compromise.
- **Prompt specialist assessment:** persistent neurological deficit, recurrent/persistent instability, or a traumatic presentation needing specialist review.
- **Routine specialist assessment:** persistent disabling symptoms or diagnostic uncertainty despite appropriate rehabilitation.

Age cut-offs, recurrence counts, ISIS scores, bone-loss thresholds and procedure choice are not universal Version 1 referral rules.`),
  ],
  'content/shoulder/rotator-cuff-tear.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Chest, jaw or arm symptoms with dyspnoea or other acute cardiac features require emergency assessment/999.
- Marked acute weakness or pseudoparalysis after trauma requires urgent shoulder assessment for possible acute rotator-cuff tear or fracture.
- Fracture/dislocation, neurovascular compromise, infection or malignancy concern requires escalation according to the presentation.

Do not make ultrasound or MRI automatic in the learner wording; investigation is determined by the assessing clinician and pathway.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current local shoulder pathway. Acute traumatic marked weakness warrants urgent shoulder assessment. Other tears may be considered for individualised conservative care or specialist review according to function, progression, comorbidity and patient goals.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency/urgent assessment:** cardiac emergency features, fracture/dislocation, neurovascular compromise, or marked acute weakness after trauma.
- **Prompt specialist assessment:** significant or progressive weakness suggesting a substantial tear.
- **Specialist assessment:** persistent disabling symptoms or consideration of operative care after an appropriate shared decision process.

Version 1 does not prescribe universal age cut-offs, fixed two-week surgery timing or automatic imaging.`),
  ],
  'content/shoulder/rotator-cuff-tendinopathy.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Chest, jaw or arm symptoms with dyspnoea or other acute cardiac features require emergency assessment/999.
- Progressive weakness, rapid muscle wasting or another focal neurological deficit requires prompt medical/neurological assessment.
- Infection, malignancy, fracture/dislocation or neurovascular compromise requires escalation according to the presentation.
- Possible diaphragmatic referral should be assessed in its clinical context rather than assigned automatic imaging.

Do not rely on one provocative or special test in isolation to diagnose rotator-cuff tendinopathy; interpret findings with the history and the rest of the examination.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use an exercise-led, individualised rotator-cuff tendinopathy plan consistent with the current clinical practice guideline and local pathway. Progressive motor deficit or marked traumatic weakness follows a separate prompt specialist pathway.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency:** acute cardiac features or another emergency presentation.
- **Prompt medical/specialist assessment:** progressive neurological/motor deficit, rapid wasting or marked traumatic weakness.
- **Specialist shoulder assessment:** persistent disabling symptoms or diagnostic uncertainty despite appropriate rehabilitation.

Investigation and procedure selection are clinician-led; no automatic MRI or fixed operative timeline is asserted.`),
  ],
  'content/shoulder/shoulder-instability.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Unreduced/locked dislocation, fracture-dislocation or vascular compromise requires emergency assessment.
- Perform and document a post-reduction neurovascular examination. A persistent neurological deficit requires prompt specialist assessment.
- Recurrent or persistent instability requires specialist assessment according to the current BESS/local pathway.

Procedure choice, ISIS score, bone-loss thresholds and fixed multidirectional-instability timelines belong to specialist planning, not the Version 1 red-flag criteria.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current BESS/local shoulder instability pathway. Acute dislocation care includes appropriate reduction, post-reduction neurovascular assessment and individualised rehabilitation. Vascular compromise is an emergency. Persistent neurological deficit or recurrent/persistent instability requires specialist review.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency:** vascular compromise, unreduced/locked dislocation or fracture-dislocation.
- **Prompt specialist assessment:** persistent post-reduction neurological deficit or marked traumatic weakness.
- **Specialist assessment:** recurrent/persistent instability or failure to regain acceptable function with appropriate rehabilitation.

Where a persistent nerve deficit is being investigated, test timing and referral route are determined by the specialist pathway. Version 1 does not prescribe fixed age, recurrence-count, ISIS, bone-loss, procedure or multidirectional-instability thresholds.`),
  ],
  'content/shoulder/subacromial-pain-syndrome.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Chest, jaw or arm symptoms with dyspnoea or other acute cardiac features require emergency assessment/999.
- Progressive weakness, rapid muscle wasting or focal neurological deficit requires prompt medical/neurological assessment.
- Infection, malignancy, fracture/dislocation or neurovascular compromise requires escalation according to the presentation.
- Possible referred diaphragmatic pain requires medical assessment in context rather than automatic imaging.

Do not use disproportionate night pain plus age alone as an automatic suspected-cancer pathway rule; apply current NICE NG12/local criteria.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current local shoulder pathway and an individualised exercise-led plan when serious pathology has been excluded. Progressive neurological change or marked traumatic weakness follows a separate prompt specialist pathway.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency:** acute cardiac features or another emergency presentation.
- **Prompt medical/specialist assessment:** progressive neurological deficit, rapid wasting, marked traumatic weakness, infection or other serious pathology concern.
- **Specialist shoulder assessment:** persistent disabling symptoms or diagnostic uncertainty despite appropriate rehabilitation.

Version 1 does not mandate MRI or a fixed referral duration from a general red-flag label.`),
  ],
  'content/elbow/cubital-tunnel-syndrome.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Marked or progressive ulnar motor weakness, intrinsic-muscle wasting, clawing or major sensory loss requires prompt neurological/specialist assessment.
- Trauma with fracture/dislocation or acute neurovascular compromise requires urgent/emergency assessment.
- Atypical systemic, malignancy or mass-lesion features require appropriate medical assessment.

Do not infer that two possible compression sites both require treatment. Evaluate each clinically. Do not make neurophysiology, imaging or decompression automatic from the red-flag statement.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

For clear ulnar compression neuropathy without root-lesion features, NICE NG127 recommendations 1.7.9–1.7.10 support pressure avoidance, orthotic referral and review after 6 weeks, with neurological assessment if there is no improvement.

Progressive motor loss, marked wasting or an atypical presentation requires more prompt specialist assessment. Investigation and operative decisions remain specialist-led.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Prompt specialist/neurological assessment:** marked or progressive motor weakness, wasting, clawing, major sensory loss or diagnostic uncertainty.
- **NICE NG127 pathway:** for clear compression neuropathy without radiculopathy, use pressure avoidance, orthotic referral and 6-week review; refer for neurological assessment if there is no improvement.
- **Emergency/urgent assessment:** trauma with fracture/dislocation or acute neurovascular compromise.

Version 1 does not prescribe automatic decompression, electrodiagnostic thresholds or a fixed operative timeline.`),
  ],
  'content/elbow/elbow-osteoarthritis.mdx': [
    section('## Red Flags', '## Special Tests', `## Red Flags

Findings atypical for elbow osteoarthritis—such as a hot acutely inflamed joint, systemic illness, progressive neurological deficit, rapidly changing swelling/mass, major trauma or suspected malignancy—require medical or specialist assessment according to urgency.

Suspected septic arthritis requires prompt urgent assessment. Do not make aspiration, antibiotics, nerve-conduction testing, imaging or a fixed specialty route automatic in the learner wording.

General NICE NG226 osteoarthritis recommendations must be labelled as general OA guidance where elbow-specific evidence is unavailable.`),
    section('### HSC NI Physiotherapy Pathway', '### Conservative Management', `### Governed Care Pathway

Apply general NICE NG226 osteoarthritis principles cautiously where elbow-specific evidence is unavailable. Use the current local pathway, individualised education/exercise and symptom management. Atypical, inflammatory, neurological or infective presentations require separate assessment.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Urgent assessment:** suspected septic arthritis, acute neurovascular compromise or significant traumatic injury.
- **Prompt medical/specialist assessment:** progressive neurological change, atypical systemic/inflammatory features, rapidly changing mass or suspected malignancy under applicable criteria.
- **Elective specialist assessment:** persistent disabling pain, stiffness or functional loss despite an appropriate conservative plan.

Investigation and operative choice remain clinician/specialist-led; Version 1 does not prescribe fixed operative thresholds.`),
  ],
  'content/elbow/lateral-epicondylalgia.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Acute vascular compromise after limb injury—such as an absent pulse, cold/pale limb or acute sensorimotor compromise—requires emergency assessment. Do not use the classic “5 Ps” as a stand-alone diagnostic rule.
- Significant trauma with suspected fracture/dislocation requires urgent assessment.
- Progressive motor deficit, rapid neurological change, serious infection or malignancy concern requires prompt medical/specialist assessment.

Apply current suspected-cancer criteria rather than age plus night pain as an automatic cancer-pathway rule.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use the current BESS Tennis Elbow/local pathway. In the absence of serious pathology, management is primarily conservative and exercise/load-management based. Progressive neurological change or significant trauma follows a separate specialist pathway.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Emergency/urgent assessment:** acute vascular compromise or suspected significant fracture/dislocation.
- **Prompt medical/specialist assessment:** objective progressive motor deficit, serious infection, mass lesion or suspected malignancy under applicable criteria.
- **Specialist assessment:** persistent disabling symptoms or diagnostic uncertainty despite appropriate conservative care.

No automatic imaging, injection or operative threshold is asserted.`),
  ],
  'content/elbow/medial-epicondylalgia.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Significant weakness, wasting or progressive neurological change requires prompt reassessment and specialist evaluation; “urgent surgical referral” is not assumed without a defined diagnosis and source.
- Suspected physeal/avulsion injury in a young athlete, acute unstable UCL injury, fracture/dislocation or neurovascular compromise requires appropriate imaging/specialist assessment.
- A mass lesion, serious infection or malignancy concern requires medical assessment according to urgency.

Hypothenar-hammer/ulnar-artery thrombosis is a separate vascular differential and should only be pursued when the presentation supports it.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Use individualised load management and rehabilitation when serious pathology has been excluded. Objective motor deficit, suspected UCL/avulsion injury or a mass lesion requires condition-appropriate specialist assessment.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Prompt specialist assessment:** objective motor deficit, significant wasting, suspected UCL/physeal/avulsion injury or a mass lesion.
- **Urgent assessment:** fracture/dislocation, acute neurovascular compromise or serious infection.
- **Specialist assessment:** persistent disabling symptoms or diagnostic uncertainty despite appropriate conservative care.

Detailed operative approaches, fixed nerve/surgery timings, return-to-sport thresholds, outcome percentages and recovery timelines are outside Version 1 and remain future evidence expansion.`),
  ],
  'content/elbow/olecranon-bursitis.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- Suspected septic bursitis requires prompt medical assessment. Urgency depends on systemic illness and the clinical presentation; not every suspected case requires emergency aspiration or admission.
- A hot joint with concern for septic arthritis requires urgent assessment.
- Rapidly changing mass, trauma with neurovascular compromise, or suspected malignancy requires appropriate medical/specialist assessment.

Version 1 does not prescribe MRSA-specific antibiotics, diabetes-based intravenous-antibiotic thresholds, mandatory bursal excision or automatic gout testing. Prescribing and infection management follow current medical/local guidance.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Differentiate non-septic bursitis, suspected septic bursitis, septic arthritis and other causes. Non-septic presentations may receive appropriate conservative care. Suspected infection or gout requires medical assessment and management under current local prescribing/infection guidance.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Urgent assessment:** suspected septic arthritis, systemic illness or rapidly progressive infection.
- **Prompt medical assessment:** suspected septic bursitis or gout, with urgency based on the presentation.
- **Specialist assessment:** persistent/recurrent disabling bursitis, mass lesion, diagnostic uncertainty or suspected malignancy under applicable criteria.

Investigation, aspiration, antibiotics and operative treatment remain medical/specialist decisions.`),
  ],
  'content/elbow/radial-tunnel-syndrome.mdx': [
    section('## Red Flags', '## Clinical Frameworks', `## Red Flags

- True wrist or finger extensor motor deficit is not typical painful radial tunnel syndrome and requires prompt specialist assessment for a motor neuropathy or another neurological cause.
- Significant trauma, fracture/dislocation or acute neurovascular compromise requires urgent assessment.
- A mass lesion, serious infection, inflammatory systemic presentation or malignancy concern requires medical/specialist assessment according to urgency.

Do not make MRI, nerve-conduction studies, EMG or surgical decompression automatic in the red-flag statement.`),
    section('### HSC Northern Ireland Pathway', '### Conservative Management', `### Governed Care Pathway

Pain without objective motor deficit may begin with individualised conservative care after relevant differentials have been considered. Objective motor deficit, significant trauma or a suspected mass lesion requires prompt specialist assessment. Investigation is determined by the specialist pathway.`),
    section('### Onward Referral Criteria', '## Key References', `### Onward Referral Criteria

- **Prompt specialist assessment:** objective wrist/finger extensor weakness, progressive neurological change, suspected mass lesion or diagnostic uncertainty.
- **Urgent assessment:** significant trauma, fracture/dislocation or acute neurovascular compromise.
- **Specialist assessment:** persistent disabling symptoms despite appropriate conservative care.

Detailed operative thresholds, fixed timing, surgical approaches, outcome percentages and recovery timelines are outside Version 1 and remain future evidence expansion.`),
  ],
}

const changedFiles = []
for (const [relativePath, fileReplacements] of Object.entries(replacements)) {
  const absolutePath = path.join(root, ...relativePath.split('/'))
  let content = fs.readFileSync(absolutePath, 'utf8').replaceAll('\r\n', '\n')
  const original = content
  for (const replacement of fileReplacements) content = replaceSection(content, replacement)
  if (content !== original) {
    fs.writeFileSync(absolutePath, content)
    changedFiles.push(relativePath)
  }
}

const adoption = {
  schemaVersion: 1,
  packetType: 'v1-critical-independent-review-owner-adoption',
  independentReviewPacket: { filename: path.basename(reviewPath), sha256: reviewHash, criticalRecommendations: review.recommendations.length },
  ownerConfirmation: {
    actor: 'Eoin Casey',
    confirmedDate: '2026-08-18',
    statement: 'I Eoin confirm the recommended changes',
    authority: 'wording-change-and-removal-implementation-only',
  },
  sourceDecisionPacket: { path: 'reports/publication-readiness/V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json', criticalDecisionCount: 47 },
  recommendations: review.recommendations,
  implementation: {
    touchedFiles: Object.keys(replacements),
    filesChangedByThisRun: changedFiles,
    resultingFiles: Object.keys(replacements).map((relativePath) => ({ relativePath, sha256: sha256(fs.readFileSync(path.join(root, ...relativePath.split('/')))) })),
    regeneratedDecisionPacketRequired: true,
    exactRevisionDecisionsMustBeRecomputed: true,
  },
  clinicalApprovalGranted: false,
  evidenceApprovalGranted: false,
  grantsApproval: false,
  publicationAuthorized: false,
  publicationStateChanged: false,
}
fs.writeFileSync(adoptionPath, `${JSON.stringify(adoption, null, 2)}\n`)
console.log(`Applied ${review.recommendations.length} owner-confirmed critical recommendations across ${changedFiles.length} condition files.`)
console.log(`Adoption record: ${path.relative(root, adoptionPath)} (${sha256(fs.readFileSync(adoptionPath))})`)

function section(start, end, replacement) {
  return { start, end, replacement: `${replacement.trim()}\n\n---\n\n` }
}

function replaceSection(content, { start, end, replacement }) {
  const startMarker = `${start}\n`
  const endMarker = `${end}\n`
  const startIndex = content.indexOf(startMarker)
  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length)
  if (startIndex < 0) {
    const replacementHeading = replacement.trimStart().split('\n')[0]
    if (content.includes(`${replacementHeading}\n`)) return content
    throw new Error(`Cannot replace section ${start} -> ${end}`)
  }
  if (endIndex < 0) throw new Error(`Cannot replace section ${start} -> ${end}`)
  return `${content.slice(0, startIndex)}${replacement}${content.slice(endIndex)}`
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
