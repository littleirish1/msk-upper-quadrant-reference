import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import {
  caseFrontmatterSchema,
  conditionFrontmatterSchema,
  type CaseFrontmatterSchema,
  type ConditionFrontmatterSchema,
} from './contentSchemas'
import {
  extractExcerpt,
  parseSections,
  sanitizeMdxContent,
  stripInternalCaseHeading,
} from './mdxParsing'
import {
  createPublicCaseSummary,
  type PublicCaseSummary,
} from './casePublication'

export {
  extractExcerpt,
  parseSections,
  sanitizeMdxContent,
  stripInternalCaseHeading,
} from './mdxParsing'

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
  const { content: rawContent, data } = parseFrontmatter(raw, filePath, 'condition')
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

interface PublicCaseRegistryEntry {
  caseId: string
  learnerCaseNumber: string
  neutralTitle: string
}

const publicCaseRegistry = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'public-case-registry.json'), 'utf8'),
) as PublicCaseRegistryEntry[]

const PUBLIC_CASES_BY_ID = new Map(
  publicCaseRegistry.map((record) => [record.caseId, record] as const),
)

export function getCaseLearnerLabel(
  caseSlug: string,
  title?: string,
  region?: string,
  guidedCaseId?: string,
): string {
  const governed = guidedCaseId ? PUBLIC_CASES_BY_ID.get(guidedCaseId) : undefined
  if (governed) {
    return `${governed.learnerCaseNumber} - ${governed.neutralTitle}`
  }

  void title

  const caseNumber = caseSlug.match(/case-(\d+)/i)?.[1]
  const caseLabel = caseNumber ? `Case ${caseNumber.padStart(2, '0')}` : 'Guided case'
  const regionLabel = region ? region.replace(/-/g, ' ') : 'MSK'
  const fallback = `${caseLabel} - ${regionLabel} clinical reasoning case`
  return `Guided case - ${fallback}`
}

export interface CaseContent {
  content: string
  frontmatter: CaseFrontmatterSchema
  sections: Array<{ heading: string; slug: string; content: string }>
  caseSlug: string
  publicSlug: string
}

export function parseCaseDocument(raw: string, filePath: string, caseSlug: string, region: string): CaseContent {
  const { content: rawContent, data } = parseFrontmatter(raw, filePath, 'guided case')
  const frontmatter = parseCaseFrontmatter(filePath, data)
  const content = stripInternalCaseHeading(sanitizeMdxContent(rawContent))

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

/**
 * Returns all guided cases with frontmatter and excerpt.
 * Used by /cases to automatically build the case list.
 */
export function getAllCases(): PublicCaseSummary[] {
  const results: PublicCaseSummary[] = []
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
      if (frontmatter.status !== 'published') continue

      const content = stripInternalCaseHeading(sanitizeMdxContent(rawContent))
      results.push(createPublicCaseSummary({
        region,
        displayTitle: getCaseLearnerLabel(
          caseSlug,
          frontmatter.title,
          region,
          frontmatter.guidedCaseId,
        ),
        difficulty: frontmatter.difficulty,
        estimatedTime: frontmatter.estimatedTime,
        publicSlug: getCasePublicSlug(caseSlug, frontmatter, region),
        excerpt: extractExcerpt(content, 180),
      }))
    }
  }

  return results.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle))
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

function parseFrontmatter(
  raw: string,
  filePath: string,
  label: string,
): matter.GrayMatterFile<string> {
  try {
    return matter(raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid ${label} frontmatter in ${relativeContentPath(filePath)}: ${detail}`)
  }
}
