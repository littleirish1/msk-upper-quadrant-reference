import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

const STATIONS_DIR = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted',
  'stations',
)

const CASES_DIR = path.join(ROOT, 'content', 'cases')

const TRACKER_FILE = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'migration-tracker.md',
)

const LEGACY_SOURCE_TYPE = 'legacy-html-case-bank'

if (!fs.existsSync(STATIONS_DIR)) {
  console.error(`Missing extracted stations directory: ${path.relative(ROOT, STATIONS_DIR)}`)
  process.exit(1)
}

if (!fs.existsSync(CASES_DIR)) {
  console.error(`Missing cases directory: ${path.relative(ROOT, CASES_DIR)}`)
  process.exit(1)
}

const stations = fs
  .readdirSync(STATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => readStation(path.join(STATIONS_DIR, entry.name)))
  .sort((a, b) => sortStationIds(a.id, b.id))

const legacyCases = walk(CASES_DIR)
  .filter((file) => file.endsWith('.mdx'))
  .map((file) => readCase(file))
  .filter((item) => item.frontmatter.sourceType === LEGACY_SOURCE_TYPE)

const casesBySourceId = new Map()

for (const item of legacyCases) {
  const sourceId = item.frontmatter.sourceId

  if (!sourceId) {
    continue
  }

  const existing = casesBySourceId.get(sourceId) ?? []
  existing.push(item)
  casesBySourceId.set(sourceId, existing)
}

const rows = []
const counts = new Map()
const unmatchedCaseRows = []

for (const station of stations) {
  const matchingCases = casesBySourceId.get(station.id) ?? []
  const row = buildStationRow(station, matchingCases)

  rows.push(row)
  counts.set(row.status, (counts.get(row.status) ?? 0) + 1)
}

const stationIds = new Set(stations.map((station) => station.id))

for (const item of legacyCases) {
  const sourceId = item.frontmatter.sourceId

  if (!sourceId || !stationIds.has(sourceId)) {
    unmatchedCaseRows.push(item)
  }
}

const output = `# Legacy Station Migration Tracker

This file tracks conversion of extracted legacy stations into the new guided case system.

Generated from:

- \`content/imports/html-case-bank/extracted/stations/*.md\`
- \`content/cases/**/*.mdx\`

## Status labels

- \`pending-review\` - extracted station with no matching generated case
- \`draft-created\` - matching guided case exists with \`status: "draft"\`
- \`converted\` - matching guided case exists with \`status: "published"\`
- \`archived\` - matching guided case exists with \`status: "archived"\`

## Station migration status

| Legacy ID | Title | Region | Priority | Status | Target / Notes |
|---|---|---|---|---|---|
${rows.map(formatRow).join('\n')}
${formatUnmatchedCasesSection(unmatchedCaseRows)}
`

fs.writeFileSync(TRACKER_FILE, output.trimEnd(), 'utf8')

console.log(`Wrote migration tracker: ${path.relative(ROOT, TRACKER_FILE)}`)
console.log(`Stations scanned: ${stations.length}`)
console.log(`Legacy-derived cases scanned: ${legacyCases.length}`)

