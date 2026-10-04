// Procedural audio — no files, everything synthesised. Nothing runs until a user
// gesture, because browsers block audio until then.
//
//   music -> lowpass(theme.lowpass) -> master -> destination
//   sfx   -----------------------------^
//
// Music is a looping pentatonic melody scheduled ahead of the clock rather than
// driven by setTimeout, so notes land on time even when the main thread stalls.

import { useSyncExternalStore } from 'react'
import { getSoundPrefs, setMusicWanted } from './store'
import { mulberry32 } from './rng'
import { FALLBACK_THEME, type AudioTheme } from './audio-theme'

type AudioCtor = new () => AudioContext

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null

let theme: AudioTheme = FALLBACK_THEME

// Varying the seed per burst keeps successive noise bursts from sounding identical.
let noiseSeed = 1

/**
 * True only when the context can actually produce sound right now.
 *
 * A suspended context has a *frozen* `currentTime`. Anything scheduled against it
 * is held until it resumes and then fires late — and if several notes were queued
 * across a frozen span they all arrive at once. That is what turned the reveal's
 * six-note bell into a single dissonant cluster on a first visit: all six were
 * scheduled while the browser was refusing audio, then released together once a
 * gesture unlocked it. So nothing is scheduled into a context that is not running.
 */
function canPlay(a: AudioContext | null): a is AudioContext {
  return !!a && a.state === 'running'
}

/** Lazily creates the context and resumes it if the browser suspended it. */
function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!ctx) {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) return null

    ctx = new Ctor()

    master = ctx.createGain()
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = theme.lowpass

    musicBus = ctx.createGain()
    sfxBus = ctx.createGain()

    musicBus.connect(lowpass)
    lowpass.connect(master)
    sfxBus.connect(master)
    master.connect(ctx.destination)

    const vols = getSoundPrefs()
    musicBus.gain.value = vols.music
    sfxBus.gain.value = vols.effects
  }

  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// ---------------------------------------------------------------- effects

/** Filtered noise burst with a decaying envelope. */
export function noise(
  dur: number,
  freq: number,
  vol: number,
  type: BiquadFilterType = 'lowpass',
): void {
  const a = ensure()
  if (!a || !sfxBus || !canPlay(a)) return

  const rand = mulberry32(noiseSeed++)
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    // Ramp down so the burst ends rather than clicks.
    data[i] = (rand() * 2 - 1) * (1 - i / data.length)
  }

  const src = a.createBufferSource()
  src.buffer = buffer

  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq

  const gain = a.createGain()
  gain.gain.value = vol

  src.connect(filter)
  filter.connect(gain)
  gain.connect(sfxBus)
  src.start()
}

/** Oscillator swept from f0 to f1 over `dur` seconds. */
export function tone(
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  delay = 0,
): void {
  const a = ensure()
  if (!a || !sfxBus || !canPlay(a)) return

  const t = a.currentTime + delay
  const osc = a.createOscillator()
  const gain = a.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)

  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

  osc.connect(gain)
  gain.connect(sfxBus)
  osc.start(t)
  osc.stop(t + dur)
}

export function playWhistle(): void {
  tone(400, 1500, 0.7, 0.07)
}

export function playPop(): void {
  noise(0.15, 3000, 0.35, 'bandpass')
}

// The reveal bell. Defined once so its length can be derived rather than guessed.
const BELL_NOTES = [523, 659, 784, 1047, 784, 1047]
const BELL_STEP = 0.22
const BELL_DECAY = 1

/**
 * How long the reveal bell rings out. Music waits this long before joining, so the
 * two never play on top of each other. Derived from the bell itself — change the
 * notes or the spacing and this follows, rather than silently going stale in a
 * second place and reintroducing the overlap it exists to prevent.
 */
export const BELL_DURATION_MS = Math.round(
  ((BELL_NOTES.length - 1) * BELL_STEP + BELL_DECAY) * 1000,
)

export function playBells(): void {
  BELL_NOTES.forEach((f, i) => tone(f, f * 0.995, BELL_DECAY, 0.12, 'triangle', i * BELL_STEP))
}

/** Paper tearing: two bandpass noise swipes. */
export function playTear(): void {
  noise(0.25, 2500, 0.5, 'bandpass')
  window.setTimeout(() => noise(0.15, 4000, 0.4, 'bandpass'), 120)
}

