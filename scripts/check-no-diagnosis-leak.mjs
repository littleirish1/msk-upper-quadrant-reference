import fs from 'fs'
import path from 'path'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const SEARCH_INDEX_FILE = path.join(ROOT, 'public', 'search-index.json')
const BASE_PATH = '/msk-upper-quadrant-reference'

const findings = []
const conditions = await readConditions()
const conditionsByKey = new Map(conditions.map((condition) => [conditionKey(condition.region, condition.slug), condition]))
const cases = await readCases()
const publishedCases = cases.filter((item) => !isPrivateStatus(item.status))

if (conditions.length === 0) {
  fail('No taxonomy conditions found for diagnosis no-leak checks.')
}

if (cases.length === 0) {
  fail('No guided case files found for diagnosis no-leak checks.')
}

if (publishedCases.length === 0) {
  fail('No published guided cases found for diagnosis no-leak checks.')
}

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build before npm run check:no-leak.')
}

checkCaseDiscoveryPage(publishedCases)
checkSearchIndex()
checkConditionPagesDoNotLinkPublishedCases(publishedCases)

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
  const conditionRoute = item.condition ? `/${item.region}/${item.condition}` : ''
  const publicCaseRoute = `/cases/${item.region}/${item.publicSlug}`
  const condition = item.condition ? conditionsByKey.get(conditionKey(item.region, item.condition)) : null
  const label = condition?.label ?? ''
  const preRevealTerms = uniqueTerms([
    item.condition,
    label,
  ]).filter((term) => term.length >= 4)

  for (const term of preRevealTerms) {
    if (containsTerm(preRevealHtml, term)) {
      fail(`Pre-reveal case HTML leaks "${term}" for /cases/${item.region}/${item.publicSlug}`)
    }
  }

  if (conditionRoute && htmlIncludesRoute(preRevealHtml, conditionRoute)) {
    fail(`Pre-reveal case HTML links to matching condition route: ${publicCaseRoute} -> ${conditionRoute}`)
  }

  if (item.condition) {
    const conditionRouteFile = path.join(OUT_DIR, item.region, item.condition, 'index.html')

    if (fs.existsSync(conditionRouteFile)) {
      const conditionHtml = fs.readFileSync(conditionRouteFile, 'utf8')

      if (htmlIncludesRoute(conditionHtml, publicCaseRoute)) {
        fail(`Condition page links directly to matching guided case: ${conditionRoute} -> ${publicCaseRoute}`)
      }
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
console.log(`Published case routes checked: ${publishedCases.length}`)
console.log(`Private case routes excluded: ${cases.filter((item) => isPrivateStatus(item.status)).length}`)
console.log(`Live condition pages checked: ${conditions.length}`)

async function readCases() {
  if (!fs.existsSync(CASES_DIR)) return []

  const items = []
  for (const file of collectCaseFiles()) {
    try {
      const { data } = await readCaseFrontmatter(file)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const publicSlug = typeof data.publicSlug === 'string' && data.publicSlug.trim()
        ? data.publicSlug.trim()
        : fallbackPublicSlug(caseSlug, region)

      items.push({
        region,
        caseSlug,
        publicSlug,
        condition: typeof data.condition === 'string' ? data.condition : '',
        title: typeof data.title === 'string' ? data.title : '',
        status: data.status,
      })
    } catch (error) {
      fail(error.message)
    }
  }

  return items
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
    const cardHtml = getHtmlAroundRoute(html, publicCaseRoute)
    const condition = item.condition ? conditionsByKey.get(conditionKey(item.region, item.condition)) : null
    const terms = uniqueTerms([item.condition, condition?.label]).filter((term) => term.length >= 4)

    for (const term of terms) {
      if (containsTerm(cardHtml, term)) {
        fail(`Case discovery card leaks "${term}" before reveal: ${publicCaseRoute}`)
      }
    }
  }
}

function checkSearchIndex() {
  if (!fs.existsSync(SEARCH_INDEX_FILE)) {
    fail('Missing search index: public/search-index.json')
    return
  }

  let entries
  try {
    entries = JSON.parse(fs.readFileSync(SEARCH_INDEX_FILE, 'utf8'))
  } catch (error) {
    fail(`Search index is invalid JSON: ${error.message}`)
    return
  }

  if (!Array.isArray(entries)) {
    fail('Search index is not a JSON array.')
    return
  }

  for (const [index, entry] of entries.entries()) {
    const href = typeof entry?.href === 'string' ? entry.href : ''
    const id = typeof entry?.id === 'string' ? entry.id : ''

    if (href.startsWith('/cases/') || id.startsWith('cases/')) {
      fail(`Search entry exposes a guided case before reveal: entry ${index} (${id || href})`)
    }
  }
}

function checkConditionPagesDoNotLinkPublishedCases(items) {
  const publishedCaseRoutes = items.map((item) => `/cases/${item.region}/${item.publicSlug}`)

  for (const condition of conditions) {
    const conditionRouteFile = path.join(OUT_DIR, condition.region, condition.slug, 'index.html')
    if (!fs.existsSync(conditionRouteFile)) continue

    const html = fs.readFileSync(conditionRouteFile, 'utf8')

    for (const publicCaseRoute of publishedCaseRoutes) {
      if (htmlIncludesRoute(html, publicCaseRoute)) {
        fail(`Condition page links directly to a guided case route: /${condition.region}/${condition.slug} -> ${publicCaseRoute}`)
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

function fallbackPublicSlug(caseSlug, region) {
  const caseNumber = caseSlug.match(/case-(\d+)/i)?.[1]
  const caseLabel = caseNumber ? `case-${caseNumber.padStart(2, '0')}` : 'case'
  return `${caseLabel}-${region}-clinical-reasoning`
}

function fail(message) {
  findings.push(message)
}
