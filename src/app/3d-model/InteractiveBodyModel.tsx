'use client'

import { useRef, useState, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField, Vignette, SMAA } from '@react-three/postprocessing'
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

// ─── Bone material presets ──────────────────────────────────────────────────

function useBoneMaterial(opts?: { color?: string; emissive?: string; emissiveIntensity?: number }) {
  return useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(opts?.color ?? '#e8dcc8'),
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.4,
      emissive: new THREE.Color(opts?.emissive ?? '#000000'),
      emissiveIntensity: opts?.emissiveIntensity ?? 0,
      reflectivity: 0.3,
      sheen: 0.5,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#fff5e6'),
      transparent: true,
      opacity: 0.92,
    })
  }, [opts?.color, opts?.emissive, opts?.emissiveIntensity])
}

// ─── Vertebra generator (anatomically inspired) ────────────────────────────

function Vertebra({
  position,
  scale = 1,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  position: [number, number, number]
  scale?: number
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const meshRef = useRef<THREE.Group>(null!)
  const color = regionColors[region] ?? '#3aa3c2'
  const isHovered = hovered === region
  const isSelected = selected === region

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (isSelected) {
      meshRef.current.rotation.y = Math.sin(t * 0.8) * 0.05
    } else {
      meshRef.current.rotation.y = 0
    }
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

  const boneMat = useBoneMaterial({
    color: isHovered || isSelected ? color : '#e8dcc8',
    emissive: color,
    emissiveIntensity: isSelected ? 0.3 : isHovered ? 0.15 : 0,
  })

  return (
    <group
      ref={meshRef}
      position={position}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Vertebral body (centrum) - the thick disc */}
      <mesh castShadow receiveShadow material={boneMat}>
        <cylinderGeometry args={[0.14, 0.16, 0.1, 24]} />
      </mesh>

      {/* Spinous process - pointing backward */}
      <mesh position={[0, 0.02, -0.16]} rotation={[0.3, 0, 0]} castShadow receiveShadow material={boneMat}>
        <capsuleGeometry args={[0.035, 0.12, 8, 16]} />
      </mesh>

      {/* Transverse processes - pointing sideways */}
      <mesh position={[-0.14, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={boneMat}>
        <capsuleGeometry args={[0.025, 0.06, 8, 16]} />
      </mesh>
      <mesh position={[0.14, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={boneMat}>
        <capsuleGeometry args={[0.025, 0.06, 8, 16]} />
      </mesh>

      {/* Vertebral arch */}
      <mesh position={[0, 0.05, -0.04]} castShadow receiveShadow material={boneMat}>
        <torusGeometry args={[0.08, 0.03, 12, 20, Math.PI]} />
      </mesh>

      {(isHovered || isSelected) && (
        <Html position={[0, 0.25, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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

// ─── Rib generator ──────────────────────────────────────────────────────────

function Rib({
  side,
  index,
  yStart,
  color = '#e8dcc8',
}: {
  side: 'left' | 'right'
  index: number
  yStart: number
  color?: string
}) {
  const ribMat = useBoneMaterial({ color })
  const dir = side === 'left' ? -1 : 1

  // Curved rib shape using a tube geometry along a curve
  const ribCurve = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, yStart, 0),
      new THREE.Vector3(dir * 0.15, yStart - 0.02, 0.05),
      new THREE.Vector3(dir * 0.35, yStart - 0.06, 0.1),
      new THREE.Vector3(dir * 0.5, yStart - 0.1, 0.08),
      new THREE.Vector3(dir * 0.55, yStart - 0.14, 0.02),
      new THREE.Vector3(dir * 0.5, yStart - 0.16, -0.04),
      new THREE.Vector3(dir * 0.35, yStart - 0.14, -0.08),
      new THREE.Vector3(dir * 0.15, yStart - 0.1, -0.06),
    ])
    return curve
  }, [dir, yStart])

  const thickness = useMemo(() => Math.max(0.015, 0.022 - index * 0.0008), [index])

  return (
    <mesh castShadow receiveShadow material={ribMat}>
      <tubeGeometry args={[ribCurve, 32, thickness, 8, false]} />
    </mesh>
  )
}

// ─── Long bone (humerus, radius, ulna) ──────────────────────────────────────

function LongBone({
  position,
  length,
  radiusTop = 0.04,
  radiusBottom = 0.035,
  rotation = [0, 0, 0],
  color = '#e8dcc8',
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
  length: number
  radiusTop?: number
  radiusBottom?: number
  rotation?: [number, number, number]
  color?: string
  region?: BodyPartKey
  label?: string
  conditions?: { slug: string; label: string }[]
  hovered?: BodyPartKey | null
  selected?: BodyPartKey | null
  onHover?: (key: BodyPartKey | null) => void
  onSelect?: (key: BodyPartKey) => void
  interactive?: boolean
}) {
  const meshRef = useRef<THREE.Group>(null!)
  const isHovered = interactive && hovered === region
  const isSelected = interactive && selected === region
  const boneColor = interactive && (isHovered || isSelected) ? (regionColors[region!] ?? color) : color

  const boneMat = useBoneMaterial({
    color: boneColor,
    emissive: interactive ? (regionColors[region!] ?? '#000000') : '#000000',
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : 0,
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
    <group
      ref={meshRef}
      position={position}
      rotation={rotation as THREE.EulerTuple}
      onClick={interactive ? handleClick : undefined}
      onPointerOver={interactive ? handlePointerOver : undefined}
      onPointerOut={interactive ? handlePointerOut : undefined}
    >
      {/* Shaft */}
      <mesh castShadow receiveShadow material={boneMat}>
        <cylinderGeometry args={[radiusTop, radiusBottom, length, 24]} />
      </mesh>

      {/* Proximal epiphysis (head) */}
      <mesh position={[0, length / 2 + radiusTop * 0.5, 0]} castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[radiusTop * 1.4, 24, 24]} />
      </mesh>

      {/* Distal epiphysis (condyle) */}
      <mesh position={[0, -length / 2 - radiusBottom * 0.5, 0]} castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[radiusBottom * 1.3, 24, 24]} />
      </mesh>

      {/* Surface detail - subtle growth plate ridge */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[radiusTop * 0.95, 0.005, 8, 24]} />
        <meshStandardMaterial color="#d4c4a8" roughness={0.4} metalness={0.05} transparent opacity={0.6} />
      </mesh>

      {interactive && (isHovered || isSelected) && label && (
        <Html position={[0, length / 2 + 0.15, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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

// ─── Scapula (shoulder blade) ────────────────────────────────────────────────

function Scapula({
  side,
  position,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  side: 'left' | 'right'
  position: [number, number, number]
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const dir = side === 'left' ? -1 : 1
  const isHovered = hovered === region
  const isSelected = selected === region
  const color = regionColors[region] ?? '#e02020'

  const boneMat = useBoneMaterial({
    color: isHovered || isSelected ? color : '#e8dcc8',
    emissive: color,
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : 0,
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

  // Scapula shape via custom geometry
  const scapulaShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.bezierCurveTo(dir * 0.25, 0.1, dir * 0.3, 0.3, dir * 0.25, 0.5)
    shape.bezierCurveTo(dir * 0.15, 0.55, dir * 0.05, 0.52, dir * 0.02, 0.4)
    shape.bezierCurveTo(dir * 0.01, 0.3, dir * 0.03, 0.15, dir * 0.08, 0.05)
    shape.bezierCurveTo(dir * 0.06, -0.02, dir * 0.03, -0.03, 0, 0)
    return shape
  }, [dir])

  const scapulaGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(scapulaShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 4,
    })
    geo.center()
    return geo
  }, [scapulaShape])

  return (
    <group
      position={position}
      rotation={[0, dir * 0.3, dir * 0.15]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh geometry={scapulaGeo} castShadow receiveShadow material={boneMat} />

      {/* Acromion process */}
      <mesh position={[dir * 0.18, 0.22, 0]} castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
      </mesh>

      {/* Coracoid process */}
      <mesh position={[dir * 0.12, 0.15, 0.02]} rotation={[0.3, 0, 0]} castShadow receiveShadow material={boneMat}>
        <capsuleGeometry args={[0.02, 0.05, 8, 12]} />
      </mesh>

      {/* Glenoid cavity (socket) */}
      <mesh position={[dir * 0.2, 0.18, 0]} castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>

      {(isHovered || isSelected) && (
        <Html position={[dir * 0.1, 0.35, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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

// ─── Clavicle ────────────────────────────────────────────────────────────────

function Clavicle({ side, y }: { side: 'left' | 'right'; y: number }) {
  const dir = side === 'left' ? -1 : 1
  const boneMat = useBoneMaterial({ color: '#e8dcc8' })

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, y, 0.02),
      new THREE.Vector3(dir * 0.15, y + 0.02, 0.04),
      new THREE.Vector3(dir * 0.3, y - 0.01, 0.03),
      new THREE.Vector3(dir * 0.45, y - 0.03, 0.01),
    ])
  }, [dir, y])

  return (
    <mesh castShadow receiveShadow material={boneMat}>
      <tubeGeometry args={[curve, 24, 0.018, 8, false]} />
    </mesh>
  )
}

// ─── Hand/wrist complex ─────────────────────────────────────────────────────

function HandComplex({
  side,
  position,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  side: 'left' | 'right'
  position: [number, number, number]
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const dir = side === 'left' ? -1 : 1
  const isHovered = hovered === region
  const isSelected = selected === region
  const color = regionColors[region] ?? '#10b981'

  const boneMat = useBoneMaterial({
    color: isHovered || isSelected ? color : '#e8dcc8',
    emissive: color,
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : 0,
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

  // Carpals - small irregular bones
  const carpalPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    const rows = 2
    const cols = 4
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = dir * (0.02 + col * 0.025)
        const y = -row * 0.025 - 0.02
        const z = (col % 2) * 0.01
        positions.push([x, y, z])
      }
    }
    return positions
  }, [dir])

  // Metacarpals
  const metacarpalAngles = [-0.15, -0.05, 0, 0.05, 0.12]

  // Phalanges (fingers)
  const fingerData = useMemo(() => {
    const fingers = [
      { name: 'thumb', baseAngle: 0.4, segments: 2, len: [0.06, 0.04] },
      { name: 'index', baseAngle: 0.05, segments: 3, len: [0.05, 0.04, 0.03] },
      { name: 'middle', baseAngle: 0, segments: 3, len: [0.055, 0.045, 0.03] },
      { name: 'ring', baseAngle: -0.05, segments: 3, len: [0.05, 0.04, 0.025] },
      { name: 'pinky', baseAngle: -0.12, segments: 3, len: [0.04, 0.03, 0.022] },
    ]
    return fingers
  }, [])

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Wrist/carpal bones */}
      {carpalPositions.map((pos, i) => (
        <mesh key={`carpal-${i}`} position={pos} castShadow receiveShadow material={boneMat}>
          <sphereGeometry args={[0.014, 12, 12]} />
        </mesh>
      ))}

      {/* Metacarpals */}
      {metacarpalAngles.map((angle, i) => (
        <mesh
          key={`meta-${i}`}
          position={[dir * (0.12 + i * 0.022), 0.06, 0]}
          rotation={[0, 0, dir * angle]}
          castShadow
          receiveShadow
          material={boneMat}
        >
          <cylinderGeometry args={[0.01, 0.012, 0.06, 12]} />
        </mesh>
      ))}

      {/* Phalanges */}
      {fingerData.map((finger, fi) => (
        <group key={`finger-${fi}`} position={[dir * (0.16 + fi * 0.022), 0.1, 0]} rotation={[0, 0, dir * finger.baseAngle]}>
          {finger.len.map((segLen, si) => (
            <group key={`seg-${si}`} position={[0, si === 0 ? 0 : finger.len[si - 1] / 2 + segLen / 2, 0]}>
              <mesh position={[0, si === 0 ? segLen / 2 : 0, 0]} castShadow receiveShadow material={boneMat}>
                <cylinderGeometry args={[0.009 - si * 0.001, 0.011 - si * 0.001, segLen, 10]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {(isHovered || isSelected) && (
        <Html position={[dir * 0.1, 0.25, 0]} center distanceFactor={5} style={{ pointerEvents: 'none' }}>
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

// ─── Skull ──────────────────────────────────────────────────────────────────

function Skull() {
  const boneMat = useBoneMaterial({ color: '#f0e6d4' })

  return (
    <group position={[0, 2.62, 0]}>
      {/* Cranium */}
      <mesh castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[0.22, 32, 32]} />
      </mesh>

      {/* Face/jaw structure */}
      <mesh position={[0, -0.15, 0.08]} castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.16, 0.14, 0.12]} />
      </mesh>

      {/* Mandible */}
      <mesh position={[0, -0.22, 0.06]} castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.15, 0.05, 0.1]} />
      </mesh>

      {/* Eye sockets */}
      <mesh position={[-0.07, -0.05, 0.18]} material={boneMat}>
        <sphereGeometry args={[0.035, 16, 16]} />
      </mesh>
      <mesh position={[0.07, -0.05, 0.18]} material={boneMat}>
        <sphereGeometry args={[0.035, 16, 16]} />
      </mesh>

      {/* Nasal cavity */}
      <mesh position={[0, -0.1, 0.19]} material={boneMat}>
        <coneGeometry args={[0.02, 0.05, 8]} />
      </mesh>

      {/* Cranial sutures - subtle lines */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.21, 0.002, 8, 32, Math.PI * 0.6]} />
        <meshStandardMaterial color="#d4c4a8" roughness={0.6} transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// ─── Sternum ────────────────────────────────────────────────────────────────

function Sternum() {
  const boneMat = useBoneMaterial({ color: '#e8dcc8' })

  return (
    <group position={[0, 1.7, 0.12]}>
      {/* Manubrium */}
      <mesh castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.08, 0.06, 0.025]} />
      </mesh>
      {/* Body of sternum */}
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.06, 0.16, 0.02]} />
      </mesh>
      {/* Xiphoid process */}
      <mesh position={[0, -0.2, 0]} castShadow receiveShadow material={boneMat}>
        <coneGeometry args={[0.02, 0.04, 8]} />
      </mesh>
    </group>
  )
}

// ─── Pelvis ─────────────────────────────────────────────────────────────────

function Pelvis() {
  const boneMat = useBoneMaterial({ color: '#e8dcc8' })

  const pelvisShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.25, 0)
    shape.bezierCurveTo(-0.3, -0.08, -0.25, -0.18, -0.1, -0.2)
    shape.bezierCurveTo(-0.02, -0.22, 0.02, -0.22, 0.1, -0.2)
    shape.bezierCurveTo(0.25, -0.18, 0.3, -0.08, 0.25, 0)
    shape.bezierCurveTo(0.2, 0.05, 0.15, 0.08, 0.1, 0.06)
    shape.bezierCurveTo(0, 0.04, 0, 0.04, -0.1, 0.06)
    shape.bezierCurveTo(-0.15, 0.08, -0.2, 0.05, -0.25, 0)
    return shape
  }, [])

  const pelvisGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(pelvisShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 3,
    })
    geo.center()
    return geo
  }, [pelvisShape])

  return (
    <group position={[0, -0.05, 0]}>
      <mesh geometry={pelvisGeo} castShadow receiveShadow material={boneMat} />

      {/* Sacrum */}
      <mesh position={[0, -0.02, -0.04]} castShadow receiveShadow material={boneMat}>
        <boxGeometry args={[0.08, 0.1, 0.04]} />
      </mesh>

      {/* Hip sockets */}
      <mesh position={[-0.18, -0.05, 0]} castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>
      <mesh position={[0.18, -0.05, 0]} castShadow receiveShadow material={boneMat}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>
    </group>
  )
}

// ─── Full skeleton composition ──────────────────────────────────────────────

function SkeletonBody({
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
  const thoracic = REGIONS.find(r => r.slug === 'thoracic')!
  const shoulder = REGIONS.find(r => r.slug === 'shoulder')!
  const elbow = REGIONS.find(r => r.slug === 'elbow')!
  const wristHand = REGIONS.find(r => r.slug === 'wrist-hand')!

  const partProps = { hovered, selected, onHover, onSelect }

  // Cervical vertebrae positions (C1-C7)
  const cervicalVertebrae = useMemo(() => {
    const verts: { pos: [number, number, number]; scale: number }[] = []
    for (let i = 0; i < 7; i++) {
      verts.push({
        pos: [0, 2.35 - i * 0.045, 0],
        scale: 1 - i * 0.02,
      })
    }
    return verts
  }, [])

  // Thoracic vertebrae positions (T1-T12)
  const thoracicVertebrae = useMemo(() => {
    const verts: { pos: [number, number, number]; scale: number }[] = []
    for (let i = 0; i < 12; i++) {
      verts.push({
        pos: [0, 2.05 - i * 0.065, -0.02],
        scale: 1 + i * 0.02,
      })
    }
    return verts
  }, [])

  // Rib pairs (T1-T10 have ribs)
  const ribPairs = useMemo(() => {
    const pairs: { side: 'left' | 'right'; index: number; yStart: number }[] = []
    for (let i = 0; i < 10; i++) {
      const y = 2.0 - i * 0.065
      pairs.push({ side: 'left', index: i, yStart: y })
      pairs.push({ side: 'right', index: i, yStart: y })
    }
    return pairs
  }, [])

  return (
    <group scale={1.2}>
      {/* Skull */}
      <Skull />

      {/* Cervical spine - interactive group */}
      {cervicalVertebrae.map((v, i) => (
        <Vertebra
          key={`cerv-${i}`}
          position={v.pos}
          scale={v.scale * 0.6}
          region="cervical"
          label={cervical.label}
          conditions={cervical.conditions}
          {...partProps}
        />
      ))}

      {/* Thoracic spine */}
      {thoracicVertebrae.map((v, i) => (
        <Vertebra
          key={`thor-${i}`}
          position={v.pos}
          scale={v.scale * 0.7}
          region="thoracic"
          label={thoracic.label}
          conditions={thoracic.conditions}
          {...partProps}
        />
      ))}

      {/* Ribs */}
      {ribPairs.map((rib, i) => (
        <Rib key={`rib-${i}`} side={rib.side} index={rib.index} yStart={rib.yStart} />
      ))}

      {/* Sternum */}
      <Sternum />

      {/* Clavicles */}
      <Clavicle side="left" y={2.15} />
      <Clavicle side="right" y={2.15} />

      {/* Scapulae - interactive */}
      <Scapula side="left" position={[-0.25, 1.95, -0.08]} region="shoulder" label="Left Shoulder" conditions={shoulder.conditions} {...partProps} />
      <Scapula side="right" position={[0.25, 1.95, -0.08]} region="shoulder" label="Right Shoulder" conditions={shoulder.conditions} {...partProps} />

      {/* Humerus (upper arm) - interactive */}
      <LongBone
        position={[-0.4, 1.35, 0]}
        length={0.6}
        radiusTop={0.045}
        radiusBottom={0.038}
        rotation={[0, 0, 0.15]}
        region="shoulder"
        label="Left Humerus"
        conditions={shoulder.conditions}
        {...partProps}
      />
      <LongBone
        position={[0.4, 1.35, 0]}
        length={0.6}
        radiusTop={0.045}
        radiusBottom={0.038}
        rotation={[0, 0, -0.15]}
        region="shoulder"
        label="Right Humerus"
        conditions={shoulder.conditions}
        {...partProps}
      />

      {/* Elbow joint - interactive */}
      <mesh position={[-0.46, 1.05, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={selected === 'elbow' ? regionColors.elbow : (hovered === 'elbow' ? regionColors.elbow : '#e8dcc8')}
          emissive={regionColors.elbow}
          emissiveIntensity={selected === 'elbow' ? 0.25 : hovered === 'elbow' ? 0.12 : 0}
          roughness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.4}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0.46, 1.05, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={selected === 'elbow' ? regionColors.elbow : (hovered === 'elbow' ? regionColors.elbow : '#e8dcc8')}
          emissive={regionColors.elbow}
          emissiveIntensity={selected === 'elbow' ? 0.25 : hovered === 'elbow' ? 0.12 : 0}
          roughness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.4}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Radius & Ulna (forearm) - interactive */}
      <LongBone
        position={[-0.5, 0.7, 0.02]}
        length={0.5}
        radiusTop={0.028}
        radiusBottom={0.022}
        rotation={[0, 0, 0.05]}
        region="elbow"
        label="Left Forearm"
        conditions={elbow.conditions}
        {...partProps}
      />
      <LongBone
        position={[-0.46, 0.7, -0.02]}
        length={0.5}
        radiusTop={0.03}
        radiusBottom={0.024}
        rotation={[0, 0, 0.08]}
        color="#e0d5bc"
        interactive={false}
      />
      <LongBone
        position={[0.5, 0.7, 0.02]}
        length={0.5}
        radiusTop={0.028}
        radiusBottom={0.022}
        rotation={[0, 0, -0.05]}
        region="elbow"
        label="Right Forearm"
        conditions={elbow.conditions}
        {...partProps}
      />
      <LongBone
        position={[0.46, 0.7, -0.02]}
        length={0.5}
        radiusTop={0.03}
        radiusBottom={0.024}
        rotation={[0, 0, -0.08]}
        color="#e0d5bc"
        interactive={false}
      />

      {/* Hands - interactive */}
      <HandComplex side="left" position={[-0.52, 0.42, 0]} region="wrist-hand" label="Left Wrist & Hand" conditions={wristHand.conditions} {...partProps} />
      <HandComplex side="right" position={[0.52, 0.42, 0]} region="wrist-hand" label="Right Wrist & Hand" conditions={wristHand.conditions} {...partProps} />

      {/* Pelvis */}
      <Pelvis />

      {/* Elbow joint interaction meshes need handlers */}
      <ElbowJoint side="left" position={[-0.46, 1.05, 0]} region="elbow" label="Left Elbow" conditions={elbow.conditions} {...partProps} />
      <ElbowJoint side="right" position={[0.46, 1.05, 0]} region="elbow" label="Right Elbow" conditions={elbow.conditions} {...partProps} />
    </group>
  )
}

// ─── Elbow joint helper ─────────────────────────────────────────────────────

function ElbowJoint({
  side,
  position,
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  side: 'left' | 'right'
  position: [number, number, number]
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
}) {
  const isHovered = hovered === region
  const isSelected = selected === region
  const color = regionColors[region] ?? '#8b5cf6'

  const boneMat = useBoneMaterial({
    color: isHovered || isSelected ? color : '#e8dcc8',
    emissive: color,
    emissiveIntensity: isSelected ? 0.25 : isHovered ? 0.12 : 0,
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
    <mesh
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      castShadow
      receiveShadow
      material={boneMat}
    >
      <sphereGeometry args={[0.055, 24, 24]} />
      {(isHovered || isSelected) && (
        <Html position={[0, 0.12, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
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
    </mesh>
  )
}

// ─── 3D Scene with cinematic lighting ───────────────────────────────────────

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
      {/* Studio lighting setup */}
      <ambientLight intensity={0.15} color="#404060" />

      {/* Key light - warm, from upper right */}
      <directionalLight
        position={[4, 8, 4]}
        intensity={1.5}
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

      {/* Fill light - cool, from lower left */}
      <directionalLight position={[-3, 2, -4]} intensity={0.6} color="#8899ff" />

      {/* Rim light - from behind */}
      <directionalLight position={[0, 3, -6]} intensity={0.8} color="#aabbff" />

      {/* Accent point lights for depth */}
      <pointLight position={[2, 1.5, 3]} intensity={0.4} color="#ffcc88" distance={5} />
      <pointLight position={[-2, 0.5, 2]} intensity={0.3} color="#88aaff" distance={4} />

      {/* Environment for reflections — wrapped in Suspense in case HDR fails to load */}
      <Suspense fallback={null}>
        <Environment preset="studio" />
      </Suspense>

      {/* Ground contact shadows */}
      <ContactShadows
        position={[0, -0.7, 0]}
        opacity={0.5}
        scale={6}
        blur={2.5}
        far={4}
        color="#1a1a2e"
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.71, 0]} receiveShadow>
        <circleGeometry args={[4, 64]} />
        <meshStandardMaterial
          color="#0a0a12"
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Skeleton */}
      <SkeletonBody hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />

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

      {/* Post-processing for cinematic look */}
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <DepthOfField
          focusDistance={0.02}
          focalLength={0.05}
          bokehScale={2}
        />
        <Vignette eskil={false} offset={0.15} darkness={0.65} />
        <SMAA />
      </EffectComposer>
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

      {/* Desktop: right sidebar panel */}
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
            🖱️ Drag to rotate · Scroll to zoom · Click a bone to explore
          </div>
        </div>
      )}

      {selected && <RegionDetailPanel region={selected} onClose={handleCloseDetail} />}
      {/* Desktop: click backdrop to close (doesn't block on mobile) */}
      {selected && <div className="absolute inset-0 z-10 hidden sm:block" onClick={handleCloseDetail} />}
    </div>
  )
}