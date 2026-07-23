import {
  evidenceHubRecordSchema,
  hubRelationshipSchema,
  reviewDecisionSchema,
} from './schemas'
import { canonicalRecordHash } from './lifecycle'
import { publicationDependencyIds } from './publication'
import type {
  EvidenceHubDataset,
  EvidenceHubRecord,
  GraphFinding,
  GraphValidationResult,
  HubRelationship,
} from './types'

const evidenceRoles = new Set(['supports', 'contradicts', 'qualifies', 'contextualises'])

export function validateEvidenceHubGraph(dataset: EvidenceHubDataset): GraphValidationResult {
  const findings: GraphFinding[] = []
  const records: EvidenceHubRecord[] = []
  const relationships: HubRelationship[] = []
  const byId = new Map<string, EvidenceHubRecord>()
  const relationshipIds = new Set<string>()
  const decisionIds = new Set<string>()

  for (const candidate of dataset.records) {
    const result = evidenceHubRecordSchema.safeParse(candidate)
    if (!result.success) {
      for (const issue of result.error.issues) {
        findings.push({
          code: 'record-schema-invalid',
          recordId: String((candidate as { id?: string }).id ?? 'unknown'),
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        })
      }
      continue
    }
    const record = result.data
    if (byId.has(record.id)) {
      findings.push({ code: 'duplicate-record-id', recordId: record.id, message: `duplicate record ID ${record.id}` })
      continue
    }
    byId.set(record.id, record)
    records.push(record)
  }

  for (const candidate of dataset.relationships) {
    const result = hubRelationshipSchema.safeParse(candidate)
    if (!result.success) {
      for (const issue of result.error.issues) {
        findings.push({
          code: 'relationship-schema-invalid',
          relationshipId: String((candidate as { id?: string }).id ?? 'unknown'),
          message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        })
      }
      continue
    }
    const relationship = result.data
    if (relationshipIds.has(relationship.id)) {
      findings.push({ code: 'duplicate-relationship-id', relationshipId: relationship.id, message: `duplicate relationship ID ${relationship.id}` })
      continue
    }
    relationshipIds.add(relationship.id)
    relationships.push(relationship)

    const from = byId.get(relationship.fromId)
    const to = byId.get(relationship.toId)
    if (!from) findings.push({ code: 'missing-from-record', relationshipId: relationship.id, message: `missing from record ${relationship.fromId}` })
    if (!to) findings.push({ code: 'missing-to-record', relationshipId: relationship.id, message: `missing to record ${relationship.toId}` })
    if (!from || !to) continue
    if (from.revision !== relationship.fromRevision) {
      findings.push({ code: 'stale-from-revision', relationshipId: relationship.id, message: `${from.id} revision does not match relationship` })
    }
    if (to.revision !== relationship.toRevision) {
      findings.push({ code: 'stale-to-revision', relationshipId: relationship.id, message: `${to.id} revision does not match relationship` })
    }
    validateRelationshipSemantics(relationship, from, to, findings)
  }

  for (const decision of dataset.reviewDecisions) {
    const result = reviewDecisionSchema.safeParse(decision)
    if (!result.success) {
      findings.push({ code: 'review-decision-invalid', message: result.error.issues.map((issue) => issue.message).join('; ') })
      continue
    }
    if (decisionIds.has(result.data.id)) {
      findings.push({ code: 'duplicate-review-decision-id', message: `duplicate review decision ID ${result.data.id}` })
      continue
    }
    decisionIds.add(result.data.id)
    const target = byId.get(result.data.entityId)
    if (!target) {
      findings.push({ code: 'review-target-missing', recordId: result.data.entityId, message: 'review decision target does not exist' })
    } else if (target.revision !== result.data.entityRevision) {
      findings.push({ code: 'review-revision-stale', recordId: target.id, message: 'review decision targets a different revision' })
    } else if (canonicalRecordHash(target) !== result.data.canonicalRecordHash) {
      findings.push({ code: 'review-hash-stale', recordId: target.id, message: 'review decision hash does not match the target revision' })
    }
  }

  for (const record of records) validateRecordLinks(record, byId, relationships, findings)
  validateSupersessionCycles(relationships, findings)
  validatePublicationDependencyCycles(records, relationships, dataset.reviewDecisions, dataset.proposals, findings)

  return {
    valid: findings.length === 0,
    findings,
    recordCount: records.length,
    relationshipCount: relationships.length,
  }
}

