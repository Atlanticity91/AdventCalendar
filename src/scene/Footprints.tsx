import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, type Mesh } from 'three'
import { hgt } from './terrain'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export const MAX_FOOTPRINTS = 16
const SIDE_OFFSET = 0.14
const OPACITY = 0.75
const DELAY = 2
const STAGGER = 0.25
const RAMP = 0.5

// Curved path from the edge of the scene toward the snowman at (3, 1.6).
const px = (q: number) => 8.5 - q * 5 + Math.sin(q * 3.2) * 0.5
const pz = (q: number) => 5.8 - q * 3.7 + Math.cos(q * 2.5) * 0.3

interface Print {
  x: number
  y: number
  z: number
  angle: number
}

/** Alternating left/right ovals along the path, each rotated along travel. */
function usePrintLayout(): Print[] {
  return useMemo(() => {
    const prints: Print[] = []
    for (let i = 0; i < MAX_FOOTPRINTS; i++) {
      const t = i / (MAX_FOOTPRINTS - 1)
      const t2 = (i + 1) / (MAX_FOOTPRINTS - 1)

      const dx = px(t2) - px(t)
      const dz = pz(t2) - pz(t)
      const n = Math.hypot(dx, dz) || 1
      const side = i % 2 ? SIDE_OFFSET : -SIDE_OFFSET

      const x = px(t) + (-dz / n) * side
      const z = pz(t) + (dx / n) * side

      prints.push({ x, y: hgt(x, z) + 0.03, z, angle: Math.atan2(-dx, -dz) })
    }
    return prints
  }, [])
}

function Footprint({ print, index, visible, startRef, reduced }: {
  print: Print
  index: number
  visible: boolean
  startRef: { current: number | null }
  reduced: boolean
}) {
  const meshRef = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#8fa3cc',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    // Read the material off the mesh at frame time rather than closing over the
    // render-scope value, which the React compiler treats as immutable.
    const mesh = meshRef.current
    if (!mesh) return
    const mat = mesh.material as MeshBasicMaterial

    if (reduced) {
      mat.opacity = visible ? OPACITY : 0
      return
    }
    if (!visible) {
      mat.opacity = 0
      return
    }
    if (startRef.current === null) startRef.current = state.clock.elapsedTime

    const el = state.clock.elapsedTime - startRef.current
    // Prints fade in one after another along the trail.
    const k = Math.max(0, Math.min(1, (el - DELAY - index * STAGGER) / RAMP))
    mat.opacity = OPACITY * k
  })

  return (
    <group position={[print.x, print.y, print.z]} rotation={[0, print.angle, 0]}>
      <mesh
        ref={meshRef}
        material={material}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, 1.7, 1]}
      >
        <circleGeometry args={[0.1, 12]} />
      </mesh>
    </group>
  )
}

export function Footprints({ count }: { count: number }) {
  const prints = usePrintLayout()
  const startRef = useRef<number | null>(null)
  const reduced = usePrefersReducedMotion()

  return (
    <group>
      {prints.map((print, i) => (
        <Footprint
          key={i}
          print={print}
          index={i}
          visible={i < count}
          startRef={startRef}
          reduced={reduced}
        />
      ))}
    </group>
  )
}
