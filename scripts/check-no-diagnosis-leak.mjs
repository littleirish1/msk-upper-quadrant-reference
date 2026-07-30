import fs from 'fs'
import path from 'path'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'
import { readRecords as readGovernedCaseRecords } from './guided-cases/shared.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const SEARCH_INDEX_FILE = path.join(ROOT, 'public', 'search-index.json')
const REVEAL_DIR = path.join(ROOT, 'out', 'case-reveals')
const BASE_PATH = '/msk-upper-quadrant-reference'
const RESTRICTED_CASE_METADATA_FIELD = 'learningFocus'
const SOURCE_ROOT = path.join(ROOT, 'src')
const { getCaseRevealId } = await loadTypeScriptTree(
  path.join(SOURCE_ROOT, 'lib', 'caseRevealServer.ts'),
  SOURCE_ROOT,
)

const findings = []
const governedResult = await readGovernedCaseRecords()
for (const finding of governedResult.findings) fail(finding)
const governedById = new Map(
  governedResult.records.map(({ record }) => [record.caseId, record]),
)
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
checkRestrictedCaseMetadataBoundary()
checkRevealPayloadInventory(publishedCases)

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
  const caseNumber = item.publicSlug.match(/^case-(\d+)/i)?.[1]
  if (!caseNumber || !new RegExp(`Case\\s+${Number(caseNumber).toString().padStart(2, '0')}`, 'iu').test(html)) {
    fail(`Initial case delivery is missing its neutral case number: /cases/${item.region}/${item.publicSlug}`)
  }
  for (const controlName of [
    'Reveal likely diagnosis / linked condition',
    'Reveal suggested reasoning',
  ]) {
    if (!html.includes(controlName)) {
      fail(`Initial case delivery is missing reveal control "${controlName}": /cases/${item.region}/${item.publicSlug}`)
    }
  }

  const condition = item.condition ? conditionsByKey.get(conditionKey(item.region, item.condition)) : null
  const conditionRoute = condition ? `/${item.region}/${condition.slug}` : ''
  const publicCaseRoute = `/cases/${item.region}/${item.publicSlug}`
  const label = condition?.label ?? ''
  const initialAssets = collectInitialAssets(html)
  const diagnosticLearningFocus = item.learningFocus.filter((focus, index) =>
    index === 0 || isDiagnosisBearingFocus(focus, item.condition, label),
  )
  const restrictedTerms = uniqueTerms([
    item.title,
    item.condition,
    label,
    ...diagnosticLearningFocus,
    ...governedRestrictedValues(governedById.get(item.guidedCaseId)),
  ]).filter((term) => term.length >= 4)

  for (const term of restrictedTerms) {
    if (containsTerm(html, term)) {
      fail(`Initial case delivery leaks a reveal-gated value for ${publicCaseRoute} (field category: ${categoryForTerm(item, label, term)})`)
    }
    for (const asset of initialAssets) {
      if (containsTerm(asset.text, term)) {
        fail(`Public runtime asset serializes a reveal-gated value for ${publicCaseRoute}: ${asset.relative}`)
      }
    }
  }

  if (conditionRoute && htmlIncludesRoute(html, conditionRoute)) {
    fail(`Initial case delivery links to matching condition route: ${publicCaseRoute} -> ${conditionRoute}`)
  }

  const revealId = getCaseRevealId(item.region, item.publicSlug)
  const revealFile = path.join(REVEAL_DIR, `${revealId}.json`)
  if (!fs.existsSync(revealFile)) {
    fail(`Delayed reveal payload missing for ${publicCaseRoute}`)
    continue
  }
  if (html.includes(`${revealId}.json`)) {
    fail(`Initial case delivery eagerly references its delayed reveal payload: ${publicCaseRoute}`)
  }

  let payload
  try {
    payload = JSON.parse(fs.readFileSync(revealFile, 'utf8'))
  } catch (error) {
    fail(`Delayed reveal payload is invalid JSON for ${publicCaseRoute}: ${error.message}`)
    continue
  }
  if (payload.revealId !== revealId || payload.schemaVersion !== 1) {
    fail(`Delayed reveal payload identity mismatch for ${publicCaseRoute}`)
  }
  if (payload.actualTitle !== item.title) {
    fail(`Delayed reveal payload title mismatch for ${publicCaseRoute}`)
  }
  if (label && payload.conditionLabel !== label) {
    fail(`Delayed reveal payload condition label mismatch for ${publicCaseRoute}`)
  }
  if (conditionRoute && payload.conditionHref !== conditionRoute) {
    fail(`Delayed reveal payload condition route mismatch for ${publicCaseRoute}`)
  }
  if (typeof payload.contentHtml !== 'string' || payload.contentHtml.trim().length === 0) {
    fail(`Delayed reveal payload has no reasoning content for ${publicCaseRoute}`)
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
        learningFocus: Array.isArray(data.learningFocus) ? data.learningFocus : [],
        status: data.status,
        guidedCaseId: typeof data.guidedCaseId === 'string' ? data.guidedCaseId : '',
      })
    } catch (error) {
      fail(error.message)
    }
  }

  return items
}

