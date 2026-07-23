import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, relative } from './shared.mjs'

const smoke = process.argv.includes('--smoke')
const requestedOutput = process.argv.slice(2).find((value) => !value.startsWith('--'))
const output = smoke
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-hub-review-'))
  : path.resolve(ROOT, requestedOutput || 'docs/reviews/current/evidence-hub-core-review')

const reviewPaths = [
  'docs/architecture/evidence-hub-v1.md',
  'content/evidence-hub',
  'src/lib/evidence-hub',
  'scripts/evidence-hub',
  'scripts/lib/loadTypeScriptTree.mjs',
  'package.json',
]

try {
  if (!smoke && fs.existsSync(output)) throw new Error('Review packet directory already exists; refusing to overwrite it.')
  fs.mkdirSync(output, { recursive: true })

  write('REVIEW_CLAIM.md', [
    '# Evidence Hub Core Review Claim',
    '',
    'Scope: schemas, entity types, lifecycle rules, relationship validation,',
    'publication gates, review workflow, packet generation, and empty pilots.',
    '',
    'Non-claims: no evidence ingestion, clinical approval, public content, UI,',
    'route, API, database, vector store, or runtime AI change.',
    '',
    'Verdict: Pending independent review',
    '',
  ].join('\n'))
  write('GIT_STATUS.txt', git(['status', '--short', '--branch']))
  write('RECENT_COMMITS.txt', git(['log', '--oneline', '-20']))
  write('DIFF_STAT.txt', diffForPaths(['--stat']))
  write('NAME_STATUS.txt', diffForPaths(['--name-status']))
  write('IMPLEMENTATION.patch', completePatch())

  const hubCheck = runNpm('run', 'check:evidence-hub')
  const hubTests = runNpm('run', 'test:evidence-hub')
  const diffCheck = run('git', ['diff', '--check'])
  write('VALIDATION.txt', [
    '$ npm run check:evidence-hub',
    hubCheck.stdout,
    hubCheck.stderr,
    `$ exit ${hubCheck.status}`,
    '',
    '$ npm run test:evidence-hub',
    hubTests.stdout,
    hubTests.stderr,
    `$ exit ${hubTests.status}`,
    '',
    '$ git diff --check',
    diffCheck.stdout,
    diffCheck.stderr,
    `$ exit ${diffCheck.status}`,
    '',
  ].join('\n'))
  if (hubCheck.status !== 0 || hubTests.status !== 0 || diffCheck.status !== 0) {
    throw new Error('Review packet validation failed closed.')
  }

  write('IMPLEMENTATION_NOTES.md', [
    '# Implementation Notes',
    '',
    '- The hub is build-time repository data and has no public runtime consumer.',
    '- Zod schemas are authoritative; JSON Schema is generated and byte-checked.',
    '- Relationships pin source and target revisions.',
    '- Review decisions pin entity revision and canonical SHA-256.',
    '- Publication evaluates every dependency and fails closed.',
    '- Both pilots are empty, private, disabled placeholders.',
    '',
  ].join('\n'))

  copy('docs/architecture/evidence-hub-v1.md', 'contracts/evidence-hub-v1.md')
  copy('src/lib/evidence-hub/evidence-hub-v1.schema.json', 'schemas/evidence-hub-v1.schema.json')
  for (const file of implementationFiles()) copy(file, path.join('implementation', file))
  write('REDACTION.txt', 'Pending complete packet scan.\n')
  writeManifest()

  const redaction = run(process.execPath, [path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs'), output])
  write('REDACTION.txt', [redaction.stdout, redaction.stderr, `$ exit ${redaction.status}`, ''].join('\n'))
  if (redaction.status !== 0) throw new Error('Review packet redaction scan failed closed.')
  writeManifest()
  const finalRedaction = run(process.execPath, [path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs'), output])
  if (finalRedaction.status !== 0) throw new Error('Final review packet redaction scan failed closed.')

  if (smoke) console.log('Evidence Hub review packet smoke test passed.')
  else console.log('Evidence Hub review packet generated: ' + relative(output))
} finally {
  if (smoke) fs.rmSync(output, { recursive: true, force: true })
}

function implementationFiles() {
  return reviewPaths.flatMap((item) => {
    const absolute = path.join(ROOT, item)
    if (!fs.existsSync(absolute)) return []
    return fs.statSync(absolute).isDirectory()
      ? collectFiles(absolute).map((file) => relative(file))
      : [item]
  }).filter((file) => !file.endsWith('evidence-hub-core-review'))
    .sort()
}

function completePatch() {
  let outputText = git(['diff', '--binary', '--', ...reviewPaths])
  for (const file of implementationFiles()) {
    if (isTracked(file)) continue
    const addition = run('git', ['diff', '--no-index', '--binary', '--', '/dev/null', file], true)
    if (addition.status !== 0 && addition.status !== 1) throw new Error(`Unable to create patch for ${file}`)
    outputText += `\n${addition.stdout}`
  }
  return outputText
}

function diffForPaths(args) {
  const tracked = git(['diff', ...args, '--', ...reviewPaths])
  const untracked = implementationFiles().filter((file) => !isTracked(file))
  return tracked + (untracked.length ? `\nUntracked implementation files:\n${untracked.join('\n')}\n` : '')
}

function isTracked(file) {
  return run('git', ['ls-files', '--error-unmatch', '--', file], true).status === 0
}

function copy(source, destination) {
  const target = path.join(output, destination)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(ROOT, source), target)
}

function write(file, content) {
  const target = path.join(output, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, normalize(content), 'utf8')
}

function writeManifest() {
  const manifest = path.join(output, 'FILE_MANIFEST_SHA256.txt')
  if (fs.existsSync(manifest)) fs.rmSync(manifest)
  const lines = collectFiles(output).map((file) => {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    return `${digest}  ${path.relative(output, file).split(path.sep).join('/')}`
  })
  fs.writeFileSync(manifest, `${lines.join('\n')}\n`, 'utf8')
}

function runNpm(...args) {
  const npmCli = process.env.npm_execpath
  if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Unable to locate npm CLI for review validation.')
  return run(process.execPath, [npmCli, ...args])
}

function git(args) {
  const result = run('git', args)
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed')
  return result.stdout
}

function run(command, args, allowNonZero = false) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, shell: false })
  if (result.error) throw result.error
  if (!allowNonZero && result.status !== 0) return result
  return { ...result, stdout: result.stdout || '', stderr: result.stderr || '' }
}

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : []
  }).sort()
}

function normalize(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
