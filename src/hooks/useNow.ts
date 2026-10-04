import { useEffect, useState } from 'react'

/**
 * A Date that ticks every second.
 *
 * There is deliberately no `?date=` override (see PROGRESS.md Hard rules), so this
 * always reads the real clock. To see the countdown, use the "Preview countdown"
 * button on the countdown screen — that is the only way to reach it before December.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)

    // Browsers throttle timers in a background tab to about once a minute, so
    // coming back can leave the display stale by that much. Re-sync on focus —
    // an event callback, so this is not a synchronous setState in the effect body.
    const resync = () => setNow(new Date())
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [intervalMs])

  return now
}
