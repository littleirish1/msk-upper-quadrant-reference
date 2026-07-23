'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import type { SearchIndexEntry } from '@/types'
import {
  MIN_SEARCH_QUERY_LENGTH,
  loadSearchIndex,
  searchEntries,
} from '@/lib/search'
import { slugToLabel } from '@/lib/utils'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchIndexEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchResponse = useMemo(() => searchEntries(index, query), [index, query])

  useEffect(() => {
    loadSearchIndex()
      .then(setIndex)
      .catch((error: unknown) => {
        console.error(error)
        setLoadError('Search is unavailable because the index could not be loaded.')
      })
      .finally(() => setLoading(false))

    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const readUrlQuery = () => {
      setQuery(new URL(window.location.href).searchParams.get('q') ?? '')
    }
    readUrlQuery()
    window.addEventListener('popstate', readUrlQuery)
    return () => window.removeEventListener('popstate', readUrlQuery)
  }, [])

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery)
    const url = new URL(window.location.href)
    if (nextQuery.trim()) url.searchParams.set('q', nextQuery)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-surface-900 dark:text-surface-50">
        Search
      </h1>

      <div className="relative mb-8">
        <Search
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={event => updateQuery(event.target.value)}
          placeholder="Search conditions, tests, treatments..."
          className="w-full rounded-xl border border-surface-200 bg-white py-3 pl-10 pr-4 text-base shadow-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-surface-700 dark:bg-surface-800 dark:focus:border-brand-500 dark:focus:ring-brand-900"
          aria-label="Search"
          aria-describedby="search-status"
          aria-controls="search-results"
        />
      </div>

      {loading && (
        <p id="search-status" className="text-sm text-surface-400" role="status">
          Loading search index...
        </p>
      )}

      {!loading && loadError && (
        <p id="search-status" className="text-sm text-red-700 dark:text-red-300" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'empty' && (
        <p id="search-status" className="text-center text-sm text-surface-400" role="status">
          Start typing to search all published conditions and clinical sections.
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'too-short' && (
        <p id="search-status" className="text-sm text-surface-500 dark:text-surface-400" role="status">
          Type at least {MIN_SEARCH_QUERY_LENGTH} characters.
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'no-results' && (
        <p id="search-status" className="text-sm text-surface-500 dark:text-surface-400" role="status">
          No results found for &ldquo;<strong>{query.trim()}</strong>&rdquo;.
        </p>
      )}

      {!loading && !loadError && searchResponse.state === 'results' && (
        <>
          <p id="search-status" className="mb-4 text-sm text-surface-500 dark:text-surface-400" role="status">
            {searchResponse.results.length} {searchResponse.results.length === 1 ? 'result' : 'results'} found.
          </p>
          <ul id="search-results" className="space-y-3" role="list" aria-label="Search results">
            {searchResponse.results.map(result => {
              const { entry } = result
              return (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="flex items-start justify-between gap-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-900 dark:hover:border-brand-600"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-brand-600 dark:text-brand-400">
                          {slugToLabel(entry.region)}
                        </span>
                        <span className="text-surface-300 dark:text-surface-600" aria-hidden>
                          &rsaquo;
                        </span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">
                          Condition
                        </span>
                      </div>
                      <p className="font-medium text-surface-900 dark:text-surface-100">
                        {entry.title}
                      </p>
                      {result.snippet && (
                        <p className="mt-1 line-clamp-2 text-sm text-surface-500 dark:text-surface-400">
                          {result.snippet}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-surface-400"
                      aria-hidden
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
