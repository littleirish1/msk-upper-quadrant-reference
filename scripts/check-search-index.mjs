import fs from 'node:fs'
import path from 'node:path'
import {
  collectCaseFiles,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const INDEX_FILE = path.join(ROOT, 'public', 'search-index.json')
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const findings = []
const searchEngine = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'searchEngine.ts'),
  path.join(ROOT, 'src'),
)
const {
  normalizeSearchText,
  parseSearchIndex,
  searchEntries,
} = searchEngine

if (!fs.existsSync(INDEX_FILE)) {
  fail('Missing public/search-index.json. Run npm run build:search or npm run build.')
} else {
  let rawEntries
  try {
    rawEntries = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  } catch (error) {
    fail(`public/search-index.json is not valid JSON: ${error.message}`)
  }

  if (rawEntries !== undefined) {
    try {
      const entries = parseSearchIndex(rawEntries)
      if (entries.length === 0) fail('public/search-index.json contains no entries.')
      await checkEntries(entries)
      checkRetrievalIntegrity(entries)
    } catch (error) {
      fail(error.message)
    }
  }
}

if (findings.length > 0) {
  console.error('\nSearch index check failed.\n')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('Search index check passed.')

async function checkEntries(entries) {
  const draftOrPrivateCaseSlugs = await readDraftOrPrivateCaseSlugs()
  const sortedIds = entries.map((entry) => entry.id).sort()
  if (!sameValues(entries.map((entry) => entry.id), sortedIds)) {
    fail('Search index entries are not in deterministic id order.')
  }

  for (const [index, entry] of entries.entries()) {
    const label = entry.id || `entry ${index}`
    if (entry.id !== `${entry.region}/${entry.condition}`) {
      fail(`Search entry has inconsistent id/region/condition metadata: ${label}`)
    }
    if (entry.href !== `/${entry.region}/${entry.condition}`) {
      fail(`Search entry has inconsistent public href: ${label}`)
    }
    if (entry.status !== 'published' || entry.publicEligibility !== true) {
      fail(`Search entry is not explicitly published and public eligible: ${label}`)
    }
    if (entry.category !== 'condition') {
      fail(`Search entry has an unsupported category: ${label}`)
    }
    if (hasNormalizedDuplicates(entry.aliases)) {
      fail(`Search entry has duplicate aliases: ${label}`)
    }
    if (hasNormalizedDuplicates(entry.keywords)) {
      fail(`Search entry has duplicate keywords: ${label}`)
    }

    const haystack = [
      entry.id,
      entry.title,
      ...entry.aliases,
      entry.region,
      entry.regionLabel,
      entry.condition,
      ...entry.keywords,
      entry.summary,
      ...entry.headings,
      entry.content,
      entry.href,
    ].join(' ').toLowerCase()

    if (haystack.includes('content/imports') || haystack.includes('/imports/') || haystack.includes('imports/raw')) {
      fail(`Search entry includes imported/admin source path: ${label}`)
    }
    if (haystack.includes('ai-manager')) {
      fail(`Search entry includes ai-manager content: ${label}`)
    }
    if (entry.href.startsWith('/cases/') || entry.id.startsWith('cases/')) {
      fail(`Case search entries are intentionally excluded: ${label}`)
    }
    for (const caseSlug of draftOrPrivateCaseSlugs) {
      if (haystack.includes(caseSlug.toLowerCase())) {
        fail(`Search entry leaks draft/private case slug "${caseSlug}": ${label}`)
      }
    }
    if (
      /\b(?:import|export)\b/.test(entry.content)
      || entry.content.includes('@/')
      || entry.summary.includes('@/')
      || entry.headings.some((heading) => heading.includes('@/'))
    ) {
      fail(`Search entry contains MDX implementation syntax: ${label}`)
    }
  }
}

function checkRetrievalIntegrity(entries) {
  const shuffled = deterministicShuffle(entries)
  for (const entry of entries) {
    checkQueryRetrievesEntry(entries, shuffled, entry.title, entry.id, 'title')
    for (const alias of entry.aliases) {
      checkQueryRetrievesEntry(entries, shuffled, alias, entry.id, `alias "${alias}"`)
    }
  }

  const unmatched = searchEntries(entries, 'zzzz-search-integrity-no-match', entries.length)
  if (unmatched.state !== 'no-results' || unmatched.results.length !== 0) {
    fail('An unmatched query returned default search records.')
  }

  const sentinel = {
    ...entries[0],
    id: 'private/search-integrity-sentinel',
    href: '/private/search-integrity-sentinel',
    title: 'Private Search Integrity Sentinel',
    status: 'private',
    publicEligibility: false,
  }
  const privateResponse = searchEntries(
    [sentinel, ...entries],
    'Private Search Integrity Sentinel',
    entries.length + 1,
  )
  if (resultIds(privateResponse).includes(sentinel.id)) {
    fail('A private or ineligible synthetic entry was retrievable.')
  }
}

function checkQueryRetrievesEntry(entries, shuffled, query, expectedId, source) {
  const original = searchEntries(entries, query, entries.length)
  const reordered = searchEntries(shuffled, query, shuffled.length)
  const originalIds = resultIds(original)
  if (!originalIds.includes(expectedId)) {
    fail(`Exact ${source} query did not retrieve ${expectedId}.`)
  }
  if (!sameValues(resultSignature(original), resultSignature(reordered))) {
    fail(`Search ranking depends on original index position for ${expectedId} (${source}).`)
  }
  for (const result of original.state === 'results' ? original.results : []) {
    if (!Number.isFinite(result.score) || result.score <= 0 || result.evidence.length === 0) {
      fail(`Search result lacks positive recorded match evidence: ${result.entry.id}`)
    }
  }
}

async function readDraftOrPrivateCaseSlugs() {
  if (!fs.existsSync(CASES_DIR)) return []
  const slugs = []
  for (const file of collectCaseFiles()) {
    try {
      const { data } = await readCaseFrontmatter(file)
      if (isPrivateStatus(data.status)) slugs.push(path.basename(file, '.mdx'))
    } catch (error) {
      fail(error.message)
    }
  }
  return slugs
}

function deterministicShuffle(entries) {
  const evens = entries.filter((_, index) => index % 2 === 0).reverse()
  const odds = entries.filter((_, index) => index % 2 === 1).reverse()
  return [...odds, ...evens]
}

function resultIds(response) {
  return response.state === 'results'
    ? response.results.map((result) => result.entry.id)
    : []
}

function resultSignature(response) {
  return response.state === 'results'
    ? response.results.map((result) => `${result.entry.id}:${result.score}`)
    : []
}

function hasNormalizedDuplicates(values) {
  const normalized = values.map(normalizeSearchText)
  return new Set(normalized).size !== normalized.length
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function fail(message) {
  findings.push(message)
}
