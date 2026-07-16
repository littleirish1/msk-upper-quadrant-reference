'use client'

import { useRef, useState, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { REGIONS } from '@/data/taxonomy'
import type { RegionSlug } from '@/types'

// ─── Region color mapping ────────────────────────────────────────────────────

const regionColors: Record<string, string> = {
  cervical: '#3aa3c2',
  thoracic: '#f08000',
  shoulder: '#e02020',
  elbow: '#8b5cf6',
  'wrist-hand': '#10b981',
}

type BodyPartKey = RegionSlug

// ─── Muscle material ────────────────────────────────────────────────────────

function useMuscleMaterial(opts?: { color?: string; emissive?: string; emissiveIntensity?: number }) {
  return useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(opts?.color ?? '#c4654a'),
      roughness: 0.6,
      metalness: 0.0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.7,
      emissive: new THREE.Color(opts?.emissive ?? '#000000'),
      emissiveIntensity: opts?.emissiveIntensity ?? 0,
      sheen: 0.3,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#d49b7a'),
      transparent: true,
      opacity: 0.93,
    })
  }, [opts?.color, opts?.emissive, opts?.emissiveIntensity])
}

// ─── Muscle belly shape (elongated, bulging) ────────────────────────────────

function MuscleBelly({
  position,
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  length = 1,
  radius = 0.08,
  taper = 0.7,
  color = '#c4654a',
  emissive = '#000000',
  emissiveIntensity = 0,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
  interactive = true,
}: {
  position: [number, number, number]
  scale?: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  radius?: number
  taper?: number
  color?: string
  emissive?: string
  emissiveIntensity?: number
  region?: BodyPartKey
  label?: string
  conditions?: { slug: string; label: string }[]
  hovered?: BodyPartKey | null
  selected?: BodyPartKey | null
  onHover?: (key: BodyPartKey | null) => void
  onSelect?: (key: BodyPartKey) => void
  interactive?: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const isHovered = interactive && hovered === region
  const isSelected = interactive && selected === region
  const muscleColor = interactive && (isHovered || isSelected) ? (regionColors[region!] ?? color) : color

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (isSelected) {
      const pulse = 1 + Math.sin(t * 3) * 0.02
      meshRef.current.scale.setScalar(pulse)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  // Build a muscle-shaped geometry: bulging center, tapered ends
  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(radius * taper, radius * taper, length, 16, 8)
    // Deform vertices to create muscle belly bulge
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const norm = y / (length / 2) // -1 to 1
      const bulge = 1 - norm * norm * 0.3 // bulge at center
      pos.setX(i, pos.getX(i) * bulge)
      pos.setZ(i, pos.getZ(i) * bulge)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }, [radius, length, taper])

  const material = useMuscleMaterial({
    color: muscleColor,
    emissive: interactive ? (emissive || regionColors[region!] || '#000000') : emissive,
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : emissiveIntensity,
  })

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!interactive || !region || !onSelect) return
    e.stopPropagation()
    onSelect(region)
  }, [interactive, region, onSelect])

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive || !region || !onHover) return
    e.stopPropagation()
    onHover(region)
  }, [interactive, region, onHover])

  const handlePointerOut = useCallback(() => {
    if (!interactive || !onHover) return
    onHover(null)
  }, [interactive, onHover])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple} scale={scale as THREE.Vector3Tuple}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={interactive ? handleClick : undefined}
        onPointerOver={interactive ? handlePointerOver : undefined}
        onPointerOut={interactive ? handlePointerOut : undefined}
      />
      {interactive && (isHovered || isSelected) && label && (
        <Html position={[0, length / 2 + 0.1, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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

// ─── Flat muscle sheet (for trapezius, pectoralis etc.) ────────────────────

function MuscleSheet({
  position,
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  shape,
  depth = 0.04,
  color = '#c4654a',
  emissive = '#000000',
  emissiveIntensity = 0,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  position: [number, number, number]
  scale?: [number, number, number]
  rotation?: [number, number, number]
  shape: THREE.Shape
  depth?: number
  color?: string
  emissive?: string
  emissiveIntensity?: number
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
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.015)
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.012,
      bevelSegments: 3,
    })
    geo.center()
    return geo
  }, [shape, depth])

  const material = useMuscleMaterial({
    color: muscleColor,
    emissive: emissive || regionColors[region] || '#000000',
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : emissiveIntensity,
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
    <group position={position} rotation={rotation as THREE.EulerTuple} scale={scale as THREE.Vector3Tuple}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      {(isHovered || isSelected) && (
        <Html position={[0, 0.2, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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

// ─── Neck muscles (cervical region) ─────────────────────────────────────────

function NeckMuscles({
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
  const cervical = REGIONS.find(r => r.slug === 'cervical')!

  // Sternocleidomastoid shape
  const scmShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.bezierCurveTo(0.02, 0.1, 0.01, 0.2, 0.03, 0.28)
    s.bezierCurveTo(0.02, 0.3, 0, 0.3, -0.01, 0.28)
    s.bezierCurveTo(-0.02, 0.2, -0.01, 0.1, 0, 0)
    return s
  }, [])

  // Trapezius (upper portion — neck/shoulder)
  const trapShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.15, 0)
    s.bezierCurveTo(-0.1, 0.08, -0.02, 0.1, 0, 0.12)
    s.bezierCurveTo(0.02, 0.1, 0.1, 0.08, 0.15, 0)
    s.bezierCurveTo(0.1, -0.02, 0.05, -0.03, 0, -0.02)
    s.bezierCurveTo(-0.05, -0.03, -0.1, -0.02, -0.15, 0)
    return s
  }, [])

  return (
    <group>
      {/* Sternocleidomastoid — left */}
      <MuscleSheet
        position={[-0.06, 2.35, 0.04]}
        rotation={[0.1, 0, -0.15]}
        shape={scmShape}
        depth={0.03}
        scale={[1.2, 1, 1]}
        region="cervical"
        label="Sternocleidomastoid"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Sternocleidomastoid — right */}
      <MuscleSheet
        position={[0.06, 2.35, 0.04]}
        rotation={[0.1, 0, 0.15]}
        shape={scmShape}
        depth={0.03}
        scale={[1.2, 1, 1]}
        region="cervical"
        label="Sternocleidomastoid"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Upper trapezius (neck portion) */}
      <MuscleSheet
        position={[0, 2.15, -0.02]}
        rotation={[0, 0, 0]}
        shape={trapShape}
        depth={0.04}
        scale={[2, 1.5, 1]}
        region="cervical"
        label="Upper Trapezius"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Scalenes (deep neck — small muscles) */}
      <MuscleBelly
        position={[-0.04, 2.25, 0.02]}
        rotation={[0, 0, -0.2]}
        length={0.12}
        radius={0.025}
        taper={0.6}
        color="#b85a40"
        region="cervical"
        label="Scalenes"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.04, 2.25, 0.02]}
        rotation={[0, 0, 0.2]}
        length={0.12}
        radius={0.025}
        taper={0.6}
        color="#b85a40"
        region="cervical"
        label="Scalenes"
        conditions={cervical.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Suboccipital muscles */}
      <MuscleBelly
        position={[0, 2.5, -0.02]}
        rotation={[0.3, 0, 0]}
        length={0.06}
        radius={0.02}
        taper={0.5}
        color="#a05030"
        region="cervical"
        label="Suboccipitals"
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

