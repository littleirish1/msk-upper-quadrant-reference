'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, ContactShadows } from '@react-three/drei'
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

// Anatomical muscle tone palette — cadaveric
const MUSCLE_DEEP = '#8a3422'    // deep red, dark
const MUSCLE_MID = '#a8442e'     // mid red-brown
const MUSCLE_SUPERFICIAL = '#bd5a3e' // lighter, superficial
const MUSCLE_PALE = '#c87558'    // pale, most superficial
const TENDON_COLOR = '#e8dcc4'   // tendon/ligament
const FASCIA_COLOR = '#d4c8b0'  // fascial sheen

type BodyPartKey = RegionSlug

// ─── Procedural muscle fiber normal texture ────────────────────────────────

function useMuscleFiberTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    // Base
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)
    // Striated fiber lines — vertical orientation
    for (let i = 0; i < 120; i++) {
      const x = (i / 120) * size + (Math.random() - 0.5) * 3
      const brightness = 110 + Math.random() * 40
      const alpha = 0.3 + Math.random() * 0.4
      ctx.strokeStyle = `rgba(${brightness},${brightness - 10},${brightness - 20},${alpha})`
      ctx.lineWidth = 0.5 + Math.random() * 1.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      // Slight wavy fiber path
      for (let y = 0; y <= size; y += 8) {
        const wave = Math.sin(y * 0.03 + i * 0.5) * 2
        ctx.lineTo(x + wave, y)
      }
      ctx.stroke()
    }
    // Cross-striations (A-bands)
    for (let y = 0; y < size; y += 6 + Math.random() * 4) {
      ctx.strokeStyle = `rgba(60,50,45,${0.15 + Math.random() * 0.1})`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y + (Math.random() - 0.5) * 4)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 8)
    return tex
  }, [])
}

// ─── Muscle material — cadaveric with fiber texture ────────────────────────

function useMuscleMaterial(opts: {
  color?: string
  emissive?: string
  emissiveIntensity?: number
  deep?: boolean
}) {
  const fiberTex = useMuscleFiberTexture()

  return useMemo(() => {
    const baseColor = opts.deep
      ? new THREE.Color(opts.color ?? MUSCLE_DEEP)
      : new THREE.Color(opts.color ?? MUSCLE_MID)

    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.45,
      metalness: 0.0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.35,
      emissive: new THREE.Color(opts.emissive ?? '#000000'),
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      sheen: 0.8,
      sheenRoughness: 0.3,
      sheenColor: new THREE.Color('#d49b7a'),
      transparent: true,
      opacity: 0.96,
      normalMap: fiberTex,
      normalScale: new THREE.Vector2(0.6, 0.8),
    })
    return mat
  }, [opts.color, opts.emissive, opts.emissiveIntensity, opts.deep, fiberTex])
}

// ─── Tendon material ─────────────────────────────────────────────────────────

function useTendonMaterial() {
  return useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(TENDON_COLOR),
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
      sheen: 1.0,
      sheenRoughness: 0.1,
      sheenColor: new THREE.Color('#f0e8d4'),
      transparent: true,
      opacity: 0.88,
    })
  }, [])
}

// ─── Fusiform muscle (classic spindle shape with tendon ends) ──────────────

