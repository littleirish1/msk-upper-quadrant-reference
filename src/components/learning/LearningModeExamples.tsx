'use client'

import { type KeyboardEvent, useRef, useState } from 'react'

const modes = [
  { id: 'study', label: 'Study', title: 'Study mode', body: 'Browse reviewed references normally, with section navigation and linked learning.' },
  { id: 'osce', label: 'OSCE', title: 'OSCE mode', body: 'Use candidate instructions, an untimed station structure, examiner-domain self-checks, and a model discussion revealed afterward. This is not a formal accreditation tool.' },
  { id: 'viva', label: 'Viva', title: 'Viva mode', body: 'Work through sequential prompts, record a self-reflection, then compare against reviewed expert notes.' },
  { id: 'flashcard', label: 'Flashcard', title: 'Flashcard mode', body: 'Reveal a back only after committing to an answer. Cards must be generated from approved content.' },
  { id: 'quiz', label: 'Quiz', title: 'Quiz mode', body: 'Submit a choice or short answer before seeing an explanation. Scores are not used to claim clinical competence.' },
] as const

export function LearningModeExamples() {
  const [active, setActive] = useState<(typeof modes)[number]['id']>('study')
  const [revealed, setRevealed] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const mode = modes.find((item) => item.id === active) ?? modes[0]

  function selectMode(id: (typeof modes)[number]['id']) {
    setActive(id)
    setRevealed(false)
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % modes.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modes.length) % modes.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = modes.length - 1
    else return

    event.preventDefault()
    selectMode(modes[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900 sm:p-6" aria-labelledby="learning-modes-heading">
      <h2 id="learning-modes-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">Learning modes</h2>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Learning mode examples">
        {modes.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => { tabRefs.current[index] = element }}
            id={`learning-mode-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            aria-controls={`learning-mode-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            onKeyDown={(event) => handleTabKey(event, index)}
            onClick={() => selectMode(item.id)}
            className={`min-h-11 shrink-0 rounded-md px-4 text-sm font-semibold ${active === item.id ? 'bg-brand-600 text-white' : 'border border-surface-200 text-surface-700 dark:border-surface-700 dark:text-surface-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`learning-mode-panel-${mode.id}`}
        className="mt-4 rounded-md bg-surface-50 p-4 dark:bg-surface-950"
        role="tabpanel"
        aria-labelledby={`learning-mode-tab-${mode.id}`}
        tabIndex={0}
      >
        <h3 className="font-semibold text-surface-900 dark:text-surface-50">{mode.title}</h3>
        <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300">{mode.body}</p>
        {mode.id !== 'study' && (
          <>
            <button type="button" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)} className="mt-4 min-h-11 rounded-md border border-brand-300 px-4 text-sm font-semibold text-brand-700 dark:border-brand-700 dark:text-brand-300">{revealed ? 'Hide example feedback' : 'Reveal example feedback'}</button>
            {revealed && <p className="mt-3 rounded-md border border-brand-200 bg-white p-3 text-sm text-surface-700 dark:border-brand-800 dark:bg-surface-900 dark:text-surface-300">Case-specific answers are deliberately absent. Reviewed source content must supply them.</p>}
          </>
        )}
      </div>
    </section>
  )
}
