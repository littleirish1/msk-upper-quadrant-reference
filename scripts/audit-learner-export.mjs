import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  getTaxonomyRegions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const REPORT_DIR = path.join(ROOT, 'reports', 'publication-readiness')
const BASE_PATH = '/msk-upper-quadrant-reference'
const TARGET_REGIONS = new Set(['cervical', 'shoulder', 'elbow'])
const PRIVATE_MARKERS = [
  'content review studio',
  'version 1 publication review',
  'legacy-publication-review-required',
  'PARTIAL SUPPORT — HUMAN EVIDENCE DECISION REQUIRED',
  'conditionDecisionFields',
  'record-v1-publication-review',
  'private-review-portal',
  'review-task.',
  'proposal.',
  'candidate-asset.',
  'candidate-source.',
  'grantsapproval',
]

export function auditStaticExport(outDir, { basePath = BASE_PATH, knownRegions = TARGET_REGIONS } = {}) {
  if (!fs.existsSync(outDir)) throw new Error(`Missing static export directory: ${outDir}`)
  const regionSlugs = knownRegions instanceof Set ? knownRegions : new Set(knownRegions)

  const htmlFiles = collectFiles(outDir, (file) => file.toLowerCase().endsWith('.html'))
  if (htmlFiles.length === 0) throw new Error(`No HTML files found beneath ${outDir}`)

  const pages = htmlFiles.map((file) => parsePage(outDir, file))
  const routeFiles = new Map()
  for (const page of pages) {
    if (!routeFiles.has(page.route)) routeFiles.set(page.route, page.file)
  }

  const routeRecords = new Map([...routeFiles].map(([route, file]) => [route, {
    route,
    outputFile: toPosix(path.relative(outDir, file)),
    title: pages.find((page) => page.file === file)?.title || '',
    region: regionForRoute(route, regionSlugs),
    contentType: contentTypeForRoute(route, regionSlugs),
    inboundLinks: 0,
    outboundInternalLinks: 0,
    navigationVisible: false,
    publicationEligibility: 'emitted-public-route',
  }]))

  const findings = []
  const externalUrls = new Map()
  const navigationTargets = new Set()
  let internalHyperlinks = 0
  let validInternalHyperlinks = 0
  let fragmentLinks = 0
  let invalidAnchors = 0
  let localAssetReferences = 0
  let validLocalAssetReferences = 0

  for (const page of pages) {
    const sourceRecord = routeRecords.get(page.route)

    for (const href of page.navHrefs) {
      const target = resolveReference(page.route, decodeHtml(href.value).trim(), basePath)
      if (target) navigationTargets.add(target.route)
    }

    for (const href of page.hrefs) {
      const value = decodeHtml(href.value).trim()
      if (!value) {
        findings.push(finding('empty-href', page.route, value))
        continue
      }
      if (value === '#') {
        findings.push(finding('placeholder-href', page.route, value))
        continue
      }
      if (/^(?:javascript:|file:)/i.test(value) || /(?:^|\/)(?:private-review-portal|ai-manager)(?:\/|$)/i.test(value)) {
        findings.push(finding('forbidden-href', page.route, value))
        continue
      }
      if (/^(?:mailto:|tel:|data:|blob:)/i.test(value)) continue
      if (/^https?:/i.test(value) || value.startsWith('//')) {
        addExternal(externalUrls, page.route, value)
        continue
      }

      internalHyperlinks++
      const target = resolveReference(page.route, value, basePath)
      if (!target) {
        findings.push(finding('malformed-internal-href', page.route, value))
        continue
      }
      if (/\.mdx?(?:$|[?#])/i.test(value)) {
        findings.push(finding('source-file-href', page.route, value))
        continue
      }
      if (target.fragment) fragmentLinks++

      const targetFile = routeFiles.get(target.route) || resolveOutputFile(outDir, target.route)
      if (!targetFile) {
        findings.push(finding('broken-internal-href', page.route, value, target.route))
        continue
      }
      const targetPage = pages.find((candidate) => candidate.file === targetFile)
      if (target.fragment) {
        const count = targetPage?.anchorCounts.get(target.fragment) || countAnchorInFile(targetFile, target.fragment)
        if (count !== 1) {
          invalidAnchors++
          findings.push(finding(count === 0 ? 'missing-anchor' : 'non-unique-anchor', page.route, value, `${target.route}#${target.fragment}`))
          continue
        }
      }
      validInternalHyperlinks++
      if (sourceRecord) sourceRecord.outboundInternalLinks++
      const targetRecord = routeRecords.get(target.route)
      if (targetRecord) targetRecord.inboundLinks++
    }

    for (const reference of page.assetReferences) {
      const value = decodeHtml(reference.value).trim()
      if (!value || /^(?:data:|blob:|mailto:|tel:|#)/i.test(value)) continue
      if (/^https?:/i.test(value) || value.startsWith('//')) {
        addExternal(externalUrls, page.route, value)
        continue
      }
      localAssetReferences++
      const file = resolveAssetFile(outDir, page.route, value, basePath)
      if (!file) findings.push(finding('missing-local-asset', page.route, value, reference.attribute))
      else validLocalAssetReferences++
    }
  }

  for (const record of routeRecords.values()) {
    record.navigationVisible = navigationTargets.has(record.route)
  }

  for (const page of pages) {
    for (const [anchor, count] of page.anchorCounts) {
      if (count > 1) {
        invalidAnchors++
        findings.push(finding('duplicate-anchor-id', page.route, anchor, String(count)))
      }
    }
    if (page.route !== '/404' && page.h1Count !== 1) {
      findings.push(finding('invalid-h1-count', page.route, String(page.h1Count)))
    }
    for (const marker of PRIVATE_MARKERS) {
      if (page.htmlLower.includes(marker)) findings.push(finding('private-marker', page.route, marker))
    }
  }

  const learnerRoutes = [...routeRecords.values()].filter((record) => record.route !== '/404')
  const orphanRoutes = learnerRoutes
    .filter((record) => record.route !== '/' && record.inboundLinks === 0)
    .map((record) => record.route)
    .sort()
  const malformedExternalLinks = [...externalUrls.values()].filter((item) => !item.valid).length

  return {
    schemaVersion: 1,
    basePath,
    trailingSlash: true,
    summary: {
      generatedLearnerRoutes: learnerRoutes.length,
      htmlPages: htmlFiles.length,
      internalHyperlinks,
      validInternalHyperlinks,
      brokenInternalHyperlinks: internalHyperlinks - validInternalHyperlinks,
      fragmentLinks,
      invalidAnchors,
      localAssetReferences,
      validLocalAssetReferences,
      missingLocalAssets: localAssetReferences - validLocalAssetReferences,
      externalLinksInventoried: externalUrls.size,
      malformedExternalLinks,
      cervicalRoutes: learnerRoutes.filter((item) => item.region === 'cervical').length,
      shoulderRoutes: learnerRoutes.filter((item) => item.region === 'shoulder').length,
      elbowRoutes: learnerRoutes.filter((item) => item.region === 'elbow').length,
      orphanLearnerPages: orphanRoutes.length,
      privateMarkerFindings: findings.filter((item) => item.kind === 'private-marker').length,
    },
    orphanRoutes,
    routes: learnerRoutes.sort((a, b) => a.route.localeCompare(b.route)),
    externalLinks: [...externalUrls.values()].sort((a, b) => a.url.localeCompare(b.url)),
    findings,
  }
}

export async function buildTargetInventory(root = ROOT) {
  const conditions = await getTaxonomyConditions()
  const regions = await getTaxonomyRegions()
  const governedCases = loadGovernedCases(root)
  const items = []

  for (const region of regions.filter((item) => TARGET_REGIONS.has(item.slug))) {
    items.push(inventoryItem({
      id: `region.${region.slug}`,
      region: region.slug,
      contentType: 'region',
      sourceFile: 'src/data/taxonomy.ts',
      expectedRoute: `/${region.slug}`,
      publicationState: 'emitted-public-route',
      clinicalReviewState: 'not-applicable-navigation',
      evidenceReviewState: 'not-applicable-navigation',
      completenessState: 'route-present',
      knownBlockers: [],
    }))
  }

  for (const condition of conditions.filter((item) => TARGET_REGIONS.has(item.region))) {
    const sourceFile = `content/${condition.region}/${condition.slug}.mdx`
    const absolute = path.join(root, ...sourceFile.split('/'))
    const parsed = matter(fs.readFileSync(absolute, 'utf8'))
    const missingSections = expectedConditionSections(parsed.content)
    const clinicalReview = parsed.data.clinicalReview || parsed.data.clinicianReviewStatus || 'not-recorded'
    const evidenceReview = parsed.data.evidenceReview || 'not-recorded'
    const publicationState = parsed.data.publicationState || parsed.data.status || 'public-by-default-selection'
    const blockers = []
    if (clinicalReview === 'not-recorded') blockers.push('explicit-clinical-review-decision-not-recorded')
    if (evidenceReview === 'not-recorded') blockers.push('explicit-evidence-review-decision-not-recorded')
    if (!parsed.data.publicationState) blockers.push('explicit-publication-state-not-recorded')
    if (missingSections.length) blockers.push(`missing-standard-sections:${missingSections.join(',')}`)
    items.push(inventoryItem({
      id: `condition.${condition.region}.${condition.slug}`,
      region: condition.region,
      contentType: 'condition',
      sourceFile,
      expectedRoute: `/${condition.region}/${condition.slug}`,
      publicationState,
      clinicalReviewState: clinicalReview,
      evidenceReviewState: evidenceReview,
      completenessState: missingSections.length ? 'incomplete' : 'standard-sections-present',
      knownBlockers: blockers,
    }))
  }

  for (const file of collectCaseFiles()) {
    const { data } = await readCaseFrontmatter(file)
    const region = path.basename(path.dirname(file))
    if (!TARGET_REGIONS.has(region)) continue
    const caseSlug = path.basename(file, '.mdx')
    const publicSlug = data.publicSlug || caseSlug
    const governed = governedCases.get(publicSlug)
    const sourceFile = toPosix(path.relative(root, file))
    const blockers = []
    if (isPrivateStatus(data.status)) blockers.push('private-or-draft-case')
    if (!data.lastReviewed) blockers.push('review-date-not-recorded')
    for (const issue of governed?.governance?.unresolvedIssues || []) blockers.push(issue)
    items.push(inventoryItem({
      id: `case.${region}.${caseSlug}`,
      region,
      contentType: 'case',
      sourceFile,
      expectedRoute: isPrivateStatus(data.status) ? null : `/cases/${region}/${publicSlug}`,
      publicationState: governed?.lifecycleState || data.status || 'not-recorded',
      clinicalReviewState: governed?.governance?.clinicalReviewStatus || data.reviewStatus || (data.lastReviewed ? 'review-date-recorded' : 'not-recorded'),
      evidenceReviewState: governed?.governance?.evidenceReviewStatus || data.evidenceReview || 'not-recorded',
      completenessState: data.title && data.condition ? 'core-frontmatter-present' : 'incomplete',
      knownBlockers: blockers,
    }))
  }

  addPrivateRecords(items, root)
  return {
    schemaVersion: 1,
    scope: ['cervical', 'shoulder', 'elbow'],
    authorityNote: 'Inventory records repository state only; it grants no clinical, evidence, accessibility or publication approval.',
    summary: summarizeInventory(items),
    items: items.sort((a, b) => a.region.localeCompare(b.region) || a.contentType.localeCompare(b.contentType) || a.id.localeCompare(b.id)),
  }
}

export async function annotateRouteSources(routes, root = ROOT) {
  const caseSources = new Map()
  for (const file of collectCaseFiles()) {
    const { data } = await readCaseFrontmatter(file)
    if (isPrivateStatus(data.status)) continue
    const region = path.basename(path.dirname(file))
    const caseSlug = path.basename(file, '.mdx')
    const publicSlug = data.publicSlug || caseSlug
    caseSources.set(`/cases/${region}/${publicSlug}`, toPosix(path.relative(root, file)))
  }

  for (const record of routes) {
    const parts = record.route.split('/').filter(Boolean)
    if (record.route === '/') record.expectedSource = 'src/app/page.tsx'
    else if (record.route === '/cases') record.expectedSource = 'src/app/cases/page.tsx; content/cases/**'
    else if (parts[0] === 'cases' && parts.length === 3) {
      record.expectedSource = caseSources.get(record.route) || 'src/app/cases/[region]/[caseSlug]/page.tsx; governed case registry'
    } else if (record.route === '/anatomy') record.expectedSource = 'src/app/anatomy/page.tsx; src/data/anatomy.ts'
    else if (parts[0] === 'anatomy' && parts.length === 2) record.expectedSource = 'src/app/anatomy/[category]/page.tsx; src/data/anatomy.ts'
    else if (parts.length === 1 && fs.existsSync(path.join(root, 'content', parts[0]))) {
      record.expectedSource = 'src/app/[region]/page.tsx; src/data/taxonomy.ts'
    } else if (parts.length === 2 && fs.existsSync(path.join(root, 'content', parts[0], `${parts[1]}.mdx`))) {
      record.expectedSource = `content/${parts[0]}/${parts[1]}.mdx`
    } else {
      const staticPage = path.join(root, 'src', 'app', ...parts, 'page.tsx')
      record.expectedSource = fs.existsSync(staticPage)
        ? toPosix(path.relative(root, staticPage))
        : 'generated Next.js route'
    }
  }
  return routes
}

function addPrivateRecords(items, root) {
  const sources = [
    ['ai-manager/clinical-platform/movement/movement-library.json', 'records', 'movement'],
    ['ai-manager/clinical-platform/shoulder/movement-library.json', 'records', 'movement'],
    ['ai-manager/clinical-platform/mcq/bank.json', 'records', 'mcq'],
    ['ai-manager/clinical-platform/shoulder/mcq-plan.json', 'records', 'mcq'],
    ['ai-manager/clinical-platform/modules/module-library.json', 'modules', 'module'],
    ['ai-manager/clinical-platform/shoulder/module-library.json', 'modules', 'module'],
    ['ai-manager/clinical-platform/anatomy-3d/registry.json', 'assets', 'anatomy-3d'],
  ]
  const seen = new Set(items.map((item) => item.id))
  for (const [sourceFile, key, contentType] of sources) {
    const data = JSON.parse(fs.readFileSync(path.join(root, ...sourceFile.split('/')), 'utf8'))
    for (const record of data[key] || []) {
      const region = record.region || record.applicability?.regions?.[0] || (sourceFile.includes('/shoulder/') ? 'shoulder' : regionFromId(record.id))
      if (!TARGET_REGIONS.has(region) || seen.has(record.id)) continue
      seen.add(record.id)
      const reviews = record.reviews || {}
      const blockers = uniqueStrings([
        ...(record.blockers || []),
        ...(record.unresolvedIssues || []),
        ...(reviews.unresolvedIssues || []),
        ...(record.publicEligibility === false ? ['publicEligibility-false'] : []),
        ...((record.publicationState === 'private' || record.lifecycle === 'draft') ? ['private-review-only-no-public-route'] : []),
      ])
      items.push(inventoryItem({
        id: record.id,
        region,
        contentType,
        sourceFile,
        expectedRoute: null,
        publicationState: record.publicationState || record.lifecycle || 'private-review-record',
        clinicalReviewState: reviews.clinical?.state || reviews.clinical || record.reviewState || 'review-required',
        evidenceReviewState: reviews.evidence?.state || reviews.evidence || (record.evidenceRecordIds?.length ? 'linked-not-approved' : 'missing'),
        completenessState: blockers.length ? 'blocked-or-incomplete' : 'record-present',
        knownBlockers: blockers,
      }))
    }
  }
}

function parsePage(outDir, file) {
  const html = fs.readFileSync(file, 'utf8')
  const route = routeForFile(outDir, file)
  const hrefs = extractAttributes(html, 'a', 'href')
  const navHtml = [...html.matchAll(/<nav\b[\s\S]*?<\/nav>/gi)].map((match) => match[0]).join('\n')
  const anchorCounts = new Map()
  for (const match of html.matchAll(/\bid=(['"])(.*?)\1/gi)) {
    const id = decodeHtml(match[2])
    anchorCounts.set(id, (anchorCounts.get(id) || 0) + 1)
  }
  return {
    file,
    route,
    htmlLower: html.toLowerCase(),
    title: decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim(),
    h1Count: (html.match(/<h1\b/gi) || []).length,
    hrefs,
    navHrefs: extractAttributes(navHtml, 'a', 'href'),
    anchorCounts,
    assetReferences: [
      ...extractAttributes(html, 'script', 'src'),
      ...extractAttributes(html, 'link', 'href'),
      ...extractAttributes(html, 'img', 'src'),
      ...extractSrcset(html, 'img'),
      ...extractAttributes(html, 'source', 'src'),
      ...extractSrcset(html, 'source'),
      ...extractAttributes(html, 'video', 'src'),
      ...extractAttributes(html, 'video', 'poster'),
      ...extractAttributes(html, 'audio', 'src'),
    ],
  }
}

function extractAttributes(html, tag, attribute) {
  const values = []
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>`, 'gi')
  const attributePattern = new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, 'i')
  for (const tagMatch of html.matchAll(tagPattern)) {
    const match = tagMatch[0].match(attributePattern)
    if (match) values.push({ attribute, value: match[2] })
  }
  return values
}

function extractSrcset(html, tag) {
  return extractAttributes(html, tag, 'srcset').flatMap((item) => item.value.split(',').map((part) => ({
    attribute: 'srcset',
    value: part.trim().split(/\s+/)[0],
  })))
}

function resolveReference(sourceRoute, value, basePath) {
  try {
    const baseRoute = sourceRoute === '/' ? '/' : `${sourceRoute}/`
    const parsed = new URL(value, `https://learner.invalid${baseRoute}`)
    if (parsed.origin !== 'https://learner.invalid') return null
    let pathname = safeDecode(parsed.pathname)
    if (pathname === basePath) pathname = '/'
    else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length)
    return {
      route: normalizeRoute(pathname),
      fragment: parsed.hash ? safeDecode(parsed.hash.slice(1)) : '',
    }
  } catch {
    return null
  }
}

function resolveOutputFile(outDir, route) {
  const relative = route.replace(/^\//, '')
  const candidates = [
    path.join(outDir, relative),
    path.join(outDir, `${relative}.html`),
    path.join(outDir, relative, 'index.html'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null
}

function resolveAssetFile(outDir, sourceRoute, value, basePath) {
  const target = resolveReference(sourceRoute, value, basePath)
  if (!target) return null
  const relative = target.route.replace(/^\//, '')
  const candidate = path.join(outDir, ...relative.split('/'))
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null
}

function countAnchorInFile(file, fragment) {
  if (!file || !fs.existsSync(file) || !file.endsWith('.html')) return 0
  const html = fs.readFileSync(file, 'utf8')
  const escaped = escapeRegExp(fragment)
  return (html.match(new RegExp(`\\bid=['"]${escaped}['"]`, 'gi')) || []).length
}

function addExternal(map, sourceRoute, raw) {
  const normalized = raw.startsWith('//') ? `https:${raw}` : raw
  let valid = true
  let category = 'general-external-resource'
  try {
    const url = new URL(normalized)
    valid = ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
    const text = `${url.hostname}${url.pathname}`.toLowerCase()
    if (/doi\.org|pubmed|ncbi|nice\.org|cochrane|pedro/.test(text)) category = 'evidence-or-source'
    else if (/creativecommons|license|licence/.test(text)) category = 'attribution-or-licence'
    else if (/nhs|hscni|gov\.uk|csp\.org/.test(text)) category = 'organisation-or-guideline'
  } catch {
    valid = false
  }
  const existing = map.get(normalized) || { url: normalized, valid, category, occurrences: 0, sourceRoutes: [] }
  existing.occurrences++
  if (!existing.sourceRoutes.includes(sourceRoute)) existing.sourceRoutes.push(sourceRoute)
  map.set(normalized, existing)
}

function expectedConditionSections(content) {
  const normalized = content.toLowerCase()
  const expected = ['overview', 'special tests', 'red flags', 'clinical frameworks', 'outcome measures', 'evidence-based diagnosis', 'differential diagnosis', 'management']
  return expected.filter((label) => !normalized.includes(`## ${label}`))
}

function loadGovernedCases(root) {
  const records = new Map()
  const base = path.join(root, 'content', 'guided-cases', 'records')
  if (!fs.existsSync(base)) return records
  for (const file of collectFiles(base, (item) => item.toLowerCase().endsWith('.json'))) {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (record.publicSlug) records.set(record.publicSlug, record)
  }
  return records
}

function summarizeInventory(items) {
  const byRegion = {}
  for (const region of TARGET_REGIONS) {
    const scoped = items.filter((item) => item.region === region)
    byRegion[region] = {
      total: scoped.length,
      byContentType: Object.fromEntries([...new Set(scoped.map((item) => item.contentType))].sort().map((type) => [type, scoped.filter((item) => item.contentType === type).length])),
      publicRoutesExpected: scoped.filter((item) => item.expectedRoute).length,
      blocked: scoped.filter((item) => item.knownBlockers.length > 0).length,
    }
  }
  return byRegion
}

function inventoryItem(value) {
  return {
    id: value.id,
    region: value.region,
    contentType: value.contentType,
    sourceFile: toPosix(value.sourceFile),
    expectedRoute: value.expectedRoute,
    publicationState: value.publicationState,
    clinicalReviewState: value.clinicalReviewState,
    evidenceReviewState: value.evidenceReviewState,
    completenessState: value.completenessState,
    knownBlockers: uniqueStrings(value.knownBlockers || []),
  }
}

function regionFromId(id) {
  const value = String(id || '').toLowerCase()
  return [...TARGET_REGIONS].find((region) => value.includes(`.${region}.`) || value.endsWith(`.${region}`)) || null
}

function regionForRoute(route, knownRegions = TARGET_REGIONS) {
  const parts = route.split('/').filter(Boolean)
  if (knownRegions.has(parts[0])) return parts[0]
  if (parts[0] === 'cases' && knownRegions.has(parts[1])) return parts[1]
  return null
}

function contentTypeForRoute(route, knownRegions = TARGET_REGIONS) {
  const parts = route.split('/').filter(Boolean)
  if (route === '/') return 'home'
  if (parts[0] === 'cases') return parts.length === 1 ? 'case-index' : 'case'
  if (parts[0] === 'anatomy') return parts.length === 1 ? 'anatomy-index' : 'anatomy-category'
  if (knownRegions.has(parts[0])) return parts.length === 1 ? 'region' : 'condition'
  return 'static-page'
}

function routeForFile(outDir, file) {
  const relative = toPosix(path.relative(outDir, file))
  if (relative === 'index.html') return '/'
  if (relative.endsWith('/index.html')) return normalizeRoute(`/${relative.slice(0, -'/index.html'.length)}`)
  return normalizeRoute(`/${relative.replace(/\.html$/i, '')}`)
}

function normalizeRoute(route) {
  const clean = (`/${String(route || '').replace(/^\/+/, '')}`).replace(/\/{2,}/g, '/').replace(/\/+$/g, '')
  return clean || '/'
}

function collectFiles(dir, predicate) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const item = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(item, predicate))
    else if (entry.isFile() && predicate(item)) files.push(item)
  }
  return files.sort()
}

function finding(kind, sourceRoute, value, resolved = null) {
  return { kind, sourceRoute, value, resolved }
}

function decodeHtml(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function safeDecode(value) {
  try { return decodeURIComponent(value) } catch { return value }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
}

function toPosix(value) {
  return String(value).split(path.sep).join('/')
}

async function main() {
  const regions = await getTaxonomyRegions()
  const audit = auditStaticExport(OUT_DIR, { knownRegions: new Set(regions.map((region) => region.slug)) })
  await annotateRouteSources(audit.routes, ROOT)
  const inventory = await buildTargetInventory(ROOT)
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(path.join(REPORT_DIR, 'learner-export-audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
  fs.writeFileSync(path.join(REPORT_DIR, 'cervical-shoulder-elbow-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`)

  console.log('Learner export audit complete.')
  for (const [key, value] of Object.entries(audit.summary)) console.log(`${key}: ${value}`)
  console.log(`Inventory items: ${inventory.items.length}`)
  if (audit.findings.length) {
    console.error(`Learner export audit failed with ${audit.findings.length} finding(s).`)
    for (const item of audit.findings.slice(0, 100)) console.error(`- ${item.kind}: ${item.sourceRoute} -> ${item.value}${item.resolved ? ` (${item.resolved})` : ''}`)
    process.exit(1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
