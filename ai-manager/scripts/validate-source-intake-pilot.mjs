import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextDecoder } from 'node:util'
import {
  candidateReferenceRegistryV2Schema,
  classificationOverridesSchema,
  clearanceLedgerSchema,
  securityFalsePositiveDecisionsSchema,
  sourceIntakeManifestV2Schema,
  sourceIntakeRunManifestSchema,
  sourceToContentGraphV2Schema,
} from '../schemas/sourceIntakeSchemas.mjs'
import { scanSensitiveText } from './sensitiveDataPolicy.mjs'

const ROOT = process.cwd()
const REPORT_DIR = path.join(ROOT, 'ai-manager', 'reports', 'source-intake-pilot')
const findings = []

export function validateSourceIntake(reportDir = REPORT_DIR, options = {}) {
  findings.length = 0
  const manifest = validateJson(path.join(reportDir, 'source-manifest.json'), sourceIntakeManifestV2Schema)
  const references = validateJson(path.join(reportDir, 'references', 'candidate-reference-registry.json'), candidateReferenceRegistryV2Schema)
  const graph = validateJson(path.join(reportDir, 'source-to-content-graph.json'), sourceToContentGraphV2Schema)
  const run = validateJson(path.join(reportDir, 'run-manifest.json'), sourceIntakeRunManifestSchema)
  const clearance = validateJson(path.join(ROOT, 'ai-manager', 'config', 'source-clearance-ledger.json'), clearanceLedgerSchema)
  const overrides = validateJson(path.join(ROOT, 'ai-manager', 'config', 'source-classification-overrides.json'), classificationOverridesSchema)
  const securityDecisions = validateJson(path.join(ROOT, 'ai-manager', 'config', 'security-false-positive-decisions.json'), securityFalsePositiveDecisionsSchema)
  if (manifest) validateManifest(manifest)
  if (manifest && references) validateReferences(manifest, references)
  if (manifest && graph) validateGraph(manifest, graph)
  if (manifest && run && references && graph) validateRun(manifest, references, graph, run, reportDir)
  if (manifest && graph) validateMarkdownReports(reportDir, manifest, graph)
  if (manifest && clearance) validateClearance(manifest, clearance)
  if (manifest && overrides) validateOverrides(manifest, overrides)
  if (manifest && securityDecisions) validateSecurityDecisions(manifest, securityDecisions)
  validateTrackedReports(reportDir)
  validatePrivateCacheIgnore()
  if (!options.quiet) reportResult(manifest, references, graph)
  return [...findings]
}

function validateJson(file, schema) {
  if (!fs.existsSync(file)) { findings.push(`missing required file: ${relative(file)}`); return null }
  let value
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (error) { findings.push(`${relative(file)} is invalid JSON: ${error.message}`); return null }
  const result = schema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.')}: ${issue.message}`)
    return null
  }
  return result.data
}

function validateManifest(value) {
  const ids = new Map()
  const checksums = new Set()
  for (const record of value.records) {
    if (ids.has(record.sourceId) && ids.get(record.sourceId) !== record.checksum) findings.push(`display source-ID collision: ${record.sourceId}`)
    ids.set(record.sourceId, record.checksum)
    if (checksums.has(record.checksum)) findings.push(`duplicate full checksum represented twice: ${record.sourceId}`)
    checksums.add(record.checksum)
    if (!record.checksum.startsWith(`sha256:${record.sourceId.slice(4)}`)) findings.push(`${record.sourceId} does not match its checksum prefix`)
    if (record.publicEligibility !== false) findings.push(`${record.sourceId} is public eligible`)
    if (record.sensitivity === 'quarantined' && record.reviewStatus !== 'quarantined') findings.push(`${record.sourceId} quarantine state is inconsistent`)
    if (record.sensitivity === 'restricted-pending-clearance' && record.clearanceScopes.length) findings.push(`${record.sourceId} has clearance scopes while restricted`)
    for (const occurrence of record.occurrences) {
      if (!isSafeLogicalPath(occurrence.logicalPath)) findings.push(`${record.sourceId} has unsafe occurrence path`)
    }
  }
  const expected = {
    uniqueSources: value.records.length,
    quarantinedSources: value.records.filter((item) => item.sensitivity === 'quarantined').length,
    restrictedPendingClearanceSources: value.records.filter((item) => item.sensitivity === 'restricted-pending-clearance').length,
    clearedSources: value.records.filter((item) => item.sensitivity === 'cleared-for-private-evidence-processing').length,
  }
  for (const [key, count] of Object.entries(expected)) if (value.summary[key] !== count) findings.push(`manifest ${key} summary mismatch`)
}