function ThoracicMuscles({
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
  const thoracic = REGIONS.find(r => r.slug === 'thoracic')!

  // Pectoralis major shape
  const pecShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.18, 0)
    s.bezierCurveTo(-0.15, 0.08, -0.05, 0.1, 0, 0.08)
    s.bezierCurveTo(0.05, 0.1, 0.15, 0.08, 0.18, 0)
    s.bezierCurveTo(0.15, -0.05, 0.1, -0.08, 0.05, -0.06)
    s.bezierCurveTo(0, -0.04, -0.05, -0.04, -0.05, -0.06)
    s.bezierCurveTo(-0.1, -0.08, -0.15, -0.05, -0.18, 0)
    return s
  }, [])

  // Mid-trapezius shape (broad diamond)
  const midTrapShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.25, 0)
    s.bezierCurveTo(-0.15, 0.12, 0, 0.15, 0.25, 0)
    s.bezierCurveTo(0.15, -0.12, 0, -0.15, -0.25, 0)
    return s
  }, [])

  // Latissimus dorsi (thoracic portion)
  const latShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.2, 0.05)
    s.bezierCurveTo(-0.15, -0.08, -0.05, -0.12, 0, -0.1)
    s.bezierCurveTo(0.05, -0.12, 0.15, -0.08, 0.2, 0.05)
    s.bezierCurveTo(0.1, 0.08, 0, 0.06, 0, 0.04)
    s.bezierCurveTo(-0.1, 0.06, -0.1, 0.08, -0.2, 0.05)
    return s
  }, [])

  return (
    <group>
      {/* Pectoralis major — left */}
      <MuscleSheet
        position={[-0.1, 1.85, 0.08]}
        rotation={[0.1, 0.2, 0]}
        shape={pecShape}
        depth={0.05}
        scale={[1.5, 1.3, 1]}
        region="thoracic"
        label="Pectoralis Major"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Pectoralis major — right */}
      <MuscleSheet
        position={[0.1, 1.85, 0.08]}
        rotation={[0.1, -0.2, 0]}
        shape={pecShape}
        depth={0.05}
        scale={[1.5, 1.3, 1]}
        region="thoracic"
        label="Pectoralis Major"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Middle trapezius */}
      <MuscleSheet
        position={[0, 1.75, -0.05]}
        rotation={[-0.05, 0, 0]}
        shape={midTrapShape}
        depth={0.04}
        scale={[1.8, 1.2, 1]}
        region="thoracic"
        label="Middle Trapezius"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Latissimus dorsi — left */}
      <MuscleSheet
        position={[-0.12, 1.5, -0.03]}
        rotation={[-0.05, 0.3, 0.05]}
        shape={latShape}
        depth={0.035}
        scale={[1.4, 1.8, 1]}
        region="thoracic"
        label="Latissimus Dorsi"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Latissimus dorsi — right */}
      <MuscleSheet
        position={[0.12, 1.5, -0.03]}
        rotation={[-0.05, -0.3, -0.05]}
        shape={latShape}
        depth={0.035}
        scale={[1.4, 1.8, 1]}
        region="thoracic"
        label="Latissimus Dorsi"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Erector spinae — left (paraspinal column) */}
      <MuscleBelly
        position={[-0.04, 1.65, -0.04]}
        rotation={[0, 0, 0]}
        length={0.5}
        radius={0.035}
        taper={0.8}
        color="#a85640"
        region="thoracic"
        label="Erector Spinae"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Erector spinae — right */}
      <MuscleBelly
        position={[0.04, 1.65, -0.04]}
        rotation={[0, 0, 0]}
        length={0.5}
        radius={0.035}
        taper={0.8}
        color="#a85640"
        region="thoracic"
        label="Erector Spinae"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Serratus anterior — left */}
      {[0, 1, 2, 3].map(i => (
        <MuscleBelly
          key={`serratus-l-${i}`}
          position={[-0.18, 1.7 - i * 0.06, 0.03]}
          rotation={[0, 0.4, 0.1]}
          length={0.07}
          radius={0.02}
          taper={0.6}
          color="#b8604a"
          interactive={false}
        />
      ))}
      {/* Serratus anterior — right */}
      {[0, 1, 2, 3].map(i => (
        <MuscleBelly
          key={`serratus-r-${i}`}
          position={[0.18, 1.7 - i * 0.06, 0.03]}
          rotation={[0, -0.4, -0.1]}
          length={0.07}
          radius={0.02}
          taper={0.6}
          color="#b8604a"
          interactive={false}
        />
      ))}

      {/* Rhomboids */}
      <MuscleBelly
        position={[-0.08, 1.7, -0.05]}
        rotation={[0, 0.5, 0]}
        length={0.1}
        radius={0.03}
        taper={0.7}
        color="#a05035"
        region="thoracic"
        label="Rhomboids"
        conditions={thoracic.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.08, 1.7, -0.05]}
        rotation={[0, -0.5, 0]}
        length={0.1}
        radius={0.03}
        taper={0.7}
        color="#a05035"
        region="thoracic"
        label="Rhomboids"
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

