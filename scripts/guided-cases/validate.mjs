import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { PUBLIC_REGISTRY_FILE, readJson, readRecords, ROOT, relative, stableJson } from './shared.mjs'
import { validateRecordSet } from './validator-lib.mjs'

const mode = process.argv.find((value) => value.startsWith('--mode='))?.split('=')[1] ?? 'all'
const requireOutput = process.argv.includes('--require-output')
const { module, records: loaded, findings: schemaFindings } = await readRecords()
const records = loaded.map(({ record }) => record)
const findings = [...schemaFindings]
const result = validateRecordSet(records, { expectedPublic: 6, expectedDraft: 3 })
findings.push(...result.findings)

const selected = mode === 'published'
  ? result.publicRecords
  : mode === 'drafts'
    ? result.draftRecords
    : records

for (const record of selected) {
  if (record.publicationEligibility) {
    try {
      module.createPublicImmediateCase(record)
      module.createPublicRevealPayload(record)
    } catch (error) {
      findings.push(`${record.caseId}: ${error.message}`)
    }
  } else {
    for (const projection of [module.createPublicImmediateCase, module.createPublicRevealPayload]) {
      try {
        projection(record)
        findings.push(`${record.caseId}: draft unexpectedly passed a public projection`)
      } catch {
        // Expected fail-closed result.
      }
    }
  }
}

validatePublishedMdx(result.publicRecords, findings)
validatePublicRegistry(result.publicRecords, module, findings)
validateSensitiveText(records, findings)
if (requireOutput) validateOutput(records, findings)

if (findings.length) {
  console.error('Guided-case validation failed:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Guided-case validation passed (${mode}).`)
console.log(`Governed records: ${records.length}; public: ${result.publicRecords.length}; drafts: ${result.draftRecords.length}.`)
console.log('Evidence Hub links: 0 verified; unresolved gaps remain explicit.')

function validatePublishedMdx(publicRecords, output) {
  const files = walk(path.join(ROOT, 'content', 'cases')).filter((file) => file.endsWith('.mdx'))
  const published = []
  for (const file of files) {
    const parsed = matter(fs.readFileSync(file, 'utf8'))
    if (parsed.data.status !== 'published') continue
    published.push({ file, data: parsed.data })
  }
  if (published.length !== publicRecords.length) {
    output.push(`published MDX count ${published.length} does not match governed count ${publicRecords.length}`)
  }
  for (const { file, data } of published) {
    const record = publicRecords.find((item) => item.caseId === data.guidedCaseId)
    if (!record) {
      output.push(`${relative(file)}: published MDX has no governed record`)
      continue
    }
    if (record.publicSlug !== data.publicSlug || record.region !== data.region) {
      output.push(`${relative(file)}: governed route does not match frontmatter`)
    }
    if (data.schemaVersion !== record.schemaVersion || data.contentRevision !== record.contentRevision) {
      output.push(`${relative(file)}: schema/revision does not match governed record`)
    }
  }
}

function validatePublicRegistry(publicRecords, guidedCaseModule, output) {
  if (!fs.existsSync(PUBLIC_REGISTRY_FILE)) {
    output.push('public guided-case registry is missing')
    return
  }
  const expected = publicRecords
    .map((record) => guidedCaseModule.createPublicImmediateCase(record))
    .sort((left, right) => left.learnerCaseNumber.localeCompare(right.learnerCaseNumber))
  const actual = readJson(PUBLIC_REGISTRY_FILE)
  if (stableJson(actual) !== stableJson(expected)) {
    output.push('public guided-case registry does not match governed projections')
  }
  const text = stableJson(actual).toLowerCase()
  for (const record of publicRecords) {
    for (const restricted of governedRestrictedValues(record)) {
      if (restricted.length >= 4 && text.includes(restricted.toLowerCase())) {
        output.push(`${record.caseId}: reveal-gated value entered public registry`)
      }
    }
  }
}

function validateSensitiveText(records, output) {
  const hygieneFile = path.join(ROOT, 'ai-manager', 'content-hygiene-names.json')
  const terms = JSON.parse(fs.readFileSync(hygieneFile, 'utf8')).termsToFlag ?? []
  const text = JSON.stringify(records)
  for (const term of terms) {
    if (typeof term === 'string' && term && text.toLowerCase().includes(term.toLowerCase())) {
      output.push('governed sensitive-name pattern found in guided-case records')
      break
    }
  }
  if (/[A-Za-z]:[\\/](?:Users|dev)[\\/]/i.test(text)) {
    output.push('private absolute path found in guided-case records')
  }
  if (/(?:TODO|FIXME|<<<<<<<|=======|>>>>>>>)/.test(text)) {
    output.push('placeholder or merge marker found in governed records')
  }
}

function validateOutput(records, output) {
  const outDir = path.join(ROOT, 'out')
  const searchFile = path.join(ROOT, 'public', 'search-index.json')
  if (!fs.existsSync(outDir)) {
    output.push('static output is required but out/ is missing')
    return
  }
  const publicRecords = records.filter((record) => record.publicationEligibility)
  const drafts = records.filter((record) => !record.publicationEligibility)
  for (const record of publicRecords) {
    const route = path.join(outDir, 'cases', record.region, record.publicSlug, 'index.html')
    if (!fs.existsSync(route)) output.push(`${record.caseId}: expected public route is missing`)
  }
  const publicText = [
    ...walk(outDir).filter(isTextFile).map((file) => fs.readFileSync(file, 'utf8')),
    fs.existsSync(searchFile) ? fs.readFileSync(searchFile, 'utf8') : '',
  ].join('\n')
  for (const record of drafts) {
    for (const restricted of [
      record.caseId,
      record.publicSlug,
      record.privateDiagnosticIdentity.internalSourceStationId ?? '',
    ]) {
      if (!restricted) continue
      if (publicText.toLowerCase().includes(restricted.toLowerCase())) {
        output.push(`${record.caseId}: draft value entered public output`)
      }
    }
  }
}

function governedRestrictedValues(record) {
  const diagnosisTokens = new Set(
    `${record.privateDiagnosticIdentity.associatedConditionId} ${record.privateDiagnosticIdentity.likelyDiagnosis}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  )
  const diagnosticFocus = record.privateDiagnosticIdentity.privateLearningFocus.filter(
    (focus, index) => index === 0 || focus.toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((token) => diagnosisTokens.has(token)),
  )
  return [
    record.privateDiagnosticIdentity.internalTitle,
    record.privateDiagnosticIdentity.likelyDiagnosis,
    record.privateDiagnosticIdentity.associatedConditionId,
    ...diagnosticFocus,
    ...record.reasoningStages.flatMap((stage) => [
      ...stage.expectedReasoningThemes,
      ...stage.modelReasoningChecklist,
      ...stage.commonPitfalls,
      stage.feedback ?? '',
    ]),
  ]
}

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : []
  })
}

function isTextFile(file) {
  return /\.(?:html?|json|js|css|xml|txt|map)$/i.test(file)
}
