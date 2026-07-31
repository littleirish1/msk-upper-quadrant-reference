import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  CONTENT_PRODUCTION_OUTPUTS,
  ROOT,
  assertNoPrivateAbsolutePath,
  loadProgrammeSchemas,
  readJson,
} from './shared.mjs'
import { artifactsEqual } from '../lib/artifactComparison.mjs'
import { loadTypeScriptTree } from '../lib/loadTypeScriptTree.mjs'

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-content-production-'))
const findings = []
const schemas = await loadProgrammeSchemas()

try {
  const generated = spawnSync(
    process.execPath,
    ['scripts/programmes/generate-content-production.mjs', '--output-root', temporaryRoot],
    { cwd: ROOT, encoding: 'utf8', shell: false },
  )
  if (generated.stdout) process.stdout.write(generated.stdout)
  if (generated.stderr) process.stderr.write(generated.stderr)
  if (generated.status !== 0) findings.push(`content-production generator exited ${generated.status}`)

  for (const relativePath of CONTENT_PRODUCTION_OUTPUTS) {
    const current = path.join(ROOT, relativePath)
    const regenerated = path.join(temporaryRoot, relativePath)
    if (!fs.existsSync(current) || !fs.existsSync(regenerated)) {
      findings.push(`missing currentness target: ${relativePath}`)
      continue
    }
    if (!artifactsEqual(fs.readFileSync(current), fs.readFileSync(regenerated), { allowBom: true })) {
      findings.push(`stale content-production output: ${relativePath}`)
    }
    assertNoPrivateAbsolutePath(fs.readFileSync(current, 'utf8'), relativePath)
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}

const batches = schemas.legacyCaseBatchCatalogSchema.safeParse(
  readJson(path.join(ROOT, 'reports', 'programmes', 'legacy-case-batches.json')),
)
if (!batches.success) {
  findings.push(...batches.error.issues.map((issue) =>
    `legacy batch catalogue ${issue.path.join('.')}: ${issue.message}`,
  ))
} else {
  const records = batches.data.batches.flatMap((batch) => batch.records)
  if (records.length !== 41) findings.push(`expected 41 remaining legacy stations, found ${records.length}`)
  if (records.some((record) => record.publicEligibility)) findings.push('legacy batch record became public eligible')
  if (batches.data.heldUnbatchedStationIds.length !== 0) findings.push('legacy stations remain outside a controlled batch')
}

const branchModule = await loadTypeScriptTree(
  path.join(ROOT, 'src', 'lib', 'programmes', 'branching.ts'),
  path.join(ROOT, 'src'),
)
const branch = readJson(path.join(ROOT, 'content', 'learning', 'private', 'branching-reasoning-example.json'))
const branchResult = branchModule.validateBranchingModel(branch)
if (!branchResult.valid) findings.push(...branchResult.findings.map((finding) => `branching model: ${finding}`))
if (branch.publicEligibility) findings.push('private branching example became public eligible')

const mcqPlan = schemas.mcqPlanSchema.safeParse(
  readJson(path.join(ROOT, 'content', 'assessment', 'mcq-plan.json')),
)
if (!mcqPlan.success) {
  findings.push(...mcqPlan.error.issues.map((issue) => `MCQ plan ${issue.path.join('.')}: ${issue.message}`))
}
const mcq = schemas.governedMcqSchema.safeParse(
  readJson(path.join(ROOT, 'content', 'assessment', 'private', 'mcq-contract-example.json')),
)
if (!mcq.success) findings.push(...mcq.error.issues.map((issue) => `MCQ example ${issue.path.join('.')}: ${issue.message}`))
else if (mcq.data.publicEligibility) findings.push('private MCQ example became public eligible')

const readiness = readJson(path.join(ROOT, 'reports', 'programmes', 'legacy-case-readiness.json'))
if (readiness.records?.length !== 41) findings.push(`legacy readiness expected 41 records, found ${readiness.records?.length ?? 0}`)
if (readiness.records?.some((record) => record.sourceBodyStoredInReport || record.privatePathStored)) {
  findings.push('legacy readiness report stores a source body or private path')
}
if (readiness.records?.some((record) => record.publicEligibility)) {
  findings.push('legacy readiness record became public eligible')
}

if (findings.length) {
  console.error('Programme content-production check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('Programme content-production check passed.')
console.log('Legacy stations in governed batches: 41; public new cases: 0; public new MCQs: 0.')
