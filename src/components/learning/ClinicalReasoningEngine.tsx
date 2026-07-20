'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, Printer, RotateCcw } from 'lucide-react'

const steps = [
  { id: 'presentation', title: 'Initial presentation', prompt: 'Begin with a reviewed, diagnosis-neutral case presentation.', kind: 'information' },
  { id: 'differential', title: 'Differential', prompt: 'What explanations would you keep in the differential at this point?', kind: 'response' },
  { id: 'justification', title: 'Justification', prompt: 'What supports and contradicts your current leading explanation?', kind: 'response' },
  { id: 'history', title: 'Additional history', prompt: 'Reveal additional case-authored history.', kind: 'reveal' },
  { id: 'safety', title: 'Safety considerations', prompt: 'What cannot-miss or escalation considerations need to remain active?', kind: 'response' },
  { id: 'examination', title: 'Examination planning', prompt: 'What would you assess next, and what decision would each item inform?', kind: 'response' },
  { id: 'findings', title: 'Findings', prompt: 'Reveal case-authored examination findings.', kind: 'reveal' },
  { id: 'investigation', title: 'Investigation decision', prompt: 'Would investigation or referral be required, and why?', kind: 'response' },
  { id: 'management', title: 'Management plan', prompt: 'Outline a proportionate plan and review points.', kind: 'response' },
  { id: 'communication', title: 'Patient explanation', prompt: 'How would you explain the working plan without overstating certainty?', kind: 'response' },
  { id: 'comparison', title: 'Expert comparison', prompt: 'Compare your process with reviewed case reasoning.', kind: 'comparison' },
  { id: 'reflection', title: 'Reflection', prompt: 'What changed in your reasoning, and what would you do differently next time?', kind: 'response' },
] as const

export function ClinicalReasoningEngine() {
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const step = steps[index]
  const progress = Math.round(((index + 1) / steps.length) * 100)
  const completed = useMemo(
    () => steps.filter((item) => responses[item.id]?.trim() || revealed[item.id] || item.kind === 'information').length,
    [responses, revealed],
  )

  function reset() {
    setIndex(0)
    setResponses({})
    setRevealed({})
  }

  return (
    <section className="rounded-lg border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-800 dark:bg-surface-900 sm:p-6" aria-labelledby="reasoning-engine-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Static prototype</p>
          <h2 id="reasoning-engine-heading" className="mt-1 text-xl font-semibold text-surface-900 dark:text-surface-50">Clinical Reasoning Engine v1</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-600 dark:text-surface-300">Answers stay in memory for this page only. They are not saved, sent, or scored.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 hover:border-brand-300 dark:border-surface-700 dark:text-surface-200">
            <Printer className="h-4 w-4" aria-hidden /> Print
          </button>
          <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 hover:border-brand-300 dark:border-surface-700 dark:text-surface-200">
            <RotateCcw className="h-4 w-4" aria-hidden /> Reset
          </button>
        </div>
      </div>

      <div className="mt-5" aria-label={`Step ${index + 1} of ${steps.length}; ${completed} completed`}>
        <div className="flex items-center justify-between text-xs font-semibold text-surface-500 dark:text-surface-400">
          <span>Step {index + 1} of {steps.length}</span><span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
          <div className="h-full bg-brand-600 transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{step.title}</h3>
        <p className="mt-2 text-sm leading-6 text-surface-700 dark:text-surface-300">{step.prompt}</p>

        {step.kind === 'information' && (
          <p className="mt-4 rounded-md border border-dashed border-surface-300 bg-white p-4 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300">
            A reviewed guided case supplies the neutral presentation here. This mechanics demo deliberately contains no clinical answer.
          </p>
        )}

        {step.kind === 'response' && (
          <label className="mt-4 block">
            <span className="sr-only">Response for {step.title}</span>
            <textarea
              value={responses[step.id] ?? ''}
              onChange={(event) => setResponses((current) => ({ ...current, [step.id]: event.target.value }))}
              className="min-h-32 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
              placeholder="Record your reasoning. This text is not saved."
            />
          </label>
        )}

        {step.kind === 'reveal' && (
          <div className="mt-4">
            <button
              type="button"
              aria-expanded={Boolean(revealed[step.id])}
              onClick={() => setRevealed((current) => ({ ...current, [step.id]: !current[step.id] }))}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Eye className="h-4 w-4" aria-hidden /> {revealed[step.id] ? 'Hide authored information' : 'Reveal authored information'}
            </button>
            {revealed[step.id] && (
              <p className="mt-3 rounded-md border border-brand-200 bg-white p-4 text-sm leading-6 text-surface-700 dark:border-brand-800 dark:bg-surface-900 dark:text-surface-300">
                Case-specific information appears only when an approved case opts into this engine. No clinical finding is invented by the component.
              </p>
            )}
          </div>
        )}

        {step.kind === 'comparison' && (
          <ul className="mt-4 space-y-2 text-sm leading-6 text-surface-700 dark:text-surface-300">
            <li>Did you update your differential as information changed?</li>
            <li>Did you keep safety and scope-of-practice decisions explicit?</li>
            <li>Did your examination and plan connect to decisions rather than a checklist alone?</li>
            <li>Case-specific expert reasoning remains reveal-gated in the guided case.</li>
          </ul>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 print:hidden">
        <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 disabled:opacity-40 dark:border-surface-700 dark:text-surface-200">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
        </button>
        <button type="button" disabled={index === steps.length - 1} onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
          Next <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">Now showing {step.title}</p>
    </section>
  )
}
