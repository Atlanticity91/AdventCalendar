import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Sprite } from 'three'

export type OrnamentState = 'available' | 'locked' | 'opened'

interface OrnamentProps {
  day: number
  position: [number, number, number]
  state: OrnamentState
  /** Today's ornament gets a slightly stronger pulse. */
  today?: boolean
  /** Just opened: fly toward the tray before the App removes it. */
  leaving?: boolean
  onClick: (day: number) => void
}

const SIZE = 128
const BALL_R = 60
const BASE_SCALE = 0.44

/** How long the ball takes to fly off to the tray. App delays opening the letter
 *  by this much so the animation is actually visible. */
export const LEAVE_MS = 380

// Where the ball heads: up and to the right, toward the tray rail, shrinking away.
const LEAVE_DX = 5
const LEAVE_DY = 1.5

// Big padlock for locked ornaments, with the day number printed on its body.
// Sized so the widest case (two-digit day numbers) still clears the edge.
const LOCK = {
  shackleX: SIZE / 2,
  shackleY: 40,
  shackleR: 22,
  shackleW: 11,
  bodyX: 30,
  bodyY: 52,
  bodyW: 68,
  bodyH: 58,
  bodyRadius: 12,
  numberY: 81,
  numberSize: 38,
}

const LOCK_INK = '#1c2238'
const LOCK_TEXT = '#eef4ff'

function drawLock(g: CanvasRenderingContext2D) {
  // Shackle first, so the body covers its lower half
  g.strokeStyle = LOCK_INK
  g.lineWidth = LOCK.shackleW
  g.lineCap = 'round'
  g.beginPath()
  g.arc(LOCK.shackleX, LOCK.shackleY, LOCK.shackleR, Math.PI, 0)
  g.stroke()

  // roundRect is Safari 16.4+; fall back to a square so an older engine
  // degrades the corner radius instead of throwing and killing the texture.
  g.fillStyle = LOCK_INK
  g.beginPath()
  if (typeof g.roundRect === 'function') {
    g.roundRect(LOCK.bodyX, LOCK.bodyY, LOCK.bodyW, LOCK.bodyH, LOCK.bodyRadius)
  } else {
    g.rect(LOCK.bodyX, LOCK.bodyY, LOCK.bodyW, LOCK.bodyH)
  }
  g.fill()
}

// The ball and its day number are baked into one canvas texture, then drawn on a
// Sprite (the approach used by reference/demo.html `tex()`).
//
// Two reasons we do NOT use an opaque sphere plus a separate label:
//   1. A label at the ornament's origin sits *inside* the 0.22-radius sphere, so
//      the near hemisphere depth-occludes it and the number is invisible.
//   2. drei's <Text> resolves glyphs through troika's unicode-font-resolver on
//      cdn.jsdelivr.net, so with no `font` prop the number silently fails to
//      render offline. A canvas texture has no such dependency.
function makeBallTexture(day: number, available: boolean): CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE

  const g = canvas.getContext('2d')
  if (!g) return null

  const grad = g.createRadialGradient(48, 44, 6, SIZE / 2, SIZE / 2, BALL_R)
  grad.addColorStop(0, available ? '#ff8a8a' : '#9aa3bd')
  grad.addColorStop(1, available ? '#a3121f' : '#4b5470')
  g.fillStyle = grad
  g.beginPath()
  g.arc(SIZE / 2, SIZE / 2, BALL_R, 0, Math.PI * 2)
  g.fill()

  g.textAlign = 'center'
  g.textBaseline = 'middle'

  if (available) {
    g.fillStyle = '#ffffff'
    g.font = 'bold 60px system-ui, sans-serif'
    g.fillText(String(day), SIZE / 2, 68)
  } else {
    drawLock(g)
    g.fillStyle = LOCK_TEXT
    g.font = `bold ${LOCK.numberSize}px system-ui, sans-serif`
    g.fillText(String(day), SIZE / 2, LOCK.numberY)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function Ornament({
  day,
  position,
  state,
  today = false,
  leaving = false,
  onClick,
}: OrnamentProps) {
  const spriteRef = useRef<Sprite | null>(null)
  const leaveStartRef = useRef<number | null>(null)
  const available = state === 'available'

  const texture = useMemo(
    () => (state === 'opened' ? null : makeBallTexture(day, available)),
    [day, available, state],
  )

  // We own this texture, so R3F will not dispose it for us.
  useEffect(() => () => texture?.dispose(), [texture])

  // Gentle pulse on available ornaments; today's pulses a little harder.
  // While `leaving`, the ball flies toward the tray instead.
  useFrame((frameState) => {
    const sprite = spriteRef.current
    if (!sprite) return

    if (leaving) {
      if (leaveStartRef.current === null) leaveStartRef.current = frameState.clock.elapsedTime
      const t = Math.min(
        1,
        (frameState.clock.elapsedTime - leaveStartRef.current) / (LEAVE_MS / 1000),
      )
      // Ease in, so it accelerates away rather than sliding linearly.
      const e = t * t
      sprite.position.set(position[0] + e * LEAVE_DX, position[1] + e * LEAVE_DY, position[2])
      sprite.scale.setScalar(BASE_SCALE * (1 - e))
      return
    }

    if (leaveStartRef.current !== null) {
      leaveStartRef.current = null
      sprite.position.set(position[0], position[1], position[2])
    }

    if (!available) return
    const depth = today ? 0.12 : 0.08
    const pulse = 1 + Math.sin(frameState.clock.elapsedTime * 2 + day * 0.5) * depth
    sprite.scale.setScalar(BASE_SCALE * pulse)
  })

  if (!texture) return null

  return (
    // A Sprite always faces the camera, so the number is readable from any angle
    // and still gets correctly occluded by the tree.
    <sprite
      ref={spriteRef}
      position={position}
      scale={[BASE_SCALE, BASE_SCALE, BASE_SCALE]}
      onClick={(e) => {
        e.stopPropagation()
        // Drag-safe: only treat as a click if the pointer moved less than ~6px
        if (e.delta > 6) return
        onClick(day)
      }}
    >
      <spriteMaterial map={texture} />
    </sprite>
  )
}