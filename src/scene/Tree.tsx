import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

export function Tree() {
  const starRef = useRef<Mesh>(null!)

  useFrame((state) => {
    starRef.current.rotation.y = state.clock.elapsedTime
  })

  return (
    <group>
      {/* Trunk */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.8, 12]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.8} />
      </mesh>

      {/* 4 cone tiers */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 1.3 + i * 0.85, 0]}>
          <coneGeometry args={[1.9 - i * 0.42, 1.6, 20]} />
          <meshStandardMaterial color="#1f6b4a" roughness={0.8} />
        </mesh>
      ))}

      {/* Star on top */}
      <mesh ref={starRef} position={[0, 4.55, 0]}>
        <octahedronGeometry args={[0.22]} />
        <meshStandardMaterial
          color="#f2c14e"
          emissive="#f2c14e"
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  )
}
