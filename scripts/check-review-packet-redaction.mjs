import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import { CREDENTIAL_RULES } from './lib/secretPatterns.mjs'
import { scanSensitiveText } from '../ai-manager/scripts/sensitiveDataPolicy.mjs'
import {
  RAW_LEGACY_PREFIX,
  SENSITIVE_DELETION_SUMMARY,
  isSensitiveRepositoryPath,
  normalizePath,
} from './lib/reviewPacketPolicy.mjs'

const ROOT = process.cwd()
const packetArg = process.argv.slice(2).find((item) => !item.startsWith('--')) || 'phase-hardening-rereview'
const complete = process.argv.includes('--complete')
const packetDir = path.resolve(ROOT, packetArg)
const hygieneFile = path.join(ROOT, 'ai-manager', 'content-hygiene-names.json')
const findings = []
const decoder = new TextDecoder('utf-8', { fatal: true })
const securityToolingPaths = new Set([
  'ai-manager/schemas/sourceIntakeSchemas.mjs',
  'ai-manager/scripts/sensitiveDataPolicy.mjs',
  'ai-manager/scripts/source_intake_policy.py',
  'ai-manager/scripts/test-source-intake-validation.mjs',
  'ai-manager/scripts/validate-source-intake-pilot.mjs',
  'ai-manager/tests/test_source_intake_hardening.py',
  'scripts/check-review-packet-redaction.mjs',
  'scripts/check-secrets.mjs',
  'scripts/lib/secretPatterns.mjs',
])
const securityToolingCategoryAllowances = new Map([
  ['ai-manager/schemas/sourceIntakeSchemas.mjs', new Set(['contact-or-correspondence-block', 'telephone-number'])],
  ['ai-manager/scripts/sensitiveDataPolicy.mjs', new Set(['unc-path'])],
  ['ai-manager/scripts/source_intake_policy.py', new Set(['credential-value', 'unc-path'])],
  ['ai-manager/scripts/test-source-intake-validation.mjs', new Set(['unc-path'])],
  ['ai-manager/scripts/validate-source-intake-pilot.mjs', new Set(['unc-path'])],
  ['ai-manager/tests/test_source_intake_hardening.py', new Set(['contact-or-correspondence-block'])],
])
const packetCredentialValueRules = [
  new RegExp(`\\b(?:${['A', 'KIA'].join('')}|${['A', 'SIA'].join('')})[A-Z0-9]{16}\\b`, 'g'),
  new RegExp(`-----BEGIN [A-Z ]*${['PRIVATE', ' KEY'].join('')}-----`, 'g'),
]

if (!fs.existsSync(packetDir) || !fs.statSync(packetDir).isDirectory()) {
  fail('packet directory is missing')
  finish()
}

const hygiene = JSON.parse(fs.readFileSync(hygieneFile, 'utf8'))
const sensitiveNames = Array.isArray(hygiene.termsToFlag)
  ? hygiene.termsToFlag.filter((item) => typeof item === 'string' && item.trim())
  : []

for (const file of collectFiles(packetDir)) {
  const relative = normalizePath(path.relative(packetDir, file))

  if (isSensitiveRepositoryPath(relative)) {
    fail(relative + ': forbidden sensitive or binary packet entry')
    continue
  }

  const bytes = fs.readFileSync(file)
  if (bytes.includes(0)) {
    fail(relative + ': binary or UTF-16 content detected')
    continue
  }

  let text
  try {
    text = decoder.decode(bytes)
  } catch {
    fail(relative + ': invalid UTF-8')
    continue
  }

  if (relative !== SENSITIVE_DELETION_SUMMARY && text.includes(RAW_LEGACY_PREFIX)) {
    fail(relative + ': sensitive legacy path appears outside deletion summary')
  }

  if (/[A-Za-z]:[\\/](?:Users|dev)[\\/]/i.test(text)) {
    fail(relative + ': private local path detected')
  }

  scanCredentialRules(text, relative)

  const sharedSections = relative === '05-filtered-full-diff.patch' || relative.endsWith('.patch')
    ? splitPatchSections(text)
    : [{ repositoryPath: relative, text }]
  for (const section of sharedSections) {
    for (const pattern of packetCredentialValueRules) {
      pattern.lastIndex = 0
      if (pattern.test(section.text)) fail(relative + ': credential value detected')
    }
    for (const category of scanSensitiveText(section.text)) {
      if (securityToolingCategoryAllowances.get(section.repositoryPath)?.has(category)) continue
      fail(relative + ': governed sensitive-data pattern detected (' + category + ')')
    }
  }

  const lower = text.toLowerCase()
  if (sensitiveNames.some((term) => lower.includes(term.toLowerCase()))) {
    fail(relative + ': governed sensitive-name pattern detected')
  }
}

if (complete) {
  const required = [
    '00-REVIEW-CLAIM.md',
    '01-git-status.txt',
    '02-recent-commits.txt',
    '03-diff-stat.txt',
    '04-diff-name-status.txt',
    '05-filtered-full-diff.patch',
    '06-sensitive-deletion-summary.md',
    '07-preflight-output.txt',
    '08-generated-source-currentness-output.txt',
    '09-review-packet-redaction-output.txt',
    '10-git-diff-check-output.txt',
    'FINAL_CODEX_REPORT.md',
    'SHA256SUMS.txt',
  ]
  for (const file of required) {
    if (!fs.existsSync(path.join(packetDir, file))) fail('missing required packet file: ' + file)
  }
}

finish()

function scanCredentialRules(text, relative) {
  const sections = relative === '05-filtered-full-diff.patch'
    ? splitPatchSections(text)
    : [{ repositoryPath: null, text }]

  for (const section of sections) {
    const rules = securityToolingPaths.has(section.repositoryPath)
      ? CREDENTIAL_RULES.filter((rule) => rule.kind === 'credential-value')
      : CREDENTIAL_RULES

    for (const rule of rules) {
      rule.pattern.lastIndex = 0
      if (rule.pattern.test(section.text)) {
        fail(relative + ': ' + rule.label + ' pattern detected')
      }
    }
  }
}

function splitPatchSections(text) {
  const matches = [...text.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)]
  if (matches.length === 0) return [{ repositoryPath: null, text }]

  const sections = []
  if (matches[0].index > 0) {
    sections.push({ repositoryPath: null, text: text.slice(0, matches[0].index) })
  }

  matches.forEach((match, index) => {
    const start = match.index
    const end = matches[index + 1]?.index ?? text.length
    sections.push({
      repositoryPath: normalizePath(match[2].trim()),
      text: text.slice(start, end),
    })
  })

  return sections
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

function fail(message) {
  findings.push(message)
}

function finish() {
  if (findings.length > 0) {
    console.error('Review packet redaction check failed.')
    for (const finding of findings) console.error('- ' + finding)
    process.exit(1)
  }

  console.log('Review packet redaction check passed.')
  console.log('Forbidden-content findings: 0')
  console.log('Packet text encoding: UTF-8')
}
