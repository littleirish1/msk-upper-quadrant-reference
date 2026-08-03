import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { inspectFile, sanitizeFilename } from './mime.mjs'
import { scanWithDefender } from './defender.mjs'

function cleanMetadata(input = {}) {
  const text = (value, maximum) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum)
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => text(tag, 40)).filter(Boolean).slice(0, 20) : []
  return {
    title: text(input.title, 160),
    sourceType: text(input.sourceType, 60),
    region: text(input.region, 60),
    condition: text(input.condition, 100),
    notes: text(input.notes, 2000),
    tags,
  }
}

export async function intakeUpload({ stream, originalName, declaredType, contentLength, metadata, store, config, actor = 'reviewer', scan = scanWithDefender }) {
  const safeName = sanitizeFilename(originalName)
  if (Number.isFinite(contentLength) && contentLength > config.maxFileBytes) throw new Error('File exceeds the configured upload limit.')
  const storageId = crypto.randomUUID()
  const quarantinePart = store.generatedPath('quarantine', storageId, '.part')
  const hash = crypto.createHash('sha256')
  let bytes = 0
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length
      if (bytes > config.maxFileBytes) return callback(new Error('File exceeds the configured upload limit.'))
      hash.update(chunk)
      callback(null, chunk)
    },
  })
  const output = fs.createWriteStream(quarantinePart, { flags: 'wx' })
  try {
    await pipeline(stream, limiter, output)
  } catch (error) {
    if (!output.closed) {
      try { await once(output, 'close') } catch {}
    }
    fs.rmSync(quarantinePart, { force: true })
    throw error
  }
  if (bytes === 0) {
    fs.rmSync(quarantinePart, { force: true })
    throw new Error('Empty files are not accepted.')
  }

  const sha256 = hash.digest('hex')
  let inspection
  try {
    inspection = inspectFile(quarantinePart, safeName, declaredType)
  } catch (error) {
    const rejected = store.generatedPath('quarantine', storageId, '.rejected')
    fs.renameSync(quarantinePart, rejected)
    store.audit('upload-rejected', { actor, storageId, sha256, reason: error.message })
    throw error
  }

  const scanResult = await scan(quarantinePart)
  const database = store.read()
  const duplicate = database.documents.find((item) => item.sha256 === sha256 && item.scan?.status !== 'rejected')
  const clean = scanResult.status === 'clean'
  const extension = inspection.extension === '.jpeg' ? '.jpg' : inspection.extension
  const relativePath = clean ? path.join('library', `${storageId}${extension}`) : path.join('quarantine', `${storageId}${extension}`)
  const destination = store.generatedPath(clean ? 'library' : 'quarantine', storageId, extension)
  fs.renameSync(quarantinePart, destination)
  try { fs.chmodSync(destination, 0o400) } catch {}

  const uploadedAt = new Date().toISOString()
  const document = {
    id: storageId,
    storageId,
    originalName: inspection.safeName,
    detectedType: inspection.detectedType,
    extension,
    bytes,
    sha256,
    uploadedAt,
    uploadedByRole: actor,
    sourceMetadata: cleanMetadata(metadata),
    relativePath,
    duplicateOf: duplicate?.id ?? null,
    provenance: { acquisition: 'private-review-portal-upload', receivedAt: uploadedAt, immutableOriginal: true },
    scan: scanResult,
    quarantine: clean ? 'released-after-clean-scan' : 'held',
    extraction: 'not-queued',
    ingestion: 'not-queued',
    evidenceReview: 'not-reviewed',
    clinicalReview: 'not-reviewed',
    sourceClearance: 'not-reviewed',
    licensing: 'not-reviewed',
    derivedFiles: [],
    archivedAt: null,
    supersededBy: null,
  }
  store.addDocument(document)
  store.audit('upload-recorded', { actor, documentId: document.id, sha256, bytes, scanStatus: scanResult.status, duplicateOf: document.duplicateOf })
  return document
}
