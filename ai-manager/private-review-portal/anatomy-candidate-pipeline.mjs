import crypto from 'node:crypto'

const SHA256 = /^[a-f0-9]{64}$/
const REVIEW_DOMAINS = ['provenance', 'licensing', 'anatomy', 'clinical', 'movementVisual', 'accessibility', 'performance', 'publication']
const PROVENANCE_OUTCOMES = new Set(['PROVEN', 'PARTIALLY PROVEN', 'UNRESOLVED'])

function hashValue(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Private anatomy candidate ledger: ${message}`)
}

function reviewStates(value = {}) {
  return Object.fromEntries(REVIEW_DOMAINS.map((domain) => [domain, value[domain] ?? 'required']))
}

function commonRecord(record, ledger, configuredRegions) {
  requireCondition(record && typeof record === 'object', 'candidate records must be objects')
  requireCondition(typeof record.id === 'string' && record.id.length > 0, 'every record requires a stable id')
  requireCondition(configuredRegions.has(record.region), `${record.id} uses unconfigured region ${record.region}`)
  requireCondition(record.publicEligibility === false, `${record.id} must remain publicly ineligible`)
  requireCondition(record.grantsApproval === false && ledger.grantsApproval === false, `${record.id} must not grant approval`)
  const reviews = reviewStates(record.reviews)
  const blockers = [
    ...(record.blockers ?? []),
    ...Object.entries(reviews).filter(([, state]) => state !== 'not-applicable' && state !== 'approved').map(([domain]) => `${domain}-review-required`),
    !record.sha256 ? 'exact-file-sha256-required' : null,
    record.attributionRequired && !(record.attributionText ?? []).length ? 'attribution-package-required' : null,
  ]
  return {
    ...record,
    lifecycle: record.lifecycle ?? 'candidate',
    publicationState: record.publicationState ?? 'private',
    publicEligibility: false,
    grantsApproval: false,
    reviews,
    blockers: [...new Set(blockers.filter(Boolean))],
    sourceLinks: [...new Set((record.sourceLinks ?? []).filter(Boolean))],
    reviewTasks: Array.isArray(record.reviewTasks) ? record.reviewTasks : [],
    revisionHash: hashValue(record),
  }
}

function sourcePackageRecords(ledger, configuredRegions) {
  return ledger.candidates.map((candidate) => {
    const exactLicenceVerified = candidate.licenceEvidence?.status === 'verified-upstream-evidence'
    return commonRecord({
    ...candidate,
    candidateType: candidate.candidateType ?? 'source-package',
    contentType: '3d-assets',
    sourceProject: candidate.sourceProject ?? candidate.title,
    sourceUrl: candidate.sourceUrl ?? candidate.upstream?.repository ?? null,
    upstreamRevision: candidate.upstreamRevision ?? candidate.upstream?.commit ?? null,
    originalFilename: candidate.archive?.filename ?? null,
    sha256: candidate.archive?.sha256 ?? null,
    parentArchiveSha256: null,
    derivedFrom: [],
    format: 'archive',
    licence: exactLicenceVerified ? candidate.licenceEvidence?.sourceContentLicence ?? null : null,
    licenceFamilyEvidence: candidate.licenceEvidence?.sourceContentLicence ?? null,
    licenceVersion: candidate.licenceEvidence?.licenceVersion ?? null,
    attributionRequired: Boolean(candidate.licenceEvidence?.requiredAttribution?.length),
    attributionText: candidate.licenceEvidence?.requiredAttribution ?? [],
    shareAlikeRequired: Boolean(candidate.licenceEvidence?.shareAlikeRequired),
    modificationDisclosureRequired: Boolean(candidate.licenceEvidence?.modificationDisclosureRequired),
    sourceLinks: [candidate.upstream?.repository, candidate.licenceEvidence?.licenceUrl],
  }, ledger, configuredRegions)
  })
}

function derivedAssetRecords(ledger, configuredRegions) {
  return ledger.candidates.flatMap((candidate) => (candidate.artifacts ?? [])
    .filter((artifact) => artifact.kind === 'gltf-binary')
    .map((artifact) => {
      const provenanceOutcome = artifact.provenanceOutcome ?? 'UNRESOLVED'
      requireCondition(PROVENANCE_OUTCOMES.has(provenanceOutcome), `${artifact.id} has an invalid provenance outcome`)
      const reproducibleTransformation = artifact.transformationEvidence?.reproducible === true
        && SHA256.test(artifact.transformationEvidence?.inputSha256 ?? '')
        && artifact.transformationEvidence?.outputSha256 === artifact.sha256
      if (provenanceOutcome === 'PROVEN') requireCondition(artifact.exactBinaryMatchToUpstream === true || reproducibleTransformation, `${artifact.id} cannot claim PROVEN provenance without binary identity or a reproducible input-to-output transformation`)
      requireCondition(artifact.filenameSimilarityEstablishesProvenance !== true, `${artifact.id} cannot use filename similarity as provenance`)
      const lineageExceptions = [...new Map((artifact.derivedFrom ?? [])
        .flatMap((sourceId) => ledger.candidates.find((entry) => entry.id === sourceId)?.licenceEvidence?.componentLicenceExceptions ?? [])
        .map((entry) => [JSON.stringify(entry), entry])).values()]
      return commonRecord({
      id: artifact.id,
      title: artifact.title ?? artifact.filename,
      region: artifact.region ?? candidate.region,
      contentType: '3d-assets',
      candidateType: 'derived-glb',
      sourceProject: candidate.sourceProject ?? candidate.title,
      sourceUrl: candidate.sourceUrl ?? candidate.upstream?.repository ?? null,
      upstreamRevision: candidate.upstreamRevision ?? candidate.upstream?.commit ?? null,
      originalFilename: artifact.filename,
      bytes: artifact.bytes ?? null,
      sha256: artifact.sha256,
      parentArchiveSha256: candidate.archive?.sha256 ?? null,
      derivedFrom: artifact.derivedFrom ?? [candidate.id],
      format: 'glb-2.0',
      nodeCount: artifact.gltf?.nodes ?? null,
      namedNodeCount: artifact.gltf?.namedNodes ?? null,
      rootNodeCount: artifact.gltf?.rootNodes ?? null,
      meshCount: artifact.gltf?.meshes ?? null,
      primitiveCount: artifact.gltf?.primitives ?? null,
      materialCount: artifact.gltf?.materials ?? null,
      animationCount: artifact.gltf?.animations ?? null,
      animationNames: artifact.gltf?.animationNames ?? [],
      animationDurationsSeconds: artifact.gltf?.animationDurationsSeconds ?? [],
      sceneCount: artifact.gltf?.scenes ?? null,
      bounds: artifact.gltf?.bounds ?? null,
      externalResourceUris: artifact.gltf?.externalResourceUris ?? [],
      generatorMetadata: artifact.gltf?.generator ?? null,
      governedAssetSlotIds: artifact.governedAssetSlotIds ?? [],
      provenanceOutcome,
      exactBinaryMatchToUpstream: artifact.exactBinaryMatchToUpstream === true,
      transformationEvidence: artifact.transformationEvidence ?? null,
      modificationDescription: artifact.modificationDescription ?? null,
      licence: artifact.licence ?? null,
      licenceVersion: artifact.licenceVersion ?? null,
      licenceInheritance: artifact.licenceInheritance ?? 'unverified',
      componentLicenceExceptions: lineageExceptions,
      componentLicenceExclusionStatus: artifact.componentLicenceExclusionStatus ?? 'unverified',
      attributionRequired: true,
      attributionText: artifact.attributionText ?? [],
      shareAlikeRequired: artifact.shareAlikeRequired ?? true,
      modificationDisclosureRequired: artifact.modificationDisclosureRequired ?? true,
      reviews: candidate.reviews,
      blockers: [
        ...(candidate.blockers ?? []),
        ...(artifact.blockers ?? []),
        provenanceOutcome === 'PROVEN' ? null : 'exact-derivative-provenance-required',
        artifact.transformationEvidence ? null : 'transformation-script-or-command-required',
        artifact.licenceInheritance === 'verified-exact-file' ? null : 'exact-file-licence-lineage-required',
        artifact.modificationDescription ? null : 'modification-description-required',
        lineageExceptions.length && artifact.componentLicenceExclusionStatus !== 'verified-excluded' ? 'differently-licensed-component-exclusion-required' : null,
      ].filter(Boolean),
      missingFields: [...(candidate.missingFields ?? []), ...(artifact.missingFields ?? [])],
      sourceLinks: [candidate.upstream?.repository, candidate.licenceEvidence?.licenceUrl, candidate.declaredDerivation?.comparisonLedger, candidate.licenceEvidence?.attributionTemplate],
      reviewTasks: [...(candidate.reviewTasks ?? []), ...(artifact.reviewTasks ?? [])],
      repositoryAssetPath: null,
      publicEligibility: false,
      grantsApproval: false,
    }, ledger, configuredRegions)
    }))
}

function movementRecords(ledger, configuredRegions, governedMovementIds) {
  return (ledger.movementCandidates ?? []).map((movement) => {
    const candidate = {
      ...ledger.movementSource,
      ...movement,
      adoptedMovementData: movement.adoptedMovementData ?? null,
      claimEvidenceRecordIds: movement.claimEvidenceRecordIds ?? [],
      sourceFieldsObserved: movement.sourceFieldsObserved ?? ['description', 'rangeDeg', 'joints', 'muscles'],
    }
    if (movement.existingMovementSlotId) requireCondition(governedMovementIds.has(movement.existingMovementSlotId), `${movement.id} links to unknown governed movement slot ${movement.existingMovementSlotId}`)
    requireCondition(candidate.adoptedMovementData === null, `${movement.id} must not adopt unreviewed movement data`)
    requireCondition(Array.isArray(candidate.claimEvidenceRecordIds) && candidate.claimEvidenceRecordIds.length === 0, `${movement.id} must not claim evidence that is not present`)
    requireCondition(candidate.wipIsClinicalEvidence === false, `${movement.id} must not treat WIP source metadata as clinical evidence`)
    requireCondition(candidate.adoptedClinicalClaims === false, `${movement.id} must not adopt unreviewed clinical claims`)
    return commonRecord({
      ...candidate,
      contentType: 'movements',
      candidateType: 'movement-definition',
      format: 'typescript-source-record',
      licence: null,
      licenceVersion: null,
      attributionRequired: true,
      attributionText: [],
      shareAlikeRequired: true,
      modificationDisclosureRequired: true,
      reviews: movement.reviews ?? ledger.candidateReviewDefaults,
      blockers: [...(movement.blockers ?? []), 'uncited-biomechanical-claims-not-adopted', 'visual-movement-verification-required', 'exact-file-licence-lineage-required'],
      missingFields: [...(movement.missingFields ?? []), 'evidence-linked movement claims', 'visual movement verification', 'exact derivative provenance'],
      reviewTasks: [
        'Verify the movement visually against the exact candidate rig.',
        'Verify joint identity, laterality, pivot and deformation.',
        'Keep ranges, axes, planes, muscle roles and clinical claims excluded until evidence and human review exist.',
      ],
      repositoryAssetPath: null,
      publicEligibility: false,
      grantsApproval: false,
    }, ledger, configuredRegions)
  })
}

export function normalizeAnatomyCandidateLedger({ ledger, configuredRegions, governedMovementIds = new Set() }) {
  requireCondition(ledger?.authority === 'private-anatomy-3d-source-candidate-ledger', 'unexpected authority')
  requireCondition(ledger.privateAuthoringOnly === true, 'ledger must remain private-authoring-only')
  requireCondition(ledger.grantsApproval === false, 'ledger must not grant approval')
  const regionSet = configuredRegions instanceof Set ? configuredRegions : new Set(configuredRegions)
  const records = [
    ...sourcePackageRecords(ledger, regionSet),
    ...derivedAssetRecords(ledger, regionSet),
    ...movementRecords(ledger, regionSet, governedMovementIds),
  ]
  const ids = records.map((record) => record.id)
  requireCondition(new Set(ids).size === ids.length, 'candidate ids must be unique')
  for (const record of records) {
    if (record.sha256 !== null && record.sha256 !== undefined) requireCondition(SHA256.test(record.sha256), `${record.id} has an invalid SHA-256`)
    if (record.parentArchiveSha256 !== null && record.parentArchiveSha256 !== undefined) requireCondition(SHA256.test(record.parentArchiveSha256), `${record.id} has an invalid parent archive SHA-256`)
    requireCondition(record.publicationState === 'private', `${record.id} publication state must remain private`)
  }
  return records
}

export function candidatePublicEligibility(record) {
  return record.publicEligibility === true && record.blockers.length === 0 && Object.values(record.reviews).every((state) => state === 'approved' || state === 'not-applicable')
}
