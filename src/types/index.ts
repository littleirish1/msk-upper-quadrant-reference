// ─── Region / Condition taxonomy ──────────────────────────────────────────────

export type RegionSlug =
  | 'cervical'
  | 'thoracic'
  | 'shoulder'
  | 'elbow'
  | 'wrist-hand'
  | 'lumbar'
  | 'pelvis-sij'
  | 'hip'
  | 'knee'
  | 'ankle-foot'

export type SectionSlug =
  | 'overview'
  | 'special-tests'
  | 'red-flags'
  | 'clinical-frameworks'
  | 'outcome-measures'
  | 'evidence-based-diagnosis'
  | 'differential-diagnosis'
  | 'management'

export interface Region {
  slug: RegionSlug
  label: string
  description: string
  icon: string                 // Lucide icon name
  conditions: Condition[]
}

export interface Condition {
  slug: string
  label: string
  region: RegionSlug
  icd10?: string               // ICD-10 code for reference
  tags?: string[]
}

// ─── MDX frontmatter ──────────────────────────────────────────────────────────

export interface ConditionFrontmatter {
  title?: string
  region?: RegionSlug
  condition?: string
  section?: SectionSlug
  lastReviewed?: string
  lastUpdated?: string         // alternative frontmatter key
  reviewedBy?: string
  evidenceGrade?: 'A' | 'B' | 'C' | 'D' | 'GPP'
  evidence_level?: string      // alternative frontmatter key
  icd10?: string
  tags?: string[]
  relatedConditions?: string[]
  citations?: Citation[]
}

export interface Citation {
  id: string                   // cite key, e.g. "surenkok2009"
  authors: string[]
  year: number
  title: string
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string
  url?: string
  pmid?: string
}

// ─── Search index ─────────────────────────────────────────────────────────────

export interface SearchIndexEntry {
  id: string                   // `${region}/${condition}`
  title: string
  region: string
  condition: string
  section: string              // kept for compat, may be empty string
  content: string              // plain text excerpt for indexing
  href: string
}

// ─── Special tests table ──────────────────────────────────────────────────────

export interface SpecialTest {
  name: string
  target: string               // what pathology it tests
  sensitivity: number | string // % or "N/A"
  specificity: number | string
  lr_positive?: number | string
  lr_negative?: number | string
  description?: string
  notes?: string
  reference?: string           // cite key
}

// ─── Outcome measures ─────────────────────────────────────────────────────────

export interface OutcomeMeasure {
  name: string
  abbreviation: string
  construct: string
  items: number
  mcid?: string                // Minimal Clinically Important Difference
  mdcPercent?: string          // Minimal Detectable Change
  scoringRange?: string
  freeAccess: boolean
  reference?: string
}
