import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'clinical-platform', 'regional-content-matrix.json'), 'utf8'))
assert.equal(matrix.regions.length, 11)
assert.equal(matrix.requiredDomains.length, 19)
assert.equal(matrix.summary.domainCells, 209)
assert.equal(matrix.summary.liveBaselineRegions, 5)
assert.equal(matrix.summary.roadmapRegions, 4)
assert.equal(matrix.summary.crossCuttingAreas, 2)
assert.equal(matrix.summary.newClinicalClaims, 0)
assert.equal(matrix.summary.publicNewRoutes, 0)
assert.equal(new Set(matrix.regions.map((region) => region.slug)).size, 11)
for (const region of matrix.regions) {
  assert.deepEqual(region.domains.map((item) => item.domain), matrix.requiredDomains)
  assert.equal(region.publicNewRoutes, 0)
  assert.ok(region.domains.every((domain) => !domain.newContentCreated))
}
for (const required of ['cervical', 'shoulder', 'elbow', 'wrist-hand', 'thoracic', 'headache', 'lumbar', 'hip', 'knee', 'ankle-foot', 'neuro-systemic']) {
  assert.ok(matrix.regions.some((region) => region.slug === required), `missing regional matrix area ${required}`)
}
console.log('Regional matrix tests passed: 11 areas, 19 domains, 209 cells, explicit gaps, 0 new claims/routes.')
