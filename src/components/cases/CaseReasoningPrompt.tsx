'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ArrowDown, CheckCircle2, Eye, Lightbulb } from 'lucide-react'

type ReflectionField = 'hypothesis' | 'supportingFeatures' | 'safetyFeatures' | 'nextAssessment'

interface ReasoningResponses {
  hypothesis: string
  supportingFeatures: string
  safetyFeatures: string
  nextAssessment: string
}

export interface EnhancedReasoningFeedbackConfig {
  badgeLabel: string
  conceptGroups: {
    hypothesis: string[]
    supportingFeatures: string[]
    cautionSafety: string[]
    nextAssessment: string[]
    localOnlyPattern?: string[]
  }
}

interface CaseReasoningPromptProps {
  displayTitle: string
  actualTitle?: string
  conditionLabel?: string
  enhancedFeedback?: EnhancedReasoningFeedbackConfig
  children: ReactNode
}

export function CaseReasoningPrompt({
  displayTitle,
  actualTitle,
  conditionLabel,
  enhancedFeedback,
  children,
}: CaseReasoningPromptProps) {
  const [diagnosisRevealed, setDiagnosisRevealed] = useState(false)
  const [reasoningRevealed, setReasoningRevealed] = useState(false)
  const [responses, setResponses] = useState<ReasoningResponses>({
    hypothesis: '',
    supportingFeatures: '',
    safetyFeatures: '',
    nextAssessment: '',
  })
  const [feedbackChecked, setFeedbackChecked] = useState(false)

  const feedback = enhancedFeedback && feedbackChecked
    ? buildFeedback(enhancedFeedback, responses)
    : null

  function updateResponse(field: ReflectionField, value: string) {
    setResponses((current) => ({
      ...current,
      [field]: value,
    }))
    setFeedbackChecked(false)
  }

  return (
    <>
      <section className="mb-8 rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-800 dark:bg-surface-900 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-fit rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <Lightbulb className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Think first
            </p>
            {enhancedFeedback && (
              <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {enhancedFeedback.badgeLabel}
              </p>
            )}
            <h2 className="mt-1 text-lg font-semibold text-surface-900 dark:text-surface-50">
              {displayTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">
              Commit to a hypothesis before opening the answer. Nothing is scored or saved.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Leading hypothesis
            </span>
            <textarea
              value={responses.hypothesis}
              onChange={(event) => updateResponse('hypothesis', event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
              placeholder="What is your leading clinical hypothesis?"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Two supporting features
            </span>
            <textarea
              value={responses.supportingFeatures}
              onChange={(event) => updateResponse('supportingFeatures', event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
              placeholder="Which findings support it?"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Two caution/safety features
            </span>
            <textarea
              value={responses.safetyFeatures}
              onChange={(event) => updateResponse('safetyFeatures', event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
              placeholder="What red flags, cautions, or alternative explanations must stay on the table?"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              What would you assess next?
            </span>
            <textarea
              value={responses.nextAssessment}
              onChange={(event) => updateResponse('nextAssessment', event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
              placeholder="Which tests, screens, or questions would you prioritise?"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {enhancedFeedback && (
            <button
              type="button"
              onClick={() => setFeedbackChecked(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Check my reasoning
            </button>
          )}

          <button
            type="button"
            onClick={() => setDiagnosisRevealed(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:bg-brand-500 dark:hover:bg-brand-600"
            aria-expanded={diagnosisRevealed}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Reveal likely diagnosis / linked condition
          </button>

          <button
            type="button"
            onClick={() => setReasoningRevealed(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-300 dark:hover:bg-brand-950"
            aria-expanded={reasoningRevealed}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            Reveal suggested reasoning
          </button>
        </div>

        {feedback && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {feedback.summary}
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-950 dark:text-amber-100">
              {feedback.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        {diagnosisRevealed && (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-300" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Likely diagnosis / linked condition
                </p>
                <p className="mt-1 text-sm leading-6 text-green-900 dark:text-green-100">
                  {conditionLabel || actualTitle || 'Compare your hypothesis with the reasoning below.'}
                </p>
                {actualTitle && conditionLabel && actualTitle !== conditionLabel && (
                  <p className="mt-1 text-xs text-green-800 dark:text-green-200">
                    Case title: {actualTitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!reasoningRevealed && (
          <div className="mt-5 rounded-lg border border-dashed border-surface-300 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-300">
            <p className="font-semibold text-surface-800 dark:text-surface-100">
              Continue learning
            </p>
            <p className="mt-1">
              Reveal the suggested reasoning when you are ready to compare your notes with the case.
            </p>
          </div>
        )}
      </section>

      {reasoningRevealed && (
        <div id="case-learning-content" className="scroll-mt-24">
          <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Continue learning
            </p>
            <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">
              Work through the prompts below and open each comparison panel when you are ready.
            </p>
          </div>
          {children}
        </div>
      )}
    </>
  )
}

function buildFeedback(
  config: EnhancedReasoningFeedbackConfig,
  responses: ReasoningResponses,
): { summary: string; points: string[] } {
  const combinedClinicalReasoning = `${responses.hypothesis} ${responses.supportingFeatures}`
  const hasHypothesis = hasAnyConcept(combinedClinicalReasoning, config.conceptGroups.hypothesis)
  const hasSupportingFeatures = hasAnyConcept(combinedClinicalReasoning, config.conceptGroups.supportingFeatures)
  const hasSafety = hasAnyConcept(responses.safetyFeatures, config.conceptGroups.cautionSafety)
  const hasNextAssessment = hasAnyConcept(responses.nextAssessment, config.conceptGroups.nextAssessment)
  const hasLocalOnlyPattern = hasAnyConcept(
    combinedClinicalReasoning,
    config.conceptGroups.localOnlyPattern ?? [],
  )
  const answerLength = Object.values(responses).join(' ').trim().length
  const points: string[] = []

  let summary = 'Consider revisiting'

  if (answerLength < 24) {
    points.push(
      'Consider being more specific: name the symptom distribution, objective signs, and what would change your management.',
    )
  } else if (hasHypothesis && hasSupportingFeatures) {
    summary = 'Strong reasoning'
    points.push(
      'Strong reasoning - you are linking the arm symptoms to a neurological pattern rather than treating them as isolated local pain.',
    )
  } else if (hasHypothesis || hasSupportingFeatures) {
    summary = 'Partially on track'
    points.push(
      'Partially on track - you have noticed a neurological cue, so make the pattern explicit and connect it to the objective findings.',
    )
  } else if (hasLocalOnlyPattern) {
    summary = 'Partially on track'
    points.push(
      'Partially on track - local shoulder or arm pathology can be relevant, but this presentation includes distribution and neurological findings that need a source beyond isolated local pain.',
    )
  } else {
    points.push(
      'Consider revisiting the distribution, sensory/reflex/strength findings, and whether the symptoms behave like a neurological pattern.',
    )
  }

  if (hasSafety) {
    points.push(
      'Good safety thinking - you are checking for features that would change urgency or referral decisions before routine management.',
    )
  } else {
    points.push(
      'Safety point missing - before routine management, screen for cord involvement, progressive neurological deficit, and systemic red flags.',
    )
  }

  if (hasNextAssessment) {
    points.push(
      'Your next-step plan is useful because it includes objective neurological testing or symptom-modification tests to check the pattern.',
    )
  } else {
    points.push(
      'For assessment, name the specific neurological screen or symptom-modification tests you would use next.',
    )
  }

  return { summary, points }
}

function hasAnyConcept(text: string, concepts: string[]): boolean {
  const normalizedText = normalizeText(text)
  return concepts.some((concept) => normalizedText.includes(normalizeText(concept)))
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/neurone/g, 'neuron')
    .replace(/paraesthesia/g, 'paresthesia')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
