import { z } from 'zod'

const sha256 = z.string().regex(/^[a-f0-9]{64}$/)

export const reviewKindSchema = z.enum([
  'accessibility',
  'anatomy',
  'clinical',
  'conversation',
  'evidence',
  'licensing',
  'movement',
  'publication',
  'safety',
  'source',
  'tutor',
])

export const reviewTargetSchema = z.object({
  entityType: z.enum(['module', 'truth-record', 'rule', 'tutor-transcript', 'mcq', 'movement', 'anatomy-3d', 'evidence', 'visual-asset']),
  entityId: z.string().min(1),
  revision: z.union([z.string().min(1), z.number().int().positive()]),
  contentHash: sha256,
  exactRevisionKey: z.string().min(1),
  publicationState: z.string().min(1),
})

export const reviewDecisionSchema = z.object({
  reviewKind: reviewKindSchema,
  state: z.enum(['pending', 'approved', 'changes-requested', 'rejected', 'stale']),
  reviewerId: z.string().nullable(),
  decidedAt: z.string().datetime().nullable(),
  approvedExactRevisionKey: z.string().nullable(),
  notes: z.array(z.string()),
})

export const exactRevisionReviewSchema = z.object({
  target: reviewTargetSchema,
  decisions: z.array(reviewDecisionSchema).min(1),
  eligibleForPublication: z.boolean(),
  blockers: z.array(z.string()),
})

export const reviewLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  policy: z.literal('exact-revision-fail-closed'),
  generatedAt: z.null(),
  reviews: z.array(exactRevisionReviewSchema),
})

export type ReviewLedger = z.infer<typeof reviewLedgerSchema>
