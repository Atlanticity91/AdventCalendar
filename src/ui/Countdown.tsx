import { useEffect, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import './Countdown.css'

interface CountdownProps {
  /**
   * Epoch ms of 1 December (local midnight), or null while it is still unknown —
   * which happens before the letter JSON (the source of the year) has loaded.
   * Shows an indeterminate clock rather than counting down to the wrong year.
   */
  target: number | null
  /** `?dev=1` — reveals the "Preview countdown" button. */
  dev?: boolean
  /** Fire once when the countdown reaches zero. */
  onReveal: () => void
}

const FADE_MS = 1500
const PREVIEW_MS = 10_000

const pad = (n: number) => String(n).padStart(2, '0')

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor(s / 3600) % 24,
    m: Math.floor(s / 60) % 60,
    s: s % 60,
  }
}

export function Countdown({ target, dev = false, onReveal }: CountdownProps) {
  const now = useNow()
  const reduced = usePrefersReducedMotion()

  // "Preview countdown" — the only way to see this screen before December, now
  // that there is no `?date=` override.
  const [previewUntil, setPreviewUntil] = useState<number | null>(null)
  const effectiveTarget = previewUntil ?? target

  const known = effectiveTarget !== null
  const left = known ? effectiveTarget - now.getTime() : 0
  // Derived, not set from an effect: at or past the target the screen fades out.
  const reached = known && left <= 0

  // Reached zero (or the end of the preview): start the hand-over to the scene.
  //
  // This MUST key on the boolean `reached`, never on the live `left`. `left`
  // changes every second, so depending on it re-ran this effect every second and
  // each cleanup cleared the pending reveal timeout before it could fire — the
  // preview ended with the screen stuck at opacity 0 over its own background.
  useEffect(() => {
    if (!reached) return
    const id = window.setTimeout(onReveal, reduced ? 0 : FADE_MS)
    return () => window.clearTimeout(id)
  }, [reached, onReveal, reduced])

  const { d, h, m, s } = split(left)

  return (
    <div
      className="countdown"
      // Kept mounted and faded out so the reveal happens over the tree.
      data-visible={!reached}
      aria-hidden={reached}
    >
      <div className="countdown-star" aria-hidden="true">
        ⭐
      </div>

      <p className="countdown-label">Advent starts in</p>

      <div className="countdown-clock" role="timer" aria-live="off">
        {known ? (
          <>
            {d}d {pad(h)}h {pad(m)}m {pad(s)}s
          </>
        ) : (
          '···'
        )}
      </div>

      <p className="countdown-target">
        {known
          ? `Target: ${new Date(effectiveTarget).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : 'Loading…'}
      </p>

      {/* No year rollover: at 1 December this hits zero and the countdown is gone
          for good, leaving the calendar open through January. Preview is a dev-only
          affordance because there is no `?date=` override to fake the date with. */}
      {dev && (
        <div className="countdown-actions">
          <button
            type="button"
            className="countdown-btn"
            onClick={() => setPreviewUntil(now.getTime() + PREVIEW_MS)}
          >
            Preview countdown ⏳
          </button>
        </div>
      )}
    </div>
  )
}
