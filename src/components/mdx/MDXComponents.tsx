/**
 * Custom MDX component overrides.
 * These are injected via next-mdx-remote's `components` prop.
 */
import type { MDXComponents } from 'mdx/types'
import { AlertTriangle, Info, Lightbulb, BookOpen, ShieldAlert, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpecialTest, OutcomeMeasure, Citation } from '@/types'

// ─── Callout boxes ─────────────────────────────────────────────────────────────

type CalloutVariant = 'warning' | 'danger' | 'info' | 'tip' | 'evidence'

const calloutConfig: Record<CalloutVariant, {
  icon: React.ElementType
  classes: string
  label: string
}> = {
  warning: {
    icon: AlertTriangle,
    classes: 'border-accent-400 bg-accent-50 text-accent-900 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-100',
    label: 'Clinical Note',
  },
  danger: {
    icon: AlertTriangle,
    classes: 'border-danger-500 bg-danger-50 text-danger-900 dark:border-danger-700 dark:bg-danger-950 dark:text-danger-100',
    label: 'Red Flag',
  },
  info: {
    icon: Info,
    classes: 'border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-100',
    label: 'Information',
  },
  tip: {
    icon: Lightbulb,
    classes: 'border-green-400 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100',
    label: 'Clinical Tip',
  },
  evidence: {
    icon: BookOpen,
    classes: 'border-purple-400 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-100',
    label: 'Evidence',
  },
}

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}

export function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = calloutConfig[variant]
  const Icon = config.icon

  return (
    <div className={cn('my-4 rounded-lg border-l-4 p-4', config.classes)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          {title && (
            <p className="mb-1 font-semibold">{title ?? config.label}</p>
          )}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Diagnostic accuracy color coding ──────────────────────────────────────────

function getAccuracyColor(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'text-surface-600 dark:text-surface-400'
  if (num >= 0.80 || num >= 80) return 'text-green-700 dark:text-green-400 font-semibold'
  if (num >= 0.50 || num >= 50) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-red-600 dark:text-red-400'
}

function getAccuracyBg(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  if (num >= 0.80 || num >= 80) return 'bg-green-50 dark:bg-green-950/30'
  if (num >= 0.50 || num >= 50) return 'bg-amber-50 dark:bg-amber-950/30'
  return 'bg-red-50 dark:bg-red-950/30'
}

function getLRBadge(value: number | string | undefined, type: 'positive' | 'negative'): React.ReactNode {
  if (value === undefined || value === '—' || value === null) return <span className="text-surface-400">—</span>
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return <span className="text-surface-600 dark:text-surface-400">{value}</span>
  
  if (type === 'positive') {
    if (num >= 10) return (
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-green-700 dark:text-green-400">{value}</span>
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900 dark:text-green-200">RULES IN</span>
      </span>
    )
    if (num >= 5) return (
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-green-600 dark:text-green-400">{value}</span>
        <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">strong</span>
      </span>
    )
    if (num >= 2) return <span className="font-medium text-amber-600 dark:text-amber-400">{value}</span>
    return <span className="text-surface-500 dark:text-surface-400">{value}</span>
  }
  
  // Negative LR
  if (num <= 0.1) return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-green-700 dark:text-green-400">{value}</span>
      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-900 dark:text-green-200">RULES OUT</span>
    </span>
  )
  if (num <= 0.2) return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-green-600 dark:text-green-400">{value}</span>
      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-300">strong</span>
    </span>
  )
  if (num <= 0.5) return <span className="font-medium text-amber-600 dark:text-amber-400">{value}</span>
  return <span className="text-surface-500 dark:text-surface-400">{value}</span>
}

// ─── Special tests table (enhanced) ────────────────────────────────────────────

interface SpecialTestsTableProps {
  tests: SpecialTest[]
}

