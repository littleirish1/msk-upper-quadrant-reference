'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Eye, MessageSquareText, ShieldAlert } from 'lucide-react'

type QuestionCategory = 'MSK pattern' | 'Symptom behaviour' | 'Safety screening' | 'Risk profile'

interface ConversationQuestion {
  id: string
  category: QuestionCategory
  question: string
  response: string
  flags?: Array<'red-herring' | 'safety' | 'non-mechanical' | 'risk'>
}

interface ReflectionState {
  hypothesis: string
  changedReasoning: string
  nextStep: string
}

const questions: ConversationQuestion[] = [
  {
    id: 'location',
    category: 'MSK pattern',
    question: 'Can you point to the pain?',
    response:
      'It is mostly between my left shoulder blade and spine, but sometimes it feels like a tight band around the front of my chest.',
    flags: ['non-mechanical'],
  },
  {
    id: 'desk',
    category: 'MSK pattern',
    question: 'Have posture, desk work, or lifting made it worse?',
    response:
      'I have been hunched over year-end accounts, and my upper back does feel tight after long days. I assumed that was the cause.',
    flags: ['red-herring'],
  },
  {
    id: 'movement',
    category: 'Symptom behaviour',
    question: 'Does spinal movement or shoulder movement reproduce it?',
    response:
      'Twisting and reaching feel stiff, but they do not reliably bring on the same deep ache. Pressing the area feels tender but not like the main symptom.',
    flags: ['non-mechanical'],
  },
  {
    id: 'exertion',
    category: 'Symptom behaviour',
    question: 'What were you doing when it started, and does exertion affect it?',
    response:
      'The first stronger episode came while walking uphill from the car park. It eased after I stopped for a few minutes. A lighter version happened again on stairs.',
    flags: ['safety', 'non-mechanical'],
  },
  {
    id: 'chest-symptoms',
    category: 'Safety screening',
    question: 'Any chest pressure, sweating, nausea, dizziness, or breathlessness?',
    response:
      'During the uphill episode I felt a heavy pressure across the front of my chest, a bit clammy, and slightly nauseous. I would not call it sharp chest pain.',
    flags: ['safety', 'non-mechanical'],
  },
  {
    id: 'pulmonary',
    category: 'Safety screening',
    question: 'Any recent infection, cough, calf pain, or pain on deep breathing?',
    response:
      'No cough, fever, calf pain, or sharp pain with deep breaths.',
    flags: ['safety'],
  },
  {
    id: 'systemic',
    category: 'Safety screening',
    question: 'Any unexplained weight loss, night sweats, fever, or constant night pain?',
    response:
      'No fever, night sweats, or weight loss. It has woken me once, but mainly because I was worried after the chest tightness.',
    flags: ['safety'],
  },
  {
    id: 'risk-profile',
    category: 'Risk profile',
    question: 'Any history of cardiac disease, smoking, diabetes, high blood pressure, or family history?',
    response:
      'I take tablets for high blood pressure, my cholesterol was high last year, and my father had a heart attack in his late 50s. I stopped smoking ten years ago.',
    flags: ['risk', 'safety'],
  },
]

const categoryOrder: QuestionCategory[] = [
  'MSK pattern',
  'Symptom behaviour',
  'Safety screening',
  'Risk profile',
]

