import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  extractSearchHeadings,
  stripMdxForSearch,
} from './build-search-index.mjs'

let checks = 0

run('MDX module declarations and implementation syntax are excluded', () => {
  const source = [
    'import {',
    '  ClinicalNote,',
    '} from "@/components/clinical"',
    'export const metadata = { privateImplementation: true }',
    '# Learner heading',
    '<ClinicalNote>Useful learner text.</ClinicalNote>',
  ].join('\n')
  const indexed = stripMdxForSearch(source)
  assert.equal(indexed.includes('import'), false)
  assert.equal(indexed.includes('export'), false)
  assert.equal(indexed.includes('privateImplementation'), false)
  assert.match(indexed, /Learner heading Useful learner text\./)
})

run('cervicogenic search snippet starts with learner content without requiring a duplicate H1', () => {
  const file = path.join(process.cwd(), 'content', 'cervical', 'cervicogenic-headache.mdx')
  const indexed = stripMdxForSearch(fs.readFileSync(file, 'utf8'))
  assert.equal(indexed.includes('@/components/clinical'), false)
  assert.equal(indexed.startsWith('> Clinical Summary: Cervicogenic headache'), true)
})

run('fenced implementation examples and MDX expressions are excluded', () => {
  const source = [
    '# Learner heading',
    'Visible learner prose.',
    '```tsx',
    'export const privateImplementation = true',
    '```',
    '<ClinicalNote level={internalValue}>Safe child text.</ClinicalNote>',
  ].join('\n')
  const indexed = stripMdxForSearch(source)
  assert.match(indexed, /Learner heading Visible learner prose\. Safe child text\./)
  assert.equal(indexed.includes('privateImplementation'), false)
  assert.equal(indexed.includes('internalValue'), false)
})

run('search headings ignore headings inside fenced code blocks', () => {
  const source = [
    '# Public title',
    '```md',
    '## Not a learner heading',
    '```',
    '## Assessment',
  ].join('\n')
  assert.deepEqual(extractSearchHeadings(source), ['Public title', 'Assessment'])
})

console.log(`Search extraction tests passed. Deterministic assertions: ${checks}.`)

function run(name, action) {
  try {
    action()
    checks += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}
