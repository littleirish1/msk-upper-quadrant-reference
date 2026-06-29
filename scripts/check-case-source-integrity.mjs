import fs from 'fs'
import path from 'path'
import {
  CASES_DIR,
  collectCaseFiles,
  readCaseFrontmatter,
  relativePath as getRelativePath,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const LEGACY_SOURCE_TYPE = 'legacy-html-case-bank'
const DRAFT_MARKER = 'Draft generated from legacy station'

const findings = []
const legacyCasesBySourceId = new Map()

if (!fs.existsSync(CASES_DIR)) {
  console.error(`Missing cases directory: ${path.relative(ROOT, CASES_DIR)}`)
  process.exit(1)
}

const caseFiles = collectCaseFiles()

if (caseFiles.length === 0) {
  addFinding(toPosix(path.relative(ROOT, CASES_DIR)), 'no guided case files found')
}

for (const file of caseFiles) {
  const relativePath = getRelativePath(file)
  let parsed

  try {
    parsed = await readCaseFrontmatter(file)
  } catch (error) {
    addFinding(relativePath, error.message)
    continue
  }

  const sourceType = parsed.data.sourceType

  if (sourceType !== LEGACY_SOURCE_TYPE) {
    continue
  }

  const sourceId = parsed.data.sourceId
  const sourcePath = parsed.data.sourcePath
  const reviewStatus = parsed.data.reviewStatus
  const status = parsed.data.status

  requireField(relativePath, 'sourceId', sourceId)
  requireField(relativePath, 'sourcePath', sourcePath)
  requireField(relativePath, 'reviewStatus', reviewStatus)

  if (sourceId) {
    const existing = legacyCasesBySourceId.get(sourceId) ?? []
    existing.push(relativePath)
    legacyCasesBySourceId.set(sourceId, existing)
  }

  if (sourcePath) {
    const fullSourcePath = path.join(ROOT, sourcePath)

    if (!fs.existsSync(fullSourcePath)) {
      addFinding(relativePath, `sourcePath does not exist: ${sourcePath}`)
    }

    const sourceFilename = path.basename(sourcePath)
    const sourcePrefix = sourceFilename.match(/^(s\d+)-/i)?.[1]

    if (sourceId && sourcePrefix && sourcePrefix !== sourceId) {
      addFinding(
        relativePath,
        `sourceId "${sourceId}" does not match sourcePath filename prefix "${sourcePrefix}"`,
      )
    }
  }

  if (status === 'published') {
    if (reviewStatus !== 'reviewed') {
      addFinding(relativePath, 'published legacy-derived cases require reviewStatus: "reviewed"')
    }

    if (parsed.content.includes('TODO')) {
      addFinding(relativePath, 'published legacy-derived case body contains TODO')
    }

    if (parsed.content.includes(DRAFT_MARKER)) {
      addFinding(relativePath, `published legacy-derived case body contains "${DRAFT_MARKER}"`)
    }
  }
}

for (const [sourceId, files] of legacyCasesBySourceId.entries()) {
  if (files.length <= 1) {
    continue
  }

  addFinding(
    files.join(', '),
    `duplicate legacy sourceId "${sourceId}" is used by ${files.length} cases`,
  )
}

if (findings.length > 0) {
  console.error('\nCase source integrity check failed.\n')

  for (const finding of findings) {
    console.error(`${finding.file}`)
    console.error(`  ${finding.message}`)
  }

  console.error('\nFix source metadata or move unfinished legacy-derived cases out of published status.\n')
  process.exit(1)
}

console.log('Case source integrity check passed.')

function requireField(file, field, value) {
  if (!value) {
    addFinding(file, `missing required field: ${field}`)
  }
}

function addFinding(file, message) {
  findings.push({ file, message })
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
