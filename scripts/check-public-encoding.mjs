import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import {
  collectCaseFiles,
  collectConditionFiles,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const decoder = new TextDecoder('utf-8', { fatal: true })
const findings = []
const checked = new Set()
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mdx',
  '.txt',
  '.xml',
])
const CORRUPTION_PATTERNS = [
  ['replacement character', /\uFFFD/u],
  ['C1 control character', /[\u0080-\u009F]/u],
  ['UTF-8/Windows-1252 mojibake', /(?:\u00C3|\u00E2)[\u0080-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013-\u203A\u20AC\u2122]/u],
  ['stray Latin-1 lead byte', /\u00C2[\u0080-\u00BF\u00A0-\u00BF]/u],
]

for (const file of collectConditionFiles()) checkFile(file, 'public condition source')

for (const file of collectCaseFiles()) {
  try {
    const { data } = await readCaseFrontmatter(file)
    if (!isPrivateStatus(data.status)) checkFile(file, 'published case source')
  } catch (error) {
    fail(`${relative(file)}: unable to determine case publication status (${error.message})`)
  }
}

for (const file of collectFiles(path.join(ROOT, 'src'), new Set(['.css', '.ts', '.tsx']))) {
  checkFile(file, 'public runtime source')
}

checkFile(path.join(ROOT, 'public', 'search-index.json'), 'generated search index')

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build before check:encoding.')
} else {
  for (const file of collectFiles(OUT_DIR, TEXT_EXTENSIONS)) {
    checkFile(file, 'generated public output')
  }
}

if (findings.length > 0) {
  console.error('Public encoding check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('Public encoding check passed.')
console.log(`UTF-8 public files checked: ${checked.size}`)
console.log('Known mojibake findings: 0')

function checkFile(file, scope) {
  if (!fs.existsSync(file) || checked.has(file)) return
  checked.add(file)

  let text
  try {
    text = decoder.decode(fs.readFileSync(file))
  } catch {
    fail(`${relative(file)}: invalid UTF-8 (${scope})`)
    return
  }

  // Next's standards polyfill intentionally embeds U+0085 and U+FFFD as
  // conformance fixtures. Keep the exception pinned to that generated vendor
  // chunk; application chunks and every learner-facing output remain scanned.
  if (
    scope === 'generated public output'
    && /^out\/_next\/static\/chunks\/polyfills-[0-9a-f]+\.js$/u.test(relative(file))
  ) {
    return
  }

  for (const [label, pattern] of CORRUPTION_PATTERNS) {
    if (pattern.test(text)) fail(`${relative(file)}: ${label} (${scope})`)
  }
}

function collectFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(fullPath, extensions))
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath)
  }
  return files.sort()
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function fail(message) {
  findings.push(message)
}
