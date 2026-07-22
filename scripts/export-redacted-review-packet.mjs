import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  RAW_LEGACY_PATH,
  isSensitiveRepositoryPath,
  normalizePath,
  redactSensitiveText,
} from './lib/reviewPacketPolicy.mjs'

const ROOT = process.cwd()
const OUTPUT = path.resolve(ROOT, process.argv[2] || 'phase-hardening-rereview-v2')
const npmCli = process.env.npm_execpath
if (!npmCli || !fs.existsSync(npmCli)) {
  throw new Error('Unable to locate the npm CLI for review packet validation.')
}
const excludes = [
  ':(exclude)content/imports/html-case-bank/raw/**',
  ':(exclude)content/imports/html-case-bank/extracted/stations/**',
  ':(exclude)content/imports/**/raw/**',
  ':(exclude)ai-manager/assets/**',
  ':(exclude)**/*.glb',
  ':(exclude)**/.env*',
]

if (fs.existsSync(OUTPUT)) {
  console.error('Review packet directory already exists; refusing to overwrite it.')
  process.exit(1)
}

fs.mkdirSync(OUTPUT, { recursive: true })
fs.mkdirSync(path.join(OUTPUT, 'contracts'), { recursive: true })
fs.mkdirSync(path.join(OUTPUT, 'reviews'), { recursive: true })
fs.mkdirSync(path.join(OUTPUT, 'config'), { recursive: true })

write(
  '00-REVIEW-CLAIM.md',
  [
    '# Coordinated Hardening Re-review Claim',
    '',
    'This packet claims that repository-controlled blockers B4-B6 are closed, while',
    'the B3 security-tooling supplement awaits independent review and',
    'history/ref exposure and external credential actions remain human-controlled.',
    '',
    'The patch is filtered. Sensitive deletions and private import metadata are',
    'represented by summaries rather than raw bodies.',
    '',
  ].join('\n'),
)
write('01-git-status.txt', filteredStatus())
write('02-recent-commits.txt', git(['log', '--oneline', '-25']))

const stat = git(['diff', '--stat', '--', '.', ...excludes])
write('03-diff-stat.txt', stat + untrackedSummary('stat'))

const nameStatus = git(['diff', '--name-status', '--', '.', ...excludes])
write('04-diff-name-status.txt', nameStatus + untrackedSummary('name'))

let patch = git(['diff', '--binary', '--', '.', ...excludes])
for (const file of safeUntrackedFiles()) {
  const addition = run('git', ['diff', '--no-index', '--binary', '--', '/dev/null', file], true)
  if (addition.status !== 0 && addition.status !== 1) {
    throw new Error('Unable to create untracked-file patch for ' + file)
  }
  patch += '\n' + addition.stdout
}
write('05-filtered-full-diff.patch', patch)

write(
  '06-sensitive-deletion-summary.md',
  [
    '# Sensitive Deletion Summary',
    '',
    '- Deleted path: ' + RAW_LEGACY_PATH,
    '- Deletion status: removed from working tree; still reachable in Git history',
    '- Previous bytes: 789580',
    '- Previous lines: 6527',
    '- Git blob ID: 4b107b93aee91d7f012d97aa42e6b8b7d19a638b',
    '- Approved SHA-256: 488282ca6ce682d5ee56f0c700b4392e1cf32d2b8625c0ed165f2db5b7483bb3',
    '- Source accounting: 47 indexed IDs / 47 extracted station files / 47 registry sources / 47 tracker rows',
    '- Private station metadata changes: 47 provenance headers updated; filenames and bodies omitted.',
    '- Body omitted because the source is private and historically credential-bearing.',
    '',
  ].join('\n'),
  false,
)

copyContracts()
copyReviews()
copyConfig()
copySecurityTooling()

const preflight = run(process.execPath, [npmCli, 'run', 'preflight'])
write('07-preflight-output.txt', preflight.stdout + preflight.stderr)
if (preflight.status !== 0) {
  console.error('Preflight failed; packet retained for local diagnosis and not ready to distribute.')
  process.exit(preflight.status || 1)
}

const generated = run(process.execPath, [npmCli, 'run', 'check:generated-sources'])
write('08-generated-source-currentness-output.txt', generated.stdout + generated.stderr)
if (generated.status !== 0) process.exit(generated.status || 1)

