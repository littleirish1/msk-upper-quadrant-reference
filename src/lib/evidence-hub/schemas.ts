import { z } from 'zod'

export const zodToJsonSchema = z.toJSONSchema

export const HUB_SCHEMA_VERSION = 1 as const

export const hubEntityTypeSchema = z.enum([
  'evidence',
  'claim',
  'condition',
  'anatomy',
  'exercise',
  'clinical-test',
  'outcome-measure',
  'guided-case',
  'reference',
  'media-asset',
])

export const hubIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/, 'use a namespaced lowercase hub ID')

export const lifecycleStatusSchema = z.enum(['draft', 'active', 'deprecated', 'archived'])
export const hubReviewStatusSchema = z.enum([
  'unreviewed',
  'structural-review',
  'evidence-review',
  'clinician-review',
  'approved',
  'changes-requested',
])

export const sourceEligibilityStatusSchema = z.enum([
  'cleared-for-private-evidence-processing',
  'restricted-pending-clearance',
  'quarantined',
  'review-required',
  'uncleared',
  'metadata-only',
])

export const checksumSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const slugSchema = z.string().regex(/^[a-z0-9-]+$/)

export const provenanceLinkSchema = z.object({
  sourceId: z.string().min(1),
  checksum: checksumSchema,
  locator: z.string().min(1).nullable().default(null),
  locationCategory: z.enum([
    'repository-reviewed-source',
    'approved-local-inbox',
    'approved-m365',
    'external-reference',
  ]),
  eligibilityStatus: sourceEligibilityStatusSchema,
  clearanceScope: z.array(z.enum([
    'citation-extraction',
    'private-proposal-support',
    'private-topic-mapping',
    'public-evidence-use',
  ])).default([]),
}).strict()

const baseShape = {
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  id: hubIdSchema,
  entityType: hubEntityTypeSchema,
  revision: z.number().int().positive(),
  lifecycleStatus: lifecycleStatusSchema,
  reviewStatus: hubReviewStatusSchema,
  publicEligibility: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  provenance: z.array(provenanceLinkSchema),
  supersedesRevision: z.number().int().positive().nullable().default(null),
  changeSummary: z.string().min(1),
}

function addBasePublicationIssues(
  data: { lifecycleStatus: string; reviewStatus: string; publicEligibility: boolean },
  context: z.RefinementCtx,
) {
  if (!data.publicEligibility) return
  if (data.lifecycleStatus !== 'active') {
    context.addIssue({
      code: 'custom',
      path: ['lifecycleStatus'],
      message: 'public eligibility requires active lifecycle status',
    })
  }
  if (data.reviewStatus !== 'approved') {
    context.addIssue({
      code: 'custom',
      path: ['reviewStatus'],
      message: 'public eligibility requires approved review status',
    })
  }
}

export const evidenceTypeSchema = z.enum([
  'clinical-guideline',
  'systematic-review',
  'randomised-trial',
  'diagnostic-study',
  'prognostic-study',
  'observational-study',
  'consensus',
  'textbook',
  'teaching-source',
  'patient-information',
  'other',
])

export const evidenceSchema = z.object({
  ...baseShape,
  entityType: z.literal('evidence'),
  title: z.string().min(1),
  evidenceType: evidenceTypeSchema,
  referenceIds: z.array(hubIdSchema),
  sourceLocators: z.array(provenanceLinkSchema).min(1),
  verificationStatus: z.enum([
    'extracted-unverified',
    'bibliographic-verified',
    'full-text-reviewed',
    'unable-to-verify',
  ]),
  appraisalStatus: z.enum([
    'not-appraised',
    'appraisal-in-progress',
    'appraised',
    'appraisal-outdated',
  ]),
  applicability: z.string(),
  limitations: z.array(z.string().min(1)),
  studyDesign: z.string().min(1).optional(),
  population: z.string().min(1).optional(),
  setting: z.string().min(1).optional(),
  intervention: z.string().min(1).optional(),
  comparator: z.string().min(1).optional(),
  outcomes: z.array(z.string().min(1)).default([]),
  effectSummary: z.string().min(1).optional(),
  qualityAssessment: z.object({
    framework: z.string().min(1),
    result: z.string().min(1),
    notes: z.array(z.string().min(1)).default([]),
  }).strict().optional(),
  supersededByEvidenceIds: z.array(hubIdSchema).default([]),
  notes: z.string().optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  if (!data.publicEligibility) return
  if (data.referenceIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['referenceIds'], message: 'public evidence requires a reference' })
  }
  if (data.verificationStatus !== 'full-text-reviewed') {
    context.addIssue({ code: 'custom', path: ['verificationStatus'], message: 'public evidence requires full-text review' })
  }
  if (data.appraisalStatus !== 'appraised') {
    context.addIssue({ code: 'custom', path: ['appraisalStatus'], message: 'public evidence requires completed appraisal' })
  }
  if (data.sourceLocators.some((item) =>
    item.eligibilityStatus !== 'cleared-for-private-evidence-processing'
    || !item.clearanceScope.includes('public-evidence-use')
  )) {
    context.addIssue({
      code: 'custom',
      path: ['sourceLocators'],
      message: 'public evidence requires explicit public-evidence-use clearance for every source locator',
    })
  }
})

