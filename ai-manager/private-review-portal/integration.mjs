import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findContentItem } from './content-studio.mjs'
import { resolveInside } from './store.mjs'

const portalDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultPolicyPath = path.join(portalDirectory, 'integration-policy.json')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const toPosix = (value) => value.replaceAll('\\', '/')

function assertSafePolicy(policy) {
  if (policy.schemaVersion !== 1 || policy.mode !== 'review-adoption-only') throw new Error('Unsupported content-integration policy.')
  if (!/^[a-z0-9-]+\/$/.test(policy.branchPrefix)) throw new Error('Integration branch prefix is invalid.')
  if (policy.baseBranch !== 'main') throw new Error('Integration base branch must remain main.')
  if (policy.directMainPush !== false || policy.autoMerge !== false || policy.publicationStateChangesAllowed !== false || policy.resourceImportAllowed !== false) throw new Error('Integration policy attempts to exceed review-adoption authority.')
  if (!Array.isArray(policy.allowedChangedPathPrefixes) || policy.allowedChangedPathPrefixes.length !== 1 || policy.allowedChangedPathPrefixes[0] !== `${policy.manifestRoot}/`) throw new Error('Review-adoption changes must be limited to the integration manifest root.')
  return policy
}

export function loadIntegrationPolicy(policyPath = defaultPolicyPath) {
  return Object.freeze(assertSafePolicy(JSON.parse(fs.readFileSync(policyPath, 'utf8'))))
}

export function validateQueuedIntegration({ store, registry, queueId, policy = loadIntegrationPolicy() }) {
  assertSafePolicy(policy)
  const database = store.read()
  const queueEntry = database.integrationQueue.find((entry) => entry.id === queueId)
  if (!queueEntry) throw new Error('Integration queue entry not found.')
  if (!['queued', 'packet-ready'].includes(queueEntry.status)) throw new Error(`Integration queue entry is not processable from status ${queueEntry.status}.`)
  if (queueEntry.operation !== policy.mode) throw new Error('Integration queue operation does not match policy.')
  if (queueEntry.controls?.directMainPush !== false || queueEntry.controls?.autoMerge !== false || queueEntry.controls?.publicationAuthorized !== false || queueEntry.controls?.publicationStateChangesAllowed !== false || queueEntry.controls?.resourceImportAllowed !== false) throw new Error('Integration queue controls exceed review-adoption authority.')
  const proposal = database.integrationProposals.find((entry) => entry.id === queueEntry.proposalId)
  if (!proposal) throw new Error('Queued integration proposal is missing.')
  if (proposal.controls?.grantsApproval !== false || proposal.controls?.publicationAuthorized !== false || proposal.controls?.repositoryModified !== false || proposal.controls?.clinicalContentCopied !== false) throw new Error('Integration proposal controls exceed review authority.')
  if (proposal.exactRevisionKey !== queueEntry.exactRevisionKey || proposal.targetId !== queueEntry.targetId) throw new Error('Integration queue and proposal identity do not match.')
  const proposalFile = resolveInside(store.root, proposal.relativePath)
  const bytes = fs.readFileSync(proposalFile)
  if (sha256(bytes) !== proposal.sha256) throw new Error('Integration proposal file hash does not match its immutable record.')
  const item = findContentItem(registry, proposal.targetId)
  if (!item || item.revisionHash !== proposal.exactRevisionKey) throw new Error('Reviewed content revision is stale or unavailable.')
  if (item.contentType === 'extra-materials' || item.sourceLinks.some((value) => value.startsWith('private-document:'))) throw new Error('A cleared-resource adapter is required before private materials can enter an integration branch.')
  if (item.publicationState !== proposal.item.publicationStateAtReview) throw new Error('Publication state changed after review.')
  return { queueEntry, proposal, item, policy }
}

