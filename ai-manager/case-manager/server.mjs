import http from 'http'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')
const PUBLIC_DIR = path.join(__dirname, 'public')
const PORT = 4000

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

    if (url.pathname === '/api/status') {
      return sendJson(res, await getProjectStatus())
    }

    if (url.pathname === '/api/cases') {
      return sendJson(res, getCases())
    }

    if (url.pathname === '/api/tracker') {
      return sendJson(res, getTracker())
    }

    if (url.pathname === '/api/station') {
      const id =
        url.searchParams.get('id') ||
        url.searchParams.get('stationId') ||
        url.searchParams.get('station') ||
        ''

      return sendJson(res, getStationWithConversionSuggestion(id))
    }

    if (url.pathname === '/api/create-draft' && req.method === 'POST') {
      const body = await readRequestJson(req)
      return sendJson(res, createDraftCase(body))
    }

    if (url.pathname === '/api/case-status' && req.method === 'POST') {
      const body = await readRequestJson(req)
      return sendJson(res, updateCaseStatus(body))
    }

    if (url.pathname === '/api/preflight' && req.method === 'POST') {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      const result = await run(npmCommand, ['run', 'preflight'])

      return sendJson(res, {
        ok: result.ok,
        output: result.output,
      })
    }

    if (url.pathname === '/') {
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html')
    }

    const filePath = path.join(PUBLIC_DIR, url.pathname)
    if (
      filePath.startsWith(PUBLIC_DIR) &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile()
    ) {
      const ext = path.extname(filePath)
      const type =
        ext === '.css'
          ? 'text/css'
          : ext === '.js'
            ? 'text/javascript'
            : 'text/plain'

      return sendFile(res, filePath, type)
    }

    res.writeHead(404)
    res.end('Not found')
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: String(error) }, null, 2))
  }
})

server.listen(PORT, () => {
  console.log(`Case Manager running at http://localhost:${PORT}`)
})

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data, null, 2))
}

function sendFile(res, filePath, contentType) {
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(fs.readFileSync(filePath))
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })

    req.on('error', reject)
  })
}

function run(command, args) {
  const fullCommand = [command, ...args].join(' ')

  return new Promise((resolve) => {
    exec(fullCommand, { cwd: ROOT, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        output: `${stdout}${stderr}`.trim(),
      })
    })
  })
}

async function getProjectStatus() {
  const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git'
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  const git = await run(gitCommand, ['status', '--short'])
  const hygiene = await run(npmCommand, ['run', 'check:hygiene'])

  return {
    git: git.ok ? (git.output || 'clean') : `failed\n${git.output}`,
    hygiene: hygiene.ok ? 'passed' : `failed\n${hygiene.output}`,
  }
}

function getCases() {
  const casesDir = path.join(ROOT, 'content', 'cases')
  const cases = []

  if (!fs.existsSync(casesDir)) return cases

  walk(casesDir, (file) => {
    if (!file.endsWith('.mdx')) return

    const text = fs.readFileSync(file, 'utf8')
    const fm = readFrontmatter(text)

    cases.push({
      title: fm.title || path.basename(file, '.mdx'),
      region: fm.region || path.basename(path.dirname(file)),
      condition: fm.condition || '',
      difficulty: fm.difficulty || '',
      status: fm.status || 'published',
      path: path.relative(ROOT, file),
    })
  })

  return cases.sort((a, b) => a.title.localeCompare(b.title))
}

function getTracker() {
  const trackerPath = path.join(ROOT, 'content', 'imports', 'html-case-bank', 'migration-tracker.md')

  if (!fs.existsSync(trackerPath)) {
    return { pending: [], draftCreated: [], converted: [], archived: [] }
  }

  const text = fs.readFileSync(trackerPath, 'utf8')
  const lines = text.split(/\r?\n/)

  const pending = []
  const draftCreated = []
  const converted = []
  const archived = []

  for (const line of lines) {
    if (!line.startsWith('|')) continue
    if (line.includes('---')) continue
    if (line.includes('Legacy ID')) continue

    const cells = line.slice(1, -1).split('|').map((cell) => cell.trim())
    if (cells.length < 6) continue

    const row = {
      id: cells[0] || '',
      title: cells[1] || '',
      region: cells[2] || '',
      priority: cells[3] || '',
      status: cells[4] || '',
      target: cells[5] || '',
      notes: cells[5] || '',
    }

    if (row.status === 'pending-review') pending.push(row)
    if (row.status === 'draft-created') draftCreated.push(row)
    if (row.status === 'converted') converted.push(row)
    if (row.status === 'archived') archived.push(row)
  }

  return {
    pending,
    draftCreated,
    converted,
    archived,
  }
}

