import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'truthRecordSchema.ts'), path.join(ROOT, 'src'))
const library = schemas.patientTruthLibrarySchema.parse(JSON.parse(fs.readFileSync(
  path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'),
  'utf8',
)))

assert.equal(library.records.length, 9)
assert.equal(library.records.filter((record) => record.publicModeEligibility).length, 6)
assert.equal(library.records.filter((record) => !record.publicModeEligibility).length, 3)
assert.equal(new Set(library.records.map((record) => record.recordId)).size, 9)
assert.ok(library.records.every((record) => record.items.length === schemas.truthDomainSchema.options.length))
assert.ok(library.records.every((record) => record.items.every((item) => item.value !== null || item.state !== 'negative')))
assert.ok(library.records.every((record) => record.items.find((item) => item.domain === 'likely-diagnosis')?.state === 'intentionally-withheld'))

const frozen = schemas.immutableSessionTruth(library.records[0])
assert.ok(Object.isFrozen(frozen) && Object.isFrozen(frozen.items) && Object.isFrozen(frozen.items[0]))
assert.throws(() => { frozen.items[0].value = 'mutation attempt' }, TypeError)

const hashes = library.records.map((record) => record.authoritativeHash)
assert.equal(new Set(hashes).size, hashes.length, 'authoritative truth hashes must be case-specific')

const invalid = structuredClone(library.records[0])
invalid.items.find((item) => item.domain === 'profile').state = 'negative'
invalid.items.find((item) => item.domain === 'profile').value = null
assert.equal(schemas.patientTruthRecordSchema.safeParse(invalid).success, false)

console.log(`Patient Truth Record tests passed. Records: ${library.records.length}; items: ${library.records.reduce((sum, record) => sum + record.items.length, 0)}; implicit negatives: 0.`)
