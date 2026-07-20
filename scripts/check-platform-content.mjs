import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadSchemas } from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const findings = []
const seenIds = new Map()
const { specialTestRecordSchema, outcomeMeasureRecordSchema } = await loadSchemas()

checkJsonDirectory('content/special-tests', specialTestRecordSchema)
checkJsonDirectory('content/outcome-measures', outcomeMeasureRecordSchema)

const reportCheck = spawnSync(process.execPath, ['scripts/generate-upper-quadrant-matrix.mjs', '--check'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: false,
})
if (reportCheck.stdout) process.stdout.write(reportCheck.stdout)
if (reportCheck.stderr) process.stderr.write(reportCheck.stderr)
if (reportCheck.status !== 0) findings.push('upper-quadrant completion matrix is stale or invalid')

if (findings.length) {
  console.error('Platform content check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log(`Platform content check passed. Stable IDs checked: ${seenIds.size}.`)

function checkJsonDirectory(relativeDir, schema) {
  const dir = path.join(ROOT, relativeDir)
  if (!fs.existsSync(dir)) return

  for (const file of collectJson(dir)) {
    let value
    try {
      value = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      findings.push(`${relative(file)} is not valid JSON: ${error.message}`)
      continue
    }

    const result = schema.safeParse(value)
    if (!result.success) {
      for (const issue of result.error.issues) {
        findings.push(`${relative(file)} ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      }
      continue
    }

    const previous = seenIds.get(result.data.contentId)
    if (previous) findings.push(`duplicate content ID ${result.data.contentId}: ${previous}, ${relative(file)}`)
    else seenIds.set(result.data.contentId, relative(file))

    if (relative(file).includes('/private/') && result.data.publicEligibility) {
      findings.push(`private record is public-eligible: ${relative(file)}`)
    }
  }
}

function collectJson(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectJson(item) : entry.isFile() && entry.name.endsWith('.json') ? [item] : []
  }).sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
