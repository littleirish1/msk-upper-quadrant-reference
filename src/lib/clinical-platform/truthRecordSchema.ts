import { z } from 'zod'

export const PATIENT_TRUTH_SCHEMA_VERSION = 1 as const

export const truthDomainSchema = z.enum([
  'profile',
  'communication-style',
  'goals-concerns',
  'presenting-complaint',
  'volunteered-fact',
  'symptom-location',
  'laterality',
  'distribution',
  'quality',
  'intensity',
  'irritability',
  'onset',
  'duration',
  'mechanism',
  'progression',
  'twenty-four-hour-pattern',
  'aggravating-factor',
  'easing-factor',
  'function',
  'bladder-bowel-saddle',
  'weakness',
  'falls-balance',
  'systemic-history',
  'red-flag-history',
  'medical-history',
  'medication',
  'diabetes',
  'anticoagulation',
  'steroids',
  'psychosocial-context',
  'objective-finding',
  'neurological-finding',
  'movement-finding',
  'test-finding',
  'investigation-finding',
  'likely-diagnosis',
  'differential',
  'management',
  'safety-netting',
  'escalation',
  'prognosis',
  'condition-link',
])

export const truthStateSchema = z.enum([
  'positive',
  'negative',
  'unknown-to-patient',
  'unavailable-in-case',
  'not-yet-assessed',
  'intentionally-withheld',
])

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const truthIdSchema = z.string().regex(/^truth\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)

export const truthItemSchema = z.strictObject({
  id: truthIdSchema,
  domain: truthDomainSchema,
  value: z.string().min(1).nullable(),
  state: truthStateSchema,
  source: z.strictObject({
    recordId: z.string().min(1),
    repositoryPath: z.string().min(1),
    revision: z.string().min(1),
    hash: sha256Schema,
  }),
  disclosureStage: z.enum(['initial', 'subjective', 'objective', 'final-reveal', 'never-public']),
  volunteered: z.boolean(),
  retrievalIntents: z.array(z.string().min(1)),
  synonyms: z.array(z.string().min(1)),
  patientKnowledge: z.enum(['knows', 'uncertain', 'does-not-know', 'not-applicable']),
  uncertainty: z.enum(['none-recorded', 'explicit', 'not-applicable']),
  clinicalRole: z.enum([
    'context',
    'supporting',
    'discriminator',
    'safety',
    'objective',
    'diagnosis',
    'management',
    'gap',
  ]),
  moduleId: z.string().regex(/^module\./).nullable(),
  moduleRevision: z.number().int().positive().nullable(),
})

export const patientTruthRecordSchema = z.strictObject({
  schemaVersion: z.literal(PATIENT_TRUTH_SCHEMA_VERSION),
  recordId: z.string().regex(/^patient-truth\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  caseId: z.string().regex(/^case\./),
  caseRevision: z.number().int().positive(),
  seedBasis: z.string().min(1),
  authoritativeHash: sha256Schema,
  lifecycle: z.enum(['baseline-published', 'draft', 'archived']),
  publicModeEligibility: z.boolean(),
  immutableWithinSession: z.literal(true),
  items: z.array(truthItemSchema).min(1),
  gaps: z.array(z.strictObject({
    domain: truthDomainSchema,
    state: z.enum(['unavailable-in-case', 'not-yet-assessed', 'intentionally-withheld']),
    reason: z.string().min(1),
  })),
  governance: z.strictObject({
    sourceCaseHash: sha256Schema,
    sourceCaseRevision: z.number().int().positive(),
    migrationKind: z.enum(['baseline-meaning-preserved', 'private-pilot-draft']),
    clinicalReview: z.enum(['baseline-carried-forward', 'required']),
    evidenceReview: z.enum(['baseline-carried-forward', 'required']),
    publicationReview: z.enum(['baseline-carried-forward', 'required']),
    limitations: z.array(z.string().min(1)),
    unresolvedIssues: z.array(z.string().min(1)),
  }),
}).superRefine((record, context) => {
  const ids = new Set<string>()
  const domains = new Set<string>()
  for (const [index, item] of record.items.entries()) {
    if (ids.has(item.id)) context.addIssue({ code: 'custom', path: ['items', index, 'id'], message: 'duplicate truth item ID' })
    if (domains.has(item.domain)) context.addIssue({ code: 'custom', path: ['items', index, 'domain'], message: 'truth domains must be explicit and unique' })
    ids.add(item.id)
    domains.add(item.domain)
    if (item.state === 'negative' && item.value === null) {
      context.addIssue({ code: 'custom', path: ['items', index], message: 'missing values can never imply a negative finding' })
    }
    if (item.state !== 'positive' && item.state !== 'negative' && item.value !== null) {
      context.addIssue({ code: 'custom', path: ['items', index, 'value'], message: 'non-factual states must not carry a clinical value' })
    }
  }
  for (const domain of truthDomainSchema.options) {
    if (!domains.has(domain)) context.addIssue({ code: 'custom', path: ['items'], message: `missing explicit truth domain: ${domain}` })
  }
  if (record.publicModeEligibility && record.lifecycle !== 'baseline-published') {
    context.addIssue({ code: 'custom', path: ['publicModeEligibility'], message: 'only baseline-published truth records can power public modes' })
  }
})

export const patientTruthLibrarySchema = z.strictObject({
  schemaVersion: z.literal(PATIENT_TRUTH_SCHEMA_VERSION),
  authority: z.literal('patient-truth-records'),
  records: z.array(patientTruthRecordSchema),
})

export type PatientTruthRecord = z.infer<typeof patientTruthRecordSchema>

export function immutableSessionTruth<T extends PatientTruthRecord>(record: T): Readonly<T> {
  const freeze = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value)
      for (const child of Object.values(value)) freeze(child)
    }
    return value
  }
  return freeze(structuredClone(record)) as Readonly<T>
}
