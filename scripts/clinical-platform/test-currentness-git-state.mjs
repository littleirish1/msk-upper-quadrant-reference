import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { GIT_CAPTURE_MAX_BUFFER, repositoryContent } from './currentness-git-state.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-currentness-buffer-'))
const runGit = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
}

try {
  runGit(['init', '--quiet'])
  runGit(['config', 'user.name', 'Synthetic Test'])
  runGit(['config', 'user.email', 'synthetic@example.invalid'])
  const file = path.join(root, 'large-generated-record.txt')
  fs.writeFileSync(file, `${'baseline-line\n'.repeat(100_000)}`)
  runGit(['add', '--', 'large-generated-record.txt'])
  runGit(['commit', '--quiet', '-m', 'Synthetic baseline'])
  fs.writeFileSync(file, `${'changed-line\n'.repeat(100_000)}`)

  const state = JSON.parse(repositoryContent(root))
  assert.ok(state.unstagedPatch.length > 1024 * 1024, 'fixture must exceed Node\'s historical 1 MiB capture limit')
  assert.equal(state.stagedPatch, '')
  assert.deepEqual(state.untrackedFiles, [])
  assert.equal(GIT_CAPTURE_MAX_BUFFER, 200 * 1024 * 1024)
  console.log(`Currentness Git-state capture passed with a ${state.unstagedPatch.length}-byte patch and a ${GIT_CAPTURE_MAX_BUFFER}-byte buffer.`)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
