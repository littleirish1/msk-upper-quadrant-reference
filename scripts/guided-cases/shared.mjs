import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

export const ROOT = process.cwd()
export const CASE_CONTENT_DIR = path.join(ROOT, 'content', 'guided-cases')
export const RECORDS_DIR = path.join(CASE_CONTENT_DIR, 'records')
export const REPORTS_DIR = path.join(ROOT, 'reports', 'guided-cases')
export const SCHEMA_DIR = path.join(ROOT, 'src', 'lib', 'guided-cases')
export const JSON_SCHEMA_FILE = path.join(SCHEMA_DIR, 'guided-case-v2.schema.json')
export const PUBLIC_REGISTRY_FILE = path.join(ROOT, 'src', 'data', 'public-case-registry.json')

export async function loadGuidedCaseModule() {
  return loadTypeScriptTree(path.join(SCHEMA_DIR, 'index.ts'), SCHEMA_DIR)
}

export function collectRecordFiles() {
  return walk(RECORDS_DIR).filter((file) => file.endsWith('.json')).sort()
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${relative(file)}: ${error.message}`)
  }
}

export async function readRecords() {
  const module = await loadGuidedCaseModule()
  const records = []
  const findings = []
  for (const file of collectRecordFiles()) {
    const result = module.guidedCaseRecordSchema.safeParse(readJson(file))
    if (!result.success) {
      for (const issue of result.error.issues) {
        findings.push(`${relative(file)} ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      }
      continue
    }
    records.push({ file, record: result.data })
  }
  return { module, records, findings }
}

export function stableJson(value) {
  return JSON.stringify(sortValue(value), null, 2) + '\n'
}

export function canonicalText(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function fileSha256(file) {
  return sha256(fs.readFileSync(file))
}

export function canonicalCaseHash(record) {
  const governedContent = {
    schemaVersion: record.schemaVersion,
    caseId: record.caseId,
    learnerCaseNumber: record.learnerCaseNumber,
    neutralTitle: record.neutralTitle,
    region: record.region,
    publicSlug: record.publicSlug,
    contentRevision: record.contentRevision,
    lifecycleState: record.lifecycleState,
    publicationEligibility: record.publicationEligibility,
    difficulty: record.difficulty,
    estimatedTime: record.estimatedTime,
    privateDiagnosticIdentity: record.privateDiagnosticIdentity,
    learnerPresentation: record.learnerPresentation,
    reasoningStages: record.reasoningStages,
    provenance: record.provenance,
  }
  return sha256(stableJson(governedContent))
}

export function temporaryDirectory(prefix = 'guided-cases-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : []
  })
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  )
}
