import fs from 'fs'
import path from 'path'
import readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const ROOT = process.cwd()

const INDEX_FILE = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted',
  'station-index.json'
)

const TRACKER_FILE = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'migration-tracker.md'
)

const EXTRACTED_STATIONS_DIR = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted',
  'stations'
)

const TEMPLATE_FILE = path.join(
  ROOT,
  'content',
  '_TEMPLATE',
  'cases',
  'guided-case-template.mdx'
)

if (!fs.existsSync(INDEX_FILE)) {
  console.error(`Missing station index: ${INDEX_FILE}`)
  process.exit(1)
}

if (!fs.existsSync(TEMPLATE_FILE)) {
  console.error(`Missing guided case template: ${TEMPLATE_FILE}`)
  process.exit(1)
}

const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))

if (!Array.isArray(index.stations)) {
  console.error('station-index.json does not contain a stations array')
  process.exit(1)
}

const trackerText = fs.existsSync(TRACKER_FILE)
  ? fs.readFileSync(TRACKER_FILE, 'utf8')
  : ''

const pendingStations = index.stations.filter((station) => {
  const rowRegex = new RegExp(`\\|\\s*${escapeRegex(station.id)}\\s*\\|[^\\n]*\\|\\s*converted\\s*\\|`, 'i')
  return !rowRegex.test(trackerText)
})

if (pendingStations.length === 0) {
  console.log('No pending stations found.')
  process.exit(0)
}

console.log('\nPending legacy stations:\n')

for (const station of pendingStations) {
  console.log(
    `${station.id.padEnd(4)} | ${(station.suggestedRegion ?? 'unknown').padEnd(11)} | ${station.title}`
  )
}

const rl = readline.createInterface({ input, output })

const selectedId = (await rl.question('\nEnter station ID to prepare, e.g. s44: ')).trim()

const station = pendingStations.find((item) => item.id.toLowerCase() === selectedId.toLowerCase())

if (!station) {
  console.error(`Station not found or already converted: ${selectedId}`)
  rl.close()
  process.exit(1)
}

const sourceFile = findExtractedStationFile(station.id)

if (!sourceFile) {
  console.error(`No extracted station markdown found for ${station.id}`)
  console.error(`Expected file in: ${EXTRACTED_STATIONS_DIR}`)
  rl.close()
  process.exit(1)
}

console.log('\nSelected station:')
console.log(`ID: ${station.id}`)
console.log(`Title: ${station.title}`)
console.log(`Suggested region: ${station.suggestedRegion ?? 'unknown'}`)
console.log(`Source: ${path.relative(ROOT, sourceFile)}`)

const defaultRegion = station.suggestedRegion && station.suggestedRegion !== 'unknown'
  ? station.suggestedRegion
  : 'cervical'

const region = (await rl.question(`\nRegion [${defaultRegion}]: `)).trim() || defaultRegion

const defaultTitle = `${toTitleCase(region)} Case: ${station.title}`
const title = (await rl.question(`Case title [${defaultTitle}]: `)).trim() || defaultTitle

const defaultCondition = slugify(station.title)
const condition = (await rl.question(`Condition slug [${defaultCondition}]: `)).trim() || defaultCondition

const defaultSlug = `${slugify(station.title)}-case-01`
const caseSlug = (await rl.question(`Case file slug [${defaultSlug}]: `)).trim() || defaultSlug

const defaultDifficulty = inferDifficulty(station.title)
const difficulty = (await rl.question(`Difficulty [${defaultDifficulty}]: `)).trim() || defaultDifficulty

const estimatedTime = (await rl.question('Estimated time [10-15 minutes]: ')).trim() || '10-15 minutes'

const targetDir = path.join(ROOT, 'content', 'cases', region)
const targetFile = path.join(targetDir, `${caseSlug}.mdx`)

if (fs.existsSync(targetFile)) {
  console.error(`\nTarget file already exists: ${path.relative(ROOT, targetFile)}`)
  console.error('No changes made.')
  rl.close()
  process.exit(1)
}

const sourceText = fs.readFileSync(sourceFile, 'utf8')
const templateText = fs.readFileSync(TEMPLATE_FILE, 'utf8')

const draft = buildDraftCase({
  station,
  sourceRelative: path.relative(ROOT, sourceFile).replaceAll('\\', '/'),
  title,
  region,
  condition,
  difficulty,
  estimatedTime,
  sourceText,
  templateText,
})

console.log('\nTarget draft file:')
console.log(path.relative(ROOT, targetFile))

const confirm = (await rl.question('\nCreate this draft case file? (y/N): ')).trim().toLowerCase()

if (confirm !== 'y' && confirm !== 'yes') {
  console.log('Cancelled. No changes made.')
  rl.close()
  process.exit(0)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.writeFileSync(targetFile, draft, 'utf8')

console.log('\nDraft case created:')
console.log(path.relative(ROOT, targetFile))
console.log('\nNext steps:')
console.log('1. Review and rewrite the draft MDX.')
console.log('2. Run: npm run check:hygiene')
console.log('3. Run: npm run build')
console.log('4. Commit the case and update migration tracker.')

rl.close()

function findExtractedStationFile(stationId) {
  if (!fs.existsSync(EXTRACTED_STATIONS_DIR)) return null

  const files = fs.readdirSync(EXTRACTED_STATIONS_DIR)
  const match = files.find((file) => file.startsWith(`${stationId}-`) && file.endsWith('.md'))

  return match ? path.join(EXTRACTED_STATIONS_DIR, match) : null
}

function buildDraftCase({
  station,
  sourceRelative,
  title,
  region,
  condition,
  difficulty,
  estimatedTime,
  sourceText,
}) {
  const today = new Date().toISOString().slice(0, 10)
  const sourceExcerpt = extractUsefulSource(sourceText)

  return `---
title: "${escapeYaml(title)}"
region: "${escapeYaml(region)}"
condition: "${escapeYaml(condition)}"
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

> Draft generated from legacy station ${station.id}. Review before publishing.

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

- \`/${region}/${condition}/\`

Legacy source:

- \`${sourceRelative}\`

## Legacy source notes for review

${sourceExcerpt}
`
}

function extractUsefulSource(sourceText) {
  const sectionsToKeep = [
    '## Scenario history',
    '## Scenario examination / objective findings',
    '## Safety flags / red flags',
    '## Legacy diagnosis',
    '## Legacy reasoning',
    '## Clinical traps',
    '## Legacy domain content',
  ]

  const lines = sourceText.split(/\r?\n/)
  const chunks = []
  let keep = false

  for (const line of lines) {
    if (line.startsWith('## ')) {
      keep = sectionsToKeep.includes(line.trim())
    }

    if (keep) {
      chunks.push(line)
    }
  }

  return chunks.join('\n').trim() || '_No source notes extracted._'
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTitleCase(text) {
  return String(text || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferDifficulty(title) {
  const t = String(title || '').toLowerCase()

  if (
    t.includes('myelopathy') ||
    t.includes('fracture') ||
    t.includes('red flag') ||
    t.includes('visceral') ||
    t.includes('spondyloarthropathy') ||
    t.includes('neuropathy')
  ) {
    return 'advanced'
  }

  if (
    t.includes('radiculopathy') ||
    t.includes('instability') ||
    t.includes('rupture')
  ) {
    return 'intermediate'
  }

  return 'early-intermediate'
}

function escapeYaml(value) {
  return String(value || '').replace(/"/g, '\\"')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}