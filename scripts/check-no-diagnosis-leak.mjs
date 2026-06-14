import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const TAXONOMY_FILE = path.join(ROOT, 'src', 'data', 'taxonomy.ts')

const findings = []
const conditionLabels = readConditionLabels()
const cases = readCases()

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build before npm run check:no-leak.')
}

for (const item of cases) {
  const publicRouteFile = path.join(OUT_DIR, 'cases', item.region, item.publicSlug, 'index.html')
  const internalRouteFile = path.join(OUT_DIR, 'cases', item.region, item.caseSlug, 'index.html')

  if (isPrivateStatus(item.status)) {
    if (fs.existsSync(publicRouteFile) || fs.existsSync(internalRouteFile)) {
      fail(`Private case route was generated: /cases/${item.region}/${item.publicSlug}`)
    }
    continue
  }

  if (!fs.existsSync(publicRouteFile)) {
    fail(`Published case route missing: /cases/${item.region}/${item.publicSlug}`)
    continue
  }

  if (item.publicSlug.includes(' ')) {
    fail(`Public case route contains a space: /cases/${item.region}/${item.publicSlug}`)
  }

  if (fs.existsSync(internalRouteFile) && item.publicSlug !== item.caseSlug) {
    fail(`Internal diagnostic case route was generated: /cases/${item.region}/${item.caseSlug}`)
  }

  const routeTerms = uniqueTerms([
    item.caseSlug,
    item.condition,
  ])

  for (const term of routeTerms) {
    if (containsTerm(item.publicSlug, term)) {
      fail(`Public case slug leaks diagnostic term "${term}": /cases/${item.region}/${item.publicSlug}`)
    }
  }

  const html = fs.readFileSync(publicRouteFile, 'utf8')
  const preRevealHtml = getPreRevealHtml(html)
  const label = item.condition ? conditionLabels.get(item.condition) : ''
  const preRevealTerms = uniqueTerms([
    item.condition,
    label,
  ]).filter((term) => term.length >= 4)

  for (const term of preRevealTerms) {
    if (containsTerm(preRevealHtml, term)) {
      fail(`Pre-reveal case HTML leaks "${term}" for /cases/${item.region}/${item.publicSlug}`)
    }
  }
}

if (findings.length > 0) {
  console.error('\nDiagnosis no-leak check failed.\n')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Diagnosis no-leak check passed.')
console.log(`Published case routes checked: ${cases.filter((item) => !isPrivateStatus(item.status)).length}`)
console.log(`Private case routes excluded: ${cases.filter((item) => isPrivateStatus(item.status)).length}`)

function readCases() {
  if (!fs.existsSync(CASES_DIR)) return []

  return walk(CASES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const raw = fs.readFileSync(file, 'utf8')
      const { data } = matter(raw)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const status = typeof data.status === 'string' ? data.status : 'published'
      const publicSlug = typeof data.publicSlug === 'string' && data.publicSlug.trim()
        ? data.publicSlug.trim()
        : fallbackPublicSlug(caseSlug, region)

      return {
        region,
        caseSlug,
        publicSlug,
        condition: typeof data.condition === 'string' ? data.condition : '',
        status,
      }
    })
}

function readConditionLabels() {
  const labels = new Map()
  if (!fs.existsSync(TAXONOMY_FILE)) return labels

  const text = fs.readFileSync(TAXONOMY_FILE, 'utf8')
  const conditionPattern = /\{\s*slug:\s*['"]([^'"]+)['"],\s*label:\s*['"]([^'"]+)['"]/g
  let match
  while ((match = conditionPattern.exec(text)) !== null) {
    labels.set(match[1], match[2])
  }

  return labels
}

function walk(dir) {
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

function getPreRevealHtml(html) {
  const markers = [
    'Reveal likely diagnosis / linked condition',
    'Reveal likely concern / linked condition',
    'Likely diagnosis / linked condition',
    'Likely concern / linked condition',
  ]
  const indexes = markers
    .map((marker) => html.indexOf(marker))
    .filter((index) => index >= 0)

  if (indexes.length === 0) {
    return html
  }

  return html.slice(0, Math.min(...indexes))
}

function containsTerm(text, term) {
  if (!term) return false
  return normalize(text).includes(normalize(term))
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueTerms(terms) {
  return [...new Set(terms.map((term) => String(term || '').trim()).filter(Boolean))]
}

function fallbackPublicSlug(caseSlug, region) {
  const caseNumber = caseSlug.match(/case-(\d+)/i)?.[1]
  const caseLabel = caseNumber ? `case-${caseNumber.padStart(2, '0')}` : 'case'
  return `${caseLabel}-${region}-clinical-reasoning`
}

function isPrivateStatus(status) {
  return ['draft', 'archived'].includes(String(status).toLowerCase())
}

function fail(message) {
  findings.push(message)
}
