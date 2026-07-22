import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const LEGACY_SOURCE_PROVENANCE = Object.freeze({
  sourceId: 'legacy-html-case-bank-v1',
  sourceType: 'private-external-legacy-html',
  stationCount: 47,
  gitBlobId: '4b107b93aee91d7f012d97aa42e6b8b7d19a638b',
  sha256: '488282ca6ce682d5ee56f0c700b4392e1cf32d2b8625c0ed165f2db5b7483bb3',
  publicEligibility: false,
  repositoryRawCopyRemoved: true,
  extractionVersion: 1,
})

export function resolveLegacySourcePath(argument) {
  const suppliedPath = argument || process.env.LEGACY_HTML_SOURCE
  return suppliedPath ? path.resolve(process.cwd(), suppliedPath) : null
}

export function readVerifiedLegacySource(file) {
  let bytes

  try {
    bytes = fs.readFileSync(file)
  } catch {
    throw new Error('The private legacy source file could not be read.')
  }

  const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex')

  if (actualSha256 !== LEGACY_SOURCE_PROVENANCE.sha256) {
    throw new Error(
      [
        'Private legacy source fingerprint mismatch.',
        'Extraction stopped without writing repository content.',
        'A legitimate new source requires a reviewed source-version update.',
      ].join(' '),
    )
  }

  return bytes
}
