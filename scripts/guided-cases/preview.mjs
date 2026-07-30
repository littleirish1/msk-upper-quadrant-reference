import fs from 'node:fs'
import path from 'node:path'
import { readRecords, stableJson, temporaryDirectory } from './shared.mjs'

const requestedId = process.argv.slice(2).find((value) => !value.startsWith('--'))
const outputArg = process.argv.find((value) => value.startsWith('--output='))?.slice('--output='.length)
const { module, records, findings } = await readRecords()
if (findings.length) throw new Error(findings.join('\n'))
const selected = requestedId
  ? records.filter(({ record }) => record.caseId === requestedId)
  : records
if (!selected.length) throw new Error('No matching guided case')
const output = outputArg ? path.resolve(outputArg) : temporaryDirectory('guided-case-preview-')
fs.mkdirSync(output, { recursive: true })
for (const { record } of selected) {
  const model = module.createInternalCaseReviewModel(record)
  fs.writeFileSync(path.join(output, `${record.caseId}.json`), stableJson({
    reviewerOnly: true,
    publicImmediate: record.publicationEligibility ? module.createPublicImmediateCase(record) : null,
    publicReveal: record.publicationEligibility ? module.createPublicRevealPayload(record) : null,
    internalReview: model,
  }), 'utf8')
}
console.log(`Private reviewer preview written outside public output: ${output}`)
