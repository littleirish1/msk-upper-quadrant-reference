import { z } from 'zod'

export const regionSlugSchema = z.enum([
  'cervical',
  'thoracic',
  'shoulder',
  'elbow',
  'wrist-hand',
  'lumbar',
])

export const sectionSlugSchema = z.enum([
  'overview',
  'special-tests',
  'red-flags',
  'clinical-frameworks',
  'outcome-measures',
  'evidence-based-diagnosis',
  'differential-diagnosis',
  'management',
])

export const evidenceGradeSchema = z.enum(['A', 'B', 'C', 'D', 'GPP'])

export const caseStatusSchema = z.enum(['published', 'draft', 'archived'])

export const reviewStatusSchema = z.enum(['reviewed', 'needs-review'])

export const contentLifecycleStatusSchema = z.enum([
  'published',
  'draft',
  'private',
  'planned',
  'deprecated',
  'archived',
])

export const platformReviewStatusSchema = z.enum([
  'reviewed',
  'needs-review',
  'clinician-review-required',
])

export const contentIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/, 'use a namespaced lowercase content ID')

export const relatedContentSchema = z.object({
  conditions: z.array(contentIdSchema).default([]),
  cases: z.array(contentIdSchema).default([]),
  anatomy: z.array(contentIdSchema).default([]),
  specialTests: z.array(contentIdSchema).default([]),
  outcomeMeasures: z.array(contentIdSchema).default([]),
}).partial()

export const sourceTypeSchema = z.enum([
  'legacy-html-case-bank',
  'powerpoint',
  'paper',
  'manual-case',
  'evidence-note',
  'teaching-session',
  'assessment-template',
  'clinical-guideline',
])

export const citationSchema = z.object({
  id: z.string().min(1),
  authors: z.array(z.string().min(1)).default([]),
  year: z.number().int().optional(),
  title: z.string().min(1),
  journal: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  pmid: z.string().optional(),
}).passthrough()

export const sourceMetadataSchema = z.object({
  sourceType: sourceTypeSchema.optional(),
  sourceId: z.string().min(1).optional(),
  sourcePath: z.string().min(1).optional(),
  reviewStatus: reviewStatusSchema.optional(),
}).passthrough()

export const conditionFrontmatterSchema = z.object({
  contentId: contentIdSchema.optional(),
  title: z.string().min(1),
  region: regionSlugSchema,
  category: z.literal('condition').optional(),
  condition: z.string().min(1).optional(),
  section: sectionSlugSchema.optional(),
  evidence_level: z.string().min(1).optional(),
  evidenceGrade: evidenceGradeSchema.optional(),
  lastUpdated: z.string().min(1).optional(),
  lastReviewed: z.string().min(1).optional(),
  reviewedBy: z.string().min(1).optional(),
  icd10: z.string().min(1).optional(),
  ichd3: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  relatedConditions: z.array(z.string().min(1)).optional(),
  relatedContent: relatedContentSchema.optional(),
  status: contentLifecycleStatusSchema.optional(),
  publicEligibility: z.boolean().optional(),
  clinicianReviewStatus: platformReviewStatusSchema.optional(),
  citations: z.array(citationSchema).optional(),
}).passthrough()

const governedLearningRecordSchema = z.object({
  contentId: contentIdSchema,
  title: z.string().min(1),
  region: regionSlugSchema,
  status: contentLifecycleStatusSchema,
  publicEligibility: z.boolean(),
  reviewStatus: platformReviewStatusSchema,
  sourceContentIds: z.array(contentIdSchema).default([]),
  relatedContent: relatedContentSchema.optional(),
  references: z.array(citationSchema).default([]),
  notes: z.string().optional(),
}).superRefine((data, context) => {
  if (data.publicEligibility && data.status !== 'published') {
    context.addIssue({
      code: 'custom',
      path: ['publicEligibility'],
      message: 'public eligibility requires published status',
    })
  }
  if (data.publicEligibility && data.reviewStatus !== 'reviewed') {
    context.addIssue({
      code: 'custom',
      path: ['reviewStatus'],
      message: 'public eligibility requires reviewed status',
    })
  }
})

