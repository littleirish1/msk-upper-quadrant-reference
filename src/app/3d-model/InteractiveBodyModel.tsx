'use client'

import { useRef, useState, useMemo, useCallback, Suspense, useEffect } from 'react'
import Link from 'next/link'
import { X, ChevronRight, ExternalLink, Info } from 'lucide-react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, useProgress, useGLTF, ContactShadows, Environment, Bounds } from '@react-three/drei'
import * as THREE from 'three'
import { REGIONS } from '@/data/taxonomy'
import type { RegionSlug } from '@/types'

// ─── Region color mapping ────────────────────────────────────────────────────

const regionColors: Record<string, string> = {
  cervical: '#2d7a96',
  thoracic: '#cc6600',
  shoulder: '#c01818',
  elbow: '#7b4ec7',
  'wrist-hand': '#0d8a5e',
}

type BodyPartKey = RegionSlug

// ─── Map GLB node group names to regions ────────────────────────────────────

const regionGroupMap: Record<string, BodyPartKey> = {
  'Head and neck': 'cervical',
  'Pectoral girdle': 'shoulder',
  'Arm': 'elbow',
  'Forearm': 'elbow',
  'Hand and wrist': 'wrist-hand',
  'Thorax': 'thoracic',
  'Back': 'thoracic',
}

function getRegionFromNodeName(name: string): BodyPartKey | null {
  for (const [prefix, region] of Object.entries(regionGroupMap)) {
    if (name.startsWith(prefix)) return region
  }
  return null
}

// ─── Layer classification from node names ────────────────────────────────────

type LayerKey = 'muscles' | 'bones' | 'nerves' | 'vessels' | 'ligaments' | 'cartilage'

const layerSuffixMap: Record<LayerKey, string[]> = {
  muscles: ['muscles'],
  bones: ['bones'],
  nerves: ['nerves'],
  vessels: ['arteries', 'veins'],
  ligaments: ['capsules, ligaments, fasciae', 'synovia, bursae'],
  cartilage: ['cartilages'],
}

function getLayerFromNodeName(name: string): LayerKey | null {
  for (const [layer, suffixes] of Object.entries(layerSuffixMap)) {
    for (const suffix of suffixes) {
      if (name.includes(suffix)) return layer as LayerKey
    }
  }
  return null
}

const layerLabels: Record<LayerKey, string> = {
  muscles: 'Muscles',
  bones: 'Bones',
  nerves: 'Nerves',
  vessels: 'Vessels',
  ligaments: 'Ligaments',
  cartilage: 'Cartilage',
}

const layerColors: Record<LayerKey, string> = {
  muscles: '#c44',
  bones: '#eee',
  nerves: '#ffa500',
  vessels: '#a33',
  ligaments: '#daa',
  cartilage: '#8bf',
}

// ─── Anatomy Model (loads prebuilt GLB) ──────────────────────────────────────

function AnatomyModel({
  hovered,
  selected,
  onHover,
  onSelect,
  showRegion,
  activeLayers,
}: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
  showRegion: BodyPartKey | null
  activeLayers: Set<LayerKey>
}) {
  const { scene } = useGLTF('/models/upper-limb.glb')
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Store original materials for restoring
  const originalMaterials = useMemo(() => {
    const map = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>()
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        map.set(obj, obj.material)
      }
    })
    return map
  }, [cloned])

  // Apply region highlighting
  useEffect(() => {
    const activeRegion = showRegion ?? selected ?? hovered

    cloned.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return

      // Layer visibility
      const layerKey = getLayerFromNodeName(obj.name || '')
      if (layerKey && !activeLayers.has(layerKey)) {
        obj.visible = false
        return
      }
      obj.visible = true

      const nodeRegion = getRegionFromNodeName(obj.name || '')
      if (!nodeRegion) return

      const orig = originalMaterials.get(obj)
      if (!orig) return

      if (activeRegion && nodeRegion === activeRegion) {
        // Highlight: tint with region color
        const color = new THREE.Color(regionColors[nodeRegion])
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map(m => {
            const newMat = (m as THREE.Material).clone() as THREE.MeshStandardMaterial
            if ('color' in newMat) {
              newMat.color = color
              newMat.emissive = color.clone().multiplyScalar(0.3)
            }
            return newMat
          })
        } else {
          const newMat = (obj.material as THREE.Material).clone() as THREE.MeshStandardMaterial
          if ('color' in newMat) {
            newMat.color = color
            newMat.emissive = color.clone().multiplyScalar(0.3)
          }
          obj.material = newMat
        }
      } else {
        // Restore original
        obj.material = orig
      }

      // Dim non-active regions
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      if (activeRegion && nodeRegion !== activeRegion) {
        mats.forEach(m => {
          if (!m) return
          const mat = m as THREE.MeshStandardMaterial
          mat.transparent = true
          mat.opacity = 0.12
        })
      } else {
        mats.forEach(m => {
          if (!m) return
          const mat = m as THREE.MeshStandardMaterial
          mat.transparent = false
          mat.opacity = 1
        })
      }
    })
  }, [cloned, hovered, selected, showRegion, activeLayers, originalMaterials])

  return (
    <group>
      <primitive
        object={cloned}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          const nodeRegion = getRegionFromNodeName(e.object.name || '')
          if (nodeRegion) {
            onHover(nodeRegion)
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onHover(null)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          const nodeRegion = getRegionFromNodeName(e.object.name || '')
          if (nodeRegion) {
            onSelect(nodeRegion)
          }
        }}
      />
    </group>
  )
}

