import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'clinical-platform', 'legacy-case-reconciliation.json'), 'utf8'))
assert.equal(report.records.length, 47)
assert.equal(report.summary.total, 47)
assert.equal(report.summary.baselinePublicConverted, 3)
assert.equal(report.summary.governedDraftAwaitingReview, 3)
assert.equal(report.summary.sourceInsufficientAwaitingReview, 41)
assert.equal(report.summary.unaccounted, 0)
assert.equal(report.summary.newlyPublished, 0)
assert.equal(report.summary.newlyInventedAnswers, 0)
assert.equal(new Set(report.records.map((record) => record.stationId)).size, 47)
assert.ok(report.records.every((record) => /^[a-f0-9]{64}$/.test(record.sourceRevision)))
assert.ok(report.records.filter((record) => !record.publicEligibility).every((record) => record.blockers.length >= 3 && record.evidenceGapRecorded))
assert.ok(!JSON.stringify(report).match(/sourcePath|displayName|legacyTitle|[A-Za-z]:[\\/]/))
console.log('Legacy reconciliation tests passed: 47 accounted, 3 baseline conversions, 3 existing drafts, 41 source-insufficient, 0 new public cases.')
