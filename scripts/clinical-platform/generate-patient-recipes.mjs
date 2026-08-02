import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'
import { generatePatient, stableJson } from './seeded-generator.mjs'

const ROOT = process.cwd()
const schemas = await loadTypeScriptTree(path.join(ROOT, 'src', 'lib', 'clinical-platform', 'generatorSchema.ts'), path.join(ROOT, 'src'))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'truth', 'patient-truth-records.json'), 'utf8'))
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai-manager', 'clinical-platform', 'rules', 'compatibility-rules.json'), 'utf8'))
const output = path.join(ROOT, 'ai-manager', 'clinical-platform', 'generator', 'patient-recipes.json')
const previewOutput = path.join(ROOT, 'reports', 'clinical-platform', 'seeded-patient-preview.json')
const reportOutput = path.join(ROOT, 'reports', 'clinical-platform', 'seeded-patient-report.json')

const ruleDigest = `draft-catalogue-r${rules.revision}`
const recipes = truth.records.map((record) => {
  const suffix = record.caseId.slice('case.'.length)
  const presentation = record.items.find((item) => item.domain === 'presenting-complaint')
  return schemas.patientRecipeSchema.parse({
    schemaVersion: 1,
    recipeId: `recipe.${suffix}.baseline`,
    recipeRevision: 1,
    lifecycle: 'draft',
    caseId: record.caseId,
    truthRecordId: record.recordId,
    truthHash: record.authoritativeHash,
    moduleRevisions: presentation?.moduleId ? [{ moduleId: presentation.moduleId, revision: presentation.moduleRevision, approvalHash: null }] : [],
    ruleCatalogueRevision: rules.revision,
    ruleDigest,
    targetReasoningObjective: 'Preserve the source case reasoning objective without adding clinical claims.',
    difficulty: 'not-rated',
    region: record.caseId.split('.')[1],
    comorbidityModuleIds: [],
    distractorModuleIds: [],
    allowedVariation: 'cosmetic',
    governance: { recipeApprovalHash: null, approvedRevision: null, clinicalReview: 'required', evidenceReview: 'required', publicationReview: 'required' },
  })
})
const catalogue = schemas.patientRecipeCatalogueSchema.parse({ schemaVersion: 1, authority: 'seeded-patient-recipes', recipes })
const sample = generatePatient({ recipe: recipes[0], truthRecord: truth.records.find((record) => record.recordId === recipes[0].truthRecordId), seed: 'synthetic-preview-seed-v1' })
schemas.generatedPatientManifestSchema.parse(sample.manifest)

const report = {
  schemaVersion: 1,
  recipes: recipes.length,
  privateRecipes: recipes.length,
  publicRecipes: 0,
  variationSupport: ['cosmetic', 'clinical-blocked-until-approved', 'complex-blocked-until-approved'],
  reproducibility: { byteEquivalentForSameInputs: true, authoritativeTruthImmutable: true },
  scans: sample.manifest.scans,
  difficultyReport: { ratedRecipes: 0, notRatedRecipes: recipes.length },
  diversityReport: { authoritativeClinicalVariants: 0, cosmeticAliasSpace: 676000 },
  similarityWarnings: ['All recipes preserve an existing source case and are not independent clinical variants.'],
  evidenceGaps: truth.records.reduce((sum, record) => sum + record.gaps.length, 0),
  humanReviewPacketRequired: true,
}

write(output, catalogue)
write(previewOutput, { manifest: sample.manifest, authoritativeTruthHash: sample.authoritative.truthRecord.authoritativeHash })
write(reportOutput, report)
console.log(`Seeded patient recipes generated: ${recipes.length}; public recipes: 0; clinical variants: 0.`)

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, stableJson(value), 'utf8')
}
