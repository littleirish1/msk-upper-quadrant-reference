import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'movementSchema.ts'), path.join(ROOT, 'src'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'movement', 'movement-library.json')
const linksOutput = path.join(ROOT, 'ai-manager', 'clinical-platform', 'movement', 'case-movement-links.json')
const reportOutput = path.join(ROOT, 'reports', 'clinical-platform', 'movement-readiness.json')
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))

const jointNames = [
  ['flexion-extension', 'Flexion and extension'],
  ['abduction-adduction', 'Abduction and adduction'],
  ['internal-external-rotation', 'Internal and external rotation'],
  ['pronation-supination', 'Pronation and supination'],
  ['radial-ulnar-deviation', 'Radial and ulnar deviation'],
  ['spinal-flexion-extension', 'Spinal flexion and extension'],
  ['spinal-lateral-flexion', 'Spinal lateral flexion'],
  ['spinal-rotation', 'Spinal rotation'],
  ['accessory-movement', 'Accessory movement'],
  ['combined-movement', 'Combined movement'],
]
const functionalNames = [
  'reaching', 'overhead-use', 'lifting', 'carrying', 'pushing', 'pulling', 'gripping',
  'throwing', 'sit-to-stand', 'squat', 'step', 'gait', 'running', 'jumping-landing',
  'stairs', 'work-task',
]
const reviews = { movement: 'required', anatomy: 'required', clinical: 'required', evidence: 'required', accessibility: 'required', publication: 'required' }
const unresolvedIssues = [
  'Source-supported phases, ranges, contributions, muscle roles and variations are not yet mapped.',
  'Movement, anatomy, clinical, evidence, accessibility and publication review remain required.',
]
const records = [
  ...jointNames.map(([slug, label]) => ({ kind: 'joint', slug, label })),
  ...functionalNames.map((slug) => ({ kind: 'functional', slug, label: title(slug) })),
].map(({ kind, slug, label }) => schemas.movementRecordSchema.parse({
  schemaVersion: 1,
  id: `movement.${kind}.${slug}`,
  revision: 1,
  kind,
  slug,
  publicLabel: label,
  lifecycle: 'planned',
  publicEligibility: false,
  jointMovement: kind === 'joint' ? { plane: null, axis: null, supportedRanges: [], arthrokinematics: [], primeMovers: [], synergists: [], stabilisers: [], antagonists: [] } : null,
  phases: [],
  sequence: [],
  normalVariation: [],
  compensations: [],
  painfulPatterns: [],
  relatedTestIds: [],
  relatedConditionIds: [],
  relatedCaseIds: [],
  linked3dStructureIds: [],
  patientFindingModuleIds: [],
  tutorExplanation: null,
  accessibleTranscript: null,
  evidenceRecordIds: [],
  evidenceGapIds: [`gap.movement.${kind}.${slug}`],
  reviews,
  unresolvedIssues,
}))
const library = schemas.movementLibrarySchema.parse({ schemaVersion: 1, authority: 'governed-movement-library', records })
const links = {
  schemaVersion: 1,
  authority: 'case-movement-links',
  records: truth.records.map((record) => ({
    caseId: record.caseId,
    truthHash: record.authoritativeHash,
    objectiveTruthIds: record.items.filter((item) => ['objective-finding', 'movement-finding'].includes(item.domain)).map((item) => item.id),
    movementIds: [],
    anatomy3dAssetIds: [],
    gap: 'No reviewed movement or 3D relationship is approved for this exact truth revision.',
    publicEligibility: false,
  })),
}
const report = {
  schemaVersion: 1,
  jointMovementRecords: records.filter((record) => record.kind === 'joint').length,
  functionalMovementRecords: records.filter((record) => record.kind === 'functional').length,
  publicMovementRecords: 0,
  evidenceLinkedRecords: 0,
  accessibleTranscriptsApproved: 0,
  caseLinkSlots: links.records.length,
  approvedCaseLinks: 0,
  publicRoutes: 0,
}
write(output, library)
write(linksOutput, links)
write(reportOutput, report)
console.log(`Movement library generated: ${records.length} private review slots; public: 0; approved case links: 0.`)

function title(value) { return value.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ') }
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sortKeys(value), null, 2)}\n`, 'utf8')
}
