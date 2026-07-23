import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const root = process.cwd()
const conditions = await loadTypeScriptTree(
  path.join(root, 'src', 'lib', 'publicConditions.ts'),
  path.join(root, 'src'),
)
let checks = 0

const taxonomy = [
  { region: 'shoulder', condition: 'eligible' },
  { region: 'shoulder', condition: 'draft' },
  { region: 'shoulder', condition: 'private' },
  { region: 'shoulder', condition: 'missing' },
]
const frontmatter = (title, extra = {}) => ({
  title,
  region: 'shoulder',
  ...extra,
})
const selection = conditions.selectPublicConditionCandidates(taxonomy, [
  { region: 'shoulder', condition: 'eligible', frontmatter: frontmatter('Eligible') },
  { region: 'shoulder', condition: 'draft', frontmatter: frontmatter('Draft', { status: 'draft' }) },
  { region: 'shoulder', condition: 'private', frontmatter: frontmatter('Private', { status: 'private', publicEligibility: false }) },
  { region: 'shoulder', condition: 'extra', frontmatter: frontmatter('Extra', { status: 'published', publicEligibility: true }) },
])

run('eligible condition is selected', () => {
  assert.deepEqual(selection.eligible.map((item) => item.condition), ['eligible'])
})
run('draft and private taxonomy conditions are excluded', () => {
  assert.equal(selection.mismatches.some((item) => item.includes('not public eligible: shoulder/draft')), true)
  assert.equal(selection.mismatches.some((item) => item.includes('not public eligible: shoulder/private')), true)
})
run('missing taxonomy condition fails alignment', () => {
  assert.equal(selection.mismatches.some((item) => item.includes('missing content: shoulder/missing')), true)
})
run('eligible content missing from taxonomy fails alignment', () => {
  assert.equal(selection.mismatches.some((item) => item.includes('absent from taxonomy: shoulder/extra')), true)
})
run('explicit false eligibility is fail-closed', () => {
  assert.equal(conditions.isPublicConditionFrontmatter(frontmatter('Blocked', { publicEligibility: false })), false)
})
run('review-required condition is fail-closed', () => {
  assert.equal(conditions.isPublicConditionFrontmatter(frontmatter('Review', { clinicianReviewStatus: 'clinician-review-required' })), false)
})

console.log(`Public condition selector tests passed. Deterministic assertions: ${checks}.`)

function run(name, action) {
  try {
    action()
    checks += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}
