import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { stripMdxForSearch } from './build-search-index.mjs'

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

run('cervicogenic search snippet starts with learner content', () => {
  const file = path.join(process.cwd(), 'content', 'cervical', 'cervicogenic-headache.mdx')
  const indexed = stripMdxForSearch(fs.readFileSync(file, 'utf8'))
  assert.equal(indexed.includes('@/components/clinical'), false)
  assert.equal(indexed.startsWith('Cervicogenic Headache'), true)
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
