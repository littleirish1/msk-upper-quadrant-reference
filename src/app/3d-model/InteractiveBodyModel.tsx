'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { X, ChevronRight, ExternalLink } from 'lucide-react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { REGIONS } from '@/data/taxonomy'
import type { RegionSlug } from '@/types'

const regionColors: Record<string, string> = {
  cervical: '#3aa3c2',
  thoracic: '#f08000',
  shoulder: '#e02020',
  elbow: '#8b5cf6',
  'wrist-hand': '#10b981',
}

type BodyPartKey = RegionSlug

function BodyPartMesh({
  position,
  scale,
  rotation = [0, 0, 0],
  region,
  label,
  conditions,
  hovered,
  selected,
  onHover,
  onSelect,
  geometry,
}: {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  region: BodyPartKey
  label: string
  conditions: { slug: string; label: string }[]
  hovered: BodyPartKey | null
  selected: BodyPartKey | null
  onHover: (key: BodyPartKey | null) => void
  onSelect: (key: BodyPartKey) => void
  geometry: 'box' | 'cylinder' | 'sphere' | 'capsule'
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const color = regionColors[region] ?? '#3aa3c2'
  const isHovered = hovered === region
  const isSelected = selected === region

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    const breathe = isSelected ? 0 : Math.sin(t * 1.5 + position[1] * 2) * 0.003
    meshRef.current.scale.setScalar(1 + breathe)
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

  const baseColor = useMemo(() => new THREE.Color(color), [color])
  const emissiveIntensity = isSelected ? 0.4 : isHovered ? 0.2 : 0.05

  const geometryNode = useMemo(() => {
    switch (geometry) {
      case 'cylinder': return <cylinderGeometry args={[1, 1, 1, 16]} />
      case 'sphere': return <sphereGeometry args={[1, 32, 32]} />
      case 'capsule': return <capsuleGeometry args={[0.5, 1, 8, 16]} />
      default: return <boxGeometry args={[1, 1, 1]} />
    }
  }, [geometry])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple} scale={scale as THREE.Vector3Tuple}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
      >
        {geometryNode}
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.55}
          metalness={0.1}
          transparent
          opacity={isSelected ? 1 : isHovered ? 0.92 : 0.8}
        />
      </mesh>
      {(isHovered || isSelected) && (
        <Html
          position={[0, scale[1] * 0.6 + 0.15, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: 'none' }}
        >
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

function AnatomyPiece({
  position,
  scale,
  rotation = [0, 0, 0],
  color = '#cbd5e1',
  geometry = 'box' as 'box' | 'cylinder' | 'sphere' | 'capsule',
}: {
  position: [number, number, number]
  scale: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  geometry?: 'box' | 'cylinder' | 'sphere' | 'capsule'
}) {
  const geometryNode = useMemo(() => {
    switch (geometry) {
      case 'cylinder': return <cylinderGeometry args={[1, 1, 1, 16]} />
      case 'sphere': return <sphereGeometry args={[1, 32, 32]} />
      case 'capsule': return <capsuleGeometry args={[0.5, 1, 8, 16]} />
      default: return <boxGeometry args={[1, 1, 1]} />
    }
  }, [geometry])

  return (
    <group position={position} rotation={rotation as THREE.EulerTuple} scale={scale as THREE.Vector3Tuple}>
      <mesh castShadow receiveShadow>
        {geometryNode}
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function HumanBody({
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

  return (
    <group>
      <AnatomyPiece position={[0, 3.3, 0]} scale={[0.55, 0.65, 0.55]} geometry="sphere" color="#e2e8f0" />
      <BodyPartMesh position={[0, 2.55, 0]} scale={[0.42, 0.4, 0.38]} region="cervical" label={cervical.label} conditions={cervical.conditions} geometry="capsule" {...partProps} />
      <BodyPartMesh position={[0, 1.55, 0]} scale={[1.1, 1.2, 0.65]} region="thoracic" label={thoracic.label} conditions={thoracic.conditions} geometry="box" {...partProps} />
      <BodyPartMesh position={[-0.95, 2.15, 0]} scale={[0.48, 0.42, 0.42]} region="shoulder" label="Left Shoulder" conditions={shoulder.conditions} geometry="sphere" {...partProps} />
      <BodyPartMesh position={[0.95, 2.15, 0]} scale={[0.48, 0.42, 0.42]} region="shoulder" label="Right Shoulder" conditions={shoulder.conditions} geometry="sphere" {...partProps} />
      <AnatomyPiece position={[-1.1, 1.55, 0]} scale={[0.26, 0.7, 0.26]} geometry="capsule" color="#cbd5e1" />
      <AnatomyPiece position={[1.1, 1.55, 0]} scale={[0.26, 0.7, 0.26]} geometry="capsule" color="#cbd5e1" />
      <BodyPartMesh position={[-1.1, 1.0, 0]} scale={[0.28, 0.22, 0.28]} region="elbow" label="Left Elbow" conditions={elbow.conditions} geometry="sphere" {...partProps} />
      <BodyPartMesh position={[1.1, 1.0, 0]} scale={[0.28, 0.22, 0.28]} region="elbow" label="Right Elbow" conditions={elbow.conditions} geometry="sphere" {...partProps} />
      <AnatomyPiece position={[-1.1, 0.55, 0]} scale={[0.22, 0.6, 0.22]} geometry="capsule" color="#cbd5e1" />
      <AnatomyPiece position={[1.1, 0.55, 0]} scale={[0.22, 0.6, 0.22]} geometry="capsule" color="#cbd5e1" />
      <BodyPartMesh position={[-1.1, 0.05, 0.02]} scale={[0.3, 0.38, 0.2]} region="wrist-hand" label="Left Wrist & Hand" conditions={wristHand.conditions} geometry="box" {...partProps} />
      <BodyPartMesh position={[1.1, 0.05, 0.02]} scale={[0.3, 0.38, 0.2]} region="wrist-hand" label="Right Wrist & Hand" conditions={wristHand.conditions} geometry="box" {...partProps} />
      <AnatomyPiece position={[0, -0.3, 0]} scale={[0.9, 0.35, 0.5]} geometry="box" color="#e2e8f0" />
    </group>
  )
}

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
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-3, 4, -5]} intensity={0.4} />
      <pointLight position={[0, 5, 3]} intensity={0.3} color="#ffffff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]} receiveShadow>
        <circleGeometry args={[3, 64]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} metalness={0} transparent opacity={0.3} />
      </mesh>
      <gridHelper args={[8, 16, '#cbd5e1', '#e2e8f0']} position={[0, -0.69, 0]} />
      <HumanBody hovered={hovered} selected={selected} onHover={onHover} onSelect={onSelect} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={3}
        maxDistance={12}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.75}
        autoRotate={!selected}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

function RegionDetailPanel({ region, onClose }: { region: BodyPartKey; onClose: () => void }) {
  const regionData = REGIONS.find(r => r.slug === region)!
  const color = regionColors[region]

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-surface-200 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-surface-700 dark:bg-surface-900/95 sm:w-96">
      <div className="flex items-center gap-3 border-b border-surface-200 px-4 py-4 dark:border-surface-700" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">{regionData.label}</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400">{regionData.conditions.length} conditions</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-200" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {regionData.conditions.map(condition => (
            <li key={condition.slug}>
              <Link href={`/${region}/${condition.slug}`} className="group flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-3 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-brand-600" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
                <div className="flex-1">
                  <p className="font-medium text-surface-900 group-hover:text-brand-700 dark:text-surface-100 dark:group-hover:text-brand-400">{condition.label}</p>
                  {condition.icd10 && <p className="mt-0.5 font-mono text-xs text-surface-400 dark:text-surface-500">ICD-10: {condition.icd10}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 dark:text-surface-600" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-surface-200 p-4 dark:border-surface-700">
        <Link href={`/${region}`} className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90" style={{ backgroundColor: color }}>
          <ExternalLink className="h-4 w-4" />
          View all {regionData.label} conditions
        </Link>
      </div>
    </div>
  )
}

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
    setSelected(prev => prev === key ? null : key)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelected(null)
  }, [])

  return (
    <div className="relative h-[min(80vh,700px)] w-full sm:h-[min(85vh,800px)]">
      <Canvas shadows camera={{ position: [0, 2.5, 7], fov: 40 }} className="touch-none">
        <Scene hovered={hovered} selected={selected} onHover={handleHover} onSelect={handleSelect} />
      </Canvas>

      {hovered && !selected && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
          <div className="rounded-full bg-surface-900/80 px-4 py-1.5 text-sm font-medium text-white shadow-lg dark:bg-surface-50/80 dark:text-surface-900">
            {REGIONS.find(r => r.slug === hovered)?.label}
            <span className="ml-1.5 text-xs opacity-70">&mdash; click to explore</span>
          </div>
        </div>
      )}

      {!selected && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="rounded-lg bg-surface-900/60 px-4 py-2 text-xs text-white/80 backdrop-blur-sm dark:bg-surface-100/60 dark:text-surface-800">
            Drag to rotate &middot; Scroll to zoom &middot; Click a body part to explore
          </div>
        </div>
      )}

      {selected && <RegionDetailPanel region={selected} onClose={handleCloseDetail} />}
      {selected && <div className="absolute inset-0 z-10" onClick={handleCloseDetail} />}
    </div>
  )
}