export function buildReviewAdoptionManifest({ queueEntry, proposal, item, policy = loadIntegrationPolicy() }) {
  assertSafePolicy(policy)
  const manifestPath = `${policy.manifestRoot}/${proposal.id}.json`
  const actorReference = `sha256:${sha256(queueEntry.submittedBy.id)}`
  return {
    schemaVersion: 1,
    kind: 'content-review-adoption',
    operation: policy.mode,
    proposalId: proposal.id,
    queueId: queueEntry.id,
    targetId: item.id,
    region: item.region,
    contentType: item.contentType,
    exactRevisionKey: item.revisionHash,
    lifecycleAtReview: proposal.item.lifecycleAtReview,
    publicationStateAtReview: proposal.item.publicationStateAtReview,
    authoritativeSourceLinks: item.sourceLinks.filter((value) => !value.startsWith('private-document:')),
    reviewCompletedAt: proposal.review.completedAt,
    submittedAt: queueEntry.submittedAt,
    reviewerAuditReference: actorReference,
    reviewerRoles: [...queueEntry.submittedBy.roles].sort(),
    candidateChanges: [manifestPath],
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
  }
}

function writeOnce(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) {
    if (!fs.readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`Existing integration packet differs: ${path.basename(file)}`)
    return
  }
  fs.writeFileSync(file, bytes, { flag: 'wx' })
}

export function prepareIntegrationPacket({ store, queueEntry, proposal, item, manifest, policy = loadIntegrationPolicy() }) {
  assertSafePolicy(policy)
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  const branch = `${policy.branchPrefix}${proposal.id}-${item.revisionHash.replace(/^sha256:/, '').slice(0, 8)}`
  const pullRequestBody = [
    '# Guarded content review adoption',
    '',
    `- Proposal: \`${proposal.id}\``,
    `- Queue entry: \`${queueEntry.id}\``,
    `- Target: \`${item.id}\``,
    `- Exact reviewed revision: \`${item.revisionHash}\``,
    '- Operation: review-adoption-only',
    '- Direct main push: prohibited',
    '- Automatic merge: prohibited',
    '- Publication or resource import: prohibited',
    '',
    'This PR records a private review adoption only. It grants no clinical, evidence, source, licensing, accessibility, beta, publication, release or deployment approval.',
    '',
  ].join('\n')
  const manifestPacket = store.generatedPath('review-packets', queueEntry.id, '.json')
  const bodyPacket = store.generatedPath('review-packets', queueEntry.id, '.md')
  writeOnce(manifestPacket, manifestBytes)
  writeOnce(bodyPacket, Buffer.from(pullRequestBody))
  return {
    branch,
    manifestRepositoryPath: manifest.candidateChanges[0],
    manifestPacketPath: toPosix(path.relative(store.root, manifestPacket)),
    manifestSha256: sha256(manifestBytes),
    pullRequestBodyPath: toPosix(path.relative(store.root, bodyPacket)),
    pullRequestBodySha256: sha256(pullRequestBody),
  }
}

export function buildFeatureBranchPlan({ repositoryRoot, store, packet, policy = loadIntegrationPolicy() }) {
  assertSafePolicy(policy)
  const worktree = resolveInside(store.root, 'review-packets', 'integration-worktrees', path.basename(packet.branch))
  const manifestSource = resolveInside(store.root, packet.manifestPacketPath)
  const bodyFile = resolveInside(store.root, packet.pullRequestBodyPath)
  return {
    repositoryRoot: path.resolve(repositoryRoot),
    worktree,
    branch: packet.branch,
    baseBranch: policy.baseBranch,
    manifestSource,
    manifestRepositoryPath: packet.manifestRepositoryPath,
    bodyFile,
    commands: [
      ['git', ['fetch', 'origin']],
      ['git', ['worktree', 'add', '-b', packet.branch, worktree, `origin/${policy.baseBranch}`]],
      ['git', ['add', '--', packet.manifestRepositoryPath]],
      ['git', ['commit', '-m', `Adopt reviewed content revision ${path.basename(packet.branch)}`]],
      ['git', ['push', 'origin', `${packet.branch}:${packet.branch}`]],
      ['gh', ['pr', 'create', '--base', policy.baseBranch, '--head', packet.branch, '--title', `Adopt reviewed revision ${path.basename(packet.branch)}`, '--body-file', bodyFile]],
    ],
    controls: { directMainPush: false, autoMerge: false, publicationStateChangesAllowed: false, resourceImportAllowed: false },
  }
}
