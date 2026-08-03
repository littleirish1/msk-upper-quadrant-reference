import { spawnSync } from 'node:child_process'
import { repositoryContent } from './currentness-git-state.mjs'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('npm_execpath is unavailable; run this check through npm.')
const before = repositoryContent()
const generation = spawnSync(process.execPath, [npmCli, 'run', 'clinical-platform:generate'], { cwd: process.cwd(), encoding: 'utf8', stdio: 'inherit' })
if (generation.error) throw generation.error
if (generation.status !== 0) process.exit(generation.status ?? 1)
const after = repositoryContent()

if (before !== after) {
  console.error('Clinical platform generated artefacts are stale. Regeneration changed repository content.')
  const changed = spawnSync('git', ['status', '--short', '--untracked-files=normal'], { cwd: process.cwd(), encoding: 'utf8' })
  process.stderr.write(changed.stdout)
  process.exit(1)
}

console.log('Clinical platform currentness passed: deterministic regeneration produced no Git-content changes.')
