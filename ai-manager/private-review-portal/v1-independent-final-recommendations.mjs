import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH = 'reports/publication-readiness/V1-INDEPENDENT-FINAL-20-CONDITION-RECOMMENDATIONS.json'

const allowedRecommendations = Object.freeze({
  clinicalAccuracy: new Set(['acceptable-for-v1', 'changes-required', 'blocked']),
  evidenceSufficiency: new Set(['acceptable-for-v1', 'changes-required', 'blocked']),
  clinicalCompleteness: new Set(['acceptable-for-v1', 'future-expansion-non-blocking', 'changes-required', 'blocked']),
  publicationRecommendation: new Set(['recommend-publish', 'recommend-hold']),
})

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizeValue(field, value) {
  const aliases = field === 'clinicalCompleteness'
    ? { 'accept-v1': 'acceptable-for-v1', 'future-expansion': 'future-expansion-non-blocking' }
    : field === 'publicationRecommendation'
      ? {}
      : { 'accept-v1': 'acceptable-for-v1' }
  return aliases[value] ?? value
}

function normalizeEntry(entry) {
  const recommendations = entry.recommendations ?? entry.independentRecommendation ?? entry
  const normalized = {
    conditionId: String(entry.conditionId ?? '').trim(),
    exactCurrentRevisionHash: String(entry.exactCurrentRevisionHash ?? entry.conditionRevisionHash ?? entry.exactRevisionHash ?? '').trim(),
    clinicalAccuracy: normalizeValue('clinicalAccuracy', recommendations.clinicalAccuracy),
    evidenceSufficiency: normalizeValue('evidenceSufficiency', recommendations.evidenceSufficiency),
    clinicalCompleteness: normalizeValue('clinicalCompleteness', recommendations.clinicalCompleteness),
    publicationRecommendation: normalizeValue('publicationRecommendation', recommendations.publicationRecommendation),
    reviewerNote: String(entry.reviewerNote ?? entry.reviewerNotes ?? entry.reason ?? entry.note ?? '').trim(),
  }
  if (!normalized.conditionId || !normalized.exactCurrentRevisionHash || !normalized.reviewerNote) throw new Error('Independent final recommendation entries require conditionId, exact revision and a reviewer note.')
  if (!/^sha256:[0-9a-f]{64}$/.test(normalized.exactCurrentRevisionHash)) throw new Error(`Independent final recommendation requires a full SHA-256 revision for ${normalized.conditionId}.`)
  for (const [field, allowed] of Object.entries(allowedRecommendations)) {
    if (!allowed.has(normalized[field])) throw new Error(`Invalid independent final recommendation ${field} for ${normalized.conditionId}.`)
  }
  return normalized
}

export function loadOptionalV1IndependentFinalRecommendations(repositoryRoot, expectedConditions) {
  const file = path.join(repositoryRoot, ...V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH.split('/'))
  if (!fs.existsSync(file)) {
    return {
      available: false,
      path: V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH,
      reason: 'Independent recommendation record is not available in the governed publication-readiness reports.',
      conditions: [],
      grantsApproval: false,
      publicationAuthorized: false,
    }
  }

  const bytes = fs.readFileSync(file)
  const packet = JSON.parse(bytes.toString('utf8'))
  if (packet.grantsApproval === true || packet.publicationAuthorized === true || packet.publicationStateChanged === true) throw new Error('Independent recommendation record exceeds recommendation-only authority.')
  const entries = packet.conditions ?? packet.recommendations
  if (!Array.isArray(entries) || entries.length !== 20) throw new Error('Independent final recommendation record must contain exactly 20 conditions.')
  const conditions = entries.map(normalizeEntry)
  if (new Set(conditions.map((entry) => entry.conditionId)).size !== conditions.length) throw new Error('Independent final recommendation condition IDs must be unique.')

  const expected = new Map(expectedConditions.map((condition) => [condition.conditionId, condition]))
  for (const recommendation of conditions) {
    const condition = expected.get(recommendation.conditionId)
    if (!condition) throw new Error(`Independent recommendation references an unknown condition: ${recommendation.conditionId}.`)
    if (recommendation.exactCurrentRevisionHash !== condition.exactCurrentRevisionHash) throw new Error(`Stale independent recommendation: ${recommendation.conditionId}.`)
  }
  if (conditions.some((recommendation) => !expected.has(recommendation.conditionId)) || expected.size !== conditions.length) throw new Error('Independent recommendation condition set does not match the final confirmation packet.')

  return {
    available: true,
    path: V1_INDEPENDENT_FINAL_RECOMMENDATIONS_PATH,
    sha256: sha256(bytes),
    conditions,
    grantsApproval: false,
    publicationAuthorized: false,
  }
}
