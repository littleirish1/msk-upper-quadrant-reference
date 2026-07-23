import { canonicalRecordHash, hasApproval, requiresClinicianApproval } from './lifecycle'
import type {
  EvidenceHubDataset,
  EvidenceHubRecord,
  PublicationDecision,
} from './types'

const PRIVATE_PROJECTION_KEYS = new Set([
  'canonicalRecordHash',
  'changeSummary',
  'checksum',
  'clinicalApprovalRepresented',
  'internalTitle',
  'locator',
  'notes',
  'provenance',
  'reviewStatus',
  'reviewerDecisionId',
  'sourceChecksums',
  'sourceIds',
  'sourceLocators',
  'sourceProvenance',
  'supersedesRevision',
  'verificationEvidence',
  'wordingNotes',
])

export function evaluatePublication(
  record: EvidenceHubRecord,
  dataset: EvidenceHubDataset,
): PublicationDecision {
  return evaluatePublicationInternal(record, dataset, new Set())
}

function evaluatePublicationInternal(
  record: EvidenceHubRecord,
  dataset: EvidenceHubDataset,
  ancestors: Set<string>,
): PublicationDecision {
  const reasons: string[] = []
  const byId = new Map(dataset.records.map((item) => [item.id, item]))
  const dependencies = publicationDependencyIds(record, dataset)

  if (ancestors.has(record.id)) {
    return {
      entityId: record.id,
      entityRevision: record.revision,
      eligible: false,
      reasons: [`publication dependency cycle includes ${record.id}`],
      dependencyIds: dependencies,
    }
  }
  if (!record.publicEligibility) reasons.push('publicEligibility is false')
  if (record.lifecycleStatus !== 'active') reasons.push('lifecycle status is not active')
  if (record.reviewStatus !== 'approved') reasons.push('review status is not approved')

  const nextAncestors = new Set(ancestors).add(record.id)
  for (const dependencyId of dependencies) {
    const dependency = byId.get(dependencyId)
    if (!dependency) {
      reasons.push(`dependency is missing: ${dependencyId}`)
      continue
    }
    const decision = evaluatePublicationInternal(dependency, dataset, nextAncestors)
    if (!decision.eligible) {
      for (const reason of decision.reasons) reasons.push(`dependency ${dependencyId}: ${reason}`)
    }
  }

  if (record.entityType === 'claim') {
    if (record.support.length === 0) reasons.push('claim has no evidence support')
    for (const support of record.support) {
      const evidence = byId.get(support.evidenceId)
      if (!evidence || evidence.entityType !== 'evidence') reasons.push(`claim evidence is unavailable: ${support.evidenceId}`)
      else if (evidence.revision !== support.evidenceRevision) reasons.push(`claim evidence revision is stale: ${support.evidenceId}`)
    }
  }

  if (record.entityType === 'evidence') {
    if (record.referenceIds.length === 0) reasons.push('evidence has no canonical Reference dependency')
    if (record.verificationStatus !== 'full-text-reviewed') reasons.push('evidence has not completed full-text review')
    if (record.appraisalStatus !== 'appraised') reasons.push('evidence appraisal is incomplete')
    if (record.sourceLocators.some((source) =>
      source.eligibilityStatus !== 'cleared-for-private-evidence-processing'
      || !source.clearanceScope.includes('public-evidence-use')
    )) {
      reasons.push('evidence source lacks explicit public-evidence-use clearance')
    }
    for (const referenceId of record.referenceIds) {
      const reference = byId.get(referenceId)
      if (!reference || reference.entityType !== 'reference') reasons.push(`canonical Reference is unavailable: ${referenceId}`)
    }
  }

  if (record.entityType === 'reference') {
    if (record.verificationStatus !== 'bibliographic-verified') reasons.push('Reference is not bibliographically verified')
    if (!record.verificationEvidence) reasons.push('Reference lacks verification evidence')
  }

  if (record.entityType === 'media-asset') {
    if (record.rightsStatus !== 'approved') reasons.push('media rights are not approved')
    if (record.accessibilityStatus !== 'approved') reasons.push('media accessibility is not approved')
  }

  if (requiresClinicianApproval(record) && !hasApproval(record, dataset.reviewDecisions, 'clinician', 'clinical-meaning')) {
    reasons.push('exact record revision lacks clinician approval')
  }
  if (record.entityType === 'evidence' && !hasApproval(record, dataset.reviewDecisions, 'evidence-reviewer', 'evidence')) {
    reasons.push('exact evidence revision lacks evidence-review approval')
  }
  if (record.entityType === 'media-asset' && !hasApproval(record, dataset.reviewDecisions, 'rights-reviewer', 'rights')) {
    reasons.push('exact media revision lacks rights approval')
  }

  for (const decision of dataset.reviewDecisions.filter((item) => item.entityId === record.id && item.entityRevision === record.revision)) {
    if (decision.canonicalRecordHash !== canonicalRecordHash(record)) reasons.push('review decision hash does not match record revision')
  }

  return {
    entityId: record.id,
    entityRevision: record.revision,
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    dependencyIds: dependencies,
  }
}

export function buildPublicProjection(dataset: EvidenceHubDataset): unknown[] {
  const decisions = dataset.records.map((record) => evaluatePublication(record, dataset))
  const blockedMarkedPublic = decisions.filter((decision) => {
    const record = dataset.records.find((item) => item.id === decision.entityId)
    return record?.publicEligibility && !decision.eligible
  })
  if (blockedMarkedPublic.length) {
    throw new Error([
      'Evidence Hub public projection failed closed.',
      ...blockedMarkedPublic.flatMap((decision) => decision.reasons.map((reason) => `- ${decision.entityId}: ${reason}`)),
    ].join('\n'))
  }

  return dataset.records
    .filter((record) => decisions.find((decision) => decision.entityId === record.id)?.eligible)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((record) => stripPrivateProjectionFields(record))
}

export function publicationDependencyIds(record: EvidenceHubRecord, dataset: EvidenceHubDataset): string[] {
  const ids = new Set<string>()
  for (const relationship of dataset.relationships) {
    if (relationship.fromId === record.id && ['uses', 'references', 'illustrates', 'measures', 'assesses', 'applies-to'].includes(relationship.role)) {
      ids.add(relationship.toId)
    }
    if (relationship.toId === record.id && ['supports', 'contradicts', 'qualifies', 'contextualises'].includes(relationship.role)) {
      ids.add(relationship.fromId)
    }
  }
  if (record.entityType === 'claim') for (const support of record.support) ids.add(support.evidenceId)
  if (record.entityType === 'evidence') for (const referenceId of record.referenceIds) ids.add(referenceId)
  return [...ids].sort()
}

function stripPrivateProjectionFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateProjectionFields)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !PRIVATE_PROJECTION_KEYS.has(key))
      .map(([key, item]) => [key, stripPrivateProjectionFields(item)]),
  )
}
