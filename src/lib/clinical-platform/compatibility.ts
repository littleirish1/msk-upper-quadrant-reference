import { z } from 'zod'

export const COMPATIBILITY_SCHEMA_VERSION = 1 as const

export const compatibilityRuleKindSchema = z.enum([
  'requires',
  'prohibits',
  'implies',
  'conditional-permission',
  'mutual-exclusion',
  'severity',
  'laterality',
  'anatomy-distribution',
  'timing',
  'population',
  'comorbidity',
  'investigation',
  'escalation',
  'movement',
  'subjective-objective-consistency',
  'diagnosis-differential-consistency',
  'publication-licensing-dependency',
])

const stableRuleIdSchema = z.string().regex(/^rule\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const compatibilityRuleSchema = z.strictObject({
  schemaVersion: z.literal(COMPATIBILITY_SCHEMA_VERSION),
  id: stableRuleIdSchema,
  revision: z.number().int().positive(),
  kind: compatibilityRuleKindSchema,
  lifecycle: z.enum(['draft', 'in-review', 'approved', 'stale', 'archived']),
  enabled: z.boolean(),
  severity: z.enum(['error', 'warning']),
  when: z.strictObject({
    allModuleIds: z.array(z.string().regex(/^module\./)),
    anyModuleIds: z.array(z.string().regex(/^module\./)),
    contextEquals: z.record(z.string(), z.string()),
  }),
  effect: z.strictObject({
    requiresModuleIds: z.array(z.string().regex(/^module\./)),
    prohibitsModuleIds: z.array(z.string().regex(/^module\./)),
    impliesModuleIds: z.array(z.string().regex(/^module\./)),
    escalationRequirement: z.string().min(1).nullable(),
    reviewRequirement: z.string().min(1).nullable(),
    message: z.string().min(1),
  }),
  evidenceRecordIds: z.array(z.string().min(1)),
  evidenceGapIds: z.array(z.string().min(1)),
  approval: z.strictObject({
    ruleHash: sha256Schema.nullable(),
    approvedRevision: z.number().int().positive().nullable(),
    clinicalReview: z.enum(['required', 'approved', 'stale', 'blocked']),
    evidenceReview: z.enum(['required', 'approved', 'stale', 'blocked']),
  }),
}).superRefine((rule, context) => {
  if (rule.enabled && rule.lifecycle !== 'approved') {
    context.addIssue({ code: 'custom', path: ['enabled'], message: 'only approved rules may be enabled' })
  }
  if (rule.lifecycle === 'approved' && (
    !rule.approval.ruleHash
    || rule.approval.approvedRevision !== rule.revision
    || rule.approval.clinicalReview !== 'approved'
    || rule.approval.evidenceReview !== 'approved'
  )) {
    context.addIssue({ code: 'custom', path: ['approval'], message: 'approved rules require exact-revision clinical and evidence approval' })
  }
})

export const compatibilityCatalogueSchema = z.strictObject({
  schemaVersion: z.literal(COMPATIBILITY_SCHEMA_VERSION),
  authority: z.literal('clinical-compatibility-rules'),
  revision: z.number().int().positive(),
  rules: z.array(compatibilityRuleSchema),
})

export interface CompatibilityModuleInput {
  id: string
  revision: number
  lifecycle: 'draft' | 'in-review' | 'approved' | 'stale' | 'archived'
  publicationState: 'private' | 'blocked' | 'public'
  evidenceGapIds?: string[]
  approvedRuleDigest?: string | null
}

export interface CompatibilityResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missingRequirements: string[]
  prohibitedCombinations: string[]
  escalationRequirements: string[]
  evidenceGaps: string[]
  reviewNeeds: string[]
  impliedModuleIds: string[]
  ruleDigest: string
  trace: Array<{ ruleId: string; revision: number; outcome: string }>
}

