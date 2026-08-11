import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadIntegrationPolicy } from '../../ai-manager/private-review-portal/integration.mjs'
import { runContentIntegrationCheck } from './check-content-integration.mjs'

const proposalA = '11111111-1111-4111-8111-111111111111'
const proposalB = '22222222-2222-4222-8222-222222222222'
const policy = loadIntegrationPolicy()
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-content-integration-regression-'))
const fixtureRepository = path.join(temporaryRoot, 'repository')
const item = {
  id: 'integration-test.shoulder-movement',
  region: 'shoulder',
  contentType: 'movements',
  lifecycle: 'review-required',
  publicationState: 'private',
  revisionHash: `sha256:${'1'.repeat(64)}`,
  sourceLinks: [],
}
const registry = { items: [item] }

function runGit(args) {
  const result = spawnSync('git', args, { cwd: fixtureRepository, encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw result.error ?? new Error(`git ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`)
  return result.stdout.trim()
}

function commit(paths, message) {
  runGit(['add', '--', ...paths])
  runGit(['-c', 'user.name=MSK Integration Test', '-c', 'user.email=integration-test@example.invalid', 'commit', '--no-gpg-sign', '-m', message])
  return runGit(['rev-parse', 'HEAD'])
}

function manifestPath(proposalId) {
  return `${policy.manifestRoot}/${proposalId}.json`
}

function writeManifest(proposalId, item, overrides = {}) {
  const relativePath = manifestPath(proposalId)
  const manifest = {
    schemaVersion: 1,
    kind: 'content-review-adoption',
    operation: 'review-adoption-only',
    proposalId,
    queueId: proposalId === proposalA ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    targetId: item.id,
    region: item.region,
    contentType: item.contentType,
    exactRevisionKey: item.revisionHash,
    lifecycleAtReview: item.lifecycle,
    publicationStateAtReview: item.publicationState,
    authoritativeSourceLinks: [],
    reviewCompletedAt: '2026-08-10T09:00:00.000Z',
    submittedAt: '2026-08-10T09:05:00.000Z',
    reviewerAuditReference: `sha256:${'a'.repeat(64)}`,
    reviewerRoles: ['content-reviewer'],
    candidateChanges: [relativePath],
    controls: {
      grantsApproval: false,
      publicationAuthorized: false,
      publicationStateChangesAllowed: false,
      resourceImportAllowed: false,
      directMainPush: false,
      autoMerge: false,
      requiresProtectedPullRequest: true,
      requiresNode20202Preflight: true,
    },
    ...overrides,
  }
  const destination = path.join(fixtureRepository, ...relativePath.split('/'))
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`)
  return relativePath
}

function checkout(revision) {
  runGit(['checkout', '--detach', revision])
}

function expectFailure(label, pattern, callback) {
  assert.throws(callback, pattern, label)
}

try {
  const initialize = spawnSync('git', ['init', '--quiet', fixtureRepository], { encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 })
  if (initialize.error || initialize.status !== 0) throw initialize.error ?? new Error(`git init failed (${initialize.status}): ${(initialize.stderr || initialize.stdout).trim()}`)
  runGit(['config', 'core.autocrlf', 'false'])
  fs.writeFileSync(path.join(fixtureRepository, 'fixture-baseline.txt'), 'content integration fixture\n')
  const baselineWithoutProposals = commit(['fixture-baseline.txt'], 'Create empty proposal fixture baseline')

  const pathA = writeManifest(proposalA, item)
  const baselineWithA = commit([pathA], 'Add proposal A fixture')
  assert.deepEqual(
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithoutProposals, log: () => {} }),
    { manifestCount: 1, changedManifestCount: 1 },
    'Case 1: a first proposal must pass.',
  )

  const pathB = writeManifest(proposalB, item)
  commit([pathB], 'Add proposal B fixture')
  assert.deepEqual(
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithA, log: () => {} }),
    { manifestCount: 2, changedManifestCount: 1 },
    'Case 2: a subsequent proposal must ignore unchanged historical manifests in the changed-path comparison.',
  )

  checkout(baselineWithA)
  writeManifest(proposalA, item, { submittedAt: '2026-08-10T10:00:00.000Z' })
  commit([pathA], 'Modify historical proposal A fixture')
  expectFailure('Case 3: historical manifests must not be modified.', /may only add manifests: M reports\/content-integration\/proposals\//, () => {
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithA, log: () => {} })
  })

  checkout(baselineWithA)
  writeManifest(proposalB, item)
  fs.writeFileSync(path.join(fixtureRepository, 'unrelated-integration-test.txt'), 'unrelated fixture\n')
  commit([pathB, 'unrelated-integration-test.txt'], 'Add proposal B and unrelated fixture')
  expectFailure('Case 4: unrelated changed paths must fail.', /outside the review-adoption allowlist/, () => {
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithA, log: () => {} })
  })

  checkout(baselineWithA)
  const unexpectedPath = `${policy.manifestRoot}/unexpected.txt`
  fs.mkdirSync(path.dirname(path.join(fixtureRepository, ...unexpectedPath.split('/'))), { recursive: true })
  fs.writeFileSync(path.join(fixtureRepository, ...unexpectedPath.split('/')), 'unexpected fixture\n')
  commit([unexpectedPath], 'Add unexpected proposal-directory file')
  expectFailure('Case 5: non-manifest files beneath the proposal directory must fail.', /invalid proposal manifest filename/, () => {
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithA, log: () => {} })
  })

  checkout(baselineWithA)
  writeManifest(proposalB, item, { controls: { grantsApproval: true } })
  commit([pathB], 'Add malformed proposal B fixture')
  expectFailure('Case 6: schema or authority-invalid manifests must fail.', /true !== false/, () => {
    runContentIntegrationCheck({ repositoryRoot: fixtureRepository, policy, registry, requireOne: true, baseArgument: baselineWithA, log: () => {} })
  })

  console.log('Content integration changed-path regression tests passed: first proposal, subsequent proposal, historical modification, unrelated path, non-manifest path, and malformed authority controls.')
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}
