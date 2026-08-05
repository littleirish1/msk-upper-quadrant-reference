import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, writeJson } from './shared.mjs'

const schema = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'shoulderSliceSchema.ts'),
  path.join(ROOT, 'src'),
)
const slots = [
  ['anatomy-bones-joints', 'Review shoulder bone and joint anatomy', ['module.shoulder.anatomy.scapula', 'module.shoulder.anatomy.glenohumeral-joint']],
  ['anatomy-muscle-roles', 'Review shoulder muscle-role anatomy', ['module.shoulder.anatomy.rotator-cuff', 'module.shoulder.anatomy.deltoid']],
  ['presentation-rcrsp', 'Compare the governed RCRSP presentation record', ['module.shoulder.presentation.rcrsp']],
  ['presentation-stiffness', 'Compare the governed stiffness presentation record', ['module.shoulder.presentation.adhesive-capsulitis']],
  ['differential', 'Review differential-discriminator requirements', ['module.shoulder.presentation.cervical-neurological-mimic']],
  ['red-flags', 'Review red-flag and escalation requirements', ['module.shoulder.assessment.red-flag-screen']],
  ['assessment', 'Review shoulder assessment-domain requirements', ['module.shoulder.assessment.range-pattern', 'module.shoulder.assessment.strength-pattern']],
  ['movement', 'Review movement-record requirements', ['movement.shoulder.functional.reaching-overhead']],
  ['management', 'Review management evidence requirements', ['module.shoulder.management.principles']],
  ['prognosis', 'Review prognosis evidence requirements', ['module.shoulder.prognosis.reassessment']],
]
const records = slots.map(([slug, learningObjective, targetContentIds], index) => ({
  id: `mcq-slot.shoulder-slice.${String(index + 1).padStart(2, '0')}`,
  targetContentIds,
  learningObjective,
  lifecycle: 'source-insufficient',
  authoredContent: null,
  evidenceRecordIds: [],
  reviewState: 'review-required',
  answerRevealPolicy: 'after-submission',
  competenceClaimAllowed: false,
  publicEligibility: false,
  blockers: [
    'No cleared and appraised source supports an authored question.',
    'Clinical, evidence, source-clearance, accessibility and publication review remain required.',
  ],
}))
const plan = schema.shoulderMcqPlanSchema.parse({
  schemaVersion: 1,
  authority: 'governed-shoulder-mcq-plan',
  targetCount: 10,
  records,
  authoredQuestionCount: 0,
  publicQuestionCount: 0,
  clinicalApprovalCreated: false,
})
writeJson(path.join(SHOULDER_ROOT, 'mcq-plan.json'), plan)
writeJson(path.join(SHOULDER_REPORT_ROOT, 'mcq-readiness.json'), {
  schemaVersion: 1,
  targetSlots: 10,
  sourceInsufficientSlots: 10,
  authoredQuestions: 0,
  evidenceLinkedQuestions: 0,
  publicQuestions: 0,
  answerLeakageSurfaces: 0,
})
console.log('Shoulder MCQ plan generated: 10 source-insufficient slots; 0 authored or public questions.')
