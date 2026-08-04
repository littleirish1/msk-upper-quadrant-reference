import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const RECORD = path.join(ROOT, 'reports', 'private-review-portal', 'gate-17-risk-adoption.json')
const EXPECTED_PACKAGES = [
  'next',
  'next-mdx-remote',
  'postcss',
  'eslint-config-next',
  '@next/eslint-plugin-next',
  'glob',
  '@typescript-eslint/parser',
  '@typescript-eslint/typescript-estree',
  'minimatch',
  'brace-expansion',
  'js-yaml',
]

const record = JSON.parse(fs.readFileSync(RECORD, 'utf8'))
const failures = []

if (record.riskOwner !== 'Eoin Casey') failures.push('Risk owner must be Eoin Casey.')
if (record.privateTechnicalMergeDecision !== 'approved-subject-to-recorded-controls') {
  failures.push('Private technical merge decision is not explicit.')
}
if (record.scope?.publicDeploymentApproved !== false) failures.push('Public deployment exclusion is missing.')
if (record.scope?.humanAuthorityApprovalsGranted !== false) failures.push('Human-authority approval exclusion is missing.')
if (!Array.isArray(record.findings) || record.findings.length !== 11) failures.push('Exactly 11 individual findings are required.')

const packages = (record.findings ?? []).map((finding) => finding.package)
if (JSON.stringify(packages) !== JSON.stringify(EXPECTED_PACKAGES)) failures.push('Finding package order/set does not match the reviewed 11.')

for (const [index, finding] of (record.findings ?? []).entries()) {
  const expectedId = index + 1
  if (finding.id !== expectedId) failures.push(`Finding ${expectedId} has an invalid ID.`)
  if (!finding.advisory || !finding.dependencyPath || !finding.affectedVersions) {
    failures.push(`Finding ${expectedId} is missing advisory, dependency path, or affected versions.`)
  }
  if (!finding.runtimeBuildClassification || typeof finding.productionReachable !== 'boolean') {
    failures.push(`Finding ${expectedId} is missing reachability classification.`)
  }
  if (finding.reviewerDecision !== 'defer-with-compensating-controls-non-blocking') {
    failures.push(`Finding ${expectedId} does not preserve the reviewer decision.`)
  }
  if (finding.riskOwnerDecision !== 'adopted-non-blocking-for-private-technical-merge') {
    failures.push(`Finding ${expectedId} lacks explicit risk-owner adoption.`)
  }
  if (!Array.isArray(finding.acceptedControls) || finding.acceptedControls.length === 0) {
    failures.push(`Finding ${expectedId} has no accepted controls.`)
  }
  if (!/^2026-\d{2}-\d{2}$/.test(finding.reviewBy ?? '')) failures.push(`Finding ${expectedId} has no review date.`)
  if (finding.blocksPrivateTechnicalMerge !== false) failures.push(`Finding ${expectedId} is not explicitly non-blocking.`)
}

const mdxFinding = record.findings?.find((finding) => finding.package === 'next-mdx-remote')
if (mdxFinding?.condition?.status !== 'satisfied') failures.push('The next-mdx-remote condition is not satisfied.')
if (mdxFinding?.condition?.enforcedBy !== 'npm run check:mdx-input-boundary') {
  failures.push('The next-mdx-remote condition lacks the focused enforcement command.')
}

if (failures.length > 0) {
  console.error(['Gate 17 adoption check failed:', ...failures.map((failure) => `- ${failure}`)].join('\n'))
  process.exit(1)
}

console.log('Gate 17 risk adoption: PASS (11/11 explicit decisions; next-mdx-remote condition satisfied).')
