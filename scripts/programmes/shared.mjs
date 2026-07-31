import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

export const ROOT = process.cwd()
export const PROGRAMME_DIR = path.join(ROOT, 'scripts', 'programmes')
export const CONFIG_FILE = path.join(ROOT, 'content', 'governance', 'programmes-config.json')
export const REPORT_DIR = path.join(ROOT, 'reports', 'governance')
export const SCHEMA_FILE = path.join(ROOT, 'src', 'lib', 'programmes', 'schemas.ts')

export const FOUNDATION_OUTPUTS = [
  'reports/governance/dependency-risk-register.json',
  'reports/governance/governance-dashboard.json',
  'reports/governance/project-inventory-summary.md',
  'reports/governance/project-inventory.json',
  'reports/governance/review-queues.md',
]

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function stableJson(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortKeys(item)]),
  )
}

export function sha256Bytes(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file))
}

export function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

export function collectFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const item = path.join(directory, entry.name)
      return entry.isDirectory()
        ? collectFiles(item, predicate)
        : entry.isFile() && predicate(item)
          ? [item]
          : []
    })
    .sort((left, right) => relative(left).localeCompare(relative(right)))
}

export function writeText(outputRoot, relativePath, text) {
  const destination = path.join(outputRoot, relativePath)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, text.replace(/\r\n/g, '\n'), 'utf8')
}

export async function loadProgrammeSchemas() {
  return loadTypeScriptTree(SCHEMA_FILE, path.join(ROOT, 'src'))
}

export function assertNoPrivateAbsolutePath(value, label) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[A-Za-z]:[\\/](?:Users|dev)[\\/]/i.test(text)) {
    throw new Error(`${label} contains a private absolute path`)
  }
}

export function packageVersion(lock, packageName) {
  const entry = lock.packages?.[`node_modules/${packageName}`]
  if (!entry?.version) throw new Error(`package-lock is missing ${packageName}`)
  return entry.version
}

export function normaliseIdPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
