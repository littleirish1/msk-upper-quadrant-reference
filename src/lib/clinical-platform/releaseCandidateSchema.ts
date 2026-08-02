import { z } from 'zod'

const blockerSchema = z.object({
  blockerId: z.string().min(1),
  gate: z.enum(['exact-revision-review', 'evidence-gap', 'source-clearance', 'quality-sign-off', 'beta-governance', 'dependency-security', 'independent-review', 'publication']),
  target: z.string().min(1),
  humanControlled: z.boolean(),
  state: z.literal('open'),
})

export const v1ReleaseCandidateSchema = z.object({
  schemaVersion: z.literal(1),
  candidateId: z.literal('release.v1-conversational-clinical-platform'),
  candidateDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  repositoryCommit: z.null(),
  status: z.literal('blocked'),
  automatedValidationStatus: z.literal('pending-final-exact-commit-validation'),
  publicationApproved: z.literal(false),
  deploymentAllowed: z.literal(false),
  blockers: z.array(blockerSchema).min(1),
  blockerCounts: z.record(z.string(), z.number().int().positive()),
})

export const releaseDryRunSchema = z.object({
  schemaVersion: z.literal(1),
  candidateId: z.literal('release.v1-conversational-clinical-platform'),
  outcome: z.literal('blocked-before-publication'),
  deploymentAttempted: z.literal(false),
  pushAttempted: z.literal(false),
  tagAttempted: z.literal(false),
  evaluatedBlockerCount: z.number().int().positive(),
  stopReason: z.literal('open-release-gates'),
})
