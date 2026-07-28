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
const REASONING_PROMPT_FILE = path.join(ROOT, 'src', 'components', 'cases', 'CaseReasoningPrompt.tsx')

// Must match REFLECTION_PROMPTS.length in CaseReasoningPrompt.tsx.
const REASONING_CHECKLIST_PROMPT_COUNT = 4

const findings = []

if (!fs.existsSync(CASES_DIR)) {
  fail('Missing guided cases directory: content/cases')
}

if (!fs.existsSync(OUT_DIR)) {
  fail('Missing static export directory: out. Run npm run build before npm run check:reveal.')
}

checkRevealAnswerComponent()
checkReasoningPromptComponent()

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
  checkLearnerFacingCaseHeading(html, item, route)

  if (!hasPreQuestionPresentation(html)) {
    fail(`Published case page is missing a pre-question case presentation block: ${route}`)
  }

  if (!hasReasoningChecklistRevealControls(html)) {
    fail(`Published case page is missing the reasoning checklist reveal controls: ${route}`)
  }

  if (!hasSuggestedReasoningRevealControl(html)) {
    fail(`Published case page is missing the suggested reasoning reveal/collapse control: ${route}`)
  }

  if (!hasDiagnosisRevealControl(html)) {
    fail(`Published case page is missing the diagnosis reveal control: ${route}`)
  }

  if (!hasNoPrematureLinkedConditionButton(html)) {
    fail(`Published case page exposes the linked condition button before diagnosis reveal: ${route}`)
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
        internalHeading: extractInitialH1(content),
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

function checkReasoningPromptComponent() {
  if (!fs.existsSync(REASONING_PROMPT_FILE)) {
    fail('Missing CaseReasoningPrompt component file: src/components/cases/CaseReasoningPrompt.tsx')
    return
  }

  const source = fs.readFileSync(REASONING_PROMPT_FILE, 'utf8')

  // Pin the exact reveal/collapse label pair so a wording change that keeps
  // the old label as a substring of the new one cannot pass silently.
  if (!/reasoningRevealed\s*\?\s*'Hide suggested reasoning'\s*:\s*'Reveal suggested reasoning'/.test(source)) {
    fail(
      'Suggested reasoning control must toggle exactly between "Reveal suggested reasoning" and "Hide suggested reasoning".',
    )
  }

  if (!/<details[\s\S]*data-reasoning-feedback=\{prompt\.field\}[\s\S]*<summary/i.test(source)) {
    fail(
      'Reasoning checklist controls must use native details/summary disclosures.',
    )
  }

  if (/openFieldFeedback|toggleFieldFeedback/.test(source)) {
    fail('Reasoning checklist controls must not reimplement native disclosure state.')
  }
}

function checkLearnerFacingCaseHeading(html, item, route) {
  const preRevealHtml = getPreRevealHtml(html)
  const headingTexts = extractElementText(preRevealHtml, 'h1')
  const publicNumber = item.publicSlug.match(/^case-(\d+)-/i)?.[1]

  if (!publicNumber) {
    fail(`Published case slug has no learner-facing number: ${route}`)
    return
  }

  if (headingTexts.length !== 1) {
    fail(`Published case page must have exactly one pre-reveal H1: ${route}`)
    return
  }

  const expectedNumber = String(Number(publicNumber)).padStart(2, '0')
  const visibleNumbers = new Set(
    stripInnerMarkup(preRevealHtml)
      .match(/\bCase\s+(\d+)\b/gi)
      ?.map((value) => String(Number(value.match(/\d+/)[0])).padStart(2, '0'))
      ?? [],
  )

  if (!visibleNumbers.has(expectedNumber) || visibleNumbers.size !== 1) {
    fail(
      `Published case page has conflicting learner-facing numbers (${[...visibleNumbers].join(', ') || 'none'}): ${route}`,
    )
  }

  if (!new RegExp(`\\bCase\\s+0*${Number(publicNumber)}\\b`, 'i').test(headingTexts[0])) {
    fail(`Published case H1 does not match its public route number: ${route}`)
  }

  const internalHeading = normalizeVisibleText(item.internalHeading)
  if (
    internalHeading
    && internalHeading !== normalizeVisibleText(headingTexts[0])
    && normalizeVisibleText(preRevealHtml).includes(internalHeading)
  ) {
    fail(`Published case page renders its internal teaching heading before reveal: ${route}`)
  }
}

function getPreRevealHtml(html) {
  const markers = [
    'Reveal likely diagnosis / linked condition',
    'Reveal likely concern / linked condition',
  ]
  const indexes = markers
    .map((marker) => html.indexOf(marker))
    .filter((index) => index >= 0)
  return indexes.length ? html.slice(0, Math.min(...indexes)) : html
}

function extractInitialH1(content) {
  const normalized = String(content).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  return /^(?:[ \t]*\n)*[ \t]{0,3}#(?!#)[ \t]+([^\n]+)/u.exec(normalized)?.[1]?.trim() ?? ''
}

function extractElementText(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi')
  return [...html.matchAll(pattern)].map((match) => stripInnerMarkup(match[1]))
}

function normalizeVisibleText(value) {
  return stripInnerMarkup(value)
    .replace(/&(?:middot|#183|#xB7);/gi, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function extractRevealAnswerBlocks(content) {
  return [...content.matchAll(/<RevealAnswer\b([^>]*)>([\s\S]*?)<\/RevealAnswer>/gi)]
    .map((match) => ({
      attributes: match[1] ?? '',
      body: match[2] ?? '',
    }))
}

function hasPreQuestionPresentation(html) {
  return html.includes('Case presentation') && html.includes('What you know so far')
}

// Structural + exact-text checks below replace loose substring matching.
// A relabel such as "Reveal suggested reasoning and next steps" must fail
// these checks even though it still contains the old string as a substring.

function hasReasoningChecklistRevealControls(html) {
  const disclosures = extractReasoningFeedbackDisclosures(html)
  if (disclosures.length !== REASONING_CHECKLIST_PROMPT_COUNT) return false

  const accessibleNames = new Set()
  for (const disclosure of disclosures) {
    if (hasOpenAttribute(disclosure.attrs)) return false

    const field = getAttr(disclosure.attrs, 'data-reasoning-feedback')
    const summary = /<summary\b([^>]*)>([\s\S]*?)<\/summary>/i.exec(disclosure.body)
    if (!field || !summary) return false

    const summaryId = getAttr(summary[1], 'id')
    const accessibleName = stripInnerMarkup(summary[2])
    const feedbackId = `field-feedback-${field}`
    const summaryIdExpected = `field-feedback-summary-${field}`
    const panelPattern = new RegExp(
      `<div\\b(?=[^>]*\\bid="${escapeRegExp(feedbackId)}")(?=[^>]*\\baria-labelledby="${escapeRegExp(summaryIdExpected)}")[^>]*>`,
      'i',
    )

    if (summaryId !== summaryIdExpected) return false
    if (!accessibleName.toLowerCase().includes('model reasoning checklist')) return false
    if (!panelPattern.test(disclosure.body)) return false
    accessibleNames.add(accessibleName.toLowerCase())
  }

  return accessibleNames.size === REASONING_CHECKLIST_PROMPT_COUNT
}

function hasSuggestedReasoningRevealControl(html) {
  return extractButtons(html).some(
    (button) =>
      getAttr(button.attrs, 'aria-controls') === 'case-learning-content' &&
      getAttr(button.attrs, 'aria-expanded') === 'false' &&
      button.text === 'Reveal suggested reasoning',
  )
}

function hasDiagnosisRevealControl(html) {
  return extractButtons(html).some(
    (button) =>
      getAttr(button.attrs, 'aria-controls') === null &&
      getAttr(button.attrs, 'aria-expanded') === 'false' &&
      (button.text === 'Reveal likely diagnosis / linked condition' ||
        button.text === 'Reveal likely concern / linked condition'),
  )
}

function hasNoPrematureLinkedConditionButton(html) {
  return !extractButtons(html).some((button) => button.text === 'Open linked condition reference')
}

function extractButtons(html) {
  const buttons = []
  const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi
  let match

  while ((match = buttonPattern.exec(html)) !== null) {
    buttons.push({
      attrs: match[1] ?? '',
      text: stripInnerMarkup(match[2] ?? ''),
    })
  }

  return buttons
}

function extractReasoningFeedbackDisclosures(html) {
  return [...html.matchAll(/<details\b([^>]*\bdata-reasoning-feedback="[^"]+"[^>]*)>([\s\S]*?)<\/details>/gi)]
    .map((match) => ({
      attrs: match[1] ?? '',
      body: match[2] ?? '',
    }))
}

function stripInnerMarkup(value) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getAttr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match ? match[1] : null
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
