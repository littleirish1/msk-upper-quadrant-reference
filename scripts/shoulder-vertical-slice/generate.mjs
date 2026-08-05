import { spawnSync } from 'node:child_process'

const scripts = [
  'generate-source-audit.mjs',
  'generate-evidence-hub.mjs',
  'generate-modules.mjs',
  'generate-case-governance.mjs',
  'generate-movement.mjs',
  'generate-mcq-plan.mjs',
  'generate-authoring.mjs',
]

for (const script of scripts) {
  const result = spawnSync(process.execPath, [`scripts/shoulder-vertical-slice/${script}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('Shoulder vertical slice generated deterministically with all new clinical content held for human review.')
