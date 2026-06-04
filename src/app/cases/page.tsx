import Link from 'next/link'

export default function CasesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
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
      </div>

      <section className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          Shoulder
        </p>

        <h2 className="mt-2 text-xl font-semibold text-surface-900 dark:text-surface-50">
          Lateral shoulder pain
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-400">
          A guided case exploring rotator cuff related shoulder pain, differentials,
          objective assessment planning, and early management reasoning.
        </p>

        <Link
          href="/cases/shoulder/rcrsp-case-01"
          className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start case
        </Link>
      </section>
    </main>
  )
}