export function evaluateCompatibility(
  modules: CompatibilityModuleInput[],
  rules: z.infer<typeof compatibilityRuleSchema>[],
  context: Record<string, string> = {},
): CompatibilityResult {
  const sortedModules = [...modules].sort((left, right) => left.id.localeCompare(right.id))
  const enabledRules = [...rules].filter((rule) => rule.enabled).sort((left, right) => left.id.localeCompare(right.id))
  const selected = new Set(sortedModules.map((entry) => entry.id))
  const implied = new Set<string>()
  const errors: string[] = []
  const warnings: string[] = []
  const missing = new Set<string>()
  const prohibited = new Set<string>()
  const escalations = new Set<string>()
  const evidenceGaps = new Set<string>()
  const reviewNeeds = new Set<string>()
  const trace: CompatibilityResult['trace'] = []

  if (selected.size !== sortedModules.length) errors.push('Duplicate module IDs are invalid.')
  for (const entry of sortedModules) {
    if (entry.lifecycle !== 'approved') reviewNeeds.add(`${entry.id}@${entry.revision}: exact-revision module approval required`)
    for (const gap of entry.evidenceGapIds ?? []) evidenceGaps.add(gap)
  }

  let changed = true
  let pass = 0
  while (changed && pass <= enabledRules.length + sortedModules.length) {
    changed = false
    pass++
    for (const rule of enabledRules) {
      const contextMatches = Object.entries(rule.when.contextEquals).every(([key, value]) => context[key] === value)
      const allMatches = rule.when.allModuleIds.every((id) => selected.has(id) || implied.has(id))
      const anyMatches = rule.when.anyModuleIds.length === 0 || rule.when.anyModuleIds.some((id) => selected.has(id) || implied.has(id))
      if (!contextMatches || !allMatches || !anyMatches) continue

      for (const id of rule.effect.impliesModuleIds) {
        if (!selected.has(id) && !implied.has(id)) {
          implied.add(id)
          changed = true
        }
      }
    }
  }
  if (changed) errors.push('Transitive implication cycle did not converge.')

  const active = new Set([...selected, ...implied])
  for (const rule of enabledRules) {
    const contextMatches = Object.entries(rule.when.contextEquals).every(([key, value]) => context[key] === value)
    const allMatches = rule.when.allModuleIds.every((id) => active.has(id))
    const anyMatches = rule.when.anyModuleIds.length === 0 || rule.when.anyModuleIds.some((id) => active.has(id))
    if (!contextMatches || !allMatches || !anyMatches) {
      trace.push({ ruleId: rule.id, revision: rule.revision, outcome: 'not-applicable' })
      continue
    }
    const outcomes: string[] = []
    for (const id of rule.effect.requiresModuleIds) {
      if (!active.has(id)) { missing.add(id); outcomes.push(`missing:${id}`) }
    }
    for (const id of rule.effect.prohibitsModuleIds) {
      if (active.has(id)) { prohibited.add(`${rule.id}:${id}`); outcomes.push(`prohibited:${id}`) }
    }
    if (rule.effect.escalationRequirement) escalations.add(rule.effect.escalationRequirement)
    if (rule.effect.reviewRequirement) reviewNeeds.add(rule.effect.reviewRequirement)
    for (const gap of rule.evidenceGapIds) evidenceGaps.add(gap)
    if (outcomes.length || rule.effect.escalationRequirement || rule.effect.reviewRequirement) {
      const target = rule.severity === 'error' ? errors : warnings
      target.push(`${rule.id}: ${rule.effect.message}`)
    }
    trace.push({ ruleId: rule.id, revision: rule.revision, outcome: outcomes.join(',') || 'satisfied' })
  }

  for (const required of missing) {
    const conflicting = enabledRules.find((rule) => rule.effect.prohibitsModuleIds.includes(required) && rule.when.allModuleIds.some((id) => active.has(id)))
    if (conflicting) errors.push(`Conflicting approved rules require and prohibit ${required}; fail closed.`)
  }

  const digestInput = enabledRules.map((rule) => `${rule.id}@${rule.revision}`).join('|')
  const ruleDigest = simpleStableDigest(digestInput)
  for (const entry of sortedModules) {
    if (entry.approvedRuleDigest && entry.approvedRuleDigest !== ruleDigest) {
      reviewNeeds.add(`${entry.id}: rule revision changed; prior approval is stale`)
    }
  }

  const sort = (values: Iterable<string>) => [...values].sort()
  return {
    valid: errors.length === 0 && missing.size === 0 && prohibited.size === 0,
    errors: sort(errors),
    warnings: sort(warnings),
    missingRequirements: sort(missing),
    prohibitedCombinations: sort(prohibited),
    escalationRequirements: sort(escalations),
    evidenceGaps: sort(evidenceGaps),
    reviewNeeds: sort(reviewNeeds),
    impliedModuleIds: sort(implied),
    ruleDigest,
    trace,
  }
}

function simpleStableDigest(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}