export function playShutter(): void {
  noise(0.06, 1200, 0.3, 'bandpass')
  tone(900, 300, 0.08, 0.12, 'square')
}

/** Duck the music while a boom lands, then ease back over about a second. */
export function duck(): void {
  if (!ctx || !musicBus) return
  const full = getSoundPrefs().music
  musicBus.gain.setTargetAtTime(full * 0.25, ctx.currentTime, 0.02)
  window.setTimeout(
    () => musicBus?.gain.setTargetAtTime(getSoundPrefs().music, ctx?.currentTime ?? 0, 0.4),
    900,
  )
}

export function playBoom(): void {
  noise(1.2, 500, 0.6)
  tone(120, 30, 0.6, 0.5)
  window.setTimeout(() => noise(0.6, 7000, 0.12, 'highpass'), 150)
  duck()
}

// ------------------------------------------------------------------ music

let musicOn = false
let musicTimer: number | null = null
let step = 0
let nextTime = 0

// Optional per-day seed so the same day always sounds the same but neighbours differ.
let daySeed = 0

/** Schedules any notes falling inside the lookahead window. */
function musicTick(): void {
  const a = ctx
  if (!a || !musicBus) return

  while (nextTime < a.currentTime + 0.25) {
    const i = step % theme.sequence.length
    const freq = theme.scale[theme.sequence[i] % theme.scale.length]

    playMusicNote(freq, nextTime, theme.noteDuration, theme.noteVolume)

    if (theme.bassEverySteps > 0 && i % theme.bassEverySteps === 0) {
      playMusicNote(
        freq / theme.bassDivisor,
        nextTime,
        theme.bassDuration,
        theme.bassVolume,
      )
    }

    step++
    nextTime += theme.stepSeconds
  }
}

function playMusicNote(freq: number, at: number, dur: number, vol: number): void {
  const a = ctx
  if (!a || !musicBus) return

  const osc = a.createOscillator()
  const gain = a.createGain()

  osc.type = theme.waveform
  osc.frequency.value = freq

  gain.gain.setValueAtTime(vol, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + dur)

  osc.connect(gain)
  gain.connect(musicBus)
  osc.start(at)
  osc.stop(at + dur)
}

/** Rotate the melody by the day so each day has its own order. */
function seedForDay(day: number): number {
  if (day <= 0) return 0
  const seq = theme.sequence
  if (!seq.length) return 0
  return (day * 7) % seq.length
}

export function startMusic(day = 0): void {
  const a = ensure()
  if (!a) return

  stopMusicTimer()
  musicOn = true

  daySeed = seedForDay(day)
  step = daySeed
  nextTime = a.currentTime + 0.1

  // 60ms poll with a ~0.25s lookahead, so a late tick still leaves lead time.
  musicTimer = window.setInterval(musicTick, 60)
  musicTick()
  emit()
}

export function stopMusic(): void {
  // A pending start must die with the scheduler, or someone who pauses during the
  // hold would get music a couple of seconds later, having just asked for silence.
  cancelPendingStart()
  stopMusicTimer()
  musicOn = false
  emit()
}

// ------------------------------------------------- holding music back

/**
 * Until when music is not allowed to start.
 *
 * Effects and music share one output, and an arpeggio landing on the first note of
 * the melody is just noise — at the reveal it produced an audible clash every time.
 * So an effect that is about to ring out claims the bus first and music waits it out.
 */
let musicBlockedUntil = 0
let pendingStart: number | null = null

/** Keep music quiet for `ms` milliseconds. Long holds win over short ones. */
export function holdMusicFor(ms: number): void {
  musicBlockedUntil = Math.max(musicBlockedUntil, Date.now() + ms)
}

/** How long music still has to wait, in ms. */
export function musicHoldRemaining(): number {
  return Math.max(0, musicBlockedUntil - Date.now())
}

function cancelPendingStart(): void {
  if (pendingStart !== null) {
    window.clearTimeout(pendingStart)
    pendingStart = null
  }
}

/**
 * The single way music comes up. Everything that wants it — the autostart, the
 * prompt, the Sound tab, the gesture rescue — routes through here, so there is one
 * place that respects the hold and one place that re-checks the visitor has not
 * muted it in the meantime.
 */
