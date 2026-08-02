import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const TEXT_EXTENSIONS = new Set(['.css', '.csv', '.html', '.js', '.json', '.jsx', '.md', '.mdx', '.mjs', '.ts', '.tsx', '.txt', '.yaml', '.yml'])

export function canonicalBytes(file) {
  const bytes = fs.readFileSync(file)
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return bytes
  return Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), 'utf8')
}

export function sha256CanonicalFile(file) {
  return crypto.createHash('sha256').update(canonicalBytes(file)).digest('hex')
}
