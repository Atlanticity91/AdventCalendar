/**
 * Small deterministic PRNG (mulberry32).
 *
 * Used for scattering particles instead of `Math.random()`, which the React
 * compiler's purity rules reject during render. A seeded generator is also
 * strictly better here: the snow and sparkle layout stays identical across
 * re-renders and remounts, so the scene no longer reshuffles under StrictMode.
 *
 * This is NOT the cancelled per-day `hash()`. Those rules decide *what happens
 * today* (see `sceneEvents()` in lib/date.ts); this just spreads geometry out.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
