'use client'

import { FormEvent, KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react'
import { CaseReasoningPrompt } from './CaseReasoningPrompt'
import {
  answerPatientQuestion,
  createPatientSession,
  reviewConversation,
  type ConversationProjection,
  type PatientSession,
} from '@/lib/clinical-platform/conversation'

type CaseMode = 'guided' | 'conversation' | 'hybrid'

interface Props {
  displayTitle: string
  revealId: string
  caseId: string
  truthHash: string
  conversationAssetPath: string
  enhancedFeedbackAvailable?: boolean
  guidedPresentation?: ReactNode
}

interface Message {
  id: number
  role: 'learner' | 'patient'
  text: string
}

const MODES: Array<{ id: CaseMode; label: string; description: string }> = [
  { id: 'guided', label: 'Guided', description: 'Structured reasoning prompts' },
  { id: 'conversation', label: 'Conversation', description: 'Ask the simulated patient' },
  { id: 'hybrid', label: 'Hybrid', description: 'Conversation plus reasoning support' },
]

const SUGGESTED_QUESTIONS = [
  'Tell me more about what brought you in.',
  'How long has this been happening?',
  'What makes it worse?',
  'What makes it better?',
  'How is this affecting daily activities?',
  'Do you take any medication?',
  'Are there any red flag symptoms?',
]

export function CaseModeExperience({
  displayTitle,
  revealId,
  caseId,
  truthHash,
  conversationAssetPath,
  enhancedFeedbackAvailable = false,
  guidedPresentation,
}: Props) {
  const [mode, setMode] = useState<CaseMode>('guided')
  const [projection, setProjection] = useState<ConversationProjection | null>(null)
  const [session, setSession] = useState<PatientSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [composer, setComposer] = useState('')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadError, setLoadError] = useState('')
  const [hintUsed, setHintUsed] = useState(false)
  const [sessionSeed, setSessionSeed] = useState(1)
  const [notebook, setNotebook] = useState({ hypothesis: '', differentials: '', safety: '', plan: '' })
  const announcementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode === 'guided' || projection) return
    let cancelled = false
    setLoadState('loading')
    const url = resolveConversationUrl(window.location.pathname, conversationAssetPath)
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Conversation data could not be loaded (${response.status}).`)
        return response.json()
      })
      .then((value) => {
        if (cancelled) return
        const parsed = parseProjection(value, caseId, truthHash)
        setProjection(parsed)
        startSession(parsed, sessionSeed)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Conversation data could not be loaded.')
        setLoadState('error')
      })
    return () => { cancelled = true }
  }, [caseId, conversationAssetPath, mode, projection, sessionSeed, truthHash])

  function startSession(activeProjection: ConversationProjection, seed: number) {
    const next = createPatientSession(activeProjection)
    const opening = activeProjection.items.find((item) => item.id === activeProjection.openingTruthId)?.value
    setSession(next)
    setMessages(opening ? [{ id: seed * 1000, role: 'patient', text: opening }] : [])
    setComposer('')
    setHintUsed(false)
    setNotebook({ hypothesis: '', differentials: '', safety: '', plan: '' })
  }

  function submitQuestion(event: FormEvent) {
    event.preventDefault()
    const question = composer.trim()
    if (!question || !session) return
    const answer = answerPatientQuestion(session, question)
    const base = sessionSeed * 1000 + messages.length + 1
    setMessages((current) => [
      ...current,
      { id: base, role: 'learner', text: question },
      { id: base + 1, role: 'patient', text: answer.response },
    ])
    setComposer('')
  }

  function submitQuestionOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  function askSuggested(question: string) {
    setComposer(question)
  }

  function moveModeFocus(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    const keyTargets: Record<string, number> = {
      ArrowRight: (currentIndex + 1) % MODES.length,
      ArrowLeft: (currentIndex - 1 + MODES.length) % MODES.length,
      Home: 0,
      End: MODES.length - 1,
    }
    const nextIndex = keyTargets[event.key]
    if (nextIndex === undefined) return
    event.preventDefault()
    const nextMode = MODES[nextIndex]
    setMode(nextMode.id)
    document.getElementById(`mode-${nextMode.id}`)?.focus()
  }

  function reset(newSeed: boolean) {
    if (!projection) return
    const nextSeed = newSeed ? sessionSeed + 1 : sessionSeed
    setSessionSeed(nextSeed)
    startSession(projection, nextSeed)
  }

  const tutor = session ? reviewConversation(session.audit) : null
  const askedTurns = session?.audit.length ?? 0

  return (
    <div className="space-y-6">
      <section aria-labelledby="case-mode-heading" className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">Learning mode</p>
            <h2 id="case-mode-heading" className="mt-1 text-xl font-semibold text-surface-950 dark:text-white">Choose how you want to work through this case</h2>
          </div>
          <div role="tablist" aria-label="Case learning mode" className="grid gap-2 sm:grid-cols-3">
            {MODES.map((item, index) => (
              <button
                key={item.id}
                id={`mode-${item.id}`}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                aria-controls={`panel-${item.id}`}
                tabIndex={mode === item.id ? 0 : -1}
                onKeyDown={(event) => moveModeFocus(event, index)}
                onClick={() => setMode(item.id)}
                className={`min-h-12 rounded-xl border px-4 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-400 ${mode === item.id ? 'border-brand-500 bg-brand-50 text-brand-950 dark:bg-brand-950 dark:text-brand-50' : 'border-surface-200 hover:border-brand-300 dark:border-surface-700'}`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block text-xs text-surface-600 dark:text-surface-300">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {mode === 'guided' ? (
        <div id="panel-guided" role="tabpanel" aria-labelledby="mode-guided">
          {guidedPresentation}
          <CaseReasoningPrompt displayTitle={displayTitle} revealId={revealId} enhancedFeedbackAvailable={enhancedFeedbackAvailable} />
        </div>
      ) : (
        <div id={`panel-${mode}`} role="tabpanel" aria-labelledby={`mode-${mode}`} className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
          <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900" aria-labelledby="patient-chat-title">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 bg-surface-50 px-4 py-4 dark:border-surface-800 dark:bg-surface-950 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200"><UserRound className="h-5 w-5" aria-hidden /></span>
                <div><h2 id="patient-chat-title" className="font-semibold">Simulated patient</h2><p className="text-xs text-surface-600 dark:text-surface-300">Grounded in the governed case record · Session {String(sessionSeed).padStart(3, '0')}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => reset(false)} disabled={!projection} className="min-h-11 rounded-lg border border-surface-300 px-3 text-sm font-semibold hover:bg-surface-100 disabled:opacity-50 dark:border-surface-700 dark:hover:bg-surface-800"><RotateCcw className="mr-2 inline h-4 w-4" aria-hidden />Restart same seed</button>
                <button type="button" onClick={() => reset(true)} disabled={!projection} className="min-h-11 rounded-lg border border-surface-300 px-3 text-sm font-semibold hover:bg-surface-100 disabled:opacity-50 dark:border-surface-700 dark:hover:bg-surface-800">New session seed</button>
              </div>
            </header>

            {loadState === 'loading' && <p role="status" className="p-6 text-sm text-surface-600">Loading the governed conversation record…</p>}
            {loadState === 'error' && <div role="alert" className="m-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">{loadError}</div>}
            {loadState === 'ready' && (
              <>
                <div className="max-h-[34rem] min-h-72 space-y-4 overflow-y-auto bg-surface-50/70 p-4 dark:bg-surface-950/50 sm:p-5" aria-label="Patient conversation">
                  {messages.map((message) => (
                    <article key={message.id} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[82%] ${message.role === 'learner' ? 'ml-auto rounded-br-md bg-brand-600 text-white' : 'mr-auto rounded-bl-md border border-surface-200 bg-white text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100'}`}>
                      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${message.role === 'learner' ? 'text-brand-100' : 'text-teal-700 dark:text-teal-300'}`}>{message.role === 'learner' ? 'You' : 'Patient'}</p>
                      <p>{message.text}</p>
                    </article>
                  ))}
                  <div ref={announcementRef} aria-live="polite" className="sr-only">{messages.at(-1)?.role === 'patient' ? messages.at(-1)?.text : ''}</div>
                </div>
                <form onSubmit={submitQuestion} className="border-t border-surface-200 p-4 dark:border-surface-800 sm:p-5">
                  <label htmlFor="patient-question" className="text-sm font-semibold">Ask one focused question</label>
                  <div className="mt-2 flex gap-2">
                    <textarea id="patient-question" value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={submitQuestionOnEnter} enterKeyHint="send" rows={2} maxLength={400} className="min-h-12 flex-1 resize-y rounded-xl border border-surface-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-surface-700 dark:bg-surface-950" placeholder="Ask about the patient’s experience or history…" />
                    <button type="submit" disabled={!composer.trim()} className="min-h-12 self-stretch rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-5 w-5" aria-hidden /><span className="sr-only">Send question</span></button>
                  </div>
                  <p className="mt-2 text-xs text-surface-500">Press Enter to send or Shift+Enter for a new line. Nothing is saved; unavailable information is stated explicitly.</p>
                </form>
              </>
            )}
          </section>

          <aside className="space-y-4" aria-label="Conversation learning support">
            {mode === 'hybrid' && (
              <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand-600" aria-hidden /><h2 className="font-semibold">Suggested domains</h2></div>
                <div className="mt-3 flex flex-wrap gap-2">{SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => askSuggested(question)} className="min-h-11 rounded-full border border-surface-300 px-3 py-2 text-left text-xs font-medium hover:border-brand-400 hover:bg-brand-50 dark:border-surface-700 dark:hover:bg-brand-950">{question}</button>)}</div>
              </section>
            )}

            <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
              <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-teal-600" aria-hidden /><h2 className="font-semibold">Disclosure summary</h2></div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-950"><dt className="text-surface-500">Questions</dt><dd className="mt-1 text-xl font-bold">{askedTurns}</dd></div><div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-950"><dt className="text-surface-500">Facts disclosed</dt><dd className="mt-1 text-xl font-bold">{session?.disclosedTruthIds.size ?? 0}</dd></div></dl>
              <p className="mt-3 text-xs leading-5 text-surface-600 dark:text-surface-300">The summary counts governed truth IDs only. It does not score your performance.</p>
            </section>

            {mode === 'hybrid' && tutor && (
              <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
                <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden /><h2 className="font-semibold">Optional tutor</h2></div>
                <p className="mt-2 text-sm leading-6">{tutor.checkpointFeedback}</p>
                {!hintUsed && tutor.optionalHint && <button type="button" onClick={() => setHintUsed(true)} className="mt-3 min-h-11 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white">Use one hint</button>}
                {hintUsed && tutor.optionalHint && <p className="mt-3 rounded-lg bg-white/80 p-3 text-sm dark:bg-surface-900">{tutor.optionalHint}</p>}
              </section>
            )}
          </aside>
        </div>
      )}

      {mode === 'hybrid' && (
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900" aria-labelledby="reasoning-notebook-title">
          <h2 id="reasoning-notebook-title" className="text-xl font-semibold">Reasoning notebook</h2>
          <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">Private to this browser tab and cleared on restart. It is not assessed or stored.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{([
            ['hypothesis', 'Working hypothesis'], ['differentials', 'Differential comparison'], ['safety', 'Safety and escalation'], ['plan', 'Assessment and management plan'],
          ] as const).map(([field, label]) => <label key={field} className="text-sm font-semibold">{label}<textarea value={notebook[field]} onChange={(event) => setNotebook((current) => ({ ...current, [field]: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-surface-300 bg-white p-3 font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-surface-700 dark:bg-surface-950" /></label>)}</div>
        </section>
      )}

    </div>
  )
}

function resolveConversationUrl(pathname: string, assetPath: string): string {
  const casesIndex = pathname.indexOf('/cases/')
  const basePath = casesIndex >= 0 ? pathname.slice(0, casesIndex) : ''
  return `${basePath}${assetPath}`
}

function parseProjection(value: unknown, expectedCaseId: string, expectedTruthHash: string): ConversationProjection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Conversation record is invalid.')
  const projection = value as ConversationProjection
  if (projection.schemaVersion !== 1 || projection.caseId !== expectedCaseId || projection.truthHash !== expectedTruthHash || !Array.isArray(projection.items)) {
    throw new Error('Conversation record does not match this case revision.')
  }
  if (JSON.stringify(projection).match(/likelyDiagnosis|privateDiagnosticIdentity|condition-link/i)) {
    throw new Error('Conversation record crossed the disclosure boundary.')
  }
  return projection
}
