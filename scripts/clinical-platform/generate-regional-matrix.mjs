import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const taxonomy = await loadTypeScriptTree(path.join(ROOT, 'src', 'data', 'taxonomy.ts'), path.join(ROOT, 'src'))
const output = path.join(ROOT, 'reports', 'clinical-platform', 'regional-content-matrix.json')
const domains = [
  'anatomy', 'landmarks', 'muscle-roles', 'conditions', 'presentations', 'subjective-assessment',
  'objective-assessment', 'neurological-screening', 'tests', 'differentials', 'red-flags',
  'imaging-investigations', 'management', 'prognosis', 'evidence', 'cases', 'mcqs', 'movement', 'anatomy-3d',
]
const requested = [
  ['cervical', 'Cervical'], ['shoulder', 'Shoulder'], ['elbow', 'Elbow'], ['wrist-hand', 'Wrist and hand'],
  ['thoracic', 'Thoracic'], ['headache', 'Headache'], ['lumbar', 'Lumbar'], ['hip', 'Hip'], ['knee', 'Knee'],
  ['ankle-foot', 'Ankle and foot'], ['neuro-systemic', 'Neuro and systemic differentials'],
]
const live = new Map(taxonomy.REGIONS.map((region) => [region.slug, region]))
const planned = new Map(taxonomy.PLANNED_REGIONS.map((region) => [region.slug, region]))

const regions = requested.map(([slug, label]) => {
  const liveRegion = live.get(slug)
  const plannedRegion = planned.get(slug)
  const routeState = liveRegion ? 'live-baseline' : plannedRegion ? 'roadmap-only' : 'cross-cutting-no-route'
  const contentFiles = liveRegion
    ? liveRegion.conditions.map((condition) => `content/${slug}/${condition.slug}.mdx`).filter((file) => fs.existsSync(path.join(ROOT, file)))
    : []
  return {
    regionId: `region-matrix.${slug}`,
    slug,
    label,
    routeState,
    conditionCount: liveRegion?.conditions.length ?? 0,
    sourcePointers: [
      'src/data/taxonomy.ts',
      ...contentFiles,
      ...(plannedRegion && fs.existsSync(path.join(ROOT, 'content', 'plans', 'regions', `${slug}.json`)) ? [`content/plans/regions/${slug}.json`] : []),
    ],
    domains: domains.map((domain) => ({
      domain,
      structuralState: liveRegion && ['conditions', 'presentations', 'subjective-assessment', 'objective-assessment', 'tests', 'differentials', 'red-flags', 'management', 'prognosis'].includes(domain)
        ? 'baseline-content-present-review-not-reopened'
        : 'explicit-production-gap',
      evidenceState: 'exact-revision-link-required',
      clinicalReviewState: liveRegion ? 'baseline-only-new-work-required' : 'required',
      sourceClearanceState: liveRegion ? 'baseline-only-new-work-required' : 'required',
      publicEligibility: Boolean(liveRegion) && ['conditions', 'presentations', 'subjective-assessment', 'objective-assessment', 'tests', 'differentials', 'red-flags', 'management', 'prognosis'].includes(domain),
      newContentCreated: false,
    })),
    publicNewRoutes: 0,
    unresolvedIssues: [
      'Exact evidence/module/movement/3D/MCQ relationships are incomplete.',
      'Any new clinical content requires source sufficiency, clearance and exact-revision human review.',
    ],
  }
})

const matrix = {
  schemaVersion: 1,
  authority: 'regional-content-production-matrix',
  requiredDomains: domains,
  regions,
  summary: {
    regions: regions.length,
    domainCells: regions.length * domains.length,
    liveBaselineRegions: regions.filter((region) => region.routeState === 'live-baseline').length,
    roadmapRegions: regions.filter((region) => region.routeState === 'roadmap-only').length,
    crossCuttingAreas: regions.filter((region) => region.routeState === 'cross-cutting-no-route').length,
    explicitProductionGaps: regions.flatMap((region) => region.domains).filter((domain) => domain.structuralState === 'explicit-production-gap').length,
    newClinicalClaims: 0,
    publicNewRoutes: 0,
  },
}
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sortKeys(matrix), null, 2)}\n`, 'utf8')
console.log(`Regional matrix generated: ${regions.length} areas x ${domains.length} domains; new claims: 0; new routes: 0.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
