import { useEffect, useState } from 'react'
import { isValidDay, DEFAULT_ADVENT_YEAR, dayCount } from '../lib/date'
import { BASE } from '../lib/base'
import { sanitizeEffects } from '../lib/effects'
import type { LetterContent } from '../lib/letters-types'

// Letter content is fetched from `public/letters/<user>.json`, falling back to
// `default.json`. Schema is AGENTS.md §5: { name, languages, extended, days }.
// Everything here is defensive — the JSON is hand-edited and can be malformed.

const FALLBACK_USER = 'default'

export interface LettersFile {
  name: string
  /** Advent year. Drives the countdown and the date lock; see lib/date.ts. */
  year: number
  languages: string[]
  /** Carried through but nothing branches on it yet — see PROGRESS.md. */
  extended: boolean
  /** Id of a theme in public/audio/themes.json. Absent means `classic`. */
  audioTheme?: string
  days: ReadonlyMap<number, LetterContent>
}

export type LettersStatus = 'loading' | 'ready' | 'error'

export interface LettersState {
  status: LettersStatus
  letters: LettersFile | null
}

const LOADING: LettersState = { status: 'loading', letters: null }

/** Media paths in the JSON are relative to the site root, so they need the deploy
 *  prefix or they 404 on GitHub Pages. Resolved once, here. */
function mediaUrl(path: string): string {
  return `${BASE}${path.replace(/^\/+/, '')}`
}

function sanitizeDay(raw: unknown): LetterContent | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (typeof o.title !== 'string' || typeof o.text !== 'string') return null

  const letter: LetterContent = { title: o.title, text: o.text }

  if (typeof o.image === 'string' && o.image) letter.image = mediaUrl(o.image)

  const effects = sanitizeEffects(o.effects)
  if (effects.length) letter.effects = effects

  if (o.ticket !== null && typeof o.ticket === 'object') {
    const t = o.ticket as Record<string, unknown>
    if (typeof t.id === 'string' && t.id && typeof t.label === 'string') {
      letter.ticket = {
        id: t.id,
        label: t.label,
        ...(typeof t.note === 'string' ? { note: t.note } : {}),
      }
    }
  }

  return letter
}

function sanitizeFile(raw: unknown): LettersFile | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const days = new Map<number, LetterContent>()
  if (o.days !== null && typeof o.days === 'object') {
    // The day ceiling depends on `extended`, so read the flag before the days.
    const total = dayCount(o.extended === true)
    for (const [key, value] of Object.entries(o.days as Record<string, unknown>)) {
      const day = Number(key)
      if (!isValidDay(day, total)) continue
      const letter = sanitizeDay(value)
      if (letter) days.set(day, letter)
    }
  }

  if (days.size === 0) return null

  return {
    name: typeof o.name === 'string' ? o.name : '',
    // Falls back to the current year, which is right for a fresh config.
    year:
      typeof o.year === 'number' && Number.isFinite(o.year) && o.year > 1970
        ? Math.floor(o.year)
        : DEFAULT_ADVENT_YEAR,
    languages: Array.isArray(o.languages)
      ? o.languages.filter((l): l is string => typeof l === 'string')
      : [],
    extended: o.extended === true,
    ...(typeof o.audioTheme === 'string' && o.audioTheme ? { audioTheme: o.audioTheme } : {}),
    days,
  }
}

async function fetchFile(user: string): Promise<LettersFile | null> {
  try {
    const res = await fetch(`${BASE}letters/${user}.json`)
    if (!res.ok) return null
    return sanitizeFile(await res.json())
  } catch {
    // Network error or malformed JSON — the caller falls back.
    return null
  }
}

/** Primary file wins per day; anything it omits comes from the fallback. */
function merge(primary: LettersFile | null, fallback: LettersFile | null): LettersFile | null {
  if (!primary) return fallback
  if (!fallback) return primary
  return {
    ...fallback,
    ...primary,
    days: new Map([...fallback.days, ...primary.days]),
  }
}

/**
 * A letter file does not have to list every day. Anything missing falls back to
 * day 1's letter, so a partly-written calendar shows real content instead of an
 * error. Day 1 itself must exist for this to do anything.
 */
function fillMissingFromDayOne(file: LettersFile): LettersFile {
  const first = file.days.get(1)
  if (!first) return file

  const days = new Map(file.days)
  for (let day = 2; day <= dayCount(file.extended); day++) {
    if (!days.has(day)) days.set(day, first)
  }
  return { ...file, days }
}

export function useLetters(user: string): LettersState {
  // State is tagged with the user it was fetched for. When `user` changes, the
  // tag no longer matches and we report loading — derived, rather than calling
  // setState synchronously inside the effect body to reset it.
  const [state, setState] = useState<{ user: string; value: LettersState }>({
    user,
    value: LOADING,
  })

  useEffect(() => {
    // Guards against a slow request for a previous user landing after the user
    // has already switched (e.g. via the browser's back button).
    let cancelled = false

    void (async () => {
      const [primary, fallback] =
        user === FALLBACK_USER
          ? [null, await fetchFile(FALLBACK_USER)]
          : await Promise.all([fetchFile(user), fetchFile(FALLBACK_USER)])

      if (cancelled) return
      const merged = merge(primary, fallback)
      const letters = merged ? fillMissingFromDayOne(merged) : null
      setState({
        user,
        value: letters ? { status: 'ready', letters } : { status: 'error', letters: null },
      })
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return state.user === user ? state.value : LOADING
}
