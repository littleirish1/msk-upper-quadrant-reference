import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { ConditionFrontmatter } from '@/types'

const CONTENT_DIR = path.join(process.cwd(), 'content')

export interface ConditionContent {
  content: string
  frontmatter: Partial<ConditionFrontmatter>
  sections: Array<{ heading: string; slug: string; content: string }>
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

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { content: rawContent, data } = matter(raw)

  // Sanitize content for MDX parsing:
  // Replace bare < and > that aren't MDX/HTML tags to avoid parser errors
  // e.g. "<45 years", ">90%", "p<0.05" in medical text
  const content = sanitizeMdxContent(rawContent)

  const sections = parseSections(content)

  return {
    content,
    frontmatter: data as Partial<ConditionFrontmatter>,
    sections,
  }
}

/**
 * Sanitize MDX content to prevent parse errors from medical notation.
 * Escapes bare < and > that appear before digits or in mathematical contexts.
 */
function sanitizeMdxContent(content: string): string {
  // Replace < and > that appear before/after digits or mathematical notation
  // but NOT HTML/JSX tags (which are wrapped in <Component> patterns)
  return content
    // <digit or <space+digit => &lt;digit (e.g. <45 years, < 60°)
    .replace(/<(\d)/g, '&lt;$1')
    .replace(/<(\s+\d)/g, '&lt;$1')
    // >digit patterns (e.g. >90%, > 2 weeks)
    .replace(/>(\d)/g, '&gt;$1')
    .replace(/>(\s+\d)/g, '&gt;$1')
    // p-values: p<0.05, p>0.01
    .replace(/([pP])\s*<\s*(\d)/g, '$1 &lt; $2')
    .replace(/([pP])\s*>\s*(\d)/g, '$1 &gt; $2')
}

/**
 * Split MDX content on ## headings into named sections.
 */
function parseSections(content: string): Array<{ heading: string; slug: string; content: string }> {
  // Split on lines that start with exactly "## " (H2)
  const lines = content.split('\n')
  const sections: Array<{ heading: string; slug: string; content: string }> = []

  let currentHeading = ''
  let currentSlug = ''
  let currentLines: string[] = []
  let inSection = false

  for (const line of lines) {
    if (line.match(/^## /)) {
      if (inSection) {
        sections.push({
          heading: currentHeading,
          slug: currentSlug,
          content: currentLines.join('\n').trim(),
        })
      }
      currentHeading = line.replace(/^## /, '').trim()
      currentSlug = slugify(currentHeading)
      currentLines = []
      inSection = true
    } else if (inSection) {
      currentLines.push(line)
    }
  }

  if (inSection && currentHeading) {
    sections.push({
      heading: currentHeading,
      slug: currentSlug,
      content: currentLines.join('\n').trim(),
    })
  }

  return sections
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
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

/**
 * Build a plain-text excerpt from MDX content (strips JSX/markdown syntax).
 */
export function extractExcerpt(mdx: string, maxLength = 200): string {
  return mdx
    .replace(/---[\s\S]*?---/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[#*`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
export interface CaseContent {
  content: string
  frontmatter: {
    title?: string
    region?: string
    condition?: string
    difficulty?: string
    [key: string]: unknown
  }
  sections: Array<{ heading: string; slug: string; content: string }>
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

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { content: rawContent, data } = matter(raw)

  const content = sanitizeMdxContent(rawContent)
  const sections = parseSections(content)

  return {
    content,
    frontmatter: data,
    sections,
  }
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
      .map(f => f.name.replace('.mdx', ''))

    for (const caseSlug of files) {
      results.push({ region, caseSlug })
    }
  }

  return results
}

export interface CaseListItem {
  region: string
  caseSlug: string
  title: string
  condition?: string
  difficulty?: string
  excerpt: string
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
      const content = sanitizeMdxContent(rawContent)

      results.push({
        region,
        caseSlug,
        title: typeof data.title === 'string' ? data.title : caseSlug,
        condition: typeof data.condition === 'string' ? data.condition : undefined,
        difficulty: typeof data.difficulty === 'string' ? data.difficulty : undefined,
        excerpt: extractExcerpt(content, 180),
      })
    }
  }

  return results.sort((a, b) => a.title.localeCompare(b.title))
}