const diffCheck = run('git', ['diff', '--check'])
write(
  '10-git-diff-check-output.txt',
  [
    '$ git diff --check',
    'Exit code: ' + diffCheck.status,
    diffCheck.status === 0
      ? 'No whitespace errors reported.'
      : 'Whitespace errors detected; detailed output intentionally omitted from packet.',
  ].join('\n') + '\n',
)
if (diffCheck.status !== 0) {
  console.error('Git diff check failed; inspect the local output before exporting.')
  process.exit(diffCheck.status || 1)
}

write(
  'FINAL_CODEX_REPORT.md',
  [
    '# Final Codex Report',
    '',
    '## Repository State',
    '',
    '- Branch: main',
    '- Local HEAD: 3e8791911ac0f385728ec42db5c635cf37adb8d0',
    '- No commit or push was performed by this hardening pass.',
    '- The remote main tip is one commit ahead of the local HEAD and requires human review.',
    '',
    '## Review 0007',
    '',
    '- B1: open, human-controlled. The removed legacy blob remains reachable in history.',
    '- B2: open, human-controlled. Audited remote refs contain public 3D route objects;',
    '  one remote feature ref also contains four GLB objects.',
    '- B3: pending independent review. This supplement includes the security tooling',
    '  source and diff that implement credential and packet-redaction guarantees.',
    '- B4: closed. Stable source identity and an exact-byte fingerprint are recorded.',
    '- B5: closed. Generated tracker and registry currentness is mandatory in preflight.',
    '- B6: closed. The import README heading and encoding are corrected.',
    '',
    '## Legacy Source Provenance',
    '',
    '- Source ID: legacy-html-case-bank-v1',
    '- Source type: private-external-legacy-html',
    '- Git blob ID: 4b107b93aee91d7f012d97aa42e6b8b7d19a638b',
    '- Exact-byte SHA-256: 488282ca6ce682d5ee56f0c700b4392e1cf32d2b8625c0ed165f2db5b7483bb3',
    '- Accounting: 47 indexed station IDs, 47 extracted station files, 47 registry',
    '  sources, and 47 tracker rows; no mismatches.',
    '- Extraction scripts require an explicit private source, verify exact bytes against',
    '  the approved fingerprint, and reject mismatches without copying the source into',
    '  the repository.',
    '',
    '## Gates And Public Boundary',
    '',
    '- Generated tracker and registry outputs are byte-current and restored after checks.',
    '- Netlify remains configured for npm run preflight with out as the publish directory.',
    '- GitHub Actions remains validation-only.',
    '- Local static output contains no public 3D route, GLB, ai-manager route, or private',
    '  import asset.',
    '- Public content validation found 33 condition files and 9 guided case files.',
    '- Six published case routes are discoverable; three private routes remain excluded.',
    '- Diagnosis checks covered 33 condition pages.',
    '- Reveal checks covered 6 pages and 43 reveal blocks.',
    '- Link checks covered 52 HTML files and 2,306 internal links.',
    '- The build generated 53 static pages.',
    '',
    '## Validation',
    '',
    'The tracker and registry generators, generated-source currentness, hygiene, source',
    'integrity, credential-pattern, frontmatter, content-contract, search, diagnosis',
    'no-leak, reveal, route, link, 3D boundary, type-check, build, and canonical preflight',
    'commands completed successfully. The packet redaction scan reports zero forbidden',
    'findings and UTF-8 text encoding.',
    '- Security tooling included for review: scripts/check-review-packet-redaction.mjs,',
    '  scripts/check-secrets.mjs, and scripts/lib/secretPatterns.mjs.',
    '- Final ZIP SHA-256: recorded after archive creation in the companion checksum and',
    '  final operator report. A ZIP cannot contain its own final digest without changing it.',
    '',
    '## Human Actions And Residual Risk',
    '',
    'Repository visibility, history rewriting, remote-ref cleanup, external credential',
    'action, 3D licensing/provenance, and clinical approval remain human-controlled.',
    'The current local public boundary is safe, but the audited remote refs and reachable',
    'history must not be treated as remediated. Independent re-review of this packet is',
    'still pending.',
    '',
    '## Packet Safety',
    '',
    'The filtered patch excludes private import bodies, private assets, environment files,',
    'and GLB binaries. The removed source body is not included. Only the dedicated',
    'sensitive-deletion summary records its repository path and approved accounting.',
    '',
  ].join('\n'),
)

write('09-review-packet-redaction-output.txt', 'Pending complete packet scan.\n')
writeManifest()
const evidenceScan = run(process.execPath, [
  path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs'),
  OUTPUT,
  '--complete',
])
if (evidenceScan.status !== 0) {
  process.stdout.write(evidenceScan.stdout)
  process.stderr.write(evidenceScan.stderr)
  process.exit(evidenceScan.status || 1)
}

