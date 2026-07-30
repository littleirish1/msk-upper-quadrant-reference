import { z } from 'zod'

export const GUIDED_CASE_SCHEMA_VERSION = 2 as const
export const zodToJsonSchema = z.toJSONSchema

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const stableIdSchema = z.string().regex(/^case\.[a-z0-9-]+\.[a-z0-9-]+$/)
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const regionSchema = z.enum([
  'cervical',
  'thoracic',
  'shoulder',
  'elbow',
  'wrist-hand',
  'lumbar',
  'pelvis-sij',
  'hip',
  'knee',
  'ankle-foot',
])

export const publicationClassSchema = z.enum([
  'public-immediate',
  'public-after-reveal',
  'internal-only',
  'human-review-required',
])

export const lifecycleStateSchema = z.enum(['published', 'draft', 'archived'])
export const authoringStatusSchema = z.enum(['draft', 'human-edited', 'approved'])
export const clinicalReviewStatusSchema = z.enum([
  'baseline-reviewed',
  'clinician-review-required',
  'changes-requested',
])
export const evidenceReviewStatusSchema = z.enum([
  'baseline-preserved',
  'evidence-review-required',
  'changes-requested',
])
export const sourceClearanceStatusSchema = z.enum([
  'baseline-public-content',
  'source-clearance-required',
  'restricted',
])
export const publicationDecisionStatusSchema = z.enum([
  'baseline-carried-forward',
  'blocked',
  'approved',
])

export const stageTypeSchema = z.enum([
  'initial-hypothesis',
  'subjective-assessment',
  'objective-assessment',
  'differential-diagnosis',
  'red-flag-escalation',
  'investigation-reasoning',
  'management-reasoning',
  'safety-netting',
  'referral-threshold',
  'reassessment-progression',
  'patient-communication',
  'reflection',
])

export const revealStateSchema = z.enum([
  'public-immediate',
  'public-after-reveal',
  'internal-only',
])

export const stagedDisclosureItemSchema = z.strictObject({
  id: slugSchema,
  order: z.number().int().positive(),
  content: z.string().min(1),
  revealState: revealStateSchema,
})

export const reasoningStageSchema = z.strictObject({
  id: slugSchema,
  type: stageTypeSchema,
  order: z.number().int().positive(),
  learnerQuestion: z.string().min(1),
  neutralSupportingInformation: z.string().min(1).optional(),
  expectedReasoningThemes: z.array(z.string().min(1)).default([]),
  modelReasoningChecklist: z.array(z.string().min(1)).default([]),
  commonPitfalls: z.array(z.string().min(1)).default([]),
  feedback: z.string().min(1).optional(),
  revealState: revealStateSchema,
  sourceSectionHeading: z.string().min(1).optional(),
  humanReviewRequired: z.boolean(),
})

