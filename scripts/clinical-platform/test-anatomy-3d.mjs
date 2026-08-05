import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'anatomy3dSchema.ts'), path.join(ROOT, 'src'))
const registry = schemas.anatomy3dRegistrySchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'anatomy-3d', 'registry.json'), 'utf8')))
assert.equal(registry.assets.length, 8)
assert.equal(new Set(registry.assets.map((asset) => asset.region)).size, 8)
assert.ok(registry.assets.every((asset) => !asset.publicEligibility && !asset.assetPath && !asset.assetHash))
assert.ok(registry.assets.every((asset) => asset.structures.length === 0), 'missing assets cannot carry invented anatomy labels')
assert.equal(registry.assets.find((asset) => asset.region === 'shoulder').plannedStructures.length, 16)
assert.ok(registry.assets.every((asset) => asset.acquisitionTasks.length === 5))
assert.ok(registry.assets.every((asset) => asset.fallback.status === 'text-only-review-placeholder' && !asset.fallback.publicEligibility))
assert.ok(registry.assets.every((asset) => asset.interactions.length === 13))
assert.ok(registry.assets.every((asset) => asset.nonVisualEquivalent.webglFallbackRequired && asset.nonVisualEquivalent.transcriptRequired))
assert.ok(registry.assets.every((asset) => asset.budgets.lazyLoadRequired && asset.budgets.unrelatedRouteBundleBytes === 0))

const invalid = structuredClone(registry.assets[0])
invalid.publicEligibility = true
assert.equal(schemas.anatomy3dAssetSchema.safeParse(invalid).success, false)
const invented = structuredClone(registry.assets[0])
invented.structures.push({ id: 'structure.synthetic.fixture', type: 'bone', publicLabel: 'Synthetic fixture', accessibleDescription: 'Synthetic test only.', reviewState: 'required' })
assert.equal(schemas.anatomy3dAssetSchema.safeParse(invented).success, false)

console.log('Governed anatomy 3D tests passed: 8 private slots, 16 planned shoulder structures, 13 interactions, 0 assets, 0 public routes.')
