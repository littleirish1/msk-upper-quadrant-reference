import {
  governedMcqSchema,
  type GovernedMcq,
} from './schemas'

export function createMcqQuestionProjection(input: unknown) {
  const question = governedMcqSchema.parse(input)
  assertPublic(question)
  return {
    schemaVersion: question.schemaVersion,
    id: question.id,
    title: question.title,
    region: question.region,
    conditionIds: question.conditionIds,
    learningObjectives: question.learningObjectives,
    prompt: question.prompt,
    options: question.options.map(({ id, text }) => ({ id, text })),
    difficulty: question.difficulty,
    answerRevealPolicy: question.answerRevealPolicy,
    competenceClaimAllowed: question.competenceClaimAllowed,
  }
}

export function createMcqAnswerProjection(input: unknown) {
  const question = governedMcqSchema.parse(input)
  assertPublic(question)
  return {
    id: question.id,
    options: question.options.map(({ id, correct, explanation }) => ({
      id,
      correct,
      explanation,
    })),
  }
}

function assertPublic(question: GovernedMcq) {
  if (
    !question.publicEligibility
    || question.lifecycleState !== 'published'
    || question.clinicalReviewState !== 'approved'
    || question.evidenceReviewState !== 'approved'
    || question.sourceClearanceState !== 'approved-for-public-use'
  ) {
    throw new Error('MCQ is not eligible for public projection')
  }
}
