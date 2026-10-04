import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * AGENTS.md quality floor: respect `prefers-reduced-motion`. The CSS kill switch
 * in index.css only covers transitions — this covers three.js animation.
 *
 * No setState in the effect body: the initial value is read lazily at first
 * render, and the listener only fires on an actual change.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
