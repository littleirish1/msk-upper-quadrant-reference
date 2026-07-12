import {
  collectCaseFiles,
  collectConditionFiles,
  readCaseFrontmatter,
  readConditionFrontmatter,
} from './lib/readMdxFrontmatter.mjs'

const conditionFiles = collectConditionFiles()
const caseFiles = collectCaseFiles()
const errors = []

if (conditionFiles.length === 0) {
  errors.push('No condition MDX files found for frontmatter validation.')
}

if (caseFiles.length === 0) {
  errors.push('No guided case MDX files found for frontmatter validation.')
}

for (const filePath of conditionFiles) {
  try {
    await readConditionFrontmatter(filePath)
  } catch (error) {
    errors.push(error.message)
  }
}

for (const filePath of caseFiles) {
  try {
    await readCaseFrontmatter(filePath)
  } catch (error) {
    errors.push(error.message)
  }
}

if (errors.length > 0) {
  console.error('Frontmatter schema check failed.')
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Frontmatter schema check passed.')
console.log(`Condition files validated: ${conditionFiles.length}`)
console.log(`Guided case files validated: ${caseFiles.length}`)