function validateRelationshipSemantics(
  relationship: HubRelationship,
  from: EvidenceHubRecord,
  to: EvidenceHubRecord,
  findings: GraphFinding[],
) {
  if (relationship.fromId === relationship.toId) {
    findings.push({ code: 'self-relationship', relationshipId: relationship.id, message: 'relationships cannot target their source record' })
  }
  if (evidenceRoles.has(relationship.role)) {
    if (from.entityType !== 'evidence' || to.entityType !== 'claim') {
      findings.push({ code: 'invalid-evidence-claim-direction', relationshipId: relationship.id, message: 'evidence relationships must run from Evidence to Claim' })
    }
    if (!relationship.evidenceLocator) {
      findings.push({ code: 'evidence-locator-required', relationshipId: relationship.id, message: 'evidence relationship requires a locator' })
    }
  }
  if (relationship.role === 'uses') {
    const allowedSources = new Set(['condition', 'anatomy', 'exercise', 'clinical-test', 'outcome-measure', 'guided-case', 'media-asset'])
    if (!allowedSources.has(from.entityType) || to.entityType !== 'claim') {
      findings.push({ code: 'invalid-claim-use-role', relationshipId: relationship.id, message: 'uses relationships must run from governed content to a Claim' })
    }
  }
  if (relationship.role === 'references') {
    if (from.entityType === 'guided-case' && to.entityType === 'condition') {
      const revealIndex = from.stages.findIndex((stage) => stage.id === from.diagnosisRevealStageId)
      const linkIndex = from.stages.findIndex((stage) => stage.id === relationship.revealStageId)
      if (!relationship.revealStageId || linkIndex < revealIndex || revealIndex < 0) {
        findings.push({ code: 'condition-link-before-reveal', relationshipId: relationship.id, message: 'guided-case condition links must be reveal-gated' })
      }
    } else if (!(from.entityType === 'evidence' && to.entityType === 'reference')) {
      findings.push({ code: 'invalid-reference-role', relationshipId: relationship.id, message: 'references must link Evidence to Reference or a reveal-gated Guided Case to Condition' })
    }
  }
  if (relationship.role === 'supersedes' && from.entityType !== to.entityType) {
    findings.push({ code: 'invalid-supersession-type', relationshipId: relationship.id, message: 'supersedes relationships require matching entity types' })
  }
}