export function ConversationCase() {
  const [askedIds, setAskedIds] = useState<string[]>([])
  const [reflection, setReflection] = useState<ReflectionState>({
    hypothesis: '',
    changedReasoning: '',
    nextStep: '',
  })
  const [revealed, setRevealed] = useState(false)

  const askedQuestions = askedIds
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is ConversationQuestion => Boolean(question))

  const checks = useMemo(() => {
    const flags = askedQuestions.flatMap((question) => question.flags ?? [])
    const nextStep = normalize(reflection.nextStep)

    return [
      {
        label: 'MSK red herring identified',
        met: flags.includes('red-herring'),
        feedback: flags.includes('red-herring')
          ? 'Good - you found the plausible MSK story without stopping there.'
          : 'Ask about posture, loading, or local tenderness to identify the tempting MSK explanation.',
      },
      {
        label: 'Safety question asked',
        met: flags.includes('safety'),
        feedback: flags.includes('safety')
          ? 'Good - you asked a safety question that changes the risk profile.'
          : 'You have not yet asked about systemic or cardiopulmonary features.',
      },
      {
        label: 'Non-mechanical pattern identified',
        met: flags.includes('non-mechanical'),
        feedback: flags.includes('non-mechanical')
          ? 'Good - you found symptoms that are not fully reproduced by MSK testing.'
          : 'The MSK explanation is possible, but the symptom behaviour still needs testing.',
      },
      {
        label: 'Safe escalation/referral considered',
        met: ['refer', 'urgent', 'same day', 'gp', 'ed', 'emergency', 'medical'].some((term) =>
          nextStep.includes(term),
        ),
        feedback: ['refer', 'urgent', 'same day', 'gp', 'ed', 'emergency', 'medical'].some((term) =>
          nextStep.includes(term),
        )
          ? 'Good - your next step recognises that routine MSK care is not the safest first pathway.'
          : 'Before routine MSK treatment, state what medical review or escalation pathway you would use.',
      },
    ]
  }, [askedQuestions, reflection.nextStep])

  function askQuestion(id: string) {
    setAskedIds((current) => current.includes(id) ? current : [...current, id])
  }

  function updateReflection(field: keyof ReflectionState, value: string) {
    setReflection((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-fit rounded-lg bg-white p-2 text-amber-700 dark:bg-surface-900 dark:text-amber-300">
          <MessageSquareText className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-100">
            Conversation reasoning preview
          </p>
          <h2 className="mt-3 text-lg font-semibold text-surface-900 dark:text-surface-50">
            Ask targeted questions before deciding what this is
          </h2>
          <p className="mt-2 text-sm leading-6 text-surface-700 dark:text-surface-300">
            The patient starts with a plausible MSK story. Select questions to uncover
            which details support that story and which details should change your risk
            assessment. Nothing is scored or saved.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-surface-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Patient opening statement
        </p>
        <p className="mt-2 text-sm leading-6 text-surface-700 dark:text-surface-300">
          "I thought this was just my upper back from work. It sits around my left
          shoulder blade and sometimes around the front of my chest. It has happened
          a few times now, and one episode made me stop walking because it felt
          heavier than normal back tightness."
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
              Scripted question bank
            </h3>
            <p className="mt-1 text-xs leading-5 text-surface-600 dark:text-surface-400">
              Choose targeted questions. Responses are fixed for this teaching case, not live AI.
            </p>
          </div>

          {categoryOrder.map((category) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                {category}
              </h4>
              <div className="mt-2 space-y-2">
                {questions
                  .filter((question) => question.category === category)
                  .map((question) => {
                    const asked = askedIds.includes(question.id)

                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => askQuestion(question.id)}
                        disabled={asked}
                        aria-pressed={asked}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-surface-200 bg-white px-3 py-2 text-left text-sm font-medium text-surface-700 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-default disabled:border-amber-200 disabled:bg-amber-100 disabled:text-amber-900 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-amber-700 dark:hover:bg-amber-950 dark:disabled:border-amber-800 dark:disabled:bg-amber-950 dark:disabled:text-amber-100"
                      >
                        <span>{question.question}</span>
                        <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:bg-surface-800 dark:text-surface-300">
                          {asked ? 'Asked' : 'Ask'}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
            Conversation feed
          </h3>
          <p className="mt-1 text-xs leading-5 text-surface-600 dark:text-surface-400">
            Each learner question adds a patient response to the thread.
          </p>
          {askedQuestions.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-surface-300 bg-white p-4 text-sm text-surface-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400">
              Choose a question to begin. Try asking both MSK-pattern questions and
              safety questions before deciding.
            </div>
          ) : (
            <div className="mt-3 space-y-4 rounded-xl border border-surface-200 bg-surface-50 p-3 dark:border-surface-800 dark:bg-surface-950">
              {askedQuestions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-white shadow-sm sm:max-w-[78%]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-100">
                      You asked
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6">
                      {question.question}
                    </p>
                  </div>

                  <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md border border-surface-200 bg-white px-4 py-3 shadow-sm dark:border-surface-800 dark:bg-surface-900 sm:max-w-[84%]">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Patient response
                    </p>
                    <p className="mt-1 text-sm leading-6 text-surface-700 dark:text-surface-300">
                      {question.response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {askedQuestions.length >= 3 && (
        <div className="mt-5 rounded-lg border border-brand-200 bg-white p-4 dark:border-brand-800 dark:bg-surface-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                Reasoning checkpoint
              </h3>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    Working hypothesis now
                  </span>
                  <textarea
                    value={reflection.hypothesis}
                    onChange={(event) => updateReflection('hypothesis', event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    What changed your reasoning?
                  </span>
                  <textarea
                    value={reflection.changedReasoning}
                    onChange={(event) => updateReflection('changedReasoning', event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    What would you do next?
                  </span>
                  <textarea
                    value={reflection.nextStep}
                    onChange={(event) => updateReflection('nextStep', event.target.value)}
                    className="mt-2 min-h-24 w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100 dark:focus:border-brand-500 dark:focus:bg-surface-900 dark:focus:ring-brand-950"
                  />
                </label>
              </div>

              <ul className="mt-4 space-y-2">
                {checks.map((check) => (
                  <li key={check.label} className="flex gap-2 text-sm leading-6 text-surface-700 dark:text-surface-300">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${check.met ? 'text-green-600 dark:text-green-300' : 'text-surface-300 dark:text-surface-600'}`}
                      aria-hidden
                    />
                    <span>
                      <span className="font-semibold">{check.label}: </span>
                      {check.feedback}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:bg-brand-500 dark:hover:bg-brand-600"
        aria-expanded={revealed}
      >
        <Eye className="h-4 w-4" aria-hidden />
        Reveal likely concern / linked condition
      </button>

      {revealed && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-sm font-semibold text-green-900 dark:text-green-100">
            Likely concern / linked condition
          </p>
          <p className="mt-2 text-sm leading-6 text-green-900 dark:text-green-100">
            This pattern raises concern for possible cardiac-related referred pain
            presenting as thoracic or scapular discomfort. It is not safe to manage
            as routine MSK pain until urgent medical screening has excluded a time-sensitive
            cardiopulmonary cause.
          </p>
          <p className="mt-2 text-sm leading-6 text-green-900 dark:text-green-100">
            The key shift is not a confirmed diagnosis. It is the combination of exertional
            symptoms, chest pressure, nausea/clamminess, cardiovascular risk factors,
            and poor mechanical reproduction.
          </p>
        </div>
      )}
    </section>
  )
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
