import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const findings = []
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const learningTabs = read('src/components/learning/LearningModeExamples.tsx')
for (const requirement of [
  'role="tablist"',
  'role="tab"',
  'role="tabpanel"',
  'aria-controls',
  'aria-labelledby',
  'aria-selected',
  'tabIndex={active === item.id ? 0 : -1}',
  "event.key === 'ArrowRight'",
  "event.key === 'ArrowLeft'",
  "event.key === 'Home'",
  "event.key === 'End'",
]) {
  if (!learningTabs.includes(requirement)) findings.push(`learning tabs are missing ${requirement}`)
}

const header = read('src/components/layout/Header.tsx')
if (!header.includes('xl:flex') || !header.includes('xl:hidden')) {
  findings.push('desktop navigation is not constrained to the non-wrapping xl layout')
}
if (!header.includes('aria-current=')) findings.push('header navigation lacks aria-current')
if (!header.includes('resolvedTheme') || header.includes("theme === 'dark'")) findings.push('theme toggle does not use the resolved system theme')
if (!header.includes('themeMounted') || !header.includes('useEffect(() => setThemeMounted(true), [])')) findings.push('theme toggle lacks a hydration-safe mounted state')

const layout = read('src/app/layout.tsx')
if (!layout.includes('href="#main-content"') || !layout.includes('id="main-content"')) {
  findings.push('root layout lacks a skip link wired to the main landmark')
}
const globalStyles = read('src/app/globals.css')
if (!globalStyles.includes(':focus-visible') || !globalStyles.includes('outline: 3px solid')) {
  findings.push('global high-contrast keyboard focus indicator is missing')
}

const mdxComponents = read('src/components/mdx/MDXComponents.tsx')
if (mdxComponents.includes("'mt-10 mb-4 -mx-4 sm:-mx-6")) {
  findings.push('condition section banners retain negative margins that create page-level horizontal overflow')
}

const caseModes = read('src/components/cases/CaseModeExperience.tsx')
for (const requirement of [
  'role="tablist"',
  'role="tab"',
  'role="tabpanel"',
  'aria-controls',
  'aria-labelledby',
  'aria-selected',
  'tabIndex={mode === item.id ? 0 : -1}',
  'ArrowRight',
  'ArrowLeft',
  'Home',
  'End',
  'aria-live="polite"',
]) {
  if (!caseModes.includes(requirement)) findings.push(`case mode interaction is missing ${requirement}`)
}

const bottomNavigation = read('src/components/ui/MobileBottomNav.tsx')
if (!bottomNavigation.includes('href="/search"')) findings.push('mobile Search is missing')
if (!bottomNavigation.includes('aria-current=')) findings.push('mobile navigation lacks aria-current')

const landmarkFiles = collectFiles(path.join(ROOT, 'src', 'app'))
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => /<main(?:\s|>)/.test(fs.readFileSync(file, 'utf8')))
const expectedMain = path.join(ROOT, 'src', 'app', 'layout.tsx')
if (landmarkFiles.length !== 1 || path.resolve(landmarkFiles[0]) !== path.resolve(expectedMain)) {
  findings.push(`root layout must provide the only main landmark; found ${landmarkFiles.map(relative).join(', ')}`)
}

for (const relativeFile of [
  'src/components/learning/ClinicalReasoningEngine.tsx',
  'src/components/learning/BranchingReasoningEngine.tsx',
  'src/components/learning/DecisionTree.tsx',
  'src/components/learning/DifferentialDiagnosisBuilder.tsx',
  'src/components/learning/LearningModeExamples.tsx',
]) {
  const source = read(relativeFile)
  if (source.includes('min-h-10')) findings.push(`sub-44px control token remains in ${relativeFile}`)
}

if (findings.length) {
  console.error('Accessibility smoke check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('Accessibility smoke check passed: skip navigation, landmarks, keyboard tabs, live status, navigation state, mobile Search, and learning touch targets.')

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(item) : entry.isFile() ? [item] : []
  })
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
