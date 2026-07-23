import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const engine = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'searchEngine.ts'),
  path.join(ROOT, 'src'),
)
const searchClient = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'search.ts'),
  path.join(ROOT, 'src'),
)
const {
  MIN_SEARCH_QUERY_LENGTH,
  parseSearchIndex,
  searchEntries,
} = engine
const { resolveSearchIndexUrl } = searchClient

const baseEntries = [
  entry({
    id: 'cervical/cervicogenic-headache',
    title: 'Cervicogenic Headache',
    region: 'cervical',
    regionLabel: 'Cervical Spine',
    condition: 'cervicogenic-headache',
    summary: 'A secondary headache presentation.',
    content: 'Assessment includes headache features and cervical examination.',
  }),
  entry({
    id: 'shoulder/adhesive-capsulitis',
    title: 'Adhesive Capsulitis',
    aliases: ['Frozen Shoulder'],
    region: 'shoulder',
    regionLabel: 'Shoulder',
    condition: 'adhesive-capsulitis',
    summary: 'A shoulder presentation with progressive restriction.',
    content: 'Frozen shoulder is a commonly used learner-facing synonym.',
  }),
  entry({
    id: 'shoulder/shoulder-instability',
    title: 'Shoulder Instability',
    region: 'shoulder',
    regionLabel: 'Shoulder',
    condition: 'shoulder-instability',
    summary: 'A shoulder instability presentation.',
  }),
  entry({
    id: 'elbow/lateral-epicondylalgia',
    title: 'Lateral Epicondylalgia',
    aliases: ['Tennis Elbow'],
    region: 'elbow',
    regionLabel: 'Elbow',
    condition: 'lateral-epicondylalgia',
  }),
  entry({
    id: 'wrist-hand/scaphoid-fracture',
    title: 'Scaphoid Fracture',
    region: 'wrist-hand',
    regionLabel: 'Wrist and Hand',
    condition: 'scaphoid-fracture',
    summary: 'Fracture assessment after a fall.',
  }),
]

let checks = 0

run('empty query returns no matches', () => {
  assert.equal(searchEntries(baseEntries, '').state, 'empty')
})

run('whitespace-only query returns no matches', () => {
  assert.equal(searchEntries(baseEntries, '   \t ').state, 'empty')
})

run('one-character query is below the minimum', () => {
  const response = searchEntries(baseEntries, 'f')
  assert.equal(response.state, 'too-short')
  assert.equal(response.results.length, 0)
})

run('minimum-length boundary performs a fresh search', () => {
  assert.equal(MIN_SEARCH_QUERY_LENGTH, 2)
  assert.equal(resultIds(searchEntries(baseEntries, 'sc'))[0], 'wrist-hand/scaphoid-fracture')
})

run('matching is case-insensitive', () => {
  assert.equal(resultIds(searchEntries(baseEntries, 'CERVICOGENIC'))[0], 'cervical/cervicogenic-headache')
})

run('punctuation and hyphens normalise consistently', () => {
  assert.equal(resultIds(searchEntries(baseEntries, 'frozen-shoulder'))[0], 'shoulder/adhesive-capsulitis')
})

run('exact title outranks weaker body matches', () => {
  const bodyOnly = entry({
    id: 'shoulder/example',
    title: 'Example Presentation',
    condition: 'example',
    content: 'Scaphoid fracture appears in a differential list.',
  })
  assert.equal(
    resultIds(searchEntries([bodyOnly, ...baseEntries], 'Scaphoid Fracture'))[0],
    'wrist-hand/scaphoid-fracture',
  )
})

run('exact governed alias ranks its condition first', () => {
  assert.equal(resultIds(searchEntries(baseEntries, 'tennis elbow'))[0], 'elbow/lateral-epicondylalgia')
})

run('title prefix matching supports incomplete learner input', () => {
  assert.equal(resultIds(searchEntries(baseEntries, 'cervico'))[0], 'cervical/cervicogenic-headache')
})

run('multi-token queries match across learner-facing fields', () => {
  assert.equal(resultIds(searchEntries(baseEntries, 'scaphoid fracture'))[0], 'wrist-hand/scaphoid-fracture')
})

run('all-token matches outrank partial-token matches', () => {
  const ids = resultIds(searchEntries(baseEntries, 'frozen shoulder presentation'))
  assert.equal(ids[0], 'shoulder/adhesive-capsulitis')
  assert.ok(ids.indexOf('shoulder/shoulder-instability') > 0)
})

