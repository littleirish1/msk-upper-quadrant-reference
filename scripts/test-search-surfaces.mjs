import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const quickFindSource = fs.readFileSync(
  path.join(ROOT, 'src', 'components', 'ui', 'QuickFind.tsx'),
  'utf8',
)
const searchPageSource = fs.readFileSync(
  path.join(ROOT, 'src', 'app', 'search', 'page.tsx'),
  'utf8',
)
const engine = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'searchEngine.ts'),
  path.join(ROOT, 'src'),
)
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'search-index.json'), 'utf8'))

let checks = 0

run('QuickFind delegates filtering and ranking to the shared engine', () => {
  assert.match(quickFindSource, /searchEntries\(index,\s*query,\s*QUICK_FIND_RESULT_LIMIT\)/u)
  assert.doesNotMatch(quickFindSource, /\bREGIONS\b|\bcommonTests\b|\bbuildIndex\b/u)
  assert.doesNotMatch(quickFindSource, /\.filter\(/u)
})

run('Search page delegates filtering and ranking to the shared engine', () => {
  assert.match(searchPageSource, /searchEntries\(index,\s*query\)/u)
  assert.doesNotMatch(searchPageSource, /\.filter\(/u)
})

run('both surfaces use the one cached public-index loader', () => {
  for (const source of [quickFindSource, searchPageSource]) {
    assert.match(source, /\bloadSearchIndex\(\)/u)
    assert.match(source, /from ['"]@\/lib\/search['"]/u)
  }
})

run('shared surface states never provide fallback or stale matches', () => {
  const queries = ['', ' ', 'f', 'cervicogenic', 'frozen shoulder', 'tennis elbow', 'fracture', 'zzzzunknown']
  const responses = queries.map((query) => engine.searchEntries(index, query))

  assert.equal(responses[0].state, 'empty')
  assert.equal(responses[1].state, 'empty')
  assert.equal(responses[2].state, 'too-short')
  assert.equal(responses.at(-1).state, 'no-results')
  assert.equal(responses.at(-1).results.length, 0)
  assert.equal(
    responses[4].results[0]?.entry.id,
    'shoulder/adhesive-capsulitis',
  )
  assert.equal(
    responses[5].results[0]?.entry.id,
    'elbow/lateral-epicondylalgia',
  )
})

run('result ordering remains stable when the public index is shuffled', () => {
  const forward = resultIds(engine.searchEntries(index, 'fracture'))
  const reverse = resultIds(engine.searchEntries([...index].reverse(), 'fracture'))
  assert.deepEqual(reverse, forward)
})

run('shared engine excludes malformed and non-public records for both surfaces', () => {
  const published = index[0]
  const restricted = [
    { ...published, id: 'private/item', href: '/private/item', status: 'private' },
    { ...published, id: 'draft/item', href: '/draft/item', status: 'draft' },
    { ...published, id: 'ineligible/item', href: '/ineligible/item', publicEligibility: false },
  ]
  assert.equal(engine.searchEntries(restricted, published.title).results.length, 0)
})

console.log(`Search surface tests passed. Deterministic assertions: ${checks}.`)

function resultIds(response) {
  return response.state === 'results'
    ? response.results.map((result) => result.entry.id)
    : []
}

function run(name, action) {
  try {
    action()
    checks += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}
