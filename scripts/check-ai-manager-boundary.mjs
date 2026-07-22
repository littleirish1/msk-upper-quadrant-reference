import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const SRC_DIR = path.join(ROOT, 'src')
const findings = []

const validation = spawnSync(process.execPath, ['ai-manager/scripts/validate-manager.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: false,
})
if (validation.stdout) process.stdout.write(validation.stdout)
if (validation.stderr) process.stderr.write(validation.stderr)
if (validation.status !== 0) findings.push('private manager schema/config validation failed')

if (fs.existsSync(path.join(OUT_DIR, 'ai-manager'))) findings.push('out/ai-manager exists')

for (const file of collectFiles(SRC_DIR, (item) => /\.(?:js|jsx|ts|tsx)$/.test(item))) {
  const source = fs.readFileSync(file, 'utf8')
  if (/from\s+['"][^'"]*ai-manager|import\s*\([^)]*ai-manager/.test(source)) {
    findings.push(`public source imports ai-manager: ${relative(file)}`)
  }
}

for (const file of collectFiles(OUT_DIR, () => true)) {
  if (relative(file).toLowerCase().includes('ai-manager')) findings.push(`public output contains ai-manager path: ${relative(file)}`)
}

if (findings.length) {
  console.error('AI manager boundary check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log('AI manager boundary check passed. Public ai-manager files: 0; provider mode: disabled; network required: false.')

function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(item, predicate) : entry.isFile() && predicate(item) ? [item] : []
  }).sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
