import { z } from 'zod'

export const SEEDED_GENERATOR_SCHEMA_VERSION = 1 as const

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const patientRecipeSchema = z.strictObject({
  schemaVersion: z.literal(SEEDED_GENERATOR_SCHEMA_VERSION),
  recipeId: z.string().regex(/^recipe\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  recipeRevision: z.number().int().positive(),
  lifecycle: z.enum(['draft', 'in-review', 'approved', 'stale', 'archived']),
  caseId: z.string().regex(/^case\./),
  truthRecordId: z.string().regex(/^patient-truth\./),
  truthHash: sha256Schema,
  moduleRevisions: z.array(z.strictObject({
    moduleId: z.string().regex(/^module\./),
    revision: z.number().int().positive(),
    approvalHash: sha256Schema.nullable(),
  })),
  ruleCatalogueRevision: z.number().int().positive(),
  ruleDigest: z.string().min(1),
  targetReasoningObjective: z.string().min(1),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced', 'not-rated']),
  region: z.string().min(1),
  comorbidityModuleIds: z.array(z.string().regex(/^module\./)),
  distractorModuleIds: z.array(z.string().regex(/^module\./)),
  allowedVariation: z.enum(['cosmetic', 'clinical', 'complex']),
  governance: z.strictObject({
    recipeApprovalHash: sha256Schema.nullable(),
    approvedRevision: z.number().int().positive().nullable(),
    clinicalReview: z.enum(['required', 'approved', 'stale', 'blocked']),
    evidenceReview: z.enum(['required', 'approved', 'stale', 'blocked']),
    publicationReview: z.enum(['required', 'approved', 'stale', 'blocked']),
  }),
}).superRefine((recipe, context) => {
  if (recipe.lifecycle === 'approved' && (
    !recipe.governance.recipeApprovalHash
    || recipe.governance.approvedRevision !== recipe.recipeRevision
    || recipe.governance.clinicalReview !== 'approved'
    || recipe.governance.evidenceReview !== 'approved'
    || recipe.governance.publicationReview !== 'approved'
  )) {
    context.addIssue({ code: 'custom', path: ['governance'], message: 'approved recipes require exact-revision human approvals' })
  }
})

export const generatedPatientManifestSchema = z.strictObject({
  schemaVersion: z.literal(SEEDED_GENERATOR_SCHEMA_VERSION),
  instanceId: z.string().regex(/^pt-[a-f0-9]{16}$/),
  seedHash: sha256Schema,
  recipeId: z.string().regex(/^recipe\./),
  recipeRevision: z.number().int().positive(),
  truthRecordId: z.string().regex(/^patient-truth\./),
  truthHash: sha256Schema,
  moduleRevisions: z.array(z.strictObject({ moduleId: z.string(), revision: z.number().int().positive() })),
  ruleCatalogueRevision: z.number().int().positive(),
  ruleDigest: z.string().min(1),
  variationLevel: z.enum(['cosmetic', 'clinical', 'complex']),
  purpose: z.enum(['private-preview', 'public']),
  publicEligibility: z.boolean(),
  patientAlias: z.string().regex(/^Patient [A-Z]{2}-\d{3}$/),
  authoritativeOutputHash: sha256Schema,
  scans: z.strictObject({
    contradictionCount: z.number().int().nonnegative(),
    escalationRequirementCount: z.number().int().nonnegative(),
    disclosureViolationCount: z.number().int().nonnegative(),
    evidenceGapCount: z.number().int().nonnegative(),
  }),
})

export const patientRecipeCatalogueSchema = z.strictObject({
  schemaVersion: z.literal(SEEDED_GENERATOR_SCHEMA_VERSION),
  authority: z.literal('seeded-patient-recipes'),
  recipes: z.array(patientRecipeSchema),
})
