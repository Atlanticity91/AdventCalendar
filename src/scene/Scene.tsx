import { useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Tree } from './Tree'
import { Ground } from './Ground'
import { Ornament } from './Ornament'
import type { PerspectiveCamera } from 'three'

// Spiral position: computed from day number so ornaments never shift
function ornamentPosition(day: number): [number, number, number] {
  const t = day / 24
  const y = 0.9 + t * 3.1
  const r = 1.55 * (1 - t) + 0.35
  const a = day * 2.4
  return [Math.cos(a) * r, y, Math.sin(a) * r]
}

// Ensure camera aspect ratio updates on window resize
function CameraSetup() {
  const { camera, size } = useThree()

  useEffect(() => {
    const cam = camera as PerspectiveCamera
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
  }, [camera, size])

  return null
}

export function Scene() {
  const [opened, setOpened] = useState<Set<number>>(new Set())

  const handleOrnamentClick = (day: number) => {
    setOpened((prev) => new Set(prev).add(day))
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
        <color attach="background" args={['#0b1230']} />
        <fog attach="fog" args={['#0b1230', 10, 25]} />

        <ambientLight intensity={0.9} color="#8899cc" />
        <directionalLight position={[4, 6, 3]} intensity={0.9} />

        <CameraSetup />
        <Tree />
        <Ground />

        {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => (
          <Ornament
            key={day}
            day={day}
            position={ornamentPosition(day)}
            state={opened.has(day) ? 'opened' : 'available'}
            onClick={handleOrnamentClick}
          />
        ))}

        <OrbitControls
          target={[0, 2, 0]}
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate
        />
      </Canvas>
    </div>
  )
}