run('unrelated query returns an explicit no-results state', () => {
  assert.equal(searchEntries(baseEntries, 'zzzzunknown').state, 'no-results')
})

run('query transitions do not retain previous results', () => {
  const first = resultIds(searchEntries(baseEntries, 'cervicogenic'))
  const second = resultIds(searchEntries(baseEntries, 'frozen'))
  assert.ok(first.includes('cervical/cervicogenic-headache'))
  assert.equal(second.includes('cervical/cervicogenic-headache'), false)
  assert.equal(second[0], 'shoulder/adhesive-capsulitis')
})

run('clearing a query clears every matching result', () => {
  assert.equal(searchEntries(baseEntries, '').results.length, 0)
})

run('tied results have stable ordering independent of index order', () => {
  const tied = [
    entry({ id: 'shoulder/zeta', title: 'Zeta', condition: 'zeta', content: 'Shared keyword.' }),
    entry({ id: 'shoulder/alpha', title: 'Alpha', condition: 'alpha', content: 'Shared keyword.' }),
  ]
  const forward = resultIds(searchEntries(tied, 'keyword'))
  const reverse = resultIds(searchEntries([...tied].reverse(), 'keyword'))
  assert.deepEqual(forward, ['shoulder/alpha', 'shoulder/zeta'])
  assert.deepEqual(reverse, forward)
})

run('duplicate index entries cannot create duplicate results', () => {
  const duplicate = { ...baseEntries[0] }
  const ids = resultIds(searchEntries([duplicate, ...baseEntries], 'cervicogenic'))
  assert.equal(ids.filter((id) => id === duplicate.id).length, 1)
  assert.throws(() => parseSearchIndex([duplicate, ...baseEntries]), /Duplicate search index id/)
})

run('malformed index records fail parsing and are ignored by pure search', () => {
  const malformed = { id: 'broken', title: 'Cervicogenic decoy' }
  assert.throws(() => parseSearchIndex([...baseEntries, malformed]), /malformed/)
  assert.equal(resultIds(searchEntries([malformed, ...baseEntries], 'cervicogenic'))[0], 'cervical/cervicogenic-headache')
})

run('private, draft, and ineligible entries are excluded', () => {
  const privateEntry = { ...baseEntries[0], id: 'private/item', href: '/private/item', status: 'private' }
  const draftEntry = { ...baseEntries[0], id: 'draft/item', href: '/draft/item', status: 'draft' }
  const ineligibleEntry = {
    ...baseEntries[0],
    id: 'ineligible/item',
    href: '/ineligible/item',
    publicEligibility: false,
  }
  assert.deepEqual(resultIds(searchEntries([privateEntry, draftEntry, ineligibleEntry], 'cervicogenic')), [])
})

run('every returned result has positive score and recorded evidence', () => {
  const response = searchEntries(baseEntries, 'fracture')
  assert.equal(response.state, 'results')
  for (const result of response.results) {
    assert.ok(Number.isFinite(result.score) && result.score > 0)
    assert.ok(result.evidence.length > 0)
    assert.ok(result.matchedTokens.length > 0)
  }
})

run('default search returns the complete genuine match set', () => {
  const entries = Array.from({ length: 25 }, (_, index) => entry({
    id: `shoulder/shared-${String(index).padStart(2, '0')}`,
    title: `Shared Result ${index}`,
    condition: `shared-${index}`,
    content: 'A governed shared learner term.',
  }))
  assert.equal(resultIds(searchEntries(entries, 'shared')).length, entries.length)
})

run('search index URL respects the configured route base path', () => {
  assert.equal(
    resolveSearchIndexUrl('/msk-upper-quadrant-reference/search/'),
    '/msk-upper-quadrant-reference/search-index.json',
  )
  assert.equal(resolveSearchIndexUrl('/search/'), '/search-index.json')
})

console.log(`Search engine tests passed. Deterministic assertions: ${checks}.`)

function entry(overrides = {}) {
  const id = overrides.id ?? 'shoulder/example'
  return {
    id,
    title: 'Example Condition',
    aliases: [],
    region: 'shoulder',
    regionLabel: 'Shoulder',
    category: 'condition',
    condition: id.split('/').at(-1),
    section: '',
    keywords: [],
    summary: 'Example summary.',
    headings: ['Overview'],
    content: 'Example learner-facing content.',
    href: `/${id}`,
    status: 'published',
    publicEligibility: true,
    ...overrides,
  }
}

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
