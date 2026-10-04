// Single source of truth for anything persisted. Deliberately a module-level
// store rather than React context: these hooks are called from inside the R3F
// <Canvas>, where context would need drei's useContextBridge.
//
// Two invariants this file must not break:
//   1. get() returns the SAME object until something actually changes. Returning a
//      fresh object per call makes useSyncExternalStore re-render forever.
//   2. Arrays are never mutated in place; every write allocates a new state object.
//
// localStorage is wrapped in try/catch throughout: it can be blocked (private
// mode, sandboxed iframe) or hold corrupt JSON.

import { useMemo, useSyncExternalStore } from 'react'
import { isValidDay } from './date'

// ---------- safe storage primitives ----------

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage blocked — state still lives in memory for this
    // session, it just will not survive a reload.
  }
}

function parse(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---------- generic store ----------

interface Store<T> {
  key: string
  get: () => T
  set: (next: T) => void
  subscribe: (cb: () => void) => () => void
  /** Re-read after another tab wrote. */
  sync: (changedKey: string | null, newValue: string | null) => void
}

// One module-level `storage` listener for every store, instead of one per instance.
const registry = new Set<Store<unknown>>()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    for (const store of registry) store.sync(e.key, e.newValue)
  })
}

function createStore<T>(
  key: string,
  sanitize: (raw: unknown) => T,
  isEqual: (a: T, b: T) => boolean,
): Store<T> {
  let state = sanitize(parse(readRaw(key)))
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const l of listeners) l()
  }

  const store: Store<T> = {
    key,
    // Stable reference between writes — see invariant 1 above.
    get: () => state,
    set(next) {
      if (Object.is(next, state)) return
      state = next
      writeRaw(key, next)
      emit()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    sync(changedKey, newValue) {
      // key === null means localStorage.clear() ran, which affects every store.
      if (changedKey !== null && changedKey !== key) return
      const next = sanitize(changedKey === null ? null : parse(newValue))
      // Avoid a pointless re-render when the other tab wrote identical data.
      if (isEqual(next, state)) return
      state = next
      emit()
    },
  }

  registry.add(store as Store<unknown>)
  return store
}

// ---------- advent state (opened days + used ticket ids) ----------

export interface AdventState {
  opened: number[]
  used: string[]
}

function sanitizeAdvent(raw: unknown): AdventState {
  if (raw === null || typeof raw !== 'object') return { opened: [], used: [] }
  const o = raw as Record<string, unknown>

  const opened = Array.isArray(o.opened)
    ? [...new Set(o.opened.filter((d): d is number => typeof d === 'number' && isValidDay(d)))].sort(
        (a, b) => a - b,
      )
    : []
  const used = Array.isArray(o.used)
    ? [...new Set(o.used.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : []

  return { opened, used }
}

function sameAdvent(a: AdventState, b: AdventState): boolean {
  return (
    a.opened.length === b.opened.length &&
    a.used.length === b.used.length &&
    a.opened.every((d, i) => d === b.opened[i]) &&
    a.used.every((s, i) => s === b.used[i])
  )
}

// One store per user, so ?user=ines and ?user=dilara never share progress.
const adventStores = new Map<string, Store<AdventState>>()

function adventStore(user: string): Store<AdventState> {
  let store = adventStores.get(user)
  if (!store) {
    store = createStore<AdventState>(`advent:${user}`, sanitizeAdvent, sameAdvent)
    adventStores.set(user, store)
  }
  return store
}

// ---------- actions (idempotent, callable outside React) ----------

export function markOpened(user: string, day: number): void {
  if (!isValidDay(day)) return
  const store = adventStore(user)
  const cur = store.get()
  if (cur.opened.includes(day)) return
  store.set({ opened: [...cur.opened, day].sort((a, b) => a - b), used: cur.used })
}

export function markUsed(user: string, id: string): void {
  if (!id) return
  const store = adventStore(user)
  const cur = store.get()
  if (cur.used.includes(id)) return
  store.set({ opened: cur.opened, used: [...cur.used, id] })
}

/** Read state outside React — the step-12 text-only list needs this. Components
 *  should use useOpened/useUsed so they re-render on change. */
export function getAdvent(user: string): AdventState {
  return adventStore(user).get()
}

// ---------- hooks ----------

export function useOpened(user: string): ReadonlySet<number> {
  const store = adventStore(user)
  const state = useSyncExternalStore(store.subscribe, store.get, store.get)
  return useMemo(() => new Set(state.opened), [state.opened])
}

export function useUsed(user: string): ReadonlySet<string> {
  const store = adventStore(user)
  const state = useSyncExternalStore(store.subscribe, store.get, store.get)
  return useMemo(() => new Set(state.used), [state.used])
}

// ---------- sound prefs (separate small key, not per-user) ----------

export interface SoundPrefs {
  music: number
  effects: number
  /**
   * Whether music should be playing. Defaults to true so it starts on its own
   * where the browser permits; only becomes false once someone deliberately
   * turns it off, which is the signal never to autostart again for them.
   */
  musicWanted: boolean
}

const VOL_KEY = 'vol'
const DEFAULT_SOUND: SoundPrefs = { music: 0.4, effects: 0.8, musicWanted: true }

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

function sanitizeSound(raw: unknown): SoundPrefs {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_SOUND }
  const o = raw as Record<string, unknown>
  return {
    music: typeof o.music === 'number' ? clamp01(o.music) : DEFAULT_SOUND.music,
    effects: typeof o.effects === 'number' ? clamp01(o.effects) : DEFAULT_SOUND.effects,
    musicWanted:
      typeof o.musicWanted === 'boolean' ? o.musicWanted : DEFAULT_SOUND.musicWanted,
  }
}

function sameSound(a: SoundPrefs, b: SoundPrefs): boolean {
  return a.music === b.music && a.effects === b.effects && a.musicWanted === b.musicWanted
}

const soundStore = createStore<SoundPrefs>(VOL_KEY, sanitizeSound, sameSound)

export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(soundStore.subscribe, soundStore.get, soundStore.get)
}

export function setVolume(kind: 'music' | 'effects', value: number): void {
  const cur = soundStore.get()
  soundStore.set({ ...cur, [kind]: clamp01(value) })
}

export function setMusicWanted(on: boolean): void {
  if (soundStore.get().musicWanted === on) return
  soundStore.set({ ...soundStore.get(), musicWanted: on })
}

/** Read prefs outside React — the step-8 audio engine needs this. */
export function getSoundPrefs(): SoundPrefs {
  return soundStore.get()
}
