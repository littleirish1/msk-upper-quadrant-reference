import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

const CONFIG_FILE = path.join(ROOT, 'ai-manager', 'content-hygiene-names.json')

const SEARCH_DIRS = [
  'content',
  'ai-manager',
]

const IGNORE_FILES = new Set([
  'ai-manager/content-hygiene-names.json',
  'ai-manager/guided-case-rules.md',
])

const EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
])

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`Missing hygiene config: ${CONFIG_FILE}`)
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))

const TERMS_TO_FLAG = Array.isArray(config.termsToFlag)
  ? config.termsToFlag.filter((term) => typeof term === 'string' && term.trim().length > 0)
  : []

if (TERMS_TO_FLAG.length === 0) {
  console.error('No hygiene terms found in ai-manager/content-hygiene-names.json')
  process.exit(1)
}

const findings = []

for (const dir of SEARCH_DIRS) {
  const fullDir = path.join(ROOT, dir)
  if (fs.existsSync(fullDir)) {
    walk(fullDir)
  }
}

if (findings.length > 0) {
  console.error('\nContent hygiene check failed.\n')
  console.error('Flagged names were found in the project:\n')

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}`)
    console.error(`  ${finding.term}: ${finding.text}`)
  }

  console.error('\nRemove or replace these names before committing final learner-facing content.\n')
  process.exit(1)
}

console.log('Content hygiene check passed. No flagged names found.')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath)
      continue
    }

    if (!entry.isFile()) continue

    const relativePath = toPosix(path.relative(ROOT, fullPath))

    if (IGNORE_FILES.has(relativePath)) continue

    const ext = path.extname(entry.name)
    if (!EXTENSIONS.has(ext)) continue

    const text = fs.readFileSync(fullPath, 'utf8')
    const lines = text.split(/\r?\n/)

    lines.forEach((line, index) => {
      for (const term of TERMS_TO_FLAG) {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          findings.push({
            file: relativePath,
            line: index + 1,
            term,
            text: line.trim(),
          })
        }
      }
    })
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
