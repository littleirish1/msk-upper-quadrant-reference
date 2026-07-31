import fs from 'node:fs'
import path from 'node:path'
import { ROOT, loadProgrammeSchemas, readJson } from './shared.mjs'

const findings = []
const schemas = await loadProgrammeSchemas()
const registry = readJson(path.join(ROOT, 'content', 'visual-assets', 'private', 'registry.json'))
const registryResult = schemas.visualAssetRegistrySchema.safeParse(registry)
if (!registryResult.success) {
  for (const issue of registryResult.error.issues) findings.push(`visual registry ${issue.path.join('.')}: ${issue.message}`)
} else {
  for (const asset of registryResult.data.assets) {
    if (asset.publicationState === 'public') findings.push(`unreviewed visual asset is public: ${asset.id}`)
  }
}

const journey = fs.readFileSync(path.join(ROOT, 'src', 'components', 'ui', 'LearningJourneyLinks.tsx'), 'utf8')
for (const required of ['/anatomy', '/cases', '/learning', '/red-flags', '/search', 'min-h-11', 'aria-label="Related learning"']) {
  if (!journey.includes(required)) findings.push(`learning journey is missing ${required}`)
}
for (const sourceFile of [
  'src/app/[region]/page.tsx',
  'src/app/[region]/[condition]/page.tsx',
]) {
  const source = fs.readFileSync(path.join(ROOT, sourceFile), 'utf8')
  if (!source.includes('<LearningJourneyLinks')) findings.push(`missing shared learning journey in ${sourceFile}`)
}

if (findings.length) {
  console.error('Learner product check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}
console.log(`Learner product check passed. Governed visual assets: ${registry.assets.length}; public visual assets: 0.`)
