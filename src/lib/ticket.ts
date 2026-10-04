/**
 * Tear-off coupon geometry and thresholds.
 *
 * Lives apart from `ui/Ticket.tsx` because the UI can't be imported from Node
 * (it pulls in React and a `.css` import), yet these values are worth testing.
 * Importing them from here means `scripts/verify.mts` checks the real constants
 * rather than a copy that could drift.
 *
 * The demo (`reference/demo.html` lines 248-253) tears sideways; this tears
 * **downwards**, so the stub sits below the body and the drag axis is Y.
 */

/** Drag distance, in px, that redeems the coupon. Strictly greater than. */
export const TEAR_AT = 90

/** The stub will not be dragged further than this. */
export const MAX_DRAG = 200

/** Degrees of rotation per px dragged, so it reads as tearing not sliding. */
export const DRAG_ROTATION = 0.06

/** Where the stub falls once torn. */
export const FLY_OUT = 260
export const FLY_ROTATION = 15

/** Live drag offset for a pointer `dy` px from where the drag started. */
export function dragOffset(dy: number): number {
  return Math.max(0, Math.min(MAX_DRAG, dy))
}

/** Past the threshold the coupon redeems; otherwise it snaps back. */
export function tears(drag: number): boolean {
  return dragOffset(drag) > TEAR_AT
}
