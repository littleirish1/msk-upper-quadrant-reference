import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'mcqBankSchema.ts'), path.join(ROOT, 'src'))
const bank = schemas.mcqBankSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'mcq', 'bank.json'), 'utf8')))
assert.equal(bank.records.length, 20)
assert.equal(new Set(bank.records.map((record) => record.id)).size, 20)
assert.ok(bank.records.every((record) => record.lifecycle === 'source-insufficient' && record.authoredContent === null))
assert.ok(bank.records.every((record) => !record.publicEligibility && record.evidenceRecordIds.length === 0 && record.blockers.length > 0))

const valid = structuredClone(bank.records[0])
valid.lifecycle = 'draft'
valid.authoredContent = {
  stem: 'Synthetic governance fixture question?',
  options: [
    { id: 'a', text: 'Fixture A', explanation: 'Synthetic explanation A.', correct: false },
    { id: 'b', text: 'Fixture B', explanation: 'Synthetic explanation B.', correct: true },
    { id: 'c', text: 'Fixture C', explanation: 'Synthetic explanation C.', correct: false },
  ],
}
assert.equal(schemas.mcqBankItemSchema.safeParse(valid).success, true)
const invalid = structuredClone(valid)
invalid.authoredContent.options[0].correct = true
assert.equal(schemas.mcqBankItemSchema.safeParse(invalid).success, false)
const invalidPublic = structuredClone(valid)
invalidPublic.publicEligibility = true
assert.equal(schemas.mcqBankItemSchema.safeParse(invalidPublic).success, false)

const search = fs.readFileSync(path.join(ROOT, 'public', 'search-index.json'), 'utf8')
assert.ok(bank.records.every((record) => !search.includes(record.id)), 'private MCQ bank entered Search')
console.log('MCQ bank tests passed: 20 governed slots, one-best-answer/explanations enforced, 0 invented/public questions or Search entries.')
