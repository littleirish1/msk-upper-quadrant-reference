import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import { CREDENTIAL_RULES } from './lib/secretPatterns.mjs'
import {
  scanSensitiveText,
  sensitivePolicy,
} from '../ai-manager/scripts/sensitiveDataPolicy.mjs'
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
const citationExcerptLimit = sensitivePolicy().citationExcerptLimit
const COMMIT_GRAPH_PACKET_PATH = 'COMMIT_GRAPH.txt'
const SHA256_MANIFEST_PACKET_PATHS = new Set([
  'FILE_MANIFEST_SHA256.txt',
  'SHA256SUMS.txt',
])
const GIT_OBJECT_ID_TELEPHONE_SCAN_PLACEHOLDER = '[validated-git-object-id]'
const SHA256_MANIFEST_SCAN_PLACEHOLDER = '[validated-sha256]'
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
  ['ai-manager/scripts/validate-source-intake-pilot.mjs', new Set(['uk-postcode', 'unc-path'])],
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
for (const name of additionalGovernedNames()) sensitiveNames.push(name)

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
  scanCitationExcerptLimits(text, relative)

  const sharedSections = relative === '05-filtered-full-diff.patch' || relative.endsWith('.patch')
    ? splitPatchSections(text)
    : [{ repositoryPath: relative, text }]
  for (const section of sharedSections) {
    for (const pattern of packetCredentialValueRules) {
      pattern.lastIndex = 0
      if (pattern.test(section.text)) fail(relative + ': credential value detected')
    }
    const governedTexts = governedEvidenceTexts(relative, section)
    for (const governedText of governedTexts) for (const category of scanReviewPacketSensitiveText(
      governedText,
      relative,
      section.repositoryPath,
    )) {
      if (securityToolingCategoryAllowances.get(section.repositoryPath)?.has(category)) continue
      if (relative.endsWith('.patch') && section.repositoryPath?.startsWith('ai-manager/reports/source-intake-pilot/') && category === 'uk-postcode') continue
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
    const rules = securityToolingPaths.has(section.repositoryPath) || isExactCodePath(section.repositoryPath || relative)
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

function isGeneratedReportEvidence(packetPath, repositoryPath) {
  return packetPath.startsWith('tracked-reports/')
    || repositoryPath?.startsWith('ai-manager/reports/source-intake-pilot/')
}

function governedEvidenceTexts(packetPath, section) {
  if (isEvidenceHubReviewSource(packetPath, section.repositoryPath)) {
    if (!packetPath.endsWith('.patch') && packetPath.endsWith('evidence-hub-v1.schema.json')) {
      try { return jsonStringValuesExceptKeys(JSON.parse(section.text), new Set(['pattern'])) }
      catch { return [section.text] }
    }
    return section.text
      .split(/\r?\n/)
      .filter((line) => !/^(?:diff --git |index |--- |\+\+\+ |@@ )/.test(line))
      .map((line) => line.replace(/^[+ -]/, ''))
      .filter((line) => !/^\s*"pattern"\s*:/.test(line))
      .map(scrubMachineIdentifiers)
  }
  if (!isGeneratedReportEvidence(packetPath, section.repositoryPath)) return [section.text]
  if (packetPath.startsWith('tracked-reports/') && packetPath.endsWith('.json')) {
    try { return jsonStringValues(JSON.parse(section.text)).map(scrubMachineIdentifiers) }
    catch { return [section.text] }
  }
  return section.text.split(/\r?\n/).map((line) => {
    const content = line.replace(/^[+ -]/, '').replace(/^\s*"[^"]+"\s*:\s*/, '')
    return scrubMachineIdentifiers(content)
  })
}

function isEvidenceHubReviewSource(packetPath, repositoryPath) {
  const candidate = (repositoryPath || packetPath).replace(/^implementation\//, '')
  return candidate === 'docs/architecture/evidence-hub-v1.md'
    || candidate.endsWith('/evidence-hub-v1.schema.json')
    || candidate === 'evidence-hub-v1.schema.json'
    || candidate === 'scripts/lib/loadTypeScriptTree.mjs'
    || candidate === 'package.json'
    || candidate.startsWith('content/evidence-hub/')
    || candidate.startsWith('src/lib/evidence-hub/')
    || candidate.startsWith('scripts/evidence-hub/')
}

function scanReviewPacketSensitiveText(text, relative, repositoryPath) {
  let scanText = relative.endsWith('.patch') || relative.endsWith('.diff')
    ? scrubValidatedPatchMetadata(text)
    : text
  if (isExactCodePath(repositoryPath || relative)) {
    scanText = scrubBenignCodeStructures(scanText)
  }

  if (SHA256_MANIFEST_PACKET_PATHS.has(relative)) {
    return scanSensitiveText(scrubSha256ManifestHashFields(scanText))
  }

  const originalCategories = scanSensitiveText(scanText)
  if (relative !== COMMIT_GRAPH_PACKET_PATH || !originalCategories.includes('telephone-number')) {
    return originalCategories
  }

  const telephoneScanText = scrubCommitGraphGitObjectFields(scanText)
  if (telephoneScanText === scanText) return originalCategories

  const categories = new Set(scanSensitiveText(telephoneScanText))
  for (const category of originalCategories) {
    if (category !== 'telephone-number') categories.add(category)
  }
  return [...categories].sort()
}

function isExactCodePath(value) {
  return /\.(?:[cm]?js|jsx|json5?|tsx?)$/iu.test(String(value || ''))
}

function scrubBenignCodeStructures(text) {
  return text
    .replace(
      /\bcaseId(\s*:\s*)(?=[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/gu,
      `codeProperty$1`,
    )
    .replace(
      /^([+ -]?\s*(?:const|let|var)\s+\w*PathPattern\s*=\s*)\/[^\r\n/]*(?:\\.[^\r\n/]*)*\/[dgimsuvy]*\s*;?\s*$/gimu,
      '$1/[validated-path-detection-regex]/',
    )
}

function scrubValidatedPatchMetadata(text) {
  return text
    .split(/(\r?\n)/u)
    .map((part, index) => {
      if (index % 2 === 1) return part
      if (/^index [0-9a-f]{40,64}\.\.[0-9a-f]{40,64}(?: [0-7]{6})?$/u.test(part)) {
        return 'index [validated-old-object-id]..[validated-new-object-id]'
      }
      return part
    })
    .join('')
}

function scrubSha256ManifestHashFields(text) {
  return text.replace(
    /^(?:sha256:)?[0-9a-f]{64}(?=\s{2,}\S)/gimu,
    SHA256_MANIFEST_SCAN_PLACEHOLDER,
  )
}

function scrubCommitGraphGitObjectFields(text) {
  const parts = text.split(/(\r?\n)/u)
  let changed = false

  for (let index = 0; index < parts.length; index += 2) {
    const parsed = parseCommitGraphGitObjectLine(parts[index])
    if (!parsed) continue
    parts[index] = parsed.prefix + GIT_OBJECT_ID_TELEPHONE_SCAN_PLACEHOLDER
    changed = true
  }

  return changed ? parts.join('') : text
}

function parseCommitGraphGitObjectLine(line) {
  const commit = /^(\d+\. Commit: )([0-9a-f]{40})$/u.exec(line)
  if (commit) return { prefix: commit[1] }

  const parent = /^(\s{3}Parent: )([0-9a-f]{40})$/u.exec(line)
  if (parent) return { prefix: parent[1] }

  return null
}

function scrubMachineIdentifiers(text) {
  return text.replace(/(?:sha256:)?[0-9a-f]{64}|(?:src|ref|run)-[0-9a-f]{12,64}|ref-[a-z0-9-]+/giu, '[machine-id]')
}

function scanCitationExcerptLimits(text, relative) {
  if (!Number.isInteger(citationExcerptLimit) || citationExcerptLimit < 1) {
    fail('invalid citation excerpt policy')
    return
  }

  if (relative.endsWith('.json')) {
    try {
      const parsed = JSON.parse(text)
      for (const length of collectNamedStringLengths(parsed, 'citationText')) {
        if (length > citationExcerptLimit) {
          fail(relative + ': citation excerpt exceeds policy limit')
        }
      }
    } catch {
      // Other checks still inspect non-JSON text stored with a .json suffix.
    }
  }

  if (!relative.endsWith('.patch')) return
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const match = /^\+\s*"citationText"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/u.exec(line)
    if (!match) continue
    try {
      if (JSON.parse(match[1]).length > citationExcerptLimit) {
        fail(relative + ': citation excerpt exceeds policy limit')
      }
    } catch {
      fail(relative + ': malformed citation excerpt in patch')
    }
  }
}

function collectNamedStringLengths(value, targetKey) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNamedStringLengths(item, targetKey))
  }
  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, item]) => {
    const own = key === targetKey && typeof item === 'string' ? [item.length] : []
    return own.concat(collectNamedStringLengths(item, targetKey))
  })
}

function additionalGovernedNames() {
  const raw = process.env.REVIEW_PACKET_ADDITIONAL_GOVERNED_NAMES
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error('expected a non-empty string array')
    }
    return parsed.map((item) => item.trim())
  } catch {
    fail('invalid additional governed-name fixture configuration')
    return []
  }
}

function jsonStringValues(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(jsonStringValues)
  if (value && typeof value === 'object') return Object.values(value).flatMap(jsonStringValues)
  return []
}

function jsonStringValuesExceptKeys(value, excludedKeys) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((item) => jsonStringValuesExceptKeys(item, excludedKeys))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => excludedKeys.has(key) ? [] : jsonStringValuesExceptKeys(item, excludedKeys))
  }
  return []
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
