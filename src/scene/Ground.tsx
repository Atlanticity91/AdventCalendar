import { useMemo } from 'react'
import * as THREE from 'three'

// Layered sines, ~0.12 amplitude, forced flat within ~1.2–3.7 of the tree
const hgt = (x: number, z: number) => {
  const r = Math.hypot(x, z)
  const k = Math.min(1, Math.max(0, (r - 1.2) / 2.5))
  return k * (
    0.12 * Math.sin(x * 0.7) * Math.cos(z * 0.6) +
    0.07 * Math.sin(x * 1.9 + z * 1.3) +
    0.04 * Math.sin(z * 2.7 - x * 0.8)
  )
}

const MOUNDS: [number, number, number][] = [
  [-4, -3, 1.2],
  [5, -4, 1],
  [-6, 2, 1.4],
  [2, -6, 1.1],
  [7, 1, 0.9],
]

export function Ground() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(40, 40, 120, 120)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, hgt(pos.getX(i), pos.getZ(i)))
    }
    geo.computeVertexNormals()
    return geo
  }, [])

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
    </group>
  )
}
