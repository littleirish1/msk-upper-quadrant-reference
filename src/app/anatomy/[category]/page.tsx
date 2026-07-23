import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ANATOMY_CATEGORIES, getAnatomyCategory } from '@/data/anatomy'
import { getPublicAnatomyRecords } from '@/lib/anatomy'

export function generateStaticParams() {
  return ANATOMY_CATEGORIES.map((category) => ({ category: category.slug }))
}

export default function AnatomyCategoryPage({ params }: { params: { category: string } }) {
  const category = getAnatomyCategory(params.category)
  if (!category) notFound()
  const records = getPublicAnatomyRecords().filter((record) => record.category === category.slug)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 sm:py-12 lg:px-8 lg:pb-12">
      <Link href="/anatomy" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
        Anatomy foundations
      </Link>
      <h1 className="mt-3 text-3xl font-bold text-surface-900 dark:text-surface-50">{category.label}</h1>
      <p className="mt-3 text-base leading-7 text-surface-600 dark:text-surface-300">{category.description}</p>

      {records.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {records.map((record) => (
            <li key={record.contentId}>
              <Link
                href={`/anatomy/${record.category}/${record.slug}`}
                className="block rounded-lg border border-surface-200 bg-white p-4 font-semibold text-surface-900 hover:border-brand-300 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-50"
              >
                {record.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-surface-300 bg-surface-50 p-6 dark:border-surface-700 dark:bg-surface-900">
          <p className="font-semibold text-surface-800 dark:text-surface-100">No reviewed detail records yet</p>
          <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">
            Draft records remain private until sources and clinical review are complete.
          </p>
        </div>
      )}
    </div>
  )
}
