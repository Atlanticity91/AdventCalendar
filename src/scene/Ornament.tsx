import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Mesh } from 'three'

export type OrnamentState = 'available' | 'locked' | 'opened'

interface OrnamentProps {
  day: number
  position: [number, number, number]
  state: OrnamentState
  onClick: (day: number) => void
}

export function Ornament({ day, position, state, onClick }: OrnamentProps) {
  const meshRef = useRef<Mesh>(null!)

  // Gentle pulse on available ornaments
  useFrame((frameState) => {
    if (state === 'available') {
      const pulse = 1 + Math.sin(frameState.clock.elapsedTime * 2 + day * 0.5) * 0.08
      meshRef.current.scale.setScalar(pulse)
    }
  })

  if (state === 'opened') return null

  const isAvailable = state === 'available'
  const color = isAvailable ? '#a3121f' : '#4b5470'
  const emissive = isAvailable ? '#ff8a8a' : '#000000'
  const emissiveIntensity = isAvailable ? 0.4 : 0

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          // Drag-safe: only treat as click if pointer moved less than ~6px
          if (e.delta > 6) return
          onClick(day)
        }}
      >
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Camera-facing number label */}
      <Billboard>
        <Text
          fontSize={0.18}
          color={isAvailable ? '#ffffff' : '#1c2238'}
          anchorX="center"
          anchorY="middle"
        >
          {day}
        </Text>
      </Billboard>
    </group>
  )
}
