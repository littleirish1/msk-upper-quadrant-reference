'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { REGIONS } from '@/data/taxonomy'

const InteractiveBodyModel = dynamic(
  () => import('./InteractiveBodyModel').then(mod => mod.InteractiveBodyModel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] w-full items-center justify-center sm:h-[70vh] lg:h-[75vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-surface-500 dark:text-surface-400">Loading 3D model…</p>
        </div>
      </div>
    ),
  }
)

const regionColors: Record<string, string> = {
  cervical: '#3aa3c2',
  thoracic: '#f08000',
  shoulder: '#e02020',
  elbow: '#8b5cf6',
  'wrist-hand': '#10b981',
}

export function BodyModelPage() {
  return (
    <div className="flex flex-col">
      {/* Compact header */}
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-surface-500 transition-colors hover:text-brand-600 dark:text-surface-400 dark:hover:text-brand-400 sm:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back
        </Link>
        <div className="flex-1 text-center">
          <h1 className="text-sm font-bold text-surface-900 dark:text-surface-50 sm:text-base">
            3D Upper Quadrant Model
          </h1>
          <p className="hidden text-xs text-surface-500 dark:text-surface-400 sm:block">
            Click a body region to explore conditions · Drag to rotate · Scroll to zoom
          </p>
        </div>
        {/* Spacer to balance the back button */}
        <div className="w-[40px] sm:w-[60px]" />
      </div>

      {/* 3D viewer */}
      <div className="relative flex-1 overflow-hidden rounded-xl mx-2 sm:mx-4 lg:mx-6">
        <InteractiveBodyModel />
      </div>

      {/* Compact inline legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        {REGIONS.map(r => (
          <Link
            key={r.slug}
            href={`/${r.slug}`}
            className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs text-surface-600 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400 dark:hover:border-brand-600 sm:text-sm"
          >
            <span
              className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
              style={{ backgroundColor: regionColors[r.slug] }}
            />
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  )
}