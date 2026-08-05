import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardCheck,
  Cuboid,
  Dumbbell,
  FileQuestion,
  Network,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PublicCaseSummary } from '@/lib/casePublication'

interface Props {
  conditionCount: number
  cases: PublicCaseSummary[]
}

const journey = [
  { href: '#shoulder-conditions', label: 'Reference', detail: 'Browse published shoulder topics', icon: BookOpen },
  { href: '#shoulder-assessment', label: 'Assessment', detail: 'Connect reasoning and safety checks', icon: ClipboardCheck },
  { href: '#shoulder-cases', label: 'Cases', detail: 'Use Guided, Conversation or Hybrid mode', icon: Brain },
  { href: '#shoulder-tools', label: 'Learning tools', detail: 'See movement, anatomy and question status', icon: Network },
]

export function ShoulderLearningDashboard({ conditionCount, cases }: Props) {
  return (
    <div className="mb-10 space-y-10">
      <section aria-labelledby="shoulder-pathway-title" className="border-y border-surface-200 py-6 dark:border-surface-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase text-teal-700 dark:text-teal-300">Regional learning pathway</p>
            <h2 id="shoulder-pathway-title" className="mt-2 text-2xl font-semibold text-surface-950 dark:text-white">
              Build from reference knowledge to clinical reasoning
            </h2>
            <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300">
              Move between published references and neutral guided cases. Learning tools that still require evidence,
              accessibility, licensing or clinical review remain clearly withheld.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4 lg:min-w-[32rem]">
            <Metric label="References" value={conditionCount} />
            <Metric label="Cases" value={cases.length} />
            <Metric label="Case modes" value={3} />
            <Metric label="Draft tools shown" value={0} />
          </dl>
        </div>

        <nav aria-label="Shoulder learning pathway" className="mt-6">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {journey.map(({ href, label, detail, icon: Icon }) => (
              <li key={href}>
                <a href={href} className="flex min-h-16 items-center gap-3 rounded-lg border border-surface-200 px-3 py-2 hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none dark:border-surface-700 dark:hover:border-teal-600 dark:hover:bg-teal-950/40">
                  <Icon className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-surface-900 dark:text-white">{label}</span>
                    <span className="block text-xs leading-5 text-surface-500 dark:text-surface-400">{detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <section id="shoulder-assessment" aria-labelledby="shoulder-assessment-title" className="scroll-mt-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">Assessment pathway</p>
            <h2 id="shoulder-assessment-title" className="mt-2 text-xl font-semibold text-surface-950 dark:text-white">Reason before you reveal</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-600 dark:text-surface-300">
              Use the condition references to plan subjective and objective assessment, then test that reasoning in a
              guided case. Diagnosis-bearing information remains behind the governed learner reveal.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/red-flags" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">
                <ShieldAlert className="h-4 w-4" aria-hidden />Review red flags
              </Link>
              <Link href="/cases" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-surface-300 px-4 text-sm font-semibold text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-100 dark:hover:bg-surface-800">
                Browse all cases<ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="border-l-4 border-teal-500 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100">
            <p className="font-semibold">Governance boundary</p>
            <p className="mt-1">Movement explanations, authored questions and interactive 3D are not shown until their exact content, evidence, accessibility, licensing and clinical reviews are complete.</p>
          </div>
        </div>
      </section>

      <section id="shoulder-cases" aria-labelledby="shoulder-cases-title" className="scroll-mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Clinical reasoning cases</p>
            <h2 id="shoulder-cases-title" className="mt-2 text-xl font-semibold text-surface-950 dark:text-white">Choose a neutral presentation</h2>
          </div>
          <Link href="/cases" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
            Full case library<ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cases.map((item) => (
            <Link key={item.publicSlug} href={`/cases/${item.region}/${item.publicSlug}`} className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm hover:border-violet-400 dark:border-surface-700 dark:bg-surface-900">
              <h3 className="font-semibold text-surface-950 dark:text-white">{item.displayTitle}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-surface-600 dark:text-surface-300">{item.excerpt}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-surface-600 dark:text-surface-300">
                <span>Guided</span><span aria-hidden>/</span><span>Conversation</span><span aria-hidden>/</span><span>Hybrid</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="shoulder-tools" aria-labelledby="shoulder-tools-title" className="scroll-mt-24 border-t border-surface-200 pt-6 dark:border-surface-700">
        <p className="text-xs font-semibold uppercase text-surface-500">Learning tools</p>
        <h2 id="shoulder-tools-title" className="mt-2 text-xl font-semibold text-surface-950 dark:text-white">Available references and governed next steps</h2>
        <div className="mt-5 divide-y divide-surface-200 border-y border-surface-200 dark:divide-surface-700 dark:border-surface-700">
          <ToolRow icon={Network} title="Anatomy reference" status="Available" detail="Browse currently published anatomy foundations." href="/anatomy" />
          <ToolRow icon={Dumbbell} title="Movement library" status="In review" detail="No unreviewed movement descriptions or range values are published." />
          <ToolRow icon={Cuboid} title="Interactive 3D" status="Licence review required" detail="No 3D route or model asset is public." />
          <ToolRow icon={FileQuestion} title="Shoulder questions" status="Evidence review required" detail="No unreviewed shoulder MCQ or answer is published." />
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-surface-500">{label}</dt><dd className="mt-1 text-xl font-bold text-surface-950 dark:text-white">{value}</dd></div>
}

function ToolRow({ icon: Icon, title, status, detail, href }: { icon: LucideIcon; title: string; status: string; detail: string; href?: string }) {
  const content = <><Icon className="h-5 w-5 shrink-0 text-surface-500" aria-hidden /><span className="min-w-0 flex-1"><span className="block font-semibold text-surface-900 dark:text-white">{title}</span><span className="block text-sm leading-6 text-surface-500 dark:text-surface-400">{detail}</span></span><span className="text-right text-xs font-semibold uppercase text-surface-600 dark:text-surface-300">{status}</span>{href && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />}</>
  return href
    ? <Link href={href} className="flex min-h-16 items-center gap-3 py-3 hover:text-brand-700">{content}</Link>
    : <div className="flex min-h-16 items-center gap-3 py-3">{content}</div>
}
