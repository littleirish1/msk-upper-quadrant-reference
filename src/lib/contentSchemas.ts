import { z } from 'zod'

export const regionSlugSchema = z.enum([
  'cervical',
  'thoracic',
  'shoulder',
  'elbow',
  'wrist-hand',
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
  citations: z.array(citationSchema).optional(),
}).passthrough()

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
}).passthrough())

export type RegionSlug = z.infer<typeof regionSlugSchema>
export type SectionSlug = z.infer<typeof sectionSlugSchema>
export type EvidenceGrade = z.infer<typeof evidenceGradeSchema>
export type CaseStatus = z.infer<typeof caseStatusSchema>
export type ReviewStatus = z.infer<typeof reviewStatusSchema>
export type SourceType = z.infer<typeof sourceTypeSchema>
export type CitationFrontmatter = z.infer<typeof citationSchema>
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>
export type ConditionFrontmatterSchema = z.infer<typeof conditionFrontmatterSchema>
export type CaseFrontmatterSchema = z.infer<typeof caseFrontmatterSchema>
