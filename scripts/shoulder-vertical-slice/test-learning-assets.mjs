import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const movementSchema = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'movementSchema.ts'), path.join(ROOT, 'src'))
const anatomySchema = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'anatomy3dSchema.ts'), path.join(ROOT, 'src'))
const shoulderSchema = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'), path.join(ROOT, 'src'))

const movement = movementSchema.movementLibrarySchema.parse(read('ai-manager/clinical-platform/shoulder/movement-library.json'))
assert.equal(movement.records.filter((record) => record.kind === 'joint').length, 10)
assert.equal(movement.records.filter((record) => record.kind === 'functional').length, 10)
assert.ok(movement.records.every((record) => !record.publicEligibility && record.evidenceRecordIds.length === 0 && record.evidenceGapIds.length === 1))
assert.ok(movement.records.every((record) => record.accessibleTranscript))
assert.ok(movement.records.every((record) => !record.jointMovement || record.jointMovement.supportedRanges.length === 0))

const registry = anatomySchema.anatomy3dRegistrySchema.parse(read('ai-manager/clinical-platform/anatomy-3d/registry.json'))
const shoulderAsset = registry.assets.find((asset) => asset.region === 'shoulder')
assert.ok(shoulderAsset)
assert.equal(shoulderAsset.plannedStructures.length, 16)
assert.equal(shoulderAsset.structures.length, 0)
assert.equal(shoulderAsset.assetPath, null)
assert.equal(shoulderAsset.publicEligibility, false)
assert.equal(shoulderAsset.permittedUse, 'none')

const mcqs = shoulderSchema.shoulderMcqPlanSchema.parse(read('ai-manager/clinical-platform/shoulder/mcq-plan.json'))
assert.equal(mcqs.records.length, 10)
assert.ok(mcqs.records.every((record) => record.authoredContent === null && !record.publicEligibility && record.blockers.length > 0))

const publicText = collectFiles(path.join(ROOT, 'public')).map((file) => fs.readFileSync(file)).join('\n')
for (const record of movement.records) assert.ok(!publicText.includes(record.id))
for (const record of mcqs.records) assert.ok(!publicText.includes(record.id))
assert.ok(!publicText.includes('asset3d.shoulder.review-slot'))

console.log('Shoulder learning-asset tests passed: 20 movement slots, 16 planned 3D structures, 0 3D assets, 10 source-insufficient MCQ slots, 0 public records.')

function read(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')) }
function collectFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : []
  })
}
