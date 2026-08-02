import { z } from 'zod'

export const CLINICAL_MODULE_SCHEMA_VERSION = 1 as const

export const clinicalModuleTypeSchema = z.enum([
  'symptom',
  'distribution',
  'time-course',
  'aggravating-easing',
  'function',
  'medical-history',
  'medication',
  'psychosocial-factor',
  'red-flag',
  'relevant-negative',
  'objective-finding',
  'neurological-finding',
  'test-finding',
  'imaging-finding',
  'investigation',
  'management',
  'safety-netting',
  'escalation',
  'prognosis',
  'condition-presentation',
  'condition-variant',
  'differential-discriminator',
  'comorbidity',
  'distractor',
  'communication-behaviour',
  'movement-finding',
  'functional-movement',
  'anatomy-relationship',
  'muscle-role',
  'accessibility-explanation',
])

export const moduleVisibilitySchema = z.enum([
  'public-immediate',
  'public-after-reveal',
  'internal-only',
  'human-review-required',
])

export const MODULE_FIELD_VISIBILITY = {
  schemaVersion: 'public-immediate',
  id: 'public-immediate',
  type: 'public-immediate',
  revision: 'public-immediate',
  lifecycle: 'public-immediate',
  publicationState: 'internal-only',
  publicLabel: 'public-immediate',
  internalLabel: 'internal-only',
  structuredMeaning: 'public-immediate',
  patientPhrasing: 'public-immediate',
  tutorPhrasing: 'public-after-reveal',
  synonyms: 'internal-only',
  questionMappings: 'internal-only',
  applicability: 'internal-only',
  companions: 'internal-only',
  constraints: 'internal-only',
  difficulty: 'internal-only',
  relationships: 'internal-only',
  flags: 'internal-only',
  reviews: 'human-review-required',
  fieldClassifications: 'internal-only',
} as const satisfies Record<string, z.infer<typeof moduleVisibilitySchema>>

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const stableModuleIdSchema = z.string().regex(/^module\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)

export const clinicalModuleSchema = z.strictObject({
  schemaVersion: z.literal(CLINICAL_MODULE_SCHEMA_VERSION),
  id: stableModuleIdSchema,
  type: clinicalModuleTypeSchema,
  revision: z.number().int().positive(),
  lifecycle: z.enum(['draft', 'in-review', 'approved', 'stale', 'archived']),
  publicationState: z.enum(['private', 'blocked', 'public']),
  publicLabel: z.string().min(1),
  internalLabel: z.string().min(1),
  structuredMeaning: z.strictObject({
    kind: z.enum(['carried-forward-presentation', 'structured-fact']),
    value: z.string().min(1),
    sourceCaseId: z.string().min(1).nullable(),
  }),
  patientPhrasing: z.strictObject({
    approved: z.array(z.string().min(1)),
    status: z.enum(['baseline-carried-forward', 'review-required', 'approved']),
  }),
  tutorPhrasing: z.strictObject({
    approved: z.array(z.string().min(1)),
    status: z.enum(['baseline-carried-forward', 'review-required', 'approved']),
  }),
  synonyms: z.array(z.string().min(1)),
  questionMappings: z.array(z.string().min(1)),
  applicability: z.strictObject({
    populations: z.array(z.string().min(1)),
    settings: z.array(z.string().min(1)),
    regions: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  }),
  companions: z.strictObject({
    required: z.array(stableModuleIdSchema),
    prohibited: z.array(stableModuleIdSchema),
  }),
  constraints: z.strictObject({
    temporal: z.array(z.string().min(1)),
    severity: z.array(z.string().min(1)),
    escalation: z.array(z.string().min(1)),
  }),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced', 'not-rated']),
  relationships: z.strictObject({
    sources: z.array(z.strictObject({
      recordId: z.string().min(1),
      repositoryPath: z.string().min(1),
      revision: z.string().min(1),
      hash: sha256Schema,
    })).min(1),
    evidenceRecordIds: z.array(z.string().min(1)),
    evidenceGapIds: z.array(z.string().min(1)),
  }),
  flags: z.strictObject({
    aiAssisted: z.boolean(),
    humanEdited: z.boolean(),
    requiresHumanReview: z.boolean(),
  }),
  reviews: z.strictObject({
    clinical: z.enum(['required', 'approved', 'stale', 'blocked']),
    evidence: z.enum(['required', 'approved', 'stale', 'blocked']),
    source: z.enum(['required', 'baseline-carried-forward', 'approved', 'stale', 'blocked']),
    publication: z.enum(['required', 'approved', 'stale', 'blocked']),
    approvalHash: sha256Schema.nullable(),
    approvedRevision: z.number().int().positive().nullable(),
    nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    limitations: z.array(z.string().min(1)),
    unresolvedIssues: z.array(z.string().min(1)),
  }),
  fieldClassifications: z.record(z.string(), moduleVisibilitySchema),
}).superRefine((record, context) => {
  const declared = Object.keys(record.fieldClassifications).sort()
  const expected = Object.keys(MODULE_FIELD_VISIBILITY).sort()
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    context.addIssue({
      code: 'custom',
      path: ['fieldClassifications'],
      message: 'every field must have an explicit visibility classification; unknown fields fail closed',
    })
  }

  if (record.lifecycle === 'approved') {
    if (record.reviews.approvedRevision !== record.revision || !record.reviews.approvalHash) {
      context.addIssue({
        code: 'custom',
        path: ['reviews'],
        message: 'approved modules require an exact revision and approval hash',
      })
    }
  }

  if (record.publicationState === 'public') {
    if (record.lifecycle !== 'approved') {
      context.addIssue({ code: 'custom', path: ['publicationState'], message: 'public modules must be approved' })
    }
    for (const domain of ['clinical', 'evidence', 'publication'] as const) {
      if (record.reviews[domain] !== 'approved') {
        context.addIssue({ code: 'custom', path: ['reviews', domain], message: 'public modules require all approvals' })
      }
    }
    if (!['approved', 'baseline-carried-forward'].includes(record.reviews.source)) {
      context.addIssue({ code: 'custom', path: ['reviews', 'source'], message: 'public modules require source clearance' })
    }
  }
})

export const clinicalModuleLibrarySchema = z.strictObject({
  schemaVersion: z.literal(CLINICAL_MODULE_SCHEMA_VERSION),
  authority: z.literal('clinical-module-library'),
  generatedFrom: z.array(z.string().min(1)).min(1),
  modules: z.array(clinicalModuleSchema),
})

export type ClinicalModule = z.infer<typeof clinicalModuleSchema>
export type ModuleVisibility = z.infer<typeof moduleVisibilitySchema>

export function isApprovalStale(module: ClinicalModule, currentHash: string): boolean {
  return module.lifecycle === 'approved'
    && (module.reviews.approvedRevision !== module.revision || module.reviews.approvalHash !== currentHash)
}

export function projectClinicalModule(
  module: ClinicalModule,
  projection: 'learner' | 'conversation' | 'tutor' | 'authoring' | 'evidence-review' | 'case-generation',
): Record<string, unknown> {
  if (projection === 'authoring' || projection === 'evidence-review') return { ...module }
  if (module.publicationState !== 'public' || module.lifecycle !== 'approved') return {}

  const allowed = projection === 'tutor'
    ? new Set<ModuleVisibility>(['public-immediate', 'public-after-reveal'])
    : new Set<ModuleVisibility>(['public-immediate'])

  return Object.fromEntries(
    Object.entries(module).filter(([field]) => {
      const visibility = module.fieldClassifications[field]
      return visibility ? allowed.has(visibility) : false
    }),
  )
}
