import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'moduleSchema.ts'),
  path.join(ROOT, 'src'),
)
const libraryPath = path.join(ROOT, 'ai-manager', 'clinical-platform', 'modules', 'module-library.json')
const library = schemas.clinicalModuleLibrarySchema.parse(JSON.parse(fs.readFileSync(libraryPath, 'utf8')))

assert.equal(library.modules.length, 6)
assert.equal(new Set(library.modules.map((item) => item.id)).size, library.modules.length, 'duplicate module IDs')
assert.ok(library.modules.every((item) => item.relationships.sources.length > 0), 'source relationship missing')
assert.ok(library.modules.every((item) => item.relationships.evidenceGapIds.length > 0), 'evidence gaps must be explicit')
assert.ok(library.modules.every((item) => Object.keys(schemas.projectClinicalModule(item, 'learner')).length === 0), 'draft module crossed public boundary')

for (const module of library.modules) {
  const source = module.relationships.sources[0]
  const bytes = fs.readFileSync(path.join(ROOT, source.repositoryPath))
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), source.hash, 'source hash drift')
}

const staleFixture = structuredClone(library.modules[0])
staleFixture.lifecycle = 'approved'
staleFixture.reviews.approvedRevision = staleFixture.revision
staleFixture.reviews.approvalHash = '0'.repeat(64)
assert.equal(schemas.isApprovalStale(staleFixture, '1'.repeat(64)), true)

const unknownFixture = { ...library.modules[0], unexpectedClinicalField: 'fail closed' }
assert.equal(schemas.clinicalModuleSchema.safeParse(unknownFixture).success, false)

const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'content-hygiene-names.json'), 'utf8'))
const serialised = JSON.stringify(library).toLowerCase()
assert.ok(policy.termsToFlag.every((term) => !serialised.includes(String(term).toLowerCase())), 'sensitive-name policy violation')

console.log('Clinical module library tests passed. Modules: 6; public projections: 0; sensitive names: 0.')
