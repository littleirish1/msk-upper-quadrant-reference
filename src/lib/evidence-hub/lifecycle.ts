import { createHash } from 'node:crypto'
import type { EvidenceHubRecord, ReviewDecision } from './types'

export const reviewTransitions = {
  unreviewed: ['structural-review'],
  'structural-review': ['changes-requested', 'evidence-review'],
  'evidence-review': ['changes-requested', 'clinician-review', 'approved'],
  'clinician-review': ['changes-requested', 'approved'],
  'changes-requested': ['unreviewed', 'structural-review'],
  approved: ['changes-requested'],
} as const

export const lifecycleTransitions = {
  draft: ['active', 'archived'],
  active: ['deprecated', 'archived'],
  deprecated: ['active', 'archived'],
  archived: [],
} as const

export function canTransitionReview(from: string, to: string) {
  return (reviewTransitions[from as keyof typeof reviewTransitions] as readonly string[] | undefined)?.includes(to) ?? false
}

export function canTransitionLifecycle(from: string, to: string) {
  return (lifecycleTransitions[from as keyof typeof lifecycleTransitions] as readonly string[] | undefined)?.includes(to) ?? false
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function canonicalRecordHash(record: EvidenceHubRecord): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(canonicalJson(record), 'utf8').digest('hex')}`
}

export function decisionMatchesRecord(decision: ReviewDecision, record: EvidenceHubRecord) {
  return decision.entityId === record.id
    && decision.entityRevision === record.revision
    && decision.canonicalRecordHash === canonicalRecordHash(record)
}

export function hasApproval(
  record: EvidenceHubRecord,
  decisions: ReviewDecision[],
  reviewerRole: ReviewDecision['reviewerRole'],
  scope: ReviewDecision['scope'][number],
) {
  return decisions.some((decision) =>
    decisionMatchesRecord(decision, record)
    && decision.reviewerRole === reviewerRole
    && decision.scope.includes(scope)
    && decision.decision === 'approve',
  )
}

export function requiresClinicianApproval(record: EvidenceHubRecord) {
  return [
    'claim',
    'condition',
    'anatomy',
    'exercise',
    'clinical-test',
    'outcome-measure',
    'guided-case',
  ].includes(record.entityType)
}
