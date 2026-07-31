import Link from 'next/link'
import { BookOpen, GraduationCap, Network, Search, ShieldAlert } from 'lucide-react'

interface LearningJourneyLinksProps {
  current: 'region' | 'condition'
  regionHref: string
}

const destinations = [
  { href: '/anatomy', label: 'Anatomy', icon: Network },
  { href: '/cases', label: 'Guided cases', icon: BookOpen },
  { href: '/learning', label: 'Learning lab', icon: GraduationCap },
  { href: '/red-flags', label: 'Red flags', icon: ShieldAlert },
  { href: '/search', label: 'Search', icon: Search },
]

export function LearningJourneyLinks({ current, regionHref }: LearningJourneyLinksProps) {
  return (
    <nav aria-label="Related learning" className="mb-8 border-y border-surface-200 py-3 dark:border-surface-700">
      <ul className="flex flex-wrap gap-2">
        {current === 'condition' && (
          <li>
            <Link
              href={regionHref}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
            >
              Region overview
            </Link>
          </li>
        )}
        {destinations.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
