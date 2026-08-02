import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'anatomy3dSchema.ts'), path.join(ROOT, 'src'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'anatomy-3d', 'registry.json')
const reportFile = path.join(ROOT, 'reports', 'clinical-platform', 'anatomy-3d-readiness.json')
const regions = ['cervical', 'shoulder', 'elbow', 'wrist-hand', 'lumbar', 'hip', 'knee', 'ankle-foot']
const interactions = ['rotate', 'zoom', 'pan', 'reset', 'isolate', 'hide-show', 'transparency', 'select', 'labels', 'origin-insertion', 'muscle-actions', 'related-content', 'keyboard-controls']
const blockers = [
  'No governed source asset is present.',
  'Source, creator, licence, permitted use and attribution are unknown.',
  'Anatomy, clinical, accessibility, performance and publication review are pending.',
]

const assets = regions.map((region) => schemas.anatomy3dAssetSchema.parse({
  schemaVersion: 1,
  id: `asset3d.${region}.review-slot`,
  revision: 1,
  region,
  title: `${region.replace(/-/g, ' ')} governed 3D review slot`,
  assetPath: null,
  assetHash: null,
  source: 'unknown',
  creator: 'unknown',
  licence: 'unknown',
  permittedUse: 'none',
  attribution: 'required before use',
  structures: [],
  interactions,
  relatedMovementIds: [],
  relatedConditionIds: [],
  relatedCaseIds: [],
  nonVisualEquivalent: { structureBrowser: true, textRelationships: true, keyboardOperation: true, transcriptRequired: true, webglFallbackRequired: true },
  budgets: { maxMobileTriangles: 100000, maxTextureBytes: 4194304, maxDecodedBytes: 67108864, lazyLoadRequired: true, unrelatedRouteBundleBytes: 0, budgetReviewState: 'required' },
  reviews: { provenance: 'required', licence: 'required', anatomy: 'required', clinical: 'required', accessibility: 'required', performance: 'required', publication: 'required' },
  publicEligibility: false,
  blockers,
}))
const registry = schemas.anatomy3dRegistrySchema.parse({ schemaVersion: 1, authority: 'governed-anatomy-3d-registry', privateAuthoringOnly: true, assets })
const report = {
  schemaVersion: 1,
  regionalSceneSlots: assets.length,
  governedAssetsPresent: assets.filter((asset) => asset.assetPath).length,
  publicAssets: assets.filter((asset) => asset.publicEligibility).length,
  publicRoutes: 0,
  structureTypesSupported: schemas.anatomyStructureTypeSchema.options,
  interactionsSupported: interactions,
  nonVisualEquivalentsRequired: assets.length,
  licenceBlockers: assets.length,
  lazyLoadRequired: true,
  unrelatedRouteBundleBytes: 0,
}
write(output, registry)
write(reportFile, report)
console.log(`Governed 3D registry generated: ${assets.length} regional slots; assets present: 0; public: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
