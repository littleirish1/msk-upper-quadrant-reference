import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  PACKET_ARTIFACT_HANDLING,
  copyExactArtifact,
  verifyPatchReconstructsTree,
  writePacketArtifact,
} from './lib/reviewPacketArtifacts.mjs'

const ROOT = process.cwd()
const SCANNER = path.join(ROOT, 'scripts', 'check-review-packet-redaction.mjs')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-packet-exactness-'))
let assertions = 0

try {
  const repository = path.join(temp, 'repository')
  const packet = path.join(temp, 'packet')
  fs.mkdirSync(repository, { recursive: true })
  git(repository, ['init'])
  git(repository, ['config', 'user.name', 'Synthetic Reviewer'])
  git(repository, [
    'config',
    'user.email',
    ['synthetic-reviewer', 'example.invalid'].join('@'),
  ])
  git(repository, ['config', 'core.autocrlf', 'false'])

  const source = path.join(repository, 'source.mjs')
  fs.writeFileSync(source, 'export const initial = true\n')
  git(repository, ['add', 'source.mjs'])
  git(repository, ['commit', '-m', 'baseline'])
  const baseline = git(repository, ['rev-parse', 'HEAD']).stdout.trim()

  const benignSource = [
    'const record = { caseId: record.caseId }',
    'const pilotRecord = { caseId: pilot.caseId }',
    'const stableId = "case.shoulder.case-01"',
    `const contentHash = "${'a'.repeat(64)}"`,
    `const sha1 = "${'b'.repeat(40)}"`,
    `const sha256 = "${'c'.repeat(64)}"`,
    'const windowsPathPattern = /[A-Za-z]:[\\\\/](?:Users|dev)[\\\\/]/',
    'const uncPathPattern = /\\\\\\\\[^\\\\\\s]+\\\\[^\\r\\n]+/',
    'const escapedBackslashes = "folder\\\\\\\\child"',
    'const environmentVariableName = "PRIVATE_SOURCE_PATH"',
    'const authorizationToken = undefined',
    'const template = `case ${stableId}`',
    '// Security terminology describes detection, not a credential value.',
    '',
  ].join('\n')
  fs.writeFileSync(source, benignSource)
  git(repository, ['add', 'source.mjs'])
  git(repository, ['commit', '-m', 'exact artifact fixture'])
  const final = git(repository, ['rev-parse', 'HEAD']).stdout.trim()

  const packetSource = path.join(packet, 'implementation', 'source.mjs')
  const copy = copyExactArtifact(source, packetSource)
  assert.equal(copy.sourceHash, copy.destinationHash)
  assert.equal(fs.readFileSync(packetSource).equals(fs.readFileSync(source)), true)
  assertions += 2

  const patchResult = git(repository, [
    'diff',
    '--binary',
    '--full-index',
    `${baseline}...${final}`,
  ], null)
  const packetPatch = path.join(packet, 'IMPLEMENTATION.patch')
  writePacketArtifact({
    destination: packetPatch,
    content: patchResult.stdout,
    handling: PACKET_ARTIFACT_HANDLING.exact,
  })
  assert.equal(fs.readFileSync(packetPatch).equals(patchResult.stdout), true)
  assert.match(fs.readFileSync(packetPatch, 'utf8'), /^index [0-9a-f]{40}\.\.[0-9a-f]{40} 100644$/m)
  assertions += 2

  const temporaryIndexVerification = verifyPatchReconstructsTree({
    repositoryRoot: repository,
    patchFile: packetPatch,
    baseSha: baseline,
    finalSha: final,
  })
  assert.equal(
    temporaryIndexVerification.reconstructedTree,
    temporaryIndexVerification.expectedTree,
  )
  assertions += 1

  const scanner = run(process.execPath, [SCANNER, packet], ROOT)
  assert.equal(scanner.status, 0, scanner.stderr)
  assertions += 1

  const reconstruction = path.join(temp, 'reconstruction')
  git(temp, ['clone', '--no-hardlinks', repository, reconstruction])
  git(reconstruction, ['config', 'core.autocrlf', 'false'])
  git(reconstruction, ['checkout', '--force', '--detach', baseline])
  const applyCheck = git(reconstruction, ['apply', '--check', packetPatch])
  assert.equal(applyCheck.status, 0)
  git(reconstruction, ['apply', packetPatch])
  assert.equal(
    git(reconstruction, ['hash-object', 'source.mjs']).stdout.trim(),
    git(repository, ['rev-parse', `${final}:source.mjs`]).stdout.trim(),
  )
  assertions += 2

  const unsafePacket = path.join(temp, 'unsafe-packet')
  const unsafeValue = ['sk', '-', 'syntheticreviewfixturevalue000001'].join('')
  writePacketArtifact({
    destination: path.join(unsafePacket, 'unsafe.mjs'),
    content: Buffer.from(`export const unsafe = ${JSON.stringify(unsafeValue)}\n`),
    handling: PACKET_ARTIFACT_HANDLING.exact,
  })
  const unsafeBefore = fs.readFileSync(path.join(unsafePacket, 'unsafe.mjs'))
  const unsafeScan = run(process.execPath, [SCANNER, unsafePacket], ROOT)
  assert.notEqual(unsafeScan.status, 0)
  assert.equal(fs.readFileSync(path.join(unsafePacket, 'unsafe.mjs')).equals(unsafeBefore), true)
  assert.equal(`${unsafeScan.stdout}${unsafeScan.stderr}`.includes(unsafeValue), false)
  assertions += 3

  const unsafePatch = path.join(unsafePacket, 'UNSAFE.patch')
  const unsafePatchBytes = Buffer.from([
    'diff --git a/unsafe.mjs b/unsafe.mjs',
    `index ${'d'.repeat(40)}..${'e'.repeat(40)} 100644`,
    '--- a/unsafe.mjs',
    '+++ b/unsafe.mjs',
    '@@ -0,0 +1 @@',
    `+export const unsafe = ${JSON.stringify(unsafeValue)}`,
    '',
  ].join('\n'))
  writePacketArtifact({
    destination: unsafePatch,
    content: unsafePatchBytes,
    handling: PACKET_ARTIFACT_HANDLING.exact,
  })
  const unsafePatchScan = run(process.execPath, [SCANNER, unsafePacket], ROOT)
  assert.notEqual(unsafePatchScan.status, 0)
  assert.equal(fs.readFileSync(unsafePatch).equals(unsafePatchBytes), true)
  assert.equal(`${unsafePatchScan.stdout}${unsafePatchScan.stderr}`.includes(unsafeValue), false)
  assertions += 3

  assert.throws(
    () => writePacketArtifact({
      destination: path.join(packet, 'unsupported.glb'),
      content: Buffer.from([1, 2, 3]),
    }),
    /Unsupported packet artifact/,
  )
  assertions += 1

  console.log(`Exact review-packet artifact tests passed. Assertions: ${assertions}.`)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}

function git(cwd, args, encoding = 'utf8') {
  const result = run('git', args, cwd, encoding)
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`)
  }
  return result
}

function run(command, args, cwd, encoding = 'utf8') {
  return spawnSync(command, args, {
    cwd,
    encoding,
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
  })
}
