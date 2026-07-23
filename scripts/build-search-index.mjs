/**
 * Generates public/search-index.json from the authoritative public condition
 * selector. Guided cases and private/admin content are intentionally excluded.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const PUBLIC_DIR = path.join(ROOT, 'public')
const OUT_FILE = path.join(PUBLIC_DIR, 'search-index.json')

export function stripMdxForSearch(text) {
  return stripMdxExpressions(stripFencedCode(stripMdxModuleDeclarations(text)))
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*`[\]|()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractSearchHeadings(text) {
  const lines = stripMdxModuleDeclarations(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const headings = []
  let fence = null

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      else if (fence === null) fence = marker
      continue
    }
    if (fence !== null) continue

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
    if (!heading) continue
    const value = stripMdxForSearch(heading[1])
    if (value) headings.push(value)
  }

  return [...new Set(headings)]
}

export async function buildSearchIndex() {
  if (!fs.existsSync(CONTENT_DIR)) {
    throw new Error('No content/ directory found; a public search index cannot be generated.')
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  const conditions = await loadTypeScriptTree(
    path.join(ROOT, 'src', 'lib', 'publicConditions.ts'),
    path.join(ROOT, 'src'),
  )
  const taxonomy = await loadTypeScriptTree(
    path.join(ROOT, 'src', 'data', 'taxonomy.ts'),
    path.join(ROOT, 'src'),
  )
  const entries = conditions.getPublicConditionRecords().map((record) => {
    const { content } = matter(fs.readFileSync(record.filePath, 'utf8'))
    const taxonomyCondition = taxonomy.getCondition(record.region, record.condition)
    const taxonomyRegion = taxonomy.getRegion(record.region)
    const plainContent = stripMdxForSearch(content)
    return {
      id: `${record.region}/${record.condition}`,
      title: record.frontmatter.title || slugToLabel(record.condition),
      aliases: unique(taxonomyCondition?.aliases ?? []),
      region: record.region,
      regionLabel: taxonomyRegion?.label ?? slugToLabel(record.region),
      category: 'condition',
      condition: record.condition,
      section: '',
      keywords: unique([
        ...(record.frontmatter.tags ?? []),
        ...(taxonomyCondition?.tags ?? []),
      ]),
      summary: plainContent.slice(0, 300),
      headings: extractSearchHeadings(content),
      content: plainContent,
      href: `/${record.region}/${record.condition}`,
      status: 'published',
      publicEligibility: true,
    }
  }).sort((left, right) => left.id.localeCompare(right.id))

  fs.writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2))
  console.log(`Search index built: ${entries.length} entries -> ${OUT_FILE}`)
}

function stripMdxModuleDeclarations(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const output = []
  let moduleKind = null
  let braceDepth = 0

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (!moduleKind && /^(?:import|export)\b/.test(trimmed)) {
      moduleKind = trimmed.startsWith('import') ? 'import' : 'export'
      braceDepth = braceDelta(line)
      if (moduleDeclarationComplete(moduleKind, line, braceDepth)) moduleKind = null
      continue
    }
    if (moduleKind) {
      braceDepth += braceDelta(line)
      if (moduleDeclarationComplete(moduleKind, line, braceDepth)) moduleKind = null
      continue
    }
    output.push(line)
  }
  return output.join('\n')
}

function moduleDeclarationComplete(kind, line, braceDepth) {
  if (braceDepth > 0) return false
  if (kind === 'import') {
    return /\bfrom\s+['"][^'"]+['"]\s*;?\s*$/.test(line)
      || /^\s*import\s+['"][^'"]+['"]\s*;?\s*$/.test(line)
  }
  return true
}

function braceDelta(line) {
  let depth = 0
  let quote = null
  let escaped = false
  for (const character of line) {
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
  }
  return depth
}

function stripFencedCode(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const output = []
  let fence = null
  for (const line of lines) {
    const match = line.match(/^\s*(`{3,}|~{3,})/)
    if (match) {
      const marker = match[1]
      if (fence && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      else if (fence === null) fence = marker
      continue
    }
    if (fence === null) output.push(line)
  }
  return output.join('\n')
}

function stripMdxExpressions(text) {
  let output = ''
  let depth = 0
  let quote = null
  let escaped = false
  for (const character of text) {
    if (depth === 0) {
      if (character === '{') {
        depth = 1
        continue
      }
      output += character
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
  }
  return output
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function slugToLabel(slug) {
  return slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await buildSearchIndex()
}
