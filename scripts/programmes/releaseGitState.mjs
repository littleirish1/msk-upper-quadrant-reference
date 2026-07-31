import { spawnSync } from 'node:child_process'

const FULL_SHA = /^[0-9a-f]{40}$/

export function resolveReleaseGitState({ root = process.cwd(), env = process.env } = {}) {
  assertGitRepository(root)
  const commitRef = clean(env.COMMIT_REF)
  const commitFromEnvironment = commitRef
    ? resolveOptionalCommit(root, commitRef, 'current commit environment ref')
    : null
  const currentCommit = commitFromEnvironment ?? resolveRequiredCommit(root, 'HEAD', 'current HEAD')
  const currentTree = resolveRequiredTree(root, currentCommit, 'current commit tree')
  const comparison = resolveComparisonBase({ root, env, currentCommit })

  return {
    current: {
      source: commitFromEnvironment ? 'COMMIT_REF' : 'HEAD',
      commit: currentCommit,
      tree: currentTree,
      commitRefUnavailable: Boolean(commitRef && !commitFromEnvironment),
    },
    comparison,
    governanceSource: 'complete-current-tree',
  }
}

export function formatReleaseGitMetadata(state) {
  const comparison = state.comparison.available
    ? `${state.comparison.source}:${state.comparison.commit}`
    : 'full-tree-fallback'
  return [
    `current=${state.current.commit}`,
    `tree=${state.current.tree}`,
    `currentSource=${state.current.source}`,
    `comparison=${comparison}`,
    `governanceSource=${state.governanceSource}`,
  ].join('; ')
}

function resolveComparisonBase({ root, env, currentCommit }) {
  const explicit = clean(env.RELEASE_GOVERNANCE_BASE_REF)
  if (explicit) {
    const commit = resolveOptionalCommit(root, explicit, 'explicit comparison base')
    if (!commit) {
      throw new Error('Release governance Git resolution failed: explicit comparison base is unavailable.')
    }
    return comparisonResult(root, 'RELEASE_GOVERNANCE_BASE_REF', commit, currentCommit)
  }

  if (clean(env.NETLIFY)?.toLowerCase() === 'true') {
    const cached = clean(env.CACHED_COMMIT_REF)
    if (cached) {
      const commit = resolveOptionalCommit(root, cached, 'Netlify cached comparison base')
      if (commit && commit !== currentCommit) {
        return availableComparison(root, 'CACHED_COMMIT_REF', commit)
      }
    }
    return unavailableComparison()
  }

  for (const [source, ref] of [['main', 'main'], ['origin/main', 'origin/main']]) {
    const commit = resolveOptionalCommit(root, ref, `local ${source} comparison base`)
    if (commit && commit !== currentCommit) return availableComparison(root, source, commit)
  }
  return unavailableComparison()
}

function comparisonResult(root, source, commit, currentCommit) {
  if (commit === currentCommit) return unavailableComparison()
  return availableComparison(root, source, commit)
}

function availableComparison(root, source, commit) {
  return {
    available: true,
    source,
    commit,
    tree: resolveRequiredTree(root, commit, `${source} comparison tree`),
  }
}

function unavailableComparison() {
  return { available: false, source: 'full-tree-fallback', commit: null, tree: null }
}

function resolveOptionalCommit(root, ref, category) {
  const result = runGit(root, ['rev-parse', '--verify', `${ref}^{commit}`])
  if (result.status !== 0) return null
  const commit = result.stdout.trim().toLowerCase()
  if (!FULL_SHA.test(commit)) {
    throw new Error(`Release governance Git resolution failed: ${category} did not resolve to a full commit.`)
  }
  return commit
}

function resolveRequiredCommit(root, ref, category) {
  const commit = resolveOptionalCommit(root, ref, category)
  if (!commit) throw new Error(`Release governance Git resolution failed: ${category} is unavailable.`)
  return commit
}

function resolveRequiredTree(root, commit, category) {
  const result = runGit(root, ['rev-parse', '--verify', `${commit}^{tree}`])
  if (result.status !== 0) {
    throw new Error(`Release governance Git resolution failed: ${category} is unavailable.`)
  }
  const tree = result.stdout.trim().toLowerCase()
  if (!FULL_SHA.test(tree)) {
    throw new Error(`Release governance Git resolution failed: ${category} did not resolve to a full tree.`)
  }
  return tree
}

function runGit(root, args, { attempts = 3, delayMs = 50 } = {}) {
  let result = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    })
    if (!result.error && result.status === 0) return result
    if (attempt < attempts - 1) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
    }
  }
  if (!result || result.error) {
    throw new Error('Release governance Git operation failed before a ref could be resolved.')
  }
  return result
}

function assertGitRepository(root) {
  const result = runGit(root, ['rev-parse', '--git-dir'], { attempts: 10, delayMs: 250 })
  if (result.status !== 0) {
    throw new Error('Release governance Git resolution failed: repository metadata is unavailable.')
  }
}

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
