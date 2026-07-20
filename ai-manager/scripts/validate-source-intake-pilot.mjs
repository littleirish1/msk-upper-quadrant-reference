import fs from 'node:fs'
import path from 'node:path'
import {
  candidateReferenceRegistrySchema,
  sourceIntakeManifestSchema,
  sourceToContentGraphSchema,
} from '../schemas/managerSchemas.mjs'
import { CREDENTIAL_RULES } from '../../scripts/lib/secretPatterns.mjs'

const ROOT = process.cwd()
const REPORT_DIR = path.join(ROOT, 'ai-manager', 'reports', 'source-intake-pilot')
const MANIFEST_FILE = path.join(REPORT_DIR, 'source-manifest.json')
const REFERENCES_FILE = path.join(REPORT_DIR, 'references', 'candidate-reference-registry.json')
const GRAPH_FILE = path.join(REPORT_DIR, 'source-to-content-graph.json')
const findings = []

const manifest = validateJson(MANIFEST_FILE, sourceIntakeManifestSchema)
const references = validateJson(REFERENCES_FILE, candidateReferenceRegistrySchema)
const graph = validateJson(GRAPH_FILE, sourceToContentGraphSchema)

if (manifest) validateManifest(manifest)
if (manifest && references) validateReferences(manifest, references)
if (manifest && graph) validateGraph(manifest, graph)
validateTrackedReports()
validatePrivateCacheIgnore()

if (findings.length) {
  console.error('Private source-intake validation failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const records = manifest.records
console.log(
  `Private source-intake validation passed. ` +
  `${records.length} unique sources; ${manifest.summary.quarantinedSources} quarantined; ` +
  `${references.records.length} candidate references; ${graph.nodes.length} blocked proposals; public eligibility: 0.`,
)

function validateJson(file, schema) {
  if (!fs.existsSync(file)) {
    findings.push(`missing required report: ${relative(file)}`)
    return null
  }
  let value
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    findings.push(`${relative(file)} is not valid JSON: ${error.message}`)
    return null
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) {
      findings.push(`${relative(file)} ${issue.path.join('.')}: ${issue.message}`)
    }
    return null
  }
  return result.data
}

function validateManifest(value) {
  const ids = new Set()
  const checksums = new Map()
  for (const record of value.records) {
    if (ids.has(record.sourceId)) findings.push(`duplicate source ID: ${record.sourceId}`)
    ids.add(record.sourceId)
    const existing = checksums.get(record.checksum)
    if (existing) findings.push(`duplicate checksum represented by separate source IDs: ${existing} and ${record.sourceId}`)
    checksums.set(record.checksum, record.sourceId)
    if (record.publicEligibility !== false) findings.push(`${record.sourceId} is incorrectly public eligible`)
    if (record.sensitivity === 'quarantine' && record.reviewStatus !== 'quarantined') {
      findings.push(`${record.sourceId} quarantine status is inconsistent`)
    }
    if (record.logicalPath.includes('..')) findings.push(`${record.sourceId} uses parent traversal in logical path`)
  }
  if (value.summary.uniqueSources !== value.records.length) findings.push('manifest uniqueSources summary does not match records')
  if (value.summary.quarantinedSources !== value.records.filter((record) => record.sensitivity === 'quarantine').length) {
    findings.push('manifest quarantinedSources summary does not match records')
  }
}

function validateReferences(manifestValue, registry) {
  const ids = new Set()
  const sources = new Map(manifestValue.records.map((record) => [record.sourceId, record]))
  const statuses = new Set([
    'extracted-unverified', 'incomplete-citation', 'identifier-present-unverified',
    'likely-duplicate', 'verified-later', 'unable-to-identify',
  ])
  const doiPattern = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i
  const pmidPattern = /^\d{6,9}$/
  for (const record of registry.records) {
    if (ids.has(record.candidateReferenceId)) findings.push(`duplicate candidate reference ID: ${record.candidateReferenceId}`)
    ids.add(record.candidateReferenceId)
    if (!sources.has(record.sourceId)) findings.push(`${record.candidateReferenceId} has unknown source ID`)
    if (sources.get(record.sourceId)?.sensitivity === 'quarantine') {
      findings.push(`${record.candidateReferenceId} uses quarantined source ${record.sourceId}`)
    }
    if (!statuses.has(record.verificationStatus)) findings.push(`${record.candidateReferenceId} has invented verification status`)
    if (record.verificationStatus === 'verified-later' && !record.verificationEvidence) {
      findings.push(`${record.candidateReferenceId} is marked verified without evidence`)
    }
    if (record.doi && !doiPattern.test(record.doi)) findings.push(`${record.candidateReferenceId} has malformed DOI syntax`)
    if (record.pmid && !pmidPattern.test(record.pmid)) findings.push(`${record.candidateReferenceId} has malformed PMID syntax`)
    if (record.pageOrSlideNumber === null && !/document|embedded hyperlink/.test(record.location)) {
      findings.push(`${record.candidateReferenceId} is missing available page or slide provenance`)
    }
  }
}

