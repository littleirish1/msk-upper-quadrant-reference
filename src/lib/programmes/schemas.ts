import { z } from 'zod'

export const PROGRAMME_SCHEMA_VERSION = 1 as const

export const stableIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/, 'use a namespaced lowercase stable ID')

export const checksumSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const lifecycleStateSchema = z.enum([
  'active',
  'published',
  'draft',
  'private',
  'planned',
  'source-insufficient',
  'duplicate',
  'superseded',
  'deprecated',
  'rejected',
  'archived',
])

export const reviewStateSchema = z.enum([
  'not-required',
  'not-started',
  'required',
  'in-review',
  'approved',
  'changes-requested',
  'stale',
  'blocked',
  'not-applicable',
])

export const sourceClearanceStateSchema = z.enum([
  'approved-for-public-use',
  'cleared-for-private-processing',
  'restricted-pending-clearance',
  'review-required',
  'unknown',
  'quarantined',
  'not-applicable',
])

export const publicationStateSchema = z.enum([
  'public',
  'private',
  'blocked',
  'planned',
  'archived',
])

export const inventoryContentTypeSchema = z.enum([
  'legacy-station',
  'guided-case',
  'condition',
  'anatomy',
  'differential-red-flag',
  'special-test',
  'outcome-measure',
  'learning-record',
  'mcq',
  'evidence-hub-record',
  'evidence-source',
  'region-plan',
  'visual-asset',
  'public-route',
  'search-entry',
])

export const inventorySourceSchema = z.object({
  sourceId: z.string().min(1),
  repositoryPath: z.string().min(1).nullable(),
  checksum: checksumSchema,
  revision: z.string().min(1),
  provenanceStatus: z.enum([
    'repository-tracked',
    'legacy-accounted',
    'catalogued-private-source',
    'generated',
    'unknown',
  ]),
}).strict()

export const projectInventoryItemSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  id: stableIdSchema,
  region: z.string().min(1).nullable(),
  contentType: inventoryContentTypeSchema,
  title: z.string().min(1),
  sources: z.array(inventorySourceSchema).min(1),
  lifecycleState: lifecycleStateSchema,
  clinicalReviewState: reviewStateSchema,
  evidenceReviewState: reviewStateSchema,
  sourceClearanceState: sourceClearanceStateSchema,
  publicationState: publicationStateSchema,
  destinationRoute: z.string().startsWith('/').nullable(),
  duplicateOf: stableIdSchema.nullable(),
  supersedes: z.array(stableIdSchema),
  supersededBy: z.array(stableIdSchema),
  blockers: z.array(z.string().min(1)),
  nextAction: z.string().min(1),
}).strict().superRefine((item, context) => {
  if (item.publicationState === 'public') {
    if (item.lifecycleState !== 'published' && item.lifecycleState !== 'active') {
      context.addIssue({
        code: 'custom',
        path: ['lifecycleState'],
        message: 'public inventory items must be active or published',
      })
    }
    if (item.clinicalReviewState === 'required' || item.clinicalReviewState === 'blocked') {
      context.addIssue({
        code: 'custom',
        path: ['clinicalReviewState'],
        message: 'public inventory items cannot have a blocking clinical review state',
      })
    }
    if (item.sourceClearanceState === 'quarantined' || item.sourceClearanceState === 'restricted-pending-clearance') {
      context.addIssue({
        code: 'custom',
        path: ['sourceClearanceState'],
        message: 'public inventory items cannot use restricted or quarantined sources',
      })
    }
  }
})

export const projectInventorySchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  baselineCommit: z.string().regex(/^[0-9a-f]{40}$/),
  generatedFromTrackedFilesOnly: z.literal(true),
  items: z.array(projectInventoryItemSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    byContentType: z.record(z.string(), z.number().int().nonnegative()),
    byPublicationState: z.record(z.string(), z.number().int().nonnegative()),
    publicItems: z.number().int().nonnegative(),
    blockedItems: z.number().int().nonnegative(),
    unaccountedLegacyItems: z.number().int().nonnegative(),
  }).strict(),
}).strict()

