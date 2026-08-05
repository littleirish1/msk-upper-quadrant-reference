import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { ROOT, SHOULDER_REPORT_ROOT, SHOULDER_ROOT, writeJson } from './shared.mjs'

const movement = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'clinical-platform', 'movementSchema.ts'),
  path.join(ROOT, 'src'),
)
const joint = [
  ['flexion', 'Flexion'], ['extension', 'Extension'], ['abduction', 'Abduction'],
  ['adduction', 'Adduction'], ['external-rotation', 'External rotation'],
  ['internal-rotation', 'Internal rotation'], ['horizontal-flexion-extension', 'Horizontal flexion and extension'],
  ['scapular-upward-downward-rotation', 'Scapular upward and downward rotation'],
  ['scapular-protraction-retraction', 'Scapular protraction and retraction'],
  ['scapular-elevation-depression', 'Scapular elevation and depression'],
]
const functional = [
  ['reaching-overhead', 'Reaching overhead', ['case.shoulder.case-04']],
  ['hand-behind-head', 'Hand behind head', []],
  ['hand-behind-back', 'Hand behind back', ['case.shoulder.case-05']],
  ['dressing', 'Dressing', ['case.shoulder.case-05']],
  ['grooming', 'Grooming', []],
  ['lifting-carrying', 'Lifting and carrying', ['case.shoulder.case-04']],
  ['pushing-pulling', 'Pushing and pulling', []],
  ['throwing', 'Throwing', ['case.shoulder.case-04']],
  ['sleeping-positioning', 'Sleeping and positioning', ['case.shoulder.case-04', 'case.shoulder.case-05']],
  ['work-overhead', 'Work-related overhead tasks', []],
]
const reviews = { movement: 'required', anatomy: 'required', clinical: 'required', evidence: 'required', accessibility: 'required', publication: 'required' }
const unresolvedIssues = [
  'Plane, axis, phases, muscle roles, variation and compensation claims require exact source locators and review.',
  'No range value or rhythm ratio is encoded.',
  'Movement, anatomy, clinical, evidence, accessibility and publication review remain required.',
]
const records = [
  ...joint.map(([slug, label]) => ({ kind: 'joint', slug, label, cases: [] })),
  ...functional.map(([slug, label, cases]) => ({ kind: 'functional', slug, label, cases })),
].map(({ kind, slug, label, cases }) => movement.movementRecordSchema.parse({
  schemaVersion: 1,
  id: `movement.shoulder.${kind}.${slug}`,
  revision: 1,
  kind,
  slug,
  publicLabel: label,
  lifecycle: 'planned',
  publicEligibility: false,
  jointMovement: kind === 'joint'
    ? { plane: null, axis: null, supportedRanges: [], arthrokinematics: [], primeMovers: [], synergists: [], stabilisers: [], antagonists: [] }
    : null,
  phases: [],
  sequence: [],
  normalVariation: [],
  compensations: [],
  painfulPatterns: [],
  relatedTestIds: [],
  relatedConditionIds: [],
  relatedCaseIds: cases,
  linked3dStructureIds: [],
  patientFindingModuleIds: [],
  tutorExplanation: null,
  accessibleTranscript: 'No reviewed movement description is available for this private authoring slot.',
  evidenceRecordIds: [],
  evidenceGapIds: [`gap.movement.shoulder.${kind}.${slug}`],
  reviews,
  unresolvedIssues,
}))
writeJson(path.join(SHOULDER_ROOT, 'movement-library.json'), movement.movementLibrarySchema.parse({
  schemaVersion: 1,
  authority: 'governed-movement-library',
  records,
}))
writeJson(path.join(SHOULDER_ROOT, 'movement-case-links.json'), {
  schemaVersion: 1,
  authority: 'private-shoulder-movement-case-links',
  records: ['case.shoulder.case-04', 'case.shoulder.case-05'].map((caseId) => ({
    caseId,
    proposedMovementIds: records.filter((record) => record.relatedCaseIds.includes(caseId)).map((record) => record.id).sort(),
    relationshipState: 'review-required',
    evidenceGap: 'The existing presentation mentions the activity, but no movement interpretation is approved.',
    publicEligibility: false,
  })),
})
writeJson(path.join(SHOULDER_REPORT_ROOT, 'movement-readiness.json'), {
  schemaVersion: 1,
  jointRecords: records.filter((record) => record.kind === 'joint').length,
  functionalRecords: records.filter((record) => record.kind === 'functional').length,
  accessibleFallbacks: records.filter((record) => record.accessibleTranscript).length,
  rangeValuesAdded: 0,
  rhythmRatiosAdded: 0,
  clinicalClaimsAdded: 0,
  publicRecords: 0,
})
console.log(`Shoulder movement generated: ${records.length} private review slots; 0 ranges, ratios, claims or public records.`)
