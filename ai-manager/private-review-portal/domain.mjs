import fs from 'node:fs'
import path from 'node:path'
import { deriveStudioSummary, loadContentRegistry } from './content-studio.mjs'
import { createConditionReviewCard, loadAuditedV1ConditionReviewRecords, summarizeV1PublicationReview } from './v1-publication-review.mjs'
import { createPublicationMinimumReview, V1_SOURCE_BUNDLES } from './v1-publication-minimum.mjs'
import { criticalClaimCoveredByOwnerAdoption, loadVerifiedCriticalReviewAdoption } from './v1-critical-review-adoption.mjs'
import { loadVerifiedMajorReviewAdoption, majorClaimCoveredByOwnerAdoption } from './v1-major-review-adoption.mjs'
import { loadVerifiedV1FinalConditionConfirmation } from './v1-final-condition-confirmation.mjs'
import { loadOptionalV1IndependentFinalRecommendations } from './v1-independent-final-recommendations.mjs'

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'))
}

function readOptionalJson(root, relative) {
  const file = path.join(root, ...relative.split('/'))
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
}

const datasetDefinitions = Object.freeze([
  { id: 'modules', label: 'Clinical Modules', path: 'ai-manager/clinical-platform/modules/module-library.json', collection: 'modules' },
  { id: 'truth-records', label: 'Patient Truth Records', path: 'ai-manager/clinical-platform/truth/patient-truth-records.json', collection: 'records' },
  { id: 'compatibility-rules', label: 'Compatibility rules', path: 'ai-manager/clinical-platform/rules/compatibility-rules.json', collection: 'rules' },
  { id: 'recipes', label: 'Generated recipes', path: 'ai-manager/clinical-platform/generator/patient-recipes.json', collection: 'recipes' },
  { id: 'cases', label: 'Public/private cases', path: 'reports/guided-cases/summary.json', collection: 'records' },
  { id: 'evidence', label: 'Evidence Hub records', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'evidenceRecords' },
  { id: 'evidence-proposals', label: 'Evidence-to-module proposals', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'relationships' },
  { id: 'evidence-gaps', label: 'Evidence Hub explicit gaps', path: 'reports/clinical-platform/evidence-hub-population.json', collection: 'explicitGapCollections' },
  { id: 'anatomy-3d', label: '3D slots/assets', path: 'ai-manager/clinical-platform/anatomy-3d/registry.json', collection: 'assets' },
  { id: 'movement', label: 'Movement slots/records', path: 'ai-manager/clinical-platform/movement/movement-library.json', collection: 'records' },
  { id: 'mcq', label: 'MCQ slots/questions', path: 'ai-manager/clinical-platform/mcq/bank.json', collection: 'records' },
  { id: 'reviews', label: 'Exact-revision reviews', path: 'ai-manager/clinical-platform/reviews/review-ledger.json', collection: 'reviews' },
  { id: 'review-queues', label: 'Review queues', path: 'reports/clinical-platform/review-queues.json', collection: 'queue' },
  { id: 'source-clearance', label: 'Source-clearance reviews', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'source' },
  { id: 'licensing', label: 'Licensing reviews', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'licensing' },
  { id: 'accessibility', label: 'Accessibility sign-offs', path: 'reports/clinical-platform/review-queues.json', collection: 'queue', filterField: 'reviewKind', filterValue: 'accessibility' },
  { id: 'dependencies', label: 'Dependency findings', path: 'reports/private-review-portal/dependency-classification.json', collection: 'findings' },
  { id: 'beta', label: 'Beta', path: 'ai-manager/clinical-platform/beta/programme.json', collection: 'taskScripts' },
  { id: 'release-blockers', label: 'Release blockers', path: 'ai-manager/clinical-platform/release/v1-release-candidate.json', collection: 'blockers' },
  { id: 'technical-findings', label: 'Independent technical findings', path: 'ai-manager/clinical-platform/reviews/independent-review-findings.json', collection: 'findings' },
])

function compactItem(item) {
  if (!item || typeof item !== 'object') return item
  const fields = ['id', 'moduleId', 'truthRecordId', 'ruleId', 'recipeId', 'caseId', 'assetId', 'movementId', 'questionId', 'taskId', 'queueId', 'neutralTitle', 'title', 'name', 'region', 'status', 'lifecycleState', 'publicationState', 'revision', 'exactRevisionKey', 'severity', 'subsystem', 'reviewKind', 'state']
  const compact = {}
  for (const field of fields) if (item[field] !== undefined) compact[field] = item[field]
  if (item.target) compact.target = compactItem(item.target)
  if (item.decisions) compact.pendingDecisions = item.decisions.filter((decision) => decision.state !== 'approved').length
  return Object.keys(compact).length ? compact : { summary: JSON.stringify(item).slice(0, 300) }
}

