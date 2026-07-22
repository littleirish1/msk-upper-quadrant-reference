import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyLayer, classifyRegion } from '../experimental/3d-model/classification.mjs'

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.json', '.md', '.mdx', '.mjs', '.toml', '.ts', '.tsx', '.xml', '.yaml', '.yml'])
const EXTENSIONLESS_CONFIGS = new Set(['_headers', '_redirects'])
const MODEL_EXTENSIONS = new Set(['.bin', '.drc', '.glb', '.gltf'])
const CHECKER_FILES = new Set([
  'scripts/check-3d-prototype.mjs',
  'scripts/check-internal-links.mjs',
  'scripts/test-3d-boundary.mjs',
])
const PROVENANCE_FILE = 'docs/3D_ASSET_PROVENANCE.md'

export function scanPublic3dBoundary(root) {
  const findings = []
  const counts = {
    sourceRoutes: 0,
    exportedRoutes: 0,
    glbAssets: 0,
    gltfAssets: 0,
    dracoAssets: 0,
    binaryModelAssets: 0,
    publicReferences: 0,
  }

  for (const file of collectFiles(path.join(root, 'src', 'app'))) {
    const relative = normalize(path.relative(root, file))
    if (is3dRouteFile(relative)) {
      counts.sourceRoutes += 1
      findings.push(`Public 3D route source found: ${relative}`)
    }
  }

  for (const file of collectFiles(path.join(root, 'out'))) {
    const relative = normalize(path.relative(root, file))
    if (relative.split('/').includes('3d-model')) {
      counts.exportedRoutes += 1
      findings.push(`Exported 3D route found: ${relative}`)
    }
  }

  for (const base of ['public', 'out']) {
    for (const file of collectFiles(path.join(root, base))) {
      const relative = normalize(path.relative(root, file))
      const extension = path.extname(file).toLowerCase()
      if (!MODEL_EXTENSIONS.has(extension)) continue
      if (extension === '.glb') counts.glbAssets += 1
      else if (extension === '.gltf') counts.gltfAssets += 1
      else if (extension === '.drc') counts.dracoAssets += 1
      else counts.binaryModelAssets += 1
      findings.push(`Public model payload found: ${relative}`)
    }
  }

  for (const file of publicReferenceFiles(root)) {
    const relative = normalize(path.relative(root, file))
    if (relative.startsWith('content/imports/')) continue
    if (CHECKER_FILES.has(relative) || !isReferenceTextFile(file)) continue
    const source = fs.readFileSync(file, 'utf8')
    if (hasPublic3dReference(source)) {
      counts.publicReferences += 1
      findings.push(`Public 3D route reference found: ${relative}`)
    }
  }

  return { findings: [...new Set(findings)].sort(), counts }
}

function publicReferenceFiles(root) {
  const files = []
  for (const relative of ['src', 'content', 'public', 'scripts', '.github/workflows']) {
    files.push(...collectFiles(path.join(root, relative)))
  }
  for (const filename of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'netlify.toml', 'package.json']) {
    const file = path.join(root, filename)
    if (fs.existsSync(file) && fs.statSync(file).isFile()) files.push(file)
  }
  return files.sort()
}

function isReferenceTextFile(file) {
  return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()) || EXTENSIONLESS_CONFIGS.has(path.basename(file))
}

function is3dRouteFile(relative) {
  const parts = relative.split('/')
  const filename = parts.at(-1) ?? ''
  return parts.includes('3d-model') && /^(?:page|route)\.(?:js|jsx|md|mdx|ts|tsx)$/.test(filename)
}

function hasPublic3dReference(source) {
  return /(?:\/3d-model(?:\/|[\s'"`?#<]|$)|(?:href|to|slug|route|path)\s*[:=]\s*['"`]3d-model['"`])/i.test(source)
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(entryPath))
    else if (entry.isFile()) files.push(entryPath)
  }
  return files
}

function normalize(value) {
  return value.split(path.sep).join('/')
}

function run() {
  const result = scanPublic3dBoundary(ROOT)
  result.findings.push(...checkExperimentalScaffold(ROOT))
  if (result.findings.length > 0) {
    console.error('3D public-boundary check failed.')
    for (const finding of result.findings) console.error(`- ${finding}`)
    process.exit(1)
  }

  console.log('3D public-boundary check passed.')
  console.log('Public /3d-model routes: 0')
  console.log('Public/exported GLB assets: 0')
  console.log('Public/exported GLTF assets: 0')
  console.log('Public/exported Draco payloads: 0')
  console.log('Public 3D route references: 0')
  console.log('Experimental classification and provenance checks passed.')
}

function checkExperimentalScaffold(root) {
  const findings = []

  try {
    const spineGroup = node('Thoracic Vertebrae')
    const handGroup = node('Hand Region')
    const muscleGroup = node('Flexor Muscle Layer')
    const nerveGroup = node('Median Nerve', muscleGroup)
    const explicitLayerGroup = node('Layer_04', null, { layer: 'vessel' })

    assert.equal(classifyRegion(node('Mesh_003', spineGroup)), 'spine')
    assert.equal(classifyRegion(node('Mesh_001', handGroup)), 'hand')
    assert.equal(classifyRegion(node('Unknown')), 'unknown')
    assert.equal(classifyLayer(node('Mesh_002', nerveGroup)), 'nerve')
    assert.equal(classifyLayer(node('Mesh_004', explicitLayerGroup)), 'vessel')
    assert.equal(classifyLayer(node('Unknown')), 'other')
  } catch (error) {
    findings.push(`Experimental ancestor classification failed: ${error.message}`)
  }

  for (const relative of ['src', 'experimental/3d-model']) {
    for (const file of collectFiles(path.join(root, relative))) {
      if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue
      const source = fs.readFileSync(file, 'utf8')
      const filePath = normalize(path.relative(root, file))
      if (/<Environment\b[^>]*\bpreset=/i.test(source)) {
        findings.push(`External environment preset found: ${filePath}`)
      }
      if (/https?:\/\/[^\s'"]+\.(?:hdr|exr)(?:[?#][^\s'"]*)?/i.test(source)) {
        findings.push(`External HDR/EXR URL found: ${filePath}`)
      }
    }
  }

  const provenancePath = path.join(root, PROVENANCE_FILE)
  if (!fs.existsSync(provenancePath)) {
    findings.push(`Missing private 3D provenance record: ${PROVENANCE_FILE}`)
  } else {
    const provenance = fs.readFileSync(provenancePath, 'utf8')
    if ((provenance.match(/\| false \|/g)?.length ?? 0) < 4) {
      findings.push('Every inventoried 3D asset must remain explicitly ineligible for public use.')
    }
  }

  return findings
}

function node(name, parent = null, userData = {}) {
  return { name, parent, userData }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
