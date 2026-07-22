import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import {
  caseFrontmatterSchema,
  conditionFrontmatterSchema,
  type CaseFrontmatterSchema,
  type ConditionFrontmatterSchema,
} from './contentSchemas'
import { extractExcerpt, parseSections, sanitizeMdxContent } from './mdxParsing'

export { extractExcerpt, parseSections, sanitizeMdxContent } from './mdxParsing'

const CONTENT_DIR = path.join(process.cwd(), 'content')

function relativeContentPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function formatSchemaError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .map((issue) => {
      const fieldPath = issue.path.length ? issue.path.map(String).join('.') : '(root)'
      return `${fieldPath}: ${issue.message}`
    })
    .join('; ')
}

function parseConditionFrontmatter(filePath: string, data: Record<string, unknown>): ConditionFrontmatterSchema {
  const result = conditionFrontmatterSchema.safeParse(data)

  if (!result.success) {
    throw new Error(
      `Invalid condition frontmatter in ${relativeContentPath(filePath)}: ${formatSchemaError(result.error)}`,
    )
  }

  return result.data
}

function parseCaseFrontmatter(filePath: string, data: Record<string, unknown>): CaseFrontmatterSchema {
  const result = caseFrontmatterSchema.safeParse(data)

  if (!result.success) {
    throw new Error(
      `Invalid guided case frontmatter in ${relativeContentPath(filePath)}: ${formatSchemaError(result.error)}`,
    )
  }

  return result.data
}

export interface ConditionContent {
  content: string
  frontmatter: ConditionFrontmatterSchema
  sections: Array<{ heading: string; slug: string; content: string }>
}

export function parseConditionDocument(raw: string, filePath: string): ConditionContent {
  const { content: rawContent, data } = matter(raw)
  const frontmatter = parseConditionFrontmatter(filePath, data)
  const content = sanitizeMdxContent(rawContent)

  return { content, frontmatter, sections: parseSections(content) }
}

/**
 * Loads a single MDX file from content/{region}/{condition}.mdx
 * Parses sections by splitting on ## headings.
 */
