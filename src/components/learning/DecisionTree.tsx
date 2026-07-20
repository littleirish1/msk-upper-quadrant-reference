'use client'

import { useState } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'

const nodes = {
  start: { type: 'decision', text: 'Have immediate safety concerns been identified?', options: [{ label: 'Yes', next: 'escalate' }, { label: 'No', next: 'continue' }] },
  escalate: { type: 'caution', text: 'Use the reviewed local escalation pathway. This prototype does not prescribe a pathway.', options: [] },
  continue: { type: 'information', text: 'Continue the structured assessment and keep safety under review as information changes.', options: [] },
} as const

type NodeId = keyof typeof nodes

export function DecisionTree() {
  const [current, setCurrent] = useState<NodeId>('start')
  const node = nodes[current]

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900 sm:p-6" aria-labelledby="decision-tree-heading">
      <h2 id="decision-tree-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">Decision-tree framework</h2>
      <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300">A non-diagnostic demonstration of decision, caution, and information nodes.</p>
      <div className={`mt-5 rounded-md border p-5 ${node.type === 'caution' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-950'}`}>
        {node.type === 'caution' && <ShieldAlert className="mb-3 h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden />}
        <p className="font-semibold leading-7 text-surface-900 dark:text-surface-50">{node.text}</p>
        {node.options.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {node.options.map((option) => (
              <button key={option.label} type="button" onClick={() => setCurrent(option.next)} className="min-h-10 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">{option.label}</button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setCurrent('start')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-surface-200">
        <RotateCcw className="h-4 w-4" aria-hidden /> Reset path
      </button>
      <div className="sr-only" aria-live="polite">{node.text}</div>
    </section>
  )
}