function validateReferences(manifest, registry) {
  const ids = new Set()
  const sources = new Map(manifest.records.map((item) => [item.sourceId, item]))
  for (const record of registry.records) {
    if (ids.has(record.candidateReferenceId)) findings.push(`duplicate candidate reference ID: ${record.candidateReferenceId}`)
    ids.add(record.candidateReferenceId)
    const source = sources.get(record.sourceId)
    if (!source) findings.push(`${record.candidateReferenceId} uses unknown source`)
    else {
      if (source.checksum !== record.sourceChecksum) findings.push(`${record.candidateReferenceId} source checksum mismatch`)
      if (!sourceAllowsScope(source, 'citation-extraction')) findings.push(`${record.candidateReferenceId} uses source unavailable for citation extraction`)
    }
    if (record.verificationEvidence !== null) findings.push(`${record.candidateReferenceId} claims verification evidence`)
    if (record.citationText.length > 280) findings.push(`${record.candidateReferenceId} exceeds citation excerpt limit`)
    if (record.doi && !/^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(record.doi)) findings.push(`${record.candidateReferenceId} has malformed DOI`)
    if (record.pmid && !/^\d{6,9}$/.test(record.pmid)) findings.push(`${record.candidateReferenceId} has malformed PMID`)
    if (record.pageOrSlideNumber === null && !/document|hyperlink/.test(record.location)) findings.push(`${record.candidateReferenceId} lacks available provenance`)
  }
}

function validateGraph(manifest, graph) {
  const sources = new Map(manifest.records.map((item) => [item.sourceId, item]))
  const proposals = new Set()
  for (const node of graph.nodes) {
    if (proposals.has(node.proposalId)) findings.push(`duplicate proposal ID: ${node.proposalId}`)
    proposals.add(node.proposalId)
    node.sourceIds.forEach((sourceId, index) => {
      const source = sources.get(sourceId)
      if (!source) findings.push(`${node.proposalId} uses unknown source`)
      else {
        if (source.checksum !== node.sourceChecksums[index]) findings.push(`${node.proposalId} source checksum mismatch`)
        if (!sourceAllowsScope(source, 'private-proposal-support')) findings.push(`${node.proposalId} uses source unavailable for proposal support`)
      }
    })
  }
}

function validateRun(manifest, references, graph, run, reportDir) {
  if (new Set([manifest.runId, references.runId, graph.runId, run.runId]).size !== 1) findings.push('run IDs are inconsistent')
  if (manifest.sourceSetFingerprint !== run.sourceSetFingerprint) findings.push('run source-set fingerprint mismatch')
  const actual = collectFiles(reportDir).map((file) => normalize(path.relative(reportDir, file))).sort()
  const expected = [...run.expectedFiles].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) findings.push('tracked report set differs from run manifest')
}

function validateClearance(manifest, ledger) {
  const records = new Map(manifest.records.map((item) => [item.checksum, item]))
  const seen = new Set()
  for (const entry of ledger.entries) {
    if (seen.has(entry.checksum)) findings.push('duplicate clearance checksum')
    seen.add(entry.checksum)
    const record = records.get(entry.checksum)
    if (!record) findings.push('clearance ledger contains an unknown checksum')
    else if (record.sourceId !== entry.sourceId) findings.push('clearance ledger source-ID mismatch')
    if (entry.previousStatus === 'quarantined' && entry.decision === 'clear-for-private-evidence-processing') findings.push('quarantine was bypassed')
  }
}

function validateOverrides(manifest, overrides) {
  const records = new Map(manifest.records.map((item) => [item.checksum, item]))
  const seen = new Set()
  for (const entry of overrides.entries) {
    if (seen.has(entry.checksum)) findings.push('duplicate classification override')
    seen.add(entry.checksum)
    const record = records.get(entry.checksum)
    if (!record) findings.push('classification override contains an unknown checksum')
    else if (record.sourceId !== entry.sourceId) findings.push('classification override source-ID mismatch')
  }
}

function validateSecurityDecisions(manifest, decisions) {
  const records = new Map(manifest.records.map((item) => [item.checksum, item]))
  const seen = new Set()
  for (const entry of decisions.entries) {
    const key = `${entry.checksum}|${entry.detectorRuleId}`
    if (seen.has(key)) findings.push('duplicate or contradictory security false-positive decision')
    seen.add(key)
    const record = records.get(entry.checksum)
    if (!record) findings.push('security false-positive decision contains an unknown checksum')
    else if (record.sourceId !== entry.sourceId) findings.push('security false-positive source-ID mismatch')
    if (entry.decisionScope !== 'credential-stop-override-for-exact-checksum-only') findings.push('security false-positive decision has an invalid scope')
  }
}

