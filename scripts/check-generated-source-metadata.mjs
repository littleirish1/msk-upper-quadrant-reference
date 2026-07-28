import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { artifactsEqual } from './lib/artifactComparison.mjs'

const ROOT = process.cwd()
const targets = [
  {
    path: path.join(ROOT, 'content', 'imports', 'html-case-bank', 'migration-tracker.md'),
    generator: path.join(ROOT, 'scripts', 'generate-migration-tracker.mjs'),
  },
  {
    path: path.join(ROOT, 'content', 'imports', 'source-registry.json'),
    generator: path.join(ROOT, 'scripts', 'generate-source-registry.mjs'),
  },
]

const snapshots = new Map(
  targets.map((target) => [
    target.path,
    {
      existed: fs.existsSync(target.path),
      bytes: fs.existsSync(target.path) ? fs.readFileSync(target.path) : null,
    },
  ]),
)

const staleTargets = []
let generatorFailure = null

try {
  for (const target of targets) {
    const result = spawnSync(process.execPath, [target.generator], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      shell: false,
    })

    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)

    if (result.error || result.status !== 0) {
      generatorFailure =
        result.error?.message ||
        `Generator failed with exit code ${result.status}: ${relative(target.generator)}`
      break
    }
  }

  if (!generatorFailure) {
    for (const target of targets) {
      const before = snapshots.get(target.path)
      const existsAfter = fs.existsSync(target.path)
      const bytesAfter = existsAfter ? fs.readFileSync(target.path) : null

      if (
        before.existed !== existsAfter ||
        (before.bytes && bytesAfter && !artifactsEqual(before.bytes, bytesAfter, {
          kind: 'text',
          allowBom: true,
        }))
      ) {
        staleTargets.push(relative(target.path))
      }
    }
  }
} finally {
  for (const target of targets) {
    const snapshot = snapshots.get(target.path)

    if (snapshot.existed) {
      fs.mkdirSync(path.dirname(target.path), { recursive: true })
      fs.writeFileSync(target.path, snapshot.bytes)
    } else {
      fs.rmSync(target.path, { force: true })
    }
  }
}

if (generatorFailure) {
  console.error('Generated source metadata check failed.')
  console.error(generatorFailure)
  process.exit(1)
}

if (staleTargets.length > 0) {
  console.error('Generated source metadata is stale:')
  for (const target of staleTargets) console.error('- ' + target)
  console.error('Run the relevant generators, review their output, and commit the canonical files.')
  process.exit(1)
}

console.log('Generated source metadata currentness check passed.')
for (const target of targets) console.log('- current: ' + relative(target.path))
console.log('Original target bytes were restored after comparison.')

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}
