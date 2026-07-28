import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const SOURCE_ROOT = path.join(ROOT, 'src')
const {
  loadCaseReveal,
  parseCaseRevealPayload,
  resolveCaseRevealUrl,
} = await loadTypeScriptTree(
  path.join(SOURCE_ROOT, 'lib', 'caseReveal.ts'),
  SOURCE_ROOT,
)

const first = payload('reveal-one', 'Condition one')
const second = payload('reveal-two', 'Condition two')

assert.equal(
  resolveCaseRevealUrl('/msk-upper-quadrant-reference/cases/shoulder/case-01/', 'opaque-id'),
  '/msk-upper-quadrant-reference/case-reveals/opaque-id.json',
)
assert.equal(
  resolveCaseRevealUrl('/cases/shoulder/case-01/', 'opaque-id'),
  '/case-reveals/opaque-id.json',
)
assert.equal(parseCaseRevealPayload(first, 'reveal-one').conditionLabel, 'Condition one')
assert.throws(
  () => parseCaseRevealPayload(first, 'another-case'),
  /does not match this case/,
)

const requested = []
const fetchImpl = async (url) => {
  requested.push(url)
  const body = url.includes('reveal-one') ? first : second
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}
const loadedFirst = await loadCaseReveal('reveal-one', '/cases/shoulder/case-01/', fetchImpl)
const loadedSecond = await loadCaseReveal('reveal-two', '/cases/elbow/case-02/', fetchImpl)
assert.equal(loadedFirst.conditionLabel, 'Condition one')
assert.equal(loadedSecond.conditionLabel, 'Condition two')
assert.notEqual(loadedFirst.revealId, loadedSecond.revealId)
assert.equal(requested.length, 2)

await assert.rejects(
  loadCaseReveal('reveal-one', '/cases/shoulder/case-01/', async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  })),
  /503/,
)
await assert.rejects(
  loadCaseReveal('reveal-one', '/cases/shoulder/case-01/', async () => ({
    ok: true,
    status: 200,
    json: async () => second,
  })),
  /does not match this case/,
)

console.log('Case reveal loader tests passed.')
console.log('Covered basePath resolution, payload validation, loading failure, and stale-case identity rejection.')

function payload(revealId, conditionLabel) {
  return {
    schemaVersion: 1,
    revealId,
    actualTitle: 'Private case title',
    conditionLabel,
    conditionHref: '/shoulder/example-condition',
    sections: [{ heading: 'Reasoning', slug: 'reasoning' }],
    contentHtml: '<p>Delayed reasoning.</p>',
  }
}
