import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content')
const CASES_DIR_PARTS = ['content', 'cases']

const groups = {
  conditions: new Map(),
  cases: new Map(),
  templates: new Map(),
}

for (const file of walk(CONTENT_DIR)) {
  if (!file.endsWith('.mdx')) continue

  const relativePath = toPosix(path.relative(ROOT, file))
  const group = isTemplatePath(relativePath) ? 'templates' : isCasePath(relativePath) ? 'cases' : 'conditions'
  const { data } = matter(fs.readFileSync(file, 'utf8'))

  for (const [key, value] of Object.entries(data)) {
    const existing = groups[group].get(key) ?? {
      count: 0,
      types: new Set(),
      examples: [],
    }

    existing.count += 1
    existing.types.add(getValueType(value))

    if (existing.examples.length < 3) {
      existing.examples.push({ file: relativePath, value: summarizeValue(value) })
    }

    groups[group].set(key, existing)
  }
}

printGroup('Condition frontmatter fields', groups.conditions)
printGroup('Case frontmatter fields', groups.cases)
printGroup('Template frontmatter fields', groups.templates)

function walk(dir) {
  if (!fs.existsSync(dir)) return []

  const files = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

function printGroup(label, fields) {
  console.log(`\n${label}`)
  console.log('-'.repeat(label.length))

  for (const [key, item] of [...fields.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${key}: count=${item.count}; types=${[...item.types].sort().join('|')}`)

    for (const example of item.examples) {
      console.log(`  - ${example.file}: ${example.value}`)
    }
  }
}

function isCasePath(relativePath) {
  const parts = relativePath.split('/')
  return CASES_DIR_PARTS.every((part, index) => parts[index] === part)
}

function isTemplatePath(relativePath) {
  return relativePath.startsWith('content/_TEMPLATE/')
}

function getValueType(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function summarizeValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return JSON.stringify(value)
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