export function deriveProjectSnapshot(repositoryRoot, store, portalConfig = { actorId: 'local-reviewer', actorRoles: ['content-reviewer'] }) {
  const datasets = datasetDefinitions.map((definition) => {
    const source = readJson(repositoryRoot, definition.path)
    const collection = source[definition.collection]
    const records = Array.isArray(collection) ? collection.filter((item) => !definition.filterField || item[definition.filterField] === definition.filterValue) : []
    const count = Array.isArray(collection)
      ? records.length
      : typeof collection === 'number'
        ? collection
        : collection && typeof collection === 'object'
          ? Object.values(collection).reduce((total, value) => total + (typeof value === 'number' ? value : 0), 0)
          : 0
    const summary = Object.fromEntries(Object.entries(source).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value)))
    if (collection && typeof collection === 'object' && !Array.isArray(collection)) summary.breakdown = Object.entries(collection).map(([key, value]) => `${key}:${value}`).join(', ')
    return { id: definition.id, label: definition.label, sourcePath: definition.path, count, summary, items: records.slice(0, 500).map(compactItem) }
  })
  const evidence = readJson(repositoryRoot, 'reports/clinical-platform/evidence-hub-population.json')
  const cases = readJson(repositoryRoot, 'reports/guided-cases/summary.json')
  const reviews = readJson(repositoryRoot, 'ai-manager/clinical-platform/reviews/review-ledger.json')
  const release = readJson(repositoryRoot, 'ai-manager/clinical-platform/release/v1-release-candidate.json')
  const database = store.read()
  const registry = loadContentRegistry({ repositoryRoot, store })
  const v1Conditions = loadAuditedV1ConditionReviewRecords(repositoryRoot)
  const v1Summary = summarizeV1PublicationReview(v1Conditions, database.actions)
  const canonicalClaims = [...new Map(v1Conditions.flatMap((condition) => condition.clinicalEvidenceAudit?.canonicalClaims ?? []).map((claim) => [claim.id, claim])).values()]
  const criticalOwnerAdoption = loadVerifiedCriticalReviewAdoption(repositoryRoot)
  const majorOwnerAdoption = loadVerifiedMajorReviewAdoption(repositoryRoot)
  const finalConditionConfirmation = loadVerifiedV1FinalConditionConfirmation(repositoryRoot)
  const finalConfirmationById = new Map((finalConditionConfirmation?.conditions ?? []).map((item) => [item.conditionId, item]))
  const independentRecommendations = loadOptionalV1IndependentFinalRecommendations(repositoryRoot, finalConditionConfirmation?.conditions ?? [])
  const independentRecommendationById = new Map(independentRecommendations.conditions.map((item) => [item.conditionId, item]))
  const validFinalConfirmationActions = database.actions.filter((action) => {
    if (action.type !== 'record-v1-final-condition-confirmation') return false
    const condition = finalConfirmationById.get(action.targetId)
    return condition && action.exactRevisionKey === condition.exactCurrentRevisionHash && action.confirmationRevisionKey === condition.confirmationRevisionKey
  })
  const latestFinalConfirmationActionById = new Map()
  for (const action of validFinalConfirmationActions) {
    const previous = latestFinalConfirmationActionById.get(action.targetId)
    if (!previous || String(previous.createdAt) < String(action.createdAt)) latestFinalConfirmationActionById.set(action.targetId, action)
  }
  const publicationMinimum = createPublicationMinimumReview(canonicalClaims, { criticalOwnerAdoption, criticalClaimCoveredByOwnerAdoption, majorOwnerAdoption, majorClaimCoveredByOwnerAdoption })
  const reviewedCanonicalClaimIds = new Set(v1Summary.canonicalReview.reviewedCanonicalClaimIds)
  const learnerAudit = readOptionalJson(repositoryRoot, 'reports/publication-readiness/learner-export-audit.json')
  const externalLinkAudit = readOptionalJson(repositoryRoot, 'reports/publication-readiness/external-link-live-audit.json')
  const browserQa = readOptionalJson(repositoryRoot, 'reports/publication-readiness/v1-browser-qa-observations.json')
  const manualQa = readOptionalJson(repositoryRoot, 'reports/publication-readiness/v1-manual-qa-checklist.json')
  const manualAccessibility = readOptionalJson(repositoryRoot, 'reports/publication-readiness/v1-accessibility-checklist.json')
  const targetCases = cases.records.filter((item) => ['cervical', 'shoulder', 'elbow'].includes(item.region) && item.lifecycleState === 'published')
  const integrationProposals = database.integrationProposals.map(({ relativePath, ...proposal }) => ({
    ...proposal,
    downloadUrl: `/api/integration-proposals/${proposal.id}/download`,
  }))
  const integrationQueue = database.integrationQueue.map((entry) => structuredClone(entry))
  return {
    generatedAt: new Date().toISOString(),
    authority: 'derived-read-only-from-repository-and-private-database',
    notice: 'Research and project material only. Uploading or reviewing here does not create clinical or evidence approval.',
    headline: {
      documents: database.documents.length,
      quarantined: database.documents.filter((item) => item.quarantine === 'held').length,
      reviewTargets: reviews.reviews.length,
      pendingReviews: reviews.reviews.reduce((total, item) => total + item.decisions.filter((decision) => decision.state !== 'approved').length, 0),
      releaseBlockers: release.blockers.length,
      publicCases: cases.records.filter((item) => item.lifecycleState === 'published').length,
      privateCases: cases.records.filter((item) => item.lifecycleState !== 'published').length,
      evidenceRecords: Array.isArray(evidence.evidenceRecords) ? evidence.evidenceRecords.length : Number(evidence.evidenceRecords ?? 0),
      evidenceProposals: Array.isArray(evidence.relationships) ? evidence.relationships.length : Number(evidence.relationships ?? 0),
    },
    datasets,
    studio: {
      schemaVersion: registry.schemaVersion,
      summary: { ...deriveStudioSummary(registry), integrationProposals: integrationProposals.length, queuedForIntegration: integrationQueue.filter((entry) => !['pull-request-open', 'rejected'].includes(entry.status)).length },
      regions: registry.regions,
      contentTypes: registry.contentTypes,
      extraMaterialTypes: registry.extraMaterialTypes,
      items: registry.items.map(({ currentContent, ...item }) => item),
      integrationProposals,
      integrationQueue,
      actor: { id: portalConfig.actorId, roles: portalConfig.actorRoles },
      capabilities: { submitIntegrationProposal: portalConfig.actorRoles.includes('integration-proposer') },
      grantsApproval: false,
    },
    v1PublicationReview: {
      ...v1Summary,
      finalConditionConfirmation: finalConditionConfirmation ? {
        packetPath: finalConditionConfirmation.path,
        packetSha256: finalConditionConfirmation.sha256,
        conditionsIncluded: finalConditionConfirmation.conditions.length,
        validReviewLineage: finalConditionConfirmation.summary.validReviewLineage,
        confirmationsRecorded: new Set(validFinalConfirmationActions.map((item) => item.targetId)).size,
        confirmationsRemaining: finalConditionConfirmation.conditions.length - new Set(validFinalConfirmationActions.map((item) => item.targetId)).size,
        blankDecisionFieldsRemaining: (finalConditionConfirmation.conditions.length - new Set(validFinalConfirmationActions.map((item) => item.targetId)).size) * 4,
        manualBrowserChecksRemaining: finalConditionConfirmation.manualQaAppendix.individualChecksRemaining,
        manualAccessibilityChecksRemaining: finalConditionConfirmation.manualAccessibilityAppendix.checksRemaining,
        independentRecommendations: {
          available: independentRecommendations.available,
          path: independentRecommendations.path,
          reason: independentRecommendations.reason ?? null,
          conditionCount: independentRecommendations.conditions.length,
          grantsApproval: false,
          publicationAuthorized: false,
        },
        conditions: finalConditionConfirmation.conditions.map((item) => ({
          ...(() => {
            const condition = v1Conditions.find((candidate) => candidate.id === item.conditionId)
            const recommendation = independentRecommendationById.get(item.conditionId) ?? null
            const ownerDecision = latestFinalConfirmationActionById.get(item.conditionId) ?? null
            const canonicalClaims = condition?.clinicalEvidenceAudit?.canonicalClaims ?? []
            return {
              independentRecommendation: recommendation,
              independentRecommendationStatus: recommendation ? 'revision-matched' : 'not-available',
              independentRecommendationReason: recommendation ? recommendation.reviewerNote : independentRecommendations.reason,
              ownerDecision: ownerDecision ? {
                clinicalAccuracy: ownerDecision.clinicalAccuracyDecision,
                evidenceSufficiency: ownerDecision.evidenceSufficiencyDecision,
                clinicalCompleteness: ownerDecision.clinicalCompletenessDecision,
                publicationRecommendation: ownerDecision.publicationRecommendation,
                note: ownerDecision.note,
                recordedAt: ownerDecision.createdAt,
                grantsApproval: false,
                publicationAuthorized: false,
              } : null,
              technicalAudit: {
                canonicalConditionId: item.conditionId,
                sourceFile: item.sourceFile,
                conditionRevisionIdentifiers: [item.exactCurrentRevisionHash],
                canonicalClaimIds: canonicalClaims.map((claim) => claim.id).sort(),
                claimRevisionIdentifiers: canonicalClaims.map((claim) => `${claim.id}:${claim.revisionHash}`).sort(),
                sourceIdentifiers: [...new Set(canonicalClaims.flatMap((claim) => claim.evidenceRelationship?.proposedSources?.map((source) => source.key) ?? []))].sort(),
              },
            }
          })(),
          conditionId: item.conditionId,
          title: item.title,
          region: item.region,
          exactCurrentRevisionHash: item.exactCurrentRevisionHash,
          confirmationRevisionKey: item.confirmationRevisionKey,
          lineageValid: item.lineage.valid,
          recorded: validFinalConfirmationActions.some((action) => action.targetId === item.conditionId),
          lineage: item.lineage,
        })),
        clinicalApprovalGranted: false,
        evidenceApprovalGranted: false,
        grantsApproval: false,
        publicationAuthorized: false,
      } : null,
      publicationMinimumEvidence: {
        startingCanonicalClaims: publicationMinimum.startingCanonicalClaims,
        currentCanonicalClaims: publicationMinimum.currentCanonicalClaims,
        removedOrCollapsedByContentHardening: publicationMinimum.canonicalClaimsRemovedOrCollapsedByContentHardening,
        necessityCounts: publicationMinimum.necessityCounts,
        outcomeCounts: publicationMinimum.outcomeCounts,
        severityOutcomes: publicationMinimum.severityOutcomes,
        finalHumanEvidenceDecisionsRemaining: publicationMinimum.humanDecisionCount,
        criticalOwnerAdoption: criticalOwnerAdoption ? {
          owner: criticalOwnerAdoption.ownerConfirmation.actor,
          confirmedDate: criticalOwnerAdoption.ownerConfirmation.confirmedDate,
          recommendationCount: criticalOwnerAdoption.recommendations.length,
          resultingFileCount: criticalOwnerAdoption.implementation.resultingFiles.length,
          grantsApproval: false,
          publicationAuthorized: false,
        } : null,
        majorOwnerAdoption: majorOwnerAdoption ? {
          owner: majorOwnerAdoption.ownerConfirmation.actor,
          confirmedDate: majorOwnerAdoption.ownerConfirmation.confirmedDate,
          recommendationCount: majorOwnerAdoption.recommendations.length,
          resultingFileCount: majorOwnerAdoption.implementation.resultingFiles.length,
          grantsApproval: false,
          publicationAuthorized: false,
        } : null,
        sourceBundles: V1_SOURCE_BUNDLES,
        humanDecisions: publicationMinimum.humanDecisions.map((decision) => ({
          ...decision,
          humanDecisionRecorded: decision.canonicalClaimIds.every((claimId) => reviewedCanonicalClaimIds.has(claimId)),
        })),
        resolvedMappings: publicationMinimum.triagedClaims.filter((claim) => !['HUMAN CONFIRMATION', 'CONTENT CHANGE REQUIRED', 'BLOCKED'].includes(claim.outcome)).map((claim) => ({
          id: claim.id,
          severity: claim.severity,
          conditionIds: claim.conditionIds,
          outcome: claim.outcome,
          necessity: claim.necessity,
          sourceBundle: claim.sourceBundle,
          revisionHash: claim.revisionHash,
        })),
        grantsApproval: false,
        publicationAuthorized: false,
      },
      humanReviewItemsRemaining: {
        conditionDecisionFields: finalConditionConfirmation
          ? (finalConditionConfirmation.conditions.length - new Set(validFinalConfirmationActions.map((item) => item.targetId)).size) * 4
          : Object.values(v1Summary.regions).reduce((total, region) => total + (region.totalConditions * 3) - region.clinicalReviewed - region.evidenceReviewed - region.publicationRecommendationsRecorded, 0),
        browserViewportThemeReviews: manualQa?.viewportThemeMatrix?.filter((item) => item.checks.some((check) => check.status === 'NOT_TESTED')).length ?? 6,
        accessibilityChecks: manualAccessibility?.manualChecks?.filter((item) => item.status === 'NOT_TESTED').length ?? 13,
      },
      scope: {
        regions: ['cervical', 'shoulder', 'elbow'],
        conditions: v1Conditions.length,
        baselineCases: targetCases.length,
        futureFeaturesRequiredForV1: { movements: false, mcqs: false, modules: false, anatomy3d: false },
      },
      conditions: v1Conditions.map((item) => ({
        id: item.id,
        title: item.title,
        region: item.region,
        learnerRoute: item.learnerRoute,
        exactRevisionHash: item.exactRevisionHash,
        finalBlockers: item.finalBlockers,
        reviewCard: (() => {
          const card = createConditionReviewCard(item)
          card.canonicalClaims = card.canonicalClaims.map((claim) => ({ ...claim, humanDecisionRecorded: v1Summary.canonicalReview.reviewedCanonicalClaimIds.includes(claim.id) }))
          card.canonicalClaimsRequiringHumanVerification = card.canonicalClaims.filter((claim) => !claim.humanDecisionRecorded).length
          return card
        })(),
      })),
      baselineCases: targetCases.map((item) => ({ caseId: item.caseId, region: item.region, title: item.neutralTitle, clinicalReviewStatus: item.clinicalReviewStatus, evidenceReviewStatus: item.evidenceReviewStatus, unresolvedEvidenceGapCount: item.unresolvedEvidenceGapCount })),
      globalBuild: learnerAudit?.summary ?? null,
      externalLinks: browserQa?.summary ?? externalLinkAudit?.summary ?? null,
      manualExactBuildQa: browserQa?.exactBuildBrowser?.status ?? 'not-recorded',
      manualAccessibility: browserQa?.summary?.manualAccessibilitySignOffComplete ? 'complete' : 'not-recorded',
      notice: 'Human decisions recorded here are private recommendations only. They do not change publication state or grant approval.',
    },
    documents: database.documents.map(({ relativePath, ...document }) => document),
    actions: database.actions,
    futureItems: database.futureItems,
  }
}

