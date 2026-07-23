import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

export const ROOT = process.cwd()
export const HUB_DIR = path.join(ROOT, 'content', 'evidence-hub')
export const HUB_LIB_DIR = path.join(ROOT, 'src', 'lib', 'evidence-hub')
export const ENTITY_DIRECTORIES = new Map([
  ['evidence', 'evidence'],
  ['claims', 'claim'],
  ['references', 'reference'],
  ['anatomy', 'anatomy'],
  ['exercises', 'exercise'],
  ['clinical-tests', 'clinical-test'],
  ['outcome-measures', 'outcome-measure'],
  ['guided-cases', 'guided-case'],
  ['media-assets', 'media-asset'],
])

export async function loadEvidenceHubModule() {
  return loadTypeScriptTree(path.join(HUB_LIB_DIR, 'index.ts'), HUB_LIB_DIR)
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${relative(file)}: ${error.message}`)
  }
}

export function collectJson(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectJson(item) : entry.isFile() && entry.name.endsWith('.json') ? [item] : []
  }).sort()
}

export function containsEvidenceHubImport(source) {
  return /(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*(?:\/|^)evidence-hub(?:\/[^'"]*)?['"]/.test(source)
}

export function findPublicEvidenceHubImportChains(srcRoot, publicSourceDirs) {
  const findings = []
  const starts = publicSourceDirs
    .filter((directory) => fs.existsSync(directory))
    .flatMap((directory) => collectSourceFiles(directory))
    .sort()

  for (const start of starts) {
    const visited = new Set()
    const visit = (file, chain) => {
      const normalized = path.resolve(file)
      if (visited.has(normalized)) return
      visited.add(normalized)

      const source = fs.readFileSync(normalized, 'utf8')
      for (const specifier of collectImportSpecifiers(source)) {
        const nextChain = [...chain, normalized]
        if (isEvidenceHubSpecifier(specifier)) {
          findings.push([...nextChain, specifier].map((item) => displayImportNode(item, srcRoot)).join(' -> '))
          continue
        }
        const resolved = resolveLocalImport(specifier, normalized, srcRoot)
        if (!resolved) continue
        if (isWithin(path.join(srcRoot, 'lib', 'evidence-hub'), resolved)) {
          findings.push([...nextChain, resolved].map((item) => displayImportNode(item, srcRoot)).join(' -> '))
          continue
        }
        if (isWithin(srcRoot, resolved)) visit(resolved, nextChain)
      }
    }
    visit(start, [])
  }

  return [...new Set(findings)].sort()
}

export function readDataset(module) {
  const records = []
  const files = []
  const findings = []
  for (const [directory, entityType] of ENTITY_DIRECTORIES) {
    for (const file of collectJson(path.join(HUB_DIR, directory))) {
      const value = readJson(file)
      const result = module.evidenceHubRecordSchema.safeParse(value)
      if (!result.success) {
        for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      } else if (result.data.entityType !== entityType) {
        findings.push(`${relative(file)} belongs in the ${result.data.entityType} directory`)
      } else {
        records.push(result.data)
        files.push(file)
      }
    }
  }

  const relationships = parseCatalog(
    path.join(HUB_DIR, 'relationships', 'index.json'),
    module.relationshipCatalogSchema,
    'relationships',
    findings,
  )
  const reviewDecisions = parseCatalog(
    path.join(HUB_DIR, 'review-decisions', 'index.json'),
    module.reviewDecisionCatalogSchema,
    'decisions',
    findings,
  )
  const proposals = parseCatalog(
    path.join(HUB_DIR, 'proposals', 'index.json'),
    module.proposalCatalogSchema,
    'proposals',
    findings,
  )
  const pilots = collectJson(path.join(HUB_DIR, 'pilots')).map((file) => {
    const result = module.pilotPlaceholderSchema.safeParse(readJson(file))
    if (!result.success) {
      for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      return null
    }
    return result.data
  }).filter(Boolean)

  return { dataset: { records, relationships, reviewDecisions, proposals }, pilots, files, findings }
}

export function buildJsonSchemaDocument(module) {
  const schemas = {
    evidence: module.evidenceSchema,
    claim: module.claimSchema,
    condition: module.conditionSchema,
    anatomy: module.anatomySchema,
    exercise: module.exerciseSchema,
    clinicalTest: module.clinicalTestSchema,
    outcomeMeasure: module.outcomeMeasureSchema,
    guidedCase: module.guidedCaseSchema,
    reference: module.referenceSchema,
    mediaAsset: module.mediaAssetSchema,
    relationship: module.hubRelationshipSchema,
    reviewDecision: module.reviewDecisionSchema,
    aiProposal: module.aiProposalSchema,
    pilot: module.pilotPlaceholderSchema,
  }
  const definitions = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => {
    const generated = module.zodToJsonSchema
      ? module.zodToJsonSchema(schema)
      : null
    if (!generated) throw new Error('Evidence Hub module does not export zodToJsonSchema')
    const { $schema, ...definition } = generated
    void $schema
    return [name, definition]
  }))
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.invalid/msk/evidence-hub/v1.schema.json',
    title: 'Evidence Hub v1 record',
    oneOf: [
      'evidence', 'claim', 'condition', 'anatomy', 'exercise',
      'clinicalTest', 'outcomeMeasure', 'guidedCase', 'reference', 'mediaAsset',
    ].map((name) => ({ $ref: `#/$defs/${name}` })),
    $defs: definitions,
  }
}

export function stableJson(value) {
  return JSON.stringify(sortValue(value), null, 2) + '\n'
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]))
}

function parseCatalog(file, schema, key, findings) {
  if (!fs.existsSync(file)) {
    findings.push(`missing catalog: ${relative(file)}`)
    return []
  }
  const result = schema.safeParse(readJson(file))
  if (!result.success) {
    for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    return []
  }
  return result.data[key]
}

export function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory()
      ? collectSourceFiles(item)
      : entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [item] : []
  })
}

function collectImportSpecifiers(source) {
  const specifiers = []
  const patterns = [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1])
  }
  return [...new Set(specifiers)]
}

function isEvidenceHubSpecifier(specifier) {
  return /(?:^|\/)evidence-hub(?:\/|$)/.test(specifier)
}

function resolveLocalImport(specifier, importer, srcRoot) {
  let candidate
  if (specifier.startsWith('@/')) candidate = path.join(srcRoot, specifier.slice(2))
  else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(importer), specifier)
  else return null

  const candidates = [
    candidate,
    ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].map((extension) => candidate + extension),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mts', 'index.mjs'].map((name) => path.join(candidate, name)),
  ]
  return candidates.find((item) => fs.existsSync(item) && fs.statSync(item).isFile()) ?? null
}

function isWithin(parent, child) {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child))
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function displayImportNode(value, srcRoot) {
  if (!path.isAbsolute(value)) return value
  return path.relative(srcRoot, value).split(path.sep).join('/')
}
