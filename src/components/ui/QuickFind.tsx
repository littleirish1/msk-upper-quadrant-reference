'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import type { SearchIndexEntry } from '@/types'
import {
  MIN_SEARCH_QUERY_LENGTH,
  loadSearchIndex,
  searchEntries,
} from '@/lib/search'

const QUICK_FIND_RESULT_LIMIT = 8

export function QuickFind() {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const searchResponse = useMemo(
    () => searchEntries(index, query, QUICK_FIND_RESULT_LIMIT),
    [index, query],
  )

  useEffect(() => {
    loadSearchIndex()
      .then(setIndex)
      .catch((error: unknown) => {
        console.error(error)
        setLoadError('Quick find is unavailable because the search index could not be loaded.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Quick find: condition, test name, or ICD-10..."
          className="w-full rounded-xl border-2 border-surface-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm outline-none transition-all focus:border-brand-400 focus:shadow-md focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-800 dark:focus:border-brand-500 dark:focus:ring-brand-900"
          aria-label="Quick find"
          aria-describedby="quick-find-status"
          aria-controls="quick-find-results"
        />
      </div>

      {loading && query.trim() && (
        <p id="quick-find-status" className="mt-3 text-center text-sm text-surface-400" role="status">
          Loading search index...
        </p>
      )}

      {!loading && loadError && query.trim() && (
        <p id="quick-find-status" className="mt-3 text-center text-sm text-red-700 dark:text-red-300" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'too-short' && (
        <p id="quick-find-status" className="mt-3 text-center text-sm text-surface-400" role="status">
          Type at least {MIN_SEARCH_QUERY_LENGTH} characters.
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'no-results' && (
        <p id="quick-find-status" className="mt-3 text-center text-sm text-surface-400" role="status">
          No matches. Try{' '}
          <Link href="/search" className="text-brand-600 hover:underline dark:text-brand-400">
            full search
          </Link>
          .
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'results' && (
        <>
          <p id="quick-find-status" className="sr-only" role="status">
            {searchResponse.results.length}{' '}
            {searchResponse.results.length === 1 ? 'result' : 'results'} found.
          </p>
          <ul
            id="quick-find-results"
            className="mt-2 divide-y divide-surface-100 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-lg dark:divide-surface-800 dark:border-surface-700 dark:bg-surface-900"
            aria-label="Quick find results"
          >
            {searchResponse.results.map(({ entry }) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-brand-950"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full bg-brand-100 dark:bg-brand-900"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-surface-800 dark:text-surface-200">
                      {entry.title}
                    </span>
                    <span className="block text-xs text-surface-400">
                      {entry.regionLabel}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-surface-300 dark:text-surface-600"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
