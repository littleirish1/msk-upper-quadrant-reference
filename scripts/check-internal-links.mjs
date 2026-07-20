import fs from 'node:fs'
import path from 'node:path'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const BASE_PATH = '/msk-upper-quadrant-reference'
const findings = []
let checkedLinks = 0

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing out directory. Run npm run build before npm run check:links.')
}

const htmlFiles = collectFiles(OUT_DIR, (file) => file.toLowerCase().endsWith('.html'))
if (htmlFiles.length === 0) fail('No generated HTML files found in out.')

const routeFiles = new Map(htmlFiles.map((file) => [routeForFile(file), file]))
const conditions = await getTaxonomyConditions()
const conditionRoutes = new Set(conditions.map((item) => '/' + item.region + '/' + item.slug))
const { privateRoutes, publishedCaseRoutes } = await collectCaseRoutes()

for (const sourceFile of htmlFiles) {
  const sourceRoute = routeForFile(sourceFile)
  const html = fs.readFileSync(sourceFile, 'utf8')

  for (const href of extractAnchorHrefs(html)) {
    const target = resolveInternalTarget(sourceRoute, href)
    if (!target) continue

    checkedLinks++
    const { route, fragment } = target

    if (route === '/3d-model' || route.startsWith('/3d-model/')) {
      fail(sourceRoute + ' links to removed public 3D route: ' + href)
      continue
    }

    if (route === '/ai-manager' || route.startsWith('/ai-manager/')) {
      fail(sourceRoute + ' links to private ai-manager path: ' + href)
      continue
    }

    if (privateRoutes.has(route)) {
      fail(sourceRoute + ' links to a draft/private case route: ' + route)
      continue
    }

    if (conditionRoutes.has(sourceRoute) && publishedCaseRoutes.has(route)) {
      fail('Condition page links directly to guided case: ' + sourceRoute + ' -> ' + route)
      continue
    }

    const targetFile = routeFiles.get(route) ?? resolveStaticFile(route)
    if (!targetFile) {
      fail(sourceRoute + ' has unresolved internal link: ' + href + ' -> ' + route)
      continue
    }

    if (fragment && !htmlHasAnchor(fs.readFileSync(targetFile, 'utf8'), fragment)) {
      fail(sourceRoute + ' links to missing anchor: ' + route + '#' + fragment)
    }
  }
}

if (checkedLinks === 0) fail('No internal anchor links were checked.')

if (findings.length > 0) {
  console.error('Internal link check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log('Internal link check passed.')
console.log('Generated HTML files checked: ' + htmlFiles.length)
console.log('Internal links checked: ' + checkedLinks)
console.log('Private case routes protected: ' + privateRoutes.size)

async function collectCaseRoutes() {
  const privateRoutes = new Set()
  const publishedCaseRoutes = new Set()

  for (const file of collectCaseFiles()) {
    try {
      const { data } = await readCaseFrontmatter(file)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const publicSlug = data.publicSlug || caseSlug
      const routes = [
        '/cases/' + region + '/' + publicSlug,
        '/cases/' + region + '/' + caseSlug,
      ].map(normalizeRoute)

      if (isPrivateStatus(data.status)) {
        for (const route of routes) privateRoutes.add(route)
      } else {
        publishedCaseRoutes.add(normalizeRoute('/cases/' + region + '/' + publicSlug))
      }
    } catch (error) {
      fail(error.message)
    }
  }

  return { privateRoutes, publishedCaseRoutes }
}

function extractAnchorHrefs(html) {
  const hrefs = []
  const pattern = /<a\b[^>]*\bhref=(['\"])(.*?)\1/gi
  let match
  while ((match = pattern.exec(html)) !== null) hrefs.push(decodeHtml(match[2]))
  return hrefs
}

function resolveInternalTarget(sourceRoute, href) {
  const value = href.trim()
  if (!value || value === '#' || /^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(value)) return null

  let parsed
  try {
    const baseRoute = sourceRoute === '/' ? '/' : sourceRoute + '/'
    parsed = new URL(value, 'https://local.invalid' + baseRoute)
  } catch {
    fail(sourceRoute + ' contains invalid href: ' + href)
    return null
  }

  if (parsed.origin !== 'https://local.invalid') return null

  let pathname = decodeURIComponent(parsed.pathname)
  if (pathname === BASE_PATH) pathname = '/'
  else if (pathname.startsWith(BASE_PATH + '/')) pathname = pathname.slice(BASE_PATH.length)

  return {
    route: normalizeRoute(pathname),
    fragment: parsed.hash ? decodeURIComponent(parsed.hash.slice(1)) : '',
  }
}

function routeForFile(file) {
  const relative = toPosix(path.relative(OUT_DIR, file))
  if (relative === 'index.html') return '/'
  if (relative.endsWith('/index.html')) return normalizeRoute('/' + relative.slice(0, -'/index.html'.length))
  return normalizeRoute('/' + relative.replace(/\.html$/i, ''))
}

function normalizeRoute(route) {
  const clean = ('/' + String(route || '').replace(/^\/+/, ''))
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/g, '')
  return clean || '/'
}

function resolveStaticFile(route) {
  const relative = route.replace(/^\//, '')
  const candidates = [
    path.join(OUT_DIR, relative),
    path.join(OUT_DIR, relative + '.html'),
    path.join(OUT_DIR, relative, 'index.html'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

function htmlHasAnchor(html, fragment) {
  const escaped = fragment.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
  return new RegExp('(?:id|name)=[\"\']' + escaped + '[\"\']', 'i').test(html)
}

function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(entryPath, predicate))
    else if (entry.isFile() && predicate(entryPath)) files.push(entryPath)
  }
  return files.sort()
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function fail(message) {
  findings.push(message)
}
