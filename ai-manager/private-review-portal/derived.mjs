import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { resolveInside } from './store.mjs'

const textTypes = new Set(['text/plain', 'text/markdown', 'text/csv'])

export function regenerateSafePreview(store, documentId) {
  const database = store.read()
  const document = database.documents.find((item) => item.id === documentId)
  if (!document) throw new Error('Document not found.')
  if (document.scan.status !== 'clean') throw new Error('Only clean-scanned documents can produce derived output.')
  if (!textTypes.has(document.detectedType)) throw new Error('This file type requires a separately reviewed extraction tool.')
  const original = resolveInside(store.root, document.relativePath)
  const text = fs.readFileSync(original, 'utf8').replace(/\r\n/g, '\n').slice(0, 500_000)
  const derivedId = crypto.randomUUID()
  const target = store.generatedPath('derived', derivedId, '.txt')
  fs.writeFileSync(target, text, { encoding: 'utf8', flag: 'wx', mode: 0o400 })
  const record = { id: derivedId, type: 'safe-text-preview', relativePath: path.join('derived', `${derivedId}.txt`), generatedAt: new Date().toISOString(), sourceSha256: document.sha256 }
  store.updateDocumentWorkflow(documentId, { extraction: 'derived-preview-ready', derivedFiles: [...document.derivedFiles, record] })
  store.audit('derived-preview-generated', { documentId, derivedId, sourceSha256: document.sha256 })
  return record
}
