import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectHygieneScope } from './lib/hygieneScope.mjs'

const ROOT = process.cwd()

const IGNORE_FILES = new Set([
  'ai-manager/content-hygiene-names.json',
  'ai-manager/guided-case-rules.md',
])

const SOURCE_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
])

const PUBLIC_TEXT_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  '.css',
  '.html',
  '.toml',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
])

export function scanContentHygiene(root = ROOT) {
  const configFile = path.join(root, 'ai-manager', 'content-hygiene-names.json')

  if (!fs.existsSync(configFile)) {
    throw new Error(`Missing hygiene config: ${configFile}`)
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
  const termsToFlag = Array.isArray(config.termsToFlag)
    ? config.termsToFlag.filter((term) => typeof term === 'string' && term.trim().length > 0)
    : []

  if (termsToFlag.length === 0) {
    throw new Error('No hygiene terms found in ai-manager/content-hygiene-names.json')
  }

  const scope = collectHygieneScope(root)
  const findings = []

  for (const item of scope.files) {
    if (IGNORE_FILES.has(item.relativePath)) continue

    if (!shouldScanFile(item)) continue

    const text = fs.readFileSync(item.fullPath, 'utf8')
    const lines = text.split(/\r?\n/)

    lines.forEach((line, index) => {
      for (const term of termsToFlag) {
        if (line.toLowerCase().includes(term.toLowerCase())) {
          findings.push({
            file: item.relativePath,
            line: index + 1,
            term,
            text: line.trim(),
            categories: [...item.categories].sort(),
          })
        }
      }
    })
  }

  return { findings, scope }
}

function shouldScanFile(item) {
  const ext = path.extname(item.relativePath)
  if (SOURCE_EXTENSIONS.has(ext)) return true
  if (item.categories.has('public-source') || item.categories.has('generated-public')) {
    return PUBLIC_TEXT_EXTENSIONS.has(ext)
  }
  return false
}

function run() {
  let result
  try {
    result = scanContentHygiene(ROOT)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }

  if (result.findings.length > 0) {
    console.error('\nContent hygiene check failed.\n')
    console.error('Flagged names were found in the project:\n')

    for (const finding of result.findings) {
      console.error(`${finding.file}:${finding.line}`)
      console.error(`  ${finding.term}: ${finding.text}`)
    }

    console.error('\nRemove or replace these names before committing final learner-facing content.\n')
    process.exit(1)
  }

  console.log('Content hygiene check passed. No flagged names found.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
}
