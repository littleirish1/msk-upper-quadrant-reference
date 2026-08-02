import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'reports', 'clinical-platform', 'accessibility-mobile-performance.json'), 'utf8'))
assert.equal(report.generatedAt, null)
assert.ok(report.automated.routeCount >= 65)
assert.ok(report.automated.checks.every((check) => check.status === 'pass'))
assert.ok(report.automated.totalJavascriptBytes <= 2 * 1024 * 1024)
assert.ok(report.automated.largestJavascriptBytes <= 256 * 1024)
assert.deepEqual(new Set(report.manualMatrix.map((item) => item.viewport)), new Set(['320x568', '375x667', '768x1024', '1024x768', '1440x900']))
assert.ok(report.manualMatrix.every((item) => item.status === 'manual-required'))
assert.equal(report.humanSignOffRecorded, false)
assert.equal(report.releaseEligibility, false)
assert.ok(report.blockers.length >= 3)
console.log(`Quality gate tests passed: ${report.automated.routeCount} routes, ${report.automated.totalJavascriptBytes} JavaScript bytes, human sign-off remains explicit.`)
