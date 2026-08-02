import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'mcqBankSchema.ts'), path.join(ROOT, 'src'))
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'assessment', 'mcq-plan.json'), 'utf8'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'mcq', 'bank.json')
const reportOutput = path.join(ROOT, 'reports', 'clinical-platform', 'mcq-bank-readiness.json')
const records = plan.slots.map((slot) => schemas.mcqBankItemSchema.parse({
  schemaVersion: 1,
  id: slot.id,
  revision: 1,
  region: slot.region,
  targetContentIds: slot.targetContentIds,
  learningObjectives: [slot.learningObjective],
  difficulty: 'not-rated',
  lifecycle: 'source-insufficient',
  authoredContent: null,
  evidenceRecordIds: [],
  referenceIds: [],
  reviews: { clinical: 'required', evidence: 'required', sourceClearance: 'required', accessibility: 'required', publication: 'required' },
  answerRevealPolicy: 'after-submission',
  competenceClaimAllowed: false,
  publicEligibility: false,
  blockers: slot.blockers,
}))
const bank = schemas.mcqBankSchema.parse({ schemaVersion: 1, authority: 'governed-mcq-bank', targetCount: 20, records, governanceExamplePath: 'content/assessment/private/mcq-contract-example.json' })
const report = {
  schemaVersion: 1,
  targetCount: 20,
  governedSlots: records.length,
  sourceInsufficient: records.filter((record) => record.lifecycle === 'source-insufficient').length,
  authoredClinicalQuestions: records.filter((record) => record.authoredContent).length,
  oneBestAnswerValidated: 0,
  optionExplanationsValidated: 0,
  evidenceLinked: 0,
  publicQuestions: 0,
  answerLeakageSurfaceCount: 0,
  governanceContractExampleCount: 1,
  realClinicalApprovalClaimed: false,
}
write(output, bank)
write(reportOutput, report)
console.log(`Governed MCQ bank generated: ${records.length} source-insufficient slots; authored clinical questions: 0; public: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
