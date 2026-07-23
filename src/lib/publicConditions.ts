import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getAllConditionPaths } from '../data/taxonomy'
import {
  conditionFrontmatterSchema,
  type ConditionFrontmatterSchema,
} from './contentSchemas'
import {
  parseConditionDocument,
  type ConditionContent,
} from './mdx'

const CONTENT_DIR = path.join(process.cwd(), 'content')
const NON_PUBLIC_STATUSES = new Set(['draft', 'private', 'planned', 'deprecated', 'archived'])
const NON_PUBLIC_REVIEW_STATUSES = new Set(['needs-review', 'clinician-review-required'])

export interface ConditionCandidate {
  region: string
  condition: string
  frontmatter: ConditionFrontmatterSchema | null
}

export interface PublicConditionRecord {
  region: string
  condition: string
  frontmatter: ConditionFrontmatterSchema
  filePath: string
}

export interface PublicConditionSelection {
  eligible: ConditionCandidate[]
  mismatches: string[]
}

export function isPublicConditionFrontmatter(frontmatter: ConditionFrontmatterSchema): boolean {
  if (frontmatter.publicEligibility === false) return false
  if (frontmatter.status && NON_PUBLIC_STATUSES.has(frontmatter.status)) return false
  if (frontmatter.clinicianReviewStatus && NON_PUBLIC_REVIEW_STATUSES.has(frontmatter.clinicianReviewStatus)) {
    return false
  }
  return true
}

export function selectPublicConditionCandidates(
  taxonomyPaths: Array<{ region: string; condition: string }>,
  contentCandidates: ConditionCandidate[],
): PublicConditionSelection {
  const byKey = new Map(contentCandidates.map((candidate) => [key(candidate.region, candidate.condition), candidate]))
  const taxonomyKeys = new Set(taxonomyPaths.map((item) => key(item.region, item.condition)))
  const eligible: ConditionCandidate[] = []
  const mismatches: string[] = []

  for (const taxonomyPath of taxonomyPaths) {
    const candidate = byKey.get(key(taxonomyPath.region, taxonomyPath.condition))
    if (!candidate?.frontmatter) {
      mismatches.push(`taxonomy condition is missing content: ${taxonomyPath.region}/${taxonomyPath.condition}`)
      continue
    }
    if (!isPublicConditionFrontmatter(candidate.frontmatter)) {
      mismatches.push(`taxonomy condition is not public eligible: ${taxonomyPath.region}/${taxonomyPath.condition}`)
      continue
    }
    eligible.push(candidate)
  }

  for (const candidate of contentCandidates) {
    if (
      candidate.frontmatter
      && isPublicConditionFrontmatter(candidate.frontmatter)
      && !taxonomyKeys.has(key(candidate.region, candidate.condition))
    ) {
      mismatches.push(`public-eligible condition is absent from taxonomy: ${candidate.region}/${candidate.condition}`)
    }
  }

  return {
    eligible: eligible.sort(compareCandidates),
    mismatches: mismatches.sort(),
  }
}

export function getPublicConditionRecords(): PublicConditionRecord[] {
  const taxonomyPaths = getAllConditionPaths()
  const liveRegions = new Set(taxonomyPaths.map((item) => item.region))
  const contentCandidates = collectConditionCandidates(liveRegions)
  const selection = selectPublicConditionCandidates(taxonomyPaths, contentCandidates)
  if (selection.mismatches.length > 0) {
    throw new Error([
      'Condition taxonomy and public content are out of sync.',
      ...selection.mismatches.map((mismatch) => `- ${mismatch}`),
    ].join('\n'))
  }

  return selection.eligible.map((candidate) => ({
    region: candidate.region,
    condition: candidate.condition,
    frontmatter: candidate.frontmatter as ConditionFrontmatterSchema,
    filePath: conditionFile(candidate.region, candidate.condition),
  }))
}

export function getAllPublicConditionPaths(): Array<{ region: string; condition: string }> {
  return getPublicConditionRecords().map(({ region, condition }) => ({ region, condition }))
}

export function getPublicConditionsForRegion(region: string): PublicConditionRecord[] {
  return getPublicConditionRecords().filter((record) => record.region === region)
}

export function getPublicConditionRecord(region: string, condition: string): PublicConditionRecord | null {
  return getPublicConditionRecords().find((record) =>
    record.region === region && record.condition === condition,
  ) ?? null
}

export function getPublicConditionContent(region: string, condition: string): ConditionContent | null {
  const record = getPublicConditionRecord(region, condition)
  if (!record) return null
  return parseConditionDocument(fs.readFileSync(record.filePath, 'utf8'), record.filePath)
}

function collectConditionCandidates(liveRegions: Set<string>): ConditionCandidate[] {
  const candidates: ConditionCandidate[] = []
  for (const region of [...liveRegions].sort()) {
    const regionDir = path.join(CONTENT_DIR, region)
    if (!fs.existsSync(regionDir)) continue
    for (const entry of fs.readdirSync(regionDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue
      const filePath = path.join(regionDir, entry.name)
      const condition = entry.name.slice(0, -4)
      const { data } = matter(fs.readFileSync(filePath, 'utf8'))
      const result = conditionFrontmatterSchema.safeParse(data)
      if (!result.success) {
        const issues = result.error.issues
          .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
          .join('; ')
        throw new Error(`Invalid condition frontmatter in ${relative(filePath)}: ${issues}`)
      }
      candidates.push({ region, condition, frontmatter: result.data })
    }
  }
  return candidates
}

function conditionFile(region: string, condition: string): string {
  return path.join(CONTENT_DIR, region, `${condition}.mdx`)
}

function key(region: string, condition: string): string {
  return `${region}/${condition}`
}

function compareCandidates(left: ConditionCandidate, right: ConditionCandidate): number {
  return left.region.localeCompare(right.region) || left.condition.localeCompare(right.condition)
}

function relative(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join('/')
}
