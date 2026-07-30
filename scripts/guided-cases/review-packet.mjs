import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  JSON_SCHEMA_FILE,
  REPORTS_DIR,
  ROOT,
  collectRecordFiles,
  readJson,
} from './shared.mjs'

const outputArg = process.argv.find((value) => value.startsWith('--output='))?.slice('--output='.length)
if (!outputArg) throw new Error('Use --output=<directory outside public output>')
const output = path.resolve(outputArg)
if (output.startsWith(path.join(ROOT, 'public')) || output.startsWith(path.join(ROOT, 'out'))) {
  throw new Error('Review packets cannot be written into public output')
}
const selectedIds = process.argv
  .filter((value) => value.startsWith('--case='))
  .map((value) => value.slice('--case='.length))
const recordFiles = collectRecordFiles()
  .filter((file) => selectedIds.length === 0 || selectedIds.includes(readJson(file).caseId))
if (!recordFiles.length) throw new Error('No guided cases selected')

fs.rmSync(output, { recursive: true, force: true })
fs.mkdirSync(path.join(output, 'cases'), { recursive: true })
fs.copyFileSync(JSON_SCHEMA_FILE, path.join(output, 'guided-case-v2.schema.json'))
for (const file of recordFiles) {
  const record = readJson(file)
  const caseDir = path.join(output, 'cases', record.caseId)
  fs.mkdirSync(caseDir, { recursive: true })
  fs.copyFileSync(file, path.join(caseDir, 'governed-record.json'))
  const report = path.join(REPORTS_DIR, 'cases', `${record.caseId}.json`)
  if (fs.existsSync(report)) fs.copyFileSync(report, path.join(caseDir, 'validation-report.json'))
}
const diff = spawnSync('git', ['diff', '--binary', 'main...HEAD'], { cwd: ROOT, encoding: 'utf8' })
if (diff.status !== 0) throw new Error(diff.stderr)
fs.writeFileSync(path.join(output, 'implementation.patch'), diff.stdout, 'utf8')
fs.writeFileSync(path.join(output, 'README.md'), [
  '# Private Guided-Case Review Packet',
  '',
  'This packet is for engineering and governance review. It is not approved for public distribution.',
  'Schema validation is not clinical approval. Draft cases remain publication blocked.',
  '',
].join('\n'), 'utf8')
writeManifest(output)
console.log(`Guided-case review packet written: ${output}`)

function writeManifest(directory) {
  const entries = walk(directory)
    .filter((file) => path.basename(file) !== 'MANIFEST-SHA256.txt')
    .map((file) => `${sha256(fs.readFileSync(file))}  ${path.relative(directory, file).replaceAll('\\', '/')}`)
    .sort()
  fs.writeFileSync(path.join(directory, 'MANIFEST-SHA256.txt'), `${entries.join('\n')}\n`, 'utf8')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : []
  })
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}
