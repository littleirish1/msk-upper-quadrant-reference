'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REGIONS } from '@/data/taxonomy'

interface SidebarProps {
  currentRegion?: string
  currentCondition?: string
  showConditions?: boolean
}

export function Sidebar({ currentRegion, currentCondition, showConditions = true }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 lg:block xl:w-72',
        'sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto',
        'border-r border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900'
      )}
      aria-label="Sidebar navigation"
    >
      <div className="p-4">
        <nav>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
            Regions
          </p>

          <ul className="space-y-0.5">
            {REGIONS.map(region => {
              const isActiveRegion = region.slug === currentRegion

              return (
                <li key={region.slug}>
                  <Link
                    href={`/${region.slug}`}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      isActiveRegion
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'
                    )}
                  >
                    {region.label}
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isActiveRegion && 'rotate-90')} />
                  </Link>

                  {isActiveRegion && showConditions && (
                    <ul className="ml-3 mt-1 space-y-0.5 border-l border-surface-200 pl-3 dark:border-surface-700">
                      {region.conditions.map(condition => {
                        const isActiveCondition = condition.slug === currentCondition

                        return (
                          <li key={condition.slug}>
                            <Link
                              href={`/${region.slug}/${condition.slug}`}
                              className={cn(
                                'block rounded px-2 py-1 text-sm transition-colors',
                                isActiveCondition
                                  ? 'font-medium text-brand-600 dark:text-brand-400'
                                  : 'text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200'
                              )}
                            >
                              {condition.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-8 rounded-md border border-accent-200 bg-accent-50 p-3 text-xs text-surface-600 dark:border-accent-900 dark:bg-surface-800 dark:text-surface-400">
          <p className="font-semibold text-accent-700 dark:text-accent-400">Clinical Disclaimer</p>
          <p className="mt-1">
            For qualified health professionals only. Always apply clinical judgement. Not a substitute for professional training.
          </p>
        </div>
      </div>
    </aside>
  )
}