function FusiformMuscle({
  position,
  rotation = [0, 0, 0],
  length = 0.3,
  radius = 0.05,
  color = MUSCLE_MID,
  deep = false,
  tendonLength = 0.04,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  radius?: number
  color?: string
  deep?: boolean
  tendonLength?: number
  region?: BodyPartKey
  label?: string
  conditions?: { slug: string; label: string }[]
  hovered?: BodyPartKey | null
  selected?: BodyPartKey | null
  onHover?: (key: BodyPartKey | null) => void
  onSelect?: (key: BodyPartKey) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const isHovered = region && hovered === region
  const isSelected = region && selected === region
  const muscleColor = isHovered || isSelected ? (regionColors[region!] ?? color) : color

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (isSelected) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.015)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  // Build fusiform geometry — bulges in middle, tapers to tendon at ends
  const bellyGeo = useMemo(() => {
    const segments = 24
    const radialSegments = 16
    const geo = new THREE.CylinderGeometry(radius * 0.3, radius * 0.3, length, radialSegments, segments)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const norm = y / (length / 2) // -1 to 1
      // Fusiform profile: bulges at center, tapers to ends
      const profile = Math.pow(1 - Math.abs(norm), 0.6)
      const bulge = 0.3 + profile * 0.7
      pos.setX(i, pos.getX(i) * bulge)
      pos.setZ(i, pos.getZ(i) * bulge)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [radius, length])

  const tendonGeo = useMemo(() => {
    return new THREE.CylinderGeometry(radius * 0.15, radius * 0.08, tendonLength, 12, 4)
  }, [radius, tendonLength])

  const mat = useMuscleMaterial({
    color: muscleColor,
    emissive: region ? regionColors[region] : '#000000',
    emissiveIntensity: isSelected ? 0.2 : isHovered ? 0.1 : 0,
    deep,

  })

  const tendonMat = useTendonMaterial()

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!region || !onSelect) return
    e.stopPropagation()
    onSelect(region)
  }, [region, onSelect])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!region || !onHover) return
    e.stopPropagation()
    onHover(region)
  }, [region, onHover])

  const handlePointerOut = useCallback(() => {
    if (!onHover) return
    onHover(null)
  }, [onHover])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple}>
      {/* Muscle belly */}
      <mesh
        ref={meshRef}
        geometry={bellyGeo}
        material={mat}
        castShadow
        receiveShadow
        onClick={region ? handleClick : undefined}
        onPointerOver={region ? handlePointerOver : undefined}
        onPointerOut={region ? handlePointerOut : undefined}
      />
      {/* Proximal tendon */}
      <mesh
        geometry={tendonGeo}
        material={tendonMat}
        position={[0, length / 2 + tendonLength / 2, 0]}
        castShadow
      />
      {/* Distal tendon */}
      <mesh
        geometry={tendonGeo}
        material={tendonMat}
        position={[0, -length / 2 - tendonLength / 2, 0]}
        castShadow
      />
      {region && (isHovered || isSelected) && label && (
        <Html position={[0, length / 2 + 0.08, 0]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-surface-900/95 px-3 py-1.5 text-sm font-semibold text-white shadow-lg dark:bg-surface-50 dark:text-surface-900">
            {label}
            {conditions && conditions.length > 0 && (
              <span className="ml-1.5 text-xs font-normal opacity-70">
                ({conditions.length} {conditions.length === 1 ? 'condition' : 'conditions'})
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Pennate muscle (feather-shaped — angled fibers off a tendon) ──────────

function PennateMuscle({
  position,
  rotation = [0, 0, 0],
  width = 0.1,
  height = 0.15,
  depth = 0.04,
  color = MUSCLE_MID,
  deep = false,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  depth?: number
  color?: string
  deep?: boolean
  region?: BodyPartKey
  label?: string
  conditions?: { slug: string; label: string }[]
  hovered?: BodyPartKey | null
  selected?: BodyPartKey | null
  onHover?: (key: BodyPartKey | null) => void
  onSelect?: (key: BodyPartKey) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const isHovered = region && hovered === region
  const isSelected = region && selected === region
  const muscleColor = isHovered || isSelected ? (regionColors[region!] ?? color) : color

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (isSelected) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.015)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  // Build a pennate shape — elongated, slightly curved
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 16, 12)
    // Deform to pennate shape
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      // Elongate vertically, flatten in z, widen in x
      pos.setY(i, y * height)
      pos.setX(i, x * width * (1 - Math.abs(y) * 0.3)) // taper top/bottom
      pos.setZ(i, z * depth)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [width, height, depth])

  const mat = useMuscleMaterial({
    color: muscleColor,
    emissive: region ? regionColors[region] : '#000000',
    emissiveIntensity: isSelected ? 0.2 : isHovered ? 0.1 : 0,
    deep,

  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!region || !onSelect) return
    e.stopPropagation()
    onSelect(region)
  }, [region, onSelect])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!region || !onHover) return
    e.stopPropagation()
    onHover(region)
  }, [region, onHover])

  const handlePointerOut = useCallback(() => {
    if (!onHover) return
    onHover(null)
  }, [onHover])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={mat}
        castShadow
        receiveShadow
        onClick={region ? handleClick : undefined}
        onPointerOver={region ? handlePointerOver : undefined}
        onPointerOut={region ? handlePointerOut : undefined}
      />
      {region && (isHovered || isSelected) && label && (
        <Html position={[0, height + 0.05, 0]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-surface-900/95 px-3 py-1.5 text-sm font-semibold text-white shadow-lg dark:bg-surface-50 dark:text-surface-900">
            {label}
            {conditions && conditions.length > 0 && (
              <span className="ml-1.5 text-xs font-normal opacity-70">
                ({conditions.length} {conditions.length === 1 ? 'condition' : 'conditions'})
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Flat muscle sheet (trapezius, pec, lat) ──────────────────────────────

function FlatMuscle({
  position,
  rotation = [0, 0, 0],
  shape,
  depth = 0.035,
  color = MUSCLE_MID,
  deep = false,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  shape: THREE.Shape
  depth?: number
  color?: string
  deep?: boolean
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const isHovered = hovered === region
  const isSelected = selected === region
  const muscleColor = isHovered || isSelected ? (regionColors[region] ?? color) : color

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (isSelected) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.01)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.008,
      bevelSegments: 4,
    })
    geo.center()
    return geo
  }, [shape, depth])

  const mat = useMuscleMaterial({
    color: muscleColor,
    emissive: regionColors[region],
    emissiveIntensity: isSelected ? 0.2 : isHovered ? 0.1 : 0,
    deep,

  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(region)
  }, [region, onSelect])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(region)
  }, [region, onHover])

  const handlePointerOut = useCallback(() => {
    onHover(null)
  }, [onHover])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={mat}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      {(isHovered || isSelected) && (
        <Html position={[0, 0.2, 0]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-surface-900/95 px-3 py-1.5 text-sm font-semibold text-white shadow-lg dark:bg-surface-50 dark:text-surface-900">
            {label}
            {conditions.length > 0 && (
              <span className="ml-1.5 text-xs font-normal opacity-70">
                ({conditions.length} {conditions.length === 1 ? 'condition' : 'conditions'})
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Cervical muscles ───────────────────────────────────────────────────────

function CervicalMuscles(props: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const { hovered, selected, onHover, onSelect } = props
  const cervical = REGIONS.find(r => r.slug === 'cervical')!

  const scmShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.bezierCurveTo(0.015, 0.08, 0.008, 0.16, 0.02, 0.22)
    s.bezierCurveTo(0.015, 0.24, 0, 0.24, -0.008, 0.22)
    s.bezierCurveTo(-0.015, 0.16, -0.008, 0.08, 0, 0)
    return s
  }, [])

  const upperTrapShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.12, 0)
    s.bezierCurveTo(-0.08, 0.06, -0.02, 0.08, 0, 0.1)
    s.bezierCurveTo(0.02, 0.08, 0.08, 0.06, 0.12, 0)
    s.bezierCurveTo(0.08, -0.015, 0.04, -0.02, 0, -0.015)
    s.bezierCurveTo(-0.04, -0.02, -0.08, -0.015, -0.12, 0)
    return s
  }, [])

  return (
    <group>
      {/* Sternocleidomastoid — left */}
      <FlatMuscle
        position={[-0.05, 2.3, 0.05]}
        rotation={[0.15, 0, -0.1]}
        shape={scmShape}
        depth={0.025}
        color={MUSCLE_SUPERFICIAL}
        region="cervical"
        label="Sternocleidomastoid"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Sternocleidomastoid — right */}
      <FlatMuscle
        position={[0.05, 2.3, 0.05]}
        rotation={[0.15, 0, 0.1]}
        shape={scmShape}
        depth={0.025}
        color={MUSCLE_SUPERFICIAL}
        region="cervical"
        label="Sternocleidomastoid"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Upper trapezius */}
      <FlatMuscle
        position={[0, 2.1, -0.01]}
        rotation={[0, 0, 0]}
        shape={upperTrapShape}
        depth={0.035}
        color={MUSCLE_MID}
        region="cervical"
        label="Upper Trapezius"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Scalenes (deep) — left */}
      <FusiformMuscle
        position={[-0.035, 2.22, 0.03]}
        rotation={[0, 0, -0.15]}
        length={0.1}
        radius={0.018}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Scalenes"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
      {/* Scalenes — right */}
      <FusiformMuscle
        position={[0.035, 2.22, 0.03]}
        rotation={[0, 0, 0.15]}
        length={0.1}
        radius={0.018}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Scalenes"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />

      {/* Suboccipitals (deep) */}
      <PennateMuscle
        position={[0, 2.48, -0.01]}
        rotation={[0.4, 0, 0]}
        width={0.04}
        height={0.04}
        depth={0.025}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Suboccipitals"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Splenius capitis (deep) */}
      <FusiformMuscle
        position={[-0.03, 2.35, -0.03]}
        rotation={[0.3, 0, -0.05]}
        length={0.12}
        radius={0.02}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Splenius Capitis"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
      <FusiformMuscle
        position={[0.03, 2.35, -0.03]}
        rotation={[0.3, 0, 0.05]}
        length={0.12}
        radius={0.02}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Splenius Capitis"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />

      {/* Levator scapulae */}
      <FusiformMuscle
        position={[-0.08, 2.15, -0.02]}
        rotation={[0.5, 0.1, -0.2]}
        length={0.14
        }
        radius={0.018}
        tendonLength={0.025}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Levator Scapulae"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
      <FusiformMuscle
        position={[0.08, 2.15, -0.02]}
        rotation={[0.5, -0.1, 0.2]}
        length={0.14}
        radius={0.018}
        tendonLength={0.025}
        color={MUSCLE_DEEP}
        deep
        region="cervical"
        label="Levator Scapulae"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
    </group>
  )
}

