import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptTree } from './lib/loadTypeScriptTree.mjs'

const root = process.cwd()
const mdx = await loadTypeScriptTree(path.join(root, 'src', 'lib', 'mdx.ts'), path.join(root, 'src', 'lib'))
let checks = 0

run('condition frontmatter and H2 sections parse together', () => {
  const result = mdx.parseConditionDocument(conditionDocument(), 'content/shoulder/fixture.mdx')
  assert.equal(result.frontmatter.title, 'Fixture condition')
  assert.deepEqual(result.sections.map(({ heading, slug }) => ({ heading, slug })), [
    { heading: 'Overview', slug: 'overview' },
    { heading: 'Outcome Measures', slug: 'outcome-measures' },
  ])
  assert.equal(result.sections[0].content, 'Initial text with &lt;45, &gt;90%, and p&lt;0.05.')
})

run('numeric notation is escaped generically in prose', () => {
  assert.equal(
    mdx.sanitizeMdxContent('<=45 <45 >90% p < .05 p<0.05 change >-2 and delta <+3.5'),
    '&lt;=45 &lt;45 &gt;90% p &lt; .05 p&lt;0.05 change &gt;-2 and delta &lt;+3.5',
  )
})

run('code and JSX syntax remain byte-stable', () => {
  const source = '<Callout label="<45">value</Callout> and `<45` with {score < 45 ? "<" : ">"}\n```txt\n>90%\n```'
  assert.equal(mdx.sanitizeMdxContent(source), source)
})

run('section parsing ignores preamble and H3 headings', () => {
  const sections = mdx.parseSections('Preamble\n### Detail\n## Main\nBody\n### Nested\nMore')
  assert.deepEqual(sections, [{ heading: 'Main', slug: 'main', content: 'Body\n### Nested\nMore' }])
})

run('section parsing ignores fenced headings and disambiguates duplicate headings', () => {
  const sections = mdx.parseSections([
    '## Overview',
    'First.',
    '```md',
    '## Not a section',
    '```',
    '## Overview',
    'Second.',
  ].join('\n'))
  assert.deepEqual(sections.map(({ heading, slug }) => ({ heading, slug })), [
    { heading: 'Overview', slug: 'overview' },
    { heading: 'Overview', slug: 'overview-2' },
  ])
  assert.match(sections[0].content, /## Not a section/)
})

run('empty content has no fabricated sections or excerpt', () => {
  assert.deepEqual(mdx.parseSections(''), [])
  assert.equal(mdx.extractExcerpt(''), '')
})

run('excerpt generation strips frontmatter, first H1, JSX, and Markdown', () => {
  const source = '---\ntitle: Fixture\n---\n# Heading\n**Plain** <span>text</span> with `code`.'
  assert.equal(mdx.extractExcerpt(source), 'Plain text with code.')
})

run('internal case heading removal handles BOM, CRLF, and leading blank lines', () => {
  const source = '\uFEFF\r\n\r\n # Internal teaching title\r\n\r\n## Presentation\r\nNeutral stem.'
  assert.equal(
    mdx.stripInternalCaseHeading(source),
    '## Presentation\nNeutral stem.',
  )
})

run('internal case heading removal preserves fenced and later headings', () => {
  const fenced = [
    '',
    '```md',
    '# Example heading',
    '```',
    '# Legitimate later heading',
  ].join('\n')
  assert.equal(mdx.stripInternalCaseHeading(fenced), fenced)
})

run('malformed condition frontmatter fails with the file path', () => {
  assert.throws(
    () => mdx.parseConditionDocument('---\nregion: shoulder\n---\n', 'content/shoulder/broken.mdx'),
    /content\/shoulder\/broken\.mdx.*title/i,
  )
})

run('malformed YAML reports the governed file path', () => {
  assert.throws(
    () => mdx.parseConditionDocument('---\ntitle: [broken\nregion: shoulder\n---\n', 'content/shoulder/malformed.mdx'),
    /content\/shoulder\/malformed\.mdx/i,
  )
})

run('BOM and CRLF input normalize deterministically', () => {
  const source = '\uFEFF' + conditionDocument().replace(/\n/g, '\r\n')
  const result = mdx.parseConditionDocument(source, 'content/shoulder/windows.mdx')
  assert.equal(result.frontmatter.title, 'Fixture condition')
  assert.equal(result.content.includes('\r'), false)
  assert.equal(JSON.stringify(result), JSON.stringify(mdx.parseConditionDocument(source, 'content/shoulder/windows.mdx')))
})

run('guided case status remains explicit and neutral slug is preserved', () => {
  const result = mdx.parseCaseDocument(caseDocument(), 'content/cases/shoulder/fixture.mdx', 'internal-diagnosis', 'shoulder')
  assert.equal(result.frontmatter.status, 'draft')
  assert.equal(result.publicSlug, 'case-99-neutral-presentation')
  assert.equal(result.content.startsWith('# Internal fixture diagnosis'), false)
  assert.equal(result.content.startsWith('## Presentation'), true)
})

run('document parsing is deterministic', () => {
  const first = mdx.parseConditionDocument(conditionDocument(), 'content/shoulder/fixture.mdx')
  const second = mdx.parseConditionDocument(conditionDocument(), 'content/shoulder/fixture.mdx')
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

console.log(`MDX loading tests passed. Deterministic assertions: ${checks}.`)

function conditionDocument() {
  return `---
title: Fixture condition
region: shoulder
category: condition
---
# Fixture condition

## Overview
Initial text with <45, >90%, and p<0.05.

## Outcome Measures
Second section.
`
}

function caseDocument() {
  return `---
title: Internal fixture diagnosis
region: shoulder
condition: fixture-condition
status: draft
publicSlug: case-99-neutral-presentation
---
# Internal fixture diagnosis

## Presentation
Neutral presentation.
`
}

function run(name, action) {
  try {
    action()
    checks += 1
  } catch (error) {
    error.message = `${name}: ${error.message}`
    throw error
  }
}
