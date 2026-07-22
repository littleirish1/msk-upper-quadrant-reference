import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import matter from 'gray-matter'
import ts from 'typescript'

export const ROOT_DIR = process.cwd()
export const CONTENT_DIR = path.join(ROOT_DIR, 'content')
export const CASES_DIR = path.join(CONTENT_DIR, 'cases')
export const SCHEMA_PATH = path.join(ROOT_DIR, 'src', 'lib', 'contentSchemas.ts')
export const TAXONOMY_PATH = path.join(ROOT_DIR, 'src', 'data', 'taxonomy.ts')

const CONDITION_EXCLUDED_DIRS = new Set(['_TEMPLATE', 'cases', 'imports'])
const require = createRequire(import.meta.url)
let schemaModulePromise
let taxonomyModulePromise

export function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

export function relativePath(filePath) {
  return toPosix(path.relative(ROOT_DIR, filePath))
}

export async function loadSchemas() {
  if (!schemaModulePromise) {
    schemaModulePromise = loadTsModule(SCHEMA_PATH)
  }

  return schemaModulePromise
}

export async function loadTaxonomy() {
  if (!taxonomyModulePromise) {
    taxonomyModulePromise = loadTsModule(TAXONOMY_PATH)
  }

  return taxonomyModulePromise
}

export async function getTaxonomyRegions() {
  const { REGIONS } = await loadTaxonomy()

  if (!Array.isArray(REGIONS) || REGIONS.length === 0) {
    throw new Error('No regions exported from src/data/taxonomy.ts')
  }

  return REGIONS
}

export async function getPlannedTaxonomyRegions() {
  const { PLANNED_REGIONS } = await loadTaxonomy()
  if (!Array.isArray(PLANNED_REGIONS)) {
    throw new Error('PLANNED_REGIONS must be exported from src/data/taxonomy.ts')
  }
  return PLANNED_REGIONS
}

export async function getTaxonomyConditions() {
  const regions = await getTaxonomyRegions()
  return regions
    .flatMap((region) => (region.conditions ?? []).map((condition) => ({
      slug: condition.slug,
      label: condition.label,
      region: condition.region ?? region.slug,
    })))
    .sort((a, b) => a.region.localeCompare(b.region) || a.slug.localeCompare(b.slug))
}

export function collectConditionFiles() {
  if (!fs.existsSync(CONTENT_DIR)) return []

  const files = []
  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || CONDITION_EXCLUDED_DIRS.has(entry.name)) {
      continue
    }

    const regionDir = path.join(CONTENT_DIR, entry.name)
    for (const file of fs.readdirSync(regionDir, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.mdx')) {
        files.push(path.join(regionDir, file.name))
      }
    }
  }

  return files.sort((a, b) => relativePath(a).localeCompare(relativePath(b)))
}

export function collectCaseFiles(dir = CASES_DIR) {
  if (!fs.existsSync(dir)) return []

  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectCaseFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      files.push(entryPath)
    }
  }

  return files.sort((a, b) => relativePath(a).localeCompare(relativePath(b)))
}

export function readMdxFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { content, data } = matter(raw)

  return {
    content,
    data,
    raw,
  }
}

export async function readCaseFrontmatter(filePath) {
  const { caseFrontmatterSchema } = await loadSchemas()
  return readFrontmatterWithSchema(filePath, caseFrontmatterSchema, 'Guided case')
}

export async function readConditionFrontmatter(filePath) {
  const { conditionFrontmatterSchema } = await loadSchemas()
  return readFrontmatterWithSchema(filePath, conditionFrontmatterSchema, 'Condition')
}

export function formatSchemaIssues(error) {
  return error.issues.map((issue) => {
    const fieldPath = issue.path.length ? issue.path.join('.') : '(root)'
    return `  - ${fieldPath}: ${issue.message}`
  })
}

export function isPrivateStatus(status) {
  return ['draft', 'archived'].includes(String(status).toLowerCase())
}

async function readFrontmatterWithSchema(filePath, schema, label) {
  const { content, data, raw } = readMdxFile(filePath)
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new Error([
      `${label} frontmatter failed schema validation: ${relativePath(filePath)}`,
      ...formatSchemaIssues(result.error),
    ].join('\n'))
  }

  return {
    content,
    data: result.data,
    raw,
  }
}

async function loadTsModule(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing TypeScript module: ${relativePath(filePath)}`)
  }

  const zodUrl = pathToFileURL(require.resolve('zod')).href
  const source = fs
    .readFileSync(filePath, 'utf8')
    .replace(/from\s+['"]zod['"]/, `from '${zodUrl}'`)

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filePath,
  })

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  return import(moduleUrl)
}
