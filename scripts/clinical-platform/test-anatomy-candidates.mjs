import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { candidatePublicEligibility, normalizeAnatomyCandidateLedger } from '../../ai-manager/private-review-portal/anatomy-candidate-pipeline.mjs'
import { loadStudioConfig } from '../../ai-manager/private-review-portal/content-studio.mjs'
import { inspectGlbBuffer } from '../private-review-portal/inspect-glb.mjs'

const ROOT = process.cwd()
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, ...relativePath.split('/')), 'utf8'))
const ledger = readJson('ai-manager/clinical-platform/anatomy-3d/source-candidates.json')
const comparison = readJson('ai-manager/clinical-platform/anatomy-3d/upstream-comparison.json')
const attribution = readJson('ai-manager/clinical-platform/anatomy-3d/attribution-template.json')
const config = loadStudioConfig()
const configuredRegions = new Set(config.regions.map((region) => region.id))
const shoulderMovements = readJson('ai-manager/clinical-platform/shoulder/movement-library.json').records
const genericMovements = readJson('ai-manager/clinical-platform/movement/movement-library.json').records
const governedMovementIds = new Set([...shoulderMovements, ...genericMovements].map((record) => record.id))
const records = normalizeAnatomyCandidateLedger({ ledger, configuredRegions, governedMovementIds })

assert.equal(readJson('ai-manager/clinical-platform/anatomy-3d/registry.json').assets.find((asset) => asset.region === 'shoulder').plannedStructures.length, 16)
assert.equal(shoulderMovements.length, 20)
assert.equal(records.filter((record) => record.candidateType === 'upstream-source-archive').length, 2)
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
assert.ok(derived.every((record) => record.provenanceOutcome === 'UNRESOLVED' && !record.exactBinaryMatchToUpstream && record.transformationEvidence === null))
assert.ok(derived.every((record) => Number.isInteger(record.bytes) && record.bytes > 0 && record.sourceUrl === 'https://github.com/Z-Anatomy/Models-of-human-anatomy' && record.upstreamRevision === '98d6780fed69fa56ee43ff5c4f2f0abe2a12c2a4'))
assert.ok(derived.every((record) => record.blockers.includes('exact-derivative-provenance-required') && record.blockers.includes('transformation-script-or-command-required')))
assert.ok(derived.every((record) => record.componentLicenceExceptions.length === 4 && record.blockers.includes('differently-licensed-component-exclusion-required')))
assert.ok(derived.every((record) => record.namedNodeCount === record.nodeCount && Number.isInteger(record.rootNodeCount)))

const movementCandidates = records.filter((record) => record.candidateType === 'movement-definition')
const mapped = movementCandidates.filter((record) => record.existingMovementSlotId)
assert.equal(mapped.length, 5)
assert.equal(new Set(mapped.map((record) => record.existingMovementSlotId)).size, 5)
assert.ok(mapped.every((record) => governedMovementIds.has(record.existingMovementSlotId)))
assert.ok(movementCandidates.every((record) => record.adoptedMovementData === null))
assert.ok(movementCandidates.every((record) => record.claimEvidenceRecordIds.length === 0))
assert.ok(movementCandidates.every((record) => record.wipIsClinicalEvidence === false && record.adoptedClinicalClaims === false))
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
const upstreamBiomechanics = records.find((record) => record.id === 'candidate3d.z-biomechanics.upstream-98d6780f')
assert.equal(upstreamBiomechanics.sha256, '0a74b2fa3c47db925b06241fa38c89b0811e58a78ee28ec440cd460e279cf22b')
assert.equal(upstreamBiomechanics.upstream.archiveGitBlobSha1, '0a59584deaf21773ffa3acb063f2cd06f3485a98')
assert.equal(upstreamBiomechanics.upstream.wipIsClinicalEvidence, false)

