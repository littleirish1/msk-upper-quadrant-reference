import fs from 'node:fs'
import path from 'node:path'
import { loadSchemas } from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content', 'anatomy')
const OUT_DIR = path.join(ROOT, 'out', 'anatomy')
const findings = []
const { anatomyRecordSchema } = await loadSchemas()
const records = []

for (const file of collectJson(CONTENT_DIR)) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  const result = anatomyRecordSchema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.')}: ${issue.message}`)
  } else {
    records.push({ file, data: result.data })
  }
}

const byId = new Map()
for (const record of records) {
  if (byId.has(record.data.contentId)) findings.push(`duplicate anatomy ID: ${record.data.contentId}`)
  byId.set(record.data.contentId, record)
}

for (const record of records) {
  for (const targetId of record.data.relatedContent?.anatomy ?? []) {
    const target = byId.get(targetId)
    if (!target) {
      findings.push(`${record.data.contentId} links to missing anatomy record ${targetId}`)
      continue
    }
    if (!(target.data.relatedContent?.anatomy ?? []).includes(record.data.contentId)) {
      findings.push(`${record.data.contentId} -> ${targetId} is not reciprocal`)
    }
  }

  const routeFile = path.join(OUT_DIR, record.data.category, record.data.slug, 'index.html')
  const shouldBePublic = record.data.status === 'published' && record.data.publicEligibility && record.data.reviewStatus === 'reviewed'
  if (fs.existsSync(path.join(ROOT, 'out')) && fs.existsSync(routeFile) !== shouldBePublic) {
    findings.push(`anatomy public boundary mismatch for ${record.data.contentId}`)
  }
}

if (records.length === 0) findings.push('no anatomy records found; check would be vacuous')

if (findings.length) {
  console.error('Anatomy content check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log(`Anatomy content check passed. Records: ${records.length}; public detail records: ${records.filter((item) => item.data.publicEligibility).length}.`)

function collectJson(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectJson(item) : entry.isFile() && entry.name.endsWith('.json') ? [item] : []
  }).sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
