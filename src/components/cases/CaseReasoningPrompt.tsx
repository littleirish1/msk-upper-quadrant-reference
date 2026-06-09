'use client'

import { useState } from 'react'
import { CheckCircle2, Eye, Lightbulb } from 'lucide-react'

interface CaseReasoningPromptProps {
  displayTitle: string
  actualTitle?: string
  conditionLabel?: string
}

export function CaseReasoningPrompt({
  displayTitle,
  actualTitle,
  conditionLabel,
}: CaseReasoningPromptProps) {
  const [revealed, setRevealed] = useState(false)

  return (
    <section className="mb-8 rounded-xl border border-brand-200 bg-white p-5 shadow-sm dark:border-brand-800 dark:bg-surface-900">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <Lightbulb className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Before you reveal the likely diagnosis
          </p>
          <h2 className="mt-1 text-lg font-semibold text-surface-900 dark:text-surface-50">
            {displayTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">
            Pause on the presentation first. Use the prompts below to commit to your reasoning,
            then reveal the suggested diagnosis cue.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Leading hypothesis
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
            placeholder="What is your leading clinical hypothesis?"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Two supporting features
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
            placeholder="Which findings support it?"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
            Two alternatives or cautions
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
            placeholder="What else must stay on the table?"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:bg-brand-500 dark:hover:bg-brand-600"
        aria-expanded={revealed}
      >
        <Eye className="h-4 w-4" aria-hidden />
        Reveal likely diagnosis cue
      </button>

      {revealed && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-300" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                Suggested diagnosis cue
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
    </section>
  )
}
