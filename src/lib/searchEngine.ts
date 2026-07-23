import type {
  SearchIndexEntry,
  SearchMatchEvidence,
  SearchMatchField,
  SearchMatchType,
  SearchResponse,
  SearchResult,
} from '@/types'

export const MIN_SEARCH_QUERY_LENGTH = 2

export const SEARCH_RANKING = Object.freeze({
  titleExact: 10_000,
  aliasExact: 9_500,
  titlePhrase: 9_000,
  titlePrefix: 8_500,
  titleToken: 7_000,
  aliasPhrase: 8_200,
  aliasPrefix: 7_800,
  aliasToken: 6_800,
  region: 5_000,
  category: 4_500,
  keyword: 4_000,
  summary: 3_000,
  heading: 2_000,
  body: 1_000,
  allTokens: 600,
  matchedToken: 50,
  supportingEvidenceCap: 500,
})

interface FieldConfig {
  field: SearchMatchField
  values: string[]
  exactScore: number
  phraseScore: number
  prefixScore: number
  tokenScore: number
  minimumPrefixLength: number
}

interface ScoredEntry {
  result: SearchResult
  normalizedTitle: string
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value)
  if (!normalized) return []
  return normalized.split(' ').filter((token) => token.length >= MIN_SEARCH_QUERY_LENGTH)
}

export function isPublicSearchIndexEntry(value: unknown): value is SearchIndexEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    stringField(entry, 'id')
    && stringField(entry, 'title')
    && stringArrayField(entry, 'aliases')
    && stringField(entry, 'region')
    && stringField(entry, 'regionLabel')
    && entry.category === 'condition'
    && stringField(entry, 'condition')
    && typeof entry.section === 'string'
    && stringArrayField(entry, 'keywords')
    && typeof entry.summary === 'string'
    && stringArrayField(entry, 'headings')
    && typeof entry.content === 'string'
    && stringField(entry, 'href')
    && entry.status === 'published'
    && entry.publicEligibility === true
  )
}

export function parseSearchIndex(value: unknown): SearchIndexEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('Search index must be an array.')
  }

  const entries = value.map((entry, index) => {
    if (!isPublicSearchIndexEntry(entry)) {
      throw new Error(`Search index entry ${index} is malformed or not public eligible.`)
    }
    return entry
  })

  assertUnique(entries, 'id')
  assertUnique(entries, 'href')
  return entries
}

export function searchEntries(
  entries: readonly unknown[],
  query: string,
  limit = Number.POSITIVE_INFINITY,
): SearchResponse {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return { state: 'empty', query, normalizedQuery: '', results: [] }
  }

  const normalizedQuery = normalizeSearchText(query)
  const compactLength = normalizedQuery.replace(/\s/g, '').length
  const queryTokens = tokenizeSearchText(query)
  if (compactLength < MIN_SEARCH_QUERY_LENGTH || queryTokens.length === 0) {
    return { state: 'too-short', query, normalizedQuery, results: [] }
  }

  const validEntries = deduplicateEntries(
    entries.filter(isPublicSearchIndexEntry).sort(compareEntries),
  )
  const scored = validEntries
    .map((entry) => scoreEntry(entry, normalizedQuery, queryTokens))
    .filter((entry): entry is ScoredEntry => entry !== null)
    .sort(compareScoredEntries)

  const resultLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : scored.length
  const results = scored.slice(0, resultLimit).map(({ result }) => result)
  if (results.length === 0) {
    return { state: 'no-results', query, normalizedQuery, results: [] }
  }
  return { state: 'results', query, normalizedQuery, results }
}

function scoreEntry(
  entry: SearchIndexEntry,
  normalizedQuery: string,
  queryTokens: string[],
): ScoredEntry | null {
  const fields: FieldConfig[] = [
    field('title', [entry.title], SEARCH_RANKING.titleExact, SEARCH_RANKING.titlePhrase, SEARCH_RANKING.titlePrefix, SEARCH_RANKING.titleToken, 2),
    field('alias', entry.aliases, SEARCH_RANKING.aliasExact, SEARCH_RANKING.aliasPhrase, SEARCH_RANKING.aliasPrefix, SEARCH_RANKING.aliasToken, 2),
    field('region', [entry.regionLabel, entry.region], SEARCH_RANKING.region, SEARCH_RANKING.region, SEARCH_RANKING.region, 90, 2),
    field('category', [entry.category], SEARCH_RANKING.category, SEARCH_RANKING.category, SEARCH_RANKING.category, 80, 2),
    field('keyword', entry.keywords, SEARCH_RANKING.keyword, SEARCH_RANKING.keyword, SEARCH_RANKING.keyword, 70, 2),
    field('summary', [entry.summary], SEARCH_RANKING.summary, SEARCH_RANKING.summary, SEARCH_RANKING.summary, 55, 3),
    field('heading', entry.headings, SEARCH_RANKING.heading, SEARCH_RANKING.heading, SEARCH_RANKING.heading, 45, 3),
    field('body', [entry.content], SEARCH_RANKING.body, SEARCH_RANKING.body, SEARCH_RANKING.body, 20, 4),
  ]

  const evidence = fields.flatMap((config) =>
    config.values
      .map((value) => scoreField(value, config, normalizedQuery, queryTokens))
      .filter((item): item is SearchMatchEvidence => item !== null),
  )
  if (evidence.length === 0) return null

  const matchedTokens = [...new Set(evidence.flatMap((item) => item.matchedTokens))].sort()
  const requiredTokenCount = queryTokens.length <= 2
    ? queryTokens.length
    : Math.ceil(queryTokens.length * 0.6)
  if (matchedTokens.length < requiredTokenCount) return null

  const primaryScore = Math.max(...evidence.map((item) => item.score))
  const supportingScore = Math.min(
    SEARCH_RANKING.supportingEvidenceCap,
    evidence.reduce((total, item) => total + Math.min(item.score, 100), 0),
  )
  const coverageScore = matchedTokens.length === queryTokens.length
    ? SEARCH_RANKING.allTokens
    : matchedTokens.length * SEARCH_RANKING.matchedToken
  const score = primaryScore + supportingScore + coverageScore
  if (!Number.isFinite(score) || score <= 0) return null

  return {
    normalizedTitle: normalizeSearchText(entry.title),
    result: {
      entry,
      score,
      matchedTokens,
      evidence: evidence.sort(compareEvidence),
      snippet: createSnippet(entry, evidence, queryTokens),
    },
  }
}

