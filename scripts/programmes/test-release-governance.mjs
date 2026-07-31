import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { resolveReleaseGitState } from './releaseGitState.mjs'
import { RELEASE_OUTPUTS, ROOT, loadProgrammeSchemas } from './shared.mjs'

const schemas = await loadProgrammeSchemas()
const governance = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'programmes', 'reviewGovernance.ts'),
  path.join(ROOT, 'src'),
)
let assertions = 0
const review = schemas.exactRevisionReviewSchema.parse({
  schemaVersion: 1,
  reviewId: 'review.condition.shoulder.example',
  targetId: 'condition.shoulder.example',
  targetRevision: 'revision-1',
  targetChecksum: `sha256:${'1'.repeat(64)}`,
  domain: 'management',
  reviewerRole: 'clinician',
  reviewerId: 'reviewer-opaque-1',
  reviewDate: '2026-07-31',
  decision: 'approve',
  limitations: ['Applies only to this revision.'],
  nextReviewDate: '2027-07-31',
  stale: false,
})
const target = { id: review.targetId, revision: review.targetRevision, checksum: review.targetChecksum }
assert.equal(governance.reviewAppliesToTarget(review, target), true); assertions++
assert.equal(governance.reviewAppliesToTarget(review, { ...target, revision: 'revision-2' }), false); assertions++
const invalidated = governance.invalidateReviewForChangedTarget(review, { ...target, checksum: `sha256:${'2'.repeat(64)}` })
assert.equal(invalidated.stale, true); assertions++
assert.equal(invalidated.decision, 'pending'); assertions++
assert.equal(review.decision, 'approve'); assertions++

const beta = {
  schemaVersion: 1,
  status: 'planned',
  participantGroups: ['physiotherapy-student', 'band-5-clinician', 'experienced-msk-clinician', 'clinical-educator'],
  resultsRecorded: false,
  feedbackItems: [],
  consentReviewRequired: true,
  privacyReviewRequired: true,
  publicationApprovalGranted: false,
}
assert.equal(schemas.betaFrameworkSchema.safeParse(beta).success, true); assertions++
assert.equal(schemas.betaFrameworkSchema.safeParse({ ...beta, resultsRecorded: true }).success, false); assertions++

