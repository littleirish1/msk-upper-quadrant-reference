import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const roots = [
  'ai-manager/clinical-platform/shoulder',
  'reports/clinical-platform/shoulder',
  'content/evidence-hub/conditions',
  'content/evidence-hub/guided-cases',
  'content/evidence-hub/relationships/index.json',
  'content/evidence-hub/pilots',
  'ai-manager/clinical-platform/anatomy-3d/registry.json',
  'reports/clinical-platform/anatomy-3d-readiness.json',
  'ai-manager/clinical-platform/workspace/snapshot.json',
]
const before = snapshot()
const result = spawnSync(process.execPath, ['scripts/shoulder-vertical-slice/generate.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
const after = snapshot()
assertSame(before, after)
console.log(`Shoulder currentness passed: ${before.size} governed artefacts were byte-stable after regeneration.`)

function snapshot() {
  return new Map(roots.flatMap((item) => files(path.join(ROOT, item))).sort().map((file) => [
    path.relative(ROOT, file).split(path.sep).join('/'),
    crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  ]))
}

function files(item) {
  if (!fs.existsSync(item)) return []
  const stat = fs.statSync(item)
  if (stat.isFile()) return [item]
  return fs.readdirSync(item, { withFileTypes: true }).flatMap((entry) => files(path.join(item, entry.name)))
}

function assertSame(before, after) {
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter((key) => before.get(key) !== after.get(key))
  if (changed.length > 0) throw new Error(`Shoulder generated artefacts are stale: ${changed.join(', ')}`)
}
