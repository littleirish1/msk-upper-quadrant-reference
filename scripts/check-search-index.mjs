import fs from 'fs'
import path from 'path'
import {
  collectCaseFiles,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const INDEX_FILE = path.join(ROOT, 'public', 'search-index.json')
const CASES_DIR = path.join(ROOT, 'content', 'cases')

const findings = []

if (!fs.existsSync(INDEX_FILE)) {
  fail('Missing public/search-index.json. Run npm run build:search or npm run build.')
} else {
  let entries

  try {
    entries = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  } catch (error) {
    fail(`public/search-index.json is not valid JSON: ${error.message}`)
  }

  if (entries && !Array.isArray(entries)) {
    fail('public/search-index.json must contain a JSON array.')
  }

  if (Array.isArray(entries)) {
    if (entries.length === 0) {
      fail('public/search-index.json contains no entries.')
    }

    await checkEntries(entries)
  }
}

if (findings.length > 0) {
  console.error('\nSearch index check failed.\n')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Search index check passed.')

async function checkEntries(entries) {
  const seenIds = new Set()
  const draftOrPrivateCaseSlugs = await readDraftOrPrivateCaseSlugs()

  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      fail(`Entry ${index} is not an object.`)
      continue
    }

    for (const key of ['id', 'title', 'region', 'condition', 'content', 'href']) {
      if (typeof entry[key] !== 'string') {
        fail(`Entry ${index} is missing string field "${key}".`)
      }
    }

    if (typeof entry.id === 'string') {
      if (seenIds.has(entry.id)) {
        fail(`Duplicate search entry id: ${entry.id}`)
      }
      seenIds.add(entry.id)
    }

    const haystack = Object.values(entry)
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase()

    if (haystack.includes('content/imports') || haystack.includes('/imports/') || haystack.includes('imports/raw')) {
      fail(`Search entry includes imported/admin source path: ${entry.id ?? index}`)
    }

    if (haystack.includes('ai-manager')) {
      fail(`Search entry includes ai-manager content: ${entry.id ?? index}`)
    }

    if (typeof entry.href === 'string' && entry.href.startsWith('/cases/')) {
      fail(`Case search entries are intentionally skipped in this phase: ${entry.href}`)
    }

    if (typeof entry.id === 'string' && entry.id.startsWith('cases/')) {
      fail(`Case search entries are intentionally skipped in this phase: ${entry.id}`)
    }

    for (const caseSlug of draftOrPrivateCaseSlugs) {
      if (haystack.includes(caseSlug.toLowerCase())) {
        fail(`Search entry leaks draft/private case slug "${caseSlug}": ${entry.id ?? index}`)
      }
    }

    if (/\b(?:import|export)\b/.test(entry.content) || entry.content.includes('@/')) {
      fail(`Search entry contains MDX implementation syntax: ${entry.id ?? index}`)
    }
  }
}

async function readDraftOrPrivateCaseSlugs() {
  if (!fs.existsSync(CASES_DIR)) return []

  const slugs = []

  for (const file of collectCaseFiles()) {
    try {
      const { data } = await readCaseFrontmatter(file)
      if (isPrivateStatus(data.status)) {
        slugs.push(path.basename(file, '.mdx'))
      }
    } catch (error) {
      fail(error.message)
    }
  }

  return slugs
}

function fail(message) {
  findings.push(message)
}
