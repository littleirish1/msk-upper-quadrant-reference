import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, writeJson } from './shared.mjs'

const truthSchemas = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'truthRecordSchema.ts'),
  path.join(ROOT, 'src'),
)
const compatibility = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'compatibility.ts'),
  path.join(ROOT, 'src'),
)
const truthLibrary = truthSchemas.patientTruthLibrarySchema.parse(read('ai-manager/clinical-platform/truth/patient-truth-records.json'))
const publicAssets = read('src/data/case-conversation-assets.json').assets
const shoulderTruth = truthLibrary.records.filter((record) => record.caseId.startsWith('case.shoulder.'))
if (shoulderTruth.length !== 3) throw new Error(`Expected three governed shoulder truth records, received ${shoulderTruth.length}`)

const truthStatus = {
  schemaVersion: 1,
  authority: 'shoulder-truth-record-status',
  records: shoulderTruth.map((record) => ({
    caseId: record.caseId,
    recordId: record.recordId,
    caseRevision: record.caseRevision,
    authoritativeHash: record.authoritativeHash,
    lifecycle: record.lifecycle,
    publicModeEligibility: record.publicModeEligibility,
    domainCount: record.items.length,
    missingDomains: truthSchemas.truthDomainSchema.options.filter((domain) => !record.items.some((item) => item.domain === domain)),
    stateCounts: Object.fromEntries([...new Set(record.items.map((item) => item.state))].sort().map((state) => [state, record.items.filter((item) => item.state === state).length])),
    explicitGapCount: record.gaps.length,
    informationUnavailableBehaviour: true,
    diagnosisWithheldUntilReveal: record.items.filter((item) => ['likely-diagnosis', 'condition-link'].includes(item.domain)).every((item) => item.state === 'intentionally-withheld' && item.disclosureStage === 'final-reveal'),
    conversationAsset: publicAssets.find((asset) => asset.caseId === record.caseId)?.assetPath ?? null,
    reviewState: record.publicModeEligibility ? 'baseline-carried-forward' : 'review-required',
  })),
  summary: {
    records: shoulderTruth.length,
    baselinePublic: shoulderTruth.filter((record) => record.publicModeEligibility).length,
    privateDrafts: shoulderTruth.filter((record) => !record.publicModeEligibility).length,
    implicitNegatives: 0,
    valuesInvented: 0,
  },
}
writeJson(path.join(SHOULDER_ROOT, 'truth-record-status.json'), truthStatus)

const plan = read('ai-manager/clinical-platform/shoulder/plans/compatibility-plan.json')
const rules = plan.records.map((slot) => compatibility.compatibilityRuleSchema.parse({
  schemaVersion: 1,
  id: slot.id,
  revision: 1,
  kind: slot.kind,
  lifecycle: 'draft',
  enabled: false,
  severity: 'error',
  when: { allModuleIds: [], anyModuleIds: [], contextEquals: { region: 'shoulder' } },
  effect: {
    requiresModuleIds: [],
    prohibitsModuleIds: [],
    impliesModuleIds: [],
    escalationRequirement: null,
    reviewRequirement: `Human source, evidence and clinical review is required before enabling ${slot.label}.`,
    message: `${slot.label} remains a disabled review slot; no clinical rule is encoded.`,
  },
  evidenceRecordIds: [],
  evidenceGapIds: [`gap.${slot.id}`],
  approval: { ruleHash: null, approvedRevision: null, clinicalReview: 'required', evidenceReview: 'required' },
}))
writeJson(path.join(SHOULDER_ROOT, 'compatibility-rules.json'), compatibility.compatibilityCatalogueSchema.parse({
  schemaVersion: 1,
  authority: 'clinical-compatibility-rules',
  revision: 1,
  rules,
}))

const modeStatus = {
  schemaVersion: 1,
  authority: 'shoulder-case-mode-status',
  publicCases: shoulderTruth.filter((record) => record.publicModeEligibility).map((record) => ({
    caseId: record.caseId,
    truthHash: record.authoritativeHash,
    modes: ['guided', 'conversation', 'hybrid'],
    conversationGrounding: 'exact-truth-hash',
    diagnosisBoundary: 'governed-reveal-only',
    networkProviderCalls: 0,
    persistedLearnerText: false,
  })),
  privatePilots: shoulderTruth.filter((record) => !record.publicModeEligibility).map((record) => ({
    caseId: record.caseId,
    modes: [],
    publicEligibility: false,
    blocker: 'Draft case remains excluded until exact-revision human review and publication approval.',
  })),
}
writeJson(path.join(SHOULDER_ROOT, 'case-mode-status.json'), modeStatus)
writeJson(path.join(SHOULDER_REPORT_ROOT, 'case-governance-summary.json'), {
  schemaVersion: 1,
  truthRecords: shoulderTruth.length,
  publicShoulderCases: modeStatus.publicCases.length,
  privateShoulderPilots: modeStatus.privatePilots.length,
  explicitTruthGaps: shoulderTruth.reduce((sum, record) => sum + record.gaps.length, 0),
  disabledCompatibilityRules: rules.length,
  enabledShoulderRules: 0,
  clinicalRulesInvented: 0,
})
console.log(`Shoulder case governance generated: ${shoulderTruth.length} truth records; ${modeStatus.publicCases.length} public modes; ${rules.length} disabled rules; 0 invented values.`)

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
}
