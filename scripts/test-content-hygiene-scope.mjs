import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanContentHygiene } from './check-content-hygiene.mjs'
import {
  isGovernedUntrackedWorkingPath,
} from './lib/hygieneScope.mjs'

const FLAGGED_TERM = 'Governed Fixture Name'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-hygiene-scope-'))
let checks = 0

try {
  expectPass(
    'untracked private-cache is not public content',
    { 'ai-manager/private-cache/run/source.md': FLAGGED_TERM },
    (result) => assert.equal(result.scope.skipped.governedUntracked, 1),
  )

  expectViolation(
    'staged private-cache is still checked',
    { 'ai-manager/private-cache/run/source.md': FLAGGED_TERM },
    'ai-manager/private-cache/run/source.md',
    { staged: ['ai-manager/private-cache/run/source.md'] },
  )

  expectViolation(
    'tracked private-cache is still checked',
    { 'ai-manager/private-cache/run/source.md': FLAGGED_TERM },
    'ai-manager/private-cache/run/source.md',
    { tracked: ['ai-manager/private-cache/run/source.md'] },
  )

  expectViolation(
    'public sensitive content fails',
    { 'public/leak.md': FLAGGED_TERM },
    'public/leak.md',
  )

  expectViolation(
    'src and content sensitive content fails',
    {
      'src/leak.ts': `export const label = '${FLAGGED_TERM}'`,
      'content/leak.md': FLAGGED_TERM,
    },
    'content/leak.md',
    (result) => assert.ok(result.findings.some((finding) => finding.file === 'src/leak.ts')),
  )

  expectPass(
    'untracked current review packets stay outside broad hygiene enumeration',
    { 'docs/reviews/current/packet/REDACTION_SCAN.txt': FLAGGED_TERM },
    (result) => assert.equal(result.scope.skipped.governedUntracked, 1),
  )

  expectViolation(
    'ordinary untracked content is still checked',
    { 'content/ordinary-untracked.md': FLAGGED_TERM },
    'content/ordinary-untracked.md',
  )

  assertDirectAndPreflightShareScope()

  expectViolation(
    'excluded directory names elsewhere are not exempt',
    { 'content/ai-manager/private-cache/not-exempt.md': FLAGGED_TERM },
    'content/ai-manager/private-cache/not-exempt.md',
  )

  assert.equal(
    isGovernedUntrackedWorkingPath('ai-manager/private-cache/../private-cache-copy/leak.md'),
    false,
    'similarly named paths must not inherit the private-cache exclusion',
  )
  assert.equal(
    isGovernedUntrackedWorkingPath('content/../ai-manager/private-cache/source.md'),
    true,
    'normalized traversal into the governed private-cache path must remain excluded only for untracked broad enumeration',
  )
  checks += 1

  console.log('Content hygiene scope regression tests passed.')
  console.log(`Deterministic scenarios checked: ${checks}`)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

function expectViolation(name, files, expectedPath, optionsOrAssert = {}) {
  const { options, extraAssert } = splitOptions(optionsOrAssert)
  const fixture = createFixture(name, files, options)
  const result = scanContentHygiene(fixture)
  checks += 1
  assert.ok(
    result.findings.some((finding) => finding.file === expectedPath),
    `${name}: expected a finding for ${expectedPath}`,
  )
  extraAssert?.(result)
}

function expectPass(name, files, optionsOrAssert = {}) {
  const { options, extraAssert } = splitOptions(optionsOrAssert)
  const fixture = createFixture(name, files, options)
  const result = scanContentHygiene(fixture)
  checks += 1
  assert.deepEqual(result.findings, [], `${name}: expected a clean hygiene scan`)
  extraAssert?.(result)
}

function splitOptions(value) {
  if (typeof value === 'function') return { options: {}, extraAssert: value }
  return { options: value, extraAssert: null }
}

function createFixture(name, files, options = {}) {
  const fixture = path.join(root, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase())
  fs.mkdirSync(fixture, { recursive: true })
  git(fixture, ['init'])

  writeFile(fixture, 'ai-manager/content-hygiene-names.json', JSON.stringify({ termsToFlag: [FLAGGED_TERM] }))

  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(fixture, relativePath, content)
  }

  if (options.tracked?.length) {
    git(fixture, ['add', '--', ...options.tracked])
    git(fixture, [
      '-c',
      'user.name=Codex Hygiene Scope Test',
      '-c',
      'user.email=codex-hygiene-scope@example.invalid',
      'commit',
      '-m',
      'seed tracked hygiene fixture',
    ])
  }

  if (options.staged?.length) {
    git(fixture, ['add', '--', ...options.staged])
  }

  return fixture
}

function assertDirectAndPreflightShareScope() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const packageFile = path.join(repoRoot, 'package.json')
  const scripts = JSON.parse(fs.readFileSync(packageFile, 'utf8')).scripts
  const direct = scripts['check:hygiene']
  const preflight = scripts.preflight

  assert.ok(direct.includes('scripts/test-content-hygiene-scope.mjs'), 'direct hygiene script must run scope regressions')
  assert.ok(direct.includes('scripts/check-content-hygiene.mjs'), 'direct hygiene script must run the hygiene scanner')
  assert.ok(preflight.includes('npm run check:hygiene'), 'preflight must delegate to the direct hygiene script')
  checks += 1
}

function writeFile(rootDir, relativePath, content) {
  const file = path.join(rootDir, ...relativePath.split('/'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function git(cwd, args) {
  return execFileSync('git', ['-c', `safe.directory=${toGitPath(cwd)}`, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function toGitPath(value) {
  return path.resolve(value).split(path.sep).join('/')
}