function scoreField(
  value: string,
  config: FieldConfig,
  normalizedQuery: string,
  queryTokens: string[],
): SearchMatchEvidence | null {
  const normalizedValue = normalizeSearchText(value)
  if (!normalizedValue) return null
  const valueTokens = normalizedValue.split(' ')
  const matchedTokens = queryTokens.filter((queryToken) =>
    valueTokens.some((valueToken) =>
      valueToken === queryToken
      || (queryToken.length >= config.minimumPrefixLength && valueToken.startsWith(queryToken)),
    ),
  )
  if (matchedTokens.length === 0) return null

  let matchType: SearchMatchType = 'token'
  let score = config.tokenScore
  if (normalizedValue === normalizedQuery) {
    matchType = 'exact'
    score = config.exactScore
  } else if (containsTokenPhrase(valueTokens, queryTokens)) {
    matchType = 'phrase'
    score = config.phraseScore
  } else if (
    normalizedQuery.length >= config.minimumPrefixLength
    && normalizedValue.startsWith(normalizedQuery)
  ) {
    matchType = 'prefix'
    score = config.prefixScore
  }

  return {
    field: config.field,
    matchType,
    matchedTokens: [...new Set(matchedTokens)].sort(),
    score,
  }
}

function createSnippet(
  entry: SearchIndexEntry,
  evidence: SearchMatchEvidence[],
  queryTokens: string[],
): string {
  const bodyMatch = evidence.find((item) => item.field === 'body')
  if (bodyMatch) return excerptAroundTokens(entry.content, queryTokens)
  const headingMatch = evidence.find((item) => item.field === 'heading')
  if (headingMatch) {
    const heading = entry.headings.find((value) =>
      queryTokens.some((token) => tokenizeSearchText(value).some((item) => item.startsWith(token))),
    )
    if (heading) return heading
  }
  return entry.summary || excerptAroundTokens(entry.content, queryTokens)
}

function excerptAroundTokens(value: string, queryTokens: string[], maxLength = 220): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  const lower = compact.toLowerCase()
  const matchIndex = queryTokens
    .map((token) => lower.indexOf(token.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0
  const start = Math.max(0, matchIndex - Math.floor(maxLength / 3))
  const end = Math.min(compact.length, start + maxLength)
  return `${start > 0 ? '…' : ''}${compact.slice(start, end).trim()}${end < compact.length ? '…' : ''}`
}

function containsTokenPhrase(valueTokens: string[], queryTokens: string[]): boolean {
  if (queryTokens.length > valueTokens.length) return false
  return valueTokens.some((_, start) =>
    queryTokens.every((token, offset) => valueTokens[start + offset] === token),
  )
}

function field(
  fieldName: SearchMatchField,
  values: string[],
  exactScore: number,
  phraseScore: number,
  prefixScore: number,
  tokenScore: number,
  minimumPrefixLength: number,
): FieldConfig {
  return {
    field: fieldName,
    values: values.filter((value) => typeof value === 'string' && value.trim().length > 0),
    exactScore,
    phraseScore,
    prefixScore,
    tokenScore,
    minimumPrefixLength,
  }
}

function compareScoredEntries(left: ScoredEntry, right: ScoredEntry): number {
  return (
    right.result.score - left.result.score
    || right.result.matchedTokens.length - left.result.matchedTokens.length
    || left.normalizedTitle.localeCompare(right.normalizedTitle)
    || left.result.entry.id.localeCompare(right.result.entry.id)
    || left.result.entry.href.localeCompare(right.result.entry.href)
  )
}

function compareEvidence(left: SearchMatchEvidence, right: SearchMatchEvidence): number {
  return right.score - left.score
    || left.field.localeCompare(right.field)
    || left.matchType.localeCompare(right.matchType)
}

function compareEntries(left: SearchIndexEntry, right: SearchIndexEntry): number {
  return left.id.localeCompare(right.id)
    || left.href.localeCompare(right.href)
    || normalizeSearchText(left.title).localeCompare(normalizeSearchText(right.title))
}

function deduplicateEntries(entries: SearchIndexEntry[]): SearchIndexEntry[] {
  const seenIds = new Set<string>()
  const seenHrefs = new Set<string>()
  return entries.filter((entry) => {
    if (seenIds.has(entry.id) || seenHrefs.has(entry.href)) return false
    seenIds.add(entry.id)
    seenHrefs.add(entry.href)
    return true
  })
}

function assertUnique(entries: SearchIndexEntry[], fieldName: 'id' | 'href'): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry[fieldName])) {
      throw new Error(`Duplicate search index ${fieldName}: ${entry[fieldName]}`)
    }
    seen.add(entry[fieldName])
  }
}

function stringField(record: Record<string, unknown>, fieldName: string): boolean {
  return typeof record[fieldName] === 'string' && record[fieldName].trim().length > 0
}

function stringArrayField(record: Record<string, unknown>, fieldName: string): boolean {
  return Array.isArray(record[fieldName])
    && (record[fieldName] as unknown[]).every((value) => typeof value === 'string' && value.trim().length > 0)
}
