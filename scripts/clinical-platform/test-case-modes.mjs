import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const component = fs.readFileSync(path.join(ROOT, 'src', 'components', 'cases', 'CaseModeExperience.tsx'), 'utf8')
const page = fs.readFileSync(path.join(ROOT, 'src', 'app', 'cases', '[region]', '[caseSlug]', 'page.tsx'), 'utf8')
const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'case-conversation-assets.json'), 'utf8'))

for (const mode of ['guided', 'conversation', 'hybrid']) assert.ok(component.includes(`'${mode}'`), `missing ${mode} mode`)
for (const contract of ['role="tablist"', 'role="tabpanel"', 'aria-live="polite"', 'Restart same seed', 'New session seed', 'Disclosure summary', 'Reasoning notebook', 'Optional tutor']) {
  assert.ok(component.includes(contract), `missing mode UI contract: ${contract}`)
}
assert.ok(component.includes("mode === 'guided' || projection"), 'conversation asset must not load in initial Guided mode')
assert.ok(component.includes('cache: \'no-store\''), 'conversation fetch must avoid stale cross-case cache state')
assert.ok(component.includes('does not match this case revision'), 'asset identity validation missing')
assert.ok(component.includes('crossed the disclosure boundary'), 'client disclosure validation missing')
assert.ok(!component.includes('process.env.') && !component.includes('apiKey'), 'provider keys or runtime secrets must not enter the browser')
assert.ok(page.includes('conversationAssets.assets.find'))
assert.equal(mapping.assets.length, 6)

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'public-case-registry.json'), 'utf8'))
assert.deepEqual(mapping.assets.map((item) => item.caseId).sort(), registry.map((item) => item.caseId).sort())
console.log('Case mode UI tests passed: Guided, Conversation and Hybrid enabled for all six public cases with lazy governed assets.')