export function scanTrackedText(text, context = 'tracked report') {
  const result = []
  if (text.includes('\uFFFD')) result.push(`${context}: replacement character detected`)
  const scrubbed = text.replace(/(?:sha256:)?[0-9a-f]{64}|(?:src|ref|run)-[0-9a-f]{12,64}|ref-[a-z0-9-]+/giu, '[machine-id]')
  const categories = new Set([
    ...scanSensitiveText(scrubbed),
    ...scanSensitiveText(scrubbed.replaceAll('\\\\', '\\')),
  ])
  for (const category of categories) result.push(`${context}: ${category}`)
  return result
}

export function sourceAllowsScope(source, scope) {
  return source.sensitivity === 'cleared-for-private-evidence-processing'
    && source.clearanceScopes.includes(scope)
    && ['extracted', 'partial'].includes(source.extractionStatus)
}

const sourceListPattern = /<!-- source-list role=([a-z-]+) scope=([a-z-]+) -->\s*([\s\S]*?)<!-- \/source-list -->/g
const sourceEntryPattern = /^- sourceId=(src-[0-9a-f]{12}); governance=([a-z-]+); extraction=([a-z-]+)$/

export function validateMarkdownGovernance(text, records, context = 'markdown') {
  const localFindings = []
  const sources = new Map(records.map((item) => [item.sourceId, item]))
  const blocks = []
  for (const sourceId of text.match(/src-[0-9a-f]{12}/g) ?? []) {
    if (!sources.has(sourceId)) localFindings.push(`${context}: unknown source ID ${sourceId}`)
  }
  for (const match of text.matchAll(sourceListPattern)) {
    const [, role, scope, body] = match
    const ids = []
    const lines = body.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length === 1 && lines[0] === '- none') {
      blocks.push({ role, scope, ids })
      continue
    }
    for (const line of lines) {
      const entry = sourceEntryPattern.exec(line)
      if (!entry) { localFindings.push(`${context}: malformed ${role} source-list entry`); continue }
      const [, sourceId, governance, extraction] = entry
      const source = sources.get(sourceId)
      ids.push(sourceId)
      if (!source) continue
      if (source.sensitivity !== governance) localFindings.push(`${context}: status mismatch for ${sourceId}`)
      if (source.extractionStatus !== extraction) localFindings.push(`${context}: extraction-status mismatch for ${sourceId}`)
      if (role === 'eligible' && !sourceAllowsScope(source, scope)) localFindings.push(`${context}: ineligible source ${sourceId} in eligible list`)
      if (role === 'restricted' && source.sensitivity !== 'restricted-pending-clearance') localFindings.push(`${context}: non-restricted source ${sourceId} in restricted list`)
      if (role === 'quarantined' && source.sensitivity !== 'quarantined') localFindings.push(`${context}: non-quarantined source ${sourceId} in quarantine list`)
      if (role === 'review-required' && source.sensitivity !== 'review-required') localFindings.push(`${context}: governance mismatch in review-required list for ${sourceId}`)
      if (role === 'metadata-only' && !['failed', 'metadata-only', 'unsupported'].includes(source.extractionStatus)) localFindings.push(`${context}: extracted source ${sourceId} in metadata-only list`)
      if (!['eligible', 'restricted', 'quarantined', 'review-required', 'metadata-only'].includes(role)) localFindings.push(`${context}: unknown source-list role ${role}`)
    }
    blocks.push({ role, scope, ids })
  }
  if (/\b(?:publication|clinical)\s+(?:status\s*[:=]\s*)?approved\b/i.test(text) || /\bpublicEligibility\s*[:=]\s*true\b/i.test(text)) {
    localFindings.push(`${context}: positive public or clinical approval wording`)
  }
  return { findings: [...new Set(localFindings)], blocks }
}

