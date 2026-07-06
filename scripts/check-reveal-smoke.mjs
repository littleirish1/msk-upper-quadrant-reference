import fs from 'fs'
import path from 'path'
import {
  collectCaseFiles,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const CASES_DIR = path.join(ROOT, 'content', 'cases')
const OUT_DIR = path.join(ROOT, 'out')
const COMPONENT_FILE = path.join(ROOT, 'src', 'components', 'mdx', 'MDXComponents.tsx')

const findings = []

if (!fs.existsSync(CASES_DIR)) {
  fail('Missing guided cases directory: content/cases')
}

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build before npm run check:reveal.')
}

checkRevealAnswerComponent()

const cases = await readCases()
const publishedCases = cases.filter((item) => !isPrivateStatus(item.status))
const privateCases = cases.filter((item) => isPrivateStatus(item.status))
let revealBlockCount = 0

if (cases.length === 0) {
  fail('No guided case files found for reveal smoke check.')
}

if (publishedCases.length === 0) {
  fail('No published guided cases found for reveal smoke check.')
}

for (const item of publishedCases) {
  const routeFile = path.join(OUT_DIR, 'cases', item.region, item.publicSlug, 'index.html')
  const route = `/cases/${item.region}/${item.publicSlug}`

  if (!fs.existsSync(routeFile)) {
    fail(`Published case route missing for reveal smoke check: ${route}`)
    continue
  }

  const html = fs.readFileSync(routeFile, 'utf8')
  if (!hasPreQuestionPresentation(html)) {
    fail(`Published case page is missing a pre-question case presentation block: ${route}`)
  }

  if (!hasPerQuestionFeedbackToggles(html)) {
    fail(`Published case page is missing per-question feedback toggles: ${route}`)
  }

  if (!hasStagedRevealControls(html)) {
    fail(`Published case page is missing staged reveal controls: ${route}`)
  }

  const blocks = extractRevealAnswerBlocks(item.content)
  if (blocks.length === 0) {
    fail(`Published case source has no RevealAnswer blocks: ${item.relativePath}`)
    continue
  }

  for (const [index, block] of blocks.entries()) {
    revealBlockCount += 1

    if (hasOpenAttribute(block.attributes)) {
      fail(`RevealAnswer block is configured open by default: ${item.relativePath} block ${index + 1}`)
    }

    if (stripMarkup(block.body).length === 0) {
      fail(`RevealAnswer block is empty: ${item.relativePath} block ${index + 1}`)
    }
  }
}

for (const item of privateCases) {
  const publicRouteFile = path.join(OUT_DIR, 'cases', item.region, item.publicSlug, 'index.html')
  const internalRouteFile = path.join(OUT_DIR, 'cases', item.region, item.caseSlug, 'index.html')

  if (fs.existsSync(publicRouteFile) || fs.existsSync(internalRouteFile)) {
    fail(`Private case route was generated during reveal smoke check: /cases/${item.region}/${item.publicSlug}`)
  }
}

if (findings.length > 0) {
  console.error('\nReveal smoke check failed.\n')
  for (const finding of findings) {
    console.error(`- ${finding}`)
  }
  process.exit(1)
}

console.log('Reveal smoke check passed.')
console.log(`Published case pages checked: ${publishedCases.length}`)
console.log(`RevealAnswer blocks checked: ${revealBlockCount}`)
console.log(`Private case routes excluded: ${privateCases.length}`)
console.log('RevealAnswer renderer uses native closed details/summary.')

async function readCases() {
  if (!fs.existsSync(CASES_DIR)) return []

  const items = []
  for (const file of collectCaseFiles()) {
    try {
      const { content, data } = await readCaseFrontmatter(file)
      const region = path.basename(path.dirname(file))
      const caseSlug = path.basename(file, '.mdx')
      const publicSlug = typeof data.publicSlug === 'string' && data.publicSlug.trim()
        ? data.publicSlug.trim()
        : caseSlug

      items.push({
        region,
        caseSlug,
        publicSlug,
        status: data.status,
        content,
        relativePath: toPosix(path.relative(ROOT, file)),
      })
    } catch (error) {
      fail(error.message)
    }
  }

  return items
}

function checkRevealAnswerComponent() {
  if (!fs.existsSync(COMPONENT_FILE)) {
    fail('Missing RevealAnswer component file: src/components/mdx/MDXComponents.tsx')
    return
  }

  const source = fs.readFileSync(COMPONENT_FILE, 'utf8')
  const functionIndex = source.indexOf('export function RevealAnswer')
  if (functionIndex === -1) {
    fail('Missing exported RevealAnswer component.')
    return
  }

  const nextSectionIndex = source.indexOf('interface RedFlagProps', functionIndex)
  const componentSource = source.slice(
    functionIndex,
    nextSectionIndex === -1 ? source.length : nextSectionIndex,
  )
  const detailsMatch = componentSource.match(/<details\b([^>]*)>/i)

  if (!detailsMatch) {
    fail('RevealAnswer must render a native <details> element.')
    return
  }

  if (hasOpenAttribute(detailsMatch[1])) {
    fail('RevealAnswer <details> must be closed by default and must not set the open attribute.')
  }

  if (!/<summary\b[^>]*>/i.test(componentSource)) {
    fail('RevealAnswer must render a native <summary> inside <details> for keyboard operation.')
  }
}

function extractRevealAnswerBlocks(content) {
  return [...content.matchAll(/<RevealAnswer\b([^>]*)>([\s\S]*?)<\/RevealAnswer>/gi)]
    .map((match) => ({
      attributes: match[1] ?? '',
      body: match[2] ?? '',
    }))
}

function hasStagedRevealControls(html) {
  return (
    (html.includes('Reveal likely diagnosis / linked condition') ||
      html.includes('Reveal likely concern / linked condition')) &&
    html.includes('Reveal suggested reasoning')
  )
}

function hasPreQuestionPresentation(html) {
  return html.includes('Case presentation') && html.includes('What you know so far')
}

function hasPerQuestionFeedbackToggles(html) {
  return countOccurrences(html, 'Show model reasoning') >= 4
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1
}

function stripMarkup(value) {
  return String(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>[\]()!-]/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function hasOpenAttribute(attributes) {
  return /(?:^|\s)open(?:\s|=|$)/i.test(attributes)
}

function fail(message) {
  findings.push(message)
}
