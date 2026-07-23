import type {
  EvidenceHubRecord,
  HubRelationship,
} from './types'

export interface DeclaredDependency {
  dependencyId: string
  field: string
  relationshipFromId: string
  relationshipToId: string
  relationshipRoles: HubRelationship['role'][]
  expectedEntityTypes?: EvidenceHubRecord['entityType'][]
  revealStageId?: string
}

const CLAIM_TYPE: EvidenceHubRecord['entityType'][] = ['claim']
const MEDIA_TYPE: EvidenceHubRecord['entityType'][] = ['media-asset']

export function declaredRecordDependencies(record: EvidenceHubRecord): DeclaredDependency[] {
  const dependencies: DeclaredDependency[] = []
  const outgoing = (
    dependencyId: string,
    field: string,
    relationshipRoles: HubRelationship['role'][],
    expectedEntityTypes?: EvidenceHubRecord['entityType'][],
    revealStageId?: string,
  ) => dependencies.push({
    dependencyId,
    field,
    relationshipFromId: record.id,
    relationshipToId: dependencyId,
    relationshipRoles,
    expectedEntityTypes,
    revealStageId,
  })
  const incoming = (
    dependencyId: string,
    field: string,
    relationshipRoles: HubRelationship['role'][],
    expectedEntityTypes?: EvidenceHubRecord['entityType'][],
  ) => dependencies.push({
    dependencyId,
    field,
    relationshipFromId: dependencyId,
    relationshipToId: record.id,
    relationshipRoles,
    expectedEntityTypes,
  })
  const outgoingClaims = (ids: string[], field: string) => {
    for (const id of ids) outgoing(id, field, ['uses'], CLAIM_TYPE)
  }
  const outgoingRelated = (ids: string[], field: string) => {
    for (const id of ids) outgoing(id, field, ['related-to'])
  }
  const incomingMedia = (ids: string[], field: string) => {
    for (const id of ids) incoming(id, field, ['illustrates'], MEDIA_TYPE)
  }

  if (record.entityType === 'evidence') {
    for (const id of record.referenceIds ?? []) outgoing(id, 'referenceIds', ['references'], ['reference'])
    for (const id of record.supersededByEvidenceIds ?? []) {
      incoming(id, 'supersededByEvidenceIds', ['supersedes'], ['evidence'])
    }
  }

  if (record.entityType === 'claim') {
    for (const support of record.support) {
      incoming(support.evidenceId, 'support', [support.role], ['evidence'])
    }
    if (record.parentClaimId) outgoing(record.parentClaimId, 'parentClaimId', ['related-to'], CLAIM_TYPE)
    outgoingRelated(record.relatedClaimIds ?? [], 'relatedClaimIds')
  }

  if (hasRelatedContent(record)) {
    outgoingClaims(record.claimIds ?? [], 'claimIds')
    outgoingRelated(record.relatedContentIds ?? [], 'relatedContentIds')
    incomingMedia(record.mediaAssetIds ?? [], 'mediaAssetIds')
  }

  if (record.entityType === 'condition') {
    for (const [section, claimIds] of Object.entries(record.sectionClaims)) {
      outgoingClaims(claimIds, `sectionClaims.${section}`)
    }
    outgoingRelated(record.guidedCaseIds ?? [], 'guidedCaseIds')
    outgoingRelated(record.anatomyIds ?? [], 'anatomyIds')
    outgoingRelated(record.exerciseIds ?? [], 'exerciseIds')
    outgoingRelated(record.clinicalTestIds ?? [], 'clinicalTestIds')
    outgoingRelated(record.outcomeMeasureIds ?? [], 'outcomeMeasureIds')
  }

  if (record.entityType === 'anatomy') {
    outgoingRelated(record.anatomyRelationshipIds ?? [], 'anatomyRelationshipIds')
    outgoingClaims(record.originClaimIds ?? [], 'originClaimIds')
    outgoingClaims(record.insertionClaimIds ?? [], 'insertionClaimIds')
    outgoingClaims(record.innervationClaimIds ?? [], 'innervationClaimIds')
    outgoingClaims(record.functionClaimIds ?? [], 'functionClaimIds')
    outgoingClaims(record.courseClaimIds ?? [], 'courseClaimIds')
    outgoingClaims(record.examinationClaimIds ?? [], 'examinationClaimIds')
  }

  if (record.entityType === 'exercise') {
    outgoingClaims(record.purposeClaimIds, 'purposeClaimIds')
    outgoingClaims(record.instructionClaimIds, 'instructionClaimIds')
    outgoingClaims(record.safetyClaimIds, 'safetyClaimIds')
    outgoingClaims(record.dosageClaimIds ?? [], 'dosageClaimIds')
    outgoingClaims(record.progressionClaimIds ?? [], 'progressionClaimIds')
    outgoingClaims(record.regressionClaimIds ?? [], 'regressionClaimIds')
    outgoingClaims(record.contraindicationClaimIds ?? [], 'contraindicationClaimIds')
  }

  if (record.entityType === 'clinical-test') {
    outgoingClaims(record.purposeClaimIds, 'purposeClaimIds')
    outgoingClaims(record.techniqueClaimIds, 'techniqueClaimIds')
    outgoingClaims(record.interpretationClaimIds, 'interpretationClaimIds')
    outgoingClaims(record.limitationClaimIds, 'limitationClaimIds')
    outgoingClaims(record.cautionClaimIds ?? [], 'cautionClaimIds')
    outgoingClaims(record.diagnosticAccuracyClaimIds ?? [], 'diagnosticAccuracyClaimIds')
    outgoingRelated(record.clusterMemberIds ?? [], 'clusterMemberIds')
  }

  if (record.entityType === 'outcome-measure') {
    outgoingClaims(record.constructClaimIds, 'constructClaimIds')
    outgoingClaims(record.populationClaimIds, 'populationClaimIds')
    outgoingClaims(record.scoringClaimIds, 'scoringClaimIds')
    outgoingClaims(record.interpretationClaimIds ?? [], 'interpretationClaimIds')
    outgoingClaims(record.measurementPropertyClaimIds ?? [], 'measurementPropertyClaimIds')
    outgoingClaims(record.mcidClaimIds ?? [], 'mcidClaimIds')
    outgoingClaims(record.mdcClaimIds ?? [], 'mdcClaimIds')
    if (record.formMediaAssetId) incoming(record.formMediaAssetId, 'formMediaAssetId', ['illustrates'], MEDIA_TYPE)
  }

  if (record.entityType === 'guided-case') {
    outgoing(
      record.linkedConditionId,
      'linkedConditionId',
      ['references'],
      ['condition'],
      record.diagnosisRevealStageId,
    )
    for (const stage of record.stages) outgoingClaims(stage.claimIds, `stages.${stage.id}.claimIds`)
    outgoingRelated(record.anatomyIds ?? [], 'anatomyIds')
    outgoingRelated(record.exerciseIds ?? [], 'exerciseIds')
    outgoingRelated(record.clinicalTestIds ?? [], 'clinicalTestIds')
    outgoingRelated(record.outcomeMeasureIds ?? [], 'outcomeMeasureIds')
    incomingMedia(record.mediaAssetIds ?? [], 'mediaAssetIds')
    outgoingRelated(record.learningModeIds ?? [], 'learningModeIds')
  }

  if (record.entityType === 'reference' && record.canonicalReferenceId) {
    outgoing(record.canonicalReferenceId, 'canonicalReferenceId', ['related-to'], ['reference'])
  }

  if (record.entityType === 'media-asset') {
    outgoingRelated(record.relatedContentIds ?? [], 'relatedContentIds')
    outgoingClaims(record.clinicalAnnotationClaimIds ?? [], 'clinicalAnnotationClaimIds')
    if (record.derivativeOfMediaAssetId) {
      outgoing(record.derivativeOfMediaAssetId, 'derivativeOfMediaAssetId', ['related-to'], MEDIA_TYPE)
    }
  }

  return deduplicateDependencies(dependencies)
}

export function findDependencyRelationship(
  dependency: DeclaredDependency,
  relationships: HubRelationship[],
): HubRelationship | undefined {
  return relationships.find((relationship) =>
    relationship.fromId === dependency.relationshipFromId
    && relationship.toId === dependency.relationshipToId
    && dependency.relationshipRoles.includes(relationship.role)
    && (!dependency.revealStageId || relationship.revealStageId === dependency.revealStageId),
  )
}

function hasRelatedContent(
  record: EvidenceHubRecord,
): record is Extract<EvidenceHubRecord, {
  entityType: 'condition' | 'anatomy' | 'exercise' | 'clinical-test' | 'outcome-measure'
}> {
  return ['condition', 'anatomy', 'exercise', 'clinical-test', 'outcome-measure'].includes(record.entityType)
}

function deduplicateDependencies(dependencies: DeclaredDependency[]): DeclaredDependency[] {
  const seen = new Set<string>()
  return dependencies.filter((dependency) => {
    const key = [
      dependency.field,
      dependency.relationshipFromId,
      dependency.relationshipToId,
      dependency.relationshipRoles.join(','),
      dependency.revealStageId ?? '',
    ].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
