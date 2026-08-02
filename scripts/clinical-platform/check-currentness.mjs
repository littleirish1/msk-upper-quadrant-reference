import { spawnSync } from 'node:child_process'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const status = () => {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: process.cwd(), encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Unable to inspect Git status.')
  return result.stdout.replace(/\r\n/g, '\n')
}

const before = status()
const generation = spawnSync(npm, ['run', 'clinical-platform:generate'], { cwd: process.cwd(), encoding: 'utf8', stdio: 'inherit' })
if (generation.status !== 0) process.exit(generation.status ?? 1)
const after = status()

if (before !== after) {
  console.error('Clinical platform generated artefacts are stale. Regeneration changed repository status.')
  const changed = spawnSync('git', ['status', '--short', '--untracked-files=normal'], { cwd: process.cwd(), encoding: 'utf8' })
  process.stderr.write(changed.stdout)
  process.exit(1)
}

console.log('Clinical platform currentness passed: deterministic regeneration produced no repository changes.')