function ShoulderMuscles({
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
  const shoulder = REGIONS.find(r => r.slug === 'shoulder')!

  // Deltoid shape
  const deltoidShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.bezierCurveTo(0.08, 0.02, 0.1, -0.05, 0.08, -0.12)
    s.bezierCurveTo(0.05, -0.15, -0.05, -0.15, -0.08, -0.12)
    s.bezierCurveTo(-0.1, -0.05, -0.08, 0.02, 0, 0)
    return s
  }, [])

  // Rotator cuff muscle shape (smaller, rounder)
  const rcShape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.04, 0)
    s.bezierCurveTo(-0.03, 0.05, 0.03, 0.05, 0.04, 0)
    s.bezierCurveTo(0.03, -0.04, -0.03, -0.04, -0.04, 0)
    return s
  }, [])

  return (
    <group>
      {/* Deltoid — left */}
      <MuscleSheet
        position={[-0.28, 2.0, 0.02]}
        rotation={[0.1, 0.3, -0.1]}
        shape={deltoidShape}
        depth={0.05}
        scale={[2, 2.5, 1.5]}
        region="shoulder"
        label="Deltoid"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Deltoid — right */}
      <MuscleSheet
        position={[0.28, 2.0, 0.02]}
        rotation={[0.1, -0.3, 0.1]}
        shape={deltoidShape}
        depth={0.05}
        scale={[2, 2.5, 1.5]}
        region="shoulder"
        label="Deltoid"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Supraspinatus — left */}
      <MuscleBelly
        position={[-0.22, 2.05, -0.04]}
        rotation={[0, 0.3, -0.2]}
        length={0.08}
        radius={0.025}
        taper={0.7}
        color="#a85540"
        region="shoulder"
        label="Supraspinatus"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Supraspinatus — right */}
      <MuscleBelly
        position={[0.22, 2.05, -0.04]}
        rotation={[0, -0.3, 0.2]}
        length={0.08}
        radius={0.025}
        taper={0.7}
        color="#a85540"
        region="shoulder"
        label="Supraspinatus"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Infraspinatus — left */}
      <MuscleSheet
        position={[-0.2, 1.85, -0.05]}
        rotation={[-0.1, 0.2, -0.1]}
        shape={rcShape}
        depth={0.025}
        scale={[2.5, 2, 1]}
        region="shoulder"
        label="Infraspinatus"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Infraspinatus — right */}
      <MuscleSheet
        position={[0.2, 1.85, -0.05]}
        rotation={[-0.1, -0.2, 0.1]}
        shape={rcShape}
        depth={0.025}
        scale={[2.5, 2, 1]}
        region="shoulder"
        label="Infraspinatus"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Teres minor — left */}
      <MuscleBelly
        position={[-0.2, 1.72, -0.03]}
        rotation={[0, 0.3, -0.1]}
        length={0.06}
        radius={0.02}
        taper={0.6}
        color="#9a4a35"
        region="shoulder"
        label="Teres Minor"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Teres minor — right */}
      <MuscleBelly
        position={[0.2, 1.72, -0.03]}
        rotation={[0, -0.3, 0.1]}
        length={0.06}
        radius={0.02}
        taper={0.6}
        color="#9a4a35"
        region="shoulder"
        label="Teres Minor"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Teres major — left */}
      <MuscleBelly
        position={[-0.18, 1.68, -0.02]}
        rotation={[0, 0.2, -0.15]}
        length={0.09}
        radius={0.03}
        taper={0.6}
        color="#b05a40"
        region="shoulder"
        label="Teres Major"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Teres major — right */}
      <MuscleBelly
        position={[0.18, 1.68, -0.02]}
        rotation={[0, -0.2, 0.15]}
        length={0.09}
        radius={0.03}
        taper={0.6}
        color="#b05a40"
        region="shoulder"
        label="Teres Major"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Subscapularis — left */}
      <MuscleSheet
        position={[-0.16, 1.85, -0.06]}
        rotation={[0, 0, 0]}
        shape={rcShape}
        depth={0.02}
        scale={[2, 2.5, 1]}
        color="#8a4530"
        region="shoulder"
        label="Subscapularis"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Subscapularis — right */}
      <MuscleSheet
        position={[0.16, 1.85, -0.06]}
        rotation={[0, 0, 0]}
        shape={rcShape}
        depth={0.02}
        scale={[2, 2.5, 1]}
        color="#8a4530"
        region="shoulder"
        label="Subscapularis"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Biceps brachii — left (long + short head) */}
      <MuscleBelly
        position={[-0.36, 1.55, 0.04]}
        rotation={[0, 0, 0.1]}
        length={0.45
        }
        radius={0.04}
        taper={0.7}
        color="#c4654a"
        region="shoulder"
        label="Biceps Brachii"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Biceps brachii — right */}
      <MuscleBelly
        position={[0.36, 1.55, 0.04]}
        rotation={[0, 0, -0.1]}
        length={0.45}
        radius={0.04}
        taper={0.7}
        color="#c4654a"
        region="shoulder"
        label="Biceps Brachii"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Triceps brachii — left (long head, visible from back) */}
      <MuscleBelly
        position={[-0.38, 1.55, -0.02]}
        rotation={[0, 0, 0.12]}
        length={0.5}
        radius={0.045}
        taper={0.65}
        color="#b85a40"
        region="shoulder"
        label="Triceps Brachii"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Triceps brachii — right */}
      <MuscleBelly
        position={[0.38, 1.55, -0.02]}
        rotation={[0, 0, -0.12]}
        length={0.5}
        radius={0.045}
        taper={0.65}
        color="#b85a40"
        region="shoulder"
        label="Triceps Brachii"
        conditions={shoulder.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Coracobrachialis — left */}
      <MuscleBelly
        position={[-0.34, 1.65, 0.02]}
        rotation={[0, 0, 0.08]}
        length={0.12}
        radius={0.02}
        taper={0.6}
        color="#a05035"
        interactive={false}
      />
      {/* Coracobrachialis — right */}
      <MuscleBelly
        position={[0.34, 1.65, 0.02]}
        rotation={[0, 0, -0.08]}
        length={0.12}
        radius={0.02}
        taper={0.6}
        color="#a05035"
        interactive={false}
      />
    </group>
  )
}