function governedRestrictedValues(record) {
  if (!record) return []
  const diagnosticFocus = record.privateDiagnosticIdentity.privateLearningFocus.filter(
    (focus, index) => index === 0 || isDiagnosisBearingFocus(
      focus,
      record.privateDiagnosticIdentity.associatedConditionId,
      record.privateDiagnosticIdentity.likelyDiagnosis,
    ),
  )
  return [
    record.privateDiagnosticIdentity.internalTitle,
    record.privateDiagnosticIdentity.likelyDiagnosis,
    record.privateDiagnosticIdentity.associatedConditionId,
    ...diagnosticFocus,
    ...record.reasoningStages.flatMap((stage) => [
      ...stage.expectedReasoningThemes,
      ...stage.modelReasoningChecklist,
      ...stage.commonPitfalls,
      stage.feedback ?? '',
    ]),
  ]
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

function checkRestrictedCaseMetadataBoundary() {
  const allowedRuntimeDefinitions = new Set([
    'src/lib/casePublication.ts',
    'src/lib/contentSchemas.ts',
  ])
  for (const file of collectTextFiles(path.join(ROOT, 'src'), new Set(['.ts', '.tsx']))) {
    const relative = toPosix(path.relative(ROOT, file))
    if (allowedRuntimeDefinitions.has(relative)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (/\.learningFocus\b|\[['"]learningFocus['"]\]/u.test(source)) {
      fail(`Public runtime source accesses restricted guided-case metadata: ${relative}`)
    }
  }

  const publicFiles = collectTextFiles(
    OUT_DIR,
    new Set(['.html', '.js', '.json', '.txt', '.xml']),
  )

  for (const file of publicFiles) {
    const text = fs.readFileSync(file, 'utf8')
    const relative = toPosix(path.relative(OUT_DIR, file))
    if (text.includes(RESTRICTED_CASE_METADATA_FIELD)) {
      fail(`Public output serializes restricted guided-case metadata key: ${relative}`)
    }
  }

  if (fs.existsSync(SEARCH_INDEX_FILE)) {
    const searchText = fs.readFileSync(SEARCH_INDEX_FILE, 'utf8')
    if (searchText.includes(RESTRICTED_CASE_METADATA_FIELD)) {
      fail('Search index serializes restricted guided-case metadata.')
    }
  }

  const caseRouteSource = fs.readFileSync(
    path.join(ROOT, 'src', 'app', 'cases', '[region]', '[caseSlug]', 'page.tsx'),
    'utf8',
  )
  const promptCall = /<CaseReasoningPrompt\b([\s\S]*?)\/>/u.exec(caseRouteSource)?.[1] ?? ''
  for (const forbiddenProp of [
    'actualTitle',
    'conditionLabel',
    'conditionHref',
    'learningFocus',
    'children',
  ]) {
    if (new RegExp(`\\b${forbiddenProp}\\s*=`, 'u').test(promptCall)) {
      fail(`Guided-case server route passes a reveal-gated client prop: ${forbiddenProp}`)
    }
  }
}

function checkRevealPayloadInventory(items) {
  if (!fs.existsSync(REVEAL_DIR)) {
    fail('Missing delayed case reveal directory in the static export.')
    return
  }

  const expected = new Set(items.map((item) => `${getCaseRevealId(item.region, item.publicSlug)}.json`))
  const actual = fs.readdirSync(REVEAL_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)

  for (const name of expected) {
    if (!actual.includes(name)) fail(`Expected delayed reveal payload is missing: ${name}`)
  }
  for (const name of actual) {
    if (!expected.has(name)) fail(`Unexpected or stale delayed reveal payload is public: ${name}`)
  }

  const discoveryFile = path.join(OUT_DIR, 'cases', 'index.html')
  const discoveryHtml = fs.existsSync(discoveryFile) ? fs.readFileSync(discoveryFile, 'utf8') : ''
  const sitemapText = collectTextFiles(OUT_DIR, new Set(['.xml']))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
  const searchText = fs.existsSync(SEARCH_INDEX_FILE)
    ? fs.readFileSync(SEARCH_INDEX_FILE, 'utf8')
    : ''
  for (const name of expected) {
    const revealId = name.replace(/\.json$/u, '')
    if (discoveryHtml.includes(revealId) || sitemapText.includes(revealId) || searchText.includes(revealId)) {
      fail(`Delayed reveal payload is discoverable through navigation, sitemap, or search: ${name}`)
    }
  }
}

function collectTextFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectTextFiles(fullPath, extensions))
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath)
  }
  return files.sort()
}

function collectInitialAssets(html) {
  const references = new Set()
  for (const match of html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["'][^>]*>/giu)) {
    const reference = match[1].split(/[?#]/, 1)[0]
    if (!/\.(?:js|json)$/iu.test(reference)) continue
    const relativeReference = reference
      .replace(new RegExp(`^${escapeRegex(BASE_PATH)}/?`), '')
      .replace(/^\/+/, '')
    const file = path.join(OUT_DIR, ...relativeReference.split('/'))
    if (fs.existsSync(file) && fs.statSync(file).isFile()) references.add(file)
  }

  return [...references].sort().map((file) => ({
    relative: toPosix(path.relative(OUT_DIR, file)),
    text: fs.readFileSync(file, 'utf8'),
  }))
}

function toPosix(value) {
  return value.split(path.sep).join('/')
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

function containsTerm(text, term) {
  if (!term) return false
  return normalize(text).includes(normalize(term))
}

function categoryForTerm(item, conditionLabel, term) {
  if (term === item.title) return 'case title'
  if (term === item.condition) return 'condition identifier'
  if (term === conditionLabel) return 'condition label'
  return 'learning focus'
}

function isDiagnosisBearingFocus(focus, conditionSlug, conditionLabel) {
  const focusTokens = significantTokens(focus)
  const diagnosisTokens = new Set([
    ...significantTokens(conditionSlug),
    ...significantTokens(conditionLabel),
  ])
  return focusTokens.some((token) => diagnosisTokens.has(token))
}

function significantTokens(value) {
  return normalize(value)
    .split('-')
    .filter((token) => token.length >= 4 && !['pain', 'case', 'clinical'].includes(token))
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