for (const [status, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${status}: ${count}`)
}

if (unmatchedCaseRows.length > 0) {
  console.log(`Unmatched legacy-derived cases: ${unmatchedCaseRows.length}`)

  for (const item of unmatchedCaseRows) {
    console.log(`- ${item.relativePath} (sourceId: ${item.frontmatter.sourceId || 'missing'})`)
  }
} else {
  console.log('Unmatched legacy-derived cases: 0')
}

function readStation(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const relativePath = toPosix(path.relative(ROOT, file))

  return {
    id: findMetadataValue(text, 'Station ID') ?? path.basename(file).match(/^(s\d+)-/)?.[1] ?? '',
    title: findMetadataValue(text, 'Legacy title') ?? findHeadingTitle(text) ?? path.basename(file, '.md'),
    region: findMetadataValue(text, 'Suggested region') ?? 'unknown',
    difficulty: findMetadataValue(text, 'Difficulty') ?? '',
    sourcePath: relativePath,
  }
}

function readCase(file) {
  const text = fs.readFileSync(file, 'utf8')
  const frontmatter = parseFrontmatter(text)

  return {
    fullPath: file,
    relativePath: toPosix(path.relative(ROOT, file)),
    frontmatter,
  }
}

function buildStationRow(station, matchingCases) {
  if (matchingCases.length === 0) {
    return {
      legacyId: station.id,
      title: station.title,
      region: station.region || 'unknown',
      priority: inferPriority(station),
      status: 'pending-review',
      targetNotes: '',
    }
  }

  if (matchingCases.length > 1) {
    return {
      legacyId: station.id,
      title: station.title,
      region: station.region || 'unknown',
      priority: inferPriority(station),
      status: 'duplicate',
      targetNotes: matchingCases.map((item) => item.relativePath).join('; '),
    }
  }

  const item = matchingCases[0]
  const caseStatus = item.frontmatter.status
  const status = mapCaseStatus(caseStatus)
  const notes = [
    item.relativePath,
    item.frontmatter.reviewStatus ? `reviewStatus: ${item.frontmatter.reviewStatus}` : 'missing reviewStatus',
  ]

  if (item.frontmatter.sourcePath && item.frontmatter.sourcePath !== station.sourcePath) {
    notes.push(`sourcePath mismatch: ${item.frontmatter.sourcePath}`)
  }

  return {
    legacyId: station.id,
    title: station.title,
    region: station.region || 'unknown',
    priority: inferPriority(station),
    status,
    targetNotes: notes.join('; '),
  }
}

function mapCaseStatus(status) {
  if (status === 'draft') return 'draft-created'
  if (status === 'published') return 'converted'
  if (status === 'archived') return 'archived'
  return status ? `unknown-case-status:${status}` : 'unknown-case-status'
}

function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  if (!match) {
    return {}
  }

  const data = {}

  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)

    if (!item) {
      continue
    }

    const [, key, rawValue] = item
    data[key] = rawValue.replace(/^["']|["']$/g, '')
  }

  return data
}

function findMetadataValue(text, key) {
  const pattern = new RegExp(`^- ${escapeRegExp(key)}:\\s*(.+)$`, 'im')
  return text.match(pattern)?.[1]?.trim()
}

function findHeadingTitle(text) {
  return text.match(/^# Legacy Station Extract:\s*(.+)$/m)?.[1]?.trim()
}

function inferPriority(station) {
  const title = String(station.title ?? '').toLowerCase()
  const difficulty = String(station.difficulty ?? '').toLowerCase()

  if (
    difficulty.includes('high stakes') ||
    title.includes('myelopathy') ||
    title.includes('cauda') ||
    title.includes('rupture') ||
    title.includes('fracture') ||
    title.includes('red flag') ||
    title.includes('referral')
  ) {
    return 'high'
  }

  if (
    difficulty.includes('complex') ||
    title.includes('radiculopathy') ||
    title.includes('instability') ||
    title.includes('frozen') ||
    title.includes('rotator') ||
    title.includes('thoracic outlet')
  ) {
    return 'medium'
  }

  return 'normal'
}

function walk(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
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

function formatRow(row) {
  return [
    row.legacyId,
    row.title,
    row.region,
    row.priority,
    row.status,
    row.targetNotes,
  ].map(formatCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |')
}

function formatCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|')
}

function formatUnmatchedCasesSection(items) {
  if (items.length === 0) {
    return ''
  }

  const rows = items
    .map((item) => `- \`${item.relativePath}\` (sourceId: \`${item.frontmatter.sourceId || 'missing'}\`)`)
    .join('\n')

  return `

## Legacy-derived cases without matching extracted station

${rows}
`
}

function sortStationIds(a, b) {
  const aNumber = Number(String(a).match(/^s(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)
  const bNumber = Number(String(b).match(/^s(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER)

  if (aNumber !== bNumber) {
    return aNumber - bNumber
  }

  return String(a).localeCompare(String(b))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
