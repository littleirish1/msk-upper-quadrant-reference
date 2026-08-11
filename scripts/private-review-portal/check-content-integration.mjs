import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { repositoryRoot as defaultRepositoryRoot } from '../../ai-manager/private-review-portal/config.mjs'
import { findContentItem, loadContentRegistry, loadStudioConfig } from '../../ai-manager/private-review-portal/content-studio.mjs'
import { loadIntegrationPolicy } from '../../ai-manager/private-review-portal/integration.mjs'
import { PrivateStore } from '../../ai-manager/private-review-portal/store.mjs'

const manifestNamePattern = /^[a-f0-9-]{36}\.json$/
const toPosix = (value) => value.replaceAll('\\', '/')

function manifestFiles(repositoryRoot, policy) {
  const manifestRoot = path.join(repositoryRoot, ...policy.manifestRoot.split('/'))
  if (!fs.existsSync(manifestRoot)) return []
  return fs.readdirSync(manifestRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && manifestNamePattern.test(entry.name))
    .map((entry) => path.join(manifestRoot, entry.name))
    .sort()
}

export function changedPaths(repositoryRoot, base) {
  const result = spawnSync('git', ['diff', '--name-status', `${base}...HEAD`], { cwd: repositoryRoot, encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr)
  return result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [status, ...paths] = line.split('\t')
    return { status, path: toPosix(paths.at(-1)) }
  })
}

export function runContentIntegrationCheck({ repositoryRoot = defaultRepositoryRoot, policy = loadIntegrationPolicy(), registry: suppliedRegistry = null, requireOne = false, baseArgument = null, log = console.log } = {}) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-content-integration-check-'))
  try {
    const store = new PrivateStore(temporaryRoot)
    const registry = suppliedRegistry ?? loadContentRegistry({ repositoryRoot, store, config: loadStudioConfig() })
    const files = manifestFiles(repositoryRoot, policy)
    let changedManifestFiles = []
    if (baseArgument) {
      const changes = changedPaths(repositoryRoot, baseArgument)
      assert.ok(changes.length > 0, 'Content-integration PR has no changed paths.')
      for (const change of changes) {
        assert.equal(change.status, 'A', `Content-integration PR may only add manifests: ${change.status} ${change.path}`)
        assert.ok(policy.allowedChangedPathPrefixes.some((prefix) => change.path.startsWith(prefix)), `Path is outside the review-adoption allowlist: ${change.path}`)
        assert.equal(path.posix.dirname(change.path), policy.manifestRoot, `Content-integration PR may only add proposal manifests directly inside ${policy.manifestRoot}: ${change.path}`)
        assert.match(path.posix.basename(change.path), manifestNamePattern, `Content-integration PR contains an invalid proposal manifest filename: ${change.path}`)
      }
      const changedPathSet = new Set(changes.map((entry) => entry.path))
      changedManifestFiles = files.filter((file) => changedPathSet.has(toPosix(path.relative(repositoryRoot, file))))
      assert.deepEqual(
        changes.map((entry) => entry.path).sort(),
        changedManifestFiles.map((file) => toPosix(path.relative(repositoryRoot, file))).sort(),
        'Every changed path must resolve to a newly added proposal manifest.',
      )
    }
    if (requireOne) {
      const requiredFiles = baseArgument ? changedManifestFiles : files
      assert.ok(requiredFiles.length > 0, 'A content-integration PR must add at least one review-adoption manifest.')
    }
    for (const file of files) {
      const relativePath = toPosix(path.relative(repositoryRoot, file))
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
      assert.equal(manifest.schemaVersion, 1)
      assert.equal(manifest.kind, 'content-review-adoption')
      assert.equal(manifest.operation, 'review-adoption-only')
      assert.match(manifest.proposalId, /^[a-f0-9-]{36}$/)
      assert.match(manifest.queueId, /^[a-f0-9-]{36}$/)
      assert.equal(relativePath, `${policy.manifestRoot}/${manifest.proposalId}.json`)
      assert.deepEqual(manifest.candidateChanges, [relativePath])
      assert.equal(manifest.controls.grantsApproval, false)
      assert.equal(manifest.controls.publicationAuthorized, false)
      assert.equal(manifest.controls.publicationStateChangesAllowed, false)
      assert.equal(manifest.controls.resourceImportAllowed, false)
      assert.equal(manifest.controls.directMainPush, false)
      assert.equal(manifest.controls.autoMerge, false)
      assert.equal(manifest.controls.requiresProtectedPullRequest, true)
      assert.equal(manifest.controls.requiresNode20202Preflight, true)
      assert.match(manifest.reviewerAuditReference, /^sha256:[a-f0-9]{64}$/)
      assert.ok(!Object.hasOwn(manifest, 'reviewNote'))
      assert.ok(!Object.hasOwn(manifest, 'actorId'))
      assert.ok(!Object.hasOwn(manifest, 'currentContent'))
      const item = findContentItem(registry, manifest.targetId)
      assert.ok(item, `Unknown content item ${manifest.targetId}`)
      assert.notEqual(item.contentType, 'extra-materials')
      assert.equal(item.region, manifest.region)
      assert.equal(item.contentType, manifest.contentType)
      assert.equal(item.revisionHash, manifest.exactRevisionKey)
      assert.equal(item.publicationState, manifest.publicationStateAtReview)
      for (const source of manifest.authoritativeSourceLinks) {
        assert.ok(!source.startsWith('private-document:'), 'Private document identifiers must not enter tracked integration manifests.')
        assert.ok(!path.isAbsolute(source), 'Absolute paths must not enter tracked integration manifests.')
        assert.ok(!source.split(/[\\/]/).includes('..'), 'Traversal paths must not enter tracked integration manifests.')
        assert.ok(!/^docs\/reviews\/current(?:\/|$)/.test(toPosix(source)), 'Protected review paths must not enter tracked integration manifests.')
      }
    }
    log(`Content integration check passed: ${files.length} exact-revision review-adoption manifests${baseArgument ? `; ${changedManifestFiles.length} added by this change` : ''}; direct main push, auto-merge, publication changes and resource import remain prohibited.`)
    return { manifestCount: files.length, changedManifestCount: changedManifestFiles.length }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  runContentIntegrationCheck({
    requireOne: process.argv.includes('--require-one'),
    baseArgument: process.argv.find((value) => value.startsWith('--base='))?.slice('--base='.length) ?? null,
  })
}
