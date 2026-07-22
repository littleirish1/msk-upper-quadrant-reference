import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const BROAD_UNTRACKED_ROOTS = [
  'content',
  'docs',
  'public',
  'src',
  'ai-manager',
]

export const GENERATED_PUBLIC_ROOTS = [
  'out',
]

export const GOVERNED_UNTRACKED_PREFIXES = [
  'ai-manager/private-cache',
  'ai-manager/.venv-source-intake',
  'docs/reviews/current',
]

export function collectHygieneScope(root = process.cwd()) {
  const repoRoot = resolveGitRoot(root)
  const candidates = new Map()
  const skipped = {
    governedUntracked: 0,
  }

  for (const relativePath of gitList(repoRoot, ['ls-files', '-z', '--cached'])) {
    addCandidate(candidates, repoRoot, relativePath, 'git-index')
  }

  for (const relativePath of gitList(repoRoot, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT'])) {
    addCandidate(candidates, repoRoot, relativePath, 'git-staged')
  }

  for (const relativePath of gitList(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z'])) {
    const normalized = normalizeRepoPath(relativePath)
    if (!isBroadUntrackedPath(normalized)) continue
    if (isGovernedUntrackedWorkingPath(normalized)) {
      skipped.governedUntracked += 1
      continue
    }
    addCandidate(candidates, repoRoot, normalized, 'broad-untracked')
  }

  for (const rootName of ['public', ...GENERATED_PUBLIC_ROOTS]) {
    for (const relativePath of collectFiles(repoRoot, rootName)) {
      addCandidate(candidates, repoRoot, relativePath, rootName === 'public' ? 'public-source' : 'generated-public')
    }
  }

  return {
    root: repoRoot,
    files: [...candidates.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    skipped,
  }
}

export function isBroadUntrackedPath(relativePath) {
  const normalized = normalizeRepoPath(relativePath)
  return BROAD_UNTRACKED_ROOTS.some((root) => isPathAtOrInside(normalized, root))
}

export function isGovernedUntrackedWorkingPath(relativePath) {
  const normalized = normalizeRepoPath(relativePath)
  return GOVERNED_UNTRACKED_PREFIXES.some((prefix) => isPathAtOrInside(normalized, prefix))
}

export function normalizeRepoPath(value) {
  const normalized = path.posix
    .normalize(String(value).replace(/\\/g, '/'))
    .replace(/^\.\/+/, '')

  if (normalized === '.') return ''
  return normalized
}

export function isPathAtOrInside(relativePath, prefix) {
  const normalized = normalizeRepoPath(relativePath)
  const normalizedPrefix = normalizeRepoPath(prefix)
  return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`)
}

function addCandidate(candidates, root, relativePath, category) {
  const normalized = normalizeRepoPath(relativePath)
  if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return

  const fullPath = path.join(root, ...normalized.split('/'))
  if (!fs.existsSync(fullPath)) return
  if (!fs.statSync(fullPath).isFile()) return

  const existing = candidates.get(normalized)
  if (existing) {
    existing.categories.add(category)
    return
  }

  candidates.set(normalized, {
    relativePath: normalized,
    fullPath,
    categories: new Set([category]),
  })
}

function collectFiles(root, relativeRoot) {
  const start = path.join(root, ...normalizeRepoPath(relativeRoot).split('/'))
  if (!fs.existsSync(start) || !fs.statSync(start).isDirectory()) return []

  const files = []
  walk(start)
  return files

  function walk(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
      } else if (entry.isFile()) {
        files.push(normalizeRepoPath(path.relative(root, entryPath)))
      }
    }
  }
}

function resolveGitRoot(root) {
  const fallback = path.resolve(root)
  try {
    const output = execGit(fallback, ['rev-parse', '--show-toplevel'])
    return path.resolve(output.trim())
  } catch {
    return fallback
  }
}

function gitList(root, args) {
  return parseNullList(execGit(root, args))
}

function execGit(root, args) {
  return execFileSync('git', ['-c', `safe.directory=${toGitPath(root)}`, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function parseNullList(output) {
  return output.split('\0').filter(Boolean)
}

function toGitPath(value) {
  return path.resolve(value).split(path.sep).join('/')
}