function validateGraph(manifestValue, value) {
  const sources = new Map(manifestValue.records.map((record) => [record.sourceId, record]))
  const proposalIds = new Set()
  for (const node of value.nodes) {
    if (proposalIds.has(node.proposalId)) findings.push(`duplicate proposal ID: ${node.proposalId}`)
    proposalIds.add(node.proposalId)
    if (!node.sourceIds.length) findings.push(`${node.proposalId} has no source IDs`)
    for (const sourceId of node.sourceIds) {
      const source = sources.get(sourceId)
      if (!source) findings.push(`${node.proposalId} references unknown source ${sourceId}`)
      if (source?.sensitivity === 'quarantine') findings.push(`${node.proposalId} uses quarantined source ${sourceId}`)
    }
    if (node.publicEligibility !== false) findings.push(`${node.proposalId} is incorrectly public eligible`)
    if (node.teachingSourceCanEstablishPublicApproval !== false) findings.push(`${node.proposalId} lets teaching notes establish approval`)
    if (node.visualLicenceStatus === 'unknown-review-required' && node.publicEligibility) {
      findings.push(`${node.proposalId} publishes a visual with unknown copyright status`)
    }
  }
}

function validateTrackedReports() {
  if (!fs.existsSync(REPORT_DIR)) return
  const governedNames = readGovernedNames()
  for (const file of collectFiles(REPORT_DIR)) {
    const stat = fs.statSync(file)
    if (stat.size > 2 * 1024 * 1024) findings.push(`${relative(file)} exceeds the 2 MiB tracked-report threshold`)
    const buffer = fs.readFileSync(file)
    if (buffer.includes(0)) findings.push(`${relative(file)} appears binary`)
    const text = buffer.toString('utf8')
    if (/\b[A-Za-z]:[\\/](?:Users|dev|home)[\\/]/i.test(text)) findings.push(`${relative(file)} contains a private absolute path`)
    if (/\\\\[^\\\s]+\\[^\s]+/.test(text)) findings.push(`${relative(file)} contains a UNC path`)
    for (const rule of CREDENTIAL_RULES.filter((item) => item.kind === 'credential-value')) {
      rule.pattern.lastIndex = 0
      if (rule.pattern.test(text)) findings.push(`${relative(file)} contains a ${rule.label}`)
    }
    for (const name of governedNames) {
      if (text.toLowerCase().includes(name.toLowerCase())) {
        findings.push(`${relative(file)} contains a governed sensitive name`)
        break
      }
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) findings.push(`${relative(file)} contains private key material`)
    if (/^.{1200,}$/m.test(text)) findings.push(`${relative(file)} contains a source-body-like unbroken line`)
  }
}

function validatePrivateCacheIgnore() {
  const ignoreFile = path.join(ROOT, '.gitignore')
  if (!fs.existsSync(ignoreFile)) {
    findings.push('.gitignore is missing')
    return
  }
  const rules = fs.readFileSync(ignoreFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter((line) => line && !line.startsWith('#'))
  if (!rules.includes('ai-manager/private-cache/')) {
    findings.push('ai-manager/private-cache ignore rule is missing')
  }
  if (rules.some((rule) => rule.startsWith('!ai-manager/private-cache/'))) {
    findings.push('ai-manager/private-cache contains a negating ignore rule')
  }
}

function readGovernedNames() {
  const file = path.join(ROOT, 'ai-manager', 'content-hygiene-names.json')
  if (!fs.existsSync(file)) return []
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Object.values(value).flatMap((entry) => Array.isArray(entry) ? entry : []).filter(Boolean)
}

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : []
  }).sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
