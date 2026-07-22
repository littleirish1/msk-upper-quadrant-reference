import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'config', 'sensitive-data-policy.json'), 'utf8'))
const hygiene = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'content-hygiene-names.json'), 'utf8'))
const governedNames = hygiene.termsToFlag ?? []

const month = '(?:January|February|March|April|May|June|July|August|September|October|November|December)'
const keyNames = [
  ['API', 'KEY'].join('_'),
  ['ACCESS', 'TOKEN'].join('_'),
  ['PRIVATE', 'KEY'].join('_'),
  ['SEC', 'RET'].join(''),
].join('|')

const rules = [
  ['email-address', /(?<![\w.+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])/giu],
  ['telephone-number', /(?<!\d)(?:(?:\+|00)44[\s().-]*\d(?:[\s().-]*\d){8,10}|0\d(?:[\s().-]*\d){8,10})(?!\d)/gu],
  ['uk-postcode', /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/giu],
  ['date-of-birth', new RegExp(`\\b(?:DOB|date\\s+of\\s+birth|born)\\s*[:#-]?\\s*(?:\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+${month}\\s+\\d{4}|${month}\\s+\\d{1,2},?\\s+\\d{4})\\b`, 'giu')],
  ['nhs-number', /\bNHS\s*(?:number|no\.?|id)?\s*[:#-]?\s*(?:\d[\s-]*){10}\b/giu],
  ['patient-or-hospital-identifier', /\b(?:hospital|patient|medical\s+record|case)\s*(?:number|no\.?|id|identifier)\s*[:#-]?\s*[A-Z0-9][A-Z0-9/-]{4,19}\b/giu],
  ['student-or-candidate-identifier', /\b(?:student|candidate|university)\s*(?:number|no\.?|id|identifier)\s*[:#-]?\s*[A-Z0-9][A-Z0-9/-]{4,19}\b/giu],
  ['private-absolute-path', /\b[A-Z]:[\\/](?:Users|dev|home|Documents|Desktop|Downloads)[\\/][^\r\n]+/giu],
  ['unc-path', /\\\\[^\\\s]+\\[^\r\n]+/gu],
  ['credential-value', /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu],
  ['credential-value', /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu],
  ['credential-value', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu],
  ['credential-value', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu],
  ['credential-value', /\bxox[a-z]-[A-Za-z0-9-]{20,}\b/gu],
  ['credential-value', new RegExp(`\\b(?:${keyNames})\\b\\s*[:=]\\s*[^\\s,;]{8,}`, 'giu')],
]

const bidiOrControl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u
const contactWords = /\b(?:presented\s+by|presentation\s+by|author\s+contact|correspondence|e-?mail|telephone|phone|contact|address)\b/iu
const honorific = /\b(?:Mr|Mrs|Ms|Miss|Dr|Professor|Prof)\.?\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+/u

function isValidNhsCandidate(value) {
  const digits = [...value.replace(/\D/g, '')].map(Number)
  if (digits.length !== 10) return false
  const total = digits.slice(0, 9).reduce((sum, digit, index) => sum + digit * (10 - index), 0)
  let check = 11 - (total % 11)
  if (check === 11) check = 0
  return check !== 10 && check === digits[9]
}

export function scanSensitiveText(text, options = {}) {
  const findings = []
  for (const [category, pattern] of rules) {
    pattern.lastIndex = 0
    if (pattern.test(text)) findings.push(category)
  }
  for (const match of text.matchAll(/(?<!\d)(?:\d[ -]?){9}\d(?!\d)/gu)) {
    if (isValidNhsCandidate(match[0])) findings.push('suspicious-nhs-candidate')
  }
  const lower = text.toLocaleLowerCase('en')
  const names = options.governedNames ?? governedNames
  if (names.some((name) => lower.includes(name.toLocaleLowerCase('en')))) findings.push('governed-sensitive-name')
  if (bidiOrControl.test(text)) findings.push('bidi-or-control-character')
  const contact = contactWords.test(text) && (rules.slice(0, 3).some(([, pattern]) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  }) || honorific.test(text))
  if (contact) findings.push('contact-or-correspondence-block')
  return [...new Set(findings)].sort()
}

export function sensitivePolicy() {
  return policy
}