// ─── Thoracic muscles ───────────────────────────────────────────────────────

function ThoracicMuscles(props: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const { hovered, selected, onHover, onSelect } = props
  const thoracic = REGIONS.find(r => r.slug === 'thoracic')!

  const pecShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.15, 0.04)
    s.bezierCurveTo(-0.12, 0.1, -0.04, 0.12, 0, 0.1)
    s.bezierCurveTo(0.04, 0.12, 0.12, 0.1, 0.15, 0.04)
    s.bezierCurveTo(0.12, -0.03, 0.08, -0.06, 0.04, -0.05)
    s.bezierCurveTo(0, -0.03, -0.04, -0.03, -0.04, -0.05)
    s.bezierCurveTo(-0.08, -0.06, -0.12, -0.03, -0.15, 0.04)
    return s
  }, [])

  const midTrapShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.22, 0)
    s.bezierCurveTo(-0.12, 0.1, 0, 0.12, 0.22, 0)
    s.bezierCurveTo(0.12, -0.1, 0, -0.12, -0.22, 0)
    return s
  }, [])

  const latShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.16, 0.04)
    s.bezierCurveTo(-0.12, -0.06, -0.04, -0.1, 0, -0.08)
    s.bezierCurveTo(0.04, -0.1, 0.12, -0.06, 0.16, 0.04)
    s.bezierCurveTo(0.08, 0.06, 0, 0.04, 0, 0.03)
    s.bezierCurveTo(-0.08, 0.06, -0.08, 0.06, -0.16, 0.04)
    return s
  }, [])

  return (
    <group>
      {/* Pectoralis major — left */}
      <FlatMuscle
        position={[-0.08, 1.82, 0.07]}
        rotation={[0.05, 0.15, 0.02]}
        shape={pecShape}
        depth={0.045}
        color={MUSCLE_SUPERFICIAL}
        region="thoracic"
        label="Pectoralis Major"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Pectoralis major — right */}
      <FlatMuscle
        position={[0.08, 1.82, 0.07]}
        rotation={[0.05, -0.15, -0.02]}
        shape={pecShape}
        depth={0.045}
        color={MUSCLE_SUPERFICIAL}
        region="thoracic"
        label="Pectoralis Major"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Middle trapezius */}
      <FlatMuscle
        position={[0, 1.7, -0.04]}
        rotation={[-0.03, 0, 0]}
        shape={midTrapShape}
        depth={0.04}
        color={MUSCLE_MID}
        region="thoracic"
        label="Middle Trapezius"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Latissimus dorsi — left */}
      <FlatMuscle
        position={[-0.1, 1.45, -0.02]}
        rotation={[-0.03, 0.2, 0.03]}
        shape={latShape}
        depth={0.03}
        color={MUSCLE_MID}
        region="thoracic"
        label="Latissimus Dorsi"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Latissimus dorsi — right */}
      <FlatMuscle
        position={[0.1, 1.45, -0.02]}
        rotation={[-0.03, -0.2, -0.03]}
        shape={latShape}
        depth={0.03}
        color={MUSCLE_MID}
        region="thoracic"
        label="Latissimus Dorsi"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Erector spinae — left (deep paraspinal column) */}
      <FusiformMuscle
        position={[-0.035, 1.55, -0.035]}
        rotation={[0, 0, 0]}
        length={0.45}
        radius={0.032}
        tendonLength={0.03}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Erector Spinae"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
      {/* Erector spinae — right */}
      <FusiformMuscle
        position={[0.035, 1.55, -0.035]}
        rotation={[0, 0, 0]}
        length={0.45}
        radius={0.032}
        tendonLength={0.03}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Erector Spinae"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />

      {/* Rhomboids (deep) */}
      <PennateMuscle
        position={[-0.06, 1.68, -0.04]}
        rotation={[-0.05, 0.3, 0]}
        width={0.08}
        height={0.06}
        depth={0.025}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Rhomboids"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <PennateMuscle
        position={[0.06, 1.68, -0.04]}
        rotation={[-0.05, -0.3, 0]}
        width={0.08}
        height={0.06}
        depth={0.025}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Rhomboids"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Serratus anterior — left (digitations) */}
      {[0, 1, 2, 3].map(i => (
        <PennateMuscle
          key={`serratus-l-${i}`}
          position={[-0.15, 1.68 - i * 0.05, 0.025]}
          rotation={[0, 0.5, 0.08]}
          width={0.05}
          height={0.04}
          depth={0.02}
          color={MUSCLE_DEEP}
          deep
        />
      ))}
      {[0, 1, 2, 3].map(i => (
        <PennateMuscle
          key={`serratus-r-${i}`}
          position={[0.15, 1.68 - i * 0.05, 0.025]}
          rotation={[0, -0.5, -0.08]}
          width={0.05}
          height={0.04}
          depth={0.02}
          color={MUSCLE_DEEP}
          deep
        />
      ))}

      {/* Pectoralis minor (deep) */}
      <FusiformMuscle
        position={[-0.1, 1.9, 0.05]}
        rotation={[0, 0.2, 0]}
        length={0.1
        }
        radius={0.015}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Pectoralis Minor"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />
      <FusiformMuscle
        position={[0.1, 1.9, 0.05]}
        rotation={[0, -0.2, 0]}
        length={0.1}
        radius={0.015}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="thoracic"
        label="Pectoralis Minor"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}

      />

      {/* External oblique (thoracic portion) */}
      <PennateMuscle
        position={[-0.12, 1.35, 0.04]}
        rotation={[0, 0.3, 0.1]}
        width={0.1}
        height={0.08}
        depth={0.025}
        color={MUSCLE_MID}
        region="thoracic"
        label="External Oblique"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <PennateMuscle
        position={[0.12, 1.35, 0.04]}
        rotation={[0, -0.3, -0.1]}
        width={0.1}
        height={0.08}
        depth={0.025}
        color={MUSCLE_MID}
        region="thoracic"
        label="External Oblique"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
    </group>
  )
}