assert.equal(comparison.upstream.revision, '98d6780fed69fa56ee43ff5c4f2f0abe2a12c2a4')
assert.equal(comparison.upstream.bytes, 21644942)
assert.equal(comparison.upstream.gitBlobSha1, '0a59584deaf21773ffa3acb063f2cd06f3485a98')
assert.equal(comparison.upstream.gitBlobIdentityVerified, true)
assert.equal(comparison.result.exactPathAndBinaryMatches.length, 0)
assert.equal(comparison.result.renamedBinaryIdenticalMatches.length, 0)
assert.equal(comparison.result.startupBlendRecovered, true)
assert.equal(comparison.result.startupGlbRecovered, false)
assert.equal(comparison.result.startupbioGlbRecovered, false)
assert.equal(comparison.result.derivativeRelationship, 'UNRESOLVED')
assert.equal(comparison.movementContext.clinicalEvidence, false)
assert.equal(comparison.movementContext.literalNamesPresentInUpstreamBlend, 22)
assert.deepEqual(comparison.movementContext.literalNamesAbsentFromUpstreamBlend, ['ELBOW.l', 'ELBOW.r', 'PRONATION.l', 'PRONATION.r'])

assert.equal(attribution.licenceFamilyStatus, 'LICENCE FAMILY VERIFIED')
assert.equal(attribution.exactAssetLicenceLineageStatus, 'UNRESOLVED')
assert.equal(attribution.obligations.shareAlikeRequired, true)
assert.equal(attribution.obligations.modificationDescription, null)
assert.equal(attribution.attributionEntities.length, 2)
assert.equal(attribution.componentExceptions.length, 4)
assert.equal(attribution.candidateAssets.length, 5)
assert.ok(attribution.candidateAssets.every((record) => record.attributionTemplateId === attribution.id && record.exactAssetLicenceLineage === 'unverified' && record.componentExceptionExclusion === 'unverified' && !record.publicEligibility))

const unsafeLedger = structuredClone(ledger)
unsafeLedger.candidates[0].publicEligibility = true
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: unsafeLedger, configuredRegions, governedMovementIds }), /publicly ineligible/)
const inventedClaims = structuredClone(ledger)
inventedClaims.movementCandidates[0].adoptedMovementData = { rangeDeg: 140 }
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: inventedClaims, configuredRegions, governedMovementIds }), /must not adopt unreviewed movement data/)
const wipAsEvidence = structuredClone(ledger)
wipAsEvidence.movementSource.wipIsClinicalEvidence = true
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: wipAsEvidence, configuredRegions, governedMovementIds }), /must not treat WIP source metadata as clinical evidence/)
const falseProvenance = structuredClone(ledger)
falseProvenance.candidates.find((candidate) => candidate.id === 'candidate3d.biomechanics.dc190e05').artifacts.find((artifact) => artifact.kind === 'gltf-binary').provenanceOutcome = 'PROVEN'
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: falseProvenance, configuredRegions, governedMovementIds }), /cannot claim PROVEN provenance/)
const filenameOnly = structuredClone(ledger)
filenameOnly.candidates.find((candidate) => candidate.id === 'candidate3d.biomechanics.dc190e05').artifacts.find((artifact) => artifact.kind === 'gltf-binary').filenameSimilarityEstablishesProvenance = true
assert.throws(() => normalizeAnatomyCandidateLedger({ ledger: filenameOnly, configuredRegions, governedMovementIds }), /cannot use filename similarity as provenance/)

const glbDocument = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'synthetic-test' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Synthetic node', mesh: 0 }], meshes: [{ primitives: [] }] }))
const paddedJson = Buffer.concat([glbDocument, Buffer.alloc((4 - (glbDocument.length % 4)) % 4, 0x20)])
const syntheticGlb = Buffer.alloc(20 + paddedJson.length)
syntheticGlb.write('glTF', 0, 'ascii')
syntheticGlb.writeUInt32LE(2, 4)
syntheticGlb.writeUInt32LE(syntheticGlb.length, 8)
syntheticGlb.writeUInt32LE(paddedJson.length, 12)
syntheticGlb.writeUInt32LE(0x4e4f534a, 16)
paddedJson.copy(syntheticGlb, 20)
const inspected = inspectGlbBuffer(syntheticGlb, 'synthetic-private.glb')
assert.equal(inspected.validGlb20, true)
assert.equal(inspected.nodes, 1)
assert.equal(inspected.namedNodes, 1)
assert.equal(inspected.rootNodes, 1)
assert.equal(inspected.animations, 0)

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
    wipIsClinicalEvidence: false, adoptedClinicalClaims: false,
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

console.log('Private anatomy candidate tests passed: 16 existing shoulder plans, 20 existing shoulder movement slots, 3 packages, 5 unresolved derived GLBs, 18 unadopted movement candidates, pinned provenance/licensing evidence, safe GLB inspection, and generic synthetic hip anatomy/movement loading remain fail-closed.')
