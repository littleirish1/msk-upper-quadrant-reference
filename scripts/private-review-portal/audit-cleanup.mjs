import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = process.cwd()
const workspaceRoot = path.dirname(repositoryRoot)
const deleteCaches = process.argv.includes('--delete')
const output = path.join(repositoryRoot, 'reports', 'private-review-portal', 'cleanup-manifest.json')
const privateRoot = path.resolve(process.env.MSK_REVIEW_PORTAL_DATA_ROOT ?? (process.platform === 'win32' ? 'C:\\dev\\msk-private-review-data' : path.join(os.homedir(), '.local', 'share', 'msk-private-review-data')))
const protectedPaths = [
  'ai-manager/.venv-source-intake/',
  'ai-manager/private-cache/',
  'docs/reviews/current/',
]

function directoryBytes(root) {
  if (!fs.existsSync(root)) return 0
  let total = 0
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) visit(candidate)
      else total += fs.statSync(candidate).size
    }
  }
  visit(root)
  return total
}

function git(directory, args) {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  return result.status === 0 ? result.stdout.trim() : null
}

function metadata(candidate) {
  const stat = fs.statSync(candidate)
  return { date: stat.lastWriteTime ?? stat.mtime.toISOString() }
}

const entries = []
const add = (value) => entries.push({ relatedBranch: null, relatedSha: null, estimatedRecoverableBytes: 0, ...value })
const topLevel = fs.readdirSync(workspaceRoot, { withFileTypes: true })

for (const entry of topLevel) {
  const candidate = path.join(workspaceRoot, entry.name)
  const date = fs.statSync(candidate).mtime.toISOString()
  if (path.resolve(candidate) === privateRoot) {
    add({ path: candidate, type: 'private-document-storage', sizeBytes: null, date, recommendation: 'excluded-no-inspection', reason: 'Private document storage is outside cleanup scope and was not traversed.' })
    continue
  }
  if (entry.name === '.npm-cache-msk-review') continue
  if (entry.isFile() && /(?:review|packet).*\.zip$/i.test(entry.name)) {
    add({ path: candidate, type: 'review-zip', sizeBytes: fs.statSync(candidate).size, date, recommendation: 'keep-or-archive-after-human-review', reason: 'Review packets and final manifests are never automatically deleted.' })
    continue
  }
  if (!entry.isDirectory()) continue
  const gitMarker = path.join(candidate, '.git')
  if (fs.existsSync(gitMarker)) {
    const sha = git(candidate, ['rev-parse', 'HEAD'])
    const branch = git(candidate, ['branch', '--show-current']) || 'detached'
    add({ path: candidate, type: candidate === repositoryRoot ? 'active-repository' : 'repository-or-worktree', sizeBytes: null, date, relatedBranch: branch, relatedSha: sha, recommendation: candidate === repositoryRoot ? 'keep-active' : 'manual-review', reason: 'Worktrees and repository copies are never automatically deleted.' })
    const modules = path.join(candidate, 'node_modules')
    if (fs.existsSync(modules)) add({ path: modules, type: 'node_modules', sizeBytes: candidate === repositoryRoot ? directoryBytes(modules) : null, date: fs.statSync(modules).mtime.toISOString(), relatedBranch: branch, relatedSha: sha, recommendation: 'keep-or-manual-remove', reason: candidate === repositoryRoot ? 'Active node_modules is retained; its size is measured for the audit.' : 'External node_modules is identified but not traversed or automatically deleted.' })
    continue
  }
  if (/(?:review|packet|worktree|repo|visual)/i.test(entry.name)) add({ path: candidate, type: 'review-packet-or-workspace', sizeBytes: null, date, recommendation: 'manual-review', reason: 'Potential source, active packet, preview, worktree or repository material is never automatically deleted.' })
}

for (const relative of ['.next', 'out', 'coverage']) {
  const candidate = path.join(repositoryRoot, relative)
  if (!fs.existsSync(candidate)) continue
  const sizeBytes = directoryBytes(candidate)
  add({ path: candidate, type: 'regenerable-build-cache', sizeBytes, date: fs.statSync(candidate).mtime.toISOString(), recommendation: 'delete', reason: 'Unambiguous regenerable project output.', estimatedRecoverableBytes: sizeBytes, automaticDeletion: deleteCaches })
  if (deleteCaches) fs.rmSync(candidate, { recursive: true, force: true })
}

const npmCache = path.join(workspaceRoot, '.npm-cache-msk-review')
if (fs.existsSync(npmCache)) {
  const sizeBytes = directoryBytes(npmCache)
  add({ path: npmCache, type: 'task-package-manager-cache', sizeBytes, date: fs.statSync(npmCache).mtime.toISOString(), recommendation: 'delete', reason: 'Task-scoped npm registry/cache output is regenerable.', estimatedRecoverableBytes: sizeBytes, automaticDeletion: deleteCaches })
  if (deleteCaches) fs.rmSync(npmCache, { recursive: true, force: true })
}

for (const entry of fs.readdirSync(os.tmpdir(), { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('msk-private-portal-test-')) continue
  const candidate = path.join(os.tmpdir(), entry.name)
  const sizeBytes = directoryBytes(candidate)
  add({ path: candidate, type: 'known-portal-test-temp', sizeBytes, date: fs.statSync(candidate).mtime.toISOString(), recommendation: 'delete', reason: 'Known synthetic portal-test temporary directory.', estimatedRecoverableBytes: sizeBytes, automaticDeletion: deleteCaches })
  if (deleteCaches) fs.rmSync(candidate, { recursive: true, force: true })
}

for (const entry of fs.readdirSync(repositoryRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.log')) {
    const candidate = path.join(repositoryRoot, entry.name)
    add({ path: candidate, type: 'repository-log', sizeBytes: fs.statSync(candidate).size, date: fs.statSync(candidate).mtime.toISOString(), recommendation: 'manual-review', reason: 'Logs are not deleted automatically unless they are a known test temporary.' })
  }
}

const pruneDryRun = spawnSync('git', ['worktree', 'prune', '--dry-run', '--verbose'], { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 })
if (pruneDryRun.status !== 0) throw new Error(pruneDryRun.stderr || 'git worktree prune --dry-run failed')
const staleWorktreeRecords = pruneDryRun.stdout.split(/\r?\n/).filter(Boolean)
if (deleteCaches && staleWorktreeRecords.length) {
  const prune = spawnSync('git', ['worktree', 'prune', '--verbose'], { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 })
  if (prune.status !== 0) throw new Error(prune.stderr || 'git worktree prune failed')
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  repositoryRoot,
  mode: deleteCaches ? 'audit-and-delete-unambiguous-caches' : 'read-only-audit',
  exclusions: { privateRoot, protectedPaths, statement: 'Excluded paths were not traversed, hashed, copied, archived, modified or deleted.' },
  staleGitAdministrativeRecords: staleWorktreeRecords,
  entries,
  automaticDeletions: entries.filter((entry) => entry.automaticDeletion).map((entry) => ({ path: entry.path, recoveredBytes: entry.estimatedRecoverableBytes, type: entry.type })),
  recoveredBytes: entries.filter((entry) => entry.automaticDeletion).reduce((total, entry) => total + entry.estimatedRecoverableBytes, 0),
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Cleanup audit wrote ${path.relative(repositoryRoot, output)}: ${entries.length} entries, ${report.automaticDeletions.length} automatic deletions, ${report.recoveredBytes} recovered bytes.`)