export const dependencyRiskSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  riskId: stableIdSchema,
  packageName: z.string().min(1),
  installedVersion: z.string().min(1),
  direct: z.boolean(),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  affectedRange: z.string().min(1),
  affectedSurface: z.enum([
    'public-build-framework',
    'content-build-pipeline',
    'lint-tooling',
    'css-build-tooling',
    'transitive-build-tooling',
  ]),
  deploymentReachability: z.enum([
    'static-build-time-only',
    'framework-runtime-not-used-by-static-host',
    'public-build-framework',
    'requires-manual-analysis',
  ]),
  advisoryIds: z.array(z.string().min(1)),
  availableRemediation: z.string().min(1),
  breakingChangeRisk: z.enum(['low', 'medium', 'high']),
  treatment: z.enum([
    'separate-remediation-branch',
    'accept-temporarily-with-controls',
    'upgrade-in-current-branch',
    'investigate',
  ]),
  status: z.enum(['open', 'in-progress', 'resolved', 'accepted-temporarily']),
  rationale: z.string().min(1),
  validationRequired: z.array(z.string().min(1)).min(1),
}).strict()

export const dependencyRiskRegisterSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  observedOn: dateSchema,
  sourceCommand: z.literal('npm audit --json'),
  automatedUpgradePerformed: z.literal(false),
  historyRemediationHumanControlled: z.literal(true),
  vulnerabilities: z.object({
    info: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).strict(),
  risks: z.array(dependencyRiskSchema),
}).strict()

export const evidenceGapSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  gapId: stableIdSchema,
  contentId: stableIdSchema,
  contentRevision: z.string().min(1),
  gapTypes: z.array(z.enum([
    'missing-evidence-record',
    'missing-reference-verification',
    'missing-source-clearance',
    'missing-evidence-review',
    'missing-clinical-review',
    'missing-revision-pinned-relationship',
  ])).min(1),
  lifecycleState: z.literal('active'),
  reviewState: z.enum(['recorded', 'triaged', 'in-review', 'resolved']),
  publicEligibility: z.literal(false),
  blockers: z.array(z.string().min(1)).min(1),
  nextAction: z.string().min(1),
}).strict()

export const evidenceGapCatalogSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  gaps: z.array(evidenceGapSchema),
}).strict()

export const evidenceSurveillanceProposalSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  proposalId: stableIdSchema,
  proposalType: z.enum([
    'guideline-update',
    'bibliographic-import',
    'duplicate-review',
    'supersession-review',
    'evidence-gap-follow-up',
  ]),
  targetContentIds: z.array(stableIdSchema).min(1),
  sourceRecordIds: z.array(stableIdSchema),
  previousVersionIds: z.array(stableIdSchema),
  proposedVersionIds: z.array(stableIdSchema),
  lifecycleState: z.literal('draft'),
  reviewState: z.literal('required'),
  publicEligibility: z.literal(false),
  networkLookupCompleted: z.literal(false),
  autonomousChangeAllowed: z.literal(false),
  unresolvedQuestions: z.array(z.string().min(1)).min(1),
}).strict()

export const evidenceSurveillanceCatalogSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  adapters: z.array(z.object({
    adapterId: stableIdSchema,
    mode: z.literal('offline-fixture'),
    enabled: z.literal(false),
    networkRequired: z.boolean(),
  }).strict()),
  proposals: z.array(evidenceSurveillanceProposalSchema),
}).strict()

export const branchNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['presentation', 'information-request', 'hypothesis', 'finding', 'decision', 'feedback', 'caution', 'outcome']),
  prompt: z.string().min(1),
  revealPolicy: z.enum(['initial', 'learner-action', 'diagnosis-reveal', 'post-reveal', 'internal-only']),
  diagnosisBearing: z.boolean(),
  choices: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    nextNodeId: z.string().regex(/^[a-z0-9-]+$/),
    feedbackId: z.string().regex(/^[a-z0-9-]+$/).nullable(),
  }).strict()),
}).strict()

export const branchingCaseModelSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  id: stableIdSchema,
  title: z.string().min(1),
  status: z.enum(['private', 'draft', 'published']),
  publicEligibility: z.boolean(),
  reviewState: reviewStateSchema,
  startNodeId: z.string().regex(/^[a-z0-9-]+$/),
  terminalNodeIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  allowedCycleEdges: z.array(z.object({
    fromNodeId: z.string().regex(/^[a-z0-9-]+$/),
    toNodeId: z.string().regex(/^[a-z0-9-]+$/),
    rationale: z.string().min(1),
  }).strict()),
  nodes: z.array(branchNodeSchema).min(1),
  sourceContentIds: z.array(stableIdSchema),
  aiFreeTextEnabled: z.literal(false),
  networkRequired: z.literal(false),
}).strict().superRefine((model, context) => {
  if (model.publicEligibility && (model.status !== 'published' || model.reviewState !== 'approved')) {
    context.addIssue({
      code: 'custom',
      path: ['publicEligibility'],
      message: 'public branching models require published status and approval',
    })
  }
})