const fixtureRoot = fs.mkdtempSync(path.join(ROOT, '.tmp-release-git-state-'))
try {
  git(fixtureRoot, 'init', '-b', 'main')
  git(fixtureRoot, 'config', 'user.name', 'Fixture Reviewer')
  git(fixtureRoot, 'config', 'user.email', 'fixture.invalid')
  git(fixtureRoot, 'commit', '--allow-empty', '-m', 'fixture baseline')
  const baselineCommit = git(fixtureRoot, 'rev-parse', 'HEAD')
  git(fixtureRoot, 'switch', '-c', 'fixture-feature')
  git(fixtureRoot, 'commit', '--allow-empty', '-m', 'fixture current')
  const currentCommit = git(fixtureRoot, 'rev-parse', 'HEAD')

  const localBranch = resolveReleaseGitState({ root: fixtureRoot, env: releaseEnv() })
  assert.equal(localBranch.current.commit, currentCommit); assertions++
  assert.equal(localBranch.current.source, 'HEAD'); assertions++
  assert.equal(localBranch.comparison.source, 'main'); assertions++
  assert.equal(localBranch.comparison.commit, baselineCommit); assertions++

  const commitRef = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ COMMIT_REF: currentCommit, HEAD: 'not-a-git-reference' }),
  })
  assert.equal(commitRef.current.source, 'COMMIT_REF'); assertions++
  assert.equal(commitRef.current.commit, currentCommit); assertions++

  const invalidCommitRef = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ COMMIT_REF: 'unavailable-current-ref' }),
  })
  assert.equal(invalidCommitRef.current.source, 'HEAD'); assertions++
  assert.equal(invalidCommitRef.current.commitRefUnavailable, true); assertions++

  const cachedBase = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ NETLIFY: 'true', COMMIT_REF: currentCommit, CACHED_COMMIT_REF: baselineCommit }),
  })
  assert.equal(cachedBase.comparison.source, 'CACHED_COMMIT_REF'); assertions++
  assert.equal(cachedBase.comparison.commit, baselineCommit); assertions++

  const sameCachedBase = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ NETLIFY: 'true', COMMIT_REF: currentCommit, CACHED_COMMIT_REF: currentCommit }),
  })
  assert.equal(sameCachedBase.comparison.available, false); assertions++

  const unavailableCachedBase = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ NETLIFY: 'true', COMMIT_REF: currentCommit, CACHED_COMMIT_REF: 'unavailable-cached-ref' }),
  })
  assert.equal(unavailableCachedBase.comparison.available, false); assertions++

  const explicitBase = resolveReleaseGitState({
    root: fixtureRoot,
    env: releaseEnv({ RELEASE_GOVERNANCE_BASE_REF: baselineCommit }),
  })
  assert.equal(explicitBase.comparison.source, 'RELEASE_GOVERNANCE_BASE_REF'); assertions++
  assert.equal(explicitBase.comparison.commit, baselineCommit); assertions++

  assert.throws(
    () => resolveReleaseGitState({
      root: fixtureRoot,
      env: releaseEnv({ RELEASE_GOVERNANCE_BASE_REF: 'sensitive-invalid-ref' }),
    }),
    (error) => {
      assert.match(error.message, /explicit comparison base is unavailable/); assertions++
      assert.doesNotMatch(error.message, /sensitive-invalid-ref/); assertions++
      return true
    },
  )

  git(fixtureRoot, 'switch', '--detach', currentCommit)
  git(fixtureRoot, 'branch', '-D', 'fixture-feature')
  git(fixtureRoot, 'branch', '-D', 'main')
  git(fixtureRoot, 'update-ref', '-d', 'refs/remotes/origin/main')
  assert.equal(gitStatus(fixtureRoot, 'rev-parse', '--verify', 'main^{commit}'), 128); assertions++
  assert.equal(gitStatus(fixtureRoot, 'rev-parse', '--verify', 'origin/main^{commit}'), 128); assertions++
  const detached = resolveReleaseGitState({ root: fixtureRoot, env: releaseEnv() })
  assert.equal(detached.current.commit, currentCommit); assertions++
  assert.equal(detached.comparison.available, false); assertions++
  assert.equal(detached.governanceSource, 'complete-current-tree'); assertions++
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

