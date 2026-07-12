'use client'

import { useState, useEffect, useCallback } from 'react'
import { List, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Section {
  heading: string
  slug: string
}

// Map section headings to icons/colors for clinical sections
const sectionMeta: Record<string, { emoji: string; colorClass: string }> = {
  'overview': { emoji: '📋', colorClass: 'text-brand-600 dark:text-brand-400' },
  'pathophysiology': { emoji: '📋', colorClass: 'text-brand-600 dark:text-brand-400' },
  'special-tests': { emoji: '🔬', colorClass: 'text-blue-600 dark:text-blue-400' },
  'red-flags': { emoji: '🚩', colorClass: 'text-danger-600 dark:text-danger-400' },
  'clinical-frameworks': { emoji: '🧩', colorClass: 'text-purple-600 dark:text-purple-400' },
  'outcome-measures': { emoji: '📊', colorClass: 'text-green-600 dark:text-green-400' },
  'evidence-based-diagnosis': { emoji: '🔍', colorClass: 'text-brand-600 dark:text-brand-400' },
  'differential-diagnosis': { emoji: '🔀', colorClass: 'text-accent-600 dark:text-accent-400' },
  'management': { emoji: '💊', colorClass: 'text-green-700 dark:text-green-300' },
  'references': { emoji: '📚', colorClass: 'text-surface-500 dark:text-surface-400' },
}

function getSectionMeta(slug: string) {
  // Try exact match, then partial match
  if (sectionMeta[slug]) return sectionMeta[slug]
  for (const [key, val] of Object.entries(sectionMeta)) {
    if (slug.includes(key)) return val
  }
  return { emoji: '📄', colorClass: 'text-surface-600 dark:text-surface-400' }
}

interface StickyTOCProps {
  sections: Section[]
}

export function StickyTOC({ sections }: StickyTOCProps) {
  const [activeSlug, setActiveSlug] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const handleScroll = useCallback(() => {
    const headings = sections
      .map(s => ({
        slug: s.slug,
        el: document.getElementById(s.slug),
      }))
      .filter((heading): heading is { slug: string; el: HTMLElement } => Boolean(heading.el))

    if (headings.length === 0) return

    const activationLine = 180
    const firstVisible = headings.find(({ el }) => el.getBoundingClientRect().top >= activationLine)

    let current = headings[0].slug
    for (const { slug, el } of headings) {
      if (el.getBoundingClientRect().top <= activationLine) {
        current = slug
      }
    }

    if (window.scrollY < 40) {
      current = headings[0].slug
    } else if (firstVisible && firstVisible.el.getBoundingClientRect().top < activationLine + 80) {
      current = firstVisible.slug
    }

    setActiveSlug(current)
  }, [sections])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  if (!sections.length) return null

  return (
    <>
      {/* Desktop: sticky sidebar TOC */}
      <aside className="hidden xl:block sticky top-20 w-56 shrink-0 self-start max-h-[calc(100vh-6rem)] overflow-y-auto print:hidden">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
          <List className="h-3.5 w-3.5" />
          On this page
        </p>
        <nav aria-label="Table of contents">
          <ul className="space-y-0.5 border-l-2 border-surface-200 dark:border-surface-700">
            {sections.map(s => {
              const meta = getSectionMeta(s.slug)
              const isActive = activeSlug === s.slug
              return (
                <li key={s.slug}>
                  <a
                    href={`#${s.slug}`}
                    aria-current={isActive ? 'location' : undefined}
                    className={cn(
                      'flex items-center gap-2 border-l-2 -ml-[2px] py-1.5 pl-3 pr-2 text-sm transition-colors',
                      isActive
                        ? 'border-brand-500 font-medium text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-950/30'
                        : 'border-transparent text-surface-500 hover:text-surface-800 hover:border-surface-300 dark:text-surface-400 dark:hover:text-surface-200'
                    )}
                  >
                    <span className="text-xs">{meta.emoji}</span>
                    <span className="truncate">{s.heading}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Mobile: collapsible floating TOC */}
      <div className="xl:hidden fixed bottom-16 left-4 right-4 z-40 print:hidden">
        <div className="rounded-xl border border-surface-200 bg-white/95 shadow-lg backdrop-blur dark:border-surface-700 dark:bg-surface-900/95">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4" />
              {activeSlug ? sections.find(s => s.slug === activeSlug)?.heading || 'Sections' : 'Sections'}
            </span>
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {collapsed && (
            <nav className="border-t border-surface-200 dark:border-surface-700 max-h-60 overflow-y-auto px-2 py-2">
              <ul className="space-y-0.5">
                {sections.map(s => {
                  const meta = getSectionMeta(s.slug)
                  return (
                    <li key={s.slug}>
                      <a
                        href={`#${s.slug}`}
                        onClick={() => setCollapsed(false)}
                        aria-current={activeSlug === s.slug ? 'location' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          activeSlug === s.slug
                            ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                            : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800'
                        )}
                      >
                        <span>{meta.emoji}</span>
                        {s.heading}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </>
  )
}