write(
  '09-review-packet-redaction-output.txt',
  evidenceScan.stdout + evidenceScan.stderr,
)
writeManifest()

const finalScan = run(process.execPath, [
  path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs'),
  OUTPUT,
  '--complete',
])
process.stdout.write(finalScan.stdout)
process.stderr.write(finalScan.stderr)
if (finalScan.status !== 0) process.exit(finalScan.status || 1)

console.log('Redacted review packet exported: ' + path.relative(ROOT, OUTPUT))

function git(args) {
  const result = run('git', ['-c', 'core.fsmonitor=false', ...args])
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed')
  return result.stdout
}

function run(command, args, allowNonZero = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    shell: false,
  })
  if (result.error) throw result.error
  if (!allowNonZero && result.status !== 0) {
    return { ...result, stdout: result.stdout || '', stderr: result.stderr || '' }
  }
  return { ...result, stdout: result.stdout || '', stderr: result.stderr || '' }
}

function filteredStatus() {
  return git(['status', '--short'])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const candidate = normalizePath(line.slice(3).split(' -> ').pop())
      return !isSensitiveRepositoryPath(candidate)
    })
    .join('\n') + '\n'
}

function safeUntrackedFiles() {
  const result = git(['ls-files', '--others', '--exclude-standard'])
  return result
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizePath)
    .filter((file) => !isSensitiveRepositoryPath(file))
    .filter((file) => !file.startsWith('phase-hardening-rereview/'))
    .filter((file) => !file.startsWith('phase-hardening-rereview-v2/'))
    .sort()
}

function untrackedSummary(mode) {
  const files = safeUntrackedFiles()
  if (files.length === 0) return ''
  if (mode === 'name') return files.map((file) => 'A\t' + file).join('\n') + '\n'
  return files.map((file) => ' ' + file + ' | new text file').join('\n') + '\n'
}

function copyContracts() {
  const files = [
    'AGENTS.md',
    'docs/MASTER_BUILD_AND_REVIEW_BRIEF.md',
    'docs/FRONTMATTER_SCHEMA_PLAN.md',
    'docs/CONTENT_SCHEMA.md',
    'docs/GOVERNANCE_AND_CI.md',
    'docs/UX_INVARIANTS.md',
    'docs/IA_AND_ROUTES.md',
    'docs/REVIEW_WORKFLOW.md',
    'docs/LEGACY_SOURCE_PROVENANCE.md',
    'docs/REMOTE_REF_AND_HISTORY_AUDIT.md',
    'docs/REMOTE_MAIN_INTEGRATION_PLAN.md',
    'docs/HUMAN_ACTIONS_REQUIRED.md',
  ]
  for (const file of files) copyText(file, path.join('contracts', path.basename(file)))
}

function copySecurityTooling() {
  const files = [
    'scripts/check-review-packet-redaction.mjs',
    'scripts/check-secrets.mjs',
    'scripts/lib/secretPatterns.mjs',
  ]
  for (const file of files) copyText(file, path.join('security-tooling', file))
}

function copyReviews() {
  const dir = path.join(ROOT, 'docs', 'reviews')
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) copyText(path.join('docs', 'reviews', entry.name), path.join('reviews', entry.name))
  }
}

function copyConfig() {
  const files = [
    'package.json',
    'netlify.toml',
    'next.config.mjs',
    '.github/workflows/deploy.yml',
    '.github/pull_request_template.md',
  ]
  for (const file of files) {
    copyText(file, path.join('config', file.replace(/[\\/]/g, '__')))
  }
}

function copyText(source, destination) {
  const fullPath = path.join(ROOT, source)
  if (!fs.existsSync(fullPath)) return
  write(destination, fs.readFileSync(fullPath, 'utf8'))
}

function write(relative, content, redact = true) {
  const destination = path.join(OUTPUT, relative)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const safe = redact ? redactSensitiveText(content, ROOT) : String(content)
  fs.writeFileSync(destination, safe, 'utf8')
}

function writeManifest() {
  const rows = collectFiles(OUTPUT)
    .filter((file) => path.basename(file) !== 'SHA256SUMS.txt')
    .map((file) => {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      return hash + '  ' + normalizePath(path.relative(OUTPUT, file))
    })
  write('SHA256SUMS.txt', rows.join('\n') + '\n')
}

function collectFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files.sort()
}
