'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, Columns, CircleDot, GitBranch, Hand, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const regions = [
  { slug: 'cervical', label: 'Cervical', icon: Brain },
  { slug: 'thoracic', label: 'Thoracic', icon: Columns },
  { slug: 'shoulder', label: 'Shoulder', icon: CircleDot },
  { slug: 'elbow', label: 'Elbow', icon: GitBranch },
  { slug: 'wrist-hand', label: 'Wrist', icon: Hand },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const activeRegion = pathname.split('/')[1] || ''

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-surface-700 dark:bg-surface-900/95 lg:hidden print:hidden"
      aria-label="Region quick access"
    >
      <div className="flex items-center justify-around px-1 py-1">
        {regions.map(({ slug, label, icon: Icon }) => {
          const isActive = activeRegion === slug
          return (
            <Link
              key={slug}
              href={`/${slug}`}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-brand-600 dark:text-brand-400')} />
              {label}
            </Link>
          )
        })}
        <Link
          href="/search"
          className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
        >
          <Search className="h-5 w-5" />
          Search
        </Link>
      </div>
    </nav>
  )
}
