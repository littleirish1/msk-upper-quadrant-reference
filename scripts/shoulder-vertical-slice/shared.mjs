import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const ROOT = process.cwd()
export const SHOULDER_ROOT = path.join(ROOT, 'ai-manager', 'clinical-platform', 'shoulder')
export const SHOULDER_REPORT_ROOT = path.join(ROOT, 'reports', 'clinical-platform', 'shoulder')

export function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`
}

export function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  )
}

export function stableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, stableJson(value), 'utf8')
}

export function toPosix(value) {
  return value.split(path.sep).join('/')
}
