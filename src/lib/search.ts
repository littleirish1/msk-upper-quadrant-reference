import type { SearchIndexEntry } from '@/types'
import { parseSearchIndex } from './searchEngine'

export {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_RANKING,
  normalizeSearchText,
  parseSearchIndex,
  searchEntries,
  tokenizeSearchText,
} from './searchEngine'

let cachedIndexPromise: Promise<SearchIndexEntry[]> | null = null
const DEPLOYMENT_BASE_PATH = '/msk-upper-quadrant-reference'

export function resolveSearchIndexUrl(pathname: string): string {
  const normalizedPath = pathname.replace(/\/+$/, '')
  const basePath = normalizedPath === DEPLOYMENT_BASE_PATH || normalizedPath.startsWith(`${DEPLOYMENT_BASE_PATH}/`)
    ? DEPLOYMENT_BASE_PATH
    : ''
  return `${basePath}/search-index.json`
}

export function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  if (!cachedIndexPromise) {
    cachedIndexPromise = fetch(resolveSearchIndexUrl(window.location.pathname), { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load search index (${response.status}).`)
        }
        return parseSearchIndex(await response.json())
      })
      .catch((error) => {
        cachedIndexPromise = null
        throw error
      })
  }
  return cachedIndexPromise
}
