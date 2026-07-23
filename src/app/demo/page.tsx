import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSearch,
  GitPullRequest,
  Lock,
  Presentation,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react'

const statusCards = [
  {
    title: 'Public learner site',
    status: 'Active',
    description: 'Region pages, condition references, red flags, search, and reviewed guided cases are available for the trial demo.',
    icon: BookOpen,
  },
  {
    title: 'Draft route protection',
    status: 'Active',
    description: 'Draft and archived guided cases are excluded from public case lists and static route generation.',
    icon: ShieldCheck,
  },
  {
    title: 'Source integrity checks',
    status: 'Active',
    description: 'Legacy-derived cases require source metadata, review status, and valid source links before the build can pass.',
    icon: CheckCircle2,
  },
  {
    title: 'Local Case Manager',
    status: 'Prototype/admin-only',
    description: 'The admin workflow runs locally for drafting, previewing, source tracking, and review preparation.',
    icon: Lock,
  },
  {
    title: 'Netlify deployment',
    status: 'Trial build',
    description: 'The public site exports as static files for a controlled deployment trial.',
    icon: Stethoscope,
  },
  {
    title: 'Source registry',
    status: 'Active',
    description: 'Legacy source records are gathered into a deterministic registry for traceability and dashboard summaries.',
    icon: FileSearch,
  },
  {
    title: 'Migration tracker',
    status: 'Metadata-driven',
    description: 'Legacy station status is derived from case metadata rather than a hardcoded content list.',
    icon: GitPullRequest,
  },
  {
    title: 'Whole-body roadmap',
    status: 'Planned',
    description: 'The upper-quadrant build is Phase 1 of a broader physiotherapy clinical reasoning platform.',
    icon: Users,
  },
  {
    title: 'Next steps',
    status: 'PowerPoint + evidence import',
    description: 'The source pipeline is being shaped for teaching decks, papers, and review-first AI assistance.',
    icon: Presentation,
  },
]

const roadmap = [
  {
    title: 'PowerPoint imports',
    description: 'Bring teaching deck material into the same source-tracked review workflow.',
    icon: Presentation,
  },
  {
    title: 'Paper and evidence imports',
    description: 'Connect clinical summaries, references, and reasoning prompts back to evidence sources.',
    icon: FileSearch,
  },
  {
    title: 'Shared admin and auth',
    description: 'Move from a local prototype toward controlled multi-user review access.',
    icon: Users,
  },
  {
    title: 'GitHub PR review workflow',
    description: 'Use pull requests as the publish checkpoint while keeping Git as the audit trail.',
    icon: GitPullRequest,
  },
  {
    title: 'AI-assisted generation and review',
    description: 'Generate draft cases and teaching materials for human clinical review before publishing.',
    icon: Sparkles,
  },
  {
    title: 'Whole-body modules',
    description: 'Extend beyond upper quadrant into lower limb, spine, persistent pain, systemic screening, and multi-region reasoning.',
    icon: Stethoscope,
  },
]

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Trial demo status
        </p>
        <div className="mt-3 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50 sm:text-4xl">
            MSK Clinical Reasoning Lab pilot build
          </h1>
          <p className="mt-4 text-base leading-7 text-surface-600 dark:text-surface-400 sm:text-lg">
            This screen summarises the public learner site, the local admin prototype,
            and the review-first source pipeline for tomorrow&apos;s trial demo. It is a
            pilot build, not final production software. The current learner content is
            Phase 1 of a wider whole-body physiotherapy clinical reasoning platform.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Learner site
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-surface-700 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-brand-600 dark:hover:text-brand-300"
          >
            Published cases
          </Link>
          <Link
            href="/future"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
          >
            Future direction
            <Sparkles className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-labelledby="status-heading" className="mb-10">
        <h2 id="status-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Safety and deployment status
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statusCards.map((card) => {
            const Icon = card.icon

            return (
              <article
                key={card.title}
                className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                      {card.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                      {card.status}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-surface-600 dark:text-surface-400">
                  {card.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mb-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-50">
            What this trial demonstrates
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-surface-600 dark:text-surface-400">
            <p>
              The learner site demonstrates a structured MSK upper-quadrant reference with
              region navigation, condition pages, red-flag support, search, and reviewed
              guided cases for clinical reasoning practice.
            </p>
            <p>
              The long-term direction is whole-body physiotherapy clinical reasoning:
              spine, lower limb, neuro/MSK overlap, systemic screening, persistent pain,
              post-operative rehabilitation, return-to-sport reasoning, and multi-region
              presentations.
            </p>
            <p>
              The local Case Manager/admin prototype supports source preview, draft
              creation, migration tracking, registry summaries, and preflight validation.
              It is intentionally separate from the public site.
            </p>
            <p>
              The content pipeline is metadata-driven: the source registry exists, the
              migration tracker is derived from case metadata, and source integrity checks
              protect the build from incomplete legacy-derived cases.
            </p>
          </div>
        </div>

        <aside className="rounded-xl border border-accent-200 bg-accent-50 p-6 shadow-sm dark:border-accent-900 dark:bg-surface-900">
          <h2 className="text-xl font-semibold text-accent-900 dark:text-accent-300">
            Review-first workflow
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-surface-700 dark:text-surface-300">
            <li>Published cases are visible publicly.</li>
            <li>Draft and archived cases remain hidden from public routes.</li>
            <li>Legacy-derived cases carry source metadata and review status.</li>
            <li>Preflight checks run before the static export is accepted.</li>
          </ul>
        </aside>
      </section>

      <section aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading" className="text-xl font-semibold text-surface-900 dark:text-surface-50">
          Roadmap for the next phase
        </h2>
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
                Future Direction page
              </h3>
              <p className="mt-1 text-sm leading-6 text-surface-600 dark:text-surface-300">
                A public-safe summary of planned interactive cases, local AI support,
                source-informed growth, and whole-body expansion.
              </p>
            </div>
            <Link
              href="/future"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              View future direction
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roadmap.map((item) => {
            const Icon = item.icon

            return (
              <article
                key={item.title}
                className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900"
              >
                <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold text-surface-900 dark:text-surface-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-surface-600 dark:text-surface-400">
                  {item.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
