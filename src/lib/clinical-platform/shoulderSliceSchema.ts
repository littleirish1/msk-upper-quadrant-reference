import { z } from 'zod'

export const SHOULDER_SLICE_SCHEMA_VERSION = 1 as const

const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const stableIdSchema = z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/)
const reviewStateSchema = z.enum([
  'baseline-carried-forward',
  'unreviewed',
  'review-required',
  'restricted-pending-clearance',
  'approved',
  'stale',
  'blocked',
])

export const shoulderSourceRecordSchema = z.strictObject({
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  title: z.string().min(1).nullable(),
  authors: z.array(z.string().min(1)),
  year: z.number().int().min(1800).max(2200).nullable(),
  identifiers: z.strictObject({
    doi: z.string().min(1).nullable(),
    stableIdentifier: z.string().min(1).nullable(),
  }),
  checksum: sha256Schema,
  locators: z.array(z.string().min(1)),
  locatorStatus: z.enum(['exact-repository-locator', 'withheld-pending-clearance']),
  population: z.string().min(1).nullable(),
  setting: z.string().min(1).nullable(),
  studyType: z.string().min(1).nullable(),
  topics: z.array(z.string().min(1)).min(1),
  reviewState: reviewStateSchema,
  sourceClearanceState: z.enum([
    'baseline-public-content',
    'cleared-for-private-evidence-processing',
    'review-required',
    'restricted-pending-clearance',
    'quarantined',
    'uncleared',
    'metadata-only',
  ]),
  copyrightOrLicenceStatus: z.string().min(1),
  limitations: z.array(z.string().min(1)).min(1),
  duplicateGroupId: z.string().min(1).nullable(),
  supersededBySourceId: z.string().min(1).nullable(),
  carryForwardEligible: z.boolean(),
  evidenceProcessingEligible: z.boolean(),
  publicEvidenceEligible: z.literal(false),
}).superRefine((source, context) => {
  if (source.evidenceProcessingEligible && source.sourceClearanceState !== 'cleared-for-private-evidence-processing') {
    context.addIssue({
      code: 'custom',
      path: ['evidenceProcessingEligible'],
      message: 'private evidence processing requires exact source clearance',
    })
  }
  if (source.locatorStatus === 'withheld-pending-clearance' && source.locators.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['locators'],
      message: 'uncleared private source locators must not enter tracked output',
    })
  }
  if (source.carryForwardEligible && source.sourceClearanceState !== 'baseline-public-content') {
    context.addIssue({
      code: 'custom',
      path: ['carryForwardEligible'],
      message: 'only reviewed public baseline artefacts can carry forward existing meaning',
    })
  }
})

export const shoulderSourceInventorySchema = z.strictObject({
  schemaVersion: z.literal(SHOULDER_SLICE_SCHEMA_VERSION),
  authority: z.literal('governed-shoulder-source-inventory'),
  privateAuthoringOnly: z.literal(true),
  generatedFrom: z.array(z.string().min(1)).min(1),
  records: z.array(shoulderSourceRecordSchema).min(5).max(10),
  summary: z.strictObject({
    total: z.number().int().nonnegative(),
    repositoryBaseline: z.number().int().nonnegative(),
    intakeMetadata: z.number().int().nonnegative(),
    evidenceProcessingEligible: z.number().int().nonnegative(),
    publicEvidenceEligible: z.literal(0),
    titlesUnknown: z.number().int().nonnegative(),
    locatorsWithheld: z.number().int().nonnegative(),
  }),
  governance: z.strictObject({
    clinicalApprovalCreated: z.literal(false),
    evidenceApprovalCreated: z.literal(false),
    sourceClearanceCreated: z.literal(false),
    publicationApprovalCreated: z.literal(false),
    sourceBodiesCopied: z.literal(false),
    externalVerificationPerformed: z.literal(false),
  }),
}).superRefine((inventory, context) => {
  if (inventory.summary.total !== inventory.records.length) {
    context.addIssue({ code: 'custom', path: ['summary', 'total'], message: 'summary must reconcile to records' })
  }
  const eligible = inventory.records.filter((source) => source.evidenceProcessingEligible).length
  if (inventory.summary.evidenceProcessingEligible !== eligible) {
    context.addIssue({ code: 'custom', path: ['summary', 'evidenceProcessingEligible'], message: 'eligible count mismatch' })
  }
  if (new Set(inventory.records.map((source) => source.sourceId)).size !== inventory.records.length) {
    context.addIssue({ code: 'custom', path: ['records'], message: 'source IDs must be unique' })
  }
})

