import { useEffect, useRef } from 'react'
import type { LetterContent } from '../lib/letters-types'
import { Ticket } from './Ticket'
import './Letter.css'

interface LetterProps {
  day: number
  content: LetterContent
  /** Has this letter's coupon already been redeemed? */
  ticketUsed?: boolean
  onUseTicket?: (id: string) => void
  onClose: () => void
}

export function Letter({ day, content, ticketUsed = false, onUseTicket, onClose }: LetterProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape closes, and focus lands on the close button so keyboard users
  // are inside the dialog straight away.
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="letter-backdrop"
      // Clicking the backdrop closes; clicks inside the card must not bubble here.
      onClick={onClose}
    >
      <div
        className="letter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`letter-title-${day}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="letter-day">Day {day}</span>

        <h2 id={`letter-title-${day}`} className="letter-title">
          {content.title}
        </h2>

        <div className="letter-text">
          {content.image && (
            <img className="letter-image" src={content.image} alt="" loading="lazy" />
          )}

          {content.text.split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>

        {/* The ticket stays in the letter after use — greyed, with a USED stamp —
            so the coupon can be reread. */}
        {content.ticket && onUseTicket && (
          <Ticket
            ticket={content.ticket}
            used={ticketUsed}
            onUse={onUseTicket}
          />
        )}

        <button
          ref={closeRef}
          type="button"
          className="letter-close"
          aria-label={`Close day ${day}`}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  )
}