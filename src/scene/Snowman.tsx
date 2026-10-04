import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const POSITION: [number, number, number] = [3, 0, 1.6]
const DELAY = 1.5
const RAMP = 1.2

const BODY: [number, number, number][] = [
  [0, 0.45, 0.45],
  [0, 1.1, 0.33],
  [0, 1.55, 0.24],
]

/** Three spheres and a carrot nose, scaling in once on mount. */
export function Snowman() {
  const groupRef = useRef<Group>(null)
  const startRef = useRef<number | null>(null)
  const reduced = usePrefersReducedMotion()

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    if (reduced) {
      group.scale.setScalar(1)
      return
    }

    // Clock starts on this component's first frame, not page load.
    if (startRef.current === null) startRef.current = state.clock.elapsedTime

    const k = Math.max(0, Math.min(1, (state.clock.elapsedTime - startRef.current - DELAY) / RAMP))
    group.scale.setScalar(0.001 + k * 0.999)
  })

  return (
    <group ref={groupRef} position={POSITION}>
      {BODY.map(([x, y, r], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <sphereGeometry args={[r, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
      ))}

      <mesh position={[0, 1.55, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.3, 10]} />
        <meshStandardMaterial color="#ff8a1f" roughness={0.8} />
      </mesh>
    </group>
  )
}