// ─── Loading overlay ─────────────────────────────────────────────────────────

function LoadingOverlay() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white/90 px-6 py-4 shadow-xl dark:bg-surface-800/90">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <p className="text-xs text-surface-600 dark:text-surface-300">
          Loading anatomy model… {Math.round(progress)}%
        </p>
      </div>
    </Html>
  )
}

// ─── Info panel ──────────────────────────────────────────────────────────────

function RegionInfoPanel({
  region,
  onClose,
}: {
  region: BodyPartKey
  onClose: () => void
}) {
  const regionData = REGIONS.find(r => r.slug === region)
  if (!regionData) return null

  const color = regionColors[region]

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-20 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-surface-200 bg-white/95 p-3 shadow-2xl backdrop-blur-sm dark:border-surface-700 dark:bg-surface-900/95 sm:w-72 sm:right-4 sm:top-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="text-sm font-bold text-surface-900 dark:text-surface-50">
            {regionData.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-surface-500 dark:text-surface-400">
        {regionData.description}
      </p>
      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400 dark:text-surface-500">
          Conditions
        </p>
        {regionData.conditions.map(c => (
          <Link
            key={c.slug}
            href={`/${region}/${c.slug}`}
            className="flex items-center justify-between rounded-md px-2 py-1 text-xs text-surface-700 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            <span>{c.label}</span>
            <ChevronRight className="h-3 w-3 opacity-50" />
          </Link>
        ))}
      </div>
      <Link
        href={`/${region}`}
        className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400"
      >
        Explore {regionData.label}
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ─── Main exported component ─────────────────────────────────────────────────

export function InteractiveBodyModel() {
  const [hovered, setHovered] = useState<BodyPartKey | null>(null)
  const [selected, setSelected] = useState<BodyPartKey | null>(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(
    new Set(['muscles', 'bones', 'ligaments', 'cartilage'])
  )

  const handleHover = useCallback((key: BodyPartKey | null) => setHovered(key), [])
  const handleSelect = useCallback((key: BodyPartKey) => {
    setSelected(prev => prev === key ? null : key)
  }, [])

  const toggleLayer = useCallback((layer: LayerKey) => {
    setActiveLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }, [])

  return (
    <div className="relative h-[55vh] w-full sm:h-[65vh] lg:h-[72vh]">
      {/* Layer toggle bar */}
      <div className="absolute left-2 top-2 z-20 flex flex-wrap gap-1 sm:left-4 sm:top-4">
        {(Object.keys(layerLabels) as LayerKey[]).map(layer => (
          <button
            key={layer}
            onClick={() => toggleLayer(layer)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all sm:text-xs ${
              activeLayers.has(layer)
                ? 'border-surface-300 bg-white text-surface-800 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200'
                : 'border-surface-200 bg-white/50 text-surface-400 dark:border-surface-700 dark:bg-surface-900/50 dark:text-surface-600'
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: activeLayers.has(layer) ? layerColors[layer] : '#999' }}
            />
            {layerLabels[layer]}
          </button>
        ))}
      </div>

      {/* Auto-rotate toggle */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className={`absolute bottom-2 left-2 z-20 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all sm:bottom-4 sm:left-4 sm:text-xs ${
          autoRotate
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
            : 'border-surface-200 bg-white/50 text-surface-400 dark:border-surface-700 dark:bg-surface-900/50 dark:text-surface-600'
        }`}
      >
        ⟳ Auto-rotate
      </button>

      {/* Info hint */}
      {!selected && !hovered && (
        <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-surface-500 dark:bg-surface-900/70 dark:text-surface-400 sm:bottom-4 sm:right-4">
          <Info className="h-3 w-3" />
          Click a region to explore
        </div>
      )}

      {/* Info panel */}
      {selected && (
        <RegionInfoPanel region={selected} onClose={() => setSelected(null)} />
      )}

      {/* Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.8, 0.3, 0.8], fov: 35, near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="rounded-xl"
      >
        <color attach="background" args={['#0a0a0a']} />

        {/* Lighting — clinical dissection lab */}
        <ambientLight intensity={0.45} color="#e8f0ff" />
        <directionalLight
          position={[2, 4, 2]}
          intensity={1.2}
          color="#ffffff"
          castShadow
        />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} color="#aaccff" />
        <pointLight position={[0, -1, 0]} intensity={0.2} color="#ffeedd" />

        <Suspense fallback={<LoadingOverlay />}>
          <Bounds fit clip observe margin={1.2}>
            <AnatomyModel
              hovered={hovered}
              selected={selected}
              onHover={handleHover}
              onSelect={handleSelect}
              showRegion={hovered}
              activeLayers={activeLayers}
            />
          </Bounds>
          <ContactShadows
            position={[0, -0.5, 0]}
            opacity={0.5}
            scale={2}
            blur={2}
            far={1}
            color="#000000"
          />
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
          minDistance={0.3}
          maxDistance={3}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}

// Preload the model
useGLTF.preload('/models/upper-limb.glb')