import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'out',
])

const IGNORE_FILES = new Set([
  'scripts/check-secrets.mjs',
])

const TEXT_EXTENSIONS = new Set([
  '',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

const MAX_FILE_BYTES = 2 * 1024 * 1024

const rules = [
  {
    label: 'Google API key',
    pattern: /AIza[0-9A-Za-z_-]{20,}/g,
  },
  {
    label: 'OpenAI-style secret key',
    pattern: /\bsk-[0-9A-Za-z_-]{20,}/g,
  },
  {
    label: 'OpenAI API key environment token',
    pattern: /OPENAI_API_KEY/g,
  },
  {
    label: 'generic API key token',
    pattern: /API_KEY/g,
  },
  {
    label: 'private key token',
    pattern: /PRIVATE_KEY/g,
  },
  {
    label: 'generic secret token',
    pattern: /SECRET/g,
  },
]

const findings = []

walk(ROOT)

if (findings.length > 0) {
  console.error('\nSecret scan failed.\n')
  console.error('Potential secrets or forbidden secret tokens were found:\n')

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}`)
    console.error(`  ${finding.label}: ${finding.preview}`)
  }

  console.error('\nRemove real secrets and avoid committing placeholder secret variable names.\n')
  process.exit(1)
}

console.log('Secret scan passed. No forbidden secret patterns found.')

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = toPosix(path.relative(ROOT, fullPath))

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(fullPath)
      }
      continue
    }

    if (!entry.isFile()) continue
    if (IGNORE_FILES.has(relativePath)) continue
    if (!shouldScanFile(fullPath, entry.name)) continue

    const stat = fs.statSync(fullPath)
    if (stat.size > MAX_FILE_BYTES) continue

    let text
    try {
      text = fs.readFileSync(fullPath, 'utf8')
    } catch {
      continue
    }

    const lines = text.split(/\r?\n/)
    lines.forEach((line, index) => {
      for (const rule of rules) {
        rule.pattern.lastIndex = 0
        if (rule.pattern.test(line)) {
          findings.push({
            file: relativePath,
            line: index + 1,
            label: rule.label,
            preview: line.trim().slice(0, 160),
          })
        }
      }
    })
  }
}

function shouldScanFile(fullPath, fileName) {
  if (fileName.startsWith('.env')) return true
  return TEXT_EXTENSIONS.has(path.extname(fullPath).toLowerCase())
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
