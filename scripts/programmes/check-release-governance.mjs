import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { canonicalText } from '../lib/artifactComparison.mjs'
import { RELEASE_OUTPUTS, ROOT, assertNoPrivateAbsolutePath, readJson } from './shared.mjs'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-release-governance-'))
try {
  const run = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'programmes', 'generate-release-governance.mjs'),
    `--output=${temporary}`,
  ], { cwd: ROOT, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || run.stdout)
  const findings = []
  for (const file of RELEASE_OUTPUTS) {
    const tracked = path.join(ROOT, file)
    const generated = path.join(temporary, file)
    if (!fs.existsSync(tracked)) findings.push(`missing release output: ${file}`)
    else if (canonicalText(fs.readFileSync(tracked), { allowBom: true })
      !== canonicalText(fs.readFileSync(generated), { allowBom: true })) findings.push(`stale release output: ${file}`)
  }
  const candidate = readJson(path.join(ROOT, 'reports', 'release', 'release-candidate.json'))
  const beta = readJson(path.join(ROOT, 'reports', 'release', 'beta-framework.json'))
  const matrix = readJson(path.join(ROOT, 'reports', 'release', 'exact-revision-review-matrix.json'))
  if (candidate.status !== 'blocked' || candidate.publicationApproved) findings.push('release candidate is not fail-closed')
  if (beta.resultsRecorded || beta.feedbackItems.length) findings.push('beta results were invented')
  if (matrix.reviews.some((review) => review.decision !== 'pending')) findings.push('human review decision was fabricated')
  assertNoPrivateAbsolutePath({ candidate, beta, matrix }, 'release governance')
  if (findings.length) throw new Error(findings.join('\n'))
  console.log(`Release governance check passed. Pending reviews: ${matrix.reviews.length}; candidate status: blocked.`)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
