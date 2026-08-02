import crypto from 'node:crypto'

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
}

export function exactRevisionKey(entityType, entityId, revision, contentHash) {
  return `${entityType}:${entityId}@${revision}#sha256:${contentHash}`
}

export function decisionApplies(decision, target) {
  return decision.state === 'approved' && decision.approvedExactRevisionKey === target.exactRevisionKey
}

export function deriveState(review) {
  const decisions = review.decisions.map((decision) => {
    if (decision.state === 'approved' && !decisionApplies(decision, review.target)) {
      return { ...decision, state: 'stale' }
    }
    return decision
  })
  const eligibleForPublication = decisions.every((decision) => decisionApplies(decision, review.target))
  return {
    ...review,
    decisions,
    eligibleForPublication,
    blockers: eligibleForPublication ? [] : decisions.filter((decision) => !decisionApplies(decision, review.target)).map((decision) => `${decision.reviewKind}:exact-revision-approval-required`),
  }
}
