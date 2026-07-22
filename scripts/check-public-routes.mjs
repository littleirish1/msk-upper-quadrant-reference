import fs from 'fs'
import path from 'path'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  getPlannedTaxonomyRegions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const BASE_PATH = '/msk-upper-quadrant-reference'

const requiredRoutes = [
  ['/', path.join(OUT_DIR, 'index.html')],
  ['/cases', path.join(OUT_DIR, 'cases', 'index.html')],
  ['/anatomy', path.join(OUT_DIR, 'anatomy', 'index.html')],
  ['/anatomy/peripheral-nerve', path.join(OUT_DIR, 'anatomy', 'peripheral-nerve', 'index.html')],
  ['/learning', path.join(OUT_DIR, 'learning', 'index.html')],
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
const conditions = await readConditions()
const plannedRegions = await getPlannedTaxonomyRegions()
const conditionsByKey = new Map(conditions.map((condition) => [conditionKey(condition.region, condition.slug), condition]))

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

const publicAnatomyDetailPages = collectIndexFiles(path.join(OUT_DIR, 'anatomy'))
  .filter((file) => path.relative(path.join(OUT_DIR, 'anatomy'), file).split(path.sep).length === 3)
if (publicAnatomyDetailPages.length > 0) {
  fail('Unreviewed anatomy detail routes were generated.')
}

for (const region of plannedRegions) {
  const routeFile = path.join(OUT_DIR, region.slug, 'index.html')
  if (fs.existsSync(routeFile)) {
    fail(`Planned region was generated as a public route: /${region.slug}`)
  }
}

const cases = await readCases()
const publishedCases = cases.filter((item) => !isPrivateStatus(item.status))
const privateCases = cases.filter((item) => isPrivateStatus(item.status))

for (const item of cases) {
  const publicRouteFile = path.join(OUT_DIR, 'cases', item.region, item.publicSlug, 'index.html')
  const internalRouteFile = path.join(OUT_DIR, 'cases', item.region, item.caseSlug, 'index.html')

  if (isPrivateStatus(item.status)) {
    if (fs.existsSync(publicRouteFile) || fs.existsSync(internalRouteFile)) {
      fail(`Private case route was generated: ${item.route}`)
    }
    continue
  }

  if (!fs.existsSync(publicRouteFile)) {
    fail(`Published case route missing: ${item.route}`)
  }

  if (fs.existsSync(internalRouteFile) && item.publicSlug !== item.caseSlug) {
    fail(`Diagnostic internal case route was generated: /cases/${item.region}/${item.caseSlug}`)
  }
}

checkCaseDiscoveryPage(cases)

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
console.log(`Published case routes: ${publishedCases.length}`)
console.log(`Published cases discoverable from /cases: ${publishedCases.length}`)
console.log(`Private case routes excluded: ${privateCases.length}`)

async function readCases() {
  if (!fs.existsSync(CASES_DIR)) return []

  const files = collectCaseFiles()

  if (files.length === 0) {
    fail('No guided case MDX files found.')
    return []
  }

  const cases = []
  for (const file of files) {
    try {
      const { data } = await readCaseFrontmatter(file)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const publicSlug = typeof data.publicSlug === 'string' && data.publicSlug.trim()
        ? data.publicSlug.trim()
        : caseSlug

      cases.push({
        region,
        caseSlug,
        publicSlug,
        condition: typeof data.condition === 'string' ? data.condition : '',
        status: data.status,
        title: typeof data.title === 'string' ? data.title : '',
        route: `/cases/${region}/${publicSlug}`,
      })
    } catch (error) {
      fail(error.message)
    }
  }

  return cases
}

async function readConditions() {
  try {
    return await getTaxonomyConditions()
  } catch (error) {
    fail(error.message)
    return []
  }
}

function checkCaseDiscoveryPage(items) {
  const casesIndexFile = path.join(OUT_DIR, 'cases', 'index.html')

  if (!fs.existsSync(casesIndexFile)) {
    fail('Missing cases index route: /cases')
    return
  }

  const html = fs.readFileSync(casesIndexFile, 'utf8')

  for (const item of items) {
    const publicCaseRoute = `/cases/${item.region}/${item.publicSlug}`
    const internalCaseRoute = `/cases/${item.region}/${item.caseSlug}`

    if (isPrivateStatus(item.status)) {
      if (htmlIncludesRoute(html, publicCaseRoute) || htmlIncludesRoute(html, internalCaseRoute)) {
        fail(`Private case appears on /cases discovery page: ${publicCaseRoute}`)
      }
      continue
    }

    if (!htmlIncludesRoute(html, publicCaseRoute)) {
      fail(`Published case missing from /cases discovery page: ${publicCaseRoute}`)
      continue
    }

    if (item.publicSlug !== item.caseSlug && htmlIncludesRoute(html, internalCaseRoute)) {
      fail(`Cases discovery page exposes internal diagnostic case route: ${internalCaseRoute}`)
    }

    const cardHtml = getHtmlAroundRoute(html, publicCaseRoute)
    const condition = item.condition ? conditionsByKey.get(conditionKey(item.region, item.condition)) : null
    const diagnosticTerms = uniqueTerms([item.condition, condition?.label]).filter((term) => term.length >= 4)

    for (const term of diagnosticTerms) {
      if (containsTerm(cardHtml, term)) {
        fail(`Cases discovery card leaks "${term}" before reveal: ${publicCaseRoute}`)
      }
    }
  }
}

function getHtmlAroundRoute(html, route) {
  const indexes = routeVariants(route)
    .map((variant) => html.indexOf(variant))
    .filter((index) => index >= 0)

  if (indexes.length === 0) {
    return ''
  }

  const index = Math.min(...indexes)
  return html.slice(Math.max(0, index - 3000), Math.min(html.length, index + 3000))
}

function htmlIncludesRoute(html, route) {
  return routeVariants(route).some((variant) => html.includes(variant))
}

function routeVariants(route) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`
  const withoutTrailingSlash = normalizedRoute.replace(/\/+$/g, '')
  const withTrailingSlash = `${withoutTrailingSlash}/`

  return [
    withoutTrailingSlash,
    withTrailingSlash,
    `${BASE_PATH}${withoutTrailingSlash}`,
    `${BASE_PATH}${withTrailingSlash}`,
  ]
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

function conditionKey(region, condition) {
  return `${region}:${condition}`
}

function fail(message) {
  findings.push(message)
}

function collectIndexFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectIndexFiles(item) : entry.isFile() && entry.name === 'index.html' ? [item] : []
  })
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