export const mcqOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string().min(1),
  explanation: z.string().min(1),
  correct: z.boolean(),
}).strict()

export const governedMcqSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  id: stableIdSchema,
  title: z.string().min(1),
  region: z.string().min(1),
  conditionIds: z.array(stableIdSchema),
  learningObjectives: z.array(z.string().min(1)).min(1),
  prompt: z.string().min(1),
  options: z.array(mcqOptionSchema).min(3),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced', 'not-rated']),
  evidenceRecordIds: z.array(stableIdSchema),
  referenceIds: z.array(stableIdSchema),
  lifecycleState: z.enum(['draft', 'published', 'archived']),
  clinicalReviewState: reviewStateSchema,
  evidenceReviewState: reviewStateSchema,
  sourceClearanceState: sourceClearanceStateSchema,
  publicEligibility: z.boolean(),
  answerRevealPolicy: z.literal('after-submission'),
  competenceClaimAllowed: z.literal(false),
}).strict().superRefine((question, context) => {
  const correctCount = question.options.filter((option) => option.correct).length
  if (correctCount !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'single-best-answer questions require exactly one correct option',
    })
  }
  if (question.publicEligibility) {
    if (question.lifecycleState !== 'published') {
      context.addIssue({ code: 'custom', path: ['lifecycleState'], message: 'public MCQs must be published' })
    }
    for (const [field, value] of [
      ['clinicalReviewState', question.clinicalReviewState],
      ['evidenceReviewState', question.evidenceReviewState],
    ] as const) {
      if (value !== 'approved') {
        context.addIssue({ code: 'custom', path: [field], message: 'public MCQs require exact-revision approval' })
      }
    }
    if (question.sourceClearanceState !== 'approved-for-public-use') {
      context.addIssue({ code: 'custom', path: ['sourceClearanceState'], message: 'public MCQs require source clearance' })
    }
  }
})

export const mcqPlanSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  targetCount: z.literal(20),
  scopeDecision: z.literal('twenty-review-required-authoring-slots'),
  publicEligibility: z.literal(false),
  slots: z.array(z.object({
    id: stableIdSchema,
    region: z.string().min(1),
    targetContentIds: z.array(stableIdSchema),
    learningObjective: z.string().min(1),
    lifecycleState: z.literal('planned'),
    clinicalReviewState: z.literal('required'),
    evidenceReviewState: z.literal('required'),
    sourceClearanceState: z.literal('review-required'),
    blockers: z.array(z.string().min(1)).min(1),
  }).strict()).length(20),
}).strict()

export const curriculumDomainSchema = z.enum([
  'functional-anatomy',
  'landmarks-palpation',
  'muscle-roles',
  'presentation',
  'subjective-assessment',
  'objective-assessment',
  'neurological-screening',
  'special-tests',
  'differential-diagnoses',
  'red-flags-escalation',
  'imaging',
  'management',
  'prognosis-reassessment',
  'patient-communication',
  'references',
  'evidence-limitations',
])

export const upperQuadrantProductionPolicySchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  canonicalTaxonomySource: z.literal('src/data/taxonomy.ts'),
  requiredDomains: z.array(curriculumDomainSchema).min(1),
  publicationRule: z.literal('preserve-baseline-and-fail-closed-for-new-clinical-content'),
  gapHandling: z.literal('generate-review-required-gaps-without-inventing-content'),
  requiredChecks: z.array(z.string().min(1)).min(1),
}).strict()

export const legacyCaseBatchCatalogSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  sourceId: z.literal('legacy-html-case-bank-v1'),
  batchSizePolicy: z.object({
    minimum: z.literal(3),
    maximum: z.literal(5),
  }).strict(),
  batches: z.array(z.object({
    batchId: stableIdSchema,
    status: z.literal('planned-private-review'),
    stationIds: z.array(z.string().regex(/^s\d+$/)).min(3).max(5),
    records: z.array(z.object({
      stationId: z.string().regex(/^s\d+$/),
      proposedRegion: z.string().min(1).nullable(),
      classification: z.enum([
        'governed-draft',
        'duplicate-merge-candidate',
        'source-insufficient',
        'awaiting-clinical-review',
        'awaiting-evidence-review',
        'awaiting-source-clearance',
        'rejected',
        'archived',
      ]),
      sourceExtractionStatus: z.literal('repository-extracted-not-reviewed'),
      anonymisationStatus: z.literal('required'),
      schemaMappingStatus: z.literal('not-started'),
      publicEligibility: z.literal(false),
      blockers: z.array(z.string().min(1)).min(1),
    }).strict()).min(3).max(5),
  }).strict()),
  heldUnbatchedStationIds: z.array(z.string().regex(/^s\d+$/)),
}).strict()

export const visualAssetRecordSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  id: stableIdSchema,
  title: z.string().min(1),
  assetType: z.enum(['image', 'diagram', 'video', 'audio', 'document', 'model-3d']),
  repositoryPath: z.string().min(1).nullable(),
  checksum: checksumSchema.nullable(),
  source: z.string().min(1),
  ownershipOrLicence: z.enum(['unknown', 'review-required', 'approved', 'restricted']),
  permittedUse: z.enum(['none', 'private-review', 'public']),
  altText: z.string(),
  clinicalReviewState: reviewStateSchema,
  accessibilityReviewState: reviewStateSchema,
  publicationState: publicationStateSchema,
  blockers: z.array(z.string().min(1)),
}).strict().superRefine((asset, context) => {
  if (asset.publicationState === 'public') {
    if (asset.ownershipOrLicence !== 'approved' || asset.permittedUse !== 'public') {
      context.addIssue({ code: 'custom', path: ['publicationState'], message: 'public assets require approved rights' })
    }
    if (asset.accessibilityReviewState !== 'approved') {
      context.addIssue({ code: 'custom', path: ['accessibilityReviewState'], message: 'public assets require accessibility approval' })
    }
  }
})

export const visualAssetRegistrySchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  assets: z.array(visualAssetRecordSchema),
}).strict()

export const exactRevisionReviewSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  reviewId: stableIdSchema,
  targetId: stableIdSchema,
  targetRevision: z.string().min(1),
  targetChecksum: checksumSchema,
  domain: z.enum([
    'anatomy',
    'examination',
    'pathology',
    'differential',
    'red-flags',
    'investigations',
    'management',
    'referrals',
    'prognosis',
    'case-reasoning',
    'mcq',
    'evidence-summary',
    'visual-asset',
  ]),
  reviewerRole: z.string().min(1),
  reviewerId: z.string().min(1),
  reviewDate: dateSchema.nullable(),
  decision: z.enum(['pending', 'approve', 'approve-with-edits', 'reject', 'changes-requested']),
  limitations: z.array(z.string().min(1)),
  nextReviewDate: dateSchema.nullable(),
  stale: z.boolean(),
}).strict()

export const betaFeedbackSchema = z.object({
  schemaVersion: z.literal(PROGRAMME_SCHEMA_VERSION),
  feedbackId: stableIdSchema,
  participantGroup: z.enum([
    'physiotherapy-student',
    'band-5-clinician',
    'experienced-msk-clinician',
    'clinical-educator',
  ]),
  sessionId: z.string().min(1),
  consentRecorded: z.boolean(),
  containsHealthData: z.literal(false),
  issueType: z.enum([
    'content-clarity',
    'clinical-concern',
    'navigation',
    'accessibility',
    'performance',
    'diagnosis-disclosure',
    'privacy',
    'other',
  ]),
  severity: z.enum(['observation', 'low', 'medium', 'high', 'blocker']),
  summary: z.string().min(1),
  route: z.string().startsWith('/').nullable(),
  status: z.enum(['new', 'triaged', 'in-progress', 'resolved', 'wont-fix']),
}).strict()

export type ProjectInventoryItem = z.infer<typeof projectInventoryItemSchema>
export type ProjectInventory = z.infer<typeof projectInventorySchema>
export type DependencyRiskRegister = z.infer<typeof dependencyRiskRegisterSchema>
export type EvidenceGap = z.infer<typeof evidenceGapSchema>
export type BranchingCaseModel = z.infer<typeof branchingCaseModelSchema>
export type GovernedMcq = z.infer<typeof governedMcqSchema>
export type VisualAssetRecord = z.infer<typeof visualAssetRecordSchema>
export type ExactRevisionReview = z.infer<typeof exactRevisionReviewSchema>