export const claimSupportSchema = z.object({
  evidenceId: hubIdSchema,
  evidenceRevision: z.number().int().positive(),
  role: z.enum(['supports', 'contradicts', 'qualifies', 'contextualises']),
  locator: z.string().min(1),
  applicability: z.string().min(1),
}).strict()

export const claimTypeSchema = z.enum([
  'definition',
  'epidemiology',
  'presentation',
  'assessment',
  'diagnostic-accuracy',
  'prognosis',
  'safety',
  'management',
  'communication',
  'anatomy',
  'measurement-property',
  'educational',
])

export const claimSchema = z.object({
  ...baseShape,
  entityType: z.literal('claim'),
  statement: z.string().min(1),
  claimType: claimTypeSchema,
  scope: z.object({
    population: z.string().optional(),
    setting: z.string().optional(),
    regions: z.array(z.string().min(1)).default([]),
    qualifiers: z.array(z.string().min(1)).default([]),
  }).strict(),
  support: z.array(claimSupportSchema),
  strength: z.enum(['pending', 'limited', 'moderate', 'strong', 'consensus-only', 'not-rated']),
  limitations: z.array(z.string().min(1)),
  clinicalReviewRequired: z.boolean(),
  diagnosisBearing: z.boolean().default(false),
  parentClaimId: hubIdSchema.optional(),
  relatedClaimIds: z.array(hubIdSchema).default([]),
  reviewDue: dateSchema.optional(),
  wordingNotes: z.string().optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  if (!data.publicEligibility) return
  if (data.support.length === 0) {
    context.addIssue({ code: 'custom', path: ['support'], message: 'public claims require evidence support' })
  }
  if (data.strength === 'pending') {
    context.addIssue({ code: 'custom', path: ['strength'], message: 'public claim strength cannot be pending' })
  }
})

const relatedContentShape = {
  title: z.string().min(1),
  slug: slugSchema,
  claimIds: z.array(hubIdSchema),
  relatedContentIds: z.array(hubIdSchema).default([]),
  mediaAssetIds: z.array(hubIdSchema).default([]),
}

export const conditionSchema = z.object({
  ...baseShape,
  ...relatedContentShape,
  entityType: z.literal('condition'),
  region: z.string().min(1),
  sectionClaims: z.record(z.string().min(1), z.array(hubIdSchema)),
  reviewSummary: z.object({
    reviewedRevision: z.number().int().positive().nullable(),
    reviewDue: dateSchema.nullable(),
  }).strict(),
  codes: z.record(z.string(), z.string().min(1)).default({}),
  synonyms: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  guidedCaseIds: z.array(hubIdSchema).default([]),
  anatomyIds: z.array(hubIdSchema).default([]),
  exerciseIds: z.array(hubIdSchema).default([]),
  clinicalTestIds: z.array(hubIdSchema).default([]),
  outcomeMeasureIds: z.array(hubIdSchema).default([]),
}).strict().superRefine(addBasePublicationIssues)

export const anatomyCategorySchemaV1 = z.enum([
  'bone', 'joint', 'muscle', 'tendon', 'ligament', 'peripheral-nerve',
  'nerve-root', 'dermatome', 'myotome', 'spinal-tract', 'cranial-nerve',
  'brain-region', 'blood-vessel',
])

