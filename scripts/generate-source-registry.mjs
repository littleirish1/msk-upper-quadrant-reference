import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const STATIONS_DIR = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'extracted', 'stations')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const TRACKER_FILE = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'migration-tracker.md')
const REGISTRY_FILE = path.join(ROOT, 'content', 'imports', 'source-registry.json')

const LEGACY_SOURCE_TYPE = 'legacy-html-case-bank'

if (!fs.existsSync(STATIONS_DIR)) {
  console.error(`Missing legacy stations directory: ${toPosix(path.relative(ROOT, STATIONS_DIR))}`)
  process.exit(1)
}

if (!fs.existsSync(CASES_DIR)) {
  console.error(`Missing cases directory: ${toPosix(path.relative(ROOT, CASES_DIR))}`)
  process.exit(1)
}

const trackerRowsById = readTrackerRowsById()
const cases = readCases()
const casesBySourceKey = buildCasesBySourceKey(cases)

const sources = fs
  .readdirSync(STATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => readLegacyStation(path.join(STATIONS_DIR, entry.name)))
  .map((station) => buildLegacySourceEntry(station, casesBySourceKey))
  .sort(compareSourceEntries)

const linkedCases = cases
  .filter((item) => item.sourceType && item.sourceId)
  .map((item) => ({
    path: item.path,
    title: item.title,
    region: item.region,
    status: item.status,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    sourcePath: item.sourcePath,
    reviewStatus: item.reviewStatus,
  }))
  .sort(compareCaseEntries)

const unlinkedCases = cases
  .filter((item) => !item.sourceType || !item.sourceId)
  .map((item) => ({
    path: item.path,
    title: item.title,
    region: item.region,
    status: item.status,
    reason: 'missing-source-metadata',
  }))
  .sort(compareCaseEntries)

const summary = {
  totalSources: sources.length,
  legacyHtmlCaseBank: sources.filter((item) => item.sourceType === LEGACY_SOURCE_TYPE).length,
  pendingReview: sources.filter((item) => item.sourceStatus === 'pending-review').length,
  draftCreated: sources.filter((item) => item.sourceStatus === 'draft-created').length,
  converted: sources.filter((item) => item.sourceStatus === 'converted').length,
  archived: sources.filter((item) => item.sourceStatus === 'archived').length,
  linkedCases: linkedCases.length,
  unlinkedCases: unlinkedCases.length,
}

const registry = {
  schemaVersion: 1,
  generatedFrom: {
    legacyStations: 'content/imports/html-case-bank/extracted/stations',
    cases: 'content/cases',
    migrationTracker: 'content/imports/html-case-bank/migration-tracker.md',
  },
  sources,
  linkedCases,
  unlinkedCases,
  summary,
}

fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true })
fs.writeFileSync(REGISTRY_FILE, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')

console.log(`Wrote source registry: ${toPosix(path.relative(ROOT, REGISTRY_FILE))}`)
console.log(`Sources: ${summary.totalSources}`)
console.log(`Legacy HTML case bank: ${summary.legacyHtmlCaseBank}`)
console.log(`Pending review: ${summary.pendingReview}`)
console.log(`Draft created: ${summary.draftCreated}`)
console.log(`Converted: ${summary.converted}`)
console.log(`Archived: ${summary.archived}`)
console.log(`Linked cases: ${summary.linkedCases}`)
console.log(`Unlinked cases: ${summary.unlinkedCases}`)

if (unlinkedCases.length > 0) {
  console.log('Unlinked cases:')

  for (const item of unlinkedCases) {
    console.log(`- ${item.path}`)
  }
}

function readLegacyStation(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const sourcePath = toPosix(path.relative(ROOT, file))
  const sourceId = findMetadataValue(text, 'Station ID') ?? path.basename(file).match(/^(s\d+)-/)?.[1] ?? ''
  const legacyTitle = meaningfulValue(findMetadataValue(text, 'Legacy title'))
  const displayName = meaningfulValue(findMetadataValue(text, 'Display name'))
  const suggestedRegion = findMetadataValue(text, 'Suggested region') ?? 'unknown'
  const headingTitle = text.match(/^# Legacy Station Extract:\s*(.+)$/m)?.[1]?.trim() ?? ''
  const trackerRow = trackerRowsById.get(sourceId)

  return removeEmpty({
    sourceType: LEGACY_SOURCE_TYPE,
    sourceId,
    sourcePath,
    title: displayName || legacyTitle || headingTitle || sourceId,
    displayName,
    legacyTitle,
    suggestedRegion,
    priority: trackerRow?.priority || 'unknown',
  })
}

function buildLegacySourceEntry(station, casesBySourceKey) {
  const matchingCases = casesBySourceKey.get(sourceKey(station.sourceType, station.sourceId)) ?? []
  const targetCase = matchingCases[0]
  const sourceStatus = targetCase ? mapCaseStatusToSourceStatus(targetCase.status) : 'pending-review'

  return removeEmpty({
    ...station,
    sourceStatus,
    targetCasePath: targetCase?.path,
    targetCaseStatus: targetCase?.status,
    reviewStatus: targetCase?.reviewStatus,
    duplicateTargetCasePaths:
      matchingCases.length > 1
        ? matchingCases.map((item) => item.path).sort((a, b) => a.localeCompare(b))
        : undefined,
  })
}

function readCases() {
  return walk(CASES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const text = fs.readFileSync(file, 'utf8')
      const frontmatter = readFrontmatter(text)
      const casePath = toPosix(path.relative(ROOT, file))

      return {
        path: casePath,
        title: frontmatter.title || path.basename(file, '.mdx'),
        region: frontmatter.region || path.basename(path.dirname(file)),
        status: frontmatter.status || 'published',
        sourceType: frontmatter.sourceType || '',
        sourceId: frontmatter.sourceId || '',
        sourcePath: frontmatter.sourcePath || '',
        reviewStatus: frontmatter.reviewStatus || '',
      }
    })
}

function buildCasesBySourceKey(items) {
  const map = new Map()

  for (const item of items) {
    if (!item.sourceType || !item.sourceId) continue

    const key = sourceKey(item.sourceType, item.sourceId)
    const existing = map.get(key) ?? []
    existing.push(item)
    existing.sort(compareCaseEntries)
    map.set(key, existing)
  }

  return map
}

function readTrackerRowsById() {
  const rows = new Map()

  if (!fs.existsSync(TRACKER_FILE)) {
    return rows
  }

  const text = fs.readFileSync(TRACKER_FILE, 'utf8')

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue
    if (line.includes('---')) continue
    if (line.includes('Legacy ID')) continue

    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells.length < 6) continue

    rows.set(cells[0], {
      sourceId: cells[0],
      title: cells[1],
      region: cells[2],
      priority: cells[3],
      status: cells[4],
      targetNotes: cells[5],
    })
  }

  return rows
}

function readFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  if (!match) {
    return {}
  }

  const data = {}

  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (!item) continue

    const [, key, rawValue] = item
    data[key] = rawValue.replace(/^["']|["']$/g, '')
  }

  return data
}

function findMetadataValue(text, key) {
  const pattern = new RegExp(`^- ${escapeRegExp(key)}:\\s*(.+)$`, 'im')
  return text.match(pattern)?.[1]?.trim()
}

function meaningfulValue(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized || normalized.toLowerCase() === 'unknown') {
    return ''
  }

  return normalized
}

function mapCaseStatusToSourceStatus(status) {
  if (status === 'draft') return 'draft-created'
  if (status === 'published') return 'converted'
  if (status === 'archived') return 'archived'
  return 'pending-review'
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

function compareSourceEntries(a, b) {
  return (
    a.sourceType.localeCompare(b.sourceType) ||
    compareSourceIds(a.sourceId, b.sourceId) ||
    a.sourcePath.localeCompare(b.sourcePath)
  )
}

function compareCaseEntries(a, b) {
  return a.path.localeCompare(b.path)
}

function compareSourceIds(a, b) {
  const aNumber = Number(String(a).match(/^s(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)
  const bNumber = Number(String(b).match(/^s(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)

  if (aNumber !== bNumber) {
    return aNumber - bNumber
  }

  return String(a).localeCompare(String(b))
}

function sourceKey(sourceType, sourceId) {
  return `${sourceType}:${sourceId}`
}

function removeEmpty(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined) return false
      if (item === '') return false
      if (Array.isArray(item) && item.length === 0) return false
      return true
    }),
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
