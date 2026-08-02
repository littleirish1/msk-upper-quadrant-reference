import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'movementSchema.ts'), path.join(ROOT, 'src'))
const library = schemas.movementLibrarySchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'movement', 'movement-library.json'), 'utf8')))
const links = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'movement', 'case-movement-links.json'), 'utf8'))
assert.equal(library.records.length, 26)
assert.equal(library.records.filter((record) => record.kind === 'joint').length, 10)
assert.equal(library.records.filter((record) => record.kind === 'functional').length, 16)
assert.equal(new Set(library.records.map((record) => record.id)).size, library.records.length)
assert.ok(library.records.every((record) => !record.publicEligibility && record.evidenceRecordIds.length === 0 && record.evidenceGapIds.length > 0))
assert.ok(library.records.every((record) => record.phases.length === 0 && record.compensations.length === 0 && record.tutorExplanation === null))
assert.equal(links.records.length, 9)
assert.ok(links.records.every((record) => !record.publicEligibility && record.movementIds.length === 0 && record.anatomy3dAssetIds.length === 0))

const inventedClaim = structuredClone(library.records[0])
inventedClaim.jointMovement.plane = 'synthetic fixture plane'
assert.equal(schemas.movementRecordSchema.safeParse(inventedClaim).success, false)
const invalidPublic = structuredClone(library.records[0])
invalidPublic.publicEligibility = true
assert.equal(schemas.movementRecordSchema.safeParse(invalidPublic).success, false)

console.log('Movement tests passed: 10 joint + 16 functional review slots, 9 case-link gaps, 0 claims, 0 public records.')
