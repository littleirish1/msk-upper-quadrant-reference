'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { REGIONS } from '@/data/taxonomy'

const InteractiveBodyModel = dynamic(
  () => import('./InteractiveBodyModel').then(mod => mod.InteractiveBodyModel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(80vh,700px)] w-full items-center justify-center sm:h-[min(85vh,800px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-surface-500 dark:text-surface-400">Loading 3D model...</p>
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
    <div className="flex min-h-[80vh] flex-col">
      {/* Header bar */}
      <div className="border-b border-surface-200 bg-white/95 px-4 py-3 dark:border-surface-700 dark:bg-surface-900/95 sm:px-6">
        <div className="mx-auto flex max-w-screen-xl items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-surface-500 transition-colors hover:text-brand-600 dark:text-surface-400 dark:hover:text-brand-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="mx-auto text-center">
            <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">
              3D Upper Quadrant Model
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Click a body region to explore conditions &middot; Drag to rotate &middot; Scroll to zoom
            </p>
          </div>
        </div>
      </div>

      {/* 3D viewer */}
      <div className="relative flex-1 bg-gradient-to-b from-surface-50 to-white dark:from-surface-950 dark:to-surface-900">
        <Suspense fallback={
          <div className="flex h-[min(80vh,700px)] w-full items-center justify-center sm:h-[min(85vh,800px)]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <p className="text-sm text-surface-500 dark:text-surface-400">Loading 3D model...</p>
            </div>
          </div>
        }>
          <InteractiveBodyModel />
        </Suspense>
      </div>

      {/* Region legend */}
      <div className="border-t border-surface-200 bg-white px-4 py-3 dark:border-surface-700 dark:bg-surface-900 sm:px-6">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-center gap-4">
          {REGIONS.map(r => (
            <Link
              key={r.slug}
              href={`/${r.slug}`}
              className="flex items-center gap-1.5 text-sm text-surface-600 transition-colors hover:text-brand-600 dark:text-surface-400 dark:hover:text-brand-400"
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: regionColors[r.slug] }}
              />
              {r.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