function validateMarkdownReports(reportDir, manifest, graph) {
  const markdown = collectFiles(reportDir).filter((file) => file.endsWith('.md'))
  for (const file of markdown) {
    const result = validateMarkdownGovernance(fs.readFileSync(file, 'utf8'), manifest.records, relative(file))
    findings.push(...result.findings)
  }

  const summaryFile = path.join(reportDir, 'source-summary.md')
  const summary = validateMarkdownGovernance(fs.readFileSync(summaryFile, 'utf8'), manifest.records, relative(summaryFile))
  const expectedByRole = new Map([
    ['eligible', manifest.records.filter((item) => sourceAllowsScope(item, 'private-topic-mapping')).map((item) => item.sourceId).sort()],
    ['review-required', manifest.records.filter((item) => item.sensitivity === 'review-required').map((item) => item.sourceId).sort()],
    ['restricted', manifest.records.filter((item) => item.sensitivity === 'restricted-pending-clearance').map((item) => item.sourceId).sort()],
    ['quarantined', manifest.records.filter((item) => item.sensitivity === 'quarantined').map((item) => item.sourceId).sort()],
  ])
  for (const [role, expected] of expectedByRole) {
    const blocks = summary.blocks.filter((item) => item.role === role)
    if (blocks.length !== 1) { findings.push(`source-summary must contain one ${role} inventory`); continue }
    if (JSON.stringify([...blocks[0].ids].sort()) !== JSON.stringify(expected)) findings.push(`source-summary ${role} inventory mismatch`)
  }

  for (const node of graph.nodes) {
    const topic = node.proposalId.includes('lateral-ankle-sprain') ? 'lateral-ankle-sprain' : 'rcrsp'
    const expected = manifest.records.filter((item) => item.topicTags.includes(topic) && sourceAllowsScope(item, 'private-proposal-support')).map((item) => item.sourceId).sort()
    if (JSON.stringify([...node.sourceIds].sort()) !== JSON.stringify(expected)) findings.push(`${node.proposalId} support count does not reconcile with eligibility`)
  }
}

function validateTrackedReports(reportDir) {
  if (!fs.existsSync(reportDir)) { findings.push('tracked report directory is missing'); return }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  for (const file of collectFiles(reportDir)) {
    const stat = fs.statSync(file)
    if (stat.size > 3 * 1024 * 1024) findings.push(`${relative(file)} exceeds tracked-report size limit`)
    const bytes = fs.readFileSync(file)
    if (bytes.includes(0)) { findings.push(`${relative(file)} appears binary`); continue }
    let text
    try { text = decoder.decode(bytes) }
    catch { findings.push(`${relative(file)} is not valid UTF-8`); continue }
    if (file.endsWith('.json')) {
      try {
        for (const value of jsonStringValues(JSON.parse(text))) findings.push(...scanTrackedText(value, relative(file)))
      } catch {
        // Required JSON files receive a schema error; unexpected JSON is still rejected below.
        findings.push(`${relative(file)} is invalid JSON`)
      }
    } else {
      findings.push(...scanTrackedText(text, relative(file)))
    }
    if (file.endsWith('.md')) {
      if (text.split(/\r?\n/).some((line) => line.length > 900)) findings.push(`${relative(file)} has a source-body-like long line`)
      if (/^(?:[A-Za-z][^\n]{80,}\n){8,}/m.test(text)) findings.push(`${relative(file)} has a source-body-like prose block`)
    }
  }
}

function validatePrivateCacheIgnore() {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => normalize(line.trim()))
  if (!ignore.includes('ai-manager/private-cache/')) findings.push('private-cache ignore rule is missing')
  if (ignore.some((line) => line.startsWith('!ai-manager/private-cache/'))) findings.push('private-cache has a negating ignore rule')
}

function reportResult(manifest, references, graph) {
  if (findings.length) {
    console.error('Private source-intake validation failed.')
    findings.forEach((item) => console.error(`- ${item}`))
    process.exitCode = 1
    return
  }
  console.log(`Private source-intake validation passed. ${manifest.records.length} unique sources; ${manifest.summary.quarantinedSources} quarantined; ${manifest.summary.restrictedPendingClearanceSources} restricted pending clearance; ${references.records.length} candidate references; ${graph.nodes.length} blocked proposals; public eligibility: 0.`)
}

function isSafeLogicalPath(value) {
  const normalized = normalize(value)
  return !normalized.startsWith('/') && !/^[A-Za-z]:/.test(normalized) && !normalized.split('/').includes('..') && scanSensitiveText(normalized).length === 0
}
function collectFiles(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const item = path.join(dir, entry.name); return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : [] }).sort() }
function jsonStringValues(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(jsonStringValues)
  if (value && typeof value === 'object') return Object.values(value).flatMap(jsonStringValues)
  return []
}
function normalize(value) { return value.replaceAll('\\', '/') }
function relative(file) { return normalize(path.relative(ROOT, file)) }
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateSourceIntake()
  if (result.length) process.exit(1)
}
