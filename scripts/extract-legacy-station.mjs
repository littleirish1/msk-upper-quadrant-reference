import fs from 'fs'
import path from 'path'
import {
  LEGACY_SOURCE_PROVENANCE,
  readVerifiedLegacySource,
  resolveLegacySourcePath,
} from './lib/legacySourceProvenance.mjs'

const ROOT = process.cwd()

const stationId = process.argv[2]
const sourceArg = process.argv[3] || process.env.LEGACY_HTML_SOURCE

if (!stationId || !sourceArg) {
  console.error('Usage: node scripts/extract-legacy-station.mjs <station-id> <path-to-private-legacy-html>')
  console.error('Alternatively set LEGACY_HTML_SOURCE and pass only <station-id>.')
  console.error('The raw legacy HTML is intentionally not stored in this repository.')
  process.exit(1)
}

const INPUT_FILE = resolveLegacySourcePath(sourceArg)

const OUTPUT_DIR = path.join(
  ROOT,
  'content',
  'imports',
  'html-case-bank',
  'extracted',
  'stations'
)

let sourceBytes
try {
  sourceBytes = readVerifiedLegacySource(INPUT_FILE)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const html = sourceBytes.toString('utf8')

const stationBlock = extractObjectBlockById(html, stationId)
const scenarioBlock = extractScenarioBlockById(html, stationId)

if (!stationBlock && !scenarioBlock) {
  console.error(`No station or scenario found for id: ${stationId}`)
  process.exit(1)
}

const meta = stationBlock ? extractStationMeta(stationBlock) : {}
const scenario = scenarioBlock ? extractScenarioFields(scenarioBlock) : {}
const domains = stationBlock ? extractDomains(stationBlock) : []

const title = scenario.name || meta.title || stationId
const suggestedRegion = inferRegion(title)

const output = [
  `# Legacy Station Extract: ${title}`,
  ``,
  `> Source ID: ${LEGACY_SOURCE_PROVENANCE.sourceId}`,
  `> Source type: ${LEGACY_SOURCE_PROVENANCE.sourceType}`,
  `> Approved SHA-256: ${LEGACY_SOURCE_PROVENANCE.sha256}`,
  `> Station ID: ${stationId}`,
  `> Extraction version: ${LEGACY_SOURCE_PROVENANCE.extractionVersion}`,
  `> Status: extracted-not-reviewed`,
  ``,
  `## Metadata`,
  ``,
  `- Station ID: ${stationId}`,
  `- Number: ${meta.num || 'unknown'}`,
  `- Legacy title: ${meta.title || 'unknown'}`,
  `- Display name: ${scenario.name || 'unknown'}`,
  `- Difficulty: ${meta.diffLabel || meta.diff || 'unknown'}`,
  `- Suggested region: ${suggestedRegion}`,
  `- Suggested case slug: ${slugify(title)}-legacy`,
  ``,
  `## Scenario history`,
  ``,
  scenario.history || '_No scenario history extracted._',
  ``,
  `## Scenario examination / objective findings`,
  ``,
  scenario.exam || '_No scenario exam extracted._',
  ``,
  `## Safety flags / red flags`,
  ``,
  scenario.flags || '_No scenario flags extracted._',
  ``,
  `## Legacy diagnosis`,
  ``,
  scenario.dx || '_No diagnosis extracted._',
  ``,
  `## Legacy reasoning`,
  ``,
  scenario.why || '_No reasoning extracted._',
  ``,
  `## Clinical traps`,
  ``,
  scenario.traps || '_No traps extracted._',
  ``,
  `## Think beyond / competing hypotheses`,
  ``,
  scenario.beyond || '_No beyond section extracted._',
  ``,
  `## Legacy domain content`,
  ``,
  domains.length
    ? domains.map((domain, index) => {
        return [
          `### ${index + 1}. ${domain.name || 'Unnamed domain'}`,
          ``,
          `- Icon: ${domain.icon || ''}`,
          `- Badge: ${domain.badge || ''}`,
          ``,
          domain.content || '_No content extracted._',
          ``,
        ].join('\n')
      }).join('\n')
    : '_No domain content extracted._',
  ``,
  `## Conversion notes`,
  ``,
  `Use this file as source material only.`,
  `Convert into the new guided case MDX format only after review.`,
  ``,
].join('\n')

const outputFile = path.join(OUTPUT_DIR, `${stationId}-${slugify(title)}.md`)

fs.writeFileSync(outputFile, output, 'utf8')

console.log(`Extracted station ${stationId}`)
console.log(`Title: ${title}`)
console.log(`Domains: ${domains.length}`)
console.log(`Wrote: ${outputFile}`)

function extractObjectBlockById(source, id) {
  const marker = `id:'${id}'`
  const start = source.indexOf(marker)
  if (start === -1) return null

  const objectStart = source.lastIndexOf('{', start)
  if (objectStart === -1) return null

  return readBalancedObject(source, objectStart)
}

function extractScenarioBlockById(source, id) {
  const marker = `${id}:{`
  const start = source.indexOf(marker)
  if (start === -1) return null

  const objectStart = source.indexOf('{', start)
  if (objectStart === -1) return null

  return readBalancedObject(source, objectStart)
}

function readBalancedObject(source, objectStart) {
  let depth = 0
  let quote = null
  let templateDepth = false
  let escaped = false

  for (let i = objectStart; i < source.length; i++) {
    const ch = source[i]
    const prev = source[i - 1]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === '\\') {
      escaped = true
      continue
    }

    if (quote) {
      if (quote === '`') {
        if (ch === '`' && prev !== '\\') {
          quote = null
        }
      } else if (ch === quote && prev !== '\\') {
        quote = null
      }
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '{') depth++
    if (ch === '}') depth--

    if (depth === 0) {
      return source.slice(objectStart, i + 1)
    }
  }

  return null
}

