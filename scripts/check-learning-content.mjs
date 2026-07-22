import fs from 'node:fs'
import path from 'node:path'
import { loadSchemas } from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content', 'learning')
const OUT_DIR = path.join(ROOT, 'out')
const COMPONENT_DIR = path.join(ROOT, 'src', 'components', 'learning')
const findings = []
const seenIds = new Set()
const schemas = await loadSchemas()
const schemaByType = new Map([
  ['reasoning-engine', schemas.reasoningEngineRecordSchema],
  ['quiz-question', schemas.quizQuestionRecordSchema],
  ['flashcard', schemas.flashcardRecordSchema],
  ['osce-station', schemas.osceStationRecordSchema],
  ['viva-prompt', schemas.vivaPromptRecordSchema],
  ['decision-tree', schemas.decisionTreeRecordSchema],
])
const stepOrder = schemas.reasoningStepTypeSchema.options
let recordCount = 0

for (const file of collectFiles(CONTENT_DIR, (item) => item.endsWith('.json'))) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  const schema = schemaByType.get(value.recordType)
  if (!schema) {
    findings.push(`unknown learning record type in ${relative(file)}`)
    continue
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) findings.push(`${relative(file)} ${issue.path.join('.')}: ${issue.message}`)
    continue
  }
  recordCount++
  if (seenIds.has(result.data.contentId)) findings.push(`duplicate learning ID: ${result.data.contentId}`)
  seenIds.add(result.data.contentId)
  if (result.data.publicEligibility) findings.push(`private learning example is public eligible: ${relative(file)}`)

  if (result.data.recordType === 'reasoning-engine') {
    let previous = -1
    for (const step of result.data.steps) {
      const index = stepOrder.indexOf(step.type)
      if (index <= previous) findings.push(`invalid reasoning step order in ${relative(file)} at ${step.type}`)
      previous = index
    }
  }

  if (result.data.recordType === 'decision-tree') {
    const nodeIds = new Set(result.data.nodes.map((node) => node.id))
    if (!nodeIds.has(result.data.startNodeId)) findings.push(`missing decision-tree start node in ${relative(file)}`)
    for (const node of result.data.nodes) {
      for (const option of node.options) if (!nodeIds.has(option.nextNodeId)) findings.push(`missing decision-tree target ${option.nextNodeId}`)
    }
  }
}

for (const file of collectFiles(COMPONENT_DIR, (item) => item.endsWith('.tsx'))) {
  const source = fs.readFileSync(file, 'utf8')
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage']) {
    if (source.includes(forbidden)) findings.push(`learning component uses forbidden runtime capability ${forbidden}: ${relative(file)}`)
  }
}

if (fs.existsSync(OUT_DIR) && !fs.existsSync(path.join(OUT_DIR, 'learning', 'index.html'))) {
  findings.push('missing public /learning route after build')
}
if (recordCount < 6) findings.push('expected representative examples for all six learning record types')

if (findings.length) {
  console.error('Learning content check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log(`Learning content check passed. Private schema examples: ${recordCount}; duplicate IDs: 0.`)

function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(item, predicate) : entry.isFile() && predicate(item) ? [item] : []
  }).sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