function getStation(id) {
  if (!id) {
    return { error: 'Missing station id' }
  }

  const stationsDir = path.join(
    ROOT,
    'content',
    'imports',
    'html-case-bank',
    'extracted',
    'stations'
  )

  if (!fs.existsSync(stationsDir)) {
    return { error: 'Extracted stations folder not found' }
  }

  let normalizedId = String(id).toLowerCase().trim()

  if (/^\d+$/.test(normalizedId)) {
    normalizedId = `s${normalizedId}`
  }

  const files = fs.readdirSync(stationsDir)

  const match = files.find((file) => {
    const lower = file.toLowerCase()
    return (
      lower === `${normalizedId}.md` ||
      lower.startsWith(`${normalizedId}-`) ||
      lower.startsWith(`${normalizedId}_`)
    ) && lower.endsWith('.md')
  })

  if (!match) {
    return { error: `No extracted station file found for ${id}` }
  }

  const filePath = path.join(stationsDir, match)
  const text = fs.readFileSync(filePath, 'utf8')

  return {
    id: normalizedId,
    file: path.relative(ROOT, filePath),
    text,
  }
}

function getStationWithConversionSuggestion(id) {
  const station = getStation(id)

  if (station.error) {
    return station
  }

  const meta = extractStationMetadata(station.text)
  const titleBase = meta.legacyTitle || meta.displayName || station.id
  const region = normalizeRegion(meta.suggestedRegion || inferRegion(titleBase))
  const conditionSlug = slugify(meta.legacyTitle || meta.displayName || station.id)
  const caseSlug = `${conditionSlug}-case-01`
  const difficulty = inferDifficulty(meta.difficulty || meta.legacyTitle || titleBase)
  const targetFile = path.join('content', 'cases', region, `${caseSlug}.mdx`)
  const targetExists = fs.existsSync(path.join(ROOT, targetFile))

  return {
    ...station,
    conversion: {
      stationId: station.id,
      displayName: meta.displayName || '',
      legacyTitle: meta.legacyTitle || '',
      suggestedRegion: region,
      suggestedTitle: `${toTitleCase(region)} Case: ${titleBase}`,
      suggestedConditionSlug: conditionSlug,
      suggestedCaseSlug: caseSlug,
      suggestedDifficulty: difficulty,
      estimatedTime: '10-15 minutes',
      suggestedTargetFile: targetFile,
      recommendedStatus: 'draft',
      targetExists,
    },
  }
}