export const shoulderEvidenceMapSchema = z.strictObject({
  schemaVersion: z.literal(SHOULDER_SLICE_SCHEMA_VERSION),
  authority: z.literal('private-shoulder-evidence-map'),
  privateAuthoringOnly: z.literal(true),
  sourceRevisionIds: z.array(z.string().min(1)),
  conditionIds: z.array(stableIdSchema),
  guidedCaseIds: z.array(stableIdSchema),
  clinicalQuestions: z.array(z.strictObject({
    id: stableIdSchema,
    topic: z.string().min(1),
    status: z.literal('evidence-review-required'),
  })),
  claims: z.array(z.strictObject({
    id: stableIdSchema,
    statement: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
    exactLocators: z.array(z.string().min(1)).min(1),
    reviewState: z.literal('review-required'),
  })),
  evidenceSummaries: z.array(z.unknown()),
  diagnosticTestEvidence: z.array(z.unknown()),
  conflicts: z.array(z.unknown()),
  gaps: z.array(z.strictObject({
    id: stableIdSchema,
    topic: z.string().min(1),
    reason: z.string().min(1),
    requiredReview: z.array(z.enum(['source-clearance', 'evidence', 'clinical', 'rights'])).min(1),
    blocksClaims: z.literal(true),
    blocksPublication: z.literal(true),
  })).min(1),
  reviewState: z.literal('review-required'),
  publicEligibility: z.literal(false),
}).superRefine((map, context) => {
  if (map.claims.length > 0 && map.sourceRevisionIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['claims'], message: 'claims require exact source revisions' })
  }
})

export const shoulderReviewTaskSchema = z.strictObject({
  taskId: stableIdSchema,
  domain: z.enum([
    'source-clearance', 'evidence', 'clinical', 'anatomy', 'movement',
    'rights', 'accessibility', 'publication', 'technical',
  ]),
  targetId: z.string().min(1),
  state: z.enum(['blocked', 'required', 'ready-for-human-review']),
  reason: z.string().min(1),
  requiredDecision: z.string().min(1),
  publicEligibility: z.literal(false),
})

export const shoulderAuthoringWorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(SHOULDER_SLICE_SCHEMA_VERSION),
  authority: z.literal('private-shoulder-authoring-workspace'),
  privateAuthoringOnly: z.literal(true),
  publicRoute: z.null(),
  providerCallsEnabled: z.literal(false),
  autonomousApprovalAllowed: z.literal(false),
  sections: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    recordCount: z.number().int().nonnegative(),
    queueCount: z.number().int().nonnegative(),
  })).min(1),
  reviewTasks: z.array(shoulderReviewTaskSchema),
  actions: z.array(z.enum([
    'inspect-exact-revision', 'filter-review-queue', 'draft-ephemeral-note',
    'preview-public-safe-projection', 'download-focused-review-packet',
  ])),
})

export const shoulderMcqPlanSchema = z.strictObject({
  schemaVersion: z.literal(SHOULDER_SLICE_SCHEMA_VERSION),
  authority: z.literal('governed-shoulder-mcq-plan'),
  targetCount: z.literal(10),
  records: z.array(z.strictObject({
    id: z.string().regex(/^mcq-slot\.shoulder-slice\.\d{2}$/),
    targetContentIds: z.array(z.string().min(1)).min(1),
    learningObjective: z.string().min(1),
    lifecycle: z.literal('source-insufficient'),
    authoredContent: z.null(),
    evidenceRecordIds: z.tuple([]),
    reviewState: z.literal('review-required'),
    answerRevealPolicy: z.literal('after-submission'),
    competenceClaimAllowed: z.literal(false),
    publicEligibility: z.literal(false),
    blockers: z.array(z.string().min(1)).min(1),
  })).length(10),
  authoredQuestionCount: z.literal(0),
  publicQuestionCount: z.literal(0),
  clinicalApprovalCreated: z.literal(false),
})

export type ShoulderSourceRecord = z.infer<typeof shoulderSourceRecordSchema>
