'use client'

import { useMemo, useState } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'

export interface LearnerBranchChoice {
  id: string
  label: string
  nextNodeId: string
  feedback?: string
}

export interface LearnerBranchNode {
  id: string
  type: 'decision' | 'information' | 'caution' | 'outcome'
  text: string
  options: LearnerBranchChoice[]
}

interface BranchingReasoningEngineProps {
  title: string
  description: string
  startNodeId: string
  nodes: LearnerBranchNode[]
}

export function BranchingReasoningEngine({
  title,
  description,
  startNodeId,
  nodes,
}: BranchingReasoningEngineProps) {
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const [currentId, setCurrentId] = useState(startNodeId)
  const [path, setPath] = useState<string[]>([startNodeId])
  const [feedback, setFeedback] = useState('')
  const node = byId.get(currentId) ?? byId.get(startNodeId)

  if (!node) return null

  function choose(option: LearnerBranchChoice) {
    if (!byId.has(option.nextNodeId)) return
    setFeedback(option.feedback ?? '')
    setCurrentId(option.nextNodeId)
    setPath((current) => [...current, option.nextNodeId])
  }

  function reset() {
    setCurrentId(startNodeId)
    setPath([startNodeId])
    setFeedback('')
  }

  return (
    <section
      className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900 sm:p-6"
      aria-labelledby="branching-reasoning-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="branching-reasoning-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-600 dark:text-surface-300">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-surface-200"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset path
        </button>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase text-surface-500 dark:text-surface-400">
        Step {path.length}
      </p>
      <div
        className={`mt-2 rounded-md border p-5 ${
          node.type === 'caution'
            ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-950'
        }`}
      >
        {node.type === 'caution' && (
          <ShieldAlert className="mb-3 h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden />
        )}
        <p className="font-semibold leading-7 text-surface-900 dark:text-surface-50">{node.text}</p>
        {feedback && (
          <p className="mt-3 rounded-md border border-brand-200 bg-white p-3 text-sm leading-6 text-surface-700 dark:border-brand-800 dark:bg-surface-900 dark:text-surface-300">
            {feedback}
          </p>
        )}
        {node.options.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Available reasoning paths">
            {node.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option)}
                className="min-h-11 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <details className="mt-4 text-sm text-surface-600 dark:text-surface-300">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">Review path taken</summary>
        <ol className="ml-5 list-decimal space-y-1">
          {path.map((id, index) => (
            <li key={`${id}-${index}`}>{byId.get(id)?.text ?? id}</li>
          ))}
        </ol>
      </details>
      <p className="sr-only" aria-live="polite">{node.text}</p>
    </section>
  )
}
