import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { canonicalText } from '../lib/artifactComparison.mjs'
import { EVIDENCE_HUB_OUTPUTS, ROOT, assertNoPrivateAbsolutePath, readJson } from './shared.mjs'
import { spawnSync } from 'node:child_process'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-evidence-foundation-'))
try {
  const run = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'programmes', 'generate-evidence-foundation.mjs'),
    `--output=${temporary}`,
  ], { cwd: ROOT, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || run.stdout)

  const findings = []
  for (const relativeFile of EVIDENCE_HUB_OUTPUTS) {
    const tracked = path.join(ROOT, relativeFile)
    const generated = path.join(temporary, relativeFile)
    if (!fs.existsSync(tracked)) findings.push(`missing tracked output: ${relativeFile}`)
    else if (canonicalText(fs.readFileSync(tracked), { allowBom: true })
      !== canonicalText(fs.readFileSync(generated), { allowBom: true })) {
      findings.push(`stale generated output: ${relativeFile}`)
    }
  }

  const gaps = readJson(path.join(ROOT, EVIDENCE_HUB_OUTPUTS[0]))
  const surveillance = readJson(path.join(ROOT, EVIDENCE_HUB_OUTPUTS[1]))
  const coverage = readJson(path.join(ROOT, EVIDENCE_HUB_OUTPUTS[3]))
  const gapIds = new Set()
  for (const gap of gaps.gaps) {
    if (gapIds.has(gap.gapId)) findings.push(`duplicate evidence gap: ${gap.gapId}`)
    gapIds.add(gap.gapId)
    if (gap.publicEligibility) findings.push(`public evidence gap: ${gap.gapId}`)
  }
  if (coverage.counts.publicContent !== gaps.gaps.length) findings.push('public content and gap counts do not reconcile')
  if (coverage.counts.revisionPinnedEvidenceRelationships !== 0) findings.push('unreviewed relationship was represented as approved')
  if (surveillance.proposals.some((item) => item.publicEligibility || item.autonomousChangeAllowed)) {
    findings.push('surveillance proposal escapes private review boundary')
  }
  assertNoPrivateAbsolutePath({ gaps, surveillance, coverage }, 'Evidence Hub programme outputs')
  if (findings.length) throw new Error(findings.join('\n'))
  console.log(`Evidence foundation check passed. Exact-revision gaps: ${gaps.gaps.length}; public Hub records: 0.`)
} finally {
  fs.rmSync(temporary, { recursive: true, force: true })
}
