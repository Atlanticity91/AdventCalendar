import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react'
import type { Ticket as TicketData } from '../lib/letters-types'
import { playTear } from '../lib/audio'
import {
  DRAG_ROTATION,
  FLY_OUT,
  FLY_ROTATION,
  TEAR_AT,
  dragOffset,
} from '../lib/ticket'
import './Ticket.css'

interface TicketProps {
  ticket: TicketData
  /** Persisted as used in another tab, or by re-opening a used letter. */
  used: boolean
  onUse: (id: string) => void
}

/** Haptic tick where supported; harmless no-op elsewhere. */
function buzz(ms: number) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms)
  }
}

export function Ticket({ ticket, used, onUse }: TicketProps) {
  const stubRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<number | null>(null)
  const dragRef = useRef(0)
  // Torn locally, before/alongside the parent's `used` catching up.
  const [torn, setTorn] = useState(false)

  const isUsed = used || torn

  const tear = () => {
    buzz(30)
    playTear()
    onUse(ticket.id)
    setTorn(true)
  }

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isUsed) return
    // Tears downwards: the stub sits below the body, so the drag axis is Y.
    originRef.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.style.transition = 'none'
  }

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (originRef.current === null) return
    const dy = dragOffset(e.clientY - originRef.current)
    dragRef.current = dy
    // Rotate slightly as it pulls, so it reads as tearing rather than sliding.
    e.currentTarget.style.transform = `translateY(${dy}px) rotate(${dy * DRAG_ROTATION}deg)`
  }

  const handleUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (originRef.current === null) return
    originRef.current = null
    e.currentTarget.style.transition = 'transform .35s ease'

    if (dragRef.current > TEAR_AT) {
      tear()
      // Stub falls away; the body keeps the USED stamp so the letter stays readable.
      e.currentTarget.style.transform = `translateY(${FLY_OUT}px) rotate(${FLY_ROTATION}deg)`
    } else {
      e.currentTarget.style.transform = ''
    }
    dragRef.current = 0
  }

  // Drag is unusable by keyboard, so offer the same action as a key.
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isUsed) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tear()
      const stub = stubRef.current
      if (stub) {
        stub.style.transition = 'transform .35s ease'
        stub.style.transform = `translateY(${FLY_OUT}px) rotate(${FLY_ROTATION}deg)`
      }
    }
  }

  return (
    <div className="ticket" data-used={isUsed}>
      <div className="ticket-main">
        <small>Admit one</small>
        <b>{ticket.label}</b>
        {ticket.note && <span>{ticket.note}</span>}
        <em>Used</em>
      </div>

      <div
        ref={stubRef}
        className="ticket-stub"
        role="button"
        tabIndex={isUsed ? -1 : 0}
        aria-disabled={isUsed}
        aria-label={
          isUsed
            ? `${ticket.label} coupon, already used`
            : `Tear off the ${ticket.label} coupon. Drag down, or press Enter.`
        }
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onKeyDown={handleKey}
      >
        <span>{isUsed ? 'Used' : 'tear here ↓'}</span>
      </div>
    </div>
  )
}
