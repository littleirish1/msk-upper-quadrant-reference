import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  FileSearch,
  Lock,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react'

const workingNow = [
  'Public learner site',
  'Guided case pages',
  '6 published cases',
  '3 private/draft cases excluded',
  'Neutral case labels',
  'Reveal-based diagnosis flow',
  'Route and source checks',
  'Local Case Manager prototype',
]

const plannedNext = [
  'Conversation-style cases',
  'Contextual feedback preview',
  'Local AI script-maker',
  'PowerPoint and paper import',
  'RAG/vector search',
  'Whole-body expansion',
  'Shared admin/review workflow',
]

const roadmapSections = [
  {
    title: 'Interactive reasoning cases',
    icon: Brain,
    description:
      'Cases can use neutral titles, hidden diagnosis cues, learner hypotheses, supporting features, safety cautions, staged reveals, and contextual self-check feedback.',
  },
  {
    title: 'Conversation-style case studies',
    icon: MessageSquareText,
    description:
      'Future cases can add scripted patient interaction, red herrings, hidden information unlocked by targeted questions, and safety questions that change the case direction.',
  },
  {
    title: 'Local AI script-maker / case-builder',
    icon: Sparkles,
    description:
      'AI should support local back-office drafting of patient scripts, distractors, MCQs, feedback, and reveal stages. Generated clinical content remains draft until approved.',
  },
  {
    title: 'Source-informed growth',
    icon: FileSearch,
    description:
      'Future imports can include PowerPoints, papers/PDFs, evidence notes, legacy station banks, guideline summaries, and case MDX linked to source IDs, paths, review state, and citation notes.',
  },
  {
    title: 'RAG/vector search later',
    icon: Network,
    description:
      'Retrieval is not required for the Friday demo, but it can help once the source library grows. Early options include a local index, then Chroma, then pgvector or Supabase later.',
  },
  {
    title: 'Whole-body physiotherapy expansion',
    icon: Stethoscope,
    description:
      'The current upper-quadrant work is Phase 1. The longer-term platform can expand into lower limb, spine, neuro/MSK overlap, rheumatology screening, persistent pain, post-op rehab, and return to sport.',
  },
  {
    title: 'Review-first safety model',
    icon: ShieldCheck,
    description:
      'Draft cases do not go public automatically. Hygiene, source, and route checks protect the build while Git remains the audit trail for reviewed changes.',
  },
]

const bodyRegionTags = [
  'cervical',
  'thoracic',
  'shoulder',
  'elbow',
  'wrist/hand',
  'lumbar',
  'pelvis/SIJ',
  'hip/groin',
  'knee',
  'ankle/foot',
  'neuro/MSK overlap',
  'rheumatology/systemic screening',
  'persistent pain',
  'post-op rehab',
  'return to sport',
]

export default function FuturePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Future direction
        </p>
        <div className="mt-3 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50 sm:text-4xl">
            Where the Clinical Reasoning Lab goes next
          </h1>
          <p className="mt-4 text-base leading-7 text-surface-600 dark:text-surface-400 sm:text-lg">
            The current build is a pilot demo showing the learner-facing foundation:
            a public reference site, guided cases, diagnosis-hidden reasoning flow,
            staged reveal, source and review safety checks, and a local-only admin direction.
            This is not yet the final product; it is the foundation.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-surface-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-brand-600 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Demo
          </Link>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            View Cases
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="mb-10 rounded-xl border border-accent-200 bg-accent-50 p-6 dark:border-accent-900 dark:bg-surface-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-fit rounded-lg bg-white p-2 text-accent-700 dark:bg-surface-800 dark:text-accent-300">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-accent-900 dark:text-accent-300">
              Demo message
            </h2>
            <p className="mt-2 text-sm leading-6 text-surface-700 dark:text-surface-300">
              Friday demo focus: this site demonstrates the learner-facing foundation.
              The future architecture is designed to turn teaching slides, papers, and
              reviewed cases into interactive reasoning experiences, but only after
              human review.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="now-next-heading" className="mb-10">
        <h2 id="now-next-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          What is working now vs planned next
        </h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <article className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Working now
              </h3>
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-surface-600 dark:text-surface-400 sm:grid-cols-2">
              {workingNow.map((item) => (
                <li key={item} className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-950">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                Planned next
              </h3>
            </div>
            <ul className="mt-4 grid gap-2 text-sm text-surface-600 dark:text-surface-400 sm:grid-cols-2">
              {plannedNext.map((item) => (
                <li key={item} className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-950">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section aria-labelledby="roadmap-heading" className="mb-10">
        <h2 id="roadmap-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Roadmap themes
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roadmapSections.map((section) => {
            const Icon = section.icon

            return (
              <article
                key={section.title}
                className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-surface-900 dark:text-surface-50">
                  {section.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">
                  {section.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mb-10 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-start gap-3">
            <Database className="mt-1 h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
                Source traceability
              </h2>
              <p className="mt-3 text-sm leading-6 text-surface-600 dark:text-surface-400">
                Future source growth should connect imported teaching material, papers,
                evidence notes, guideline summaries, legacy stations, and case MDX back to
                source metadata such as source ID, source path, review status, and citation
                notes. Any generated draft should cite the retrieved sources that shaped it.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
            <div>
              <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
                Local-first AI boundary
              </h2>
              <p className="mt-3 text-sm leading-6 text-surface-600 dark:text-surface-400">
                AI is not being positioned as a free public chatbot. The safer near-term
                role is a local back-office assistant that helps draft scripts, feedback,
                MCQs, and reveal stages for human review before anything is published.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section aria-labelledby="coverage-heading" className="mb-10">
        <h2 id="coverage-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Whole-body physiotherapy scope
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-surface-600 dark:text-surface-400">
          The current upper-quadrant build can become one part of a broader clinical
          reasoning platform covering the presentations physiotherapists assess, triage,
          treat, refer, and educate around.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {bodyRegionTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-600 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-800 dark:bg-brand-950/30">
        <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Review-first publishing
        </h2>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-surface-700 dark:text-surface-300 sm:grid-cols-2 lg:grid-cols-4">
          <p>Draft cases stay private until review is complete.</p>
          <p>Hygiene, source, and route checks protect the public build.</p>
          <p>The local Case Manager supports review without becoming public.</p>
          <p>Future shared admin could use auth, database state, and GitHub PR publishing.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Back to Demo
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            View Cases
          </Link>
        </div>
      </section>
    </div>
  )
}
