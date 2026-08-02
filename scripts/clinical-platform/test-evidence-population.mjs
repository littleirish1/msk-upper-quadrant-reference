import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { readDataset, loadEvidenceHubModule } from '../evidence-hub/shared.mjs'

const ROOT = process.cwd()
const hub = await loadEvidenceHubModule()
const { dataset, findings } = readDataset(hub)
assert.deepEqual(findings, [])
assert.equal(dataset.records.length, 3)
assert.equal(dataset.records.filter((record) => record.entityType === 'evidence').length, 3)
assert.equal(dataset.relationships.length, 0)
assert.equal(dataset.reviewDecisions.length, 0)
assert.equal(dataset.proposals.length, 0)
assert.equal(hub.buildPublicProjection(dataset).length, 0)
assert.ok(dataset.records.every((record) => !record.publicEligibility && record.reviewStatus === 'unreviewed'))
assert.ok(dataset.records.every((record) => record.entityType !== 'evidence' || (record.referenceIds.length === 0 && record.verificationStatus === 'extracted-unverified' && record.appraisalStatus === 'not-appraised')))

const summary = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'clinical-platform', 'evidence-hub-population.json'), 'utf8'))
assert.equal(summary.evidenceRecords, 3)
assert.equal(summary.claims, 0)
assert.equal(summary.publicRecords, 0)
assert.equal(summary.exactRevisionCoverage, 0)
assert.ok(Object.values(summary.explicitGapCollections).every((count) => count > 0))

console.log('Evidence Hub population tests passed: 3 genuine metadata records, explicit cross-system gaps, 0 claims/approvals/relationships/public records.')