export function SpecialTestsTable({ tests }: SpecialTestsTableProps) {
  return (
    <div className="my-6">
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-blue-200 dark:border-blue-900/50">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-50 dark:bg-blue-950/30">
            <tr>
              {['Test', 'Target', 'Sn (%)', 'Sp (%)', '+LR', '−LR', 'Notes'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-blue-800 dark:text-blue-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {tests.map((t, i) => (
              <tr key={i} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                <td className="px-4 py-3 font-medium text-brand-700 dark:text-brand-400">{t.name}</td>
                <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{t.target}</td>
                <td className={cn('px-4 py-3', getAccuracyColor(t.sensitivity), getAccuracyBg(t.sensitivity))}>
                  {t.sensitivity}
                </td>
                <td className={cn('px-4 py-3', getAccuracyColor(t.specificity), getAccuracyBg(t.specificity))}>
                  {t.specificity}
                </td>
                <td className="px-4 py-3">{getLRBadge(t.lr_positive, 'positive')}</td>
                <td className="px-4 py-3">{getLRBadge(t.lr_negative, 'negative')}</td>
                <td className="px-4 py-3 text-xs text-surface-500 dark:text-surface-400 max-w-[200px]">{t.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {tests.map((t, i) => (
          <div key={i} className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900/50 dark:bg-surface-900">
            <h4 className="font-semibold text-brand-700 dark:text-brand-400 mb-1">{t.name}</h4>
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">{t.target}</p>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className={cn('rounded-md px-2.5 py-1.5', getAccuracyBg(t.sensitivity))}>
                <span className="text-[10px] font-medium uppercase text-surface-400 block">Sensitivity</span>
                <span className={getAccuracyColor(t.sensitivity)}>{t.sensitivity}</span>
              </div>
              <div className={cn('rounded-md px-2.5 py-1.5', getAccuracyBg(t.specificity))}>
                <span className="text-[10px] font-medium uppercase text-surface-400 block">Specificity</span>
                <span className={getAccuracyColor(t.specificity)}>{t.specificity}</span>
              </div>
              <div className="rounded-md bg-surface-50 px-2.5 py-1.5 dark:bg-surface-800">
                <span className="text-[10px] font-medium uppercase text-surface-400 block">+LR</span>
                {getLRBadge(t.lr_positive, 'positive')}
              </div>
              <div className="rounded-md bg-surface-50 px-2.5 py-1.5 dark:bg-surface-800">
                <span className="text-[10px] font-medium uppercase text-surface-400 block">−LR</span>
                {getLRBadge(t.lr_negative, 'negative')}
              </div>
            </div>

            {t.notes && t.notes !== '—' && (
              <p className="mt-2 text-xs text-surface-500 dark:text-surface-400 border-t border-surface-100 dark:border-surface-800 pt-2">
                {t.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Outcome measures table ────────────────────────────────────────────────────

interface OutcomeMeasuresTableProps {
  measures: OutcomeMeasure[]
}

export function OutcomeMeasuresTable({ measures }: OutcomeMeasuresTableProps) {
  return (
    <div className="my-6">
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-green-200 dark:border-green-900/50">
        <table className="min-w-full text-sm">
          <thead className="bg-green-50 dark:bg-green-950/30">
            <tr>
              {['Measure', 'Abbrev.', 'Construct', 'Items', 'MCID', 'Scoring', 'Free?'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-green-800 dark:text-green-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {measures.map((m, i) => (
              <tr key={i} className="hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 font-mono text-brand-600 dark:text-brand-400">{m.abbreviation}</td>
                <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{m.construct}</td>
                <td className="px-4 py-3">{m.items}</td>
                <td className="px-4 py-3">{m.mcid ?? '—'}</td>
                <td className="px-4 py-3">{m.scoringRange ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    m.freeAccess
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'
                  )}>
                    {m.freeAccess ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {measures.map((m, i) => (
          <div key={i} className="rounded-lg border border-green-200 bg-white p-4 shadow-sm dark:border-green-900/50 dark:bg-surface-900">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 className="font-semibold text-surface-800 dark:text-surface-200">{m.name}</h4>
                <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{m.abbreviation}</span>
              </div>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                m.freeAccess
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400'
              )}>
                {m.freeAccess ? 'Free' : 'Paid'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-surface-400">Construct:</span> <span className="text-surface-700 dark:text-surface-300">{m.construct}</span></div>
              <div><span className="text-surface-400">Items:</span> <span className="text-surface-700 dark:text-surface-300">{m.items}</span></div>
              {m.mcid && <div><span className="text-surface-400">MCID:</span> <span className="text-surface-700 dark:text-surface-300">{m.mcid}</span></div>}
              {m.scoringRange && <div><span className="text-surface-400">Score:</span> <span className="text-surface-700 dark:text-surface-300">{m.scoringRange}</span></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Citation reference ────────────────────────────────────────────────────────

interface CiteProps {
  id: string
}

export function Cite({ id }: CiteProps) {
  return (
    <sup>
      <a
        href={`#ref-${id}`}
        className="text-brand-600 hover:underline dark:text-brand-400"
        aria-label={`Citation ${id}`}
      >
        [{id}]
      </a>
    </sup>
  )
}

// ─── Citation list (rendered at bottom of page) ───────────────────────────────

interface CitationListProps {
  citations: Citation[]
}

export function CitationList({ citations }: CitationListProps) {
  if (!citations?.length) return null

  return (
    <section className="mt-12 border-t border-surface-200 pt-8 dark:border-surface-700" aria-label="References">
      <h2 className="mb-4 text-lg font-semibold text-surface-800 dark:text-surface-200">References</h2>
      <ol className="space-y-3 text-sm">
        {citations.map((c) => (
          <li key={c.id} id={`ref-${c.id}`} className="flex gap-3 text-surface-600 dark:text-surface-400">
            <span className="shrink-0 font-mono text-xs text-brand-600 dark:text-brand-400">[{c.id}]</span>
            <span>
              {c.authors.join(', ')} ({c.year}). <em>{c.title}</em>
              {c.journal && `. ${c.journal}`}
              {c.volume && `, ${c.volume}`}
              {c.issue && `(${c.issue})`}
              {c.pages && `, ${c.pages}`}
              {c.doi && (
                <> · <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">DOI</a></>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
// ─── Clinical Note ────────────────────────────────────────────────────────────
interface ClinicalNoteProps {
  children: React.ReactNode
  title?: string
}

export function ClinicalNote({ children, title }: ClinicalNoteProps) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-brand-400 bg-brand-50 p-4 dark:border-brand-700 dark:bg-brand-950">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        <div className="min-w-0">
          {title && <p className="mb-1 font-semibold text-brand-900 dark:text-brand-100">{title}</p>}
          <div className="text-sm leading-relaxed text-brand-900 dark:text-brand-100">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Reasoning  ────────────────────────────────────────────────────────────
interface ReasoningPromptProps {
  question: string
  children?: React.ReactNode
}

export function ReasoningPrompt({ question, children }: ReasoningPromptProps) {
  return (
    <div className="my-5 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white">
          ?
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-sm font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
            Clinical reasoning prompt
          </p>
          <p className="text-sm font-medium leading-relaxed text-purple-950 dark:text-purple-100">
            {question}
          </p>
          {children && (
            <div className="mt-3 text-sm leading-relaxed text-purple-900 dark:text-purple-100">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface RevealAnswerProps {
  title?: string
  children: React.ReactNode
}

export function RevealAnswer({ title = 'Compare your reasoning', children }: RevealAnswerProps) {
  return (
    <details className="my-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-800 dark:bg-surface-900">
      <summary className="cursor-pointer select-none text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-100">
        {title}
      </summary>
      <div className="mt-3 border-t border-surface-100 pt-3 text-sm leading-relaxed text-surface-700 dark:border-surface-800 dark:text-surface-300">
        {children}
      </div>
    </details>
  )
}

// ─── Red Flag (SCREAMING design) ─────────────────────────────────────────────

interface RedFlagProps {
  children: React.ReactNode
  severity?: string
  title?: string
}

export function RedFlag({ children, title }: RedFlagProps) {
  return (
    <div className="my-4 rounded-lg border-2 border-danger-500 bg-danger-50 p-4 shadow-sm shadow-danger-100 dark:border-danger-600 dark:bg-danger-950 dark:shadow-danger-950">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-500 text-white dark:bg-danger-600">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-sm font-bold uppercase tracking-wide text-danger-700 dark:text-danger-300">
            ⚠️ {title ?? 'Red Flag'}
          </p>
          <div className="text-sm leading-relaxed text-danger-900 dark:text-danger-100">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Referral Box ────────────────────────────────────────────────────────────

interface ReferralBoxProps {
  children: React.ReactNode
  title?: string
  type?: string
}

export function ReferralBox({ children, title, type }: ReferralBoxProps) {
  return (
    <div className="my-4 rounded-lg border border-brand-300 bg-brand-50 p-4 dark:border-brand-700 dark:bg-brand-950">
      <div className="flex items-start gap-3">
        <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        <div className="min-w-0">
          {(title ?? type) && (
            <p className="mb-1 font-semibold text-brand-900 dark:text-brand-100">{title ?? type}</p>
          )}
          <div className="text-sm leading-relaxed text-brand-900 dark:text-brand-100">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Evidence grade badge ──────────────────────────────────────────────────────

interface EvidenceBadgeProps {
  grade?: 'A' | 'B' | 'C' | 'D' | 'GPP'
  level?: string
}

const gradeColours: Record<string, string> = {
  A:        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  B:        'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  C:        'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200',
  D:        'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
  GPP:      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  high:     'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  moderate: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  low:      'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200',
}

export function EvidenceBadge({ grade, level }: EvidenceBadgeProps) {
  const key = grade ?? level ?? ''
  const colour = gradeColours[key] ?? gradeColours['D']
  const label = grade ? `Grade ${grade}` : level ? `Evidence: ${level}` : 'Evidence'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', colour)}>
      {label}
    </span>
  )
}

// ─── Section heading with visual separators ────────────────────────────────────

const sectionStyles: Record<string, { border: string; bg: string; icon: string }> = {
  'special-tests': { border: 'border-blue-300 dark:border-blue-800', bg: 'bg-blue-50/50 dark:bg-blue-950/20', icon: '🔬' },
  'red-flags': { border: 'border-danger-300 dark:border-danger-800', bg: 'bg-danger-50/30 dark:bg-danger-950/20', icon: '🚩' },
  'outcome-measures': { border: 'border-green-300 dark:border-green-800', bg: 'bg-green-50/50 dark:bg-green-950/20', icon: '📊' },
  'management': { border: 'border-purple-300 dark:border-purple-800', bg: 'bg-purple-50/30 dark:bg-purple-950/20', icon: '💊' },
  'clinical-frameworks': { border: 'border-purple-200 dark:border-purple-800', bg: 'bg-purple-50/20 dark:bg-purple-950/10', icon: '🧩' },
  'differential-diagnosis': { border: 'border-amber-300 dark:border-amber-800', bg: 'bg-amber-50/30 dark:bg-amber-950/20', icon: '🔀' },
  'evidence-based-diagnosis': { border: 'border-brand-300 dark:border-brand-800', bg: 'bg-brand-50/30 dark:bg-brand-950/20', icon: '🔍' },
}

function getSectionStyle(id: string | undefined) {
  if (!id) return null
  for (const [key, val] of Object.entries(sectionStyles)) {
    if (id.includes(key)) return val
  }
  return null
}

// ─── MDX component map ─────────────────────────────────────────────────────────

export const mdxComponents: MDXComponents = {
  // Custom components available inside MDX files
  Callout,
  SpecialTestsTable,
  OutcomeMeasuresTable,
  Cite,
  CitationList,
  EvidenceBadge,
  ClinicalNote,
  ReasoningPrompt,
  RevealAnswer,
  RedFlag,
  ReferralBox,

  // Prose overrides with section-aware styling
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
      {children}
    </h1>
  ),
  h2: ({ children, id, ...props }) => {
    const style = getSectionStyle(id)
    return (
      <div className={cn(
        'mt-10 mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-6 pb-2',
        style ? `border-t-2 ${style.border} ${style.bg} rounded-t-lg` : 'border-t border-surface-200 dark:border-surface-700'
      )}>
        <h2 id={id} className="flex items-center gap-2 text-2xl font-semibold text-surface-800 dark:text-surface-100 scroll-mt-20" {...props}>
          {style && <span className="text-xl">{style.icon}</span>}
          {children}
        </h2>
      </div>
    )
  },
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-xl font-semibold text-surface-700 dark:text-surface-200">
      {children}
    </h3>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
      <table className="min-w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-surface-100 px-4 py-3 text-left text-sm font-semibold text-surface-700 dark:bg-surface-800 dark:text-surface-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-400">
      {children}
    </td>
  ),

  // Horizontal rules become section separators
  hr: () => (
    <hr className="my-8 border-t-2 border-surface-200 dark:border-surface-700" />
  ),
}
