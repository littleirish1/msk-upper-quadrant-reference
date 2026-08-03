import crypto from 'node:crypto'

export const securityHeaders = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; media-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
})

const base64url = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

export function createPassphraseVerifier(passphrase) {
  const salt = crypto.randomBytes(32)
  const expected = crypto.scryptSync(passphrase, salt, 64)
  return (candidate) => {
    const actual = crypto.scryptSync(String(candidate ?? ''), salt, 64)
    return crypto.timingSafeEqual(actual, expected)
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf('=')
    if (separator < 0) return [entry, '']
    return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))]
  }))
}

export class SessionStore {
  constructor({ inactivityMs, absoluteSessionMs, now = () => Date.now() }) {
    this.inactivityMs = inactivityMs
    this.absoluteSessionMs = absoluteSessionMs
    this.now = now
    this.records = new Map()
  }

  create(role = 'reviewer') {
    const token = base64url(48)
    const createdAt = this.now()
    const session = { idHash: sha256(token), csrf: base64url(32), role, createdAt, lastSeenAt: createdAt, revokedAt: null }
    this.records.set(session.idHash, session)
    return { token, csrf: session.csrf, role }
  }

  get(token, { touch = true } = {}) {
    if (!token) return null
    const session = this.records.get(sha256(token))
    if (!session || session.revokedAt) return null
    const now = this.now()
    if (now - session.lastSeenAt > this.inactivityMs || now - session.createdAt > this.absoluteSessionMs) {
      this.records.delete(session.idHash)
      return null
    }
    if (touch) session.lastSeenAt = now
    return session
  }

  revoke(token) {
    const hash = token ? sha256(token) : ''
    const session = this.records.get(hash)
    if (!session) return false
    session.revokedAt = this.now()
    this.records.delete(hash)
    return true
  }
}

export class SlidingWindowRateLimiter {
  constructor(limit, windowMs = 60_000, now = () => Date.now()) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
    this.entries = new Map()
  }

  consume(key) {
    const now = this.now()
    const recent = (this.entries.get(key) ?? []).filter((time) => now - time < this.windowMs)
    if (recent.length >= this.limit) return false
    recent.push(now)
    this.entries.set(key, recent)
    return true
  }
}

export function isAllowedOrigin(request, origins) {
  const origin = request.headers.origin
  return typeof origin === 'string' && origins.has(origin)
}

export function isAllowedHost(request, origins) {
  const host = String(request.headers.host ?? '').toLowerCase()
  return [...origins].some((origin) => new URL(origin).host.toLowerCase() === host)
}

export function sessionCookie(token, secure) {
  return `msk_review_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? '; Secure' : ''}`
}

export function expiredSessionCookie(secure) {
  return `msk_review_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`
}

export function csrfMatches(session, request) {
  const supplied = request.headers['x-csrf-token']
  if (typeof supplied !== 'string') return false
  const expected = Buffer.from(session.csrf)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
