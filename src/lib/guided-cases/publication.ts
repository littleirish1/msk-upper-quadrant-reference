import {
  guidedCaseRecordSchema,
  type GuidedCaseRecord,
  type PublicationClass,
} from './schema'

export const GUIDED_CASE_FIELD_CLASSIFICATION = Object.freeze({
  schemaVersion: 'public-immediate',
  caseId: 'public-immediate',
  learnerCaseNumber: 'public-immediate',
  neutralTitle: 'public-immediate',
  region: 'public-immediate',
  publicSlug: 'public-immediate',
  contentRevision: 'public-immediate',
  contentHash: 'internal-only',
  lifecycleState: 'public-immediate',
  publicationEligibility: 'public-immediate',
  difficulty: 'public-immediate',
  estimatedTime: 'public-immediate',
  privateDiagnosticIdentity: 'public-after-reveal',
  learnerPresentation: 'public-immediate',
  reasoningStages: 'human-review-required',
  governance: 'internal-only',
  provenance: 'internal-only',
  evidenceHub: 'internal-only',
} satisfies Record<keyof GuidedCaseRecord, PublicationClass>)

export const REASONING_STAGE_FIELD_CLASSIFICATION = Object.freeze({
  id: 'public-immediate',
  type: 'public-immediate',
  order: 'public-immediate',
  learnerQuestion: 'public-immediate',
  neutralSupportingInformation: 'public-immediate',
  expectedReasoningThemes: 'public-after-reveal',
  modelReasoningChecklist: 'public-after-reveal',
  commonPitfalls: 'public-after-reveal',
  feedback: 'public-after-reveal',
  revealState: 'internal-only',
  sourceSectionHeading: 'internal-only',
  humanReviewRequired: 'internal-only',
} satisfies Record<keyof GuidedCaseRecord['reasoningStages'][number], PublicationClass>)

export interface PublicImmediateCase {
  schemaVersion: number
  caseId: string
  learnerCaseNumber: string
  neutralTitle: string
  region: string
  publicSlug: string
  contentRevision: number
  difficulty?: string
  estimatedTime?: string
  initialPresentation: string
  reasoningPrompts: Array<{
    id: string
    type: string
    order: number
    learnerQuestion: string
    neutralSupportingInformation?: string
  }>
}

export interface PublicRevealCase {
  schemaVersion: number
  caseId: string
  contentRevision: number
  internalTitle: string
  likelyDiagnosis: string
  associatedConditionId: string
  reasoningFeedback: Array<{
    id: string
    expectedReasoningThemes: string[]
    modelReasoningChecklist: string[]
    commonPitfalls: string[]
    feedback?: string
  }>
}

export function createPublicImmediateCase(input: unknown): PublicImmediateCase {
  const record = parseAndClassify(input)
  assertPublicationEligible(record)
  return {
    schemaVersion: record.schemaVersion,
    caseId: record.caseId,
    learnerCaseNumber: record.learnerCaseNumber,
    neutralTitle: record.neutralTitle,
    region: record.region,
    publicSlug: record.publicSlug,
    contentRevision: record.contentRevision,
    ...(record.difficulty ? { difficulty: record.difficulty } : {}),
    ...(record.estimatedTime ? { estimatedTime: record.estimatedTime } : {}),
    initialPresentation: record.learnerPresentation.initialPresentation,
    reasoningPrompts: record.reasoningStages
      .filter((stage) => stage.revealState !== 'internal-only')
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        id: stage.id,
        type: stage.type,
        order: stage.order,
        learnerQuestion: stage.learnerQuestion,
        ...(stage.neutralSupportingInformation
          ? { neutralSupportingInformation: stage.neutralSupportingInformation }
          : {}),
      })),
  }
}

export function createPublicRevealPayload(input: unknown): PublicRevealCase {
  const record = parseAndClassify(input)
  assertPublicationEligible(record)
  return {
    schemaVersion: record.schemaVersion,
    caseId: record.caseId,
    contentRevision: record.contentRevision,
    internalTitle: record.privateDiagnosticIdentity.internalTitle,
    likelyDiagnosis: record.privateDiagnosticIdentity.likelyDiagnosis,
    associatedConditionId: record.privateDiagnosticIdentity.associatedConditionId,
    reasoningFeedback: record.reasoningStages
      .filter((stage) => stage.revealState === 'public-after-reveal')
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        id: stage.id,
        expectedReasoningThemes: [...stage.expectedReasoningThemes],
        modelReasoningChecklist: [...stage.modelReasoningChecklist],
        commonPitfalls: [...stage.commonPitfalls],
        ...(stage.feedback ? { feedback: stage.feedback } : {}),
      })),
  }
}

export function createInternalCaseReviewModel(input: unknown): GuidedCaseRecord {
  return structuredClone(parseAndClassify(input))
}

export function assertPublicationEligible(record: GuidedCaseRecord): void {
  if (!record.publicationEligibility || record.lifecycleState !== 'published') {
    throw new Error(`Guided case is not publication eligible: ${record.caseId}`)
  }
  const decision = record.governance.publicationDecision
  if (decision.approvedRevision !== record.contentRevision
    || decision.approvedContentHash !== record.contentHash) {
    throw new Error(`Guided-case publication approval is stale: ${record.caseId}`)
  }
}

function parseAndClassify(input: unknown): GuidedCaseRecord {
  const parsed = guidedCaseRecordSchema.parse(input)
  assertEveryFieldClassified(parsed, GUIDED_CASE_FIELD_CLASSIFICATION, 'guided case')
  for (const stage of parsed.reasoningStages) {
    assertEveryFieldClassified(stage, REASONING_STAGE_FIELD_CLASSIFICATION, `reasoning stage ${stage.id}`)
  }
  return parsed
}

function assertEveryFieldClassified(
  value: Record<string, unknown>,
  classification: Record<string, PublicationClass>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(classification, key)) {
      throw new Error(`Unclassified ${label} field: ${key}`)
    }
  }
  for (const key of Object.keys(classification)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)
      && !['difficulty', 'estimatedTime', 'neutralSupportingInformation', 'feedback', 'sourceSectionHeading'].includes(key)) {
      throw new Error(`Classification has no corresponding ${label} field: ${key}`)
    }
  }
}
