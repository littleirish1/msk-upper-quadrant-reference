import { z } from 'zod'

export const checksumSchema = z.union([
  z.string().regex(/^sha256:[0-9a-f]{64}$/),
  z.literal('pending'),
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
  sourceType: z.enum([
    'pdf-paper',
    'clinical-guideline',
    'powerpoint',
    'word-document',
    'html',
    'notes',
    'existing-case-bank',
  ]),
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
