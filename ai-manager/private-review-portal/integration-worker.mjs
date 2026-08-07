import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.mjs'
import { loadContentRegistry, loadStudioConfig } from './content-studio.mjs'
import { buildFeatureBranchPlan, buildReviewAdoptionManifest, loadIntegrationPolicy, prepareIntegrationPacket, validateQueuedIntegration } from './integration.mjs'
import { PrivateStore, resolveInside } from './store.mjs'

function argument(name) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', shell: false, maxBuffer: 200 * 1024 * 1024, env: process.env })
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} ${args.join(' ')} failed (${result.status}): ${(result.stderr || result.stdout).trim().slice(-2000)}`)
  return result.stdout.trim()
}

function executeFeatureBranchPlan({ plan, store, queueEntry }) {
  if (process.env.MSK_REVIEW_INTEGRATION_EXECUTE !== 'feature-branch-pr') throw new Error('Execution is disabled. Set MSK_REVIEW_INTEGRATION_EXECUTE=feature-branch-pr only for the dedicated private worker process.')
  if (plan.controls.directMainPush !== false || plan.controls.autoMerge !== false) throw new Error('Unsafe integration execution plan.')
  run('gh', ['--version'], { cwd: plan.repositoryRoot })
  run('gh', ['auth', 'status'], { cwd: plan.repositoryRoot })
  run('git', ['diff', '--quiet'], { cwd: plan.repositoryRoot })
  run('git', ['diff', '--cached', '--quiet'], { cwd: plan.repositoryRoot })
  run('git', ['fetch', 'origin'], { cwd: plan.repositoryRoot })
  const localMain = run('git', ['rev-parse', plan.baseBranch], { cwd: plan.repositoryRoot })
  const originMain = run('git', ['rev-parse', `origin/${plan.baseBranch}`], { cwd: plan.repositoryRoot })
  if (localMain !== originMain) throw new Error('Local main and origin/main differ; refusing integration preparation.')
  const remoteBranch = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${plan.branch}`], { cwd: plan.repositoryRoot })
  if (remoteBranch) throw new Error('Integration feature branch already exists on origin.')
  fs.mkdirSync(path.dirname(plan.worktree), { recursive: true })
  if (fs.existsSync(plan.worktree)) throw new Error('Integration worktree target already exists.')
  let worktreeAdded = false
  let branchPushed = false
  try {
    run('git', ['worktree', 'add', '-b', plan.branch, plan.worktree, `origin/${plan.baseBranch}`], { cwd: plan.repositoryRoot })
    worktreeAdded = true
    const manifestDestination = resolveInside(plan.worktree, ...plan.manifestRepositoryPath.split('/'))
    fs.mkdirSync(path.dirname(manifestDestination), { recursive: true })
    fs.copyFileSync(plan.manifestSource, manifestDestination, fs.constants.COPYFILE_EXCL)
    run(process.execPath, ['scripts/private-review-portal/check-content-integration.mjs', '--require-one'], { cwd: plan.worktree })
    run('git', ['add', '--', plan.manifestRepositoryPath], { cwd: plan.worktree })
    const staged = run('git', ['diff', '--cached', '--name-only'], { cwd: plan.worktree }).split(/\r?\n/).filter(Boolean)
    if (staged.length !== 1 || staged[0].replaceAll('\\', '/') !== plan.manifestRepositoryPath) throw new Error('Integration worker staged a path outside the exact manifest.')
    run('git', ['commit', '-m', `Adopt reviewed content revision ${queueEntry.proposalId}`], { cwd: plan.worktree })
    run('git', ['push', 'origin', `${plan.branch}:${plan.branch}`], { cwd: plan.worktree })
    branchPushed = true
    const pullRequestUrl = run('gh', ['pr', 'create', '--base', plan.baseBranch, '--head', plan.branch, '--title', `Adopt reviewed revision ${queueEntry.proposalId}`, '--body-file', plan.bodyFile], { cwd: plan.worktree }).split(/\r?\n/).find((line) => /^https:\/\//.test(line))
    if (!pullRequestUrl) throw new Error('GitHub CLI did not return a pull-request URL.')
    store.updateIntegrationQueue(queueEntry.id, { status: 'pull-request-open', branch: { name: plan.branch, base: plan.baseBranch, pushed: true }, pullRequest: { url: pullRequestUrl }, failure: null })
    return { status: 'pull-request-open', branch: plan.branch, pullRequestUrl }
  } catch (error) {
    store.updateIntegrationQueue(queueEntry.id, { status: branchPushed ? 'branch-pushed-pr-failed' : 'execution-failed', failure: { at: new Date().toISOString(), category: 'integration-worker', message: String(error.message).slice(0, 500) } })
    throw error
  } finally {
    if (worktreeAdded) {
      const removed = spawnSync('git', ['worktree', 'remove', '--force', plan.worktree], { cwd: plan.repositoryRoot, encoding: 'utf8', shell: false, maxBuffer: 10 * 1024 * 1024 })
      if (removed.status !== 0) store.audit('integration-worktree-cleanup-required', { queueId: queueEntry.id, branch: plan.branch })
    }
  }
}

export function processIntegrationQueue({ config = loadConfig(), store = new PrivateStore(config.dataRoot), queueId = argument('--queue'), execute = process.argv.includes('--execute') } = {}) {
  const policy = loadIntegrationPolicy()
  const registry = loadContentRegistry({ repositoryRoot: config.repositoryRoot, store, config: loadStudioConfig() })
  const selected = queueId ?? store.read().integrationQueue.find((entry) => entry.status === 'queued')?.id
  if (!selected || !/^[a-f0-9-]{36}$/.test(selected)) throw new Error('Supply a valid --queue identifier or queue one proposal in the private portal.')
  const validated = validateQueuedIntegration({ store, registry, queueId: selected, policy })
  const manifest = buildReviewAdoptionManifest({ ...validated })
  const packet = prepareIntegrationPacket({ store, ...validated, manifest })
  store.updateIntegrationQueue(selected, { status: 'packet-ready', validatedAt: new Date().toISOString(), packet, failure: null })
  store.audit('integration-packet-prepared', { queueId: selected, proposalId: validated.proposal.id, targetId: validated.item.id, exactRevisionKey: validated.item.revisionHash, directMainPush: false, publicationAuthorized: false })
  const plan = buildFeatureBranchPlan({ repositoryRoot: config.repositoryRoot, store, packet, policy })
  if (!execute) return { status: 'packet-ready', queueId: selected, proposalId: validated.proposal.id, branch: plan.branch, manifestRepositoryPath: plan.manifestRepositoryPath, directMainPush: false, autoMerge: false }
  return executeFeatureBranchPlan({ plan, store, queueEntry: validated.queueEntry })
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    console.log(JSON.stringify(processIntegrationQueue(), null, 2))
  } catch (error) {
    console.error(`Integration worker stopped safely: ${error.message}`)
    process.exitCode = 1
  }
}
