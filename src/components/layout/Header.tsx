'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Search, Sun, Moon, Activity } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-surface-700 dark:bg-surface-900/95">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-brand-600 dark:text-brand-400">
          <Activity className="h-6 w-6" aria-hidden />
          <span className="hidden sm:block leading-tight">
            MSK Reference
            <span className="block text-xs font-normal text-surface-500 dark:text-surface-400">
              HSC Northern Ireland
            </span>
          </span>
          <span className="sm:hidden">MSK Ref</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {[
            { href: '/cervical',    label: 'Cervical' },
            { href: '/thoracic',   label: 'Thoracic' },
            { href: '/shoulder',   label: 'Shoulder' },
            { href: '/elbow',      label: 'Elbow' },
            { href: '/wrist-hand', label: 'Wrist & Hand' },
            { href: '/cases',      label: 'Cases' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-100 hover:text-brand-600 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-brand-400"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search button */}
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-sm text-surface-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-surface-700 dark:bg-surface-800 dark:hover:border-brand-500 dark:hover:text-brand-400"
            aria-label="Search"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="hidden md:block">Search…</span>
            <kbd className="hidden rounded border border-surface-300 px-1 text-xs dark:border-surface-600 md:block">
              ⌘K
            </kbd>
          </Link>

          {/* Dark mode toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-md p-2 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-800 dark:hover:bg-surface-800 dark:hover:text-surface-200"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark'
              ? <Sun className="h-5 w-5" aria-hidden />
              : <Moon className="h-5 w-5" aria-hidden />
            }
          </button>

          {/* Mobile menu toggle */}
          <button
            className="rounded-md p-2 text-surface-500 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen
              ? <X className="h-5 w-5" aria-hidden />
              : <Menu className="h-5 w-5" aria-hidden />
            }
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          className="border-t border-surface-200 bg-white px-4 pb-4 pt-2 dark:border-surface-700 dark:bg-surface-900 lg:hidden"
          aria-label="Mobile navigation"
        >
          <ul className="space-y-1">
            {[
              { href: '/cervical',    label: 'Cervical Spine' },
              { href: '/thoracic',   label: 'Thoracic Spine' },
              { href: '/shoulder',   label: 'Shoulder' },
              { href: '/elbow',      label: 'Elbow' },
              { href: '/wrist-hand', label: 'Wrist & Hand' },
              { href: '/cases',      label: 'Guided Cases' },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
