import assert from 'node:assert/strict'
import path from 'node:path'
import { ROOT, loadProgrammeSchemas, readJson } from './shared.mjs'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const schemas = await loadProgrammeSchemas()
const branching = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'programmes', 'branching.ts'),
  path.join(ROOT, 'src'),
)
const mcqModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'programmes', 'mcq.ts'),
  path.join(ROOT, 'src'),
)
const branchFixture = readJson(path.join(ROOT, 'content', 'learning', 'private', 'branching-reasoning-example.json'))
const mcqFixture = readJson(path.join(ROOT, 'content', 'assessment', 'private', 'mcq-contract-example.json'))
let assertions = 0
const ok = (condition, message) => {
  assertions++
  assert.ok(condition, message)
}

ok(branching.validateBranchingModel(branchFixture).valid, 'valid authorable branch model')
ok(!branching.validateBranchingModel({
  ...branchFixture,
  nodes: branchFixture.nodes.filter((node) => node.id !== 'finding'),
}).valid, 'missing target fails')
ok(!branching.validateBranchingModel({
  ...branchFixture,
  nodes: [...branchFixture.nodes, {
    id: 'orphan',
    kind: 'information-request',
    prompt: 'Unreachable.',
    revealPolicy: 'learner-action',
    diagnosisBearing: false,
    choices: [{ id: 'finish', label: 'Finish', nextNodeId: 'complete', feedbackId: null }],
  }],
}).valid, 'unreachable node fails')
ok(!branching.validateBranchingModel({
  ...branchFixture,
  allowedCycleEdges: [],
}).valid, 'undeclared cycles fail')
ok(!branching.validateBranchingModel({
  ...branchFixture,
  nodes: branchFixture.nodes.map((node) =>
    node.id === 'reviewed-conclusion'
      ? { ...node, revealPolicy: 'initial' }
      : node
  ),
}).valid, 'diagnosis-bearing initial node fails')
ok(!branching.validateBranchingModel({
  ...branchFixture,
  terminalNodeIds: ['reviewed-conclusion'],
}).valid, 'terminal node with outgoing edge fails')
assert.throws(
  () => branching.createInitialBranchingProjection(branchFixture),
  /not eligible/,
)
assertions++

ok(schemas.governedMcqSchema.safeParse(mcqFixture).success, 'valid private MCQ')
assert.throws(() => mcqModule.createMcqQuestionProjection(mcqFixture), /not eligible/)
assertions++

const publicMcq = {
  ...mcqFixture,
  lifecycleState: 'published',
  clinicalReviewState: 'approved',
  evidenceReviewState: 'approved',
  sourceClearanceState: 'approved-for-public-use',
  publicEligibility: true,
}
const questionProjection = mcqModule.createMcqQuestionProjection(publicMcq)
const answerProjection = mcqModule.createMcqAnswerProjection(publicMcq)
const initialText = JSON.stringify(questionProjection)
ok(!initialText.includes('"correct"'), 'initial MCQ projection omits correctness')
ok(!initialText.includes('"explanation"'), 'initial MCQ projection omits explanations')
ok(answerProjection.options.filter((option) => option.correct).length === 1, 'answer projection has one best answer')
ok(questionProjection.competenceClaimAllowed === false, 'MCQ cannot claim competence')

console.log(`Programme learning-system tests passed. Assertions: ${assertions}.`)
