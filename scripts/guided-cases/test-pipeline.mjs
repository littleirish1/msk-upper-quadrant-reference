import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  PUBLIC_REGISTRY_FILE,
  RECORDS_DIR,
  REPORTS_DIR,
  ROOT,
  canonicalText,
  sha256,
} from './shared.mjs'
import { validateRecordSet } from './validator-lib.mjs'

const base = {
  caseId: 'case.test.case-01',
  learnerCaseNumber: 'Case 01',
  neutralTitle: 'Neutral presentation',
  region: 'shoulder',
  publicSlug: 'case-01-neutral-presentation',
  contentRevision: 1,
  contentHash: 'a'.repeat(64),
  lifecycleState: 'published',
  publicationEligibility: true,
  privateDiagnosticIdentity: { associatedConditionId: 'private-condition' },
  governance: { publicationDecision: { status: 'approved' } },
  evidenceHub: {
    pinnedCaseRevision: 1,
    pinnedCaseHash: 'a'.repeat(64),
    conditionRecordId: null,
    evidenceRecordIds: [],
    relationshipIds: [],
    reviewDecisionId: null,
  },
}

assert.deepEqual(validateRecordSet([base], { expectedPublic: 1, expectedDraft: 0 }).findings, [])
assert.match(validateRecordSet([base, structuredClone(base)]).findings.join('\n'), /duplicate case ID/)
const diagnosticSlug = structuredClone(base)
diagnosticSlug.publicSlug = 'private-condition'
assert.match(validateRecordSet([diagnosticSlug]).findings.join('\n'), /associated condition ID/)
const draft = structuredClone(base)
draft.caseId = 'case.test.pilot-01'
draft.learnerCaseNumber = 'Pilot 01'
draft.lifecycleState = 'draft'
draft.publicationEligibility = false
draft.governance.publicationDecision.status = 'blocked'
assert.deepEqual(validateRecordSet([draft], { expectedPublic: 0, expectedDraft: 1 }).findings, [])
const stale = structuredClone(base)
stale.evidenceHub.pinnedCaseHash = 'b'.repeat(64)
assert.match(validateRecordSet([stale]).findings.join('\n'), /pin is stale/)
const inventedLink = structuredClone(base)
inventedLink.evidenceHub.conditionRecordId = 'condition.fake'
assert.match(validateRecordSet([inventedLink]).findings.join('\n'), /zero-record baseline/)
assert.equal(
  sha256(canonicalText('first\r\nsecond\r\n')),
  sha256(canonicalText('first\nsecond\n')),
)

runGenerator('generate-records.mjs')
runGenerator('generate-reports.mjs')
const pilots = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'content', 'guided-cases', 'pilot-definitions.json'), 'utf8'),
).pilots
const publicRegistryText = fs.readFileSync(PUBLIC_REGISTRY_FILE, 'utf8')
for (const pilot of pilots) {
  const recordFile = path.join(RECORDS_DIR, 'drafts', `${pilot.caseId}.json`)
  const caseReportFile = path.join(REPORTS_DIR, 'cases', `${pilot.caseId}.json`)
  const migrationReportFile = path.join(REPORTS_DIR, 'pilots', `${pilot.caseId}-migration.json`)
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'))
  const caseReport = JSON.parse(fs.readFileSync(caseReportFile, 'utf8'))
  const migrationReport = JSON.parse(fs.readFileSync(migrationReportFile, 'utf8'))

  assert.equal(record.caseId, pilot.caseId)
  assert.equal(caseReport.caseId, pilot.caseId)
  assert.equal(migrationReport.caseId, pilot.caseId)
  assert.equal(record.publicationEligibility, false)
  assert.equal(publicRegistryText.includes(pilot.caseId), false)
}

console.log(`Guided-case pipeline regression tests passed. Assertions: ${7 + (pilots.length * 5)}.`)

function runGenerator(file) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'guided-cases', file)], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(`${file} failed:\n${result.stdout}\n${result.stderr}`)
  }
}
