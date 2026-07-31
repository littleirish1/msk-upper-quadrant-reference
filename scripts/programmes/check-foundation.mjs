import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  FOUNDATION_OUTPUTS,
  ROOT,
  assertNoPrivateAbsolutePath,
} from './shared.mjs'
import { artifactsEqual } from '../lib/artifactComparison.mjs'

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'msk-programmes-foundation-'))
const findings = []

try {
  const generated = spawnSync(
    process.execPath,
    ['scripts/programmes/generate-foundation.mjs', '--output-root', temporaryRoot],
    { cwd: ROOT, encoding: 'utf8', shell: false },
  )
  if (generated.stdout) process.stdout.write(generated.stdout)
  if (generated.stderr) process.stderr.write(generated.stderr)
  if (generated.status !== 0) {
    findings.push(`foundation generator exited ${generated.status}`)
  } else {
    for (const relativePath of FOUNDATION_OUTPUTS) {
      const currentFile = path.join(ROOT, relativePath)
      const generatedFile = path.join(temporaryRoot, relativePath)
      if (!fs.existsSync(currentFile)) {
        findings.push(`missing generated output: ${relativePath}`)
        continue
      }
      if (!fs.existsSync(generatedFile)) {
        findings.push(`generator omitted output: ${relativePath}`)
        continue
      }
      const equal = artifactsEqual(
        fs.readFileSync(currentFile),
        fs.readFileSync(generatedFile),
        { allowBom: true },
      )
      if (!equal) findings.push(`stale generated output: ${relativePath}`)
      assertNoPrivateAbsolutePath(fs.readFileSync(currentFile, 'utf8'), relativePath)
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
}

if (findings.length) {
  console.error('Programme foundation check failed.')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Programme foundation check passed. Generated outputs current: ${FOUNDATION_OUTPUTS.length}.`)
