import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createV1ClinicalEvidenceAudit } from '../ai-manager/private-review-portal/v1-clinical-evidence-audit.mjs'
import { loadV1ConditionReviewRecords } from '../ai-manager/private-review-portal/v1-publication-review.mjs'

const root = process.cwd()
const records = loadV1ConditionReviewRecords(root)
const audit = createV1ClinicalEvidenceAudit(root, records)

assert.equal(records.length, 20, 'the Version 1 condition scope must remain 20 records')
assert.equal(audit.conditions.length, 20)
assert.equal(audit.grantsApproval, false)
assert.equal(audit.publicationAuthorized, false)
assert.equal(audit.clinicalApprovalGranted, false)
assert.equal(audit.evidenceApprovalGranted, false)
assert.equal(audit.guidelineIdentities.NG194, 'Postnatal care')
assert.equal(audit.guidelineIdentities.NG233, 'Otitis media with effusion in under 12s')
assert.equal(audit.guidelineIdentities.NG59, 'Low back pain and sciatica in over 16s')
assert.match(audit.guidelineIdentities.CG173, /Neuropathic pain in adults/)
assert.ok(audit.summary.correctedGuidelineMappings >= 13)
assert.ok(audit.summary.priorityAClaims > 0)
assert.ok(audit.summary.priorityAClaimsRequiringHumanVerification > 0)

for (const condition of audit.conditions) {
  assert.match(condition.exactRevisionHash, /^sha256:[a-f0-9]{64}$/)
  assert.ok(condition.priorityAClaims.length > 0, `${condition.conditionId} must expose its Priority A review claims`)
  assert.equal(condition.grantsApproval, false)
  assert.equal(condition.publicationAuthorized, false)
  for (const claim of condition.priorityAClaims) {
    assert.equal(claim.priority, 'A')
    assert.equal(claim.claimSourceRelationshipVerified, false)
    assert.equal(claim.humanEvidenceReviewComplete, false)
    assert.equal(claim.revisionHash, condition.exactRevisionHash)
    assert.ok(claim.sourceLine > 0)
    const sourceLine = fs.readFileSync(path.join(root, ...claim.sourceFile.split('/')), 'utf8').split(/\r?\n/)[claim.sourceLine - 1]
    assert.equal(sourceLine.replace(/<[^>]+>/g, '').trim(), claim.exactClaim, `${claim.id} must point to its exact source line`)
  }
}

const targetSource = records.map((record) => fs.readFileSync(path.join(root, ...record.sourceFile.split('/')), 'utf8')).join('\n')
assert.doesNotMatch(targetSource, /NG194\s*(?:\([^)]*\))?\s*(?:guidance|alignment)|NG194\s*\[?Shoulder Pain/i)
assert.doesNotMatch(targetSource, /NG233[^\n]*(?:Shoulder pain|shoulder guideline)/i)
assert.doesNotMatch(targetSource, /NICE\.\s*Neuropathic pain[^\n]*NG173/i)

const calcific = fs.readFileSync(path.join(root, 'content', 'shoulder', 'calcific-tendinitis.mdx'), 'utf8')
assert.match(calcific, /NICE HTG645[^\n]*only in the context of research/i)
assert.doesNotMatch(calcific, /ESWT referral/i)

const cubital = fs.readFileSync(path.join(root, 'content', 'elbow', 'cubital-tunnel-syndrome.mdx'), 'utf8')
assert.match(cubital, /NICE NG127 recommendation 1\.7\.9/i)
assert.match(cubital, /review at 6 weeks/i)
assert.doesNotMatch(cubital, /Splint:\s*elbow at 30/i)
assert.doesNotMatch(cubital, /Duration:\s*minimum 3 months/i)
assert.doesNotMatch(cubital, /Pregabalin 25/i)

const artery = fs.readFileSync(path.join(root, 'content', 'cervical', 'cervical-artery-dysfunction.mdx'), 'utf8')
assert.match(artery, /International IFOMPT Cervical Framework \(2020\)/)
assert.match(artery, /provocative positional testing[^\n]*not recommend/i)
assert.match(artery, /10\.1161\/STR\.0000000000000457/)
assert.doesNotMatch(artery, /symptom onset ≥2 minutes/i)

const radiculopathy = fs.readFileSync(path.join(root, 'content', 'cervical', 'cervical-radiculopathy.mdx'), 'utf8')
assert.match(radiculopathy, /NICE NG127 recommendation 1\.10\.11/)
assert.match(radiculopathy, /NICE \*\*CG173\*\* offers a choice/)
assert.doesNotMatch(radiculopathy, /Gabapentin \(300/i)

const packet = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'publication-readiness', 'v1-clinical-evidence-audit.json'), 'utf8'))
assert.deepEqual(packet.summary, audit.summary, 'generated audit must match current source')

console.log(`Version 1 clinical/evidence audit passed: ${audit.conditions.length} conditions, ${audit.summary.correctedGuidelineMappings} citation corrections, ${audit.summary.priorityAClaims} Priority A claims, approvals remain false.`)
