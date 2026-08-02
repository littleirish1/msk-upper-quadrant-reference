import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8')

const [home, cases, anatomy, header, layout, styles] = await Promise.all([
  read('src/app/page.tsx'),
  read('src/app/cases/page.tsx'),
  read('src/app/anatomy/page.tsx'),
  read('src/components/layout/Header.tsx'),
  read('src/app/layout.tsx'),
  read('src/app/globals.css'),
])

assert.match(home, /Build clinical reasoning, one decision at a time\./)
assert.match(home, /Review required · route withheld/)
assert.match(home, /Search only returns content approved/)
assert.doesNotMatch(home, /href=["']\/(?:3d-model|movement|mcq)/)

for (const mode of ['Guided', 'Conversation', 'Hybrid']) {
  assert.match(cases, new RegExp(`name: '${mode}'`))
}
assert.match(cases, /Diagnosis and reasoning remain hidden until revealed\./)
assert.match(anatomy, /Governed 3D viewer/)
assert.match(anatomy, /Movement learning/)
assert.match(anatomy, /No public model or viewer route is released\./)
assert.doesNotMatch(anatomy, /href=["']\/(?:3d-model|movement|mcq)/)

assert.match(header, /MSK Reasoning Lab/)
assert.match(layout, /href="#main-content"/)
assert.match(layout, /id="main-content"/)
assert.match(styles, /:focus-visible/)
assert.match(styles, /outline: 3px solid #2dd4bf/)

console.log('Visual system checks passed: governed public states, case modes, navigation, and keyboard focus.')
