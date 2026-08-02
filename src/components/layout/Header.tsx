'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Activity, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { useTheme } from 'next-themes'

const navigation = [
  { href: '/cervical', label: 'Cervical' },
  { href: '/thoracic', label: 'Thoracic' },
  { href: '/shoulder', label: 'Shoulder' },
  { href: '/elbow', label: 'Elbow' },
  { href: '/wrist-hand', label: 'Wrist & Hand' },
  { href: '/cases', label: 'Cases' },
  { href: '/anatomy', label: 'Anatomy' },
  { href: '/learning', label: 'Learning Lab' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 text-white shadow-lg shadow-slate-950/10 backdrop-blur supports-[backdrop-filter]:bg-slate-950/90">
      <div className="mx-auto flex h-[4.5rem] max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} className="group flex min-h-11 items-center gap-3 whitespace-nowrap">
          <span className="rounded-xl bg-teal-400 p-2 text-slate-950 transition group-hover:bg-teal-300"><Activity className="h-5 w-5" aria-hidden /></span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold tracking-wide">MSK Reasoning Lab</span>
            <span className="block text-[11px] font-medium text-slate-400">HSC Northern Ireland</span>
          </span>
          <span className="text-sm font-bold sm:hidden">MSK Lab</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-0.5 whitespace-nowrap xl:flex" aria-label="Primary">
          {navigation.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition ${isCurrent(href) ? 'bg-white/10 text-teal-300' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/search" aria-current={pathname === '/search' ? 'page' : undefined} className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-300 transition hover:border-teal-300/50 hover:text-white" aria-label="Search">
            <Search className="h-4 w-4" aria-hidden />
            <span className="hidden md:block">Search</span>
            <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-400 md:block">Ctrl K</kbd>
          </Link>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Toggle dark mode">
            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </button>
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 xl:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" aria-expanded={mobileOpen} aria-controls="mobile-primary-navigation">
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-primary-navigation" className="border-t border-white/10 bg-slate-950 px-4 pb-5 pt-3 xl:hidden" aria-label="Mobile navigation">
          <ul className="grid gap-1 sm:grid-cols-2">
            {navigation.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} aria-current={isCurrent(href) ? 'page' : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${isCurrent(href) ? 'bg-white/10 text-teal-300' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'}`} onClick={() => setMobileOpen(false)}>
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
