import { z } from 'zod'

export const MOVEMENT_SCHEMA_VERSION = 1 as const
const stableMovementIdSchema = z.string().regex(/^movement\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)

export const movementRecordSchema = z.strictObject({
  schemaVersion: z.literal(MOVEMENT_SCHEMA_VERSION),
  id: stableMovementIdSchema,
  revision: z.number().int().positive(),
  kind: z.enum(['joint', 'functional']),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publicLabel: z.string().min(1),
  lifecycle: z.enum(['planned', 'draft', 'in-review', 'approved', 'stale', 'archived']),
  publicEligibility: z.boolean(),
  jointMovement: z.strictObject({
    plane: z.string().min(1).nullable(),
    axis: z.string().min(1).nullable(),
    supportedRanges: z.array(z.string().min(1)),
    arthrokinematics: z.array(z.string().min(1)),
    primeMovers: z.array(z.string().min(1)),
    synergists: z.array(z.string().min(1)),
    stabilisers: z.array(z.string().min(1)),
    antagonists: z.array(z.string().min(1)),
  }).nullable(),
  phases: z.array(z.strictObject({
    id: z.string().regex(/^phase\./),
    label: z.string().min(1),
    keyframe: z.string().min(1),
    jointContributions: z.array(z.string().min(1)),
    muscleRoles: z.array(z.string().min(1)),
  })),
  sequence: z.array(z.string().min(1)),
  normalVariation: z.array(z.string().min(1)),
  compensations: z.array(z.string().min(1)),
  painfulPatterns: z.array(z.string().min(1)),
  relatedTestIds: z.array(z.string().min(1)),
  relatedConditionIds: z.array(z.string().min(1)),
  relatedCaseIds: z.array(z.string().regex(/^case\./)),
  linked3dStructureIds: z.array(z.string().regex(/^structure\./)),
  patientFindingModuleIds: z.array(z.string().regex(/^module\./)),
  tutorExplanation: z.string().min(1).nullable(),
  accessibleTranscript: z.string().min(1).nullable(),
  evidenceRecordIds: z.array(z.string().min(1)),
  evidenceGapIds: z.array(z.string().min(1)),
  reviews: z.strictObject({
    movement: z.enum(['required', 'approved', 'stale', 'blocked']),
    anatomy: z.enum(['required', 'approved', 'stale', 'blocked']),
    clinical: z.enum(['required', 'approved', 'stale', 'blocked']),
    evidence: z.enum(['required', 'approved', 'stale', 'blocked']),
    accessibility: z.enum(['required', 'approved', 'stale', 'blocked']),
    publication: z.enum(['required', 'approved', 'stale', 'blocked']),
  }),
  unresolvedIssues: z.array(z.string().min(1)),
}).superRefine((record, context) => {
  if (record.kind === 'joint' && !record.jointMovement) context.addIssue({ code: 'custom', path: ['jointMovement'], message: 'joint movement records require the joint movement shape' })
  if (record.kind === 'functional' && record.jointMovement) context.addIssue({ code: 'custom', path: ['jointMovement'], message: 'functional movement records use phases instead' })
  if (record.publicEligibility) {
    if (record.lifecycle !== 'approved') context.addIssue({ code: 'custom', path: ['lifecycle'], message: 'public movement must be approved' })
    if (!record.accessibleTranscript) context.addIssue({ code: 'custom', path: ['accessibleTranscript'], message: 'public movement requires a non-visual equivalent' })
    if (record.evidenceRecordIds.length === 0) context.addIssue({ code: 'custom', path: ['evidenceRecordIds'], message: 'public movement requires evidence' })
    for (const [domain, state] of Object.entries(record.reviews)) {
      if (state !== 'approved') context.addIssue({ code: 'custom', path: ['reviews', domain], message: 'every movement review domain must be approved' })
    }
  }
  const hasClaims = record.phases.length > 0
    || record.sequence.length > 0
    || record.normalVariation.length > 0
    || record.compensations.length > 0
    || record.painfulPatterns.length > 0
    || Boolean(record.tutorExplanation)
    || Boolean(record.jointMovement && Object.values(record.jointMovement).some((value) => Array.isArray(value) ? value.length > 0 : value))
  if (hasClaims && record.evidenceRecordIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['evidenceRecordIds'], message: 'movement claims require evidence relationships' })
  }
})

export const movementLibrarySchema = z.strictObject({
  schemaVersion: z.literal(MOVEMENT_SCHEMA_VERSION),
  authority: z.literal('governed-movement-library'),
  records: z.array(movementRecordSchema),
})
