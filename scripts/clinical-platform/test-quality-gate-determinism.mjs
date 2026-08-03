import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const outNext = path.join(root, 'out', '_next')
const reportPath = path.join(root, 'reports', 'clinical-platform', 'accessibility-mobile-performance.json')
if (!fs.existsSync(outNext)) throw new Error('Quality-gate determinism test requires out/. Run the production build first.')
const fixture = path.join(outNext, 'synthetic-build-variance.js')
const generate = () => {
  const result = spawnSync(process.execPath, ['scripts/clinical-platform/generate-quality-gates.mjs'], { cwd: root, encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
}

generate()
const before = fs.readFileSync(reportPath)
try {
  fs.writeFileSync(fixture, 'x'.repeat(3072))
  generate()
  const afterBuildVariance = fs.readFileSync(reportPath)
  assert.deepEqual(afterBuildVariance, before, 'tracked quality report must ignore invocation-dependent bundle byte variance within the enforced budget')
} finally {
  fs.rmSync(fixture, { force: true })
  generate()
}
assert.deepEqual(fs.readFileSync(reportPath), before)
console.log('Quality-gate determinism passed: a 3 KiB synthetic bundle variance did not change the tracked report.')
