import type { CSSProperties } from 'react'

interface BadgeProps {
  day: number
  acquired: boolean
  /** Day carries a coupon that has not been redeemed yet. */
  hasTicket?: boolean
  /** The coupon was redeemed — show the red stamp instead of the ticket marker. */
  ticketUsed?: boolean
  /** Omitted for locked badges, which are disabled. */
  onSelect?: (day: number) => void
}

const R = 21

/** Shared radial gradient so every badge does not declare a duplicate-id <defs>.
 *  Colours match the demo's gold badge gradient (`#ffe9a0` -> `#c9902a`); radial
 *  rather than linear so the mark reads as a ball, like the tree ornaments. */
export function BadgeDefs() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute' } as CSSProperties}
    >
      <defs>
        <radialGradient id="badge-ball" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffeec2" />
          <stop offset="0.45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#c9902a" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export function Badge({
  day,
  acquired,
  hasTicket = false,
  ticketUsed = false,
  onSelect,
}: BadgeProps) {
  return (
    <button
      type="button"
      className="badge"
      data-acquired={acquired}
      // Acquired badges reopen their letter with no date check — already earned.
      disabled={!acquired}
      onClick={acquired && onSelect ? () => onSelect(day) : undefined}
      aria-label={acquired ? `Day ${day}, open letter` : `Day ${day}, locked`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <circle cx="24" cy="24" r={R} />
        {acquired ? (
          <text x="24" y="30" textAnchor="middle">
            {day}
          </text>
        ) : (
          <g className="lock">
            <rect x="17" y="24" width="14" height="11" rx="2" />
            <path d="M19.5 24v-4a4.5 4.5 0 019 0v4" fill="none" />
          </g>
        )}
      </svg>

      {/* Coupon markers sit outside the SVG so they can overhang the circle,
          matching the demo's `.tk1` / `.stamp`. */}
      {acquired && ticketUsed && (
        <i className="badge-stamp" aria-hidden="true">
          ✓
        </i>
      )}
      {acquired && !ticketUsed && hasTicket && (
        <i className="badge-ticket" aria-hidden="true">
          🎟
        </i>
      )}
    </button>
  )
}