function createDraftCase(payload) {
  const stationId = String(payload.stationId || '').trim()
  const region = normalizeRegion(payload.region || '')
  const title = String(payload.title || '').trim()
  const conditionSlug = slugify(payload.conditionSlug || '')
  const caseSlug = slugify(payload.caseSlug || '')
  const difficulty = String(payload.difficulty || 'advanced').trim()
  const estimatedTime = String(payload.estimatedTime || '10-15 minutes').trim()

  if (!stationId || !region || !title || !conditionSlug || !caseSlug) {
    throw new Error('Missing required draft fields.')
  }

  const station = getStation(stationId)

  if (station.error) {
    throw new Error(station.error)
  }

  const targetDir = path.join(ROOT, 'content', 'cases', region)
  const targetFile = path.join(targetDir, `${caseSlug}.mdx`)

  if (fs.existsSync(targetFile)) {
    throw new Error(`Target file already exists: ${path.relative(ROOT, targetFile)}`)
  }

  fs.mkdirSync(targetDir, { recursive: true })

  const mdx = buildDraftMdx({
    title,
    region,
    conditionSlug,
    difficulty,
    estimatedTime,
    sourceFile: station.file.replaceAll('\\', '/'),
    sourceText: station.text,
  })

  fs.writeFileSync(targetFile, mdx, 'utf8')

  return {
    ok: true,
    file: path.relative(ROOT, targetFile),
  }
}
function updateCaseStatus(payload) {
  const relativePath = String(payload.path || '').trim()
  const status = String(payload.status || '').trim().toLowerCase()

  const allowed = new Set(['draft', 'published', 'archived'])

  if (!relativePath || !status) {
    throw new Error('Missing path or status.')
  }

  if (!allowed.has(status)) {
    throw new Error(`Unsupported status: ${status}`)
  }

  const filePath = path.resolve(ROOT, relativePath)

  if (!filePath.startsWith(ROOT)) {
    throw new Error('Refusing to edit file outside project root.')
  }

  if (!filePath.endsWith('.mdx')) {
    throw new Error('Can only update MDX case files.')
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${relativePath}`)
  }

  const text = fs.readFileSync(filePath, 'utf8')
  const updated = setFrontmatterStatus(text, status)

  fs.writeFileSync(filePath, updated, 'utf8')

  return {
    ok: true,
    file: relativePath,
    status,
  }
}
function setFrontmatterStatus(text, status) {
  if (!text.startsWith('---')) {
    throw new Error('File does not start with frontmatter.')
  }

  const parts = text.split('---')

  if (parts.length < 3) {
    throw new Error('Invalid frontmatter.')
  }

  const frontmatter = parts[1]
  const body = parts.slice(2).join('---')

  let found = false
  const updatedLines = frontmatter.split(/\r?\n/).map((line) => {
    if (line.match(/^status:\s*/)) {
      found = true
      return `status: "${status}"`
    }

    return line
  })

  if (!found) {
    const caseTypeIndex = updatedLines.findIndex((line) => line.match(/^caseType:\s*/))

    if (caseTypeIndex >= 0) {
      updatedLines.splice(caseTypeIndex + 1, 0, `status: "${status}"`)
    } else {
      updatedLines.push(`status: "${status}"`)
    }
  }

  return `---${updatedLines.join('\n')}---${body}`
}
function buildDraftMdx({
  title,
  region,
  conditionSlug,
  difficulty,
  estimatedTime,
  sourceFile,
  sourceText,
}) {
  const today = new Date().toISOString().slice(0, 10)
  const sourceExcerpt = extractUsefulSource(sourceText)

  return `---
title: "${escapeYaml(title)}"
region: "${escapeYaml(region)}"
condition: "${escapeYaml(conditionSlug)}"
difficulty: "${escapeYaml(difficulty)}"
caseType: "guided-reasoning"
status: "draft"
learningFocus:
  - "Primary diagnosis"
  - "Differential diagnosis"
  - "Red flag reasoning"
  - "Management reasoning"
estimatedTime: "${escapeYaml(estimatedTime)}"
lastReviewed: "${today}"
reviewedBy: "Eoin Casey"
---

# ${title}

> Draft generated from legacy station. Review before publishing.

## Case presentation

TODO: Rewrite the case presentation from the source material below.

<ReasoningPrompt question="What is your leading clinical hypothesis, and what features support it?" />

<RevealAnswer>
TODO: Add reviewed reasoning.

</RevealAnswer>

## Differential diagnosis

<ReasoningPrompt question="What are your top differentials, and what would make each more or less likely?" />

<RevealAnswer>
TODO: Add reviewed differential reasoning.

</RevealAnswer>

## Red flag / referral reasoning

<ReasoningPrompt question="What red flags, safety concerns, or referral decisions matter in this case?" />

<RevealAnswer>
TODO: Add reviewed safety/referral reasoning.

</RevealAnswer>

## Objective assessment

<ReasoningPrompt question="What would you prioritise in your objective assessment?" />

<RevealAnswer>
TODO: Add reviewed objective assessment plan.

</RevealAnswer>

## Expected findings

<ReasoningPrompt question="What findings would support your leading hypothesis?" />

<RevealAnswer>
TODO: Add reviewed expected findings.

</RevealAnswer>

## Management reasoning

<ReasoningPrompt question="What would your immediate management focus on, and why?" />

<RevealAnswer>
TODO: Add reviewed management reasoning.

</RevealAnswer>

## Communication

<ReasoningPrompt question="How would you explain your concern and plan to the patient?" />

<RevealAnswer>
TODO: Add reviewed communication example.

</RevealAnswer>

## Common traps

<RevealAnswer title="Common traps in this case">
TODO: Add reviewed common traps.

</RevealAnswer>

## Linked evidence and condition pages

Suggested linked condition page:

- \`/${region}/${conditionSlug}/\`

Legacy source:

- \`${sourcePath}\`

## Legacy source notes for review

${sourceExcerpt}
`
}

function extractUsefulSource(sourceText) {
  const sectionsToKeep = new Set([
    '## Scenario history',
    '## Scenario examination / objective findings',
    '## Safety flags / red flags',
    '## Legacy diagnosis',
    '## Legacy reasoning',
    '## Clinical traps',
    '## Legacy domain content',
  ])

  const lines = sourceText.split(/\r?\n/)
  const chunks = []
  let keep = false

  for (const line of lines) {
    if (line.startsWith('## ')) {
      keep = sectionsToKeep.has(line.trim())
    }

    if (keep) {
      chunks.push(line)
    }
  }

  return chunks.join('\n').trim() || '_No source notes extracted._'
}

function extractStationMetadata(text) {
  const meta = {}

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (trimmed.startsWith('- Legacy title:')) {
      meta.legacyTitle = trimmed.replace('- Legacy title:', '').trim()
    }

    if (trimmed.startsWith('- Display name:')) {
      meta.displayName = trimmed.replace('- Display name:', '').trim()
    }

    if (trimmed.startsWith('- Difficulty:')) {
      meta.difficulty = trimmed.replace('- Difficulty:', '').trim()
    }

    if (trimmed.startsWith('- Suggested region:')) {
      meta.suggestedRegion = trimmed.replace('- Suggested region:', '').trim()
    }

    if (trimmed.startsWith('- Suggested case slug:')) {
      meta.suggestedCaseSlug = trimmed.replace('- Suggested case slug:', '').trim()
    }
  }

  return meta
}

