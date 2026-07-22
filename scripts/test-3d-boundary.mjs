import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanPublic3dBoundary } from './check-3d-prototype.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-3d-boundary-'))
let checks = 0

try {
  expectViolation('public route', {
    'src/app/3d-model/page.tsx': 'export default function Page() { return null }',
  }, 'Public 3D route source found')
  expectViolation('public GLB', { 'public/models/body.glb': Buffer.from([0x67, 0x6c, 0x54, 0x46]) }, 'Public model payload found')
  expectViolation('public GLTF', { 'public/models/body.gltf': '{}' }, 'Public model payload found')
  expectViolation('public navigation', { 'src/components/Nav.tsx': 'const link = { href: "/3d-model" }' }, 'Public 3D route reference found')
  expectViolation('public Draco payload', { 'public/models/body.drc': Buffer.from([0x44, 0x52, 0x41, 0x43, 0x4f]) }, 'Public model payload found')
  expectViolation('exported route', { 'out/3d-model/index.html': '<!doctype html>' }, 'Exported 3D route found')
  expectViolation('redirect alias', { 'netlify.toml': 'from = "/model"\nto = "/3d-model"' }, 'Public 3D route reference found')
  expectPass('private documentation', { 'ai-manager/experimental/3d-model/README.md': 'Private 3D notes only.' })
  expectPass('clean public surface', { 'src/app/page.tsx': 'export default function Page() { return null }' })

  console.log('3D boundary regression tests passed.')
  console.log(`Deterministic scenarios checked: ${checks}`)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

function expectViolation(name, files, expected) {
  const fixture = createFixture(name, files)
  const result = scanPublic3dBoundary(fixture)
  checks += 1
  assert.ok(result.findings.some((finding) => finding.includes(expected)), `${name}: expected ${expected}`)
}

function expectPass(name, files) {
  const fixture = createFixture(name, files)
  const result = scanPublic3dBoundary(fixture)
  checks += 1
  assert.deepEqual(result.findings, [], `${name}: expected a clean boundary`)
}

function createFixture(name, files) {
  const fixture = path.join(root, name.replace(/\s+/g, '-'))
  fs.mkdirSync(fixture, { recursive: true })
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(fixture, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return fixture
}
