import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const ROOT = process.cwd()
const REPORT_FILE = path.join(ROOT, 'ai-manager', 'demo-report.md')
const REGISTRY_FILE = path.join(ROOT, 'content', 'imports', 'source-registry.json')
const TRACKER_FILE = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'migration-tracker.md')
const CASES_DIR = path.join(ROOT, 'content', 'cases')

const registry = readJson(REGISTRY_FILE, {
  sources: [],
  linkedCases: [],
  unlinkedCases: [],
  summary: {},
})

const cases = readCases()
const trackerSummary = readTrackerSummary()
const caseCounts = countBy(cases, (item) => item.status)
const draftCreatedSources = registry.sources.filter((item) => item.sourceStatus === 'draft-created')
const convertedSources = registry.sources.filter((item) => item.sourceStatus === 'converted')
const branch = getCurrentBranch()
const preflightStatus = getPreflightStatus()

const report = `# Case Manager Demo Report

## Project

- Branch: ${branch}
- Project root: ${toPosix(ROOT)}
- Preflight status: ${preflightStatus}

## Case Counts

- Total cases: ${cases.length}
- Published: ${caseCounts.published ?? 0}
- Draft: ${caseCounts.draft ?? 0}
- Archived: ${caseCounts.archived ?? 0}

## Source Registry Summary

- Total sources: ${registry.summary.totalSources ?? 0}
- Pending review: ${registry.summary.pendingReview ?? 0}
- Draft created: ${registry.summary.draftCreated ?? 0}
- Converted: ${registry.summary.converted ?? 0}
- Archived: ${registry.summary.archived ?? 0}
- Linked cases: ${registry.summary.linkedCases ?? 0}
- Unlinked cases: ${registry.summary.unlinkedCases ?? 0}

## Tracker Summary

- Pending review: ${trackerSummary['pending-review'] ?? 0}
- Draft created: ${trackerSummary['draft-created'] ?? 0}
- Converted: ${trackerSummary.converted ?? 0}
- Archived: ${trackerSummary.archived ?? 0}

## Draft-Created Sources

${formatSourceList(draftCreatedSources)}

## Converted Sources

${formatSourceList(convertedSources)}

## Unlinked Cases

${formatCaseList(registry.unlinkedCases)}
`

fs.writeFileSync(REPORT_FILE, report, 'utf8')

console.log(`Wrote demo report: ${toPosix(path.relative(ROOT, REPORT_FILE))}`)

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readCases() {
  if (!fs.existsSync(CASES_DIR)) return []

  return walk(CASES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const frontmatter = readFrontmatter(fs.readFileSync(file, 'utf8'))

      return {
        path: toPosix(path.relative(ROOT, file)),
        title: frontmatter.title || path.basename(file, '.mdx'),
        status: frontmatter.status || 'published',
      }
    })
}

function readTrackerSummary() {
  const summary = {}

  if (!fs.existsSync(TRACKER_FILE)) return summary

  for (const line of fs.readFileSync(TRACKER_FILE, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('|')) continue
    if (line.includes('---')) continue
    if (line.includes('Legacy ID')) continue

    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
    const status = cells[4]
    if (!status) continue

    summary[status] = (summary[status] ?? 0) + 1
  }

  return summary
}

function getCurrentBranch() {
  try {
    return execSync('git -c safe.directory=C:/dev/msk-upper-quadrant-reference branch --show-current', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function getPreflightStatus() {
  const buildId = path.join(ROOT, '.next', 'BUILD_ID')
  return fs.existsSync(buildId)
    ? 'build artifacts present from latest Next build'
    : 'not available in local build artifacts'
}

function readFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (!item) continue

    const [, key, rawValue] = item
    data[key] = rawValue.replace(/^["']|["']$/g, '')
  }

  return data
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
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

function formatSourceList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '_None._'
  }

  return items
    .map((item) => `- ${item.sourceId}: ${item.legacyTitle || item.title} -> ${item.targetCasePath || 'no target case'}`)
    .join('\n')
}

function formatCaseList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '_None._'
  }

  return items
    .map((item) => `- ${item.title} (${item.status}) - ${item.path}`)
    .join('\n')
}

function toPosix(value) {
  return String(value).replace(/\\/g, '/')
}
