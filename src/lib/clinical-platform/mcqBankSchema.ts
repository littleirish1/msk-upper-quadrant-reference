import { z } from 'zod'

export const MCQ_BANK_SCHEMA_VERSION = 1 as const
const reviewStateSchema = z.enum(['required', 'in-review', 'approved', 'stale', 'blocked'])

const authoredContentSchema = z.strictObject({
  stem: z.string().min(1),
  options: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/),
    text: z.string().min(1),
    explanation: z.string().min(1),
    correct: z.boolean(),
  })).min(3),
}).superRefine((content, context) => {
  if (content.options.filter((option) => option.correct).length !== 1) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'MCQs require exactly one best answer' })
  }
  if (new Set(content.options.map((option) => option.id)).size !== content.options.length) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'option IDs must be unique' })
  }
})

export const mcqBankItemSchema = z.strictObject({
  schemaVersion: z.literal(MCQ_BANK_SCHEMA_VERSION),
  id: z.string().regex(/^mcq-slot\.[a-z0-9-]+\.\d{2}$/),
  revision: z.number().int().positive(),
  region: z.string().min(1),
  targetContentIds: z.array(z.string().min(1)),
  learningObjectives: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced', 'not-rated']),
  lifecycle: z.enum(['source-insufficient', 'draft', 'in-review', 'approved', 'stale', 'archived']),
  authoredContent: authoredContentSchema.nullable(),
  evidenceRecordIds: z.array(z.string().min(1)),
  referenceIds: z.array(z.string().min(1)),
  reviews: z.strictObject({
    clinical: reviewStateSchema,
    evidence: reviewStateSchema,
    sourceClearance: reviewStateSchema,
    accessibility: reviewStateSchema,
    publication: reviewStateSchema,
  }),
  answerRevealPolicy: z.literal('after-submission'),
  competenceClaimAllowed: z.literal(false),
  publicEligibility: z.boolean(),
  blockers: z.array(z.string().min(1)),
}).superRefine((item, context) => {
  if (!item.authoredContent && item.lifecycle !== 'source-insufficient') {
    context.addIssue({ code: 'custom', path: ['authoredContent'], message: 'unauthored slots must remain source-insufficient' })
  }
  if (item.publicEligibility) {
    if (item.lifecycle !== 'approved' || !item.authoredContent || item.evidenceRecordIds.length === 0) {
      context.addIssue({ code: 'custom', path: ['publicEligibility'], message: 'public MCQs require approved content and evidence' })
    }
    for (const [domain, state] of Object.entries(item.reviews)) {
      if (state !== 'approved') context.addIssue({ code: 'custom', path: ['reviews', domain], message: 'public MCQs require all exact-revision reviews' })
    }
  }
})

export const mcqBankSchema = z.strictObject({
  schemaVersion: z.literal(MCQ_BANK_SCHEMA_VERSION),
  authority: z.literal('governed-mcq-bank'),
  targetCount: z.literal(20),
  records: z.array(mcqBankItemSchema).length(20),
  governanceExamplePath: z.literal('content/assessment/private/mcq-contract-example.json'),
})
