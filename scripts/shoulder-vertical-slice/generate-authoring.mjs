import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_ROOT, writeJson } from './shared.mjs'

const schema = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'),
  path.join(ROOT, 'src'),
)
const sources = read('ai-manager/clinical-platform/shoulder/source-inventory.json').records
const evidence = read('ai-manager/clinical-platform/shoulder/evidence-map.json')
const modules = read('ai-manager/clinical-platform/shoulder/module-library.json').modules
const truth = read('ai-manager/clinical-platform/shoulder/truth-record-status.json').records
const rules = read('ai-manager/clinical-platform/shoulder/compatibility-rules.json').rules
const modes = read('ai-manager/clinical-platform/shoulder/case-mode-status.json')
const movement = read('ai-manager/clinical-platform/shoulder/movement-library.json').records
const anatomy3d = read('ai-manager/clinical-platform/anatomy-3d/registry.json').assets.find((asset) => asset.region === 'shoulder')
const mcqs = read('ai-manager/clinical-platform/shoulder/mcq-plan.json').records

const tasks = [
  ...sources.filter((source) => !source.carryForwardEligible).map((source) => task(`task.shoulder.source.${source.sourceId}`, 'source-clearance', source.sourceId, 'blocked', 'Source identity is recorded, but private evidence processing clearance is absent.', 'Record a checksum-scoped source-clearance decision without copying source content.')),
  ...evidence.gaps.map((gap) => task(`task.shoulder.evidence.${tail(gap.id)}`, 'evidence', gap.id, 'blocked', gap.reason, 'Verify source metadata, exact locator, appraisal and evidence interpretation.')),
  ...modules.map((module) => task(`task.shoulder.module.${tail(module.id)}`, 'clinical', module.id, 'required', 'The module is an empty governed review slot.', 'Author and clinically review exact source-supported wording.')),
  ...truth.map((record) => task(`task.shoulder.truth.${tail(record.caseId)}`, 'clinical', record.recordId, record.publicModeEligibility ? 'ready-for-human-review' : 'blocked', `${record.explicitGapCount} truth domains remain explicit gaps.`, 'Review atomic truth values against the exact case revision and source.')),
  ...rules.map((rule) => task(`task.shoulder.rule.${tail(rule.id)}`, 'clinical', rule.id, 'blocked', 'The compatibility rule is disabled and contains no clinical assertion.', 'Provide evidence and exact-revision clinical approval before enabling.')),
  ...movement.map((record) => task(`task.shoulder.movement.${tail(record.id)}`, 'movement', record.id, 'blocked', 'Movement claims and relationships are not approved.', 'Map exact evidence, write accessible content, and complete movement/anatomy review.')),
  ...anatomy3d.acquisitionTasks.map((item) => task(`task.shoulder.asset.${tail(item.id)}`, item.id.includes('.licence') ? 'rights' : item.id.includes('.accessibility') ? 'accessibility' : item.id.includes('.anatomy') ? 'anatomy' : 'technical', anatomy3d.id, 'blocked', item.label, 'Complete and record the named review task for the exact asset revision.')),
  ...mcqs.map((record) => task(`task.shoulder.mcq.${tail(record.id)}`, 'clinical', record.id, 'blocked', record.blockers[0], 'Author only after evidence and source clearance, then obtain clinical, accessibility and publication review.')),
  ...modes.publicCases.map((record) => task(`task.shoulder.case-preview.${tail(record.caseId)}`, 'technical', record.caseId, 'ready-for-human-review', 'The public baseline case modes are technically available.', 'Review grounded conversation behavior, staged disclosure and diagnosis reveal for this exact truth hash.')),
]

const sectionInputs = [
  ['source-inventory', 'Shoulder source inventory', sources.length],
  ['ingestion-proposals', 'Ingestion proposals', 0],
  ['evidence-hub', 'Evidence Hub records and gaps', evidence.conditionIds.length + evidence.guidedCaseIds.length + evidence.gaps.length],
  ['module-editor', 'Clinical module editor', modules.length],
  ['truth-record-editor', 'Patient Truth Record editor', truth.length],
  ['compatibility-rules', 'Compatibility rules', rules.length],
  ['case-preview', 'Guided, Conversation and Hybrid preview', modes.publicCases.length],
  ['conversation-review', 'Conversation transcript review', modes.publicCases.length],
  ['movement-editor', 'Movement editor', movement.length],
  ['three-d-licensing', '3D asset and licensing queue', anatomy3d.plannedStructures.length],
  ['mcq-editor', 'MCQ editor', mcqs.length],
  ['exact-revision-review', 'Exact-revision review queue', tasks.length],
  ['evidence-gaps', 'Evidence gaps', evidence.gaps.length],
  ['focused-packet', 'Focused review packet', 1],
]
const workspace = schema.shoulderAuthoringWorkspaceSchema.parse({
  schemaVersion: 1,
  authority: 'private-shoulder-authoring-workspace',
  privateAuthoringOnly: true,
  publicRoute: null,
  providerCallsEnabled: false,
  autonomousApprovalAllowed: false,
  sections: sectionInputs.map(([id, label, recordCount]) => ({
    id,
    label,
    recordCount,
    queueCount: id === 'exact-revision-review' ? tasks.length : tasks.filter((item) => item.targetId.includes(id.replace(/-editor|-review|-licensing/, ''))).length,
  })),
  reviewTasks: tasks,
  actions: ['inspect-exact-revision', 'filter-review-queue', 'draft-ephemeral-note', 'preview-public-safe-projection', 'download-focused-review-packet'],
})
writeJson(path.join(SHOULDER_ROOT, 'authoring-workspace.json'), workspace)
console.log(`Private shoulder authoring workspace generated: ${workspace.sections.length} sections; ${workspace.reviewTasks.length} human review tasks; 0 approvals.`)

function task(taskId, domain, targetId, state, reason, requiredDecision) {
  return { taskId, domain, targetId, state, reason, requiredDecision, publicEligibility: false }
}
function tail(value) { return value.split('.').slice(-2).join('-') }
function read(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')) }
