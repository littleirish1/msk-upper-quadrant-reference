import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const LEGACY_SOURCE_TYPE = 'legacy-html-case-bank'
const DRAFT_MARKER = 'Draft generated from legacy station'

const findings = []
const legacyCasesBySourceId = new Map()

if (!fs.existsSync(CASES_DIR)) {
  console.error(`Missing cases directory: ${path.relative(ROOT, CASES_DIR)}`)
  process.exit(1)
}

for (const file of walk(CASES_DIR)) {
  const relativePath = toPosix(path.relative(ROOT, file))
  const text = fs.readFileSync(file, 'utf8')
  const parsed = parseMdxFrontmatter(text)

  if (!parsed.frontmatter) {
    continue
  }

  const sourceType = parsed.frontmatter.sourceType

  if (sourceType !== LEGACY_SOURCE_TYPE) {
    continue
  }

  const sourceId = parsed.frontmatter.sourceId
  const sourcePath = parsed.frontmatter.sourcePath
  const reviewStatus = parsed.frontmatter.reviewStatus
  const status = parsed.frontmatter.status

  requireField(relativePath, 'sourceId', sourceId)
  requireField(relativePath, 'sourcePath', sourcePath)
  requireField(relativePath, 'reviewStatus', reviewStatus)

  if (sourceId) {
    const existing = legacyCasesBySourceId.get(sourceId) ?? []
    existing.push(relativePath)
    legacyCasesBySourceId.set(sourceId, existing)
  }

  if (sourcePath) {
    const fullSourcePath = path.join(ROOT, sourcePath)

    if (!fs.existsSync(fullSourcePath)) {
      addFinding(relativePath, `sourcePath does not exist: ${sourcePath}`)
    }

    const sourceFilename = path.basename(sourcePath)
    const sourcePrefix = sourceFilename.match(/^(s\d+)-/i)?.[1]

    if (sourceId && sourcePrefix && sourcePrefix !== sourceId) {
      addFinding(
        relativePath,
        `sourceId "${sourceId}" does not match sourcePath filename prefix "${sourcePrefix}"`,
      )
    }
  }

  if (status === 'published') {
    if (reviewStatus !== 'reviewed') {
      addFinding(relativePath, 'published legacy-derived cases require reviewStatus: "reviewed"')
    }

    if (parsed.body.includes('TODO')) {
      addFinding(relativePath, 'published legacy-derived case body contains TODO')
    }

    if (parsed.body.includes(DRAFT_MARKER)) {
      addFinding(relativePath, `published legacy-derived case body contains "${DRAFT_MARKER}"`)
    }
  }
}

for (const [sourceId, files] of legacyCasesBySourceId.entries()) {
  if (files.length <= 1) {
    continue
  }

  addFinding(
    files.join(', '),
    `duplicate legacy sourceId "${sourceId}" is used by ${files.length} cases`,
  )
}

if (findings.length > 0) {
  console.error('\nCase source integrity check failed.\n')

  for (const finding of findings) {
    console.error(`${finding.file}`)
    console.error(`  ${finding.message}`)
  }

  console.error('\nFix source metadata or move unfinished legacy-derived cases out of published status.\n')
  process.exit(1)
}

console.log('Case source integrity check passed.')

function walk(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(fullPath)
    }
  }

  return files
}

function parseMdxFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '')

  if (!normalized.startsWith('---')) {
    return {
      frontmatter: null,
      body: normalized,
    }
  }

  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return {
      frontmatter: null,
      body: normalized,
    }
  }

  return {
    frontmatter: parseFlatYaml(match[1]),
    body: match[2],
  }
}

function parseFlatYaml(yaml) {
  const data = {}
  const lines = yaml.split(/\r?\n/)

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)

    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    data[key] = rawValue.replace(/^["']|["']$/g, '')
  }

  return data
}

function requireField(file, field, value) {
  if (!value) {
    addFinding(file, `missing required field: ${field}`)
  }
}

function addFinding(file, message) {
  findings.push({ file, message })
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
