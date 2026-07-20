import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { classifyLayer, classifyRegion } from '../experimental/3d-model/classification.mjs'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const OUT_DIR = path.join(ROOT, 'out')
const SRC_DIR = path.join(ROOT, 'src')
const EXPERIMENTAL_DIR = path.join(ROOT, 'experimental', '3d-model')
const PROVENANCE_FILE = path.join(ROOT, 'docs', '3D_ASSET_PROVENANCE.md')
const findings = []

checkAncestorClassification()
checkPublicBoundary()
checkExternalEnvironmentReferences()
checkProvenanceRecord()

if (findings.length > 0) {
  console.error('3D prototype check failed.')
  for (const finding of findings) console.error('- ' + finding)
  process.exit(1)
}

console.log('3D prototype check passed.')
console.log('Public /3d-model route absent.')
console.log('Public and exported GLB assets: 0')
console.log('Ancestor-based region and layer classification tests passed.')
console.log('External HDR/environment references: 0')

function checkAncestorClassification() {
  const spineGroup = node('Thoracic Vertebrae')
  const handGroup = node('Hand Region')
  const unnamedHandMesh = node('Mesh_001', handGroup)
  const muscleGroup = node('Flexor Muscle Layer')
  const nerveGroup = node('Median Nerve', muscleGroup)
  const unnamedNerveMesh = node('Mesh_002', nerveGroup)
  const explicitLayerGroup = node('Layer_04', null, { layer: 'vessel' })

  try {
    assert.equal(classifyRegion(node('Mesh_003', spineGroup)), 'spine')
    assert.equal(classifyRegion(unnamedHandMesh), 'hand')
    assert.equal(classifyRegion(node('Unknown')), 'unknown')
    assert.equal(classifyLayer(unnamedNerveMesh), 'nerve', 'nearest recognised ancestor must win')
    assert.equal(classifyLayer(node('Mesh_004', explicitLayerGroup)), 'vessel')
    assert.equal(classifyLayer(node('Unknown')), 'other')
  } catch (error) {
    fail('Ancestor classification failed: ' + error.message)
  }
}

function checkPublicBoundary() {
  const forbiddenRouteDirs = [
    path.join(SRC_DIR, 'app', '3d-model'),
    path.join(OUT_DIR, '3d-model'),
  ]

  for (const dir of forbiddenRouteDirs) {
    if (fs.existsSync(dir)) fail('Public 3D route exists: ' + relative(dir))
  }

  const publicGlbs = [
    ...collectFiles(PUBLIC_DIR, (file) => file.toLowerCase().endsWith('.glb')),
    ...collectFiles(OUT_DIR, (file) => file.toLowerCase().endsWith('.glb')),
  ]

  for (const file of publicGlbs) fail('Public/exported GLB asset found: ' + relative(file))

  for (const file of collectFiles(SRC_DIR, isSourceFile)) {
    const source = fs.readFileSync(file, 'utf8')
    if (source.includes('/3d-model')) {
      fail('Public source links to removed /3d-model route: ' + relative(file))
    }
  }
}

function checkExternalEnvironmentReferences() {
  for (const dir of [SRC_DIR, EXPERIMENTAL_DIR]) {
    for (const file of collectFiles(dir, isSourceFile)) {
      const source = fs.readFileSync(file, 'utf8')
      if (/<Environment\b[^>]*\bpreset=/i.test(source)) {
        fail('External environment preset found: ' + relative(file))
      }
      if (/https?:\/\/[^\s'\"]+\.(?:hdr|exr)(?:[?#][^\s'\"]*)?/i.test(source)) {
        fail('External HDR/EXR URL found: ' + relative(file))
      }
    }
  }
}

function checkProvenanceRecord() {
  if (!fs.existsSync(PROVENANCE_FILE)) {
    fail('Missing docs/3D_ASSET_PROVENANCE.md')
    return
  }

  const record = fs.readFileSync(PROVENANCE_FILE, 'utf8')
  for (const filename of ['hand.glb', 'overview-skeleton.glb', 'upper-limb.glb', 'vertebrae.glb']) {
    if (!record.includes('`' + filename + '`')) fail('Missing provenance entry for ' + filename)
  }

  const falseEligibilityRows = record.match(/\| false \|/g)?.length ?? 0
  if (falseEligibilityRows < 4) {
    fail('Every reviewed GLB filename must have public eligibility set to false.')
  }
}

function collectFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(entryPath, predicate))
    else if (entry.isFile() && predicate(entryPath)) files.push(entryPath)
  }
  return files
}

function isSourceFile(file) {
  return /\.(?:js|jsx|mjs|ts|tsx)$/.test(file)
}

function node(name, parent = null, userData = {}) {
  return { name, parent, userData }
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function fail(message) {
  findings.push(message)
}
