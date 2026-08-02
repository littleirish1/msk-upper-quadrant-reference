import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const engine = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'compatibility.ts'), path.join(ROOT, 'src'))
const catalogue = engine.compatibilityCatalogueSchema.parse(JSON.parse(fs.readFileSync(
  path.join(ROOT, 'ai-manager', 'clinical-platform', 'rules', 'compatibility-rules.json'), 'utf8')))
assert.equal(catalogue.rules.length, engine.compatibilityRuleKindSchema.options.length)
assert.ok(catalogue.rules.every((rule) => !rule.enabled && rule.lifecycle === 'draft'))

const moduleA = { id: 'module.synthetic.a', revision: 1, lifecycle: 'approved', publicationState: 'private' }
const approved = (overrides) => engine.compatibilityRuleSchema.parse({
  schemaVersion: 1,
  id: 'rule.synthetic.requires-b',
  revision: 1,
  kind: 'requires',
  lifecycle: 'approved',
  enabled: true,
  severity: 'error',
  when: { allModuleIds: ['module.synthetic.a'], anyModuleIds: [], contextEquals: {} },
  effect: { requiresModuleIds: ['module.synthetic.b'], prohibitsModuleIds: [], impliesModuleIds: [], escalationRequirement: null, reviewRequirement: null, message: 'Synthetic fixture requirement.' },
  evidenceRecordIds: ['evidence.synthetic.fixture'],
  evidenceGapIds: [],
  approval: { ruleHash: '1'.repeat(64), approvedRevision: 1, clinicalReview: 'approved', evidenceReview: 'approved' },
  ...overrides,
})

const missing = engine.evaluateCompatibility([moduleA], [approved({})])
assert.equal(missing.valid, false)
assert.deepEqual(missing.missingRequirements, ['module.synthetic.b'])

const valid = engine.evaluateCompatibility([moduleA, { ...moduleA, id: 'module.synthetic.b' }], [approved({})])
assert.equal(valid.valid, true)
assert.deepEqual(valid, engine.evaluateCompatibility([...validInput()], [approved({})]))

const implication = approved({
  id: 'rule.synthetic.implies-b',
  kind: 'implies',
  effect: { requiresModuleIds: [], prohibitsModuleIds: [], impliesModuleIds: ['module.synthetic.b'], escalationRequirement: null, reviewRequirement: null, message: 'Synthetic implication.' },
})
assert.deepEqual(engine.evaluateCompatibility([moduleA], [implication]).impliedModuleIds, ['module.synthetic.b'])

const prohibit = approved({
  id: 'rule.synthetic.prohibits-b',
  kind: 'prohibits',
  effect: { requiresModuleIds: [], prohibitsModuleIds: ['module.synthetic.b'], impliesModuleIds: [], escalationRequirement: null, reviewRequirement: null, message: 'Synthetic prohibition.' },
})
assert.equal(engine.evaluateCompatibility(validInput(), [prohibit]).valid, false)
assert.ok(engine.evaluateCompatibility([moduleA], [approved({}), prohibit]).errors.some((item) => item.includes('Conflicting approved rules')))

const stale = engine.evaluateCompatibility([{ ...moduleA, approvedRuleDigest: 'fnv1a32:00000000' }], [])
assert.ok(stale.reviewNeeds.some((item) => item.includes('stale')))

const batch = Array.from({ length: 1000 }, (_, index) => ({ ...moduleA, id: `module.synthetic.batch-${index}` }))
assert.deepEqual(engine.evaluateCompatibility(batch, []), engine.evaluateCompatibility([...batch].reverse(), []))

console.log('Compatibility engine tests passed: valid/invalid, transitive, conflict, stale, determinism, and 1,000-module batch.')

function validInput() {
  return [moduleA, { ...moduleA, id: 'module.synthetic.b' }]
}
