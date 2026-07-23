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
  return stripMdxModuleDeclarations(text)
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*`[\]|()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
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
  const entries = conditions.getPublicConditionRecords().map((record) => {
    const { content } = matter(fs.readFileSync(record.filePath, 'utf8'))
    return {
      id: `${record.region}/${record.condition}`,
      title: record.frontmatter.title || slugToLabel(record.condition),
      region: record.region,
      condition: record.condition,
      section: '',
      content: stripMdxForSearch(content),
      href: `/${record.region}/${record.condition}`,
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

function slugToLabel(slug) {
  return slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await buildSearchIndex()
}
