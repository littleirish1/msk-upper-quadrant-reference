import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'),
  path.join(ROOT, 'src'),
)

const inventory = schemas.shoulderSourceInventorySchema.parse(read('ai-manager/clinical-platform/shoulder/source-inventory.json'))
const evidence = schemas.shoulderEvidenceMapSchema.parse(read('ai-manager/clinical-platform/shoulder/evidence-map.json'))
const workspace = schemas.shoulderAuthoringWorkspaceSchema.parse(read('ai-manager/clinical-platform/shoulder/authoring-workspace.json'))
const mcqs = schemas.shoulderMcqPlanSchema.parse(read('ai-manager/clinical-platform/shoulder/mcq-plan.json'))
const modules = read('ai-manager/clinical-platform/shoulder/module-library.json').modules
const relationships = read('content/evidence-hub/relationships/index.json').relationships

assert.equal(inventory.records.length, 10)
assert.equal(inventory.summary.evidenceProcessingEligible, 0)
assert.equal(inventory.summary.publicEvidenceEligible, 0)
assert.ok(inventory.records.every((source) => source.locatorStatus === 'exact-repository-locator' || source.locators.length === 0))
assert.ok(inventory.records.every((source) => !source.evidenceProcessingEligible && !source.publicEvidenceEligible))
assert.equal(evidence.claims.length, 0)
assert.equal(evidence.evidenceSummaries.length, 0)
assert.equal(evidence.publicEligibility, false)
assert.equal(evidence.gaps.length, 9)
assert.equal(modules.length, 36)
assert.ok(modules.every((module) => module.publicationState === 'private' && module.relationships.evidenceGapIds.length > 0))
assert.equal(mcqs.records.length, 10)
assert.equal(mcqs.authoredQuestionCount, 0)
assert.equal(mcqs.publicQuestionCount, 0)
assert.equal(workspace.privateAuthoringOnly, true)
assert.equal(workspace.publicRoute, null)
assert.equal(workspace.autonomousApprovalAllowed, false)
assert.ok(workspace.reviewTasks.length > 0)
assert.ok(workspace.reviewTasks.every((task) => !task.publicEligibility))
assert.equal(relationships.length, 2)
assert.ok(relationships.every((relationship) => relationship.lifecycleStatus === 'draft' && relationship.reviewStatus === 'structural-review'))

const trackedText = collectFiles([
  'ai-manager/clinical-platform/shoulder',
  'reports/clinical-platform/shoulder',
  'content/evidence-hub/conditions',
  'content/evidence-hub/guided-cases',
  'src/components/shoulder',
]).map((file) => fs.readFileSync(file, 'utf8')).join('\n')
assert.ok(!/[A-Za-z]:[\\/](?:Users|Documents|Downloads)[\\/]/.test(trackedText))
assert.ok(!/ai-manager[\\/]private-cache|\.venv-source-intake/.test(trackedText))
assert.ok(!/"(?:clinicalApprovalCreated|evidenceApprovalCreated|sourceClearanceCreated|publicationApprovalCreated)"\s*:\s*true/.test(trackedText))

console.log(`Shoulder governance tests passed: ${inventory.records.length} sources, 0 cleared, 0 claims, ${modules.length} private module slots, ${workspace.reviewTasks.length} human review tasks.`)

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
}

function collectFiles(relativeDirectories) {
  return relativeDirectories.flatMap((directory) => walk(path.join(ROOT, directory)))
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() && /\.(?:json|md|mjs|ts|tsx)$/.test(entry.name) ? [item] : []
  })
}
