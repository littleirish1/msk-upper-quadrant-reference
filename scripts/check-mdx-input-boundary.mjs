import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const CONTENT_ROOT = path.join(ROOT, 'content')
const SELF = 'scripts/check-mdx-input-boundary.mjs'
const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'])

const expectedEntryPoints = new Map([
  ['src/app/[region]/[condition]/page.tsx', [
    "import { MDXRemote } from 'next-mdx-remote/rsc'",
    'getAllPublicConditionPaths()',
    'getPublicConditionContent(regionSlug, conditionSlug)',
    'source={result.content}',
    'export const dynamicParams = false',
  ]],
  ['src/app/cases/[region]/[caseSlug]/page.tsx', [
    "import { MDXRemote } from 'next-mdx-remote/rsc'",
    'getAllCasePaths()',
    'resolveCaseSlugFromPublicSlug(regionSlug, publicCaseSlug)',
    'await getCaseContent(regionSlug, caseSlug)',
    'const learnerContent = stripPreRevealLinkedConditionSection(',
    'const casePresentationContent = extractCasePresentationStem(learnerContent)',
    'source={casePresentationContent}',
  ]],
  ['scripts/build-case-reveal-payloads.mjs', [
    "import { compileMDX } from 'next-mdx-remote/rsc'",
    'for (const file of collectCaseFiles())',
    'const { content: rawContent, data } = await readCaseFrontmatter(file)',
    'const learnerContent = stripPreRevealLinkedConditionSection(',
    'const revealContent = extractCaseRevealContent(learnerContent)',
    'source: revealContent',
  ]],
])

const loaderContracts = new Map([
  ['src/lib/mdx.ts', [
    "const CONTENT_DIR = path.join(process.cwd(), 'content')",
    "const filePath = path.join(CONTENT_DIR, 'cases', region, `${caseSlug}.mdx`)",
    "const casesDir = path.join(CONTENT_DIR, 'cases', region)",
  ]],
  ['src/lib/publicConditions.ts', [
    "const CONTENT_DIR = path.join(process.cwd(), 'content')",
    'const record = getPublicConditionRecord(region, condition)',
    "return parseConditionDocument(fs.readFileSync(record.filePath, 'utf8'), record.filePath)",
  ]],
  ['scripts/lib/readMdxFrontmatter.mjs', [
    "export const CONTENT_DIR = path.join(ROOT_DIR, 'content')",
    'export const CASES_DIR = path.join(CONTENT_DIR, \'cases\')',
    'export function collectCaseFiles(dir = CASES_DIR)',
  ]],
])

const failures = []
const tracked = gitTrackedFiles()
const trackedSet = new Set(tracked)
const packageJson = JSON.parse(read('package.json'))

if (!packageJson.scripts?.prebuild?.startsWith('npm run check:mdx-input-boundary && ')) {
  failures.push('The production prebuild hook must enforce the MDX input boundary before compilation.')
}

const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]next-mdx-remote(?:\/rsc)?['"]/u
const actualEntryPoints = tracked
  .filter((file) => file !== SELF && sourceExtensions.has(path.extname(file)))
  .filter((file) => importPattern.test(read(file)))
  .sort()
const expectedPaths = [...expectedEntryPoints.keys()].sort()

if (JSON.stringify(actualEntryPoints) !== JSON.stringify(expectedPaths)) {
  failures.push(
    `Compiler entry points changed. Expected ${expectedPaths.join(', ')}; found ${actualEntryPoints.join(', ') || '(none)'}.`,
  )
}

for (const [file, markers] of [...expectedEntryPoints, ...loaderContracts]) {
  if (!trackedSet.has(file)) {
    failures.push(`Required boundary file is not tracked: ${file}`)
    continue
  }
  const source = read(file)
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${file} is missing boundary marker: ${marker}`)
  }
}

const portalFiles = tracked.filter((file) => file.startsWith('ai-manager/private-review-portal/'))
const forbiddenPortalPattern = /next-mdx-remote|\b(?:compileMDX|MDXRemote)\b/u
for (const file of portalFiles) {
  if (forbiddenPortalPattern.test(read(file))) {
    failures.push(`Private portal must not import or call an MDX compiler: ${file}`)
  }
}

const portalDerived = read('ai-manager/private-review-portal/derived.mjs')
for (const marker of [
  "const target = store.generatedPath('derived', derivedId, '.txt')",
  "fs.writeFileSync(target, text, { encoding: 'utf8', flag: 'wx', mode: 0o400 })",
]) {
  if (!portalDerived.includes(marker)) failures.push(`Portal derived-output contract changed: ${marker}`)
}

const portalConfig = read('ai-manager/private-review-portal/config.mjs')
if (!portalConfig.includes("if (isWithin(repositoryRoot, dataRoot)) throw new Error('Private review data must be stored outside the Git repository.')")) {
  failures.push('Private portal data-root exclusion from the repository is missing.')
}

const diskMdxFiles = walkMdx(CONTENT_ROOT)
for (const absolute of diskMdxFiles) {
  const relative = toPosix(path.relative(ROOT, absolute))
  const stat = fs.lstatSync(absolute)
  if (stat.isSymbolicLink()) failures.push(`MDX source must not be a symbolic link: ${relative}`)
  if (!stat.isFile()) failures.push(`MDX source must be a regular file: ${relative}`)
  if (!trackedSet.has(relative)) failures.push(`Untracked MDX source is forbidden: ${relative}`)
}

for (const file of tracked.filter((item) => item.startsWith('content/') && item.endsWith('.mdx'))) {
  const absolute = path.join(ROOT, ...file.split('/'))
  if (!fs.existsSync(absolute)) failures.push(`Tracked MDX source is missing from the worktree: ${file}`)
}

if (failures.length > 0) {
  console.error(['MDX input-boundary check failed:', ...failures.map((failure) => `- ${failure}`)].join('\n'))
  process.exit(1)
}

console.log([
  'MDX input boundary: PASS',
  `- compiler/render entry points: ${actualEntryPoints.length} (allowlisted)`,
  `- tracked regular MDX inputs: ${diskMdxFiles.length}`,
  '- untracked or symlinked MDX inputs: 0',
  '- private portal MDX/compiler references: 0',
  '- portal derived output: inert .txt outside the repository',
].join('\n'))

function gitTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: 200 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`Unable to enumerate tracked files: ${result.stderr?.toString('utf8') ?? 'unknown Git error'}`)
  }
  return result.stdout.toString('utf8').split('\0').filter(Boolean).map(toPosix)
}

function walkMdx(directory) {
  if (!fs.existsSync(directory)) return []
  const results = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      if (entry.name.endsWith('.mdx')) results.push(target)
      continue
    }
    if (entry.isDirectory()) results.push(...walkMdx(target))
    else if (entry.isFile() && entry.name.endsWith('.mdx')) results.push(target)
  }
  return results.sort((left, right) => left.localeCompare(right))
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, ...relative.split('/')), 'utf8')
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}
