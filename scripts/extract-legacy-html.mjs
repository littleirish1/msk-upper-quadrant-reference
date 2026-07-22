import fs from 'fs'
import path from 'path'
import {
  LEGACY_SOURCE_PROVENANCE,
  readVerifiedLegacySource,
  resolveLegacySourcePath,
} from './lib/legacySourceProvenance.mjs'

const ROOT = process.cwd()

const sourceArg = process.argv[2] || process.env.LEGACY_HTML_SOURCE

if (!sourceArg) {
  console.error('Usage: node scripts/extract-legacy-html.mjs <path-to-private-legacy-html>')
  console.error('Alternatively set LEGACY_HTML_SOURCE.')
  console.error('The raw legacy HTML is intentionally not stored in this repository.')
  process.exit(1)
}

const INPUT_FILE = resolveLegacySourcePath(sourceArg)

const OUTPUT_DIR = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted'
)

const OUTPUT_FILE = path.join(OUTPUT_DIR, 'station-index.json')

let sourceBytes
try {
  sourceBytes = readVerifiedLegacySource(INPUT_FILE)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const html = sourceBytes.toString('utf8')

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

if (stations.length !== LEGACY_SOURCE_PROVENANCE.stationCount) {
  console.error(`Expected ${LEGACY_SOURCE_PROVENANCE.stationCount} stations, found ${stations.length}.`)
  process.exit(1)
}

const output = {
  ...LEGACY_SOURCE_PROVENANCE,
  extractedAt: new Date().toISOString(),
  count: stations.length,
  stations,
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8')

console.log(`Extracted ${stations.length} stations`)
console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`)

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