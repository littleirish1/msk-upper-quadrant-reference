import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const privateFolders = Object.freeze(['incoming', 'quarantine', 'library', 'derived', 'review-packets', 'exports', 'backups', 'logs', 'database'])

function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  fs.renameSync(temporary, file)
}

export function resolveInside(root, ...segments) {
  const parent = path.resolve(root)
  const candidate = path.resolve(parent, ...segments)
  const relative = path.relative(parent, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Resolved path escapes the private data root.')
  return candidate
}

export class PrivateStore {
  constructor(root, now = () => new Date().toISOString()) {
    this.root = path.resolve(root)
    this.now = now
    for (const folder of privateFolders) fs.mkdirSync(resolveInside(this.root, folder), { recursive: true })
    this.databaseFile = resolveInside(this.root, 'database', 'portal.json')
    this.auditFile = resolveInside(this.root, 'logs', 'audit.jsonl')
    if (!fs.existsSync(this.databaseFile)) writeJsonAtomic(this.databaseFile, { schemaVersion: 2, documents: [], actions: [], futureItems: [], extraMaterials: [] })
  }

  read() {
    const database = JSON.parse(fs.readFileSync(this.databaseFile, 'utf8'))
    return {
      ...database,
      schemaVersion: Math.max(2, Number(database.schemaVersion ?? 1)),
      documents: database.documents ?? [],
      actions: database.actions ?? [],
      futureItems: database.futureItems ?? [],
      extraMaterials: database.extraMaterials ?? [],
    }
  }

  mutate(mutator) {
    const database = this.read()
    const result = mutator(database)
    writeJsonAtomic(this.databaseFile, database)
    return result
  }

  addDocument(document) {
    return this.mutate((database) => {
      if (database.documents.some((item) => item.id === document.id)) throw new Error('Generated document identifier collision.')
      database.documents.push(structuredClone(document))
      return document
    })
  }

  updateDocumentWorkflow(id, patch) {
    const allowed = new Set(['scan', 'extraction', 'ingestion', 'evidenceReview', 'clinicalReview', 'sourceClearance', 'licensing', 'archivedAt', 'supersededBy', 'derivedFiles'])
    if (Object.keys(patch).some((key) => !allowed.has(key))) throw new Error('Immutable source metadata cannot be changed.')
    return this.mutate((database) => {
      const document = database.documents.find((item) => item.id === id)
      if (!document) throw new Error('Document not found.')
      Object.assign(document, structuredClone(patch))
      return document
    })
  }

  addAction(action) {
    return this.mutate((database) => {
      database.actions.push(structuredClone(action))
      return action
    })
  }

  addExtraMaterial(material) {
    return this.mutate((database) => {
      database.schemaVersion = 2
      database.extraMaterials ??= []
      if (database.extraMaterials.some((item) => item.id === material.id)) throw new Error('Generated extra-material identifier collision.')
      database.extraMaterials.push(structuredClone(material))
      return material
    })
  }

  replaceFutureItems(items) {
    return this.mutate((database) => {
      database.futureItems = structuredClone(items)
      return database.futureItems
    })
  }

  audit(event, details = {}) {
    const safe = { at: this.now(), event, ...details }
    fs.appendFileSync(this.auditFile, `${JSON.stringify(safe)}\n`, { encoding: 'utf8' })
  }

  generatedPath(folder, storageId, extension = '') {
    if (!privateFolders.includes(folder)) throw new Error('Unknown private storage folder.')
    if (!/^[a-f0-9-]{36}$/.test(storageId)) throw new Error('Invalid generated storage identifier.')
    if (extension && !/^\.[a-z0-9]{1,8}$/.test(extension)) throw new Error('Invalid generated extension.')
    return resolveInside(this.root, folder, `${storageId}${extension}`)
  }
}
