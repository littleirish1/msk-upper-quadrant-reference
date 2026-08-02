import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'compatibility.ts'), path.join(ROOT, 'src'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'rules', 'compatibility-rules.json')

const rules = schemas.compatibilityRuleKindSchema.options.map((kind) => ({
  schemaVersion: 1,
  id: `rule.template.${kind}`,
  revision: 1,
  kind,
  lifecycle: 'draft',
  enabled: false,
  severity: 'error',
  when: { allModuleIds: [], anyModuleIds: [], contextEquals: {} },
  effect: {
    requiresModuleIds: [],
    prohibitsModuleIds: [],
    impliesModuleIds: [],
    escalationRequirement: null,
    reviewRequirement: `Human clinical and evidence review is required before enabling the ${kind} rule family.`,
    message: `Disabled ${kind} rule template; no clinical assertion has been encoded.`,
  },
  evidenceRecordIds: [],
  evidenceGapIds: [`gap.rule-template.${kind}`],
  approval: { ruleHash: null, approvedRevision: null, clinicalReview: 'required', evidenceReview: 'required' },
}))

const catalogue = schemas.compatibilityCatalogueSchema.parse({
  schemaVersion: 1,
  authority: 'clinical-compatibility-rules',
  revision: 1,
  rules,
})
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sortKeys(catalogue), null, 2)}\n`, 'utf8')
console.log(`Compatibility rule catalogue generated: ${rules.length} disabled review-required templates.`)

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]))
}
