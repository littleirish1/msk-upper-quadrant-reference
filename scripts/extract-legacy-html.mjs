import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

const INPUT_FILE = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'raw',
  'index.html'
)

const OUTPUT_DIR = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted'
)

const OUTPUT_FILE = path.join(OUTPUT_DIR, 'station-index.json')

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`Legacy HTML not found: ${INPUT_FILE}`)
  process.exit(1)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const html = fs.readFileSync(INPUT_FILE, 'utf8')

// First pass: extract station metadata from the old JS object array.
// This intentionally avoids trying to fully parse the whole legacy JS file.
// It gives us a safe station index to review before deeper conversion.
const stationRegex =
  /id:\s*'([^']+)'\s*,\s*num:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'\s*,\s*diff:\s*'([^']+)'\s*,\s*diffLabel:\s*'([^']+)'/g

const stations = []
let match

while ((match = stationRegex.exec(html)) !== null) {
  const [, id, num, title, diff, diffLabel] = match

  stations.push({
    id,
    num,
    title,
    diff,
    diffLabel,
    suggestedRegion: inferRegion(title),
    suggestedCaseSlug: slugify(title) + '-case-legacy',
    status: 'extracted-not-reviewed',
  })
}

const output = {
  source: 'content/imports/html-case-bank/raw/index.html',
  extractedAt: new Date().toISOString(),
  count: stations.length,
  stations,
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8')

console.log(`Extracted ${stations.length} stations`)
console.log(`Wrote ${OUTPUT_FILE}`)

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferRegion(title) {
  const t = title.toLowerCase()

  if (t.includes('cervical') || t.includes('neck') || t.includes('headache') || t.includes('myelopathy')) {
    return 'cervical'
  }

  if (t.includes('shoulder') || t.includes('rotator') || t.includes('frozen') || t.includes('instability')) {
    return 'shoulder'
  }

  if (t.includes('elbow') || t.includes('epicondyl')) {
    return 'elbow'
  }

  if (t.includes('wrist') || t.includes('hand') || t.includes('carpal') || t.includes('thumb')) {
    return 'wrist-hand'
  }

  if (t.includes('thoracic') || t.includes('rib')) {
    return 'thoracic'
  }

  return 'unknown'
}