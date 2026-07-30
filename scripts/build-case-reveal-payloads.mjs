import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compileMDX } from 'next-mdx-remote/rsc'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import {
  collectCaseFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  readCaseFrontmatter,
} from './lib/readMdxFrontmatter.mjs'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'
import { readRecords } from './guided-cases/shared.mjs'

const ROOT = process.cwd()
const OUTPUT_DIR = path.join(ROOT, 'public', 'case-reveals')
const SOURCE_ROOT = path.join(ROOT, 'src')
const [{ getCaseRevealId }, contentHelpers, mdxHelpers, feedbackHelpers] = await Promise.all([
  loadTypeScriptTree(path.join(SOURCE_ROOT, 'lib', 'caseRevealServer.ts'), SOURCE_ROOT),
  loadTypeScriptTree(path.join(SOURCE_ROOT, 'lib', 'caseContent.ts'), SOURCE_ROOT),
  loadTypeScriptTree(path.join(SOURCE_ROOT, 'lib', 'mdxParsing.ts'), SOURCE_ROOT),
  loadTypeScriptTree(path.join(SOURCE_ROOT, 'lib', 'caseEnhancedFeedback.ts'), SOURCE_ROOT),
])
const {
  extractCaseRevealContent,
  stripPreRevealLinkedConditionSection,
} = contentHelpers
const { parseSections, sanitizeMdxContent, stripInternalCaseHeading } = mdxHelpers
const { getEnhancedCaseFeedback } = feedbackHelpers

const conditions = await getTaxonomyConditions()
const conditionsByKey = new Map(
  conditions.map((condition) => [`${condition.region}:${condition.slug}`, condition]),
)
const payloads = []
const governed = await readRecords()
if (governed.findings.length) {
  throw new Error(governed.findings.join('\n'))
}
const governedById = new Map(governed.records.map(({ record }) => [record.caseId, record]))
const guidedCaseModule = governed.module

for (const file of collectCaseFiles()) {
  const { content: rawContent, data } = await readCaseFrontmatter(file)
  if (isPrivateStatus(data.status)) continue

  const region = path.basename(path.dirname(file))
  const caseSlug = path.basename(file, '.mdx')
  const governedRecord = governedById.get(data.guidedCaseId)
  if (!governedRecord) {
    throw new Error(`Published case has no governed record: ${relative(file)}`)
  }
  const governedReveal = guidedCaseModule.createPublicRevealPayload(governedRecord)
  if (governedReveal.associatedConditionId !== data.condition) {
    throw new Error(`Governed condition does not match MDX frontmatter: ${relative(file)}`)
  }
  const publicSlug = data.publicSlug
  const revealId = getCaseRevealId(region, publicSlug)
  const condition = conditionsByKey.get(`${region}:${data.condition}`)
  const learnerContent = stripPreRevealLinkedConditionSection(
    stripInternalCaseHeading(sanitizeMdxContent(rawContent)),
  )
  const revealContent = extractCaseRevealContent(learnerContent)
  if (!revealContent) {
    throw new Error(`Published case has no reveal content: ${relative(file)}`)
  }

  const { content } = await compileMDX({
    source: revealContent,
    components: getRevealComponents(),
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      },
    },
  })

  payloads.push({
    schemaVersion: 1,
    revealId,
    actualTitle: governedReveal.internalTitle,
    ...(condition ? {
      conditionLabel: condition.label,
      conditionHref: `/${region}/${condition.slug}`,
    } : {}),
    sections: parseSections(revealContent)
      .filter((section) => section.heading.toLowerCase() !== 'linked evidence and condition pages')
      .map(({ heading, slug }) => ({ heading, slug })),
    contentHtml: renderToStaticMarkup(content),
    ...(getEnhancedCaseFeedback(caseSlug)
      ? { enhancedFeedback: getEnhancedCaseFeedback(caseSlug) }
      : {}),
  })
}

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUTPUT_DIR, { recursive: true })
for (const payload of payloads.sort((a, b) => a.revealId.localeCompare(b.revealId))) {
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${payload.revealId}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  )
}

console.log(`Generated ${payloads.length} delayed case reveal payloads.`)

function getRevealComponents() {
  return {
    ReasoningPrompt({ question, children }) {
    return React.createElement(
      'section',
      { className: 'my-5 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30' },
      React.createElement('p', { className: 'text-sm font-bold uppercase text-purple-700 dark:text-purple-300' }, 'Clinical reasoning prompt'),
      React.createElement('p', { className: 'mt-1 text-sm font-medium leading-relaxed text-purple-950 dark:text-purple-100' }, question),
      children ? React.createElement('div', { className: 'mt-3 text-sm leading-relaxed text-purple-900 dark:text-purple-100' }, children) : null,
    )
    },
    RevealAnswer({ title = 'Compare your reasoning', children }) {
    return React.createElement(
      'details',
      { className: 'my-4 rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-800 dark:bg-surface-900' },
      React.createElement('summary', { className: 'cursor-pointer select-none text-sm font-semibold text-brand-700 dark:text-brand-300' }, title),
      React.createElement('div', { className: 'mt-3 border-t border-surface-100 pt-3 text-sm leading-relaxed text-surface-700 dark:border-surface-800 dark:text-surface-300' }, children),
    )
    },
    RedFlag({ title, children }) {
    return React.createElement(
      'aside',
      { className: 'my-4 rounded-lg border-2 border-danger-500 bg-danger-50 p-4 dark:border-danger-600 dark:bg-danger-950' },
      React.createElement('p', { className: 'font-bold uppercase text-danger-700 dark:text-danger-300' }, title ?? 'Red flag'),
      React.createElement('div', { className: 'mt-1 text-sm leading-relaxed text-danger-900 dark:text-danger-100' }, children),
    )
    },
  }
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
