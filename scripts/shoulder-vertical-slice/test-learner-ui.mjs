import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const component = fs.readFileSync(path.join(ROOT, 'src', 'components', 'shoulder', 'ShoulderLearningDashboard.tsx'), 'utf8')
const regionPage = fs.readFileSync(path.join(ROOT, 'src', 'app', '[region]', 'page.tsx'), 'utf8')
assert.ok(regionPage.includes("region.slug === 'shoulder'"))
assert.ok(component.includes('Shoulder learning pathway'))
assert.ok(component.includes('Guided') && component.includes('Conversation') && component.includes('Hybrid'))
assert.ok(component.includes('No 3D route or model asset is public.'))
assert.ok(component.includes('No unreviewed shoulder MCQ or answer is published.'))
assert.ok(!/ai-manager|privateDiagnosticIdentity|likelyDiagnosis|evidence-map|source-inventory/.test(component))
assert.ok(component.includes('min-h-11'))
assert.ok(component.includes('min-h-16'))

const outFile = path.join(ROOT, 'out', 'shoulder', 'index.html')
if (process.argv.includes('--require-output')) {
  assert.ok(fs.existsSync(outFile), 'Shoulder static output is required')
  const html = fs.readFileSync(outFile, 'utf8')
  assert.ok(html.includes('Shoulder learning pathway'))
  assert.ok(html.includes('Reason before you reveal'))
  assert.ok(!/mcq-slot\.shoulder-slice|asset3d\.shoulder|source\.repository\.shoulder|private-shoulder/i.test(html))
}

console.log('Shoulder learner UI tests passed: public-safe taxonomy/case inputs, three case modes, 44px controls, no private shoulder identifiers.')