export async function getConditionContent(
  region: string,
  condition: string
): Promise<ConditionContent | null> {
  const filePath = path.join(CONTENT_DIR, region, `${condition}.mdx`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  return parseConditionDocument(fs.readFileSync(filePath, 'utf-8'), filePath)
}

/**
 * Returns all existing MDX files as a flat list.
 * Used by generateStaticParams.
 */
export function getAllMdxPaths(): Array<{ region: string; condition: string }> {
  const results: Array<{ region: string; condition: string }> = []

  if (!fs.existsSync(CONTENT_DIR)) return results

  const regions = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name)

  for (const region of regions) {
    const regionDir = path.join(CONTENT_DIR, region)
    const files = fs.readdirSync(regionDir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.mdx'))
      .map(f => f.name.replace('.mdx', ''))

    for (const condition of files) {
      results.push({ region, condition })
    }
  }

  return results
}

const CASE_LEARNER_LABELS: Record<string, string> = {
  'cervical-radiculopathy-case-01': 'Case 01 · Neck and arm symptoms',
  'early-degenerative-cervical-myelopathy-case-01': 'Case 02 · Hand clumsiness and heavy legs',
  'distal-biceps-rupture-case-01': 'Case 03 · Sudden anterior elbow pain after lifting',
  'rcrsp-case-01': 'Case 04 · Lateral shoulder pain with overhead activity',
  'adhesive-capsulitis-case-01': 'Case 05 · Progressive shoulder stiffness',
  'visceral-referral-mimicking-thoracic-msk-case-01': 'Case 06 · Thoracic pain with broader screening cues',
}

export function getCaseLearnerLabel(caseSlug: string, title?: string, region?: string): string {
  if (CASE_LEARNER_LABELS[caseSlug]) {
    return CASE_LEARNER_LABELS[caseSlug]
  }

  void title

  const caseNumber = caseSlug.match(/case-(\d+)/i)?.[1]
  const caseLabel = caseNumber ? `Case ${caseNumber.padStart(2, '0')}` : 'Guided case'
  const regionLabel = region ? region.replace(/-/g, ' ') : 'MSK'
  const fallback = `${caseLabel} - ${regionLabel} clinical reasoning case`
  return `Guided case · ${fallback}`
}

export interface CaseContent {
  content: string
  frontmatter: CaseFrontmatterSchema
  sections: Array<{ heading: string; slug: string; content: string }>
  caseSlug: string
  publicSlug: string
}

export function parseCaseDocument(raw: string, filePath: string, caseSlug: string, region: string): CaseContent {
  const { content: rawContent, data } = matter(raw)
  const frontmatter = parseCaseFrontmatter(filePath, data)
  const content = sanitizeMdxContent(rawContent)

  return {
    content,
    frontmatter,
    sections: parseSections(content),
    caseSlug,
    publicSlug: getCasePublicSlug(caseSlug, frontmatter, region),
  }
}

/**
 * Loads a guided case from content/cases/{region}/{caseSlug}.mdx
 */
export async function getCaseContent(
  region: string,
  caseSlug: string
): Promise<CaseContent | null> {
  const filePath = path.join(CONTENT_DIR, 'cases', region, `${caseSlug}.mdx`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  return parseCaseDocument(fs.readFileSync(filePath, 'utf-8'), filePath, caseSlug, region)
}

export function resolveCaseSlugFromPublicSlug(region: string, publicSlug: string): string | null {
  const casesDir = path.join(CONTENT_DIR, 'cases', region)

  if (!fs.existsSync(casesDir)) return null

  const files = fs.readdirSync(casesDir, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.mdx'))

  for (const file of files) {
    const caseSlug = file.name.replace('.mdx', '')
    const filePath = path.join(casesDir, file.name)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(raw)
    const frontmatter = parseCaseFrontmatter(filePath, data)
    const status = frontmatter.status

    if (isPrivateCaseStatus(status)) {
      continue
    }

    if (getCasePublicSlug(caseSlug, frontmatter, region) === publicSlug) {
      return caseSlug
    }
  }

  return null
}

/**
 * Returns all guided case MDX files.
 * Used by generateStaticParams.
 */
export function getAllCasePaths(): Array<{ region: string; caseSlug: string }> {
  const results: Array<{ region: string; caseSlug: string }> = []
  const casesDir = path.join(CONTENT_DIR, 'cases')

  if (!fs.existsSync(casesDir)) return results

  const regions = fs.readdirSync(casesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const region of regions) {
    const regionDir = path.join(casesDir, region)

    const files = fs.readdirSync(regionDir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.mdx'))

    for (const file of files) {
      const filePath = path.join(regionDir, file.name)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data } = matter(raw)
      const frontmatter = parseCaseFrontmatter(filePath, data)
      const status = frontmatter.status

      if (isPrivateCaseStatus(status)) {
        continue
      }

      const caseSlug = file.name.replace('.mdx', '')
      results.push({ region, caseSlug: getCasePublicSlug(caseSlug, frontmatter, region) })
    }
  }

  return results
}

export interface CaseListItem {
  region: string
  caseSlug: string
  publicSlug: string
  title: string
  condition?: string
  difficulty?: string
  caseType?: string
  status?: string
  learningFocus: string[]
  estimatedTime?: string
  lastReviewed?: string
  reviewedBy?: string
  excerpt: string
  displayTitle: string
}


/**
 * Returns all guided cases with frontmatter and excerpt.
 * Used by /cases to automatically build the case list.
 */
export function getAllCases(): CaseListItem[] {
  const results: CaseListItem[] = []
  const casesDir = path.join(CONTENT_DIR, 'cases')

  if (!fs.existsSync(casesDir)) return results

  const regions = fs.readdirSync(casesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const region of regions) {
    const regionDir = path.join(casesDir, region)

    const files = fs.readdirSync(regionDir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.mdx'))

    for (const file of files) {
      const caseSlug = file.name.replace('.mdx', '')
      const filePath = path.join(regionDir, file.name)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { content: rawContent, data } = matter(raw)
      const frontmatter = parseCaseFrontmatter(filePath, data)
      const content = sanitizeMdxContent(rawContent)

   results.push({
  region,
  caseSlug,
  title: frontmatter.title,
  displayTitle: getCaseLearnerLabel(
    caseSlug,
    frontmatter.title,
    region,
  ),
  condition: frontmatter.condition,
  difficulty: frontmatter.difficulty,
  caseType: frontmatter.caseType,
  status: frontmatter.status,
  publicSlug: getCasePublicSlug(caseSlug, frontmatter, region),
  learningFocus: frontmatter.learningFocus,
  estimatedTime: frontmatter.estimatedTime,
  lastReviewed: frontmatter.lastReviewed,
  reviewedBy: frontmatter.reviewedBy,
  excerpt: extractExcerpt(content, 180),
})
    }
  }

return results
  .filter((caseItem) => !isPrivateCaseStatus(caseItem.status ?? 'published'))
  .sort((a, b) => a.title.localeCompare(b.title))
}

function isPrivateCaseStatus(status: string): boolean {
  return ['draft', 'archived'].includes(status.toLowerCase())
}

function getCasePublicSlug(
  caseSlug: string,
  data: Pick<CaseFrontmatterSchema, 'publicSlug'>,
  region?: string,
): string {
  if (typeof data.publicSlug === 'string' && data.publicSlug.trim()) {
    return data.publicSlug.trim()
  }

  const caseNumber = caseSlug.match(/case-(\d+)/i)?.[1]
  const caseLabel = caseNumber ? `case-${caseNumber.padStart(2, '0')}` : 'case'
  const regionLabel = region ? region.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'msk'
  return `${caseLabel}-${regionLabel}-clinical-reasoning`
}
