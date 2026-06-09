import Link from 'next/link'
import { BookOpen, Brain, Columns, CircleDot, GitBranch, Hand, Search, ShieldAlert, Stethoscope } from 'lucide-react'
import { REGIONS } from '@/data/taxonomy'
import { QuickFind } from '@/components/ui/QuickFind'

const iconMap: Record<string, React.ElementType> = {
  Brain, Columns, CircleDot, GitBranch, Hand,
}

// Region-specific key info for preview cards
const regionMeta: Record<string, { keyTests: string; conditionCount: string }> = {
  cervical: { keyTests: 'Spurling\'s, ULNT, Distraction', conditionCount: '6 conditions' },
  thoracic: { keyTests: 'Adson\'s, Roos, Costoclavicular', conditionCount: '6 conditions' },
  shoulder: { keyTests: 'Neer\'s, Hawkins, Empty Can', conditionCount: '8 conditions' },
  elbow: { keyTests: 'Cozen\'s, Mill\'s, Tinel\'s', conditionCount: '6 conditions' },
  'wrist-hand': { keyTests: 'Phalen\'s, Tinel\'s, Finkelstein\'s', conditionCount: '7 conditions' },
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">

      {/* Hero — compact for mobile */}
      <section className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300">
          HSC Northern Ireland · Physiotherapy &amp; Allied Health
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50 sm:text-5xl">
          MSK Upper Quadrant
          <span className="block text-brand-600 dark:text-brand-400">Clinical Reference</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base text-surface-600 dark:text-surface-400 sm:text-lg">
          Evidence-based clinical decision support. Special tests with diagnostic accuracy, red flags, and management pathways.
        </p>
      </section>

      {/* Quick Find — the killer feature for speed */}
      <section className="mb-10">
        <QuickFind />
      </section>

      {/* Quick access shortcuts */}
      <section className="mb-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <Search className="h-4 w-4" aria-hidden />
            Full Search
          </Link>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-brand-800 dark:bg-surface-900 dark:text-brand-300 dark:hover:bg-brand-950"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Guided Cases
          </Link>
          <Link
            href="/red-flags"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-danger-300 bg-danger-50 px-5 py-2.5 text-sm font-semibold text-danger-700 shadow-sm transition-colors hover:bg-danger-100 dark:border-danger-700 dark:bg-danger-950 dark:text-danger-300 dark:hover:bg-danger-900"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Red Flags Quick Ref
          </Link>
        </div>
      </section>

      {/* Region cards with key info preview */}
      <section aria-labelledby="regions-heading">
        <h2 id="regions-heading" className="mb-4 text-xl font-semibold text-surface-800 dark:text-surface-200">
          Browse by Region
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REGIONS.map(region => {
            const Icon = iconMap[region.icon] ?? Brain
            const meta = regionMeta[region.slug]

            return (
              <Link
                key={region.slug}
                href={`/${region.slug}`}
                className="group rounded-xl border border-surface-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-600"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-400">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900 group-hover:text-brand-700 dark:text-surface-100 dark:group-hover:text-brand-400">
                      {region.label}
                    </h3>
                    <p className="text-xs text-surface-400">{meta?.conditionCount}</p>
                  </div>
                </div>
                <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
                  {region.description}
                </p>
                
                {/* Key tests preview */}
                {meta && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-400 dark:text-surface-500">
                    <Stethoscope className="h-3 w-3 shrink-0" />
                    <span className="truncate">Key tests: {meta.keyTests}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mt-10 rounded-xl border border-accent-200 bg-accent-50 p-5 dark:border-accent-900 dark:bg-surface-900">
        <p className="text-sm font-semibold text-accent-800 dark:text-accent-400">Clinical Disclaimer</p>
        <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
          This resource is intended for qualified physiotherapists and allied health professionals.
          Clinical information should be applied in conjunction with professional judgement and local HSC NI policies.
        </p>
      </section>
    </div>
  )
}
