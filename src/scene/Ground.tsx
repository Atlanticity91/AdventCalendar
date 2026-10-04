import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  PointsMaterial,
  type Points,
} from 'three'
import { MOUNDS, hgt, makeGroundGeometry } from './terrain'
import { mulberry32 } from '../lib/rng'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const SPARK_COUNT = 150
const SPARK_RADIUS = 10

/** One twinkling sparkle layer, laid just above the snow surface. */
function useSparkleLayer(seed: number) {
  return useMemo(() => {
    const rand = mulberry32(seed)
    const positions = new Float32Array(SPARK_COUNT * 3)

    for (let i = 0; i < SPARK_COUNT; i++) {
      const r = Math.sqrt(rand()) * SPARK_RADIUS
      const t = rand() * Math.PI * 2
      const x = Math.cos(t) * r
      const z = Math.sin(t) * r
      // Scattered on the drifts, not floating at y=0.
      positions.set([x, hgt(x, z) + 0.03 + rand() * 0.15, z], i * 3)
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))

    const material = new PointsMaterial({
      color: 0xcfe6ff,
      size: 0.06,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0.5,
    })

    return { geometry, material }
  }, [seed])
}

function SparkleLayer({ seed, phase }: { seed: number; phase: 0 | 1 }) {
  const pointsRef = useRef<Points>(null)
  const { geometry, material } = useSparkleLayer(seed)
  const reduced = usePrefersReducedMotion()

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    // Read the material off the object at frame time rather than closing over
    // the render-scope value, which the React compiler treats as immutable.
    const points = pointsRef.current
    if (!points || reduced) return

    // Two layers on sine/cosine so they never pulse in lockstep.
    const t = state.clock.elapsedTime
    const wave = phase === 0 ? Math.sin(t * 1.7) : Math.cos(t * 1.3)
    ;(points.material as PointsMaterial).opacity = 0.25 + 0.75 * Math.abs(wave)
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export function Ground() {
  const geometry = useMemo(() => makeGroundGeometry(), [])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#f2f6ff" roughness={0.95} />
      </mesh>

      {/* Half-sphere snow mounds around the edges */}
      {MOUNDS.map(([x, z, r], i) => (
        <mesh key={i} position={[x, -0.05, z]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f7faff" roughness={1} />
        </mesh>
      ))}

      {/* Sparkles — listed as part of step 2 but never written; restored here */}
      <SparkleLayer seed={11} phase={0} />
      <SparkleLayer seed={29} phase={1} />
    </group>
  )
}