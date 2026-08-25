import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ADOPTION_PATH = 'reports/publication-readiness/V1-MAJOR-INDEPENDENT-REVIEW-ADOPTION.json'
const EXPECTED_REVIEW_SHA256 = '1075f06adca7ac06919fcbc127f3f629c9e7a19bf3db07185d0f065cb4636873'

export function loadVerifiedMajorReviewAdoption(root) {
  const absolutePath = path.join(root, ...ADOPTION_PATH.split('/'))
  if (!fs.existsSync(absolutePath)) return null
  const adoption = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  if (adoption.packetType !== 'v1-major-independent-review-owner-adoption') throw new Error('Invalid Major-review adoption packet type')
  if (adoption.independentReviewPacket?.sha256 !== EXPECTED_REVIEW_SHA256) throw new Error('Unexpected independent Major-review packet hash')
  if (adoption.ownerConfirmation?.actor !== 'Eoin Casey' || adoption.ownerConfirmation?.authority !== 'wording-and-evidence-disposition-implementation-only') throw new Error('Major-review owner authority is missing')
  if (adoption.recommendations?.length !== 23) throw new Error('Major-review adoption must contain 23 recommendations')
  if (adoption.clinicalApprovalGranted !== false || adoption.evidenceApprovalGranted !== false || adoption.grantsApproval !== false || adoption.publicationAuthorized !== false || adoption.publicationStateChanged !== false) throw new Error('Major-review adoption exceeds its authority')
  if (adoption.implementation?.resultingFiles?.length !== 15) throw new Error('Major-review implementation inventory is incomplete')
  const criticalPath = path.join(root, ...adoption.predecessorCriticalAdoption.path.split('/'))
  if (!fs.existsSync(criticalPath) || sha256(fs.readFileSync(criticalPath)) !== adoption.predecessorCriticalAdoption.sha256) throw new Error('Major-review predecessor Critical adoption is stale')
  for (const result of adoption.implementation.resultingFiles) {
    const filePath = path.join(root, ...result.relativePath.split('/'))
    if (!fs.existsSync(filePath) || sha256(fs.readFileSync(filePath)) !== result.sha256) throw new Error(`Stale Major-review implementation: ${result.relativePath}`)
  }
  return { ...adoption, verifiedAgainstCurrentFiles: true, path: ADOPTION_PATH }
}

export function majorClaimCoveredByOwnerAdoption(claim, adoption) {
  if (!adoption?.verifiedAgainstCurrentFiles || claim.severity !== 'MAJOR') return false
  const touched = new Set(adoption.implementation.resultingFiles.map((result) => result.relativePath))
  if (!claim.occurrences.every((occurrence) => touched.has(occurrence.sourceFile))) return false
  return claim.conditionIds.every((conditionId) => adoption.recommendations.some((recommendation) => recommendation.affectedConditions.includes(conditionId) && recommendation.primaryClass === claim.primaryClass.label))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}