export const specialTestRecordSchema = governedLearningRecordSchema.and(z.object({
  recordType: z.literal('special-test'),
  purpose: z.string().min(1).optional(),
  technique: z.string().min(1).optional(),
  interpretation: z.string().min(1).optional(),
  limitations: z.string().min(1).optional(),
  diagnosticAccuracy: z.array(z.object({
    population: z.string().min(1),
    sensitivity: z.string().min(1).optional(),
    specificity: z.string().min(1).optional(),
    positiveLikelihoodRatio: z.string().min(1).optional(),
    negativeLikelihoodRatio: z.string().min(1).optional(),
    citationId: z.string().min(1),
  })).default([]),
  contraindicationsOrCautions: z.array(z.string().min(1)).default([]),
}))

export const outcomeMeasureRecordSchema = governedLearningRecordSchema.and(z.object({
  recordType: z.literal('outcome-measure'),
  abbreviation: z.string().min(1).optional(),
  construct: z.string().min(1).optional(),
  population: z.string().min(1).optional(),
  scoring: z.string().min(1).optional(),
  interpretation: z.string().min(1).optional(),
  measurementProperties: z.string().min(1).optional(),
  mcid: z.string().min(1).optional(),
  mdc: z.string().min(1).optional(),
  licenceOrUseRestrictions: z.string().min(1).optional(),
}))

export const caseFrontmatterSchema = sourceMetadataSchema.merge(z.object({
  title: z.string().min(1),
  region: regionSlugSchema,
  condition: z.string().min(1),
  caseType: z.string().min(1).optional(),
  difficulty: z.string().min(1).optional(),
  estimatedTime: z.string().min(1).optional(),
  lastReviewed: z.string().min(1).optional(),
  reviewedBy: z.string().min(1).optional(),
  learningFocus: z.array(z.string().min(1)).default([]),
  status: caseStatusSchema,
  publicSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
}).passthrough()).superRefine((data, context) => {
  const hasSourceFields = Boolean(data.sourceId || data.sourcePath || data.reviewStatus)

  if (hasSourceFields && !data.sourceType) {
    context.addIssue({
      code: 'custom',
      path: ['sourceType'],
      message: 'sourceType is required when source metadata is present',
    })
  }

  if (data.sourceType === 'legacy-html-case-bank') {
    for (const field of ['sourceId', 'sourcePath', 'reviewStatus'] as const) {
      if (!data[field]) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: field + ' is required for legacy-html-case-bank cases',
        })
      }
    }

    if (data.status === 'published' && data.reviewStatus !== 'reviewed') {
      context.addIssue({
        code: 'custom',
        path: ['reviewStatus'],
        message: 'published legacy-derived cases require reviewStatus reviewed',
      })
    }
  }
})

export type RegionSlug = z.infer<typeof regionSlugSchema>
export type SectionSlug = z.infer<typeof sectionSlugSchema>
export type EvidenceGrade = z.infer<typeof evidenceGradeSchema>
export type CaseStatus = z.infer<typeof caseStatusSchema>
export type ReviewStatus = z.infer<typeof reviewStatusSchema>
export type ContentLifecycleStatus = z.infer<typeof contentLifecycleStatusSchema>
export type PlatformReviewStatus = z.infer<typeof platformReviewStatusSchema>
export type ContentId = z.infer<typeof contentIdSchema>
export type RelatedContent = z.infer<typeof relatedContentSchema>
export type SourceType = z.infer<typeof sourceTypeSchema>
export type CitationFrontmatter = z.infer<typeof citationSchema>
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>
export type ConditionFrontmatterSchema = z.infer<typeof conditionFrontmatterSchema>
export type CaseFrontmatterSchema = z.infer<typeof caseFrontmatterSchema>
export type SpecialTestRecord = z.infer<typeof specialTestRecordSchema>
export type OutcomeMeasureRecord = z.infer<typeof outcomeMeasureRecordSchema>
