import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  JSON_SCHEMA_FILE,
  PUBLIC_REGISTRY_FILE,
  RECORDS_DIR,
  REPORTS_DIR,
  ROOT,
  canonicalText,
  temporaryDirectory,
} from './shared.mjs'

const targets = [JSON_SCHEMA_FILE, PUBLIC_REGISTRY_FILE, RECORDS_DIR, REPORTS_DIR]
const backupRoot = temporaryDirectory('guided-case-currentness-')
const snapshots = new Map()

try {
  for (const target of targets) snapshots.set(target, snapshot(target))
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'guided-cases', 'generate.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exitCode = result.status ?? 1
  } else {
    const stale = targets.flatMap((target) => compareSnapshot(target, snapshots.get(target)))
    if (stale.length) {
      console.error('Guided-case generated files are stale:')
      for (const item of stale) console.error(`- ${item}`)
      process.exitCode = 1
    } else {
      console.log('Guided-case generated files are current.')
    }
  }
} finally {
  for (const target of targets) restore(target, snapshots.get(target))
  fs.rmSync(backupRoot, { recursive: true, force: true })
}

function snapshot(target) {
  if (!fs.existsSync(target)) return { exists: false, files: new Map() }
  const files = fs.statSync(target).isDirectory() ? walk(target) : [target]
  return {
    exists: true,
    files: new Map(files.map((file) => [
      path.relative(target, file) || '.',
      fs.readFileSync(file),
    ])),
  }
}

function compareSnapshot(target, original) {
  const current = snapshot(target)
  const keys = new Set([...original.files.keys(), ...current.files.keys()])
  const stale = []
  for (const key of [...keys].sort()) {
    const before = original.files.get(key)
    const after = current.files.get(key)
    if (!before || !after || canonicalBytes(before).compare(canonicalBytes(after)) !== 0) {
      stale.push(path.relative(ROOT, key === '.' ? target : path.join(target, key)).replaceAll('\\', '/'))
    }
  }
  return stale
}

function restore(target, original) {
  fs.rmSync(target, { recursive: true, force: true })
  if (!original.exists) return
  for (const [key, bytes] of original.files) {
    const file = key === '.' ? target : path.join(target, key)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, bytes)
  }
}

function canonicalBytes(bytes) {
  if (bytes.includes(0)) return bytes
  return Buffer.from(canonicalText(bytes.toString('utf8')), 'utf8')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : []
  })
}
