import fs from 'node:fs'
import path from 'node:path'
import {
  collectCaseFiles,
  collectConditionFiles,
  getTaxonomyConditions,
  isPrivateStatus,
  readCaseFrontmatter,
  readConditionFrontmatter,
  readMdxFile,
  relativePath,
} from './lib/readMdxFrontmatter.mjs'

const ROOT = process.cwd()
const OUTPUT = path.join(ROOT, 'docs', 'product', 'UPPER_QUADRANT_COMPLETION_MATRIX.md')
const CHECK_ONLY = process.argv.includes('--check')

const sectionMatchers = [
  ['overview', /overview|pathophysiology/i],
  ['presentation', /presentation|subjective/i],
  ['risk factors', /risk factor/i],
  ['objective assessment', /objective|physical examination|assessment/i],
  ['red flags', /red flag|safety/i],
  ['differentials', /differential/i],
  ['investigations', /investigation|imaging/i],
  ['outcome measures', /outcome measure/i],
  ['management', /management|treatment/i],
  ['prognosis', /prognosis/i],
  ['patient communication', /patient communication|education/i],
  ['evidence limitations', /evidence limitation|limitations/i],
  ['references', /references|evidence base/i],
]

const taxonomy = await getTaxonomyConditions()
const taxonomyByKey = new Map(taxonomy.map((item) => [`${item.region}/${item.slug}`, item]))
const cases = []

for (const file of collectCaseFiles()) {
  const { data, content } = await readCaseFrontmatter(file)
  const region = path.basename(path.dirname(file))
  const slug = path.basename(file, '.mdx')
  cases.push({ region, slug, data, headings: headings(content) })
}

const rows = []
for (const file of collectConditionFiles()) {
  const { data, content } = await readConditionFrontmatter(file)
  const slug = path.basename(file, '.mdx')
  const key = `${data.region}/${slug}`
  const pageHeadings = headings(content)
  const present = sectionMatchers
    .filter(([, matcher]) => pageHeadings.some((heading) => matcher.test(heading)))
    .map(([name]) => name)
  const missing = sectionMatchers.map(([name]) => name).filter((name) => !present.includes(name))
  const linkedCases = cases.filter((item) => item.region === data.region && item.data.condition === slug)

  rows.push({
    region: data.region,
    slug,
    status: data.status ?? 'legacy-public',
    present,
    missing,
    referenceMarkers: countReferenceMarkers(content),
    linkedCases: linkedCases.length,
    publicEligibility: taxonomyByKey.has(key) ? 'public route' : 'not in taxonomy',
    clinicianReview: data.clinicianReviewStatus ?? 'not recorded',
  })
}

rows.sort((a, b) => a.region.localeCompare(b.region) || a.slug.localeCompare(b.slug))
cases.sort((a, b) => a.region.localeCompare(b.region) || a.slug.localeCompare(b.slug))

const output = render(rows, cases)

if (CHECK_ONLY) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== output) {
    console.error('Upper-quadrant completion matrix is stale. Run npm run report:upper-quadrant.')
    process.exit(1)
  }
  console.log(`Upper-quadrant completion matrix current: ${rows.length} conditions, ${cases.length} cases.`)
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, output)
  console.log(`Wrote ${relativePath(OUTPUT)}: ${rows.length} conditions, ${cases.length} cases.`)
}

function render(conditionRows, caseRows) {
  const publishedCases = caseRows.filter((item) => !isPrivateStatus(item.data.status))
  const privateCases = caseRows.filter((item) => isPrivateStatus(item.data.status))
  const lines = [
    '# Upper Quadrant Completion Matrix',
    '',
    'This report is generated from validated condition and guided-case source files. It describes structure and recorded metadata; it does not certify clinical completeness, evidence quality, or clinician approval.',
    '',
    `- Conditions inventoried: ${conditionRows.length}`,
    `- Guided cases inventoried: ${caseRows.length}`,
    `- Published guided cases: ${publishedCases.length}`,
    `- Draft/private guided cases: ${privateCases.length}`,
    '',
    'A verified-reference count is not reported because current condition files do not record per-reference verification state. The reference-marker count is an editorial signal only.',
    '',
    '## Condition Matrix',
    '',
    '| Region | Slug | Status | Sections present | Recommended gaps | Reference markers | Linked cases | Clinician review | Public eligibility |',
    '|---|---|---|---|---|---:|---:|---|---|',
  ]

  for (const row of conditionRows) {
    lines.push(`| ${row.region} | \`${row.slug}\` | ${row.status} | ${cell(row.present)} | ${cell(row.missing)} | ${row.referenceMarkers} | ${row.linkedCases} | ${row.clinicianReview} | ${row.publicEligibility} |`)
  }

  lines.push(
    '',
    '## Guided Case Structure',
    '',
    '| Region | Neutral route | Status | Structural headings | Clinician review metadata |',
    '|---|---|---|---|---|',
  )

  for (const item of caseRows) {
    const route = item.data.publicSlug ? `/cases/${item.region}/${item.data.publicSlug}` : '(private/internal only)'
    const review = item.data.reviewStatus ?? (item.data.reviewedBy ? 'reviewer recorded; status not recorded' : 'not recorded')
    lines.push(`| ${item.region} | \`${route}\` | ${item.data.status} | ${cell(item.headings)} | ${review} |`)
  }

  lines.push(
    '',
    '## Gap Classification',
    '',
    '- Structural: missing recommended headings shown above.',
    '- Evidence: reference presence is not equivalent to verified evidence; verification metadata is still required.',
    '- Clinical review: legacy condition pages do not yet record a clinician-review state.',
    '- Learner experience: six cases are public; three remain private and excluded.',
    '- Linking/taxonomy: stable relationship fields now exist, but reciprocal anatomy, test, and measure links remain representative scaffolding.',
    '',
    '## Held Work',
    '',
    '- No additional guided case was published or drafted in this pass because repository evidence and clinician approval were not sufficient to author new clinical answers safely.',
    '- The special-test and outcome-measure records are private extraction briefs, not public clinical resources.',
    '',
  )

  return lines.join('\n')
}

function headings(content) {
  return [...content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim())
}

function countReferenceMarkers(content) {
  const doi = content.match(/\b10\.\d{4,9}\/[\w.()/:;-]+/gi)?.length ?? 0
  const links = content.match(/https?:\/\//gi)?.length ?? 0
  const referenceLines = content.match(/^\s*(?:\d+\.|-\s+).*(?:19|20)\d{2}/gm)?.length ?? 0
  return doi + links + referenceLines
}

function cell(values) {
  return values.length ? values.join(', ') : 'none recorded'
}
