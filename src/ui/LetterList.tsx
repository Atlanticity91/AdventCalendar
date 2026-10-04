import { Letter } from './Letter'
import { canOpen, dayCount, opensOn } from '../lib/date'
import type { LetterContent } from '../lib/letters-types'
import './LetterList.css'

interface LetterListProps {
  days: ReadonlyMap<number, LetterContent>
  name: string
  year: number
  dev: boolean
  extended: boolean
  opened: ReadonlySet<number>
  used: ReadonlySet<string>
  onUseTicket: (id: string) => void
  /**
   * Which day is open, and a way to change it.
   *
   * Owned by App rather than kept here, so there is a single source of truth: the
   * letter's own `effects` are resolved from this same state, and a list that kept
   * its own copy left App blind to it — so text mode played no fireworks at all.
   */
  openDay: number | null
  onOpenDay: (day: number | null) => void
}

/**
 * The accessible fallback for anyone who cannot use the 3D view — no WebGL, or
 * the scene failed to mount. Same data, same date lock, same coupons; only the
 * presentation differs. AGENTS.md calls for this under the quality floor.
 */
export function LetterList({
  days,
  name,
  year,
  dev,
  extended,
  opened,
  used,
  onUseTicket,
  openDay,
  onOpenDay,
}: LetterListProps) {
  const now = new Date()
  const total = dayCount(extended)

  const content = openDay === null ? null : days.get(openDay)
  const acquired = [...opened].length

  return (
    <div className="list-view">
      <header className="list-head">
        <h1>{name ? `${name}'s advent calendar` : 'Advent calendar'}</h1>
        <p>
          {acquired} of {total} days opened · {year}
        </p>
      </header>

      {openDay !== null && content && (
        <div className="list-letter">
          <button type="button" className="list-back" onClick={() => onOpenDay(null)}>
            ← All days
          </button>
          <Letter
            day={openDay}
            content={content}
            ticketUsed={!!content.ticket && used.has(content.ticket.id)}
            onUseTicket={onUseTicket}
            onClose={() => onOpenDay(null)}
          />
        </div>
      )}

      <ol className="list-days">
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const letter = days.get(day)
          const isOpen = canOpen(day, now, dev, year, extended) || opened.has(day)
          const done = opened.has(day)
          const ticketState = letter?.ticket
            ? used.has(letter.ticket.id)
              ? ' · coupon used'
              : ' · coupon'
            : ''

          return (
            <li key={day}>
              <button
                type="button"
                className="list-row"
                data-open={isOpen}
                disabled={!isOpen || !letter}
                onClick={() => letter && onOpenDay(day)}
                aria-label={
                  isOpen && letter
                    ? `Day ${day}: ${letter.title}`
                    : `Day ${day}: ${opensOn(day)}`
                }
              >
                <span className="list-num">{day}</span>
                <span className="list-body">
                  <b>{isOpen ? (letter?.title ?? 'Not written yet') : 'Locked'}</b>
                  {isOpen && letter && (
                    <small>{letter.text.split('\n')[0].slice(0, 90)}</small>
                  )}
                  {!isOpen && <small>{opensOn(day)}</small>}
                </span>
                {isOpen && <span className="list-flags">{done ? '✓' : ''}{ticketState}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