export const anatomySchema = z.object({
  ...baseShape,
  ...relatedContentShape,
  entityType: z.literal('anatomy'),
  category: anatomyCategorySchemaV1,
  regions: z.array(z.string().min(1)),
  anatomyRelationshipIds: z.array(hubIdSchema).default([]),
  originClaimIds: z.array(hubIdSchema).default([]),
  insertionClaimIds: z.array(hubIdSchema).default([]),
  innervationClaimIds: z.array(hubIdSchema).default([]),
  functionClaimIds: z.array(hubIdSchema).default([]),
  courseClaimIds: z.array(hubIdSchema).default([]),
  examinationClaimIds: z.array(hubIdSchema).default([]),
}).strict().superRefine(addBasePublicationIssues)

export const exerciseSchema = z.object({
  ...baseShape,
  ...relatedContentShape,
  entityType: z.literal('exercise'),
  regions: z.array(z.string().min(1)),
  purposeClaimIds: z.array(hubIdSchema),
  instructionClaimIds: z.array(hubIdSchema),
  safetyClaimIds: z.array(hubIdSchema),
  dosageStatus: z.enum(['individualise', 'protocol-linked', 'not-specified']),
  dosageClaimIds: z.array(hubIdSchema).default([]),
  progressionClaimIds: z.array(hubIdSchema).default([]),
  regressionClaimIds: z.array(hubIdSchema).default([]),
  contraindicationClaimIds: z.array(hubIdSchema).default([]),
  equipment: z.array(z.string().min(1)).default([]),
  position: z.string().optional(),
}).strict().superRefine(addBasePublicationIssues)

export const clinicalTestSchema = z.object({
  ...baseShape,
  ...relatedContentShape,
  entityType: z.literal('clinical-test'),
  regions: z.array(z.string().min(1)),
  testKind: z.enum(['single-test', 'cluster', 'examination-domain']),
  purposeClaimIds: z.array(hubIdSchema),
  techniqueClaimIds: z.array(hubIdSchema),
  interpretationClaimIds: z.array(hubIdSchema),
  limitationClaimIds: z.array(hubIdSchema),
  cautionClaimIds: z.array(hubIdSchema).default([]),
  diagnosticAccuracyClaimIds: z.array(hubIdSchema).default([]),
  clusterMemberIds: z.array(hubIdSchema).default([]),
}).strict().superRefine(addBasePublicationIssues)

export const outcomeMeasureSchema = z.object({
  ...baseShape,
  ...relatedContentShape,
  entityType: z.literal('outcome-measure'),
  abbreviation: z.string().min(1).optional(),
  licenceStatus: z.enum(['unknown', 'review-required', 'approved-for-described-use', 'restricted']),
  constructClaimIds: z.array(hubIdSchema),
  populationClaimIds: z.array(hubIdSchema),
  scoringClaimIds: z.array(hubIdSchema),
  interpretationClaimIds: z.array(hubIdSchema).default([]),
  measurementPropertyClaimIds: z.array(hubIdSchema).default([]),
  mcidClaimIds: z.array(hubIdSchema).default([]),
  mdcClaimIds: z.array(hubIdSchema).default([]),
  formMediaAssetId: hubIdSchema.optional(),
  externalAccessUrl: z.string().url().optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  if (data.publicEligibility && data.licenceStatus !== 'approved-for-described-use') {
    context.addIssue({ code: 'custom', path: ['licenceStatus'], message: 'public outcome measures require approved use rights' })
  }
})

export const guidedCaseStageSchema = z.object({
  id: slugSchema,
  type: z.enum([
    'presentation', 'differential', 'justification', 'history-reveal',
    'red-flags', 'examination', 'findings-reveal', 'investigation',
    'management', 'patient-explanation', 'expert-comparison', 'reflection',
  ]),
  prompt: z.string().min(1),
  claimIds: z.array(hubIdSchema),
  revealPolicy: z.enum(['initial', 'learner-action', 'diagnosis-reveal', 'post-reveal']),
}).strict()

