import Link from 'next/link'
import { ArrowRight, BookOpen, Layers3, LockKeyhole, Move3d, Network } from 'lucide-react'
import { ANATOMY_CATEGORIES } from '@/data/anatomy'
import { getPublicAnatomyRecords } from '@/lib/anatomy'

export const metadata = {
  title: 'Anatomy Foundations',
  description: 'Reviewed anatomy learning records linked to clinical reasoning.',
}

export default function AnatomyIndexPage() {
  const records = getPublicAnatomyRecords()
  const counts = new Map(ANATOMY_CATEGORIES.map((category) => [category.slug, records.filter((record) => record.category === category.slug).length]))

  return (
    <div className="pb-20">
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-screen-xl gap-8 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-teal-300"><Network className="h-4 w-4" aria-hidden /> Foundation library</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Anatomy with a clear line to learning</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">Explore reviewed regional records. Detail is published only when its sources, wording, and clinical interpretation are approved together.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-4">
            <p className="text-3xl font-bold text-teal-300">{records.length}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Reviewed records</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="anatomy-categories-heading">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Browse by system</p>
          <h2 id="anatomy-categories-heading" className="mt-1 text-2xl font-bold tracking-tight text-surface-950 dark:text-white">Anatomy categories</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ANATOMY_CATEGORIES.map((category) => (
              <Link key={category.slug} href={`/anatomy/${category.slug}`} className="group rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition hover:border-teal-400 hover:shadow-lg dark:border-surface-800 dark:bg-surface-900">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Network className="h-5 w-5" aria-hidden /></span>
                  <ArrowRight className="h-4 w-4 text-surface-300 transition group-hover:translate-x-1 group-hover:text-teal-600" aria-hidden />
                </div>
                <h3 className="mt-5 font-bold text-surface-950 dark:text-white">{category.label}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">{category.description}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-surface-500 dark:text-surface-400"><BookOpen className="h-4 w-4" aria-hidden />{counts.get(category.slug) || 0} reviewed records</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="future-learning-heading">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Governed roadmap</p>
          <h2 id="future-learning-heading" className="mt-1 text-2xl font-bold tracking-tight text-surface-950 dark:text-white">Interactive learning, held behind review</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              { icon: Layers3, title: 'Governed 3D viewer', text: 'Regional model slots and interaction requirements are documented privately. No public model or viewer route is released.' },
              { icon: Move3d, title: 'Movement learning', text: 'Joint and functional movement slots are mapped privately. No public movement claim or route is released.' },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-6 dark:border-surface-700 dark:bg-surface-900">
                <div className="flex items-center gap-3"><span className="rounded-xl bg-surface-200 p-2.5 text-surface-600 dark:bg-surface-800 dark:text-surface-300"><Icon className="h-5 w-5" aria-hidden /></span><h3 className="font-bold text-surface-950 dark:text-white">{title}</h3></div>
                <p className="mt-4 text-sm leading-6 text-surface-600 dark:text-surface-400">{text}</p>
                <p className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-surface-500"><LockKeyhole className="h-4 w-4" aria-hidden />Review required · route withheld</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