export const guidedCaseRecordSchema = z.strictObject({
  schemaVersion: z.literal(GUIDED_CASE_SCHEMA_VERSION),
  caseId: stableIdSchema,
  learnerCaseNumber: z.string().min(1),
  neutralTitle: z.string().min(1),
  region: regionSchema,
  publicSlug: slugSchema,
  contentRevision: z.number().int().positive(),
  contentHash: sha256Schema,
  lifecycleState: lifecycleStateSchema,
  publicationEligibility: z.boolean(),
  difficulty: z.string().min(1).optional(),
  estimatedTime: z.string().min(1).optional(),
  privateDiagnosticIdentity: z.strictObject({
    internalTitle: z.string().min(1),
    likelyDiagnosis: z.string().min(1),
    associatedConditionId: z.string().min(1),
    evidenceHubConditionId: z.string().min(1).nullable(),
    privateLearningFocus: z.array(z.string().min(1)).default([]),
    internalSourceStationId: z.string().min(1).nullable(),
  }),
  learnerPresentation: z.strictObject({
    initialPresentation: z.string().min(1),
    demographics: z.string().min(1).optional(),
    symptomHistory: z.string().min(1).optional(),
    functionalImpact: z.string().min(1).optional(),
    aggravatingFactors: z.array(z.string().min(1)).default([]),
    easingFactors: z.array(z.string().min(1)).default([]),
    relevantMedicalHistory: z.string().min(1).optional(),
    medicationContext: z.string().min(1).optional(),
    psychosocialOrOccupationalContext: z.string().min(1).optional(),
    stagedDisclosure: z.array(stagedDisclosureItemSchema).default([]),
  }),
  reasoningStages: z.array(reasoningStageSchema).min(1),
  governance: z.strictObject({
    authoringStatus: authoringStatusSchema,
    clinicalReviewStatus: clinicalReviewStatusSchema,
    evidenceReviewStatus: evidenceReviewStatusSchema,
    sourceClearanceStatus: sourceClearanceStatusSchema,
    reviewerRole: z.string().min(1).nullable(),
    reviewDate: dateSchema.nullable(),
    nextReviewDate: dateSchema.nullable(),
    unresolvedIssues: z.array(z.string().min(1)).default([]),
    knownLimitations: z.array(z.string().min(1)).default([]),
    publicationDecision: z.strictObject({
      status: publicationDecisionStatusSchema,
      approvedRevision: z.number().int().positive().nullable(),
      approvedContentHash: sha256Schema.nullable(),
      rationale: z.string().min(1),
    }),
  }),
  provenance: z.strictObject({
    sourceRecordIds: z.array(z.string().min(1)).default([]),
    legacySourceId: z.string().min(1).nullable(),
    sourceType: z.string().min(1),
    extractionDate: dateSchema.nullable(),
    sourceRevisionOrHash: sha256Schema.nullable(),
    citationReferenceIds: z.array(z.string().min(1)).default([]),
    transformationHistory: z.array(z.strictObject({
      action: z.string().min(1),
      detail: z.string().min(1),
      reviewRequired: z.boolean(),
    })).default([]),
    aiAssisted: z.boolean(),
    humanEdited: z.boolean(),
  }),
  evidenceHub: z.strictObject({
    conditionRecordId: z.string().min(1).nullable(),
    evidenceRecordIds: z.array(z.string().min(1)).default([]),
    relationshipIds: z.array(z.string().min(1)).default([]),
    reviewDecisionId: z.string().min(1).nullable(),
    pinnedCaseRevision: z.number().int().positive(),
    pinnedCaseHash: sha256Schema,
    unresolvedEvidenceGaps: z.array(z.string().min(1)).default([]),
  }),
}).superRefine((record, context) => {
  const stageIds = new Set<string>()
  const stageOrders = new Set<number>()
  for (const [index, stage] of record.reasoningStages.entries()) {
    if (stageIds.has(stage.id)) {
      context.addIssue({ code: 'custom', path: ['reasoningStages', index, 'id'], message: 'duplicate reasoning stage ID' })
    }
    if (stageOrders.has(stage.order)) {
      context.addIssue({ code: 'custom', path: ['reasoningStages', index, 'order'], message: 'duplicate reasoning stage order' })
    }
    stageIds.add(stage.id)
    stageOrders.add(stage.order)
  }

  if (record.evidenceHub.pinnedCaseRevision !== record.contentRevision) {
    context.addIssue({ code: 'custom', path: ['evidenceHub', 'pinnedCaseRevision'], message: 'Evidence Hub pin must match current case revision' })
  }
  if (record.evidenceHub.pinnedCaseHash !== record.contentHash) {
    context.addIssue({ code: 'custom', path: ['evidenceHub', 'pinnedCaseHash'], message: 'Evidence Hub pin must match current case hash' })
  }
  if (record.governance.nextReviewDate && record.governance.reviewDate
    && record.governance.nextReviewDate < record.governance.reviewDate) {
    context.addIssue({ code: 'custom', path: ['governance', 'nextReviewDate'], message: 'next review date cannot precede review date' })
  }

  if (record.publicationEligibility) {
    const decision = record.governance.publicationDecision
    if (record.learnerPresentation.stagedDisclosure.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['learnerPresentation', 'stagedDisclosure'],
        message: 'stagedDisclosure is schema-reserved and authoring-only until governed staged-delivery projections are implemented',
      })
    }
    if (record.lifecycleState !== 'published') {
      context.addIssue({ code: 'custom', path: ['publicationEligibility'], message: 'public eligibility requires published lifecycle' })
    }
    if (!['baseline-reviewed'].includes(record.governance.clinicalReviewStatus)) {
      context.addIssue({ code: 'custom', path: ['governance', 'clinicalReviewStatus'], message: 'public eligibility requires completed clinical review' })
    }
    if (record.governance.evidenceReviewStatus !== 'baseline-preserved') {
      context.addIssue({ code: 'custom', path: ['governance', 'evidenceReviewStatus'], message: 'public eligibility requires completed evidence review state' })
    }
    if (record.governance.sourceClearanceStatus !== 'baseline-public-content') {
      context.addIssue({ code: 'custom', path: ['governance', 'sourceClearanceStatus'], message: 'public eligibility requires public source clearance state' })
    }
    if (decision.status !== 'baseline-carried-forward' && decision.status !== 'approved') {
      context.addIssue({ code: 'custom', path: ['governance', 'publicationDecision'], message: 'public eligibility requires a current publication decision' })
    }
    if (decision.approvedRevision !== record.contentRevision || decision.approvedContentHash !== record.contentHash) {
      context.addIssue({ code: 'custom', path: ['governance', 'publicationDecision'], message: 'publication decision must pin the current revision and hash' })
    }
    if (record.governance.unresolvedIssues.length > 0) {
      context.addIssue({ code: 'custom', path: ['governance', 'unresolvedIssues'], message: 'public eligibility cannot carry unresolved blocking issues' })
    }
  }
})

export type GuidedCaseRecord = z.infer<typeof guidedCaseRecordSchema>
export type ReasoningStage = z.infer<typeof reasoningStageSchema>
export type PublicationClass = z.infer<typeof publicationClassSchema>
