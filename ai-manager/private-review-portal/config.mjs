import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const portalDirectory = path.dirname(fileURLToPath(import.meta.url))
export const repositoryRoot = path.resolve(portalDirectory, '..', '..')
const loopbackHosts = new Set(['127.0.0.1', '::1'])

function positiveInteger(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) throw new Error(`${name} must be a positive integer no greater than ${maximum}.`)
  return parsed
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function loadConfig(environment = process.env) {
  const host = environment.MSK_REVIEW_PORTAL_HOST ?? '127.0.0.1'
  if (!loopbackHosts.has(host)) throw new Error('MSK_REVIEW_PORTAL_HOST must be an explicit loopback address (127.0.0.1 or ::1).')

  const port = positiveInteger(environment.MSK_REVIEW_PORTAL_PORT, 4379, 'MSK_REVIEW_PORTAL_PORT', 65535)
  const defaultDataRoot = process.platform === 'win32'
    ? 'C:\\dev\\msk-private-review-data'
    : path.join(os.homedir(), '.local', 'share', 'msk-private-review-data')
  const dataRoot = path.resolve(environment.MSK_REVIEW_PORTAL_DATA_ROOT ?? defaultDataRoot)
  if (isWithin(repositoryRoot, dataRoot)) throw new Error('Private review data must be stored outside the Git repository.')

  const passphrase = environment.MSK_REVIEW_PORTAL_PASSPHRASE
  if (!passphrase || passphrase.length < 16) throw new Error('MSK_REVIEW_PORTAL_PASSPHRASE must be supplied through the environment and contain at least 16 characters.')

  const localOrigin = `http://${host === '::1' ? '[::1]' : host}:${port}`
  const origins = new Set((environment.MSK_REVIEW_PORTAL_ORIGINS ?? localOrigin).split(',').map((item) => item.trim()).filter(Boolean))
  for (const origin of origins) {
    const parsed = new URL(origin)
    const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
    if (!isLocal && parsed.protocol !== 'https:') throw new Error('Non-loopback portal origins must use HTTPS.')
  }

  const networkExposure = environment.MSK_REVIEW_PORTAL_NETWORK_EXPOSURE ?? 'local'
  if (!['local', 'tailscale-serve'].includes(networkExposure)) throw new Error('Only local or tailscale-serve exposure is permitted.')
  if (networkExposure === 'tailscale-serve' && ![...origins].some((origin) => new URL(origin).protocol === 'https:')) {
    throw new Error('Tailscale Serve exposure requires an explicit HTTPS origin in MSK_REVIEW_PORTAL_ORIGINS.')
  }

  return Object.freeze({
    host,
    port,
    dataRoot,
    passphrase,
    origins,
    networkExposure,
    repositoryRoot,
    maxFileBytes: positiveInteger(environment.MSK_REVIEW_PORTAL_MAX_FILE_BYTES, 25 * 1024 * 1024, 'MSK_REVIEW_PORTAL_MAX_FILE_BYTES', 100 * 1024 * 1024),
    maxBatchBytes: positiveInteger(environment.MSK_REVIEW_PORTAL_MAX_BATCH_BYTES, 100 * 1024 * 1024, 'MSK_REVIEW_PORTAL_MAX_BATCH_BYTES', 500 * 1024 * 1024),
    jsonBodyBytes: positiveInteger(environment.MSK_REVIEW_PORTAL_JSON_BODY_BYTES, 64 * 1024, 'MSK_REVIEW_PORTAL_JSON_BODY_BYTES', 1024 * 1024),
    inactivityMs: positiveInteger(environment.MSK_REVIEW_PORTAL_INACTIVITY_MS, 15 * 60 * 1000, 'MSK_REVIEW_PORTAL_INACTIVITY_MS', 24 * 60 * 60 * 1000),
    absoluteSessionMs: positiveInteger(environment.MSK_REVIEW_PORTAL_SESSION_MS, 8 * 60 * 60 * 1000, 'MSK_REVIEW_PORTAL_SESSION_MS', 24 * 60 * 60 * 1000),
    rateLimitPerMinute: positiveInteger(environment.MSK_REVIEW_PORTAL_RATE_LIMIT, 120, 'MSK_REVIEW_PORTAL_RATE_LIMIT', 1000),
  })
}
