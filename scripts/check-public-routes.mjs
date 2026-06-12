import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_DIR = path.join(ROOT, 'content', 'cases')

const requiredRoutes = [
  ['/', path.join(OUT_DIR, 'index.html')],
  ['/cases', path.join(OUT_DIR, 'cases', 'index.html')],
  ['/demo', path.join(OUT_DIR, 'demo', 'index.html')],
  ['/future', path.join(OUT_DIR, 'future', 'index.html')],
  ['/red-flags', path.join(OUT_DIR, 'red-flags', 'index.html')],
  ['/search', path.join(OUT_DIR, 'search', 'index.html')],
]

const requiredAnchors = [
  {
    route: '/cervical/cervical-radiculopathy',
    file: path.join(OUT_DIR, 'cervical', 'cervical-radiculopathy', 'index.html'),
    ids: ['overview--pathophysiology', 'special-tests', 'management--treatment'],
  },
]

const findings = []

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build or npm run preflight first.')
}

for (const [route, file] of requiredRoutes) {
  if (!fs.existsSync(file)) {
    fail(`Missing required public route ${route}: ${toPosix(path.relative(ROOT, file))}`)
  }
}

if (fs.existsSync(path.join(OUT_DIR, 'ai-manager'))) {
  fail('Public export includes out/ai-manager, but Case Manager must remain local-only.')
}

const cases = readCases()

for (const item of cases) {
  const routeFile = path.join(OUT_DIR, 'cases', item.region, item.caseSlug, 'index.html')

  if (isPrivateStatus(item.status)) {
    if (fs.existsSync(routeFile)) {
      fail(`Private case route was generated: ${item.route}`)
    }
    continue
  }

  if (!fs.existsSync(routeFile)) {
    fail(`Published case route missing: ${item.route}`)
  }
}

for (const anchorCheck of requiredAnchors) {
  if (!fs.existsSync(anchorCheck.file)) {
    fail(`Missing route for anchor check ${anchorCheck.route}`)
    continue
  }

  const html = fs.readFileSync(anchorCheck.file, 'utf8')
  for (const id of anchorCheck.ids) {
    if (!html.includes(`id="${id}"`)) {
      fail(`Missing section anchor ${anchorCheck.route}#${id}`)
    }
  }
}

if (findings.length > 0) {
  console.error('\nPublic route smoke check failed.\n')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Public route smoke check passed.')
console.log(`Published case routes: ${cases.filter((item) => !isPrivateStatus(item.status)).length}`)
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

      return {
        region,
        caseSlug,
        status,
        route: `/cases/${region}/${caseSlug}`,
      }
    })
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

function isPrivateStatus(status) {
  return ['draft', 'archived'].includes(String(status).toLowerCase())
}

function fail(message) {
  findings.push(message)
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
