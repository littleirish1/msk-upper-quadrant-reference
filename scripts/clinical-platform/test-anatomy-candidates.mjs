import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { candidatePublicEligibility, normalizeAnatomyCandidateLedger } from '../../ai-manager/private-review-portal/anatomy-candidate-pipeline.mjs'
import { loadStudioConfig } from '../../ai-manager/private-review-portal/content-studio.mjs'

const ROOT = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8'))
const ledger = readJson('ai-manager/clinical-platform/anatomy-3d/source-candidates.json')
const config = loadStudioConfig()
const configuredRegions = new Set(config.regions.map((region) => region.id))
const shoulderMovements = readJson('ai-manager/clinical-platform/shoulder/movement-library.json').records
const genericMovements = readJson('ai-manager/clinical-platform/movement/movement-library.json').records
const governedMovementIds = new Set([...shoulderMovements, ...genericMovements].map((record) => record.id))
const records = normalizeAnatomyCandidateLedger({ ledger, configuredRegions, governedMovementIds })

assert.equal(readJson('ai-manager/clinical-platform/anatomy-3d/registry.json').assets.find((asset) => asset.region === 'shoulder').plannedStructures.length, 16)
assert.equal(shoulderMovements.length, 20)
assert.equal(records.filter((record) => record.candidateType === 'upstream-source-archive').length, 1)
assert.equal(records.filter((record) => record.candidateType === 'derived-candidate-archive').length, 1)
assert.equal(records.filter((record) => record.candidateType === 'derived-glb').length, 5)
assert.equal(records.filter((record) => record.candidateType === 'movement-definition').length, 18)

const derived = records.filter((record) => record.candidateType === 'derived-glb')
assert.ok(derived.every((record) => record.derivedFrom.length > 0 && record.parentArchiveSha256 === ledger.movementSource.parentArchiveSha256))
assert.ok(derived.every((record) => record.format === 'glb-2.0' && record.sceneCount === 1 && record.animationCount === 0))
assert.deepEqual(derived.flatMap((record) => record.animationNames), [])
assert.ok(derived.every((record) => record.externalResourceUris.length === 0))
assert.ok(derived.every((record) => record.licenceInheritance === 'unverified' && record.licence === null))
assert.ok(derived.every((record) => record.blockers.includes('exact-file-licence-lineage-required')))
assert.ok(derived.filter((record) => record.derivedFrom.includes('candidate3d.z-anatomy.upstream-98d6780f')).every((record) => record.componentLicenceExceptions.length === 4 && record.blockers.includes('differently-licensed-component-exclusion-required')))

const movementCandidates = records.filter((record) => record.candidateType === 'movement-definition')
const mapped = movementCandidates.filter((record) => record.existingMovementSlotId)
assert.equal(mapped.length, 5)
assert.equal(new Set(mapped.map((record) => record.existingMovementSlotId)).size, 5)
assert.ok(mapped.every((record) => governedMovementIds.has(record.existingMovementSlotId)))
assert.ok(movementCandidates.every((record) => record.adoptedMovementData === null))
assert.ok(movementCandidates.every((record) => record.claimEvidenceRecordIds.length === 0))
assert.ok(movementCandidates.every((record) => record.blockers.includes('uncited-biomechanical-claims-not-adopted')))
assert.ok(movementCandidates.every((record) => record.blockers.includes('visual-movement-verification-required')))

assert.ok(records.every((record) => record.publicEligibility === false && record.grantsApproval === false && candidatePublicEligibility(record) === false))
assert.ok(records.every((record) => record.publicationState === 'private'))
assert.ok(records.every((record) => record.reviews.publication === 'required'))
assert.ok(derived.every((record) => record.reviews.anatomy === 'required' && record.reviews.clinical === 'required'))
assert.ok(derived.every((record) => record.attributionRequired && record.shareAlikeRequired && record.modificationDisclosureRequired))

