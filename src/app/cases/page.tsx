import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Clock3, MessagesSquare, Route, ShieldCheck, Sparkles } from 'lucide-react'
import { getAllCases } from '@/lib/mdx'
import { getRegion } from '@/data/taxonomy'

const modes = [
  { name: 'Guided', icon: Route, detail: 'Structured prompts and staged reveals' },
  { name: 'Conversation', icon: MessagesSquare, detail: 'Grounded patient dialogue' },
  { name: 'Hybrid', icon: Sparkles, detail: 'Switch between both approaches' },
]

export default function CasesPage() {
  const cases = getAllCases()

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_10%,rgba(20,184,166,0.2),transparent_35%)]" />
        <div className="relative mx-auto max-w-screen-xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-teal-300"><BookOpenCheck className="h-4 w-4" aria-hidden /> Active reasoning practice</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Clinical cases that adapt to how you learn</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Work from presentation to explanation without exposing answers early. Every public case uses an approved, deterministic learning record.</p>
          </div>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {modes.map(({ name, icon: Icon, detail }) => (
              <div key={name} className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <div className="flex items-center gap-2 font-bold"><Icon className="h-5 w-5 text-teal-300" aria-hidden />{name}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="case-library-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Reviewed library</p>
            <h2 id="case-library-heading" className="mt-1 text-2xl font-bold tracking-tight text-surface-950 dark:text-white">Choose a presentation</h2>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200"><ShieldCheck className="h-4 w-4" aria-hidden />{cases.length} public · drafts remain private</p>
        </div>

        {cases.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-surface-200 p-10 text-center dark:border-surface-700"><p className="font-medium text-surface-500 dark:text-surface-400">No reviewed cases are currently public.</p></div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((caseItem, index) => {
              const region = getRegion(caseItem.region)
              return (
                <article key={`${caseItem.region}-${caseItem.publicSlug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-xl dark:border-surface-800 dark:bg-surface-900">
                  <div className="h-1.5 bg-gradient-to-r from-brand-600 to-teal-400" />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{region?.label ?? caseItem.region}</span>
                      <span className="text-xs font-semibold text-surface-400">Case {String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-bold leading-7 text-surface-950 dark:text-white">{caseItem.displayTitle}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-surface-600 dark:text-surface-400">{caseItem.excerpt}</p>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                      {caseItem.difficulty && <span className="rounded-md bg-surface-100 px-2 py-1 dark:bg-surface-800">{caseItem.difficulty}</span>}
                      {caseItem.estimatedTime && <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-1 dark:bg-surface-800"><Clock3 className="h-3.5 w-3.5" aria-hidden />{caseItem.estimatedTime}</span>}
                    </div>
                    <p className="mt-4 text-xs text-surface-400">Diagnosis and reasoning remain hidden until revealed.</p>
                    <Link href={`/cases/${caseItem.region}/${caseItem.publicSlug}`} className="mt-5 inline-flex min-h-11 items-center justify-between rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-brand-700 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300">
                      Start case <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