// ─── Shoulder muscles ───────────────────────────────────────────────────────

function ShoulderMuscles(props: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const { hovered, selected, onHover, onSelect } = props
  const shoulder = REGIONS.find(r => r.slug === 'shoulder')!
  const p = { hovered, selected, onHover, onSelect }

  const deltoidShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0.06)
    s.bezierCurveTo(0.06, 0.04, 0.08, -0.02, 0.07, -0.1)
    s.bezierCurveTo(0.04, -0.13, -0.04, -0.13, -0.07, -0.1)
    s.bezierCurveTo(-0.08, -0.02, -0.06, 0.04, 0, 0.06)
    return s
  }, [])

  const rcShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.035, 0)
    s.bezierCurveTo(-0.025, 0.045, 0.025, 0.045, 0.035, 0)
    s.bezierCurveTo(0.025, -0.035, -0.025, -0.035, -0.035, 0)
    return s
  }, [])

  return (
    <group>
      {/* Deltoid — left */}
      <FlatMuscle
        position={[-0.25, 1.95, 0.03]}
        rotation={[0.05, 0.25, -0.08]}
        shape={deltoidShape}
        depth={0.045}
        color={MUSCLE_SUPERFICIAL}
        region="shoulder"
        label="Deltoid"
        conditions={shoulder.conditions}
        {...p}
      />
      {/* Deltoid — right */}
      <FlatMuscle
        position={[0.25, 1.95, 0.03]}
        rotation={[0.05, -0.25, 0.08]}
        shape={deltoidShape}
        depth={0.045}
        color={MUSCLE_SUPERFICIAL}
        region="shoulder"
        label="Deltoid"
        conditions={shoulder.conditions}
        {...p}
      />

      {/* Supraspinatus — left (deep, above spine of scapula) */}
      <FusiformMuscle
        position={[-0.2, 2.05, -0.03]}
        rotation={[0, 0.25, -0.15]}
        length={0.07}
        radius={0.02}
        tendonLength={0.025}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Supraspinatus"
        conditions={shoulder.conditions}
        {...p}

      />
      {/* Supraspinatus — right */}
      <FusiformMuscle
        position={[0.2, 2.05, -0.03]}
        rotation={[0, -0.25, 0.15]}
        length={0.07}
        radius={0.02}
        tendonLength={0.025}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Supraspinatus"
        conditions={shoulder.conditions}
        {...p}

      />

      {/* Infraspinatus — left (deep, below spine of scapula) */}
      <FlatMuscle
        position={[-0.18, 1.82, -0.04]}
        rotation={[-0.05, 0.15, -0.05]}
        shape={rcShape}
        depth={0.025}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Infraspinatus"
        conditions={shoulder.conditions}
        {...p}
      />
      {/* Infraspinatus — right */}
      <FlatMuscle
        position={[0.18, 1.82, -0.04]}
        rotation={[-0.05, -0.15, 0.05]}
        shape={rcShape}
        depth={0.025}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Infraspinatus"
        conditions={shoulder.conditions}
        {...p}
      />

      {/* Teres minor — left */}
      <FusiformMuscle
        position={[-0.18, 1.72, -0.02]}
        rotation={[0, 0.25, -0.05]}
        length={0.05
        }
        radius={0.015}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Teres Minor"
        conditions={shoulder.conditions}
        {...p}

      />
      {/* Teres minor — right */}
      <FusiformMuscle
        position={[0.18, 1.72, -0.02]}
        rotation={[0, -0.25, 0.05]}
        length={0.05}
        radius={0.015}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Teres Minor"
        conditions={shoulder.conditions}
        {...p}

      />

      {/* Teres major — left */}
      <FusiformMuscle
        position={[-0.16, 1.65, -0.01]}
        rotation={[0, 0.15, -0.12]}
        length={0.08
        }
        radius={0.025}
        tendonLength={0.025}
        color={MUSCLE_MID}
        region="shoulder"
        label="Teres Major"
        conditions={shoulder.conditions}
        {...p}

      />
      {/* Teres major — right */}
      <FusiformMuscle
        position={[0.16, 1.65, -0.01]}
        rotation={[0, -0.15, 0.12]}
        length={0.08
        }
        radius={0.025}
        tendonLength={0.025}
        color={MUSCLE_MID}
        region="shoulder"
        label="Teres Major"
        conditions={shoulder.conditions}
        {...p}

      />

      {/* Subscapularis — left (deep, anterior scapula) */}
      <FlatMuscle
        position={[-0.14, 1.82, -0.05]}
        rotation={[0, 0, 0]}
        shape={rcShape}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Subscapularis"
        conditions={shoulder.conditions}
        {...p}
      />
      {/* Subscapularis — right */}
      <FlatMuscle
        position={[0.14, 1.82, -0.05]}
        rotation={[0, 0, 0]}
        shape={rcShape}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="shoulder"
        label="Subscapularis"
        conditions={shoulder.conditions}
        {...p}
      />

      {/* Biceps brachii — left (long + short head) */}
      <FusiformMuscle
        position={[-0.32, 1.5, 0.05]}
        rotation={[0, 0, 0.08]}
        length={0.42
        }
        radius={0.038}
        tendonLength={0.04}
        color={MUSCLE_SUPERFICIAL}
        region="shoulder"
        label="Biceps Brachii"
        conditions={shoulder.conditions}
        {...p}

      />
      {/* Biceps brachii — right */}
      <FusiformMuscle
        position={[0.32, 1.5, 0.05]}
        rotation={[0, 0, -0.08]}
        length={0.42
        }
        radius={0.038}
        tendonLength={0.04}
        color={MUSCLE_SUPERFICIAL}
        region="shoulder"
        label="Biceps Brachii"
        conditions={shoulder.conditions}
        {...p}

      />

      {/* Triceps — long head left (posterior, visible from back) */}
      <FusiformMuscle
        position={[-0.34, 1.5, -0.03]}
        rotation={[0, 0, 0.1]}
        length={0.48
        }
        radius={0.042}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="shoulder"
        label="Triceps Brachii"
        conditions={shoulder.conditions}
        {...p}

      />
      {/* Triceps — right */}
      <FusiformMuscle
        position={[0.34, 1.5, -0.03]}
        rotation={[0, 0, -0.1]}
        length={0.48
        }
        radius={0.042}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="shoulder"
        label="Triceps Brachii"
        conditions={shoulder.conditions}
        {...p}

      />

      {/* Coracobrachialis (deep) */}
      <FusiformMuscle
        position={[-0.3, 1.65, 0.02]}
        rotation={[0, 0, 0.05]}
        length={0.1
        }
        radius={0.018}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        {...p}

      />
      <FusiformMuscle
        position={[0.3, 1.65, 0.02]}
        rotation={[0, 0, -0.05]}
        length={0.1
        }
        radius={0.018}
        tendonLength={0.02}
        color={MUSCLE_DEEP}
        deep
        {...p}

      />
    </group>
  )
}

