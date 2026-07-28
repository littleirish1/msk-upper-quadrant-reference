import Link from 'next/link'
import { getAllCases } from '@/lib/mdx'
import { getRegion } from '@/data/taxonomy'

export default function CasesPage() {
  const cases = getAllCases()

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Interactive revision guide
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
          Guided clinical cases
        </h1>

        <p className="mt-3 max-w-2xl text-surface-600 dark:text-surface-400">
          Work through MSK presentations using guided prompts, revealable reasoning,
          differential diagnosis checks, and evidence-linked learning.
        </p>

        <p className="mt-3 text-sm text-surface-500 dark:text-surface-400">
          {cases.length} reviewed case{cases.length === 1 ? '' : 's'} currently public.
          Draft and archived cases stay hidden until review is complete.
        </p>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-surface-200 p-10 text-center dark:border-surface-700">
          <p className="font-medium text-surface-500 dark:text-surface-400">
            No guided cases found yet.
          </p>
          <p className="mt-1 text-sm text-surface-400 dark:text-surface-500">
            Add MDX files under content/cases/[region]/ to populate this page.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((caseItem) => {
            const region = getRegion(caseItem.region)

            return (
              <section
                key={`${caseItem.region}-${caseItem.publicSlug}`}
                className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-700"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {region?.label ?? caseItem.region}
                  </span>

                  {caseItem.difficulty && (
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                      {caseItem.difficulty}
                    </span>
                  )}

                  {caseItem.estimatedTime && (
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                      {caseItem.estimatedTime}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-xl font-semibold text-surface-900 dark:text-surface-50">
                  {caseItem.displayTitle}
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-surface-600 dark:text-surface-400">
                  {caseItem.excerpt}
                </p>

                <p className="mt-3 text-xs font-medium text-surface-500 dark:text-surface-400">
                  Diagnosis and reasoning are revealed inside the case.
                </p>

                <Link
                  href={`/cases/${caseItem.region}/${caseItem.publicSlug}`}
                  className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Start case
                </Link>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
