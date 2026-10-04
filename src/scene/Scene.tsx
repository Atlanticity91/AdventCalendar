import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Tree } from './Tree'
import { Ground } from './Ground'
import { Ornament } from './Ornament'
import { DEFAULT_ADVENT_YEAR, canOpen, currentDay, dayCount, sceneEvents } from '../lib/date'
import { ornamentPosition } from '../lib/ornaments'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { Snow } from './Snow'
import { Snowman } from './Snowman'
import { Footprints } from './Footprints'
import type { PerspectiveCamera } from 'three'

interface SceneProps {
  opened: ReadonlySet<number>
  /** `?dev=1` — unlocks DEV_UNLOCKED_DAYS so ornaments can be clicked through. */
  dev?: boolean
  /** Advent year from the letter JSON — the date lock is keyed to it. */
  year?: number
  /** `extended: true` runs to day 32 (1 January). */
  extended?: boolean
  /** Day currently flying off to the tray after being opened. */
  leavingDay?: number | null
  /** Pauses auto-rotation while a letter is open. Ongoing camera motion behind a
   *  modal is the main dizziness trigger, so it stops for as long as the letter is up. */
  letterOpen?: boolean
  onOrnamentClick: (day: number) => void
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

export function Scene({
  opened,
  dev = false,
  year = DEFAULT_ADVENT_YEAR,
  extended = false,
  leavingDay = null,
  letterOpen = false,
  onOrnamentClick,
}: SceneProps) {
  const total = dayCount(extended)
  const now = new Date()
  const today = currentDay(now, extended)
  const events = sceneEvents(now)
  const reduced = usePrefersReducedMotion()

  const stateOf = (day: number) => {
    if (opened.has(day)) return 'opened' as const
    // A ball mid-flight is still on the tree, so it keeps its available state.
    if (day === leavingDay) return 'available' as const
    return canOpen(day, now, dev, year, extended) ? ('available' as const) : ('locked' as const)
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

        {/* Per-day scene surprises, chosen by day-of-month arithmetic in
            lib/date.ts (not the cancelled hash()). */}
        {events.snowman && <Snowman />}
        {events.footprints > 0 && <Footprints count={events.footprints} />}
        <Snow heavy={events.heavySnow} />

        {Array.from({ length: total }, (_, i) => i + 1).map((day) => (
          <Ornament
            key={day}
            day={day}
            position={ornamentPosition(day, total)}
            state={stateOf(day)}
            today={day === today}
            leaving={day === leavingDay}
            onClick={onOrnamentClick}
          />
        ))}

        <OrbitControls
          target={[0, 2, 0]}
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.1}
          /* Continuous camera motion is the one thing `prefers-reduced-motion`
             cannot be papered over with a CSS transition, so it is gated here.
             It also stops while a letter is up. */
          autoRotate={!letterOpen && !reduced}
        />
      </Canvas>
    </div>
  )
}