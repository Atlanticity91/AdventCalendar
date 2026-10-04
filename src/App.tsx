import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Letter } from './ui/Letter'
import { Effects } from './ui/Effects'
import { Tray } from './ui/Tray'
import { Countdown } from './ui/Countdown'
import { LetterList } from './ui/LetterList'
import { SceneBoundary } from './ui/SceneBoundary'
import { MusicPrompt } from './ui/MusicPrompt'
import { TOAST_DURATION, Toast, type ToastState } from './ui/Toast'
import { useQueryParam, useUser } from './hooks/QueryURLParam'
import { useLetters } from './hooks/useLetters'
import { useAudioTheme } from './hooks/useAudioTheme'
import { useNow } from './hooks/useNow'
import {
  DEFAULT_ADVENT_YEAR,
  canOpen,
  currentDay,
  dayCount,
  decemberStart,
  opensOn,
  revealEffects,
  secondsUntilDecember,
} from './lib/date'
import { hasWebGL } from './lib/webgl'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { BELL_DURATION_MS, holdMusicFor, setAudioTheme, tryAutostart, unlockAudio } from './lib/audio'
import { markOpened, markUsed, useOpened, useUsed } from './lib/store'
import type { LetterContent } from './lib/letters-types'
import type { EffectName } from './lib/effects'
import './index.css'

// The 3D scene is ~1.1 MB, so it is a separate chunk. Loading it up front while
// someone stares at a countdown wastes their data and delays the countdown itself.
const Scene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.Scene })))

// How long the ball takes to fly to the tray before the letter opens. Kept in
// step with LEAVE_MS in scene/Ornament.tsx.
const LEAVE_MS = 380

const MISSING: LetterContent = {
  title: 'Not written yet',
  text: 'There is no letter for this day yet.',
}

const NO_EFFECTS: EffectName[] = []

