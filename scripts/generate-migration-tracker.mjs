import fs from 'fs'
import path from 'path'

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

const converted = new Map([
  ['s28', {
    newCase: 'content/cases/elbow/distal-biceps-rupture-case-01.mdx',
    status: 'converted',
    notes: 'Acute referral reasoning case',
  }],
])

const manualCases = [
  {
    legacyId: 'manual',
    title: 'RCRSP case',
    newCase: 'content/cases/shoulder/rcrsp-case-01.mdx',
    status: 'converted',
    notes: 'Created manually before legacy extraction',
  },
  {
    legacyId: 'manual',
    title: 'Adhesive capsulitis case',
    newCase: 'content/cases/shoulder/adhesive-capsulitis-case-01.mdx',
    status: 'converted',
    notes: 'Created manually before legacy extraction',
  },
  {
    legacyId: 'manual',
    title: 'Cervical radiculopathy case',
    newCase: 'content/cases/cervical/cervical-radiculopathy-case-01.mdx',
    status: 'converted',
    notes: 'Created manually before legacy extraction',
  },
]

if (!fs.existsSync(INDEX_FILE)) {
  console.error(`Missing station index: ${INDEX_FILE}`)
  process.exit(1)
}

const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))

if (!Array.isArray(index.stations)) {
  console.error('station-index.json does not contain a stations array')
  process.exit(1)
}

const convertedRows = []

for (const manual of manualCases) {
  convertedRows.push(
    `| ${manual.legacyId} | ${manual.title} | ${manual.newCase} | ${manual.status} | ${manual.notes} |`
  )
}

for (const station of index.stations) {
  if (!converted.has(station.id)) continue

  const item = converted.get(station.id)
  convertedRows.push(
    `| ${station.id} | ${station.title} | ${item.newCase} | ${item.status} | ${item.notes} |`
  )
}

const pendingRows = index.stations
  .filter((station) => !converted.has(station.id))
  .map((station) => {
    const priority = inferPriority(station)
    return `| ${station.id} | ${station.title} | ${station.suggestedRegion ?? 'unknown'} | ${priority} | pending-review |  |`
  })

const output = `# Legacy Station Migration Tracker

This file tracks conversion of extracted legacy stations into the new guided case system.

Generated from:

\`content/imports/html-case-bank/extracted/station-index.json\`

## Status labels

- \`pending-review\` — extracted but not reviewed
- \`selected\` — chosen for conversion
- \`converted\` — converted into a guided case MDX file
- \`needs-edit\` — converted but requires clinical/content review
- \`skipped\` — not suitable for migration
- \`duplicate\` — overlaps with an existing guided case

## Converted cases

| Legacy ID | Legacy title | New guided case | Status | Notes |
|---|---|---|---|---|
${convertedRows.join('\n')}

## Pending review

| Legacy ID | Legacy title | Suggested region | Priority | Status | Notes |
|---|---|---|---|---|---|
${pendingRows.join('\n')}
`

fs.writeFileSync(TRACKER_FILE, output, 'utf8')

console.log(`Wrote migration tracker: ${TRACKER_FILE}`)
console.log(`Converted rows: ${convertedRows.length}`)
console.log(`Pending rows: ${pendingRows.length}`)

function inferPriority(station) {
  const title = String(station.title ?? '').toLowerCase()

  if (
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