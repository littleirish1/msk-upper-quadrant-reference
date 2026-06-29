import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import matter from 'gray-matter'
import ts from 'typescript'

const ROOT_DIR = process.cwd()
const CONTENT_DIR = path.join(ROOT_DIR, 'content')
const CASES_DIR = path.join(CONTENT_DIR, 'cases')
const SCHEMA_PATH = path.join(ROOT_DIR, 'src', 'lib', 'contentSchemas.ts')

const CONDITION_EXCLUDED_DIRS = new Set(['_TEMPLATE', 'cases', 'imports'])

const require = createRequire(import.meta.url)

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function relativePath(filePath) {
  return toPosix(path.relative(ROOT_DIR, filePath))
}

async function loadSchemas() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Shared frontmatter schema module not found: ${relativePath(SCHEMA_PATH)}`)
  }

  const zodUrl = pathToFileURL(require.resolve('zod')).href
  const source = fs
    .readFileSync(SCHEMA_PATH, 'utf8')
    .replace(/from\s+['"]zod['"]/, `from '${zodUrl}'`)

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: SCHEMA_PATH,
  })

  const schemaModuleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  return import(schemaModuleUrl)
}

function collectConditionFiles() {
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

function collectCaseFiles(dir = CASES_DIR) {
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

function formatIssue(issue) {
  const fieldPath = issue.path.length ? issue.path.join('.') : '(root)'
  return `  - ${fieldPath}: ${issue.message}`
}

function validateFile(filePath, schema, label) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(raw)
  const result = schema.safeParse(data)

  if (result.success) {
    return []
  }

  return [
    `${label} frontmatter failed schema validation: ${relativePath(filePath)}`,
    ...result.error.issues.map(formatIssue),
  ]
}

const {
  conditionFrontmatterSchema,
  caseFrontmatterSchema,
} = await loadSchemas()

const conditionFiles = collectConditionFiles()
const caseFiles = collectCaseFiles()
const errors = [
  ...conditionFiles.flatMap((filePath) =>
    validateFile(filePath, conditionFrontmatterSchema, 'Condition'),
  ),
  ...caseFiles.flatMap((filePath) =>
    validateFile(filePath, caseFrontmatterSchema, 'Guided case'),
  ),
]

if (errors.length > 0) {
  console.error('Frontmatter schema check failed.')
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Frontmatter schema check passed.')
console.log(`Condition files validated: ${conditionFiles.length}`)
console.log(`Guided case files validated: ${caseFiles.length}`)
