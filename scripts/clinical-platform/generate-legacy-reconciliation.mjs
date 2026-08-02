import fs from 'node:fs'
import path from 'node:path'
import { sha256CanonicalFile } from './canonical-hash.mjs'

const ROOT = process.cwd()
const sourceRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'imports', 'source-registry.json'), 'utf8'))
const readiness = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'programmes', 'legacy-case-readiness.json'), 'utf8'))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))
const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'generator', 'patient-recipes.json'), 'utf8'))
const output = path.join(ROOT, 'reports', 'clinical-platform', 'legacy-case-reconciliation.json')

const readinessById = new Map(readiness.records.map((record) => [record.stationId, record]))
const truthBySourceId = new Map(truth.records.flatMap((record) => {
  const sourceId = record.items[0]?.source.recordId
  return sourceId?.startsWith('case.') ? [] : [[sourceId, record]]
}))
const records = sourceRegistry.sources.map((source) => {
  const sourceFile = path.join(ROOT, source.sourcePath)
  const sourceHash = sha256CanonicalFile(sourceFile)
  const ready = readinessById.get(source.sourceId)
  const truthRecord = truthBySourceId.get(source.sourceId)
  const recipe = truthRecord ? recipes.recipes.find((item) => item.truthRecordId === truthRecord.recordId) : null
  const classification = source.sourceStatus === 'converted'
    ? 'baseline-public-converted'
    : source.sourceStatus === 'draft-created'
      ? 'governed-draft-awaiting-review'
      : 'source-insufficient-awaiting-review'
  return {
    stationId: source.sourceId,
    sourceRevision: sourceHash,
    classification,
    existingTargetStatus: source.targetCaseStatus ?? null,
    truthRecordId: truthRecord?.recordId ?? null,
    recipeId: recipe?.recipeId ?? null,
    moduleIds: [],
    compatibilityReportId: null,
    modeDrafts: { guided: source.sourceStatus === 'draft-created', conversation: Boolean(truthRecord), hybrid: Boolean(truthRecord) },
    evidenceGapRecorded: true,
    anonymisationStatus: ready?.anonymisationStatus ?? (source.sourceStatus === 'converted' ? 'baseline-reviewed' : 'required'),
    publicEligibility: source.sourceStatus === 'converted',
    blockers: source.sourceStatus === 'converted' ? [] : [
      'Source sufficiency and anonymisation require human review.',
      'Clinical mapping, exact evidence, source clearance and publication review are pending.',
      'Missing truth, module, rule, recipe or mode content is not auto-filled.',
    ],
  }
}).sort((left, right) => Number(left.stationId.slice(1)) - Number(right.stationId.slice(1)))

const report = {
  schemaVersion: 1,
  sourceId: 'legacy-html-case-bank-v1',
  sourceBodiesIncluded: false,
  personalDisplayNamesIncluded: false,
  records,
  summary: {
    total: records.length,
    baselinePublicConverted: records.filter((record) => record.classification === 'baseline-public-converted').length,
    governedDraftAwaitingReview: records.filter((record) => record.classification === 'governed-draft-awaiting-review').length,
    sourceInsufficientAwaitingReview: records.filter((record) => record.classification === 'source-insufficient-awaiting-review').length,
    newlyPublished: 0,
    newlyInventedAnswers: 0,
    unaccounted: 0,
  },
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sortKeys(report), null, 2)}\n`, 'utf8')
console.log(`Legacy reconciliation generated: ${records.length} stations; converted baseline: ${report.summary.baselinePublicConverted}; existing drafts: ${report.summary.governedDraftAwaitingReview}; source-insufficient: ${report.summary.sourceInsufficientAwaitingReview}.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
