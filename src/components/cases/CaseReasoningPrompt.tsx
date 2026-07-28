'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, CheckCircle2, Eye, Lightbulb } from 'lucide-react'

type ReflectionField = 'hypothesis' | 'supportingFeatures' | 'safetyFeatures' | 'nextAssessment'

interface ReasoningResponses {
  hypothesis: string
  supportingFeatures: string
  safetyFeatures: string
  nextAssessment: string
}

interface ReflectionPromptConfig {
  field: ReflectionField
  label: string
  placeholder: string
  feedbackTitle: string
  feedback: string
  checklist: string[]
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

const REFLECTION_PROMPTS: ReflectionPromptConfig[] = [
  {
    field: 'hypothesis',
    label: 'Leading hypothesis',
    placeholder: 'What is your leading clinical hypothesis?',
    feedbackTitle: 'Model reasoning prompt',
    feedback:
      'Compare your response against the checklist below without confirming the final answer.',
    checklist: [
      'States a working hypothesis without treating it as final.',
      'Includes symptom area, behaviour, time course, mechanism, or risk context.',
      'Keeps at least one plausible alternative explanation open.',
    ],
  },
  {
    field: 'supportingFeatures',
    label: 'Two supporting features',
    placeholder: 'Which findings support it?',
    feedbackTitle: 'Model reasoning prompt',
    feedback:
      'Compare your response against the checklist below without confirming the final answer.',
    checklist: [
      'Uses details from the case presentation rather than generic pattern recognition.',
      'Links each feature to why it changes probability.',
      'Separates strong supporting features from weak or tempting cues.',
    ],
  },
  {
    field: 'safetyFeatures',
    label: 'Two caution/safety features',
    placeholder: 'What red flags, cautions, or alternative explanations must stay on the table?',
    feedbackTitle: 'Model reasoning prompt',
    feedback:
      'Compare your response against the checklist below without confirming the final answer.',
    checklist: [
      'Names features that would change urgency, referral, or scope of practice.',
      'Considers serious pathology, progressive neurological change, systemic features, or non-MSK explanations where relevant.',
      'States what finding would stop routine MSK management.',
    ],
  },
  {
    field: 'nextAssessment',
    label: 'What would you assess next?',
    placeholder: 'Which tests, screens, or questions would you prioritise?',
    feedbackTitle: 'Model reasoning prompt',
    feedback:
      'Compare your response against the checklist below without confirming the final answer.',
    checklist: [
      'Prioritises tests or questions that test the working hypothesis.',
      'Includes safety screening before routine treatment decisions.',
      'States what each assessment step would help you decide.',
    ],
  },
]

interface CaseReasoningPromptProps {
  displayTitle: string
  actualTitle?: string
  conditionLabel?: string
  conditionHref?: string
  enhancedFeedback?: EnhancedReasoningFeedbackConfig
  children: ReactNode
}

export function CaseReasoningPrompt({
  displayTitle,
  actualTitle,
  conditionLabel,
  conditionHref,
  enhancedFeedback,
  children,
}: CaseReasoningPromptProps) {
  const [diagnosisRevealed, setDiagnosisRevealed] = useState(false)
  const [reasoningRevealed, setReasoningRevealed] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
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

  function toggleChecklistItem(field: ReflectionField, index: number) {
    const key = `${field}-${index}`
    setCheckedItems((current) => ({
      ...current,
      [key]: !current[key],
    }))
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
          {REFLECTION_PROMPTS.map((prompt) => {
            const feedbackId = `field-feedback-${prompt.field}`
            const feedbackSummaryId = `field-feedback-summary-${prompt.field}`

            return (
              <div
                key={prompt.field}
                className="rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-800 dark:bg-surface-950"
              >
                <label className="block">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {prompt.label}
                  </span>
                  <textarea
                    value={responses[prompt.field]}
                    onChange={(event) => updateResponse(prompt.field, event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
                    placeholder={prompt.placeholder}
                  />
                </label>

                <details
                  data-reasoning-feedback={prompt.field}
                  className="group mt-3"
                >
                  <summary
                    id={feedbackSummaryId}
                    className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-700 transition marker:content-none hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-brand-600 dark:hover:text-brand-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Model reasoning checklist
                    <span className="sr-only"> for {prompt.label}</span>
                  </summary>
                  <div
                    id={feedbackId}
                    aria-labelledby={feedbackSummaryId}
                    className="mt-3 rounded-lg border border-brand-100 bg-white p-3 text-sm leading-6 text-surface-700 dark:border-brand-900 dark:bg-surface-900 dark:text-surface-300"
                  >
                    <p className="font-semibold text-surface-900 dark:text-surface-100">
                      {prompt.feedbackTitle}
                    </p>
                    <p className="mt-1">
                      {prompt.feedback}
                    </p>
                    <fieldset className="mt-3 space-y-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        Check against your response
                      </legend>
                      {prompt.checklist.map((item, index) => {
                        const key = `${prompt.field}-${index}`

                        return (
                          <label
                            key={item}
                            className="flex cursor-pointer items-start gap-2 rounded-md border border-surface-100 bg-surface-50 px-2.5 py-2 text-sm leading-5 transition hover:border-brand-200 dark:border-surface-800 dark:bg-surface-950 dark:hover:border-brand-800"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(checkedItems[key])}
                              onChange={() => toggleChecklistItem(prompt.field, index)}
                              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 dark:border-surface-600 dark:bg-surface-900"
                            />
                            <span>{item}</span>
                          </label>
                        )
                      })}
                    </fieldset>
                  </div>
                </details>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {enhancedFeedback && (
            <button
              type="button"
              onClick={() => setFeedbackChecked(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Check my reasoning
            </button>
          )}

          <button
            type="button"
            onClick={() => setDiagnosisRevealed(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:bg-brand-500 dark:hover:bg-brand-600"
            aria-expanded={diagnosisRevealed}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Reveal likely diagnosis / linked condition
          </button>

          <button
            type="button"
            onClick={() => setReasoningRevealed((current) => !current)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-300 dark:hover:bg-brand-950"
            aria-expanded={reasoningRevealed}
            aria-controls="case-learning-content"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            {reasoningRevealed ? 'Hide suggested reasoning' : 'Reveal suggested reasoning'}
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
                {conditionHref && (
                  <Link
                    href={conditionHref}
                    className="mt-3 inline-flex rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                  >
                    Open linked condition reference
                  </Link>
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