function extractStationMeta(block) {
  return {
    id: pickSingleQuoted(block, 'id'),
    num: pickSingleQuoted(block, 'num'),
    title: pickSingleQuoted(block, 'title'),
    diff: pickSingleQuoted(block, 'diff'),
    diffLabel: pickSingleQuoted(block, 'diffLabel'),
  }
}

function extractScenarioFields(block) {
  return {
    name: cleanInline(pickTemplateOrString(block, 'name')),
    history: cleanHtmlToMarkdown(pickTemplateOrString(block, 'history')),
    exam: cleanHtmlToMarkdown(pickTemplateOrString(block, 'exam')),
    flags: cleanHtmlToMarkdown(pickTemplateOrString(block, 'flags')),
    dx: cleanInline(pickTemplateOrString(block, 'dx')),
    why: cleanHtmlToMarkdown(pickTemplateOrString(block, 'why')),
    traps: cleanHtmlToMarkdown(pickTemplateOrString(block, 'traps')),
    beyond: cleanHtmlToMarkdown(pickTemplateOrString(block, 'beyond')),
  }
}

function extractDomains(block) {
  const domains = []
  const domainRegex =
    /\{\s*icon:\s*'([^']*)'\s*,\s*name:\s*'([^']*)'\s*,\s*badge:\s*'([^']*)'\s*,\s*content:\s*`([\s\S]*?)`\s*\}/g

  let match
  while ((match = domainRegex.exec(block)) !== null) {
    domains.push({
      icon: match[1],
      name: match[2],
      badge: match[3],
      content: cleanHtmlToMarkdown(match[4]),
    })
  }

  return domains
}

function pickSingleQuoted(block, key) {
  const re = new RegExp(`${key}:\\s*'([^']*)'`)
  const match = block.match(re)
  return match ? match[1] : ''
}

function pickTemplateOrString(block, key) {
  const templateRe = new RegExp(`${key}:\\s*\`([\\s\\S]*?)\`\\s*,`)
  const templateMatch = block.match(templateRe)
  if (templateMatch) return templateMatch[1]

  const singleRe = new RegExp(`${key}:\\s*'([^']*)'\\s*,`)
  const singleMatch = block.match(singleRe)
  if (singleMatch) return singleMatch[1]

  return ''
}

function cleanInline(value) {
  return decodeEntities(stripTags(value || '')).replace(/\s+/g, ' ').trim()
}

function cleanHtmlToMarkdown(value) {
  if (!value) return ''

  let text = value

  text = text.replace(/<div[^>]*class="(?:safety|distinction|cite|trap|think-beyond|script|outstanding)-label"[^>]*>([\s\S]*?)<\/div>/gi, '\n\n**$1**\n\n')
  text = text.replace(/<div[^>]*>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '\n\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<ul[^>]*>/gi, '\n')
  text = text.replace(/<\/ul>/gi, '\n')
  text = text.replace(/<ol[^>]*>/gi, '\n')
  text = text.replace(/<\/ol>/gi, '\n')
  text = text.replace(/<li[^>]*>/gi, '\n- ')
  text = text.replace(/<\/li>/gi, '')
  text = text.replace(/<strong[^>]*>/gi, '**')
  text = text.replace(/<\/strong>/gi, '**')
  text = text.replace(/<em[^>]*>/gi, '_')
  text = text.replace(/<\/em>/gi, '_')

  text = stripTags(text)
  text = decodeEntities(text)
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]+/g, ' ')
  text = text.split('\n').map(line => line.trim()).join('\n')

  return text.trim()
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferRegion(title) {
  const t = String(title || '').toLowerCase()

  if (t.includes('cervical') || t.includes('neck') || t.includes('headache') || t.includes('myelopathy')) {
    return 'cervical'
  }

  if (t.includes('shoulder') || t.includes('rotator') || t.includes('frozen') || t.includes('instability')) {
    return 'shoulder'
  }

  if (t.includes('elbow') || t.includes('epicondyl')) {
    return 'elbow'
  }

  if (t.includes('wrist') || t.includes('hand') || t.includes('carpal') || t.includes('thumb')) {
    return 'wrist-hand'
  }

  if (t.includes('thoracic') || t.includes('rib')) {
    return 'thoracic'
  }

  return 'unknown'
}