function scheduleMusicStart(day: number, afterStart?: () => void): void {
  cancelPendingStart()
  pendingStart = window.setTimeout(
    () => {
      pendingStart = null
      if (!getSoundPrefs().musicWanted) return
      ensure()
      setNeedsGesture(false)
      startMusic(day)
      afterStart?.()
    },
    musicHoldRemaining(),
  )
}

/**
 * Start music from a real user gesture (a tap, a key press) and remember that
 * this visitor wants it, so later visits autostart without asking.
 */
export function startMusicFromGesture(day = 0): void {
  setMusicWanted(true)
  scheduleMusicStart(day)
}

/**
 * Try to start the music the moment the scene appears.
 *
 * Browsers suspend an AudioContext created without a user gesture, so this often
 * fails on a first visit — but not always: the site may already be allowed to
 * autoplay, the visitor may have engaged with it before, or their browser may be
 * configured permissively. When it succeeds they hear music immediately, which is
 * the whole point of asking for it.
 *
 * `resume()` is async, so the verdict is not available synchronously. Rather than
 * assume success and leave a scheduler running that produces no sound, this gives
 * the context a moment and then backs out honestly if it never started.
 */
export function tryAutostart(day = 0): void {
  if (!getSoundPrefs().musicWanted) return

  scheduleMusicStart(day, () => {
    window.setTimeout(() => {
      if (ctx?.state === 'running') return
      // Refused. Stop the scheduler rather than let it tick inaudibly forever,
      // and let the UI ask for one tap instead of hiding music in the Sound tab.
      stopMusic()
      setNeedsGesture(true)
    }, 400)
  })
}

export function toggleMusic(day = 0): void {
  if (musicOn) {
    stopMusic()
    // An explicit pause is a decision to not hear music, so it must suppress
    // the autostart on every later visit too.
    setMusicWanted(false)
  } else {
    startMusicFromGesture(day)
  }
}

function stopMusicTimer(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer)
    musicTimer = null
  }
}

// --------------------------------------------------------------- volumes

/** Push the persisted volumes onto the live nodes. Call after changing volume. */
export function applyVolumes(): void {
  if (!musicBus || !sfxBus) return
  const vols = getSoundPrefs()
  musicBus.gain.value = vols.music
  sfxBus.gain.value = vols.effects
}

/** Swap the active theme. Restarting keeps the currently-playing music honest. */
export function setAudioTheme(next: AudioTheme): void {
  theme = next
  if (ctx) {
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = next.lowpass
    // Rebuilding the filter node is the simplest way to retune the bus in place.
    musicBus?.disconnect()
    musicBus?.connect(lowpass)
    lowpass.connect(master!)
  }
  if (musicOn) startMusic(daySeed)
}

/**
 * Resume the context from a user gesture, e.g. the first tap on the scene.
 *
 * Tearing a coupon or opening a letter is itself a gesture, so this is also the
 * moment to rescue the music if autoplay was refused — the visitor has already
 * interacted, so there is no prompt to show them first.
 *
 * It still goes through the scheduler, because this is called from the effects
 * path too: without the hold, the reveal's bell would trigger the music rescue and
 * double up with itself.
 */
export function unlockAudio(day = 0): void {
  ensure()
  if (needsGesture && getSoundPrefs().musicWanted) scheduleMusicStart(day)
}

// ------------------------------------------ music state, as a tiny store

// Same shape as lib/store.ts: useSyncExternalStore rather than context, because
// the Sound tab lives outside the <Canvas> but the pattern should be consistent.
const musicListeners = new Set<() => void>()

function emit(): void {
  for (const l of musicListeners) l()
}

function subscribeMusic(cb: () => void): () => void {
  musicListeners.add(cb)
  return () => {
    musicListeners.delete(cb)
  }
}

const getMusicOn = (): boolean => musicOn

export function useMusicOn(): boolean {
  return useSyncExternalStore(subscribeMusic, getMusicOn, getMusicOn)
}

// --- the autoplay was refused, so one tap is needed ---

/**
 * Set when an autoplay attempt failed because the browser refused to run the
 * context without a gesture. Distinct from `musicOn === false`: that also means
 * "the visitor paused it", which must not prompt anyone.
 */
let needsGesture = false

function setNeedsGesture(next: boolean): void {
  if (needsGesture === next) return
  needsGesture = next
  emit()
}

const getNeedsGesture = (): boolean => needsGesture

export function useNeedsGesture(): boolean {
  return useSyncExternalStore(subscribeMusic, getNeedsGesture, getNeedsGesture)
}
