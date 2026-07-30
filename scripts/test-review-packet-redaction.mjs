import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SCANNER = path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs')
const PATTERN_SOURCE = path.join(ROOT, 'scripts', 'lib', 'secretPatterns.mjs')
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'review-packet-redaction-'))
const SYNTHETIC_GOVERNED_NAME = 'Fixture Person Alpha'
let checks = 0

try {
  const patternSource = fs.readFileSync(PATTERN_SOURCE, 'utf8')

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

  const genericToken = ['ACCESS', 'TOKEN'].join('_')
  const genericTokenValue = ['fixture', 'token', 'value', '1234567890'].join('-')
  expectFail('ordinary-generic-token-value', {
    'ordinary.txt': `${genericToken}=${genericTokenValue}`,
  }, 'generic token value')

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
  expectFail('json-escaped-private-path', {
    'ordinary.txt': JSON.stringify({ location: privatePath }),
  }, 'JSON-escaped private local path')

  expectFail('governed-name', { 'ordinary.txt': SYNTHETIC_GOVERNED_NAME }, 'governed name')

  const rawPath = ['content', 'imports', 'html-case-bank', 'raw', 'index.html'].join('/')
  expectFail('raw-source-entry', { [rawPath]: 'private source body placeholder' }, 'raw source')

  expectFail('protected-private-cache-entry', {
    'ai-manager/private-cache/report.txt': 'synthetic private cache placeholder',
  }, 'protected private cache path')

  expectFail('protected-current-review-entry', {
    'docs/reviews/current/report.txt': 'synthetic current review placeholder',
  }, 'protected current review path')

  expectFail('glb-binary', {
    'public/models/test.glb': Buffer.from([0x67, 0x6c, 0x54, 0x46, 0x00, 0x01]),
  }, 'GLB binary')

  expectFail('unsupported-binary', {
    'nested/generated/report.bin': Buffer.from([0xff, 0xfe, 0xfd]),
  }, 'unsupported binary')

  expectPass('already-redacted-values', {
    'ordinary.txt': [
      '[redacted credential]',
      '<private-local-path>',
      '[sensitive value omitted]',
    ].join('\n'),
  })

  expectPass('git-object-identifiers', {
    'ordinary.txt': `${'d'.repeat(40)}\n${'e'.repeat(64)}\n`,
  })

  expectPass('full-index-patch-identifiers', {
    'implementation.patch': [
      'diff --git a/source.mjs b/source.mjs',
      `index ${'1'.repeat(40)}..${'2'.repeat(40)} 100644`,
      '--- a/source.mjs',
      '+++ b/source.mjs',
      '@@ -1 +1 @@',
      '-const record = { caseId: record.caseId }',
      '+const record = { caseId: pilot.caseId }',
      '',
    ].join('\n'),
  })

  const sha256WithNhsShapedDigits = `${['943', '476', '5919'].join('')}${'a'.repeat(54)}`
  expectPass('sha256-manifest-hash-field', {
    'SHA256SUMS.txt': `${sha256WithNhsShapedDigits}  safe-report.txt\n`,
  })

  expectFail('sha256-manifest-sensitive-filename', {
    'SHA256SUMS.txt': [
      `${sha256WithNhsShapedDigits}  safe-report.txt`,
      ['NHS number: ', '943', ' ', '476', ' ', '5919'].join(''),
    ].join('\n'),
  }, 'sensitive text outside the SHA-256 hash field')

  expectFail('mixed-safe-and-unsafe-content', {
    'nested/generated/report.md': [
      '# Synthetic report',
      'Safe summary content.',
      ['reviewer', '@', 'example.test'].join(''),
    ].join('\n'),
  }, 'unsafe value mixed with safe content')

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

  expectPass('governed-report-short-citation', {
    'tracked-reports/references.json': JSON.stringify({
      citationText: 'Short fictional citation fixture.',
    }),
  })

  expectFail('governed-report-long-citation', {
    'tracked-reports/references.json': JSON.stringify({
      citationText: 'F'.repeat(281),
    }),
  }, 'citation excerpt over the policy limit')

  expectFail('patch-long-citation', {
    'implementation.patch': [
      'diff --git a/report.json b/report.json',
      '--- a/report.json',
      '+++ b/report.json',
      '@@ -0,0 +1 @@',
      `+  "citationText": ${JSON.stringify('F'.repeat(281))},`,
      '',
    ].join('\n'),
  }, 'citation excerpt over the policy limit in a patch')

  expectPass('evidence-hub-schema-patterns', {
    'implementation/src/lib/evidence-hub/evidence-hub-v1.schema.json': JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      properties: {
        checksum: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
        id: { type: 'string', pattern: '^[a-z][a-z0-9-]*(?:\\.[a-z0-9-]+)+$' },
      },
    }),
  })

  expectFail('evidence-hub-schema-with-credential', {
    'implementation/src/lib/evidence-hub/evidence-hub-v1.schema.json': JSON.stringify({
      properties: { compromised: { description: openAiLike } },
    }),
  }, 'credential in Evidence Hub schema source')

  const telephoneShape = ['07123', '456789'].join('')
  const gitObjectWithTelephoneShape = `${'a'.repeat(10)}${telephoneShape}${'b'.repeat(19)}`
  const cleanGitObject = 'c'.repeat(40)
  const shortGitObjectWithTelephoneShape = `${'a'.repeat(10)}${telephoneShape}${'b'.repeat(18)}`
  const longGitObjectWithTelephoneShape = `${'a'.repeat(10)}${telephoneShape}${'b'.repeat(20)}`
  const abbreviatedGitObjectWithTelephoneShape = `${'a'.repeat(7)}${telephoneShape}`

  expectPass('commit-graph-commit-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${gitObjectWithTelephoneShape}`,
      `   Parent: ${cleanGitObject}`,
      '   Subject: Synthetic regression fixture',
      '   Role: scanner test',
    ]),
  })

  expectPass('commit-graph-parent-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${cleanGitObject}`,
      `   Parent: ${gitObjectWithTelephoneShape}`,
      '   Subject: Synthetic regression fixture',
      '   Role: scanner test',
    ]),
  })

  expectFail('commit-graph-telephone-before-commit', {
    'COMMIT_GRAPH.txt': commitGraph([
      telephoneShape,
      `1. Commit: ${cleanGitObject}`,
    ]),
  }, 'telephone-shaped value before a Commit field')

  expectFail('commit-graph-telephone-after-parent', {
    'COMMIT_GRAPH.txt': commitGraph([
      `   Parent: ${cleanGitObject}`,
      telephoneShape,
    ]),
  }, 'telephone-shaped value after a Parent field')

  expectFail('commit-graph-telephone-on-other-line', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${gitObjectWithTelephoneShape}`,
      `   Parent: ${cleanGitObject}`,
      `Note: ${telephoneShape}`,
    ]),
  }, 'telephone-shaped value on another COMMIT_GRAPH line')

  expectFail('commit-graph-short-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${shortGitObjectWithTelephoneShape}`,
    ]),
  }, '39-character hexadecimal value in a Commit field')

  expectFail('commit-graph-long-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `   Parent: ${longGitObjectWithTelephoneShape}`,
    ]),
  }, '41-character hexadecimal value in a Parent field')

  expectFail('commit-graph-abbreviated-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${abbreviatedGitObjectWithTelephoneShape}`,
    ]),
  }, 'abbreviated SHA in a Commit field')

  expectFail('commit-graph-prose-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `See arbitrary prose token ${gitObjectWithTelephoneShape}.`,
    ]),
  }, '40-character hexadecimal value in arbitrary prose')

  expectFail('commit-graph-malformed-field', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit : ${gitObjectWithTelephoneShape}`,
      `   Parent: ${gitObjectWithTelephoneShape} trailing`,
    ]),
  }, 'malformed Commit or Parent field')

  expectFail('ordinary-email-address', {
    'ordinary.txt': ['reviewer', '@', 'example.test'].join(''),
  }, 'email address')

  expectFail('ordinary-nhs-number', {
    'ordinary.txt': ['NHS number: ', '123', ' ', '456', ' ', '7890'].join(''),
  }, 'NHS number')

  expectFail('ordinary-postcode', {
    'ordinary.txt': ['BT', '1 1AA'].join(''),
  }, 'UK postcode')

  expectFail('ordinary-patient-identifier', {
    'ordinary.txt': ['patient id: ', 'CASE-12345'].join(''),
  }, 'patient identifier')

  expectFail('commit-graph-adjacent-telephone-outside-git-object', {
    'COMMIT_GRAPH.txt': commitGraph([
      `1. Commit: ${cleanGitObject}${telephoneShape}`,
    ]),
  }, 'telephone-shaped value immediately adjacent to a Git object field')

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
    env: {
      ...process.env,
      REVIEW_PACKET_ADDITIONAL_GOVERNED_NAMES: JSON.stringify([SYNTHETIC_GOVERNED_NAME]),
    },
  })
}

function commitGraph(lines) {
  return [
    'Commit history evidence for source-ingestion review-v3',
    '',
    'Range shown:',
    'Synthetic regression fixture.',
    '',
    ...lines,
    '',
  ].join('\n')
}
