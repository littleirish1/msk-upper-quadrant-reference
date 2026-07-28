import fs from 'node:fs'
import path from 'node:path'
import {
  HUB_DIR,
  HUB_LIB_DIR,
  ROOT,
  buildJsonSchemaDocument,
  findPublicEvidenceHubImportChains,
  loadEvidenceHubModule,
  readDataset,
  relative,
  stableJson,
} from './shared.mjs'
import { canonicalText } from '../lib/artifactComparison.mjs'

const module = await loadEvidenceHubModule()
const requireOutput = process.argv.includes('--require-output')
const { dataset, pilots, findings } = readDataset(module)
const graph = module.validateEvidenceHubGraph(dataset)
findings.push(...graph.findings.map((finding) => `${finding.code}: ${finding.message}`))

const pilotIds = pilots.map((pilot) => pilot.pilotId)
for (const required of ['pilot.shoulder.rcrsp', 'pilot.ankle-foot.lateral-ankle-sprain']) {
  if (!pilotIds.includes(required)) findings.push(`missing pilot placeholder ${required}`)
}
if (new Set(pilotIds).size !== pilotIds.length) findings.push('duplicate pilot IDs')

const jsonSchemaFile = path.join(HUB_LIB_DIR, 'evidence-hub-v1.schema.json')
if (!fs.existsSync(jsonSchemaFile)) {
  findings.push(`missing generated JSON Schema: ${relative(jsonSchemaFile)}`)
} else {
  const expected = stableJson(buildJsonSchemaDocument(module))
  const current = canonicalText(fs.readFileSync(jsonSchemaFile), { allowBom: true })
  if (current !== expected) findings.push('Evidence Hub JSON Schema is stale; run npm run generate:evidence-hub-schema')
}

const architectureFile = path.join(ROOT, 'docs', 'architecture', 'evidence-hub-v1.md')
if (!fs.existsSync(architectureFile)) findings.push('missing Evidence Hub architecture specification')

const srcRoot = path.join(ROOT, 'src')
for (const chain of findPublicEvidenceHubImportChains(srcRoot, [
  path.join(srcRoot, 'app'),
  path.join(srcRoot, 'components'),
])) {
  findings.push(`public runtime reaches the private Evidence Hub: ${chain}`)
}

const publicProjection = module.buildPublicProjection(dataset)
const outDir = path.join(ROOT, 'out')
if (requireOutput && !fs.existsSync(outDir)) findings.push('missing public output; run the build before the output boundary check')
if (fs.existsSync(path.join(outDir, 'evidence-hub'))) findings.push('public output contains Evidence Hub private data')
if (fs.existsSync(outDir)) {
  for (const file of collectFiles(outDir)) {
    const normalized = relative(file).toLowerCase()
    if (normalized.includes('/evidence-hub/') || normalized.includes('/ai-manager/')) findings.push(`private hub output found: ${relative(file)}`)
  }
}

for (const proposal of dataset.proposals) {
  if (proposal.publicEligibility || proposal.autonomousPublicationAllowed || proposal.clinicalApprovalRepresented) {
    findings.push(`proposal escapes fail-closed boundary: ${proposal.id}`)
  }
}

if (findings.length) {
  console.error('Evidence Hub check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log('Evidence Hub check passed.')
console.log(`Records: ${dataset.records.length}; relationships: ${dataset.relationships.length}; review decisions: ${dataset.reviewDecisions.length}; proposals: ${dataset.proposals.length}.`)
console.log(`Pilot workflows: ${pilots.length}; public projection records: ${publicProjection.length}; public Evidence Hub files: 0.`)

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : []
  })
}
