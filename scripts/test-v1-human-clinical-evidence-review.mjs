import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  buildHumanClinicalEvidencePacket,
  privacyScanPacket,
  renderHumanClinicalEvidenceMarkdown,
  writeHumanClinicalEvidencePacket,
} from './generate-v1-human-clinical-evidence-review.mjs'

const root = process.cwd()
const expectedTitles = [
  'Cervical Artery Dysfunction',
  'Cervical Myelopathy',
  'Cervical Radiculopathy',
  'Cervicogenic Headache',
  'Mechanical Neck Pain',
  'Whiplash Associated Disorders',
  'Acromioclavicular Joint Disorders',
  'Adhesive Capsulitis (Frozen Shoulder)',
  'Calcific Tendinitis of the Shoulder',
  'Shoulder Labral Tears (SLAP & Bankart Lesions)',
  'Rotator Cuff Tear',
  'Rotator Cuff Tendinopathy',
  'Shoulder Instability',
  'Subacromial Pain Syndrome (SAPS)',
  'Cubital Tunnel Syndrome (Ulnar Neuropathy at the Elbow)',
  'Elbow Osteoarthritis',
  'Lateral Epicondylalgia (Tennis Elbow)',
  "Medial Epicondylalgia (Golfer's Elbow)",
  'Olecranon Bursitis',
  'Radial Tunnel Syndrome',
]

const first = writeHumanClinicalEvidencePacket(root)
const firstJson = fs.readFileSync(first.files.json.path, 'utf8')
const firstMarkdown = fs.readFileSync(first.files.markdown.path, 'utf8')
const firstJsonHash = hash(firstJson)
const firstMarkdownHash = hash(firstMarkdown)
const second = writeHumanClinicalEvidencePacket(root)
const secondJson = fs.readFileSync(second.files.json.path, 'utf8')
const secondMarkdown = fs.readFileSync(second.files.markdown.path, 'utf8')

assert.equal(hash(secondJson), firstJsonHash, 'JSON packet regeneration must be byte-deterministic')
assert.equal(hash(secondMarkdown), firstMarkdownHash, 'Markdown packet regeneration must be byte-deterministic')

const packet = buildHumanClinicalEvidencePacket(root)
assert.equal(packet.conditions.length, 20)
assert.equal(new Set(packet.conditions.map((item) => item.conditionId)).size, 20)
assert.deepEqual(packet.conditions.map((item) => item.title).sort(), expectedTitles.sort())
assert.deepEqual(Object.fromEntries(['cervical', 'shoulder', 'elbow'].map((region) => [region, packet.conditions.filter((item) => item.region === region).length])), { cervical: 6, shoulder: 8, elbow: 6 })
assert.equal(packet.baselineCases.length, 5)
assert.equal(new Set(packet.baselineCases.map((item) => item.caseId)).size, 5)
assert.equal(packet.authority.grantsApproval, false)
assert.equal(packet.authority.publicationAuthorized, false)
assert.equal(packet.authority.publicationStateChanged, false)

for (const condition of packet.conditions) {
  const source = fs.readFileSync(path.join(root, ...condition.sourceFile.split('/')), 'utf8')
  const body = normalize(matter(source).content).replace(/^\n+/, '').replace(/\s+$/, '')
  const markdownBody = body.replace(/[ \t]+$/gm, '')
  assert.equal(condition.exactRevisionHash, `sha256:${hash(source)}`, `${condition.conditionId}: exact revision mismatch`)
  assert.equal(condition.learnerContent.exactMdxBody, body, `${condition.conditionId}: learner content was changed or truncated`)
  assert.ok(firstMarkdown.includes(`<!-- EXACT LEARNER MDX BODY START -->\n${markdownBody}\n<!-- EXACT LEARNER MDX BODY END -->`), `${condition.conditionId}: line-ending-normalized body missing from Markdown`)
  assert.equal(condition.references.length, countStructuredReferences(body), `${condition.conditionId}: incomplete reference list`)
  assert.ok(condition.references.every((reference) => reference.rawEntry && reference.claimSourceRelationship === 'CLAIM-SOURCE RELATIONSHIP NOT YET VERIFIED'))
  assert.equal(condition.review.clinicalAccuracy.decision, null)
  assert.equal(condition.review.clinicalCompleteness.decision, null)
  assert.equal(condition.review.evidence.decision, null)
  assert.equal(condition.review.publicationRecommendation.decision, null)
  assert.equal(condition.review.grantsApproval, false)
  assert.equal(condition.review.publicationAuthorized, false)
  assert.ok(condition.clinicalEvidenceAudit.priorityAClaims.length > 0)
  assert.equal(condition.clinicalEvidenceAudit.priorityAClaimsRequiringHumanVerification, condition.clinicalEvidenceAudit.priorityAClaims.length)
  assert.ok(condition.clinicalEvidenceAudit.priorityAClaims.every((claim) => !claim.claimSourceRelationshipVerified && !claim.humanEvidenceReviewComplete && claim.publicationBlocker))
}

