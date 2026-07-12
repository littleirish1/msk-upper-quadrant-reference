import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const targets = ['.next', 'out']

for (const target of targets) {
  const targetPath = path.resolve(ROOT, target)

  if (path.dirname(targetPath) !== ROOT) {
    throw new Error(`Refusing to remove path outside project root: ${targetPath}`)
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
  console.log(`Removed ${target}`)
}