function validateRecordLinks(
  record: EvidenceHubRecord,
  byId: Map<string, EvidenceHubRecord>,
  relationships: HubRelationship[],
  findings: GraphFinding[],
) {
  const ids = collectDeclaredIds(record)
  for (const id of ids) {
    if (!byId.has(id)) findings.push({ code: 'declared-link-missing', recordId: record.id, message: `${record.id} declares missing ID ${id}` })
  }

  if (record.entityType === 'claim') {
    for (const support of record.support) {
      const target = byId.get(support.evidenceId)
      if (!target || target.entityType !== 'evidence') {
        findings.push({ code: 'claim-evidence-missing', recordId: record.id, message: `claim support does not resolve to Evidence ${support.evidenceId}` })
        continue
      }
      if (target.revision !== support.evidenceRevision) {
        findings.push({ code: 'claim-evidence-revision-stale', recordId: record.id, message: `claim support revision is stale for ${support.evidenceId}` })
      }
      const edge = relationships.find((item) =>
        item.fromId === support.evidenceId
        && item.toId === record.id
        && item.role === support.role,
      )
      if (!edge) findings.push({ code: 'claim-support-edge-missing', recordId: record.id, message: `claim support lacks relationship edge for ${support.evidenceId}` })
    }
  }

  if (record.entityType === 'evidence') {
    for (const referenceId of record.referenceIds) {
      const reference = byId.get(referenceId)
      if (!reference || reference.entityType !== 'reference') {
        findings.push({ code: 'evidence-reference-missing', recordId: record.id, message: `Evidence Reference does not resolve: ${referenceId}` })
        continue
      }
      const edge = relationships.find((item) =>
        item.fromId === record.id
        && item.toId === referenceId
        && item.role === 'references',
      )
      if (!edge) findings.push({ code: 'evidence-reference-edge-missing', recordId: record.id, message: `Evidence Reference lacks an explicit relationship edge: ${referenceId}` })
    }
  }

  if (record.entityType === 'guided-case') {
    const revealIndex = record.stages.findIndex((stage) => stage.id === record.diagnosisRevealStageId)
    for (const [stageIndex, stage] of record.stages.entries()) {
      for (const claimId of stage.claimIds) {
        const claim = byId.get(claimId)
        if (claim?.entityType === 'claim' && claim.diagnosisBearing && stageIndex < revealIndex) {
          findings.push({ code: 'diagnosis-claim-before-reveal', recordId: record.id, message: `${claimId} appears before diagnosis reveal` })
        }
      }
    }
  }
}

function collectDeclaredIds(record: EvidenceHubRecord) {
  const keys = Object.keys(record).filter((key) => key.endsWith('Id') || key.endsWith('Ids'))
  const ids: string[] = []
  for (const key of keys) {
    if (['id', 'diagnosisRevealStageId'].includes(key)) continue
    const value = (record as unknown as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.includes('.')) ids.push(value)
    if (Array.isArray(value)) ids.push(...value.filter((item): item is string => typeof item === 'string' && item.includes('.')))
  }
  if (record.entityType === 'condition') {
    for (const sectionIds of Object.values(record.sectionClaims)) ids.push(...sectionIds)
  }
  if (record.entityType === 'claim') {
    ids.push(...record.support.map((item) => item.evidenceId))
  }
  if (record.entityType === 'guided-case') {
    for (const stage of record.stages) ids.push(...stage.claimIds)
  }
  return [...new Set(ids)]
}

function validateSupersessionCycles(relationships: HubRelationship[], findings: GraphFinding[]) {
  const next = new Map(relationships.filter((item) => item.role === 'supersedes').map((item) => [item.fromId, item.toId]))
  for (const start of next.keys()) {
    const seen = new Set<string>()
    let current: string | undefined = start
    while (current) {
      if (seen.has(current)) {
        findings.push({ code: 'supersession-cycle', recordId: start, message: `supersession cycle includes ${current}` })
        break
      }
      seen.add(current)
      current = next.get(current)
    }
  }
}

function validatePublicationDependencyCycles(
  records: EvidenceHubRecord[],
  relationships: HubRelationship[],
  reviewDecisions: EvidenceHubDataset['reviewDecisions'],
  proposals: EvidenceHubDataset['proposals'],
  findings: GraphFinding[],
) {
  const dataset = { records, relationships, reviewDecisions, proposals }
  const graph = new Map(records.map((record) => [record.id, publicationDependencyIds(record, dataset)]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (recordId: string, trail: string[]) => {
    if (visiting.has(recordId)) {
      findings.push({
        code: 'publication-dependency-cycle',
        recordId,
        message: `publication dependency cycle: ${[...trail, recordId].join(' -> ')}`,
      })
      return
    }
    if (visited.has(recordId)) return
    visiting.add(recordId)
    for (const dependencyId of graph.get(recordId) ?? []) {
      if (graph.has(dependencyId)) visit(dependencyId, [...trail, recordId])
    }
    visiting.delete(recordId)
    visited.add(recordId)
  }

  for (const recordId of graph.keys()) visit(recordId, [])
}