function App() {
  const user = useUser()
  // ?dev=1 unlocks a couple of ornaments so the calendar can be clicked through
  // outside December. Strictly "1" — see DEV_UNLOCKED_DAYS in lib/date.ts.
  const [devParam] = useQueryParam('dev')
  const dev = devParam === '1'
  const reducedMotion = usePrefersReducedMotion()

  const { status, letters } = useLetters(user)
  // Advent year from the letter JSON. Everything date-related keys off this, so
  // the countdown and the lock agree and the calendar stays open past December.
  const year = letters?.year ?? DEFAULT_ADVENT_YEAR
  // `extended: true` runs to day 32 (1 January). Drives ornament count, tray,
  // list and the date ceiling.
  const extended = letters?.extended ?? false
  const total = dayCount(extended)
  // Persisted per user under `advent:<user>`, so progress survives a reload.
  const opened = useOpened(user)
  const usedTickets = useUsed(user)

  // Resolved from the letter file's `audioTheme` flag. Always returns a theme,
  // falling back to `classic` if the id does not resolve.
  const audioTheme = useAudioTheme(letters?.audioTheme)

  useEffect(() => {
    setAudioTheme(audioTheme)
  }, [audioTheme])

  // Countdown to 1 December of the configured year. There is no skip and no year
  // rollover: at 1 December it reaches zero and is gone permanently, leaving the
  // calendar fully open — including through January of the following year.
  const [revealed, setRevealed] = useState(false)
  const now = useNow(revealed ? 60_000 : 1000)

  const secondsToStart = secondsUntilDecember(year, now)
  const showCountdown = !revealed && secondsToStart > 0

  // Warm the scene chunk in the last minute so the reveal is not a stall.
  useEffect(() => {
    if (!showCountdown || secondsToStart > 60) return
    void import('./scene/Scene')
  }, [showCountdown, secondsToStart])

  // Music starts by itself when the tree appears, not before: the countdown is a
  // silent waiting screen, and starting audio behind it would be pointless.
  //
  // Deferred by a frame on purpose. Creating an AudioContext during commit is
  // work the browser may refuse anyway, and emitting the music state straight
  // from the effect body would re-render subscribers mid-commit.
  const musicDay = currentDay(new Date(), extended)
  useEffect(() => {
    if (showCountdown) return
    const id = window.setTimeout(() => tryAutostart(musicDay), 0)
    return () => window.clearTimeout(id)
  }, [showCountdown, musicDay])

  const [openDay, setOpenDay] = useState<number | null>(null)
  // Day currently flying off to the tray, and the day that has actually been
  // opened. They are separate so the ball can animate before it disappears.
  const [leavingDay, setLeavingDay] = useState<number | null>(null)
  const [effectRun, setEffectRun] = useState(0)
  // The reveal's own run id. Null until it fires, and never changes again after —
  // the countdown reveal is a one-shot, not a mode the calendar stays in.
  const [revealRun, setRevealRun] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | null>(null)

  // Text-only mode: chosen by detecting whether the 3D view can actually be used,
  // per the user's instruction. `?view=list` / `?view=3d` force it either way as
  // an escape hatch, but there is no visible toggle.
  const [viewParam] = useQueryParam('view')
  const [webgl] = useState(() => hasWebGL())
  const [sceneFailed, setSceneFailed] = useState(false)
  const listMode =
    viewParam === 'list' || (viewParam !== '3d' && (!webgl || sceneFailed))

  const showToast = useCallback((message: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message }))
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null
      setToast(null)
    }, TOAST_DURATION)
  }, [])

  // Clear a pending toast if the app unmounts
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  // Fly the ball to the tray first, then open the letter — otherwise the overlay
  // covers the screen and the animation is never seen.
  const openWithFlight = useCallback(
    (day: number) => {
      markOpened(user, day)
      if (reducedMotion || listMode) {
        setOpenDay(day)
        setEffectRun((n) => n + 1)
        return
      }
      setLeavingDay(day)
      window.setTimeout(() => {
        setLeavingDay(null)
        setOpenDay(day)
        setEffectRun((n) => n + 1)
      }, LEAVE_MS)
    },
    [listMode, reducedMotion, user],
  )

  const handleOrnamentClick = useCallback(
    (day: number) => {
      if (!canOpen(day, new Date(), dev, year, extended)) {
        showToast(opensOn(day))
        return
      }
      openWithFlight(day)
    },
    [dev, extended, openWithFlight, showToast, year],
  )

  const closeLetter = useCallback(() => setOpenDay(null), [])

  // Tray badges reopen an already-acquired letter, so no date check here.
  // Text mode opens a letter through the same state as the 3D view, so the letter's
