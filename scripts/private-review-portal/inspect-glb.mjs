import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const JSON_CHUNK = 0x4e4f534a

function requireValue(condition, message) {
  if (!condition) throw new Error(`GLB inspection failed: ${message}`)
}

function aggregateBounds(accessors = [], meshes = []) {
  const positions = meshes.flatMap((mesh) => (mesh.primitives ?? []).map((primitive) => accessors[primitive.attributes?.POSITION]).filter(Boolean))
  const bounded = positions.filter((accessor) => Array.isArray(accessor.min) && Array.isArray(accessor.max) && accessor.min.length === 3 && accessor.max.length === 3)
  if (!bounded.length) return null
  return {
    min: [0, 1, 2].map((axis) => Math.min(...bounded.map((accessor) => accessor.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounded.map((accessor) => accessor.max[axis]))),
  }
}

function animationDurations(document) {
  return (document.animations ?? []).map((animation) => {
    const inputs = (animation.samplers ?? []).map((sampler) => document.accessors?.[sampler.input]).filter(Boolean)
    const minima = inputs.flatMap((accessor) => accessor.min ?? []).filter(Number.isFinite)
    const maxima = inputs.flatMap((accessor) => accessor.max ?? []).filter(Number.isFinite)
    return minima.length && maxima.length ? Math.max(...maxima) - Math.min(...minima) : null
  })
}

export function inspectGlbBuffer(buffer, filename = 'candidate.glb') {
  requireValue(Buffer.isBuffer(buffer), 'input must be a Buffer')
  requireValue(buffer.length >= 20, `${filename} is too short`)
  requireValue(buffer.toString('ascii', 0, 4) === 'glTF', `${filename} has an invalid magic header`)
  const version = buffer.readUInt32LE(4)
  const declaredBytes = buffer.readUInt32LE(8)
  requireValue(version === 2, `${filename} is not GLB 2.0`)
  requireValue(declaredBytes === buffer.length, `${filename} declared length does not match its bytes`)
  let offset = 12
  let document = null
  while (offset < buffer.length) {
    requireValue(offset + 8 <= buffer.length, `${filename} has a truncated chunk header`)
    const chunkBytes = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    offset += 8
    requireValue(offset + chunkBytes <= buffer.length, `${filename} has a truncated chunk`)
    if (chunkType === JSON_CHUNK) {
      const json = buffer.subarray(offset, offset + chunkBytes).toString('utf8').replace(/\u0000+$/g, '').trimEnd()
      document = JSON.parse(json)
    }
    offset += chunkBytes
  }
  requireValue(document, `${filename} has no JSON chunk`)
  const nodes = document.nodes ?? []
  const meshes = document.meshes ?? []
  const namedNodes = nodes.map((node) => node.name).filter((name) => typeof name === 'string' && name.trim())
  const defaultScene = document.scene ?? 0
  const rootNodeIndices = document.scenes?.[defaultScene]?.nodes ?? []
  const externalResourceUris = [...(document.buffers ?? []), ...(document.images ?? [])]
    .map((resource) => resource.uri)
    .filter((uri) => typeof uri === 'string' && !uri.startsWith('data:'))
  return {
    filename,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    validGlb20: true,
    version,
    declaredBytes,
    generator: document.asset?.generator ?? null,
    copyright: document.asset?.copyright ?? null,
    scenes: document.scenes?.length ?? 0,
    defaultScene,
    rootNodes: rootNodeIndices.length,
    rootNodeNameSample: rootNodeIndices.map((index) => nodes[index]?.name ?? null).filter(Boolean).slice(0, 40),
    nodes: nodes.length,
    namedNodes: namedNodes.length,
    nodeNameSample: [...new Set(namedNodes)].sort((a, b) => a.localeCompare(b)).slice(0, 40),
    meshes: meshes.length,
    primitives: meshes.reduce((total, mesh) => total + (mesh.primitives?.length ?? 0), 0),
    materials: document.materials?.length ?? 0,
    skins: document.skins?.length ?? 0,
    animations: document.animations?.length ?? 0,
    animationNames: (document.animations ?? []).map((animation) => animation.name ?? null),
    animationDurationsSeconds: animationDurations(document),
    images: document.images?.length ?? 0,
    textures: document.textures?.length ?? 0,
    externalResourceUris,
    extensionsUsed: document.extensionsUsed ?? [],
    extensionsRequired: document.extensionsRequired ?? [],
    bounds: aggregateBounds(document.accessors, meshes),
  }
}

export function inspectGlbFile(file) {
  return inspectGlbBuffer(fs.readFileSync(file), path.basename(file))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2)
  requireValue(files.length > 0, 'provide one or more private GLB file paths')
  console.log(JSON.stringify(files.map((file) => inspectGlbFile(path.resolve(file))), null, 2))
}
