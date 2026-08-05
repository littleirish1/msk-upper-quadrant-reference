import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, writeJson } from './shared.mjs'

const moduleSchema = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'moduleSchema.ts'),
  path.join(ROOT, 'src'),
)
const planPath = path.join(ROOT, 'ai-manager', 'clinical-platform', 'shoulder', 'plans', 'module-plan.json')
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
const inventory = JSON.parse(fs.readFileSync(path.join(SHOULDER_ROOT, 'source-inventory.json'), 'utf8'))
const sourceById = new Map(inventory.records.map((source) => [source.sourceId, source]))

const modules = plan.records.map((slot) => {
  const source = sourceById.get(slot.sourceId)
  if (!source) throw new Error(`Shoulder module ${slot.id} names unknown source ${slot.sourceId}`)
  return moduleSchema.clinicalModuleSchema.parse({
    schemaVersion: 1,
    id: slot.id,
    type: slot.type,
    revision: 1,
    lifecycle: 'draft',
    publicationState: 'private',
    publicLabel: slot.label,
    internalLabel: `${slot.label} review slot`,
    structuredMeaning: {
      kind: 'structured-fact',
      value: `Governed review slot for ${slot.label}; no clinical assertion is encoded.`,
      sourceCaseId: null,
    },
    patientPhrasing: { approved: [], status: 'review-required' },
    tutorPhrasing: { approved: [], status: 'review-required' },
    synonyms: [],
    questionMappings: [],
    applicability: {
      populations: [],
      settings: ['education authoring review'],
      regions: ['shoulder'],
      limitations: ['Applicability is not established until source, evidence and clinical review are complete.'],
    },
    companions: { required: [], prohibited: [] },
    constraints: { temporal: [], severity: [], escalation: [] },
    difficulty: 'not-rated',
    relationships: {
      sources: [{
        recordId: source.sourceId,
        repositoryPath: source.locators[0] ?? 'private-source-locator-withheld',
        revision: source.checksum,
        hash: source.checksum.replace(/^sha256:/, ''),
      }],
      evidenceRecordIds: [],
      evidenceGapIds: [`gap.${slot.id}`],
    },
    flags: { aiAssisted: true, humanEdited: false, requiresHumanReview: true },
    reviews: {
      clinical: 'required',
      evidence: 'required',
      source: source.carryForwardEligible ? 'baseline-carried-forward' : 'required',
      publication: 'required',
      approvalHash: null,
      approvedRevision: null,
      nextReviewDate: null,
      limitations: [
        'The module contains an authoring slot only and no approved clinical assertion.',
        'A repository baseline source may preserve existing wording but does not approve this module revision.',
      ],
      unresolvedIssues: [
        'Map exact evidence locators and claims after source clearance.',
        'Complete exact-revision clinical, evidence and publication review.',
      ],
    },
    fieldClassifications: { ...moduleSchema.MODULE_FIELD_VISIBILITY },
  })
})

const library = moduleSchema.clinicalModuleLibrarySchema.parse({
  schemaVersion: 1,
  authority: 'clinical-module-library',
  generatedFrom: ['ai-manager/clinical-platform/shoulder/plans/module-plan.json', 'ai-manager/clinical-platform/shoulder/source-inventory.json'],
  modules,
})
writeJson(path.join(SHOULDER_ROOT, 'module-library.json'), library)
writeJson(path.join(SHOULDER_REPORT_ROOT, 'module-inventory.json'), {
  schemaVersion: 1,
  groups: Object.fromEntries([...new Set(plan.records.map((slot) => slot.group))].sort().map((group) => [group, plan.records.filter((slot) => slot.group === group).length])),
  total: modules.length,
  publicModules: 0,
  evidenceLinkedModules: 0,
  reviewRequired: modules.length,
  clinicalAssertionsCreated: 0,
})
console.log(`Shoulder clinical modules generated: ${modules.length} private review slots; 0 claims; 0 public modules.`)
