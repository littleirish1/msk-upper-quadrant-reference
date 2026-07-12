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

  if (!/isFeedbackOpen\s*\?\s*'Hide model reasoning'\s*:\s*'Show model reasoning checklist'/.test(source)) {
    fail(
      'Reasoning checklist control must toggle exactly between "Show model reasoning checklist" and "Hide model reasoning".',
    )
  }
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
  const matches = extractButtons(html).filter((button) => {
    const controls = getAttr(button.attrs, 'aria-controls')
    return (
      typeof controls === 'string' &&
      controls.startsWith('field-feedback-') &&
      getAttr(button.attrs, 'aria-expanded') === 'false' &&
      button.text === 'Show model reasoning checklist'
    )
  })

  return matches.length === REASONING_CHECKLIST_PROMPT_COUNT
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
