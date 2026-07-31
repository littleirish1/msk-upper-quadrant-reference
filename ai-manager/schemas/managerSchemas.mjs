import { z } from 'zod'

export const checksumSchema = z.union([
  z.string().regex(/^sha256:[0-9a-f]{64}$/),
  z.literal('pending'),
])

export const ingestionSourceTypeSchema = z.enum([
  'pdf-paper',
  'clinical-guideline',
  'local-patient-leaflet',
  'teaching-presentation',
  'lecture-notes',
  'case-material',
  'osce-material',
  'anatomy-resource',
  'outcome-measure',
  'examination-material',
  'portfolio-reflective-material',
  'administrative',
  'word-document',
  'spreadsheet',
  'html',
  'notes',
  'image',
  'video',
  'archive',
  'existing-case-bank',
  'unknown',
])

export const managerConfigSchema = z.object({
  schemaVersion: z.literal(1),
  projectPathSource: z.literal('PROJECT_PATH'),
  providerMode: z.literal('disabled'),
  networkRequired: z.literal(false),
  publicOutputAllowed: z.literal(false),
  autonomousCommitAllowed: z.literal(false),
  autonomousPushAllowed: z.literal(false),
})

export const ingestionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  sourceType: ingestionSourceTypeSchema,
  originalFilename: z.string().min(1),
  checksum: checksumSchema,
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sourceLocationCategory: z.enum([
    'approved-local-inbox',
    'approved-m365',
    'external-reference',
    'repository-reviewed-source',
  ]),
  copyrightOrLicenceStatus: z.enum(['unknown', 'review-required', 'approved-for-intended-use']),
  intendedUse: z.array(z.string().min(1)).min(1),
  relatedContentIds: z.array(z.string().min(1)).default([]),
  extractionStatus: z.enum(['pending', 'extracted', 'failed', 'not-applicable']),
  evidenceType: z.string().min(1).nullable(),
  clinicianReviewState: z.enum(['not-started', 'required', 'reviewed']),
  archiveState: z.enum(['active', 'superseded', 'archived']),
  identifiableMaterialCheck: z.enum(['not-checked', 'none-confirmed', 'restricted']),
})

export const sourceIntakeRecordSchema = z.object({
  sourceId: z.string().regex(/^src-[0-9a-f]{12}$/),
  checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  logicalPath: z.string().min(1),
  originalFilename: z.string().min(1),
  fileType: z.string().regex(/^\.[a-z0-9]+$|^unknown$/),
  byteSize: z.number().int().nonnegative(),
  modifiedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  containerSourceId: z.string().regex(/^src-[0-9a-f]{12}$/).nullable(),
  occurrences: z.array(z.object({
    logicalPath: z.string().min(1),
    containerSourceId: z.string().regex(/^src-[0-9a-f]{12}$/).nullable(),
  })).min(1),
  sourceType: ingestionSourceTypeSchema,
  topicTags: z.array(z.string().min(1)),
  regionTags: z.array(z.string().min(1)),
  duplicateGroup: z.string().nullable(),
  probableVersionGroup: z.string().nullable(),
  sensitivity: z.enum(['low', 'review-required', 'restricted', 'quarantine']),
  sensitivityFindings: z.array(z.object({
    category: z.string().min(1),
    count: z.number().int().positive(),
  })),
  extractionSupport: z.enum(['supported', 'metadata-only', 'unsupported']),
  extractionStatus: z.enum(['extracted', 'partial', 'unsupported', 'failed', 'quarantined', 'metadata-only']),
  extractionMetadata: z.object({
    method: z.string().min(1),
    pageOrSlideCount: z.number().int().nonnegative().nullable(),
    extractedCharacterCount: z.number().int().nonnegative(),
    headingsDetected: z.array(z.string().max(160)).max(30),
    referencesSectionDetected: z.boolean(),
    tablesDetected: z.number().int().nonnegative(),
    imagesDetected: z.number().int().nonnegative(),
    confidence: z.enum(['high', 'medium', 'low', 'none']),
    warnings: z.array(z.string().max(300)),
  }),
  copyrightOrLicenceStatus: z.enum(['unknown', 'review-required', 'approved-for-intended-use']),
  intendedUse: z.array(z.string().min(1)).min(1),
  reviewStatus: z.enum(['needs-review', 'restricted-review', 'quarantined']),
  publicEligibility: z.literal(false),
})

export const sourceIntakeManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedFrom: z.object({
    locationCategory: z.literal('private-external-inbox'),
    absolutePathStored: z.literal(false),
  }),
  records: z.array(sourceIntakeRecordSchema),
  summary: z.object({
    topLevelFiles: z.number().int().nonnegative(),
    nestedFiles: z.number().int().nonnegative(),
    uniqueSources: z.number().int().nonnegative(),
    totalObservedBytes: z.number().int().nonnegative(),
    exactDuplicateGroups: z.number().int().nonnegative(),
    probableVersionGroups: z.number().int().nonnegative(),
    quarantinedSources: z.number().int().nonnegative(),
    manualReviewSources: z.number().int().nonnegative(),
  }),
})