// own effects resolve from it. Bumping the run id is what actually fires them —
// without it the list showed letters perfectly but played no fireworks at all.
const handleListOpenDay = useCallback((day: number | null) => {
    setOpenDay(day)
    if (day !== null) setEffectRun((n) => n + 1)
  }, [])

  const openLetter = useCallback(
    (day: number) => {
      setOpenDay(day)
      setEffectRun((n) => n + 1)
    },
    [],
  )

  // Coupon id -> day + label, for the Tickets tab and the badge markers.
  // Declared above the early returns below — hooks must run unconditionally.
  const tickets = useMemo(() => {
    const map = new Map<string, { day: number; label: string }>()
    if (!letters) return map
    for (const [day, letter] of letters.days) {
      if (letter.ticket) map.set(letter.ticket.id, { day, label: letter.ticket.label })
    }
    return map
  }, [letters])

  const handleUseTicket = useCallback(
    (id: string) => {
      markUsed(user, id)
      // A tear is a user gesture, so this is also the right moment to let the
      // browser start the AudioContext — and to rescue the music if the autoplay
      // attempt was refused.
      unlockAudio(currentDay(new Date(), extended))
    },
    [extended, user],
  )

  // The reveal reuses the day-25 celebration rather than reimplementing it.
  const handleReveal = useCallback(() => {
    // Claim the bus before the bell rings. Music also starts on this same tick —
    // the scene mounts as the countdown goes — and a melody landing on top of a
    // six-note arpeggio is a clash, not a celebration. The hold is derived from the
    // bell's own length, so it stays correct if the notes ever change.
    holdMusicFor(BELL_DURATION_MS)
    setRevealed(true)
    setRevealRun(1)
    setEffectRun((n) => n + 1)
  }, [])

  // The countdown gates everything else, and must not mount the Scene: this screen
  // is the landing page for weeks, so eagerly pulling the ~930 kB three.js chunk
  // behind it would be wrong. The chunk is warmed in the last minute instead.
  //
  // The advent year lives in the letter JSON, so while that is still in flight the
  // clock is indeterminate — deliberately, because showing a countdown to the
  // *current* year before the real one arrives would be visibly wrong.
  if (status === 'loading') {
    return <Countdown target={null} dev={dev} onReveal={handleReveal} />
  }
  if (status === 'error' || !letters) {
    return <div className="boot boot-error">Could not load letters.</div>
  }

  if (showCountdown) {
    return (
      <Countdown
        target={decemberStart(year).getTime()}
        dev={dev}
        onReveal={handleReveal}
      />
    )
  }

  const content = openDay === null ? null : (letters.days.get(openDay) ?? MISSING)

  return (
    <>
      {listMode ? (
        // No WebGL, or the scene threw: same data and same lock, no 3D.
        <LetterList
          days={letters.days}
          name={letters.name}
          year={year}
          dev={dev}
          extended={extended}
          opened={opened}
          used={usedTickets}
          onUseTicket={handleUseTicket}
          openDay={openDay}
          onOpenDay={handleListOpenDay}
        />
      ) : (
        <>
          {/* Already preloaded in the last minute of the countdown, so this
              resolves immediately; fallback null so a slow chunk shows nothing
              rather than flashing. */}
          <Suspense fallback={null}>
            <SceneBoundary onFailure={() => setSceneFailed(true)}>
              <Scene
                opened={opened}
                dev={dev}
                year={year}
                extended={extended}
                leavingDay={leavingDay}
                letterOpen={openDay !== null}
                onOrnamentClick={handleOrnamentClick}
              />
            </SceneBoundary>
          </Suspense>

          <div
            style={{
              position: 'fixed',
              top: 12,
              left: 14,
              zIndex: 5,
              color: 'var(--snow)',
              font: '600 14px var(--sans)',
              pointerEvents: 'none',
            }}
          >
            {letters.name && <>{letters.name} · </>}day {openDay ?? '—'} of {total}
            {dev && <span style={{ color: 'var(--gold)' }}> · dev</span>}
            {listMode && <span style={{ color: 'var(--gold)' }}> · text view</span>}
          </div>
        </>
      )}

      {/* The letter overlay is shared: in text mode the list renders its own,
          so this is skipped there to avoid two copies of the same day. */}
      {!listMode && openDay !== null && content && (
        <Letter
          day={openDay}
          content={content}
          ticketUsed={!!content.ticket && usedTickets.has(content.ticket.id)}
          onUseTicket={handleUseTicket}
          onClose={closeLetter}
        />
      )}

      <Tray
        opened={opened}
        extended={extended}
        tickets={tickets}
        used={usedTickets}
        onSelectDay={openLetter}
      />

      {/* Appears only when the browser refused to autoplay, and hides itself as
          soon as music is really playing. */}
      <MusicPrompt day={musicDay} />

      {/* The letter's own effects, and nothing else. This used to be
          `revealed ? revealEffects : content.effects` — but `revealed` stays true
          for the rest of the calendar's life (that is what keeps the countdown
          gone), so every letter after 1 December showed the reveal's bell and
          none of its own fireworks or confetti. The reveal now has its own run
          and its own instance, so it cannot stand in for a letter. */}
      <Effects effects={content?.effects ?? NO_EFFECTS} runId={effectRun} />

      {/* The countdown reveal, fired once on its own run id and then silent for
          the rest of the calendar. */}
      {revealRun !== null && <Effects effects={revealEffects} runId={revealRun} />}

      <Toast toast={toast} />
    </>
  )
}

export default App