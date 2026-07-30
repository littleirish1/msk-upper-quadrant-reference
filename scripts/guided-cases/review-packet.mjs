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
import {
  copyExactArtifact,
  verifyPatchReconstructsTree,
  writeExactArtifact,
} from '../lib/reviewPacketArtifacts.mjs'

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
const baseSha = argument('--base=') || 'main'
const finalSha = argument('--final=') || 'HEAD'

fs.rmSync(output, { recursive: true, force: true })
fs.mkdirSync(path.join(output, 'cases'), { recursive: true })
copyExactArtifact(JSON_SCHEMA_FILE, path.join(output, 'guided-case-v2.schema.json'))
for (const file of recordFiles) {
  const record = readJson(file)
  const caseDir = path.join(output, 'cases', record.caseId)
  fs.mkdirSync(caseDir, { recursive: true })
  copyExactArtifact(file, path.join(caseDir, 'governed-record.json'))
  const report = path.join(REPORTS_DIR, 'cases', `${record.caseId}.json`)
  if (fs.existsSync(report)) copyExactArtifact(report, path.join(caseDir, 'validation-report.json'))
}
const diff = spawnSync(
  'git',
  ['diff', '--binary', '--full-index', `${baseSha}...${finalSha}`],
  { cwd: ROOT, encoding: null, maxBuffer: 100 * 1024 * 1024 },
)
if (diff.status !== 0) throw new Error(diff.stderr)
const patchFile = path.join(output, 'implementation.patch')
writeExactArtifact(patchFile, diff.stdout)
const patchVerification = verifyPatchReconstructsTree({
  repositoryRoot: ROOT,
  patchFile,
  baseSha,
  finalSha,
})
fs.writeFileSync(path.join(output, 'README.md'), [
  '# Private Guided-Case Review Packet',
  '',
  'This packet is for engineering and governance review. It is not approved for public distribution.',
  'Schema validation is not clinical approval. Draft cases remain publication blocked.',
  '',
].join('\n'), 'utf8')
fs.writeFileSync(path.join(output, 'PATCH-VERIFICATION.txt'), [
  `Baseline: ${resolveGit(baseSha)}`,
  `Final: ${resolveGit(finalSha)}`,
  `Expected tree: ${patchVerification.expectedTree}`,
  `Reconstructed tree: ${patchVerification.reconstructedTree}`,
  'git apply --check: passed through an isolated temporary index',
  'Tree comparison: passed',
  '',
].join('\n'), 'utf8')
writeManifest(output)
const scan = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs'), output],
  { cwd: ROOT, encoding: 'utf8', shell: false },
)
if (scan.status !== 0) {
  throw new Error('Guided-case review packet failed the sensitive-data scan')
}
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

function argument(prefix) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function resolveGit(value) {
  const result = spawnSync('git', ['rev-parse', value], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  })
  if (result.status !== 0) throw new Error(`Unable to resolve Git revision: ${value}`)
  return result.stdout.trim()
}
