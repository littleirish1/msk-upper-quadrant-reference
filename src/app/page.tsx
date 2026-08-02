import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Brain,
  CircleDot,
  Columns,
  GitBranch,
  GraduationCap,
  Hand,
  Layers3,
  LockKeyhole,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { REGIONS } from '@/data/taxonomy'
import { BodyRegionRoadmap } from '@/components/ui/BodyRegionRoadmap'
import { QuickFind } from '@/components/ui/QuickFind'

const iconMap: Record<string, React.ElementType> = {
  Brain, Columns, CircleDot, GitBranch, Hand,
}

const learningPaths = [
  {
    href: '/cases',
    eyebrow: 'Practice',
    title: 'Clinical cases',
    description: 'Move between guided, conversational, and hybrid learning modes.',
    icon: BookOpen,
  },
  {
    href: '/anatomy',
    eyebrow: 'Foundations',
    title: 'Anatomy library',
    description: 'Explore reviewed regional anatomy records and their learning context.',
    icon: Network,
  },
  {
    href: '/learning',
    eyebrow: 'Consolidate',
    title: 'Learning lab',
    description: 'Use governed study tools to revisit and connect core material.',
    icon: GraduationCap,
  },
]

const governedExpansions = [
  { title: 'Interactive 3D anatomy', icon: Layers3 },
  { title: 'Movement learning', icon: Sparkles },
  { title: 'One-best-answer questions', icon: CircleDot },
]

export default function HomePage() {
  return (
    <div className="pb-16">
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.16),transparent_32%)]" />
        <div className="mx-auto grid max-w-screen-xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              Governed clinical learning
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Build clinical reasoning, one decision at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A focused upper-quadrant learning environment for reviewed reference material,
              active case practice, and transparent evidence governance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cases" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-teal-300">
                Start a clinical case <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
                <Search className="h-4 w-4" aria-hidden /> Search the library
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-teal-950/30 backdrop-blur sm:p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">Quick find</p>
            <QuickFind />
            <p className="mt-4 text-xs leading-5 text-slate-400">
              Search only returns content approved for the public learning surface.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <section className="py-14" aria-labelledby="pathways-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Choose your pathway</p>
              <h2 id="pathways-heading" className="mt-1 text-2xl font-bold tracking-tight text-surface-950 dark:text-white">Learn by doing</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {learningPaths.map(({ href, eyebrow, title, description, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg dark:border-surface-800 dark:bg-surface-900">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Icon className="h-5 w-5" aria-hidden /></div>
                  <ArrowRight className="h-5 w-5 text-surface-300 transition group-hover:translate-x-1 group-hover:text-teal-600" aria-hidden />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">{eyebrow}</p>
                <h3 className="mt-1 text-xl font-bold text-surface-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-400">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-surface-200 py-14 dark:border-surface-800" aria-labelledby="regions-heading">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Regional reference</p>
          <h2 id="regions-heading" className="mt-1 text-2xl font-bold tracking-tight text-surface-950 dark:text-white">Browse the upper quadrant</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {REGIONS.map((region) => {
              const Icon = iconMap[region.icon] ?? Brain
              return (
                <Link key={region.slug} href={`/${region.slug}`} className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-surface-800 dark:bg-surface-900">
                  <div className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-950 dark:text-brand-300"><Icon className="h-5 w-5" aria-hidden /></div>
                  <h3 className="mt-4 font-bold text-surface-950 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{region.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-surface-500 dark:text-surface-400">{region.description}</p>
                </Link>
              )
            })}
          </div>
        </section>

        <BodyRegionRoadmap />

        <section className="mt-14 rounded-3xl bg-slate-950 p-6 text-white sm:p-9" aria-labelledby="roadmap-heading">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-teal-300">Governed expansion</p>
            <h2 id="roadmap-heading" className="mt-2 text-2xl font-bold">Designed for safe, staged growth</h2>
            <p className="mt-3 leading-7 text-slate-300">These learning systems are prepared privately, but remain unavailable here until their exact revisions complete source, clinical, and release review.</p>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {governedExpansions.map(({ title, icon: Icon }) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-teal-300" aria-hidden /><h3 className="font-semibold">{title}</h3></div>
                <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Review required · route withheld</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Clinical disclaimer</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-200/80">This learning resource is intended for qualified physiotherapists and allied health professionals. Apply all information with professional judgement and local HSC Northern Ireland policies.</p>
        </section>
      </div>
    </div>
  )
}
