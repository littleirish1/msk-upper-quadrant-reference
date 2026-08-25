import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ADOPTION_PATH = 'reports/publication-readiness/V1-CRITICAL-INDEPENDENT-REVIEW-ADOPTION.json'
const EXPECTED_REVIEW_SHA256 = '4757cec86671d15105c9fe6fe399d4c082ad880a3aa9cb391139a9a19e954c10'

export function loadVerifiedCriticalReviewAdoption(root) {
  const absolutePath = path.join(root, ...ADOPTION_PATH.split('/'))
  if (!fs.existsSync(absolutePath)) return null
  const adoption = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  if (adoption.packetType !== 'v1-critical-independent-review-owner-adoption') throw new Error('Invalid critical-review adoption packet type')
  if (adoption.independentReviewPacket?.sha256 !== EXPECTED_REVIEW_SHA256) throw new Error('Unexpected independent critical-review packet hash')
  if (adoption.ownerConfirmation?.actor !== 'Eoin Casey' || adoption.ownerConfirmation?.authority !== 'wording-change-and-removal-implementation-only') throw new Error('Critical-review owner authority is missing')
  if (adoption.recommendations?.length !== 47) throw new Error('Critical-review adoption must contain 47 recommendations')
  if (adoption.clinicalApprovalGranted !== false || adoption.evidenceApprovalGranted !== false || adoption.grantsApproval !== false || adoption.publicationAuthorized !== false || adoption.publicationStateChanged !== false) throw new Error('Critical-review adoption exceeds its authority')
  if (adoption.implementation?.touchedFiles?.length !== 20 || adoption.implementation?.resultingFiles?.length !== 20) throw new Error('Critical-review implementation inventory is incomplete')
  const majorAdoptionPath = path.join(root, 'reports', 'publication-readiness', 'V1-MAJOR-INDEPENDENT-REVIEW-ADOPTION.json')
  const majorAdoption = fs.existsSync(majorAdoptionPath) ? JSON.parse(fs.readFileSync(majorAdoptionPath, 'utf8')) : null
  const criticalAdoptionSha256 = sha256(fs.readFileSync(absolutePath))
  if (majorAdoption && (majorAdoption.predecessorCriticalAdoption?.sha256 !== criticalAdoptionSha256 || majorAdoption.grantsApproval !== false || majorAdoption.publicationAuthorized !== false)) throw new Error('Invalid Critical-to-Major adoption chain')
  const majorResults = new Map((majorAdoption?.implementation?.resultingFiles ?? []).map((result) => [result.relativePath, result.sha256]))
  for (const result of adoption.implementation.resultingFiles) {
    const filePath = path.join(root, ...result.relativePath.split('/'))
    if (!fs.existsSync(filePath)) throw new Error(`Stale critical-review implementation: ${result.relativePath}`)
    const currentHash = sha256(fs.readFileSync(filePath))
    if (currentHash !== result.sha256 && majorResults.get(result.relativePath) !== currentHash) throw new Error(`Stale critical-review implementation: ${result.relativePath}`)
  }
  return { ...adoption, verifiedAgainstCurrentFiles: true, verifiedThroughMajorAdoption: Boolean(majorAdoption), path: ADOPTION_PATH }
}

export function criticalClaimCoveredByOwnerAdoption(claim, adoption) {
  if (!adoption?.verifiedAgainstCurrentFiles || claim.severity !== 'CRITICAL') return false
  const touched = new Set(adoption.implementation.touchedFiles)
  if (!claim.occurrences.every((occurrence) => touched.has(occurrence.sourceFile))) return false
  // The implementation deliberately rewrites whole governed red-flag/referral
  // sections. Canonicalisation can therefore reclassify the resulting, safer
  // wording (for example from emergency to referral) even though it was
  // produced by the adopted recommendation set. Bind coverage to the exact
  // resulting file hashes and to recommendation coverage for every condition,
  // rather than to the pre-rewrite classifier label.
  return claim.conditionIds.every((conditionId) => adoption.recommendations.some((recommendation) => recommendation.conditions.includes(conditionId)))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
