import path from 'node:path'

export const RAW_LEGACY_PATH = 'content/imports/html-case-bank/raw/index.html'
export const RAW_LEGACY_PREFIX = 'content/imports/html-case-bank/raw/'
export const SENSITIVE_DELETION_SUMMARY = '06-sensitive-deletion-summary.md'

const BINARY_EXTENSIONS = new Set([
  '.glb', '.gltf', '.hdr', '.exr', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.zip', '.7z', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
])
const PROTECTED_LOCAL_PREFIXES = [
  'ai-manager/.venv-source-intake/',
  'ai-manager/private-cache/',
  'docs/reviews/current/',
]

export function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.?\//, '')
}

export function isSensitiveRepositoryPath(value) {
  const file = normalizePath(value)
  const name = path.posix.basename(file).toLowerCase()
  const extension = path.posix.extname(file).toLowerCase()

  if (file.startsWith(RAW_LEGACY_PREFIX)) return true
  if (/^content\/imports\/[^/]+\/raw\//i.test(file)) return true
  if (file.startsWith('content/imports/html-case-bank/extracted/stations/')) return true
  if (file.startsWith('ai-manager/assets/')) return true
  if (PROTECTED_LOCAL_PREFIXES.some((prefix) => file.startsWith(prefix))) return true
  if (file.includes('/quarantine/')) return true
  if (name === '.env' || name.startsWith('.env.')) return true
  if (BINARY_EXTENSIONS.has(extension)) return true
  return false
}

export function redactSensitiveText(value, repositoryRoot = process.cwd()) {
  let text = String(value || '')
  const rootForward = normalizePath(repositoryRoot)
  const rootBackward = String(repositoryRoot).replace(/\//g, '\\')

  for (const root of [rootForward, rootBackward]) {
    if (root) text = text.split(root).join('<repository-root>')
  }

  text = text.replace(
    /content[\\/]imports[\\/]html-case-bank[\\/]raw(?:[\\/][A-Za-z0-9._-]+)?/gi,
    '[sensitive legacy source path omitted; see sensitive-deletion-summary.md]',
  )
  text = text.replace(
    /[A-Za-z]:[\\/](?:Users|dev)(?:[\\/][^\s"'<>|]*)?/gi,
    '<private-local-path>',
  )

  return text
}