// ─── Elbow muscles ───────────────────────────────────────────────────────────

function ElbowMuscles(props: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const { hovered, selected, onHover, onSelect } = props
  const elbow = REGIONS.find(r => r.slug === 'elbow')!
  const p = { hovered, selected, onHover, onSelect }

  return (
    <group>
      {/* Brachialis (deep, anterior distal humerus) */}
      <FusiformMuscle
        position={[-0.34, 1.25, 0.03]}
        rotation={[0, 0, 0.04]}
        length={0.1
        }
        radius={0.025}
        tendonLength={0.03}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Brachialis"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.34, 1.25, 0.03]}
        rotation={[0, 0, -0.04]}
        length={0.1
        }
        radius={0.025}
        tendonLength={0.03}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Brachialis"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Brachioradialis — left (large forearm extensor) */}
      <FusiformMuscle
        position={[-0.4, 1.08, 0.04]}
        rotation={[0, 0, 0.12]}
        length={0.2
        }
        radius={0.028}
        tendonLength={0.04}
        color={MUSCLE_SUPERFICIAL}
        region="elbow"
        label="Brachioradialis"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.4, 1.08, 0.04]}
        rotation={[0, 0, -0.12]}
        length={0.2
        }
        radius={0.028}
        tendonLength={0.04}
        color={MUSCLE_SUPERFICIAL}
        region="elbow"
        label="Brachioradialis"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Pronator teres */}
      <PennateMuscle
        position={[-0.38, 0.98, 0.02]}
        rotation={[0, 0, 0.18]}
        width={0.07}
        height={0.06}
        depth={0.025}
        color={MUSCLE_MID}
        region="elbow"
        label="Pronator Teres"
        conditions={elbow.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.38, 0.98, 0.02]}
        rotation={[0, 0, -0.18]}
        width={0.07}
        height={0.06}
        depth={0.025}
        color={MUSCLE_MID}
        region="elbow"
        label="Pronator Teres"
        conditions={elbow.conditions}
        {...p}
      />

      {/* Extensor carpi radialis longus/brevis */}
      <FusiformMuscle
        position={[-0.42, 1.0, 0.05]}
        rotation={[0, 0, 0.15]}
        length={0.18
        }
        radius={0.022}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="elbow"
        label="Ext. Carpi Radialis"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.42, 1.0, 0.05]}
        rotation={[0, 0, -0.15]}
        length={0.18
        }
        radius={0.022}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="elbow"
        label="Ext. Carpi Radialis"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Flexor carpi radialis */}
      <FusiformMuscle
        position={[-0.4, 0.95, 0.0]}
        rotation={[0, 0, 0.1]}
        length={0.16
        }
        radius={0.02}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="elbow"
        label="Flex. Carpi Radialis"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.4, 0.95, 0.0]}
        rotation={[0, 0, -0.1]}
        length={0.16
        }
        radius={0.02}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="elbow"
        label="Flex. Carpi Radialis"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Extensor digitorum communis */}
      <FusiformMuscle
        position={[-0.44, 0.95, 0.04]}
        rotation={[0, 0, 0.18]}
        length={0.16
        }
        radius={0.02}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="elbow"
        label="Extensor Digitorum"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.44, 0.95, 0.04]}
        rotation={[0, 0, -0.18]}
        length={0.16
        }
        radius={0.02}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="elbow"
        label="Extensor Digitorum"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Flexor carpi ulnaris */}
      <FusiformMuscle
        position={[-0.42, 0.9, -0.03]}
        rotation={[0, 0, 0.08]}
        length={0.15
        }
        radius={0.022}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="elbow"
        label="Flex. Carpi Ulnaris"
        conditions={elbow.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.42, 0.9, -0.03]}
        rotation={[0, 0, -0.08]}
        length={0.15
        }
        radius={0.022}
        tendonLength={0.035}
        color={MUSCLE_MID}
        region="elbow"
        label="Flex. Carpi Ulnaris"
        conditions={elbow.conditions}
        {...p}

      />

      {/* Anconeus (small, behind elbow) */}
      <PennateMuscle
        position={[-0.38, 1.12, -0.04]}
        rotation={[-0.1, 0.1, 0]}
        width={0.04}
        height={0.04}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Anconeus"
        conditions={elbow.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.38, 1.12, -0.04]}
        rotation={[-0.1, -0.1, 0]}
        width={0.04}
        height={0.04}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Anconeus"
        conditions={elbow.conditions}
        {...p}
      />

      {/* Supinator (deep) */}
      <PennateMuscle
        position={[-0.38, 0.88, 0.02]}
        rotation={[0, 0, 0.1]}
        width={0.06}
        height={0.04}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Supinator"
        conditions={elbow.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.38, 0.88, 0.02]}
        rotation={[0, 0, -0.1]}
        width={0.06}
        height={0.04}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="elbow"
        label="Supinator"
        conditions={elbow.conditions}
        {...p}
      />
    </group>
  )
}

