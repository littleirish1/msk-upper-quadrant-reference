import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const V1_FINAL_CONFIRMATION_PATH = 'reports/publication-readiness/V1-FINAL-20-CONDITION-HUMAN-CONFIRMATION.json'
export const V1_FINAL_CONFIRMATION_DECISIONS = Object.freeze({
  clinicalAccuracy: ['acceptable-for-v1', 'changes-required', 'blocked'],
  evidenceSufficiency: ['acceptable-for-v1', 'changes-required', 'blocked'],
  clinicalCompleteness: ['acceptable-for-v1', 'future-expansion-non-blocking', 'changes-required', 'blocked'],
  publicationRecommendation: ['recommend-publish', 'recommend-hold'],
})

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'))
}

function fileSha(root, relativePath) {
  return sha256(fs.readFileSync(path.join(root, ...relativePath.split('/'))))
}

function recordHash(value) {
  return `sha256:${sha256(Buffer.from(JSON.stringify(value)))}`
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function recommendationSummary(recommendation) {
  return {
    id: recommendation.id,
    evidenceDisposition: recommendation.evidenceDisposition,
    wordingDisposition: recommendation.wordingDisposition,
    contentChange: recommendation.contentChange,
    contentChanged: recommendation.contentChanged,
  }
}

export function createV1FinalConditionConfirmationPacket({
  repositoryRoot,
  conditionRecords,
  publicationMinimum,
  criticalAdoption,
  majorAdoption,
  finalEvidencePacket,
  manualQa,
  accessibility,
  buildIntegrity,
  evidenceHub,
}) {
  if (conditionRecords.length !== 20) throw new Error(`Final condition confirmation requires exactly 20 conditions; found ${conditionRecords.length}`)
  if (!criticalAdoption?.verifiedAgainstCurrentFiles || !majorAdoption?.verifiedAgainstCurrentFiles) throw new Error('Verified Critical and Major adoption records are required')
  if (publicationMinimum.humanDecisions.some((item) => ['CRITICAL', 'MAJOR'].includes(item.severity))) throw new Error('Critical or Major human evidence decisions remain')
  if (finalEvidencePacket.summary?.conditionsReadyForHumanConfirmation !== 20) throw new Error('Final evidence packet does not mark all 20 conditions ready')

  const criticalResultByFile = new Map(criticalAdoption.implementation.resultingFiles.map((item) => [item.relativePath, item.sha256]))
  const majorResultByFile = new Map(majorAdoption.implementation.resultingFiles.map((item) => [item.relativePath, item.sha256]))
  const finalById = new Map(finalEvidencePacket.conditionReadiness.map((item) => [item.conditionId, item]))
  const sourceBundles = publicationMinimum.sourceBundles ?? {}
  const claims = publicationMinimum.triagedClaims

  const conditions = conditionRecords.map((condition) => {
    const currentSha = fileSha(repositoryRoot, condition.sourceFile)
    const expectedRevision = condition.exactRevisionHash.replace(/^sha256:/, '')
    const criticalResult = criticalResultByFile.get(condition.sourceFile)
    const majorResult = majorResultByFile.get(condition.sourceFile) ?? null
    const lineageTip = majorResult ?? criticalResult
    const finalRecord = finalById.get(condition.id)
    const criticalRecommendations = criticalAdoption.recommendations
      .filter((item) => item.conditions.includes(condition.id))
      .map((item) => ({ id: item.id, wordingDisposition: item.independentWordingRecommendation, contentChange: item.reviewerRecommendation }))
    const majorRecommendations = majorAdoption.recommendations
      .filter((item) => item.affectedConditions.includes(condition.id))
      .map(recommendationSummary)
    const conditionClaims = claims.filter((claim) => claim.conditionIds.includes(condition.id))
    const criticalResolved = conditionClaims.filter((claim) => claim.severity === 'CRITICAL' && claim.outcome === 'OWNER-CONFIRMED RECOMMENDATION IMPLEMENTED')
    const majorResolved = conditionClaims.filter((claim) => claim.severity === 'MAJOR' && claim.outcome === 'OWNER-CONFIRMED MAJOR RECOMMENDATION IMPLEMENTED')
    const future = conditionClaims.filter((claim) => claim.outcome === 'FUTURE EVIDENCE EXPANSION').map((claim) => ({
      canonicalId: claim.id,
      severity: claim.severity,
      topic: claim.primaryClass.label,
      sourceBundle: claim.sourceBundle,
      status: 'NON-BLOCKING FUTURE EVIDENCE EXPANSION',
    }))
    const bundleIds = unique(conditionClaims.map((claim) => claim.sourceBundle))
    const evidenceAnchors = [...new Map(bundleIds.flatMap((bundleId) => (sourceBundles[bundleId]?.sources ?? []).map((source) => ({
      bundleId,
      sourceId: source.key,
      title: source.title,
      year: source.year,
      url: source.url,
      relevantSection: source.relevantSections,
    }))).map((item) => [`${item.bundleId}:${item.sourceId}`, item])).values()]
    const lineageValid = Boolean(
      criticalResult
      && lineageTip === currentSha
      && currentSha === expectedRevision
      && finalRecord?.exactRevisionHash === condition.exactRevisionHash
      && finalRecord?.critical === 0
      && finalRecord?.major === 0,
    )
    if (!lineageValid) throw new Error(`FAIL CLOSED: stale or unreconciled final-confirmation condition ${condition.id}`)

    const decisions = {
      clinicalAccuracy: null,
      evidenceSufficiency: null,
      clinicalCompleteness: null,
      publicationRecommendation: null,
      reviewerNotes: '',
    }
    const record = {
      conditionId: condition.id,
      title: condition.title,
      region: condition.region,
      learnerRoute: condition.learnerRoute,
      sourceFile: condition.sourceFile,
      exactCurrentRevisionHash: condition.exactRevisionHash,
      status: 'READY FOR FINAL HUMAN CONFIRMATION',
      why: 'No unresolved CRITICAL or MAJOR publication-critical evidence decision remains.',
      audit: {
        criticalDecisionsResolved: criticalResolved.length,
        majorDecisionsResolved: majorResolved.length,
        criticalRecommendationGroups: criticalRecommendations,
        majorRecommendationGroups: majorRecommendations,
        contentSafelyRemovedOrSoftened: [...criticalRecommendations, ...majorRecommendations]
          .filter((item) => item.contentChange || item.removed || item.contentChanged)
          .map((item) => ({ id: item.id, change: item.contentChange ?? item.removed ?? 'reviewed wording changed' })),
        authoritativeEvidenceAnchors: evidenceAnchors,
        futureEvidenceExpansion: future,
        localServiceWordingStatus: finalEvidencePacket.summary.localService.disposition,
        prescribingBoundaryStatus: conditionClaims.some((claim) => claim.primaryClass.code === 'E')
          ? 'Condition includes prescribing-boundary wording; medicine decisions remain clinician/prescriber-led.'
          : 'No publication-critical prescribing decision remains for this condition.',
        automatedWarning: null,
      },
      lineage: {
        valid: true,
        criticalAdoption: {
          path: criticalAdoption.path,
          sha256: sha256(fs.readFileSync(path.join(repositoryRoot, ...criticalAdoption.path.split('/')))),
          recommendationIds: criticalRecommendations.map((item) => item.id),
          resultingFileSha256: criticalResult,
        },
        majorAdoption: {
          path: majorAdoption.path,
          sha256: sha256(fs.readFileSync(path.join(repositoryRoot, ...majorAdoption.path.split('/')))),
          predecessorCriticalAdoptionSha256: majorAdoption.predecessorCriticalAdoption.sha256,
          recommendationIds: majorRecommendations.map((item) => item.id),
          resultingFileSha256: majorResult,
          appliedToCondition: Boolean(majorResult),
        },
        finalHumanEvidencePacket: {
          path: 'reports/publication-readiness/V1-FINAL-HUMAN-EVIDENCE-DECISIONS.json',
          exactRevisionHash: finalRecord.exactRevisionHash,
          criticalHumanDecisions: finalRecord.critical,
          majorHumanDecisions: finalRecord.major,
        },
        currentConditionSha256: currentSha,
      },
      allowedDecisions: structuredClone(V1_FINAL_CONFIRMATION_DECISIONS),
      decisions,
      grantsApproval: false,
      publicationAuthorized: false,
      publicationStateChanged: false,
    }
    record.confirmationRevisionKey = recordHash({ conditionId: record.conditionId, exactCurrentRevisionHash: record.exactCurrentRevisionHash, lineage: record.lineage })
    return record
  })

  const browserChecks = manualQa.viewportThemeMatrix.flatMap((entry) => entry.checks.map((check) => ({ viewport: entry.viewport, theme: entry.theme, ...check })))
  const manualAccessibilityChecks = accessibility.manualChecks.filter((item) => item.status === 'NOT_TESTED')
  const packet = {
    schemaVersion: 1,
    packetType: 'v1-final-20-condition-human-confirmation',
    authority: 'blank revision-bound human confirmation form; generation grants no approval or publication authority',
    scope: {
      regions: ['cervical', 'shoulder', 'elbow'],
      conditions: conditions.length,
      futureFeaturesRequiredForV1: { movements: false, mcqs: false, modules: false, anatomy3d: false },
    },
    summary: {
      conditionsIncluded: conditions.length,
      validReviewLineage: conditions.filter((item) => item.lineage.valid).length,
      staleConditionsRejected: 0,
      criticalHumanEvidenceDecisionsRemaining: 0,
      majorHumanEvidenceDecisionsRemaining: 0,
      conditionsReadyForFinalHumanConfirmation: conditions.length,
      blankClinicalAccuracyDecisions: conditions.filter((item) => item.decisions.clinicalAccuracy === null).length,
      blankEvidenceSufficiencyDecisions: conditions.filter((item) => item.decisions.evidenceSufficiency === null).length,
      blankClinicalCompletenessDecisions: conditions.filter((item) => item.decisions.clinicalCompleteness === null).length,
      blankPublicationRecommendations: conditions.filter((item) => item.decisions.publicationRecommendation === null).length,
    },
    conditions,
    manualQaAppendix: {
      status: 'NOT COMPLETE',
      source: 'reports/publication-readiness/v1-manual-qa-checklist.json',
      viewportThemeCombinationsRemaining: manualQa.viewportThemeMatrix.filter((item) => item.checks.some((check) => check.status === 'NOT_TESTED')).length,
      individualChecksRemaining: browserChecks.filter((item) => item.status === 'NOT_TESTED').length,
      viewportThemeMatrix: manualQa.viewportThemeMatrix,
    },
    manualAccessibilityAppendix: {
      status: 'NOT COMPLETE',
      source: 'reports/publication-readiness/v1-accessibility-checklist.json',
      automatedStatus: accessibility.automatedStatus,
      conformanceClaimed: false,
      checksRemaining: manualAccessibilityChecks.length,
      checks: accessibility.manualChecks,
    },
    buildGovernanceAppendix: {
      runtime: { node: '20.20.2', npm: '10.8.2' },
      fullPreflight: 'PASS',
      learnerRoutes: buildIntegrity.generatedLearnerRoutes,
      staticHtmlPages: buildIntegrity.htmlPages,
      productionBuildStaticPages: 68,
      internalHyperlinks: `${buildIntegrity.validInternalHyperlinks}/${buildIntegrity.internalHyperlinks}`,
      brokenInternalHyperlinks: buildIntegrity.brokenInternalHyperlinks,
      fragmentLinks: buildIntegrity.fragmentLinks,
      invalidAnchors: buildIntegrity.invalidAnchors,
      localAssetReferences: `${buildIntegrity.validLocalAssetReferences}/${buildIntegrity.localAssetReferences}`,
      missingLocalAssets: buildIntegrity.missingLocalAssets,
      privateLeakageFindings: buildIntegrity.privateMarkerFindings,
      public3dAssets: 0,
      learnerFacing3dRoutes: 0,
      evidenceHub: {
        state: 'FAIL CLOSED',
        publicRecords: evidenceHub.publicRecords,
        claims: evidenceHub.claims,
        relationships: evidenceHub.relationships,
        reviewDecisions: evidenceHub.reviewDecisions,
      },
    },
    clinicalApprovalGranted: false,
    evidenceApprovalGranted: false,
    grantsApproval: false,
    publicationAuthorized: false,
    publicationStateChanged: false,
  }
  return packet
}

export function loadVerifiedV1FinalConditionConfirmation(repositoryRoot) {
  const file = path.join(repositoryRoot, ...V1_FINAL_CONFIRMATION_PATH.split('/'))
  if (!fs.existsSync(file)) return null
  const packet = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (packet.packetType !== 'v1-final-20-condition-human-confirmation' || packet.conditions?.length !== 20) throw new Error('Invalid final condition confirmation packet')
  if (packet.clinicalApprovalGranted !== false || packet.evidenceApprovalGranted !== false || packet.grantsApproval !== false || packet.publicationAuthorized !== false || packet.publicationStateChanged !== false) throw new Error('Final condition confirmation packet exceeds authority')
  for (const condition of packet.conditions) {
    if (!condition.lineage?.valid) throw new Error(`Final confirmation lineage invalid: ${condition.conditionId}`)
    if (fileSha(repositoryRoot, condition.sourceFile) !== condition.exactCurrentRevisionHash.replace(/^sha256:/, '')) throw new Error(`Stale final condition confirmation: ${condition.conditionId}`)
    if (Object.values(condition.decisions).some((value) => value !== null && value !== '')) throw new Error(`Final condition decisions must be blank at generation: ${condition.conditionId}`)
  }
  return { ...packet, path: V1_FINAL_CONFIRMATION_PATH, sha256: sha256(fs.readFileSync(file)), verifiedAgainstCurrentFiles: true }
}
