import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeAnatomyCandidateLedger } from './anatomy-candidate-pipeline.mjs'
import { createV1PublicationReviewAdapter } from './v1-publication-review.mjs'

const portalDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultConfigPath = path.join(portalDirectory, 'content-studio-config.json')

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split('/')), 'utf8'))
}

function hashValue(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`
}

function compactText(value, fallback = 'not-recorded') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))]
}

function reviewState(value, fallback = 'not-recorded') {
  if (value && typeof value === 'object') return compactText(value.state ?? value.status, fallback)
  return compactText(value, fallback)
}

function requiredReviewBlockers(states) {
  const complete = new Set(['approved', 'published', 'baseline-reviewed', 'baseline-preserved', 'baseline-public-content', 'not-applicable'])
  return Object.entries(states)
    .filter(([, state]) => !complete.has(state))
    .map(([review]) => `${review.replace('Review', '-review')}-required`)
}

function completeness(missingFields) {
  const missing = unique(missingFields)
  const score = Math.max(0, Math.round(((8 - Math.min(8, missing.length)) / 8) * 100))
  return { status: missing.length ? 'incomplete' : 'complete', score, missingFields: missing }
}

function makeItem(input) {
  const reviews = {
    clinicalReview: reviewState(input.clinicalReview),
    evidenceReview: reviewState(input.evidenceReview),
    accessibilityReview: reviewState(input.accessibilityReview),
    licensingReview: reviewState(input.licensingReview),
  }
  const item = {
    id: compactText(input.id, ''),
    region: compactText(input.region, ''),
    contentType: compactText(input.contentType, ''),
    title: compactText(input.title, input.id),
    lifecycle: compactText(input.lifecycle, 'unknown'),
    publicationState: compactText(input.publicationState, 'private'),
    ...reviews,
    blockers: unique([...(input.blockers ?? []), ...requiredReviewBlockers(reviews)]),
    reviewTasks: Array.isArray(input.reviewTasks) ? structuredClone(input.reviewTasks) : [],
    sourceLinks: unique(input.sourceLinks ?? []),
    revisionHash: compactText(input.revisionHash, hashValue(input.currentContent ?? input)),
    completeness: completeness(input.missingFields ?? []),
    currentContent: structuredClone(input.currentContent ?? {}),
    learnerPreview: input.learnerPreview ? structuredClone(input.learnerPreview) : null,
    grantsApproval: false,
  }
  if (!item.id || !item.region || !item.contentType) throw new Error('Content registry items require id, region and contentType.')
  return item
}

export const createRegistryItem = makeItem

function taskIndex(workspace) {
  const index = new Map()
  for (const task of workspace.reviewTasks ?? []) {
    const tasks = index.get(task.targetId) ?? []
    tasks.push(task)
    index.set(task.targetId, tasks)
  }
  return index
}

function findPublicCaseRoutes(repositoryRoot) {
  const records = readJson(repositoryRoot, 'src/data/public-case-registry.json')
  return new Map(records.map((record) => [record.caseId, `/cases/${record.region}/${record.publicSlug}`]))
}

export function loadStudioConfig(configPath = defaultConfigPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (!Array.isArray(config.regions) || !Array.isArray(config.contentTypes)) throw new Error('Content Studio configuration is invalid.')
  const regionIds = config.regions.map((region) => region.id)
  if (new Set(regionIds).size !== regionIds.length) throw new Error('Content Studio region identifiers must be unique.')
  if (!config.anatomyCandidatePipeline?.ledgerPath || !Array.isArray(config.anatomyCandidatePipeline.governedMovementRegistryPaths)) throw new Error('Content Studio anatomy candidate pipeline configuration is invalid.')
  return config
}

export function createShoulderAdapter() {
  return {
    id: 'shoulder-read-only',
    regions: ['shoulder'],
    load({ repositoryRoot }) {
      const region = 'shoulder'
      const workspace = readJson(repositoryRoot, 'ai-manager/clinical-platform/shoulder/authoring-workspace.json')
      const tasks = taskIndex(workspace)
      const caseRoutes = findPublicCaseRoutes(repositoryRoot)
      const items = []

      const cases = readJson(repositoryRoot, 'reports/guided-cases/summary.json').records.filter((record) => record.region === region)
      for (const record of cases) {
        const route = caseRoutes.get(record.caseId)
        items.push(makeItem({
          id: record.caseId,
          region,
          contentType: 'cases',
          title: record.neutralTitle,
          lifecycle: record.lifecycleState,
          publicationState: record.lifecycleState === 'published' && record.publicationEligibility ? 'published' : 'private',
          clinicalReview: record.clinicalReviewStatus,
          evidenceReview: record.evidenceReviewStatus,
          accessibilityReview: 'not-recorded',
          licensingReview: record.sourceClearanceStatus,
          blockers: [record.unresolvedEvidenceGapCount ? `${record.unresolvedEvidenceGapCount}-unresolved-evidence-gaps` : null, record.unresolvedIssueCount ? `${record.unresolvedIssueCount}-unresolved-issues` : null],
          reviewTasks: tasks.get(record.caseId),
          sourceLinks: ['reports/guided-cases/summary.json', 'src/data/public-case-registry.json'],
          revisionHash: `sha256:${record.contentHash}`,
          currentContent: record,
          learnerPreview: route ? { route, label: 'Open existing learner case' } : null,
          missingFields: [record.unresolvedEvidenceGapCount ? 'evidence gaps' : null],
        }))
      }

      const movementPath = 'ai-manager/clinical-platform/shoulder/movement-library.json'
      for (const record of readJson(repositoryRoot, movementPath).records) {
        items.push(makeItem({
          id: record.id, region, contentType: 'movements', title: record.publicLabel, lifecycle: record.lifecycle, publicationState: record.publicEligibility ? 'eligible' : 'private',
          clinicalReview: record.reviews?.clinical, evidenceReview: record.reviews?.evidence, accessibilityReview: record.reviews?.accessibility, licensingReview: 'not-recorded',
          blockers: record.unresolvedIssues, reviewTasks: tasks.get(record.id), sourceLinks: [movementPath], revisionHash: hashValue(record), currentContent: record,
          missingFields: [record.jointMovement?.axis == null ? 'axis' : null, record.jointMovement?.plane == null ? 'plane' : null, !record.evidenceRecordIds?.length ? 'evidence records' : null, !record.tutorExplanation ? 'tutor explanation' : null],
        }))
      }

      const modulePath = 'ai-manager/clinical-platform/shoulder/module-library.json'
      for (const record of readJson(repositoryRoot, modulePath).modules) {
        const isAnatomy = record.type === 'anatomy-relationship'
        items.push(makeItem({
          id: record.id, region, contentType: isAnatomy ? 'anatomy' : 'modules', title: record.publicLabel, lifecycle: record.lifecycle, publicationState: record.publicationState,
          clinicalReview: record.reviews?.clinical, evidenceReview: record.reviews?.evidence, accessibilityReview: 'not-recorded', licensingReview: record.reviews?.source,
          blockers: record.reviews?.unresolvedIssues, reviewTasks: tasks.get(record.id), sourceLinks: [modulePath, ...(record.relationships?.sources ?? []).map((source) => source.repositoryPath)], revisionHash: hashValue(record), currentContent: record,
          missingFields: [record.flags?.requiresHumanReview ? 'human review' : null, !record.relationships?.evidenceRecordIds?.length ? 'evidence records' : null],
        }))
      }

      const assetPath = 'ai-manager/clinical-platform/anatomy-3d/registry.json'
      const shoulderSlot = readJson(repositoryRoot, assetPath).assets.find((asset) => asset.region === region)
      if (shoulderSlot) {
        for (const plan of shoulderSlot.plannedStructures ?? []) {
          items.push(makeItem({
            id: `3d-plan.${plan.id}`, region, contentType: '3d-assets', title: plan.label, lifecycle: 'planned', publicationState: 'private',
            clinicalReview: shoulderSlot.reviews?.clinical, evidenceReview: shoulderSlot.reviews?.provenance, accessibilityReview: shoulderSlot.reviews?.accessibility, licensingReview: shoulderSlot.reviews?.licence,
            blockers: shoulderSlot.blockers, reviewTasks: tasks.get(shoulderSlot.id), sourceLinks: [assetPath], revisionHash: hashValue({ slot: shoulderSlot.id, revision: shoulderSlot.revision, plan }),
            currentContent: { plan, assetSlotId: shoulderSlot.id, assetPath: shoulderSlot.assetPath, assetHash: shoulderSlot.assetHash, actualStructureCount: shoulderSlot.structures?.length ?? 0 },
            missingFields: [!shoulderSlot.assetPath ? '3D asset' : null, !shoulderSlot.assetHash ? 'asset hash' : null, 'source and licence'],
          }))
        }
      }

      const mcqPath = 'ai-manager/clinical-platform/shoulder/mcq-plan.json'
      for (const record of readJson(repositoryRoot, mcqPath).records) {
        items.push(makeItem({
          id: record.id, region, contentType: 'mcqs', title: record.learningObjective, lifecycle: record.lifecycle, publicationState: record.publicEligibility ? 'eligible' : 'private',
          clinicalReview: record.reviewState, evidenceReview: record.reviewState, accessibilityReview: record.reviewState, licensingReview: record.reviewState,
          blockers: record.blockers, reviewTasks: tasks.get(record.id), sourceLinks: [mcqPath], revisionHash: hashValue(record), currentContent: record,
          missingFields: [record.authoredContent == null ? 'authored question' : null, !record.evidenceRecordIds?.length ? 'evidence records' : null],
        }))
      }

      const sourcePath = 'ai-manager/clinical-platform/shoulder/source-inventory.json'
      for (const record of readJson(repositoryRoot, sourcePath).records) {
        items.push(makeItem({
          id: record.sourceId, region, contentType: 'evidence', title: record.title, lifecycle: record.reviewState, publicationState: record.publicEvidenceEligible ? 'eligible' : 'private',
          clinicalReview: 'not-recorded', evidenceReview: record.reviewState, accessibilityReview: 'not-applicable', licensingReview: record.sourceClearanceState,
          blockers: record.limitations, reviewTasks: tasks.get(record.sourceId), sourceLinks: [sourcePath, ...(record.locators ?? [])], revisionHash: record.checksum, currentContent: record,
          missingFields: [!record.evidenceProcessingEligible ? 'evidence processing clearance' : null, !record.publicEvidenceEligible ? 'public evidence eligibility' : null],
        }))
      }
      const evidenceMapPath = 'ai-manager/clinical-platform/shoulder/evidence-map.json'
      for (const gap of readJson(repositoryRoot, evidenceMapPath).gaps ?? []) {
        items.push(makeItem({
          id: gap.id, region, contentType: 'evidence', title: gap.topic, lifecycle: 'evidence-gap', publicationState: 'private',
          clinicalReview: gap.requiredReview?.includes('clinical') ? 'required' : 'not-applicable', evidenceReview: gap.requiredReview?.includes('evidence') ? 'required' : 'not-applicable', accessibilityReview: 'not-applicable', licensingReview: gap.requiredReview?.includes('source-clearance') ? 'required' : 'not-applicable',
          blockers: [gap.reason], reviewTasks: tasks.get(gap.id), sourceLinks: [evidenceMapPath], revisionHash: hashValue(gap), currentContent: gap, missingFields: ['cleared evidence'],
        }))
      }

      const rulePath = 'ai-manager/clinical-platform/shoulder/compatibility-rules.json'
      for (const record of readJson(repositoryRoot, rulePath).rules) {
        items.push(makeItem({
          id: record.id, region, contentType: 'compatibility-rules', title: record.kind, lifecycle: record.lifecycle, publicationState: record.enabled ? 'enabled' : 'private-disabled',
          clinicalReview: record.approval?.clinicalReview, evidenceReview: record.approval?.evidenceReview, accessibilityReview: 'not-applicable', licensingReview: 'not-applicable',
          blockers: [record.effect?.reviewRequirement, !record.enabled ? 'rule-disabled' : null], reviewTasks: tasks.get(record.id), sourceLinks: [rulePath], revisionHash: hashValue(record), currentContent: record,
          missingFields: [!record.enabled ? 'enablement approval' : null, !record.approval?.approvedRevision ? 'approved revision' : null],
        }))
      }
      return items
    },
  }
}

export function createAnatomy3dSourceCandidateAdapter({ candidatePath = null } = {}) {
  return {
    id: 'anatomy-3d-source-candidates-read-only',
    regions: 'data-driven',
    load({ repositoryRoot, config }) {
      const pipelineConfig = config.anatomyCandidatePipeline
      if (!pipelineConfig?.ledgerPath || !Array.isArray(pipelineConfig.governedMovementRegistryPaths)) throw new Error('Content Studio anatomy candidate pipeline configuration is invalid.')
      const ledgerPath = candidatePath ?? pipelineConfig.ledgerPath
      const governedMovementIds = pipelineConfig.governedMovementRegistryPaths.flatMap((registryPath) => readJson(repositoryRoot, registryPath).records.map((record) => record.id))
      const ledger = readJson(repositoryRoot, ledgerPath)
      return normalizeAnatomyCandidateLedger({
        ledger,
        configuredRegions: new Set(config.regions.map((region) => region.id)),
        governedMovementIds: new Set(governedMovementIds),
      }).map((candidate) => makeItem({
        id: candidate.id,
        region: candidate.region,
        contentType: candidate.contentType,
        title: candidate.title,
        lifecycle: candidate.lifecycle,
        publicationState: candidate.publicationState,
        clinicalReview: candidate.reviews.clinical,
        evidenceReview: candidate.reviews.provenance,
        accessibilityReview: candidate.reviews.accessibility,
        licensingReview: candidate.reviews.licensing,
        blockers: candidate.blockers,
        reviewTasks: candidate.reviewTasks,
        sourceLinks: [ledgerPath, ...candidate.sourceLinks],
        revisionHash: candidate.revisionHash,
        currentContent: {
          ...candidate,
          assetPath: null,
          actualStructureCount: candidate.candidateType === 'derived-glb' ? candidate.meshCount : 0,
        },
        missingFields: candidate.missingFields,
      }))
    },
  }
}

function loadExtraMaterials(store) {
  return (store.read().extraMaterials ?? []).map((record) => makeItem({
    id: record.id,
    region: record.region,
    contentType: 'extra-materials',
    title: record.title,
    lifecycle: record.lifecycle,
    publicationState: 'private',
    clinicalReview: 'not-recorded', evidenceReview: 'not-recorded', accessibilityReview: 'not-recorded', licensingReview: 'not-recorded',
    blockers: ['private-review-only'], reviewTasks: [], sourceLinks: record.documentId ? [`private-document:${record.documentId}`] : [], revisionHash: record.revisionHash,
    currentContent: record, missingFields: [record.documentId ? null : 'linked private document'],
  }))
}

export function loadContentRegistry({ repositoryRoot, store, adapters = [createV1PublicationReviewAdapter(makeItem), createShoulderAdapter(), createAnatomy3dSourceCandidateAdapter()], config = loadStudioConfig() }) {
  const allowedRegions = new Set(config.regions.map((region) => region.id))
  const allowedTypes = new Set(config.contentTypes)
  const items = [...adapters.flatMap((adapter) => adapter.load({ repositoryRoot, store, config })), ...loadExtraMaterials(store)]
  for (const item of items) {
    if (!allowedRegions.has(item.region)) throw new Error(`Unconfigured Content Studio region: ${item.region}`)
    if (!allowedTypes.has(item.contentType)) throw new Error(`Unconfigured Content Studio content type: ${item.contentType}`)
  }
  const ids = items.map((item) => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('Content Studio item identifiers must be unique.')
  return { schemaVersion: config.schemaVersion, regions: config.regions, contentTypes: config.contentTypes, extraMaterialTypes: config.extraMaterialTypes, items }
}

export function filterContentRegistry(registry, filters = {}) {
  const query = compactText(filters.query, '').toLowerCase()
  return registry.items.filter((item) => {
    if (filters.region && item.region !== filters.region) return false
    if (filters.contentType && item.contentType !== filters.contentType) return false
    if (filters.lifecycle && item.lifecycle !== filters.lifecycle) return false
    if (filters.publicationState && item.publicationState !== filters.publicationState) return false
    if (filters.blockerState === 'blocked' && !item.blockers.length) return false
    if (filters.blockerState === 'clear' && item.blockers.length) return false
    return !query || `${item.id} ${item.title}`.toLowerCase().includes(query)
  })
}

export function deriveStudioSummary(registry) {
  const reviewPending = (item) => [item.clinicalReview, item.evidenceReview, item.accessibilityReview, item.licensingReview].some((state) => !['approved', 'published', 'baseline-reviewed', 'baseline-preserved', 'baseline-public-content', 'not-applicable'].includes(state))
  return {
    totalItems: registry.items.length,
    awaitingReview: registry.items.filter(reviewPending).length,
    blockedItems: registry.items.filter((item) => item.blockers.length > 0).length,
    missingEvidence: registry.items.filter((item) => item.evidenceReview === 'required' || item.evidenceReview === 'review-required' || item.completeness.missingFields.some((field) => /evidence|source/i.test(field))).length,
    incompleteContent: registry.items.filter((item) => item.completeness.status === 'incomplete').length,
    readyForApproval: registry.items.filter((item) => item.publicationState !== 'published' && !item.blockers.length && !reviewPending(item) && item.completeness.status === 'complete').length,
  }
}

export function findContentItem(registry, id) {
  return registry.items.find((item) => item.id === id) ?? null
}

export function contentRevisionHash(value) {
  return hashValue(value)
}
