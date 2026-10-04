import { useMemo, useState, type CSSProperties } from 'react'
import { Badge, BadgeDefs } from './Badge'
import { SoundPanel } from './SoundPanel'
import { currentDay, dayCount } from '../lib/date'
import { useMusicOn } from '../lib/audio'
import './Tray.css'

export type TrayTab = 'badges' | 'tickets' | 'sound'

const TABS: { key: TrayTab; name: string; icon: string }[] = [
  { key: 'badges', name: 'Badges', icon: '🎖' },
  { key: 'tickets', name: 'Tickets', icon: '🎟' },
  { key: 'sound', name: 'Sound', icon: '🎵' },
]

interface TrayProps {
  opened: ReadonlySet<number>
  /** `extended: true` runs to day 32 (1 January). */
  extended?: boolean
  /** Coupon id -> day it belongs to. Drives the Tickets view and badge markers. */
  tickets: ReadonlyMap<string, { day: number; label: string }>
  /** Coupon ids already redeemed. */
  used: ReadonlySet<string>
  /** Reopen a letter. No date check — the day is already acquired. */
  onSelectDay: (day: number) => void
}

export function Tray({ opened, extended = false, tickets, used, onSelectDay }: TrayProps) {
  const total = dayCount(extended)
  const [tab, setTab] = useState<TrayTab | null>(null)
  const musicOn = useMusicOn()

  // Tapping the active tab closes the tray.
  const toggle = (key: TrayTab) => setTab((prev) => (prev === key ? null : key))

  const active = TABS.find((t) => t.key === tab)
  const acquired = opened.size

  const acquiredTickets = [...tickets.values()].filter((t) => opened.has(t.day)).length
  const usedCount = [...tickets.keys()].filter((id) => used.has(id)).length

  // day -> coupon id, for the badge markers.
  const ticketByDay = useMemo(
    () => new Map([...tickets.entries()].map(([id, { day }]) => [day, id])),
    [tickets],
  )

  // Kept short so the title and this stay on one line at 320px — the header wraps
// only as a fallback.
const subtitle =
    tab === 'badges'
      ? `${acquired} / ${total} acquired`
      : tab === 'tickets'
        ? `${acquiredTickets} / ${tickets.size} acquired · ${usedCount} used`
        : musicOn
          ? 'Music on'
          : 'Music off'

  return (
    <>
      <BadgeDefs />

      {/* --pw drives both the panel width and the rail's offset, so the rail rides
          along the panel's left edge as it slides in. */}
      <div
        className="tray"
        data-open={tab !== null}
        style={{ '--pw': tab ? 'min(320px, 85vw)' : '0px' } as CSSProperties}
      >
        <aside className="tray-panel" aria-hidden={tab === null}>
          <header className="tray-head">
            <h2 className="tray-title">{active?.name ?? ''}</h2>
            <span className="tray-sub">{subtitle}</span>
          </header>

          <div className="tray-body">
            {tab === 'badges' && (
              <div className="badge-grid">
                {Array.from({ length: total }, (_, i) => i + 1).map((day) => (
                  <Badge
                    key={day}
                    day={day}
                    acquired={opened.has(day)}
                    hasTicket={ticketByDay.has(day)}
                    ticketUsed={used.has(ticketByDay.get(day) ?? '')}
                    onSelect={onSelectDay}
                  />
                ))}
              </div>
            )}

            {tab === 'tickets' &&
              (tickets.size === 0 ? (
                <p className="tray-empty">No coupons in this calendar yet.</p>
              ) : (
                [...tickets.entries()].map(([id, { day, label }]) => {
                  const isAcquired = opened.has(day)
                  const isUsed = used.has(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className="ticket-row"
                      data-state={isAcquired ? 'acquired' : 'locked'}
                      disabled={!isAcquired}
                      onClick={() => onSelectDay(day)}
                    >
                      <Badge
                        day={day}
                        acquired={isAcquired}
                        hasTicket
                        ticketUsed={isUsed}
                      />
                      <span>
                        <b>{isAcquired ? label : 'Locked ticket'}</b>
                        <small>
                          {isUsed
                            ? 'Used'
                            : isAcquired
                              ? 'Ready to use'
                              : `Open day ${day} to unlock`}
                        </small>
                      </span>
                    </button>
                  )
                })
              ))}

            {tab === 'sound' && <SoundPanel day={currentDay(new Date(), extended)} />}
          </div>
        </aside>

        <nav className="tray-rail" aria-label="Calendar drawer">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="tray-tab"
              data-active={tab === t.key}
              aria-label={`${t.name}${tab === t.key ? ', close' : ''}`}
              aria-expanded={tab === t.key}
              onClick={() => toggle(t.key)}
            >
              <span aria-hidden="true">{t.icon}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}