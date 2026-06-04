import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = process.cwd()

const INDEX_FILE = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted',
  'station-index.json'
)

const EXTRACT_SCRIPT = path.join(ROOT, 'scripts', 'extract-legacy-station.mjs')

if (!fs.existsSync(INDEX_FILE)) {
  console.error(`Station index not found: ${INDEX_FILE}`)
  console.error('Run: node scripts/extract-legacy-html.mjs')
  process.exit(1)
}

if (!fs.existsSync(EXTRACT_SCRIPT)) {
  console.error(`Extractor not found: ${EXTRACT_SCRIPT}`)
  process.exit(1)
}

const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))

if (!Array.isArray(index.stations)) {
  console.error('station-index.json does not contain a stations array')
  process.exit(1)
}

let success = 0
let failed = 0

for (const station of index.stations) {
  if (!station.id) {
    failed++
    console.warn('Skipping station without id:', station)
    continue
  }

  console.log(`\nExtracting ${station.id}: ${station.title || 'Untitled'}`)

  const result = spawnSync(
    process.execPath,
    [EXTRACT_SCRIPT, station.id],
    {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
    }
  )

  if (result.status === 0) {
    success++
  } else {
    failed++
    console.warn(`Failed to extract ${station.id}`)
  }
}

console.log('\nLegacy station extraction complete.')
console.log(`Successful: ${success}`)
console.log(`Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
}