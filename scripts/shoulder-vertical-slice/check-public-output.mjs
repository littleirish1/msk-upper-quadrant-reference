import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const outRoot = path.join(ROOT, 'out')
assert.ok(fs.existsSync(outRoot), 'Static export is required for the shoulder output check')
const files = walk(outRoot)
const shoulderPage = path.join(outRoot, 'shoulder', 'index.html')
assert.ok(fs.existsSync(shoulderPage))
const html = fs.readFileSync(shoulderPage, 'utf8')
assert.ok(html.includes('Shoulder learning pathway'))
assert.ok(html.includes('Reason before you reveal'))

const exportedText = files
  .filter((file) => /\.(?:html|json|js|txt|xml|css)$/i.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
const forbidden = [
  /mcq-slot\.shoulder-slice/i,
  /asset3d\.shoulder/i,
  /source\.repository\.shoulder/i,
  /private-shoulder-evidence-map/i,
  /shoulder-authoring-workspace/i,
  /evidence-hub\/conditions/i,
]
for (const pattern of forbidden) assert.ok(!pattern.test(exportedText), `Private shoulder identifier entered public output: ${pattern}`)
assert.equal(files.filter((file) => /\.(?:glb|gltf|drc)$/i.test(file)).length, 0)

console.log(`Shoulder public-output check passed: ${files.length} exported files; private modules, MCQs, Evidence Hub IDs and 3D assets absent.`)

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(item) : entry.isFile() ? [item] : []
  })
}