assert.equal(packet.conditions.filter((item) => item.automatedFindings.statement === 'NO AUTOMATED STRUCTURAL/CONTENT DEFECT DETECTED').length, 0)
const cubital = packet.conditions.find((item) => item.conditionId === 'condition.elbow.cubital-tunnel-syndrome')
assert.ok(cubital.cubitalTunnelSpecialReview.obsoleteBibliographyEntry.includes('https://cks.nice.org.uk/topics/peripheral-neuropathy/'))
assert.match(cubital.cubitalTunnelSpecialReview.exactClaimMappingStatus, /NG127 1\.7\.9.*1\.7\.10 IS NOW MAPPED ONLY/)
assert.equal(cubital.cubitalTunnelSpecialReview.proposedEvidence.relationshipStatus, 'AUTHORITATIVE_ANCHOR_ADDED_HUMAN_CONFIRMATION_REQUIRED')
assert.deepEqual(cubital.cubitalTunnelSpecialReview.reviewerDecision.options, [
  'ng127-appropriate-replacement',
  'ng127-partial-support',
  'ng127-not-appropriate',
  'remove-obsolete-citation-without-replacement',
  'alternative-evidence-required',
])
assert.equal(cubital.cubitalTunnelSpecialReview.reviewerDecision.decision, null)
assert.ok(packet.totals.priorityAClaims > 0)
assert.equal(packet.totals.priorityAClaimsRequiringHumanVerification, packet.totals.priorityAClaims)

for (const item of packet.baselineCases) {
  assert.equal(item.clinicalState, 'baseline-reviewed')
  assert.equal(item.evidenceState, 'baseline-preserved')
  assert.equal(item.publicationEligibility, true)
  assert.equal(item.unresolvedEvidenceHubMigration.classification, 'MIGRATION / FOLLOW-UP')
  const source = fs.readFileSync(path.join(root, ...item.exactRevision.sourceFile.split('/')), 'utf8')
  assert.equal(item.currentReferences.length, countStructuredReferences(matter(source).content), `${item.caseId}: incomplete case references`)
}

assert.deepEqual(packet.buildIntegrity.internalLinks, { inspected: 3068, valid: 3068, broken: 0 })
assert.equal(packet.buildIntegrity.fragmentLinks, 680)
assert.equal(packet.buildIntegrity.invalidAnchors, 0)
assert.equal(packet.buildIntegrity.localAssets, 739)
assert.equal(packet.buildIntegrity.missingAssets, 0)
assert.equal(packet.buildIntegrity.orphanPages, 0)
assert.equal(packet.buildIntegrity.privateMarkerFindings, 0)
assert.deepEqual(packet.buildIntegrity.public3dAssets, { glb: 0, gltf: 0, draco: 0 })
assert.equal(packet.buildIntegrity.learnerFacing3dRoutes, 0)
assert.equal(packet.manualQaAppendix.viewportThemeChecks.length, 6)
assert.equal(packet.manualQaAppendix.accessibilityChecks.length, 13)
assert.ok(packet.manualQaAppendix.viewportThemeChecks.every((item) => item.checks.every((check) => check.status === 'NOT_TESTED')))
assert.ok(packet.manualQaAppendix.accessibilityChecks.every((check) => check.status === 'NOT_TESTED'))

const privacy = privacyScanPacket(root, firstJson, firstMarkdown)
assert.equal(privacy.passed, true, `privacy findings: ${privacy.findings.join(', ')}`)
assert.equal(renderHumanClinicalEvidenceMarkdown(packet), firstMarkdown)

console.log(`Human clinical/evidence packet tests passed: 20 conditions, ${packet.totals.conditionReferences} condition references, 5 baseline cases, deterministic Markdown/JSON, privacy scan clean.`)

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalize(value) {
  return value.replace(/\r\n/g, '\n')
}

function countStructuredReferences(body) {
  const normalized = normalize(body)
  const heading = normalized.match(/^##\s+Key References\s*$/im)
  if (!heading) return 0
  const start = (heading.index ?? 0) + heading[0].length
  const rest = normalized.slice(start)
  const nextHeading = rest.search(/^##\s+/m)
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading)
  return [...section.matchAll(/^(?:\d+[.)]|[-*])\s+/gm)].length
}
