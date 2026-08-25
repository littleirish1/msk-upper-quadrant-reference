import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildFinalHumanEvidenceDecisionPacket, renderFinalHumanEvidenceDecisionMarkdown, writeFinalHumanEvidenceDecisionPacket } from './generate-v1-final-human-evidence-decisions.mjs'

const root = process.cwd()
const packet = buildFinalHumanEvidenceDecisionPacket(root)
assert.equal(packet.summary.startingCanonicalClaims, 304)
assert.equal(packet.summary.currentCanonicalClaims, 217)
assert.equal(packet.summary.canonicalClaimsRemovedOrCollapsedByContentHardening, 87)
assert.equal(packet.summary.finalHumanEvidenceDecisionsRemaining, 0)
assert.equal(packet.summary.critical.starting, 62)
assert.equal(packet.summary.critical.directlyVerified, 0)
assert.equal(packet.summary.critical.safelyRewrittenOrRemoved, 14)
assert.equal(packet.summary.critical.scopeBoundaryRecorded, 0)
assert.equal(packet.summary.critical.ownerConfirmedRecommendationImplemented, 48)
assert.equal(packet.summary.critical.humanConfirmationRemaining, 0)
assert.equal(packet.summary.critical.blocked, 0)
assert.equal(packet.summary.diagnosticAccuracy.startingCanonicalDecisions, 53)
assert.equal(packet.summary.diagnosticAccuracy.exactNumericStatisticsRetained, 0)
assert.equal(packet.summary.localService.startingGroups, 9)
assert.equal(packet.summary.localService.currentHumanDecisions, 0)
assert.equal(packet.summary.major.ownerConfirmedRecommendationImplemented, 46)
assert.equal(packet.summary.major.humanDecisionsRemaining, 0)
assert.equal(packet.humanDecisions.length, 0)
assert.equal(packet.humanDecisions.some((decision) => decision.severity === 'CRITICAL'), false)
assert.ok(packet.humanDecisions.every((decision) => decision.revisionHash.match(/^sha256:[a-f0-9]{64}$/)))
assert.ok(packet.humanDecisions.every((decision) => decision.grantsApproval === false && decision.publicationAuthorized === false))
assert.ok(packet.humanDecisions.every((decision) => decision.reviewerDecision.evidence === null && decision.reviewerDecision.wording === null))
assert.ok(packet.humanDecisions.every((decision) => decision.occurrences.length > 0 && decision.learnerClaims.length > 0))
assert.equal(packet.grantsApproval, false)
assert.equal(packet.publicationAuthorized, false)
assert.equal(packet.conditionReadiness.length, 20)
assert.ok(packet.conditionReadiness.every((condition) => condition.readiness === 'READY FOR HUMAN CONFIRMATION'))
assert.equal(packet.resolvedAudit.some((claim) => ['HUMAN CONFIRMATION', 'CONTENT CHANGE REQUIRED', 'BLOCKED'].includes(claim.outcome)), false)

const first = writeFinalHumanEvidenceDecisionPacket(root)
const jsonFirst = fs.readFileSync(first.files.json.path, 'utf8')
const markdownFirst = fs.readFileSync(first.files.markdown.path, 'utf8')
const second = writeFinalHumanEvidenceDecisionPacket(root)
assert.equal(hash(fs.readFileSync(second.files.json.path, 'utf8')), hash(jsonFirst))
assert.equal(hash(fs.readFileSync(second.files.markdown.path, 'utf8')), hash(markdownFirst))
assert.equal(renderFinalHumanEvidenceDecisionMarkdown(packet), markdownFirst)
assert.match(markdownFirst, /grantsApproval: false/)
assert.match(markdownFirst, /publicationAuthorized: false/)

console.log('Version 1 final human evidence decision packet passed: 304 starting claims reduced to zero Critical/Major human evidence decisions; owner confirmations remain non-approving.')

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