export const guidedCaseSchema = z.object({
  ...baseShape,
  entityType: z.literal('guided-case'),
  internalTitle: z.string().min(1),
  neutralTitle: z.string().min(1),
  neutralPublicSlug: slugSchema,
  region: z.string().min(1),
  linkedConditionId: hubIdSchema,
  stages: z.array(guidedCaseStageSchema).min(2),
  diagnosisRevealStageId: slugSchema,
  anatomyIds: z.array(hubIdSchema).default([]),
  exerciseIds: z.array(hubIdSchema).default([]),
  clinicalTestIds: z.array(hubIdSchema).default([]),
  outcomeMeasureIds: z.array(hubIdSchema).default([]),
  mediaAssetIds: z.array(hubIdSchema).default([]),
  learningModeIds: z.array(hubIdSchema).default([]),
  estimatedTime: z.string().optional(),
  difficulty: z.string().optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  const revealIndex = data.stages.findIndex((stage) => stage.id === data.diagnosisRevealStageId)
  if (revealIndex < 0) {
    context.addIssue({ code: 'custom', path: ['diagnosisRevealStageId'], message: 'diagnosis reveal stage does not exist' })
  } else if (data.stages[revealIndex].revealPolicy !== 'diagnosis-reveal') {
    context.addIssue({ code: 'custom', path: ['diagnosisRevealStageId'], message: 'diagnosis stage must use diagnosis-reveal policy' })
  }
  const ids = data.stages.map((stage) => stage.id)
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: 'custom', path: ['stages'], message: 'guided case stage IDs must be unique' })
  }
})

export const referenceSchema = z.object({
  ...baseShape,
  entityType: z.literal('reference'),
  citationAsPresented: z.string().min(1),
  referenceType: z.string().min(1),
  verificationStatus: z.enum(['candidate', 'identifier-verified', 'bibliographic-verified', 'unable-to-verify']),
  sourceProvenance: z.array(provenanceLinkSchema).min(1),
  authors: z.array(z.string().min(1)).default([]),
  year: z.string().regex(/^\d{4}[a-z]?$/).optional(),
  title: z.string().min(1).optional(),
  journalOrPublisher: z.string().min(1).optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().url().optional(),
  isbn: z.string().optional(),
  duplicateGroupId: z.string().optional(),
  canonicalReferenceId: hubIdSchema.optional(),
  verificationEvidence: z.string().optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  if (data.publicEligibility && data.verificationStatus !== 'bibliographic-verified') {
    context.addIssue({ code: 'custom', path: ['verificationStatus'], message: 'public references require bibliographic verification' })
  }
  if (data.publicEligibility && !data.verificationEvidence) {
    context.addIssue({ code: 'custom', path: ['verificationEvidence'], message: 'public references require verification evidence' })
  }
})

export const mediaAssetSchema = z.object({
  ...baseShape,
  entityType: z.literal('media-asset'),
  title: z.string().min(1),
  assetType: z.enum(['image', 'diagram', 'audio', 'video', 'document', 'imaging', 'model-3d']),
  checksum: checksumSchema,
  storageClass: z.enum(['private-cache', 'tracked-metadata', 'approved-public-asset', 'external-link']),
  sourceProvenance: z.array(provenanceLinkSchema).min(1),
  rightsStatus: z.enum(['unknown', 'review-required', 'approved', 'restricted']),
  attribution: z.string(),
  accessibilityStatus: z.enum(['not-reviewed', 'changes-required', 'approved']),
  publicPath: z.string().min(1).optional(),
  creator: z.string().optional(),
  licence: z.string().optional(),
  licenceUrl: z.string().url().optional(),
  modificationHistory: z.array(z.string().min(1)).default([]),
  altText: z.string().optional(),
  transcript: z.string().optional(),
  caption: z.string().optional(),
  mimeType: z.string().optional(),
  relatedContentIds: z.array(hubIdSchema).default([]),
  clinicalAnnotationClaimIds: z.array(hubIdSchema).default([]),
  derivativeOfMediaAssetId: hubIdSchema.optional(),
}).strict().superRefine((data, context) => {
  addBasePublicationIssues(data, context)
  if (!data.publicEligibility) return
  if (data.rightsStatus !== 'approved') {
    context.addIssue({ code: 'custom', path: ['rightsStatus'], message: 'public media requires approved rights' })
  }
  if (data.accessibilityStatus !== 'approved') {
    context.addIssue({ code: 'custom', path: ['accessibilityStatus'], message: 'public media requires accessibility approval' })
  }
  if (data.storageClass !== 'approved-public-asset' && data.storageClass !== 'external-link') {
    context.addIssue({ code: 'custom', path: ['storageClass'], message: 'public media requires an approved storage class' })
  }
  if (!data.publicPath && data.storageClass === 'approved-public-asset') {
    context.addIssue({ code: 'custom', path: ['publicPath'], message: 'approved public assets require a public path' })
  }
})

