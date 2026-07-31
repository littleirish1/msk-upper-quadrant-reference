import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  loadProgrammeSchemas,
  sha256File,
} from './shared.mjs'

const schemas = await loadProgrammeSchemas()
let assertions = 0
const ok = (value, message) => {
  assertions++
  assert.ok(value, message)
}

const source = {
  sourceId: 'source.fixture',
  repositoryPath: 'content/fixture.json',
  checksum: `sha256:${'a'.repeat(64)}`,
  revision: '1',
  provenanceStatus: 'repository-tracked',
}
const baseInventoryItem = {
  schemaVersion: 1,
  id: 'condition.fixture.example',
  region: 'shoulder',
  contentType: 'condition',
  title: 'Fixture condition',
  sources: [source],
  lifecycleState: 'draft',
  clinicalReviewState: 'required',
  evidenceReviewState: 'required',
  sourceClearanceState: 'review-required',
  publicationState: 'blocked',
  destinationRoute: null,
  duplicateOf: null,
  supersedes: [],
  supersededBy: [],
  blockers: ['Human review required.'],
  nextAction: 'Review.',
}

ok(schemas.projectInventoryItemSchema.safeParse(baseInventoryItem).success, 'valid blocked inventory item')
ok(!schemas.projectInventoryItemSchema.safeParse({
  ...baseInventoryItem,
  lifecycleState: 'draft',
  publicationState: 'public',
  destinationRoute: '/fixture',
}).success, 'draft inventory item cannot be public')
ok(!schemas.projectInventoryItemSchema.safeParse({
  ...baseInventoryItem,
  lifecycleState: 'published',
  publicationState: 'public',
  destinationRoute: '/fixture',
  sourceClearanceState: 'quarantined',
}).success, 'quarantined inventory item cannot be public')

const branch = {
  schemaVersion: 1,
  id: 'branch.fixture.example',
  title: 'Fixture branch',
  status: 'draft',
  publicEligibility: false,
  reviewState: 'required',
  startNodeId: 'start',
  terminalNodeIds: ['start'],
  allowedCycleEdges: [],
  sourceContentIds: ['case.fixture.example'],
  aiFreeTextEnabled: false,
  networkRequired: false,
  nodes: [{
    id: 'start',
    kind: 'presentation',
    prompt: 'Start.',
    revealPolicy: 'initial',
    diagnosisBearing: false,
    choices: [],
  }],
}
ok(schemas.branchingCaseModelSchema.safeParse(branch).success, 'valid private branch model')
ok(!schemas.branchingCaseModelSchema.safeParse({
  ...branch,
  status: 'draft',
  publicEligibility: true,
}).success, 'unapproved branch model cannot be public')

const mcq = {
  schemaVersion: 1,
  id: 'mcq.fixture.example',
  title: 'Fixture MCQ',
  region: 'global',
  conditionIds: [],
  learningObjectives: ['Test a non-clinical contract.'],
  prompt: 'Which state is required?',
  options: [
    { id: 'a', text: 'One', explanation: 'Fixture.', correct: true },
    { id: 'b', text: 'Two', explanation: 'Fixture.', correct: false },
    { id: 'c', text: 'Three', explanation: 'Fixture.', correct: false },
  ],
  difficulty: 'foundation',
  evidenceRecordIds: [],
  referenceIds: [],
  lifecycleState: 'draft',
  clinicalReviewState: 'required',
  evidenceReviewState: 'required',
  sourceClearanceState: 'review-required',
  publicEligibility: false,
  answerRevealPolicy: 'after-submission',
  competenceClaimAllowed: false,
}
ok(schemas.governedMcqSchema.safeParse(mcq).success, 'valid private MCQ')
ok(!schemas.governedMcqSchema.safeParse({
  ...mcq,
  options: mcq.options.map((option) => ({ ...option, correct: false })),
}).success, 'MCQ requires exactly one best answer')
ok(!schemas.governedMcqSchema.safeParse({
  ...mcq,
  lifecycleState: 'published',
  publicEligibility: true,
}).success, 'public MCQ requires approval and source clearance')

const gap = {
  schemaVersion: 1,
  gapId: 'gap.condition.fixture',
  contentId: 'condition.fixture.example',
  contentRevision: '1',
  gapTypes: ['missing-evidence-record'],
  lifecycleState: 'active',
  reviewState: 'recorded',
  publicEligibility: false,
  blockers: ['Evidence review required.'],
  nextAction: 'Review.',
}
ok(schemas.evidenceGapSchema.safeParse(gap).success, 'valid evidence gap')
ok(!schemas.evidenceGapSchema.safeParse({ ...gap, publicEligibility: true }).success, 'evidence gap cannot be public')

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-programme-hash-'))
try {
  const lfFile = path.join(temporary, 'lf.json')
  const crlfFile = path.join(temporary, 'crlf.json')
  const binaryA = path.join(temporary, 'a.bin')
  const binaryB = path.join(temporary, 'b.bin')
  fs.writeFileSync(lfFile, '{\n  "value": 1\n}\n')
  fs.writeFileSync(crlfFile, '{\r\n  "value": 1\r\n}\r\n')
  fs.writeFileSync(binaryA, Buffer.from([0, 10, 13, 255]))
  fs.writeFileSync(binaryB, Buffer.from([0, 13, 10, 255]))
  ok(sha256File(lfFile) === sha256File(crlfFile), 'text checksums normalize LF and CRLF')
  ok(sha256File(binaryA) !== sha256File(binaryB), 'binary checksums remain byte-exact')
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}

console.log(`Programme foundation schema tests passed. Assertions: ${assertions}.`)
