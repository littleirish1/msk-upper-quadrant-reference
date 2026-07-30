import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { redactSensitiveText } from './reviewPacketPolicy.mjs'

const EXACT_EXTENSIONS = new Set([
  '.cjs',
  '.diff',
  '.js',
  '.jsx',
  '.json',
  '.json5',
  '.lock',
  '.mdx',
  '.mjs',
  '.patch',
  '.ps1',
  '.py',
  '.sh',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

const NARRATIVE_EXTENSIONS = new Set([
  '.csv',
  '.md',
  '.txt',
])

const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
  '.7z',
  '.doc',
  '.docx',
  '.gif',
  '.glb',
  '.gltf',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.webp',
  '.xls',
  '.xlsx',
  '.zip',
])

export const PACKET_ARTIFACT_HANDLING = Object.freeze({
  exact: 'exact',
  narrative: 'narrative',
  unsupported: 'unsupported',
})

export function classifyPacketArtifact(relativePath, explicitHandling) {
  if (explicitHandling) {
    if (!Object.values(PACKET_ARTIFACT_HANDLING).includes(explicitHandling)) {
      throw new Error(`Unknown packet artifact handling class: ${explicitHandling}`)
    }
    return explicitHandling
  }

  const extension = path.extname(relativePath).toLowerCase()
  if (EXACT_EXTENSIONS.has(extension)) return PACKET_ARTIFACT_HANDLING.exact
  if (NARRATIVE_EXTENSIONS.has(extension)) return PACKET_ARTIFACT_HANDLING.narrative
  if (UNSUPPORTED_BINARY_EXTENSIONS.has(extension)) return PACKET_ARTIFACT_HANDLING.unsupported
  return PACKET_ARTIFACT_HANDLING.unsupported
}

export function copyExactArtifact(source, destination) {
  const sourceBytes = fs.readFileSync(source)
  writeExactArtifact(destination, sourceBytes)
  const sourceHash = sha256(sourceBytes)
  const destinationHash = fileSha256(destination)
  if (sourceHash !== destinationHash) {
    throw new Error(`Exact packet artifact hash mismatch: ${destination}`)
  }
  return { sourceHash, destinationHash, bytes: sourceBytes.length }
}

export function writeExactArtifact(destination, bytes) {
  const value = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, value)
  if (!fs.readFileSync(destination).equals(value)) {
    throw new Error(`Exact packet artifact changed while writing: ${destination}`)
  }
  return { sha256: sha256(value), bytes: value.length }
}

export function writeNarrativeArtifact(
  destination,
  content,
  { repositoryRoot = process.cwd(), redact = true } = {},
) {
  const text = redact
    ? redactSensitiveText(String(content), repositoryRoot)
    : String(content)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, text, 'utf8')
  return { sha256: fileSha256(destination), bytes: Buffer.byteLength(text) }
}

export function writePacketArtifact({
  destination,
  content,
  handling,
  repositoryRoot = process.cwd(),
  redactNarrative = true,
}) {
  const resolvedHandling = classifyPacketArtifact(destination, handling)
  if (resolvedHandling === PACKET_ARTIFACT_HANDLING.exact) {
    return writeExactArtifact(destination, content)
  }
  if (resolvedHandling === PACKET_ARTIFACT_HANDLING.narrative) {
    return writeNarrativeArtifact(destination, content, {
      repositoryRoot,
      redact: redactNarrative,
    })
  }
  throw new Error(`Unsupported packet artifact requires an explicit approved handler: ${destination}`)
}

export function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

export function fileSha256(file) {
  return sha256(fs.readFileSync(file))
}

export function verifyPatchReconstructsTree({
  repositoryRoot,
  patchFile,
  baseSha,
  finalSha,
}) {
  const temporaryIndex = path.join(
    os.tmpdir(),
    `review-packet-index-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
  )
  const env = { ...process.env, GIT_INDEX_FILE: temporaryIndex }

  try {
    git(repositoryRoot, ['read-tree', baseSha], env)
    git(repositoryRoot, ['apply', '--check', '--cached', '--binary', patchFile], env)
    git(repositoryRoot, ['apply', '--cached', '--binary', patchFile], env)
    const reconstructedTree = git(repositoryRoot, ['write-tree'], env).stdout.trim()
    const expectedTree = git(repositoryRoot, ['rev-parse', `${finalSha}^{tree}`], env).stdout.trim()
    if (reconstructedTree !== expectedTree) {
      throw new Error(
        `Patch reconstruction tree mismatch: expected ${expectedTree}, received ${reconstructedTree}`,
      )
    }
    return { reconstructedTree, expectedTree }
  } finally {
    fs.rmSync(temporaryIndex, { force: true })
    fs.rmSync(`${temporaryIndex}.lock`, { force: true })
  }
}

function git(cwd, args, env) {
  const result = spawnSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed without exposing command output`)
  }
  return result
}