const zAnatomy = records.find((record) => record.id === 'candidate3d.z-anatomy.upstream-98d6780f')
assert.equal(zAnatomy.licence, 'CC-BY-SA-4.0')
assert.equal(zAnatomy.licenceVersion, '4.0')
assert.equal(zAnatomy.attributionText.length, 2)
const derivativePackage = records.find((record) => record.id === 'candidate3d.biomechanics.dc190e05')
assert.equal(derivativePackage.licence, null)
assert.equal(derivativePackage.licenceFamilyEvidence, 'CC-BY-SA-4.0')

const unsafeLedger = structuredClone(ledger)
unsafeLedger.candidates[0].publicEligibility = true
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: unsafeLedger, configuredRegions, governedMovementIds }), /publicly ineligible/)
const inventedClaims = structuredClone(ledger)
inventedClaims.movementCandidates[0].adoptedMovementData = { rangeDeg: 140 }
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: inventedClaims, configuredRegions, governedMovementIds }), /must not adopt unreviewed movement data/)

const syntheticHash = 'a'.repeat(64)
const syntheticLedger = {
  schemaVersion: 1,
  authority: 'private-anatomy-3d-source-candidate-ledger',
  privateAuthoringOnly: true,
  grantsApproval: false,
  candidateReviewDefaults: ledger.candidateReviewDefaults,
  movementSource: {
    sourceProject: 'Synthetic fixture only', sourceUrl: null, upstreamRevision: null,
    originalFilename: 'synthetic-movements.fixture', sha256: syntheticHash,
    parentArchiveSha256: syntheticHash, derivedFrom: ['candidate3d.synthetic.hip'],
  },
  candidates: [{
    id: 'candidate3d.synthetic.hip', title: 'Synthetic hip anatomy fixture', candidateType: 'source-package',
    sourceProject: 'Synthetic fixture only', region: 'hip', contentTypes: ['3d-assets'], lifecycle: 'candidate', publicationState: 'private',
    archive: { filename: 'synthetic.fixture', bytes: 1, sha256: syntheticHash },
    licenceEvidence: { sourceContentLicence: 'TEST-ONLY', status: 'unverified', requiredAttribution: [], approvalGranted: false },
    artifacts: [{ id: 'candidate-asset.synthetic.hip', title: 'Synthetic hip asset fixture', region: 'hip', filename: 'synthetic.fixture.glb', bytes: 1, sha256: syntheticHash, kind: 'gltf-binary', gltf: { version: 2, scenes: 1, nodes: 1, meshes: 1, primitives: 1, skins: 0, animations: 0, materials: 0, animationNames: [], animationDurationsSeconds: [], externalResourceUris: [] }, governedAssetSlotIds: ['asset3d.hip.review-slot'], licenceInheritance: 'unverified' }],
    reviews: ledger.candidateReviewDefaults, missingFields: ['synthetic provenance'], blockers: ['synthetic blocker'], repositoryAssetPath: null, publicEligibility: false, grantsApproval: false,
  }],
  movementCandidates: [{ id: 'candidate-movement.synthetic.hip-flexion', title: 'Synthetic hip movement fixture', region: 'hip', existingMovementSlotId: 'movement.joint.flexion-extension' }],
}
const synthetic = normalizeAnatomyCandidateLedger({ ledger: syntheticLedger, configuredRegions, governedMovementIds })
assert.equal(synthetic.filter((record) => record.region === 'hip' && record.candidateType === 'derived-glb').length, 1)
assert.equal(synthetic.filter((record) => record.region === 'hip' && record.candidateType === 'movement-definition').length, 1)
assert.ok(synthetic.every((record) => record.blockers.length > 0 && !record.publicEligibility && !record.grantsApproval))

console.log('Private anatomy candidate tests passed: 16 existing shoulder plans, 20 existing shoulder movement slots, 2 packages, 5 derived GLBs, 18 unadopted movement candidates, and generic synthetic hip anatomy/movement loading remain fail-closed.')