// ─── Elbow muscles ───────────────────────────────────────────────────────────

function ElbowMuscles({
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
  const elbow = REGIONS.find(r => r.slug === 'elbow')!

  return (
    <group>
      {/* Brachialis — left */}
      <MuscleBelly
        position={[-0.38, 1.3, 0.03]}
        rotation={[0, 0, 0.05]}
        length={0.12}
        radius={0.028}
        taper={0.7}
        color="#b05a40"
        region="elbow"
        label="Brachialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Brachialis — right */}
      <MuscleBelly
        position={[0.38, 1.3, 0.03]}
        rotation={[0, 0, -0.05]}
        length={0.12}
        radius={0.028}
        taper={0.7}
        color="#b05a40"
        region="elbow"
        label="Brachialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Brachioradialis — left */}
      <MuscleBelly
        position={[-0.44, 1.1, 0.04]}
        rotation={[0, 0, 0.15]}
        length={0.22}
        radius={0.03}
        taper={0.6}
        color="#c4654a"
        region="elbow"
        label="Brachioradialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Brachioradialis — right */}
      <MuscleBelly
        position={[0.44, 1.1, 0.04]}
        rotation={[0, 0, -0.15]}
        length={0.22}
        radius={0.03}
        taper={0.6}
        color="#c4654a"
        region="elbow"
        label="Brachioradialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Pronator teres — left */}
      <MuscleBelly
        position={[-0.42, 1.0, 0.02]}
        rotation={[0, 0, 0.2]}
        length={0.1}
        radius={0.025}
        taper={0.6}
        color="#a85540"
        region="elbow"
        label="Pronator Teres"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Pronator teres — right */}
      <MuscleBelly
        position={[0.42, 1.0, 0.02]}
        rotation={[0, 0, -0.2]}
        length={0.1}
        radius={0.025}
        taper={0.6}
        color="#a85540"
        region="elbow"
        label="Pronator Teres"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Triceps tendon (olecranon area) */}
      <MuscleBelly
        position={[-0.4, 1.12, -0.03]}
        rotation={[0, 0, 0.1]}
        length={0.08}
        radius={0.02}
        taper={0.5}
        color="#9a4a30"
        region="elbow"
        label="Triceps Tendon"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.4, 1.12, -0.03]}
        rotation={[0, 0, -0.1]}
        length={0.08}
        radius={0.02}
        taper={0.5}
        color="#9a4a30"
        region="elbow"
        label="Triceps Tendon"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Extensor carpi radialis — left */}
      <MuscleBelly
        position={[-0.46, 1.05, 0.05]}
        rotation={[0, 0, 0.18]}
        length={0.2}
        radius={0.022}
        taper={0.55}
        color="#bc5e45"
        region="elbow"
        label="Ext. Carpi Radialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.46, 1.05, 0.05]}
        rotation={[0, 0, -0.18]}
        length={0.2}
        radius={0.022}
        taper={0.55}
        color="#bc5e45"
        region="elbow"
        label="Ext. Carpi Radialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Flexor carpi radialis — left */}
      <MuscleBelly
        position={[-0.44, 1.0, 0.0]}
        rotation={[0, 0, 0.12]}
        length={0.18}
        radius={0.02}
        taper={0.55}
        color="#a85040"
        region="elbow"
        label="Flex. Carpi Radialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.44, 1.0, 0.0]}
        rotation={[0, 0, -0.12]}
        length={0.18}
        radius={0.02}
        taper={0.55}
        color="#a85040"
        region="elbow"
        label="Flex. Carpi Radialis"
        conditions={elbow.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
    </group>
  )
}

