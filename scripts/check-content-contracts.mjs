import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  loadSchemas,
  readCaseFrontmatter,
  relativePath,
} from './lib/readMdxFrontmatter.mjs'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'out')
const CASES_INDEX_FILE = path.join(OUT_DIR, 'cases', 'index.html')
const BASE_PATH = '/msk-upper-quadrant-reference'
const failures = []
let passedAssertions = 0

const { caseFrontmatterSchema } = await loadSchemas()
const casePublication = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'casePublication.ts'),
  path.join(ROOT, 'src'),
)
const baseCase = {
  title: 'Internal teaching title',
  region: 'cervical',
  condition: 'mechanical-neck-pain',
  status: 'draft',
  publicSlug: 'case-99-neutral-presentation',
}

run('guided case status is required', () => {
  const { status, ...withoutStatus } = baseCase
  void status
  expectInvalid(withoutStatus, 'status')
})

run('guided case publicSlug rejects non-neutral syntax', () => {
  expectInvalid({ ...baseCase, publicSlug: 'Diagnosis Case 01' }, 'publicSlug')
})

run('legacy-derived cases require complete source metadata', () => {
  expectInvalid({
    ...baseCase,
    sourceType: 'legacy-html-case-bank',
    sourceId: 's99',
  }, 'sourcePath')
})

run('private status helper excludes draft and archived cases', () => {
  assert.equal(isPrivateStatus('draft'), true)
  assert.equal(isPrivateStatus('archived'), true)
  assert.equal(isPrivateStatus('published'), false)
})

run('learningFocus is explicitly classified as private internal metadata', () => {
  assert.ok(casePublication.CASE_FRONTMATTER_VISIBILITY.privateInternal.includes('learningFocus'))
  assert.equal(casePublication.CASE_FRONTMATTER_VISIBILITY.publicPreReveal.includes('learningFocus'), false)
})

run('public case summaries reject private and reveal-gated metadata', () => {
  const publicSummary = {
    region: 'cervical',
    publicSlug: 'case-99-neutral-presentation',
    displayTitle: 'Case 99 - Neutral presentation',
    excerpt: 'Neutral learner-facing stem.',
  }
  assert.deepEqual(casePublication.createPublicCaseSummary(publicSummary), publicSummary)
  assert.throws(
    () => casePublication.createPublicCaseSummary({
      ...publicSummary,
      learningFocus: ['Private teaching focus'],
    }),
    /Restricted guided-case metadata.*learningFocus/,
  )
  assert.throws(
    () => casePublication.createPublicCaseSummary({
      ...publicSummary,
      condition: 'internal-condition',
    }),
    /Restricted guided-case metadata.*condition/,
  )
})

await checkFileSpecificSchemaError()
await checkCurrentCaseContracts()

if (failures.length > 0) {
  console.error('Content contract check failed.')
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}

console.log('Content contract check passed.')
console.log('Deterministic assertions passed: ' + passedAssertions)

function run(name, assertion) {
  try {
    assertion()
    passedAssertions++
  } catch (error) {
    failures.push(name + ': ' + error.message)
  }
}

function expectInvalid(data, expectedField) {
  const result = caseFrontmatterSchema.safeParse(data)
  assert.equal(result.success, false)
  const fields = result.error.issues.map((issue) => issue.path.join('.'))
  assert.ok(fields.includes(expectedField), 'expected schema issue for ' + expectedField)
}

async function checkFileSpecificSchemaError() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-content-contracts-'))
  const file = path.join(tempDir, 'missing-status-case.mdx')

  try {
    fs.writeFileSync(file, [
      '---',
      'title: Missing status',
      'region: cervical',
      'condition: mechanical-neck-pain',
      '---',
      '',
      '# Test',
      '',
    ].join('\n'), 'utf8')

    let message = ''
    try {
      await readCaseFrontmatter(file)
    } catch (error) {
      message = error.message
    }

    assert.match(message, /missing-status-case\.mdx/)
    assert.match(message, /status/)
    passedAssertions++
  } catch (error) {
    failures.push('file-specific schema error: ' + error.message)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

async function checkCurrentCaseContracts() {
  if (!fs.existsSync(CASES_INDEX_FILE)) {
    failures.push('missing out/cases/index.html; run npm run build first')
    return
  }

  const conditionMap = new Map(
    (await getTaxonomyConditions()).map((condition) => [
      condition.region + ':' + condition.slug,
      condition,
    ]),
  )
  const casesIndexHtml = fs.readFileSync(CASES_INDEX_FILE, 'utf8')
  let publishedCount = 0
  let privateCount = 0

  for (const file of collectCaseFiles()) {
    try {
      const { data } = await readCaseFrontmatter(file)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const publicSlug = data.publicSlug || caseSlug

      if (isPrivateStatus(data.status)) {
        privateCount++
        const candidateSlugs = new Set([caseSlug, data.publicSlug].filter(Boolean))
        for (const slug of candidateSlugs) {
          const routeFile = path.join(OUT_DIR, 'cases', region, slug, 'index.html')
          assert.equal(fs.existsSync(routeFile), false, 'private route exists: ' + relativePath(routeFile))
        }
        continue
      }

      publishedCount++
      assert.ok(data.publicSlug, 'published case requires explicit neutral publicSlug: ' + relativePath(file))
      assert.equal(
        normalize(data.publicSlug).includes(normalize(data.condition)),
        false,
        'publicSlug contains linked condition: ' + data.publicSlug,
      )

      const publicRoute = '/cases/' + region + '/' + data.publicSlug
      const routeFile = path.join(OUT_DIR, 'cases', region, data.publicSlug, 'index.html')
      assert.equal(fs.existsSync(routeFile), true, 'published route missing: ' + publicRoute)
      assert.equal(htmlIncludesRoute(casesIndexHtml, publicRoute), true, 'published case missing from /cases: ' + publicRoute)

      const cardHtml = getHtmlAroundRoute(casesIndexHtml, publicRoute)
      const condition = conditionMap.get(region + ':' + data.condition)
      for (const term of [data.condition, condition?.label].filter(Boolean)) {
        if (normalize(term).length >= 4) {
          assert.equal(
            normalize(cardHtml).includes(normalize(term)),
            false,
            'learner label leaks condition term ' + term + ': ' + publicRoute,
          )
        }
      }

      passedAssertions++
    } catch (error) {
      failures.push(relativePath(file) + ': ' + error.message)
    }
  }

  if (publishedCount === 0) failures.push('no published cases found')
  if (privateCount === 0) failures.push('no private cases found; exclusion check would be vacuous')

  console.log('Published case contracts checked: ' + publishedCount)
  console.log('Private case exclusions checked: ' + privateCount)
}

function getHtmlAroundRoute(html, route) {
  const indexes = routeVariants(route).map((value) => html.indexOf(value)).filter((index) => index >= 0)
  if (indexes.length === 0) return ''
  const index = Math.min(...indexes)
  return html.slice(Math.max(0, index - 3000), Math.min(html.length, index + 3000))
}

function htmlIncludesRoute(html, route) {
  return routeVariants(route).some((value) => html.includes(value))
}

function routeVariants(route) {
  const clean = route.replace(/\/+$/g, '')
  return [clean, clean + '/', BASE_PATH + clean, BASE_PATH + clean + '/']
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