const detachedRoot = fs.mkdtempSync(path.join(ROOT, '.tmp-release-detached-project-'))
try {
  git(detachedRoot, 'init', '-b', 'main')
  git(detachedRoot, 'config', 'user.name', 'Fixture Reviewer')
  git(detachedRoot, 'config', 'user.email', 'fixture.invalid')
  git(detachedRoot, 'commit', '--allow-empty', '-m', 'fixture baseline')
  const detachedBaseline = git(detachedRoot, 'rev-parse', 'HEAD')
  git(detachedRoot, 'switch', '-c', 'fixture-feature')
  git(detachedRoot, 'commit', '--allow-empty', '-m', 'fixture current')
  const detachedCurrent = git(detachedRoot, 'rev-parse', 'HEAD')
  const fixtureGitEnvironment = (overrides = {}) => releaseEnv({
    GIT_DIR: path.join(detachedRoot, '.git'),
    GIT_WORK_TREE: ROOT,
    ...overrides,
  })

  const branchOutput = path.join(detachedRoot, '.test-output-branch')
  runNode(
    ROOT,
    'scripts/programmes/generate-release-governance.mjs',
    [`--output=${branchOutput}`],
    fixtureGitEnvironment(),
  )

  git(detachedRoot, 'switch', '--detach', detachedCurrent)
  git(detachedRoot, 'branch', '-D', 'fixture-feature')
  git(detachedRoot, 'branch', '-D', 'main')
  git(detachedRoot, 'update-ref', '-d', 'refs/remotes/origin/main')
  fs.writeFileSync(path.join(detachedRoot, '.git', 'shallow'), `${detachedCurrent}\n`, 'utf8')
  assert.equal(git(detachedRoot, 'rev-parse', '--is-shallow-repository'), 'true'); assertions++

  const detachedOutput = path.join(detachedRoot, '.test-output-detached')
  const detachedRun = runNode(
    ROOT,
    'scripts/programmes/generate-release-governance.mjs',
    [`--output=${detachedOutput}`],
    fixtureGitEnvironment({ NETLIFY: 'true', COMMIT_REF: detachedCurrent, CACHED_COMMIT_REF: detachedCurrent }),
  )
  assert.match(detachedRun.stdout, /comparison=full-tree-fallback/); assertions++
  assert.match(detachedRun.stdout, /governanceSource=complete-current-tree/); assertions++

  for (const output of RELEASE_OUTPUTS) {
    assert.equal(
      fs.readFileSync(path.join(branchOutput, output), 'utf8'),
      fs.readFileSync(path.join(detachedOutput, output), 'utf8'),
      `${output} must be identical on a branch and detached HEAD`,
    ); assertions++
  }

  const candidate = JSON.parse(fs.readFileSync(path.join(detachedOutput, 'reports/release/release-candidate.json'), 'utf8'))
  const trackedCandidate = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/release/release-candidate.json'), 'utf8'))
  assert.deepEqual(candidate.blockers, trackedCandidate.blockers); assertions++
  assert.equal(candidate.status, 'blocked'); assertions++
  assert.equal(candidate.publicationApproved, false); assertions++
  assert.equal(candidate.publicEvidenceHubRecordCount, 0); assertions++
  assert.equal(candidate.publishedCaseCount, 6); assertions++
  assert.equal(candidate.draftCaseCount, 3); assertions++
  assert.equal(candidate.baselineCommit, trackedCandidate.baselineCommit); assertions++
  assert.notEqual(detachedBaseline, detachedCurrent); assertions++

  runNode(
    ROOT,
    'scripts/programmes/check-release-governance.mjs',
    [],
    fixtureGitEnvironment({
      NETLIFY: 'true',
      COMMIT_REF: detachedCurrent,
      CACHED_COMMIT_REF: 'unavailable-cached-ref',
    }),
  )
  assertions++
} finally {
  fs.rmSync(detachedRoot, { recursive: true, force: true })
  if (process.platform === 'win32') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
}

const expectedNode = '20.20.2'
assert.equal(fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim(), expectedNode); assertions++
assert.match(
  fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'),
  new RegExp(`NODE_VERSION\\s*=\\s*"${expectedNode.replaceAll('.', '\\.')}"`),
); assertions++
assert.match(
  fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8'),
  new RegExp(`node-version:\\s*['"]${expectedNode.replaceAll('.', '\\.')}['"]`),
); assertions++
console.log(`Release governance tests passed. Assertions: ${assertions}. Node: ${process.version}.`)

function releaseEnv(overrides = {}) {
  const env = { ...process.env }
  for (const key of ['COMMIT_REF', 'CACHED_COMMIT_REF', 'RELEASE_GOVERNANCE_BASE_REF', 'NETLIFY', 'HEAD']) {
    delete env[key]
  }
  return { ...env, ...overrides }
}

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true })
  if (result.status !== 0) throw new Error(`Fixture Git command failed (${args[0]}): ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function gitStatus(root, ...args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true }).status
}

function runNode(root, script, args = [], env = releaseEnv()) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`Fixture Node command failed (${script}): ${result.stderr || result.stdout}`)
  }
  return result
}
