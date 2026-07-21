import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SCANNER = path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs')
const PATTERN_SOURCE = path.join(ROOT, 'scripts', 'lib', 'secretPatterns.mjs')
const HYGIENE_SOURCE = path.join(ROOT, 'ai-manager', 'content-hygiene-names.json')
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'review-packet-redaction-'))
let checks = 0

try {
  const patternSource = fs.readFileSync(PATTERN_SOURCE, 'utf8')
  const hygiene = JSON.parse(fs.readFileSync(HYGIENE_SOURCE, 'utf8'))
  const governedName = hygiene.termsToFlag?.find(
    (item) => typeof item === 'string' && item.trim(),
  )

  if (!governedName) throw new Error('A governed-name fixture is required.')

  expectPass('pattern-source', {
    'security-tooling/scripts/lib/secretPatterns.mjs': patternSource,
  })

  const policyToken = ['OPENAI', 'API', 'KEY'].join('_')
  const previousRuleName = ['SEC', 'RET', '_RULES'].join('')
  const policyDiff = [
    'diff --git a/scripts/lib/secretPatterns.mjs b/scripts/lib/secretPatterns.mjs',
    '--- a/scripts/lib/secretPatterns.mjs',
    '+++ b/scripts/lib/secretPatterns.mjs',
    '@@ -1,2 +1,2 @@',
    `-export const ${previousRuleName} = []`,
    `-const token = /${policyToken}/g`,
    '+export const CREDENTIAL_RULES = []',
    '',
  ].join('\n')
  expectPass('pattern-policy-diff', { '05-filtered-full-diff.patch': policyDiff })

  const googleLike = `${['AI', 'za'].join('')}${'A'.repeat(24)}`
  const openAiLike = `${['s', 'k-'].join('')}${'B'.repeat(24)}`
  expectFail('ordinary-credential-values', {
    'ordinary.txt': `${googleLike}\n${openAiLike}\n`,
  }, 'credential pattern')

  expectFail('pattern-source-with-credential', {
    'security-tooling/scripts/lib/secretPatterns.mjs':
      `${patternSource}\nconst compromisedValue = ${JSON.stringify(openAiLike)}\n`,
  }, 'credential pattern')

  expectFail('pattern-diff-with-credential', {
    '05-filtered-full-diff.patch': `${policyDiff}+const compromised = '${googleLike}'\n`,
  }, 'credential in the pattern-module diff')

  const awsLike = `${['A', 'KIA'].join('')}${'C'.repeat(16)}`
  const intakePolicyDiff = [
    'diff --git a/ai-manager/scripts/source_intake_policy.py b/ai-manager/scripts/source_intake_policy.py',
    '--- a/ai-manager/scripts/source_intake_policy.py',
    '+++ b/ai-manager/scripts/source_intake_policy.py',
    '@@ -1 +1 @@',
    `+compromised = ${JSON.stringify(awsLike)}`,
    '',
  ].join('\n')
  expectFail('intake-policy-with-aws-credential', {
    '05-filtered-full-diff.patch': intakePolicyDiff,
  }, 'AWS-shaped credential in the intake policy diff')

  const privatePath = ['C:', 'Users', 'reviewer', 'private-source.html'].join('\\')
  expectFail('private-path', { 'ordinary.txt': privatePath }, 'private local path')

  expectFail('governed-name', { 'ordinary.txt': governedName }, 'governed name')

  const rawPath = ['content', 'imports', 'html-case-bank', 'raw', 'index.html'].join('/')
  expectFail('raw-source-entry', { [rawPath]: 'private source body placeholder' }, 'raw source')

  expectFail('glb-binary', {
    'public/models/test.glb': Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x00, 0x01]),
  }, 'GLB binary')

  expectPass('governed-report-machine-identifiers', {
    'tracked-reports/source-manifest.json': JSON.stringify({
      sourceId: `src-${'1'.repeat(12)}`,
      checksum: `sha256:${'2'.repeat(64)}`,
      status: 'restricted-pending-clearance',
    }),
  })

  expectFail('governed-report-sensitive-value', {
    'tracked-reports/source-manifest.json': JSON.stringify({
      sourceId: `src-${'3'.repeat(12)}`,
      contact: ['+44', '7123', '456', '789'].join(' '),
    }),
  }, 'sensitive value in governed report snapshot')

  console.log('Review packet redaction regression tests passed.')
  console.log(`Deterministic scenarios checked: ${checks}`)
} finally {
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
}

function expectPass(name, files) {
  const result = runCase(name, files)
  checks += 1
  if (result.status !== 0) {
    throw new Error(`${name}: expected scanner success`)
  }
}

function expectFail(name, files, description) {
  const result = runCase(name, files)
  checks += 1
  if (result.status === 0) {
    throw new Error(`${name}: scanner did not reject ${description}`)
  }
}

function runCase(name, files) {
  const packet = path.join(TEMP_ROOT, name)
  fs.mkdirSync(packet, { recursive: true })

  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(packet, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, content)
  }

  return spawnSync(process.execPath, [SCANNER, packet], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  })
}
