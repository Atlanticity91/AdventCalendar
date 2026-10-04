// Audio themes. `public/audio/themes.json` holds one named theme per key; the
// `audioTheme` field in a user's letter file picks one by id. Missing or invalid
// ids fall back to `classic` rather than leaving the calendar silent.
//
// This is separate from `lib/date.ts`'s scene rules: a theme is a pure musical
// preset, and the one place it meets the date is the optional day-seeded melody
// rotation in `lib/audio.ts`.

import { BASE } from './base'

export const DEFAULT_THEME_ID = 'classic'

export interface AudioTheme {
  id: string
  name: string
  /** Frequencies in Hz; the melody indexes into this. */
  scale: number[]
  /** Scale indices, played in order and looped. */
  sequence: number[]
  stepSeconds: number
  waveform: OscillatorType
  noteDuration: number
  noteVolume: number
  /** Cutoff on the music bus lowpass — the main timbre control. */
  lowpass: number
  bassEverySteps: number
  /** Bass pitch = note frequency / bassDivisor. */
  bassDivisor: number
  bassVolume: number
  bassDuration: number
  defaultMusicVolume: number
  defaultEffectsVolume: number
}

const WAVEFORMS: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle']

const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_VALUE): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

function numberList(v: unknown, fallback: number[], min: number, max: number): number[] {
  if (!Array.isArray(v)) return fallback
  const list = v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  const cleaned = list.map((n) => Math.min(max, Math.max(min, n)))
  return cleaned.length ? cleaned : fallback
}

/** Drops unusable themes rather than trusting hand-edited JSON. */
export function sanitizeTheme(id: string, raw: unknown): AudioTheme | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const scale = numberList(o.scale, [], 20, 8000)
  if (!scale.length) return null

  const sequence = numberList(o.sequence, [0], 0, Math.max(0, scale.length - 1))
  const waveform = WAVEFORMS.includes(o.waveform as OscillatorType)
    ? (o.waveform as OscillatorType)
    : 'triangle'

  const bassEvery = num(o.bassEverySteps, 4, 0, 64)

  return {
    id,
    name: typeof o.name === 'string' && o.name ? o.name : id,
    scale,
    sequence,
    stepSeconds: num(o.stepSeconds, 0.42, 0.05, 4),
    waveform,
    noteDuration: num(o.noteDuration, 0.7, 0.05, 8),
    noteVolume: num(o.noteVolume, 0.18, 0, 1),
    lowpass: num(o.lowpass, 2500, 200, 16000),
    // 0 disables the bass note.
    bassEverySteps: bassEvery === 0 ? 0 : Math.round(bassEvery),
    bassDivisor: num(o.bassDivisor, 4, 1, 8),
    bassVolume: num(o.bassVolume, 0.25, 0, 1),
    bassDuration: num(o.bassDuration, 1.4, 0.05, 8),
    defaultMusicVolume: num(o.defaultMusicVolume, 0.4, 0, 1),
    defaultEffectsVolume: num(o.defaultEffectsVolume, 0.8, 0, 1),
  }
}

export function sanitizeThemes(raw: unknown): Record<string, AudioTheme> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Record<string, AudioTheme> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{1,32}$/i.test(id)) continue
    const theme = sanitizeTheme(id, value)
    if (theme) out[id] = theme
  }
  return out
}

/** Fetched once per page load and cached; the file rarely changes. */
let cache: Promise<Record<string, AudioTheme>> | null = null

export function loadThemes(): Promise<Record<string, AudioTheme>> {
  cache ??= fetch(`${BASE}audio/themes.json`)
    .then((res) => (res.ok ? res.json() : null))
    .then(sanitizeThemes)
    .catch(() => ({}))
  return cache
}

/** Used until the themes file lands, and whenever a theme id cannot be resolved. */
export const FALLBACK_THEME: AudioTheme = sanitizeTheme(DEFAULT_THEME_ID, {
  name: 'Classic',
  scale: [523.25, 587.33, 659.25, 783.99, 880],
  sequence: [0, 2, 4, 2, 3, 1, 2, 0, 4, 3, 2, 1, 0, 1, 2, 0],
})!
