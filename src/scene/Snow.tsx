import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, PointsMaterial, type Points } from 'three'
import { mulberry32 } from '../lib/rng'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const LIGHT_COUNT = 700
const HEAVY_COUNT = 1100
const SPREAD = 20
const TOP = 9

/**
 * One draw call for all snow. Flakes fall at slightly different speeds and drift
 * sideways on a sine, then wrap to the top when they reach the ground.
 *
 * `mulberry32` seeds the initial scatter rather than `Math.random()`: the React
 * compiler rejects impure calls during render, and a fixed seed also keeps the
 * field stable across re-mounts instead of reshuffling. This is geometric
 * scatter, not a per-day decision — that is `sceneEvents()`'s job.
 */
export function Snow({ heavy = false }: { heavy?: boolean }) {
  const pointsRef = useRef<Points>(null)
  const reduced = usePrefersReducedMotion()
  const count = heavy ? HEAVY_COUNT : LIGHT_COUNT

  const { geometry, material, speeds } = useMemo(() => {
    const rand = mulberry32(heavy ? 1337 : 7331)
    const positions = new Float32Array(count * 3)
    // Per-flake fall speed, matching the demo's .6 + (i % 5) * .12.
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * SPREAD
      positions[i * 3 + 1] = rand() * TOP
      positions[i * 3 + 2] = (rand() - 0.5) * SPREAD
      speeds[i] = heavy ? 0.85 + (i % 5) * 0.15 : 0.6 + (i % 5) * 0.12
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))

    const material = new PointsMaterial({
      color: 0xffffff,
      size: heavy ? 0.085 : 0.07,
      fog: false,
    })

    return { geometry, material, speeds }
  }, [count, heavy])

  // R3F does not dispose objects we constructed here.
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state, delta) => {
    if (reduced) return
    const points = pointsRef.current
    if (!points) return

    // Clamp so a backgrounded tab doesn't teleport every flake on return.
    const dt = Math.min(delta, 0.05)
    const elapsed = state.clock.elapsedTime

    const attr = points.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      let y = arr[i3 + 1] - dt * speeds[i]
      if (y < 0) y = TOP
      arr[i3 + 1] = y
      // Integrating sin(elapsed + i) is bounded, so x oscillates rather than
      // drifting off — no horizontal wrap needed.
      arr[i3] += Math.sin(elapsed + i) * dt * 0.1
    }
    attr.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}