export function exactRevisionExists(repositoryRoot, exactRevisionKey) {
  if (!exactRevisionKey) return false
  const ledger = readJson(repositoryRoot, 'ai-manager/clinical-platform/reviews/review-ledger.json')
  return ledger.reviews.some((review) => review.target.exactRevisionKey === exactRevisionKey)
}

const futureDefinitions = [
  ['evidence-population', 'Evidence population', 'evidence-reviewer'],
  ['module-expansion', 'Module expansion', 'clinical-author'],
  ['authored-mcqs', 'Authored MCQs', 'clinical-author'],
  ['licensed-3d-assets', 'Licensed 3D assets', 'licensing-reviewer'],
  ['reviewed-movement-records', 'Reviewed movement records', 'clinical-reviewer'],
  ['legacy-case-work', 'Legacy-case work', 'content-reviewer'],
  ['regional-content', 'Regional content', 'clinical-author'],
  ['real-beta', 'Real beta', 'beta-lead'],
  ['dependency-remediation', 'Dependency remediation', 'technical-lead'],
  ['manual-accessibility', 'Manual accessibility', 'accessibility-reviewer'],
  ['publication-release-decision', 'Publication/release decision', 'release-authority'],
]

export function initializeFutureBuild(store) {
  const database = store.read()
  if (database.futureItems.length) return database.futureItems
  return store.replaceFutureItems(futureDefinitions.map(([id, title, ownerRole], index) => ({
    id,
    title,
    status: 'not-started',
    priority: index < 3 ? 'high' : 'medium',
    dependencies: [],
    ownerRole,
    milestone: 'post-v1-technical-integration',
    blockers: ['human-authority-review-required'],
    linkedFiles: [],
    linkedFindings: [],
    linkedCommits: [],
    notes: [],
    nextAction: 'Assign an authorised owner and define an exact-revision work packet.',
  })))
}