// ─── Wrist & Hand muscles ───────────────────────────────────────────────────

function WristHandMuscles({
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
  const wristHand = REGIONS.find(r => r.slug === 'wrist-hand')!

  return (
    <group>
      {/* Thenar eminence (thumb base) — left */}
      <MuscleBelly
        position={[-0.5, 0.35, 0.04]}
        rotation={[0, 0, 0.4]}
        length={0.07}
        radius={0.025}
        taper={0.6}
        color="#c4654a"
        region="wrist-hand"
        label="Thenar Eminence"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Thenar eminence — right */}
      <MuscleBelly
        position={[0.5, 0.35, 0.04]}
        rotation={[0, 0, -0.4]}
        length={0.07}
        radius={0.025}
        taper={0.6}
        color="#c4654a"
        region="wrist-hand"
        label="Thenar Eminence"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Hypothenar eminence (pinky base) — left */}
      <MuscleBelly
        position={[-0.58, 0.32, 0.03]}
        rotation={[0, 0, -0.3]}
        length={0.06}
        radius={0.02}
        taper={0.6}
        color="#a85540"
        region="wrist-hand"
        label="Hypothenar Eminence"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Hypothenar eminence — right */}
      <MuscleBelly
        position={[0.58, 0.32, 0.03]}
        rotation={[0, 0, 0.3]}
        length={0.06}
        radius={0.02}
        taper={0.6}
        color="#a85540"
        region="wrist-hand"
        label="Hypothenar Eminence"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Flexor digitorum superficialis — left forearm */}
      <MuscleBelly
        position={[-0.46, 0.65, 0.0]}
        rotation={[0, 0, 0.05]}
        length={0.35}
        radius={0.03}
        taper={0.5}
        color="#a85040"
        region="wrist-hand"
        label="Flexor Digitorum"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Flexor digitorum — right */}
      <MuscleBelly
        position={[0.46, 0.65, 0.0]}
        rotation={[0, 0, -0.05]}
        length={0.35}
        radius={0.03}
        taper={0.5}
        color="#a85040"
        region="wrist-hand"
        label="Flexor Digitorum"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Extensor digitorum — left forearm */}
      <MuscleBelly
        position={[-0.48, 0.65, 0.04]}
        rotation={[0, 0, 0.08]}
        length={0.35}
        radius={0.025}
        taper={0.5}
        color="#bc5e45"
        region="wrist-hand"
        label="Extensor Digitorum"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      {/* Extensor digitorum — right */}
      <MuscleBelly
        position={[0.48, 0.65, 0.04]}
        rotation={[0, 0, -0.08]}
        length={0.35}
        radius={0.025}
        taper={0.5}
        color="#bc5e45"
        region="wrist-hand"
        label="Extensor Digitorum"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />

      {/* Lumbricals (small hand muscles) — left */}
      {[0, 1, 2, 3].map(i => (
        <MuscleBelly
          key={`lumbrical-l-${i}`}
          position={[-0.52 - i * 0.015, 0.4 + i * 0.005, 0.02]}
          rotation={[0, 0, 0.1 + i * 0.05]}
          length={0.04}
          radius={0.012}
          taper={0.5}
          color="#9a4a35"
          interactive={false}
        />
      ))}
      {/* Lumbricals — right */}
      {[0, 1, 2, 3].map(i => (
        <MuscleBelly
          key={`lumbrical-r-${i}`}
          position={[0.52 + i * 0.015, 0.4 + i * 0.005, 0.02]}
          rotation={[0, 0, -0.1 - i * 0.05]}
          length={0.04}
          radius={0.012}
          taper={0.5}
          color="#9a4a35"
          interactive={false}
        />
      ))}

      {/* Flexor pollicis longus (thumb flexor) — left */}
      <MuscleBelly
        position={[-0.5, 0.6, -0.01]}
        rotation={[0, 0, 0.15]}
        length={0.3}
        radius={0.018}
        taper={0.5}
        color="#a05035"
        region="wrist-hand"
        label="Flexor Pollicis Longus"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
      <MuscleBelly
        position={[0.5, 0.6, -0.01]}
        rotation={[0, 0, -0.15]}
        length={0.3}
        radius={0.018}
        taper={0.5}
        color="#a05035"
        region="wrist-hand"
        label="Flexor Pollicis Longus"
        conditions={wristHand.conditions}
        hovered={hovered}
        selected={selected}
        onHover={onHover}
        onSelect={onSelect}
      />
    </group>
  )
}

