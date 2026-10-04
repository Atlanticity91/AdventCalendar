/**
 * Where each ornament hangs on the spiral.
 *
 * Split out of `scene/Scene.tsx` because it is pure arithmetic with no three.js
 * dependency, which makes the layout checkable — the count and the bounds both
 * matter, and neither is visible to the eye until the tree is rendered.
 *
 * Positions are derived from the day number and the calendar length alone, so an
 * ornament never moves when a *different* one is opened and disappears.
 */
export type Vec3 = [number, number, number]

/** Vertical span the ornaments occupy, in world units. */
export const SPIRAL_BOTTOM = 0.9
export const SPIRAL_HEIGHT = 3.1
/** Radius at the bottom of the tree, tapering to the top. */
export const SPIRAL_RADIUS = 1.55
export const SPIRAL_TIP_RADIUS = 0.35
/** Radians of turn between consecutive days. */
export const SPIRAL_STEP = 2.4

export function ornamentPosition(day: number, total: number): Vec3 {
  const t = total > 0 ? day / total : 0
  const y = SPIRAL_BOTTOM + t * SPIRAL_HEIGHT
  const r = SPIRAL_RADIUS * (1 - t) + SPIRAL_TIP_RADIUS
  const a = day * SPIRAL_STEP
  return [Math.cos(a) * r, y, Math.sin(a) * r]
}