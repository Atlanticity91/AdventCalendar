// Date lock. There is no `?date=` override (see PROGRESS.md "Hard rules"), so this
// reads the real system clock.
import type { EffectName } from './effects'

//
// Everything about the lock lives here on purpose: until December every ornament is
// locked and the letter overlay is unreachable, so this one function is the only
// thing that needs temporarily patching to test the overlay.
export const DECEMBER = 11
export const JANUARY = 0

/**
 * A standard calendar is 1–25 December — it always reaches Christmas Day, which is
 * the whole point of one. An `extended` one runs the whole month plus 1 January of
 * the following year, written as **day 32** in the JSON so the day keys stay a
 * simple 1..N sequence.
 */
export const STANDARD_DAYS = 25
export const DAYS_IN_DECEMBER = 31
export const EXTENDED_DAYS = DAYS_IN_DECEMBER + 1

export function dayCount(extended: boolean): number {
  return extended ? EXTENDED_DAYS : STANDARD_DAYS
}

export function isValidDay(day: number, total: number = STANDARD_DAYS): boolean {
  return Number.isInteger(day) && day >= 1 && day <= total
}

/**
 * Advent year, read from the letter JSON's `year` field.
 *
 * Storing it matters: the lock is a one-way ratchet keyed to this year, so once
 * December has arrived the calendar stays fully open — including in January of
 * year + 1, which the old `getMonth() === 11` check would have locked again.
 */
export const DEFAULT_ADVENT_YEAR = new Date().getFullYear()

/** Days forced open when `?dev=1` is present, so the calendar can be exercised
 *  outside December. Testing affordance only — it exposes nothing that the date
 *  lock was hiding, since the letters are already in the bundle either way. */
export const DEV_UNLOCKED_DAYS: readonly number[] = [1, 2]

/**
 * Day `day` unlocks at local midnight on the matching date, and never re-locks.
 *
 * Days 1–31 are December of `year`. Day 32 — the `extended` bonus day — is
 * 1 January of the *following* year.
 */
export function unlockTime(day: number, year: number): number {
  if (day <= DAYS_IN_DECEMBER) return new Date(year, DECEMBER, day).getTime()
  return new Date(year + 1, JANUARY, day - DAYS_IN_DECEMBER).getTime()
}

export function canOpen(
  day: number,
  now: Date = new Date(),
  dev = false,
  year: number = DEFAULT_ADVENT_YEAR,
  extended = false,
): boolean {
  if (!isValidDay(day, dayCount(extended))) return false
  if (dev && DEV_UNLOCKED_DAYS.includes(day)) return true
  return now.getTime() >= unlockTime(day, year)
}

/** "Opens on Dec 12" — shown in the toast when a locked ornament is tapped. */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * Human label for when a day unlocks, e.g. "Opens on Dec 12".
 *
 * Days 25–31 are still December, but day 32 is 1 January of the following year,
 * so it must not be printed as "Dec 32" — a date that does not exist.
 */
export function opensOn(day: number): string {
  if (day <= DAYS_IN_DECEMBER) return `Opens on ${MONTHS[DECEMBER]} ${day}`
  const janDay = day - DAYS_IN_DECEMBER
  return `Opens on ${MONTHS[JANUARY]} ${janDay}, next year`
}

/**
 * Day number reached so far, or 0 before it starts. Drives the "today's ornament"
 * glow and the music's day seed.
 *
 * In December this is the date. On 1 January it is day 32, but only when the
 * calendar is `extended` — otherwise the extra day does not exist.
 */
export function currentDay(now: Date = new Date(), extended = false): number {
  if (now.getMonth() === DECEMBER) return Math.min(now.getDate(), DAYS_IN_DECEMBER)
  if (extended && now.getMonth() === JANUARY && now.getDate() === 1) return EXTENDED_DAYS
  return 0
}

export const MAX_FOOTPRINTS = 16

/** Local midnight on 1 December of the advent year. */
export function decemberStart(year: number): Date {
  return new Date(year, DECEMBER, 1, 0, 0, 0, 0)
}

/**
 * Seconds until 1 December of the advent year.
 *
 * No year rollover: once December has arrived this is 0 and stays 0, so the
 * countdown is gone for good and the calendar stays open — including in January
 * of the following year.
 */
export function secondsUntilDecember(year: number, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((decemberStart(year).getTime() - now.getTime()) / 1000))
}

/**
 * The celebration the countdown reveal fires. Bells only — the firework and
 * confetti were dropped because they fire the instant the countdown disappears,
 * underneath a screen the user is trying to read for the first time.
 */
export const revealEffects: EffectName[] = ['bell']


export interface SceneEvents {
  heavySnow: boolean
  snowman: boolean
  /** How many footprints are visible, out of MAX_FOOTPRINTS. */
  footprints: number
}

/**
 * Which per-day surprises happen today. Plain day-of-month arithmetic — the
 * seeded `hash()` approach is cancelled (see PROGRESS.md Hard rules), and
 * `Math.random()` is banned for exactly this kind of decision.
 *
 * Day-of-month rather than `currentDay()` so the scene is decorated all year and
 * not blank outside December. During December the two coincide, so it lines up
 * with the advent day.
 *
 * The thresholds are placeholders, not meaningful — tune freely.
 */
export function sceneEvents(now: Date = new Date()): SceneEvents {
  const d = now.getDate()
  return {
    heavySnow: d % 3 === 0,
    snowman: d % 4 === 3,
    // Zero on the 9th, 18th and 27th — the trail is simply absent those days.
    footprints: Math.min(MAX_FOOTPRINTS, (d % 9) * 2),
  }
}