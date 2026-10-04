// Shared terrain so the ground mesh, the sparkle layers and the footprints all
// agree on where the snow surface is.
import * as THREE from 'three'

/** Layered sines, ~0.12 amplitude, forced flat within ~1.2–3.7 of the tree so the
 *  trunk sits cleanly. Ported from reference/demo.html `hgt()`. */
export const hgt = (x: number, z: number): number => {
  const r = Math.hypot(x, z)
  const k = Math.min(1, Math.max(0, (r - 1.2) / 2.5))
  return (
    k *
    (0.12 * Math.sin(x * 0.7) * Math.cos(z * 0.6) +
      0.07 * Math.sin(x * 1.9 + z * 1.3) +
      0.04 * Math.sin(z * 2.7 - x * 0.8))
  )
}

/** Half-sphere snow mounds: [x, z, radius] */
export const MOUNDS: [number, number, number][] = [
  [-4, -3, 1.2],
  [5, -4, 1],
  [-6, 2, 1.4],
  [2, -6, 1.1],
  [7, 1, 0.9],
]

export const GROUND_SIZE = 40
export const GROUND_SEGMENTS = 120

export function makeGroundGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, hgt(pos.getX(i), pos.getZ(i)))
  }
  geo.computeVertexNormals()
  return geo
}