export const evidenceHubRecordSchema = z.discriminatedUnion('entityType', [
  evidenceSchema,
  claimSchema,
  conditionSchema,
  anatomySchema,
  exerciseSchema,
  clinicalTestSchema,
  outcomeMeasureSchema,
  guidedCaseSchema,
  referenceSchema,
  mediaAssetSchema,
])

export const relationshipRoleSchema = z.enum([
  'supports', 'contradicts', 'qualifies', 'contextualises', 'uses',
  'references', 'illustrates', 'measures', 'assesses', 'applies-to',
  'related-to', 'supersedes',
])

export const hubRelationshipSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  id: hubIdSchema,
  fromId: hubIdSchema,
  toId: hubIdSchema,
  role: relationshipRoleSchema,
  fromRevision: z.number().int().positive(),
  toRevision: z.number().int().positive(),
  section: z.string().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  revealStageId: slugSchema.optional(),
  applicability: z.string().min(1).optional(),
  evidenceLocator: z.string().min(1).optional(),
  lifecycleStatus: lifecycleStatusSchema,
  reviewStatus: hubReviewStatusSchema,
}).strict()

export const reviewDecisionSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  id: hubIdSchema,
  entityId: hubIdSchema,
  entityRevision: z.number().int().positive(),
  canonicalRecordHash: checksumSchema,
  reviewerRole: z.enum(['structural-reviewer', 'evidence-reviewer', 'clinician', 'rights-reviewer']),
  decision: z.enum(['approve', 'approve-with-edits', 'reject', 'changes-requested']),
  scope: z.array(z.enum(['structure', 'evidence', 'clinical-meaning', 'rights', 'accessibility'])).min(1),
  decisionDate: dateSchema,
  notes: z.string(),
}).strict()

export const aiProposalSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  id: hubIdSchema,
  proposalType: z.enum(['reference', 'evidence', 'claim', 'relationship', 'record-update']),
  targetIds: z.array(hubIdSchema),
  sourceIds: z.array(z.string().min(1)),
  sourceChecksums: z.array(checksumSchema),
  proposedRecord: z.unknown(),
  confidence: z.enum(['low', 'medium', 'high']),
  limitations: z.array(z.string().min(1)).min(1),
  status: z.enum(['draft', 'in-review', 'accepted-for-draft', 'rejected']),
  publicEligibility: z.literal(false),
  clinicalApprovalRepresented: z.literal(false),
  autonomousPublicationAllowed: z.literal(false),
  reviewerDecisionId: hubIdSchema.nullable(),
}).strict()

export const pilotPlaceholderSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  pilotId: hubIdSchema,
  title: z.string().min(1),
  pilotStatus: z.enum(['placeholder', 'active', 'complete']),
  lifecycleStatus: z.enum(['draft', 'active', 'archived']),
  reviewStatus: hubReviewStatusSchema,
  publicEligibility: z.literal(false),
  ingestionAllowed: z.boolean(),
  entityIds: z.array(hubIdSchema),
  notes: z.string().min(1),
}).strict().superRefine((data, context) => {
  if (data.pilotStatus === 'placeholder') {
    if (data.ingestionAllowed) context.addIssue({ code: 'custom', path: ['ingestionAllowed'], message: 'placeholder ingestion must remain disabled' })
    if (data.entityIds.length > 0) context.addIssue({ code: 'custom', path: ['entityIds'], message: 'placeholder must not contain entity IDs' })
    if (data.lifecycleStatus !== 'draft' || data.reviewStatus !== 'unreviewed') {
      context.addIssue({ code: 'custom', path: ['pilotStatus'], message: 'placeholder must remain draft and unreviewed' })
    }
  }
})

export const relationshipCatalogSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  relationships: z.array(hubRelationshipSchema),
}).strict()

export const reviewDecisionCatalogSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  decisions: z.array(reviewDecisionSchema),
}).strict()

export const proposalCatalogSchema = z.object({
  schemaVersion: z.literal(HUB_SCHEMA_VERSION),
  proposals: z.array(aiProposalSchema),
}).strict()