// ─── Wrist & Hand muscles ───────────────────────────────────────────────────

function WristHandMuscles(props: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const { hovered, selected, onHover, onSelect } = props
  const wristHand = REGIONS.find(r => r.slug === 'wrist-hand')!
  const p = { hovered, selected, onHover, onSelect }

  return (
    <group>
      {/* Thenar eminence (thumb base) */}
      <PennateMuscle
        position={[-0.48, 0.32, 0.04]}
        rotation={[0, 0, 0.4]}
        width={0.06}
        height={0.05}
        depth={0.03}
        color={MUSCLE_SUPERFICIAL}
        region="wrist-hand"
        label="Thenar Eminence"
        conditions={wristHand.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.48, 0.32, 0.04]}
        rotation={[0, 0, -0.4]}
        width={0.06}
        height={0.05}
        depth={0.03}
        color={MUSCLE_SUPERFICIAL}
        region="wrist-hand"
        label="Thenar Eminence"
        conditions={wristHand.conditions}
        {...p}
      />

      {/* Hypothenar eminence (pinky base) */}
      <PennateMuscle
        position={[-0.56, 0.28, 0.03]}
        rotation={[0, 0, -0.25]}
        width={0.045}
        height={0.04}
        depth={0.025}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Hypothenar Eminence"
        conditions={wristHand.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.56, 0.28, 0.03]}
        rotation={[0, 0, 0.25]}
        width={0.045}
        height={0.04}
        depth={0.025}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Hypothenar Eminence"
        conditions={wristHand.conditions}
        {...p}
      />

      {/* Flexor digitorum superficialis */}
      <FusiformMuscle
        position={[-0.42, 0.62, -0.01]}
        rotation={[0, 0, 0.04]}
        length={0.32
        }
        radius={0.028}
        tendonLength={0.05}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Flexor Digitorum Sup."
        conditions={wristHand.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.42, 0.62, -0.01]}
        rotation={[0, 0, -0.04]}
        length={0.32
        }
        radius={0.028}
        tendonLength={0.05}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Flexor Digitorum Sup."
        conditions={wristHand.conditions}
        {...p}

      />

      {/* Flexor digitorum profundus (deep) */}
      <FusiformMuscle
        position={[-0.44, 0.6, -0.03]}
        rotation={[0, 0, 0.06]}
        length={0.3
        }
        radius={0.022}
        tendonLength={0.05}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Flexor Digitorum Prof."
        conditions={wristHand.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.44, 0.6, -0.03]}
        rotation={[0, 0, -0.06]}
        length={0.3
        }
        radius={0.022}
        tendonLength={0.05}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Flexor Digitorum Prof."
        conditions={wristHand.conditions}
        {...p}

      />

      {/* Extensor digitorum */}
      <FusiformMuscle
        position={[-0.44, 0.6, 0.04]}
        rotation={[0, 0, 0.08]}
        length={0.3
        }
        radius={0.022}
        tendonLength={0.045}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Extensor Digitorum"
        conditions={wristHand.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.44, 0.6, 0.04]}
        rotation={[0, 0, -0.08]}
        length={0.3
        }
        radius={0.022}
        tendonLength={0.045}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Extensor Digitorum"
        conditions={wristHand.conditions}
        {...p}

      />

      {/* Flexor pollicis longus */}
      <FusiformMuscle
        position={[-0.46, 0.55, 0.0]}
        rotation={[0, 0, 0.12]}
        length={0.28
        }
        radius={0.016}
        tendonLength={0.05}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Flexor Pollicis Longus"
        conditions={wristHand.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.46, 0.55, 0.0]}
        rotation={[0, 0, -0.12]}
        length={0.28
        }
        radius={0.016}
        tendonLength={0.05}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Flexor Pollicis Longus"
        conditions={wristHand.conditions}
        {...p}

      />

      {/* Extensor pollicis longus/brevis */}
      <FusiformMuscle
        position={[-0.48, 0.52, 0.04]}
        rotation={[0, 0, 0.15]}
        length={0.2
        }
        radius={0.014}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Extensor Pollicis"
        conditions={wristHand.conditions}
        {...p}

      />
      <FusiformMuscle
        position={[0.48, 0.52, 0.04]}
        rotation={[0, 0, -0.15]}
        length={0.2
        }
        radius={0.014}
        tendonLength={0.04}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Extensor Pollicis"
        conditions={wristHand.conditions}
        {...p}

      />

      {/* Lumbricals (deep, small) */}
      {[0, 1, 2, 3].map(i => (
        <PennateMuscle
          key={`lumbrical-l-${i}`}
          position={[-0.5 - i * 0.012, 0.38 + i * 0.004, 0.02]}
          rotation={[0, 0, 0.1 + i * 0.04]}
          width={0.03}
          height={0.025}
          depth={0.015}
          color={MUSCLE_DEEP}
          deep
        />
      ))}
      {[0, 1, 2, 3].map(i => (
        <PennateMuscle
          key={`lumbrical-r-${i}`}
          position={[0.5 + i * 0.012, 0.38 + i * 0.004, 0.02]}
          rotation={[0, 0, -0.1 - i * 0.04]}
          width={0.03}
          height={0.025}
          depth={0.015}
          color={MUSCLE_DEEP}
          deep
        />
      ))}

      {/* Abductor digiti minimi */}
      <PennateMuscle
        position={[-0.58, 0.22, 0.02]}
        rotation={[0, 0, -0.2]}
        width={0.04}
        height={0.035}
        depth={0.02}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Abductor Digiti Minimi"
        conditions={wristHand.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.58, 0.22, 0.02]}
        rotation={[0, 0, 0.2]}
        width={0.04}
        height={0.035}
        depth={0.02}
        color={MUSCLE_MID}
        region="wrist-hand"
        label="Abductor Digiti Minimi"
        conditions={wristHand.conditions}
        {...p}
      />

      {/* Adductor pollicis */}
      <PennateMuscle
        position={[-0.52, 0.38, 0.01]}
        rotation={[0, 0, 0.3]}
        width={0.045}
        height={0.03}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Adductor Pollicis"
        conditions={wristHand.conditions}
        {...p}
      />
      <PennateMuscle
        position={[0.52, 0.38, 0.01]}
        rotation={[0, 0, -0.3]}
        width={0.045}
        height={0.03}
        depth={0.02}
        color={MUSCLE_DEEP}
        deep
        region="wrist-hand"
        label="Adductor Pollicis"
        conditions={wristHand.conditions}
        {...p}
      />
    </group>
  )
}

