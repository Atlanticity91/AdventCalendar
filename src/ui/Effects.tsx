import { useCallback, useEffect, useRef } from 'react'
import { playBells, playBoom, playPop, playWhistle, unlockAudio } from '../lib/audio'
import { currentDay } from '../lib/date'
import { mulberry32 } from '../lib/rng'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { EffectName } from '../lib/effects'
import './Effects.css'

interface EffectsProps {
  /** Fired in order. Empty means nothing happens. */
  effects: EffectName[]
  /** Bump to replay, e.g. every time the letter is opened. */
  runId: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface Rocket {
  x: number
  y: number
  targetY: number
}

interface Confetto {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  r: number
  vr: number
  color: string
  life: number
}

/** Rockets per firework display, and the gap between them. */
const ROCKETS = 9
const ROCKET_GAP = 380
const ROCKET_RISE = 12
const ROCKET_W = 4
const SPARK_SIZE = 3.5
/** Lower keeps particle trails visible instead of erasing them within a few frames. */
const FADE = 0.2
const CONFETTI_COLORS = ['#f2c14e', '#ff5c6c', '#5ce1a0', '#5cb8ff', '#ffffff']

/** Delay between consecutive entries of the `effects` array. */
const EFFECT_GAP = 450

export function Effects({ effects, runId }: EffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparks = useRef<Spark[]>([])
  const rockets = useRef<Rocket[]>([])
  const confetti = useRef<Confetto[]>([])
  const timers = useRef<number[]>([])
  const rand = useRef(mulberry32(1))
  const reduced = usePrefersReducedMotion()

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t)
    timers.current = []
  }, [])

  const burst = useCallback((x: number, y: number) => {
    playBoom()
    const hue = rand.current() * 360
    const count = reduced ? 30 : 90
    for (let i = 0; i < count; i++) {
      const angle = rand.current() * Math.PI * 2
      const speed = 1 + rand.current() * 5
      sparks.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: `hsl(${hue + rand.current() * 50}, 100%, 65%)`,
      })
    }
  }, [reduced])

  const launchRocket = useCallback(() => {
    playWhistle()
    rockets.current.push({
      x: window.innerWidth * (0.15 + rand.current() * 0.7),
      y: window.innerHeight,
      targetY: window.innerHeight * (0.15 + rand.current() * 0.3),
    })
  }, [])

  const dropConfetti = useCallback(() => {
    playPop()
    const count = reduced ? 40 : 180
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1
      confetti.current.push({
        x: side > 0 ? 0 : window.innerWidth,
        y: window.innerHeight,
        vx: side * (3 + rand.current() * 9),
        vy: -(9 + rand.current() * 13),
        w: 5 + rand.current() * 6,
        h: 8 + rand.current() * 8,
        r: rand.current() * 6,
        vr: (rand.current() - 0.5) * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        life: 1,
      })
    }
  }, [reduced])

  // Fire the requested effects, one after another.
  useEffect(() => {
    clearTimers()
    if (effects.length === 0) return

    // A letter opening is a user gesture, so this is where Web Audio unlocks —
    // and where music is rescued if the autoplay attempt was refused earlier.
    unlockAudio(currentDay(new Date()))
    // Re-seed per run so a replay is not pixel-identical to the last one.
    rand.current = mulberry32(runId + 1)

    effects.forEach((name, i) => {
      timers.current.push(
        window.setTimeout(() => {
          switch (name) {
            case 'firework': {
              const rocketsToFire = reduced ? 3 : ROCKETS
              for (let r = 0; r < rocketsToFire; r++) {
                timers.current.push(
                  window.setTimeout(
                    launchRocket,
                    r * ROCKET_GAP + rand.current() * 200,
                  ),
                )
              }
              break
            }
            case 'confetti':
              dropConfetti()
              break
            case 'bell':
              playBells()
              break
          }
        }, i * EFFECT_GAP),
      )
    })

    return clearTimers
  }, [burst, clearTimers, dropConfetti, effects, launchRocket, reduced, runId])

  // The canvas must match the viewport, including on resize and on phones with a
  // device pixel ratio, or the trails are soft and the edges are wrong.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Animation loop. Particles live in refs, never state — this runs every frame.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    let last = 0

    const frame = (now: number) => {
      raf = window.requestAnimationFrame(frame)

      // Wall-clock delta, expressed in 60fps "frames".
      //
      // This must be time-based, not per-frame. The 3D scene runs alongside this
      // canvas, so on a slower engine the frame rate drops; with per-frame
      // integration the rockets then crawl (a 0.8s climb becomes 6s at 10fps) and
      // the firework appears to never happen, while confetti — which is full-screen
      // the instant it spawns — looks like the only thing that works.
      //
      // Capped so a long stall (tab in the background) cannot teleport particles.
      const dt = last === 0 ? 1 : Math.min((now - last) / (1000 / 60), 4)
      last = now

      const w = window.innerWidth
      const h = window.innerHeight

      if (!sparks.current.length && !rockets.current.length && !confetti.current.length) {
        ctx.clearRect(0, 0, w, h)
        return
      }

      // Fade the previous frame instead of clearing, which leaves trails.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${FADE})`
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'lighter'
      rockets.current = rockets.current.filter((r) => {
        r.y -= ROCKET_RISE * dt
        ctx.fillStyle = '#fff'
        // A short fading trail, so the ~1s climb is actually visible rather than
        // a 4px dot that reads as nothing on a dark sky.
        ctx.globalAlpha = 1
        ctx.fillRect(r.x, r.y, ROCKET_W, 10)
        ctx.globalAlpha = 0.45
        ctx.fillRect(r.x, r.y + 10, ROCKET_W, 8)
        ctx.globalAlpha = 0.2
        ctx.fillRect(r.x, r.y + 18, ROCKET_W, 6)
        ctx.globalAlpha = 1
        if (r.y <= r.targetY) {
          burst(r.x, r.y)
          return false
        }
        return true
      })
      sparks.current = sparks.current.filter((p) => {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.05 * dt
        // Drag is a per-frame multiplier, so scale it by dt to stay frame-rate
        // independent (pow(x, dt) == x**dt).
        p.vx *= Math.pow(0.985, dt)
        p.life -= 0.011 * dt
        if (p.life <= 0) return false
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x - SPARK_SIZE / 2, p.y - SPARK_SIZE / 2, SPARK_SIZE, SPARK_SIZE)
        return true
      })

      ctx.globalCompositeOperation = 'source-over'
      confetti.current = confetti.current.filter((p) => {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.28 * dt
        p.vx *= Math.pow(0.97, dt)
        p.r += p.vr * dt
        p.life -= 0.004 * dt
        if (p.life <= 0 || p.y > h + 30) return false
        ctx.globalAlpha = Math.min(1, p.life * 2)
        ctx.fillStyle = p.color
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        // Squashing on the Y axis fakes a flipping rectangle.
        ctx.scale(1, Math.cos(p.r * 2))
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
        return true
      })

      ctx.globalAlpha = 1
    }

    raf = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(raf)
    // `burst` reads `reduced`, so it is a dependency rather than a stale closure.
  }, [burst])

  return <canvas ref={canvasRef} className="effects-canvas" aria-hidden="true" />
}
