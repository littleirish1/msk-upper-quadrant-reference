import Link from 'next/link'
import { BookOpen, Network } from 'lucide-react'
import { ANATOMY_CATEGORIES } from '@/data/anatomy'
import { getPublicAnatomyRecords } from '@/lib/anatomy'

export const metadata = {
  title: 'Anatomy Foundations',
  description: 'Reviewed anatomy learning records linked to clinical reasoning.',
}

export default function AnatomyIndexPage() {
  const records = getPublicAnatomyRecords()
  const counts = new Map(ANATOMY_CATEGORIES.map((category) => [
    category.slug,
    records.filter((record) => record.category === category.slug).length,
  ]))

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 pb-24 sm:px-6 sm:py-12 lg:px-8 lg:pb-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Foundation library</p>
        <h1 className="mt-2 text-3xl font-bold text-surface-900 dark:text-surface-50">Anatomy and neurology</h1>
        <p className="mt-3 text-base leading-7 text-surface-600 dark:text-surface-300">
          This section provides the reviewed anatomy framework for future clinical links. Categories are live; detail records appear only after source and clinician review.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ANATOMY_CATEGORIES.map((category) => (
          <Link
            key={category.slug}
            href={`/anatomy/${category.slug}`}
            className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-700"
          >
            <div className="flex items-center gap-3">
              <Network className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
              <h2 className="font-semibold text-surface-900 dark:text-surface-50">{category.label}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-surface-600 dark:text-surface-400">{category.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-surface-500 dark:text-surface-400">
              <BookOpen className="h-4 w-4" aria-hidden />
              {counts.get(category.slug) || 0} reviewed records
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