function normalizeRegion(value) {
  const normalized = slugify(value || '')

  const aliases = {
    wrist: 'wrist-hand',
    hand: 'wrist-hand',
    'wrist-hand': 'wrist-hand',
    'wrist-and-hand': 'wrist-hand',
    neck: 'cervical',
    cspine: 'cervical',
    'c-spine': 'cervical',
    cervical: 'cervical',
    shoulder: 'shoulder',
    elbow: 'elbow',
    thoracic: 'thoracic',
    tspine: 'thoracic',
    't-spine': 'thoracic',
    unknown: 'unknown',
  }

  return aliases[normalized] ?? normalized
}

function inferRegion(title) {
  const text = String(title || '').toLowerCase()

  if (text.includes('cervical') || text.includes('neck') || text.includes('myelopathy') || text.includes('radiculopathy') || text.includes('headache')) {
    return 'cervical'
  }

  if (text.includes('shoulder') || text.includes('rotator') || text.includes('capsulitis') || text.includes('instability')) {
    return 'shoulder'
  }

  if (text.includes('elbow') || text.includes('biceps') || text.includes('epicondyl') || text.includes('olecranon')) {
    return 'elbow'
  }

  if (text.includes('wrist') || text.includes('hand') || text.includes('thumb') || text.includes('scaphoid') || text.includes('tfcc') || text.includes('trigger finger') || text.includes('ganglion')) {
    return 'wrist-hand'
  }

  if (text.includes('thoracic') || text.includes('rib') || text.includes('visceral')) {
    return 'thoracic'
  }

  return 'unknown'
}

function inferDifficulty(value) {
  const text = String(value || '').toLowerCase()

  if (text.includes('high') || text.includes('myelopathy') || text.includes('fracture') || text.includes('red flag') || text.includes('visceral') || text.includes('spondyloarthropathy') || text.includes('neuropathy')) {
    return 'advanced'
  }

  if (text.includes('moderate') || text.includes('radiculopathy') || text.includes('instability') || text.includes('rupture')) {
    return 'intermediate'
  }

  return 'early-intermediate'
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTitleCase(text) {
  return String(text || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('/')
}

function escapeYaml(value) {
  return String(value || '').replace(/"/g, '\\"')
}

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath, callback)
    } else {
      callback(fullPath)
    }
  }
}

function readFrontmatter(text) {
  if (!text.startsWith('---')) return {}

  const parts = text.split('---')
  if (parts.length < 3) return {}

  const fm = {}

  for (const line of parts[1].split(/\r?\n/)) {
    if (!line.includes(':')) continue
    const [key, ...rest] = line.split(':')
    fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '')
  }

  return fm
}
