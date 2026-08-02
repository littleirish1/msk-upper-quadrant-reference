import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { generatePatient, stableJson } from './seeded-generator.mjs'

const ROOT = process.cwd()
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'generator', 'patient-recipes.json'), 'utf8'))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))
const recipe = catalogue.recipes[0]
const record = truth.records.find((item) => item.recordId === recipe.truthRecordId)

const first = generatePatient({ recipe, truthRecord: record, seed: 'deterministic-fixture-seed' })
const second = generatePatient({ recipe: structuredClone(recipe), truthRecord: structuredClone(record), seed: 'deterministic-fixture-seed' })
assert.equal(stableJson(first), stableJson(second), 'same seed and revisions must be byte-equivalent')
assert.equal(first.manifest.authoritativeOutputHash, second.manifest.authoritativeOutputHash)

const otherSeed = generatePatient({ recipe, truthRecord: record, seed: 'deterministic-fixture-seed-2' })
assert.notEqual(first.manifest.instanceId, otherSeed.manifest.instanceId)
assert.equal(first.manifest.authoritativeOutputHash, otherSeed.manifest.authoritativeOutputHash, 'cosmetic seed must not mutate truth')
assert.ok(!first.manifest.instanceId.includes(recipe.region))
assert.ok(!first.manifest.instanceId.includes(recipe.caseId))

assert.throws(() => generatePatient({ recipe: { ...recipe, allowedVariation: 'clinical' }, truthRecord: record, seed: 'blocked-clinical-seed' }), /require approved variant modules/)
assert.throws(() => generatePatient({ recipe, truthRecord: record, seed: 'blocked-public-seed', purpose: 'public' }), /Public generation requires exact/)
assert.throws(() => generatePatient({ recipe, truthRecord: { ...record, authoritativeHash: '0'.repeat(64) }, seed: 'mismatch-seed' }), /do not match/)

console.log('Seeded generator tests passed: byte determinism, opaque IDs, immutable truth, mismatch and approval gates.')