export const candidateReferenceSchema = z.object({
  candidateReferenceId: z.string().regex(/^ref-[a-z0-9-]+$/),
  sourceId: z.string().regex(/^src-[0-9a-f]{12}$/),
  pageOrSlideNumber: z.number().int().positive().nullable(),
  location: z.string().min(1),
  citationText: z.string().min(1).max(800),
  authors: z.array(z.string().min(1)),
  year: z.string().regex(/^\d{4}[a-z]?$/).nullable(),
  title: z.string().nullable(),
  journalOrPublisher: z.string().nullable(),
  volumeIssuePages: z.string().nullable(),
  doi: z.string().nullable(),
  pmid: z.string().nullable(),
  url: z.string().url().nullable(),
  relatedTopicOrClaim: z.string().min(1),
  citationContext: z.enum(['in-text', 'reference-list', 'further-reading', 'hyperlink', 'attribution']),
  extractionConfidence: z.enum(['high', 'medium', 'low']),
  completenessStatus: z.enum(['full', 'partial', 'minimal']),
  verificationStatus: z.enum([
    'extracted-unverified',
    'incomplete-citation',
    'identifier-present-unverified',
    'likely-duplicate',
    'verified-later',
    'unable-to-identify',
  ]),
  verificationEvidence: z.string().nullable(),
  duplicateGroup: z.string().nullable(),
  notes: z.string(),
})

export const candidateReferenceRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  externalLookupPerformed: z.literal(false),
  records: z.array(candidateReferenceSchema),
})

export const sourceToContentNodeSchema = z.object({
  proposalId: z.string().regex(/^proposal-[a-z0-9-]+$/),
  sourceIds: z.array(z.string().regex(/^src-[0-9a-f]{12}$/)).min(1),
  extractedTeachingTopic: z.string().min(1),
  proposedClinicalClaim: z.string().min(1),
  targetContentId: z.string().min(1),
  requiredEvidence: z.array(z.string().min(1)).min(1),
  clinicianReviewStatus: z.literal('required'),
  proposalStatus: z.literal('blocked-pending-evidence-and-clinician-review'),
  teachingSourceCanEstablishPublicApproval: z.literal(false),
  visualLicenceStatus: z.enum(['not-applicable', 'unknown-review-required']),
  publicEligibility: z.literal(false),
})

export const sourceToContentGraphSchema = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(sourceToContentNodeSchema),
})

export const contentProposalSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  targetContentId: z.string().min(1),
  reasonForChange: z.string().min(1),
  existingText: z.string(),
  proposedText: z.string().min(1),
  supportingSourceIds: z.array(z.string().min(1)).min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  limitations: z.array(z.string().min(1)).min(1),
  clinicalRisk: z.enum(['low', 'moderate', 'high']),
  status: z.enum(['draft', 'in-review', 'approved-for-commit', 'rejected']),
  reviewer: z.string().min(1).nullable(),
  decision: z.enum(['pending', 'approved', 'rejected']),
  finalDiffPath: z.string().min(1).nullable(),
}).superRefine((data, context) => {
  if (data.status === 'approved-for-commit') {
    if (!data.reviewer) context.addIssue({ code: 'custom', path: ['reviewer'], message: 'reviewer is required before approval' })
    if (data.decision !== 'approved') context.addIssue({ code: 'custom', path: ['decision'], message: 'approved decision is required before commit' })
    if (!data.finalDiffPath) context.addIssue({ code: 'custom', path: ['finalDiffPath'], message: 'reviewed diff path is required before commit' })
  }
})

export const extractionUnitSchema = z.object({
  unitId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  unitType: z.enum(['page', 'slide', 'sheet', 'section', 'note', 'table']),
  locator: z.string().min(1),
  textStoredInTrackedOutput: z.literal(false),
  headingCount: z.number().int().nonnegative(),
  tableCount: z.number().int().nonnegative(),
  referenceCandidateCount: z.number().int().nonnegative(),
}).strict()

export const privateIngestionProposalSchema = z.object({
  schemaVersion: z.literal(1),
  proposalId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  sourceId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  sourceType: ingestionSourceTypeSchema,
  sourceChecksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  adapterId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  fixtureOnly: z.boolean(),
  extractedUnits: z.array(extractionUnitSchema),
  proposedTargetIds: z.array(z.string().min(1)),
  claimCandidateIds: z.array(z.string().min(1)),
  sensitivityReview: z.enum(['required', 'passed-synthetic-fixture']),
  copyrightReview: z.literal('required'),
  clinicalReview: z.literal('required'),
  evidenceReview: z.literal('required'),
  sourceClearance: z.literal('required'),
  publicationState: z.literal('blocked'),
  autonomousPublicationAllowed: z.literal(false),
}).strict()

export const managerActionPolicySchema = z.object({
  schemaVersion: z.literal(1),
  providerMode: z.literal('disabled'),
  networkRequired: z.literal(false),
  allowedActions: z.array(z.enum([
    'inspect-tracked-repository',
    'create-governed-proposal',
    'validate-content',
    'generate-review-packet',
    'prepare-explicit-staging-list',
  ])).min(1),
  prohibitedActions: z.array(z.enum([
    'push',
    'merge',
    'deploy',
    'approve-clinical-content',
    'approve-evidence',
    'approve-source-clearance',
    'approve-publication',
    'read-protected-private-cache',
  ])).min(1),
  actionLogContainsSecrets: z.literal(false),
  humanApprovalRequired: z.literal(true),
}).strict()

export const privateAuthoringWorkspaceSchema = z.object({
  schemaVersion: z.literal(1),
  workspaceId: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  publicRoute: z.literal(null),
  staticExportAllowed: z.literal(false),
  providerMode: z.literal('disabled'),
  capabilities: z.array(z.enum([
    'condition-draft',
    'guided-case-draft',
    'branching-model',
    'mcq-draft',
    'evidence-relationship-proposal',
    'provenance-review',
    'validation-review',
    'packet-generation',
  ])).min(1),
  outstandingUiWork: z.array(z.string().min(1)),
}).strict()
