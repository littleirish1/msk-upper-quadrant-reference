'use client'

import { useRef, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'

interface Candidate {
  id: number
  label: string
  supporting: string
  contradicting: string
  cannotMiss: boolean
}

export function DifferentialDiagnosisBuilder() {
  const nextId = useRef(2)
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: 1, label: '', supporting: '', contradicting: '', cannotMiss: false },
  ])

  function update(id: number, patch: Partial<Candidate>) {
    setCandidates((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  function addCandidate() {
    const id = nextId.current++
    setCandidates((items) => [...items, { id, label: '', supporting: '', contradicting: '', cannotMiss: false }])
  }

  function reset() {
    nextId.current = 2
    setCandidates([{ id: 1, label: '', supporting: '', contradicting: '', cannotMiss: false }])
  }

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900 sm:p-6" aria-labelledby="differential-builder-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="differential-builder-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">Differential Diagnosis Builder</h2>
          <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300">Rank by position, record both sides of the argument, and mark cannot-miss considerations. No recommendation is generated.</p>
        </div>
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-surface-200 px-3 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-surface-200">
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </button>
      </div>

      <ol className="mt-5 space-y-4">
        {candidates.map((candidate, index) => (
          <li key={candidate.id} className="rounded-md border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-950">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-100">{index + 1}</span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Candidate explanation {index + 1}</span>
                <input value={candidate.label} onChange={(event) => update(candidate.id, { label: event.target.value })} className="min-h-11 w-full rounded-md border border-surface-300 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-900" placeholder="Candidate explanation" />
              </label>
              <button type="button" aria-label={`Remove candidate ${index + 1}`} disabled={candidates.length === 1} onClick={() => setCandidates((items) => items.filter((item) => item.id !== candidate.id))} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100 disabled:opacity-30 dark:hover:bg-surface-800">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Supporting features
                <textarea value={candidate.supporting} onChange={(event) => update(candidate.id, { supporting: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
              </label>
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Contradicting features
                <textarea value={candidate.contradicting} onChange={(event) => update(candidate.id, { contradicting: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900" />
              </label>
            </div>
            <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
              <input type="checkbox" checked={candidate.cannotMiss} onChange={(event) => update(candidate.id, { cannotMiss: event.target.checked })} className="h-4 w-4 rounded border-surface-300 text-brand-600" />
              Cannot-miss consideration
            </label>
          </li>
        ))}
      </ol>
      <button type="button" onClick={addCandidate} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-brand-300 px-4 text-sm font-semibold text-brand-700 dark:border-brand-700 dark:text-brand-300">
        <Plus className="h-4 w-4" aria-hidden /> Add candidate
      </button>
    </section>
  )
}