// ─── Head (simplified) ──────────────────────────────────────────────────────

function Head() {
  const skinMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d4a584'),
    roughness: 0.65,
    metalness: 0,
    clearcoat: 0.1,
    sheen: 0.2,
    sheenColor: new THREE.Color('#e0b896'),
    transparent: true,
    opacity: 0.4,
  }), [])

  return (
    <group position={[0, 2.7, 0]}>
      <mesh castShadow receiveShadow material={skinMat}>
        <sphereGeometry args={[0.2, 24, 24]} />
      </mesh>
    </group>
  )
}

// ─── Full muscle body composition ──────────────────────────────────────────

function MuscleBody({
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
    <group scale={1.15}>
      <Head />
      <NeckMuscles hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
      <ThoracicMuscles hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
      <ShoulderMuscles hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
      <ElbowMuscles hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
      <WristHandMuscles hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
    </group>
  )
}

// ─── 3D Scene ───────────────────────────────────────────────────────────────

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
      {/* Studio lighting */}
      <ambientLight intensity={0.25} color="#404060" />

      {/* Key light — warm */}
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.3}
        color="#fff4e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0001}
      />

      {/* Fill light — cool */}
      <directionalLight position={[-3, 2, -4]} intensity={0.5} color="#8899ff" />

      {/* Rim light */}
      <directionalLight position={[0, 3, -6]} intensity={0.6} color="#aabbff" />

      {/* Accent lights */}
      <pointLight position={[2, 1.5, 3]} intensity={0.3} color="#ffcc88" distance={5} />
      <pointLight position={[-2, 0.5, 2]} intensity={0.2} color="#88aaff" distance={4} />

      {/* Ground contact shadows */}
      <ContactShadows
        position={[0, -0.7, 0]}
        opacity={0.4}
        scale={6}
        blur={2.5}
        far={4}
        color="#1a1a2e"
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.71, 0]} receiveShadow>
        <circleGeometry args={[4, 64]} />
        <meshStandardMaterial color="#0a0a12" roughness={0.2} metalness={0.8} transparent opacity={0.3} />
      </mesh>

      <MuscleBody hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2.5}
        maxDistance={10}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.78}
        autoRotate={!selected}
        autoRotateSpeed={0.3}
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
        camera={{ position: [0, 1.5, 5], fov: 35 }}
        className="touch-none"
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <color attach="background" args={['#0a0a14']} />
        <fog attach="fog" args={['#0a0a14', 8, 18]} />
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