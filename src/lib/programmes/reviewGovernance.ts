import type { ExactRevisionReview } from './schemas'

export interface RevisionTarget {
  id: string
  revision: string
  checksum: `sha256:${string}`
}

export function reviewAppliesToTarget(
  review: ExactRevisionReview,
  target: RevisionTarget,
) {
  return review.targetId === target.id
    && review.targetRevision === target.revision
    && review.targetChecksum === target.checksum
    && review.decision === 'approve'
    && review.stale === false
}

export function invalidateReviewForChangedTarget(
  review: ExactRevisionReview,
  target: RevisionTarget,
): ExactRevisionReview {
  if (
    review.targetId === target.id
    && review.targetRevision === target.revision
    && review.targetChecksum === target.checksum
  ) return { ...review }

  return {
    ...review,
    stale: true,
    decision: 'pending',
    limitations: [...new Set([
      ...review.limitations,
      'The reviewed revision or checksum no longer matches the current target.',
    ])],
  }
}