// ─── Head (simplified) ──────────────────────────────────────────────────────

function Head() {
  const skinMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8a080'),
    roughness: 0.7,
    metalness: 0,
    clearcoat: 0.05,
    sheen: 0.15,
    sheenColor: new THREE.Color('#d4a888'),
    transparent: true,
    opacity: 0.35,
  }), [])

  return (
    <group position={[0, 2.65, 0]}>
      <mesh castShadow receiveShadow material={skinMat}>
        <sphereGeometry args={[0.18, 24, 24]} />
      </mesh>
    </group>
  )
}

// ─── Full anatomical composition ────────────────────────────────────────────

function CadaverBody({
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const props = { hovered, selected, onHover, onSelect }
  return (
    <group scale={1.15}>
      <Head />
      <CervicalMuscles {...props} />
      <ThoracicMuscles {...props} />
      <ShoulderMuscles {...props} />
      <ElbowMuscles {...props} />
      <WristHandMuscles {...props} />
    </group>
  )
}

// ─── Clinical dissection lighting ────────────────────────────────────────────

function Scene({
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  return (
    <>
      {/* Clinical dissection lighting — bright, even, cool-white */}
      <ambientLight intensity={0.45} color="#eef2ff" />

      {/* Overhead surgical light */}
      <directionalLight
        position={[3, 10, 3]}
        intensity={1.1}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={25}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0001}
      />

      {/* Side fill — cool */}
      <directionalLight position={[-4, 3, 2]} intensity={0.5} color="#d0d8ff" />

      {/* Back rim — subtle warm to show muscle texture */}
      <directionalLight position={[0, 2, -5]} intensity={0.35} color="#ffd8b0" />

      {/* Close-up accent lights for fiber detail */}
      <pointLight position={[1.5, 1, 2.5]} intensity={0.25} color="#ffffff" distance={5} />
      <pointLight position={[-1.5, 0.5, 2]} intensity={0.2} color="#e0e8ff" distance={4} />

      {/* Ground contact shadows */}
      <ContactShadows
        position={[0, -0.7, 0]}
        opacity={0.35}
        scale={6}
        blur={2}
        far={4}
        color="#111122"
      />

      {/* Ground plane — neutral clinical */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.71, 0]} receiveShadow>
        <circleGeometry args={[4, 64]} />
        <meshStandardMaterial color="#1a1a22" roughness={0.3} metalness={0.6} transparent opacity={0.25} />
      </mesh>

      <CadaverBody hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={9}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.78}
        autoRotate={!selected}
        autoRotateSpeed={0.25}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

// ─── Region detail panel ────────────────────────────────────────────────────

function RegionDetailPanel({ region, onClose }: { region: BodyPartKey; onClose: () => void }) {
  const regionData = REGIONS.find(r => r.slug === region)!
  const color = regionColors[region]

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-hidden rounded-t-2xl border-t border-surface-200 bg-white/97 shadow-2xl backdrop-blur-md dark:border-surface-700 dark:bg-surface-900/97 sm:hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottomColor: color, borderBottomWidth: 3 }}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-base font-bold text-surface-900 dark:text-surface-50">{regionData.label}</h2>
            <span className="text-xs text-surface-400 dark:text-surface-500">· {regionData.conditions.length} conditions</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto px-3 pb-3 pt-2">
          <ul className="space-y-1.5">
            {regionData.conditions.map(condition => (
              <li key={condition.slug}>
                <Link
                  href={`/${region}/${condition.slug}`}
                  className="group flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-brand-600"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-surface-900 group-hover:text-brand-700 dark:text-surface-100 dark:group-hover:text-brand-400">{condition.label}</p>
                    {condition.icd10 && (
                      <p className="mt-0.5 font-mono text-xs text-surface-400 dark:text-surface-500">ICD-10: {condition.icd10}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-surface-300 group-hover:text-brand-500 dark:text-surface-600" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-surface-200 px-3 py-2.5 dark:border-surface-700">
          <Link
            href={`/${region}`}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View all {regionData.label} conditions
          </Link>
        </div>
      </div>

      {/* Desktop: right sidebar */}
      <div className="absolute right-0 top-0 z-20 hidden h-full w-72 flex-col border-l border-surface-200 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-surface-700 dark:bg-surface-900/95 lg:w-80 sm:flex">
        <div className="flex items-center gap-3 border-b border-surface-200 px-4 py-3 dark:border-surface-700" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
          <div className="flex-1">
            <h2 className="text-base font-bold text-surface-900 dark:text-surface-50">{regionData.label}</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400">{regionData.conditions.length} conditions</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {regionData.conditions.map(condition => (
              <li key={condition.slug}>
                <Link
                  href={`/${region}/${condition.slug}`}
                  className="group flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-2.5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-brand-600"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-surface-900 group-hover:text-brand-700 dark:text-surface-100 dark:group-hover:text-brand-400">{condition.label}</p>
                    {condition.icd10 && (
                      <p className="mt-0.5 font-mono text-xs text-surface-400 dark:text-surface-500">ICD-10: {condition.icd10}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-surface-300 group-hover:text-brand-500 dark:text-surface-600" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-surface-200 p-3 dark:border-surface-700">
          <Link
            href={`/${region}`}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            <ExternalLink className="h-4 w-4" />
            View all {regionData.label} conditions
          </Link>
        </div>
      </div>
    </>
  )
}

// ─── Main interactive component (exported) ──────────────────────────────────

export function InteractiveBodyModel() {
  const [hovered, setHovered] = useState<BodyPartKey | null>(null)
  const [selected, setSelected] = useState<BodyPartKey | null>(null)

  const handleHover = useCallback((key: BodyPartKey | null) => {
    setHovered(key)
    if (typeof document !== 'undefined') {
      document.body.style.cursor = key ? 'pointer' : 'default'
    }
  }, [])

  const handleSelect = useCallback((key: BodyPartKey) => {
    setSelected((prev: BodyPartKey | null) => prev === key ? null : key)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelected(null)
  }, [])

  return (
    <div className="relative h-[60vh] w-full sm:h-[70vh] lg:h-[75vh]">
      <Canvas
        shadows
        camera={{ position: [0, 1.4, 4.5], fov: 35 }}
        className="touch-none"
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={['#12121a']} />
        <fog attach="fog" args={['#12121a', 7, 16]} />
        <Scene hovered={hovered} selected={selected} onHover={handleHover} onSelect={handleSelect} />
      </Canvas>

      {hovered && !selected && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          <div className="rounded-full bg-surface-900/80 px-3 py-1 text-xs font-medium text-white shadow-lg dark:bg-surface-50/80 dark:text-surface-900 sm:text-sm">
            {REGIONS.find(r => r.slug === hovered)?.label}
            <span className="ml-1 opacity-70">— click to explore</span>
          </div>
        </div>
      )}

      {!selected && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
          <div className="rounded-lg bg-surface-900/60 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-sm dark:bg-surface-100/60 dark:text-surface-800 sm:text-xs">
            🖱️ Drag to rotate · Scroll to zoom · Click a muscle to explore
          </div>
        </div>
      )}

      {selected && <RegionDetailPanel region={selected} onClose={handleCloseDetail} />}
      {selected && <div className="absolute inset-0 z-10 hidden sm:block" onClick={handleCloseDetail} />}
    </div>
  )
}