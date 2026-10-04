/**
 * Checks `src/lib/store.ts` against a stubbed localStorage and window.
 *
 *   node --import ./scripts/register.mjs scripts/verify-store.mts
 *
 * The stubs must be installed BEFORE importing store.ts, because it reads them at
 * module scope (it registers a `storage` listener). Hence the dynamic import.
 */
const mem: Record<string, string> = {}
let blocked = false

const localStorageStub = {
  getItem(k: string) {
    if (blocked) throw new Error('storage blocked')
    return k in mem ? mem[k] : null
  },
  setItem(k: string, v: string) {
    if (blocked) throw new Error('storage blocked')
    mem[k] = v
  },
  removeItem(k: string) {
    delete mem[k]
  },
  clear() {
    for (const k of Object.keys(mem)) delete mem[k]
  },
  key: () => null,
  length: 0,
}

let storageListener: ((e: { key: string | null; newValue: string | null }) => void) | null = null
const windowStub = {
  addEventListener(type: string, fn: never) {
    if (type === 'storage') storageListener = fn as never
  },
}

const g = globalThis as Record<string, unknown>
g.localStorage = localStorageStub
g.window = windowStub

const S = await import('../src/lib/store.ts')

let pass = 0
let fail = 0
const ok = (label: string, cond: boolean, extra = '') => {
  if (cond) {
    pass++
    console.log(`PASS  ${label}`)
  } else {
    fail++
    console.log(`FAIL  ${label}${extra ? '  -> ' + extra : ''}`)
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ------------------------------------------- referential stability

console.log('--- get() must be referentially stable (useSyncExternalStore loops otherwise) ---')
S.markOpened('ines', 5)
const a1 = S.getAdvent('ines')
const a2 = S.getAdvent('ines')
ok('get() returns the identical reference when unchanged', a1 === a2)
S.markOpened('ines', 6)
ok('get() returns a NEW reference after a change', S.getAdvent('ines') !== a1)

console.log('\n--- idempotency ---')
S.markOpened('ines', 5)
S.markOpened('ines', 5)
ok('markOpened twice does not duplicate', eq(S.getAdvent('ines').opened, [5, 6]))
const before = S.getAdvent('ines')
S.markOpened('ines', 5)
ok('a redundant markOpened does not even change the reference', S.getAdvent('ines') === before)
S.markUsed('ines', 'hc1')
S.markUsed('ines', 'hc1')
ok('markUsed twice does not duplicate', eq(S.getAdvent('ines').used, ['hc1']))

console.log('\n--- never mutate in place ---')
const prev = S.getAdvent('ines')
const prevArr = prev.opened
S.markOpened('ines', 9)
ok('the previous opened array is untouched', eq(prevArr, [5, 6]))
ok('the previous state object still reads correctly', eq(prev.opened, [5, 6]))

console.log('\n--- per-user namespacing ---')
S.markOpened('dilara', 3)
ok('ines is unaffected by dilara', eq(S.getAdvent('ines').opened, [5, 6, 9]))
ok('dilara has its own state', eq(S.getAdvent('dilara').opened, [3]))
ok('keyed as advent:<user>', mem['advent:ines'] !== undefined && mem['advent:dilara'] !== undefined)

console.log('\n--- validation ---')
// Day 26 is the first day a standard calendar does not reach. Day 25 used to be
// used here as the out-of-range example, back when the standard length was 24 — it
// is 25 December now, so it is a perfectly good day to record.
S.markOpened('bad', 0)
S.markOpened('bad', 26)
S.markOpened('bad', 1.5)
S.markUsed('bad', '')
ok('invalid days rejected', eq(S.getAdvent('bad').opened, []))
ok('an empty coupon id rejected', eq(S.getAdvent('bad').used, []))
S.markOpened('ok25', 25)
ok('day 25 (Christmas) is a valid day to record', eq(S.getAdvent('ok25').opened, [25]))

console.log('\n--- corrupt or hostile storage ---')
mem['advent:corrupt'] = '{{{not json'
ok('corrupt JSON falls back to empty', eq(S.getAdvent('corrupt'), { opened: [], used: [] }))
mem['advent:junk'] = JSON.stringify({ opened: 'nope', used: 42 })
ok('wrong-typed fields sanitized away', eq(S.getAdvent('junk'), { opened: [], used: [] }))
mem['advent:dirty'] = JSON.stringify({ opened: [3, 99, 7, 'x', 3], used: [5, 'ok', 5] })
ok('bad entries filtered, dupes dropped, sorted', eq(S.getAdvent('dirty'), { opened: [3, 7], used: ['ok'] }))

console.log('\n--- blocked localStorage (private mode / sandboxed iframe) ---')
blocked = true
let threw = false
try {
  S.markOpened('ines', 11)
} catch {
  threw = true
}
ok('markOpened does not throw when blocked', !threw)
ok('state still updates in memory', S.getAdvent('ines').opened.includes(11))
blocked = false

console.log('\n--- cross-tab sync via the storage event ---')
mem['advent:tab2'] = JSON.stringify({ opened: [2, 4], used: ['w'] })
storageListener?.({ key: 'advent:tab2', newValue: mem['advent:tab2'] })
ok('another tab\'s write is picked up', eq(S.getAdvent('tab2'), { opened: [2, 4], used: ['w'] }))

mem['advent:tab3'] = JSON.stringify({ opened: [1] })
const t3 = S.getAdvent('tab3')
storageListener?.({ key: 'advent:other', newValue: JSON.stringify({ opened: [8] }) })
ok('an unrelated key is ignored', S.getAdvent('tab3') === t3)

storageListener?.({ key: 'advent:tab3', newValue: mem['advent:tab3'] })
ok('an identical write does not churn the reference', S.getAdvent('tab3') === t3)

storageListener?.({ key: 'advent:tab3', newValue: JSON.stringify({ opened: [1, 2] }) })
ok('a changed write updates state', eq(S.getAdvent('tab3').opened, [1, 2]))

storageListener?.({ key: null, newValue: null })
ok('localStorage.clear() resets that store', eq(S.getAdvent('tab3'), { opened: [], used: [] }))
ok('localStorage.clear() resets every store', eq(S.getAdvent('ines'), { opened: [], used: [] }))

console.log('\n--- sound prefs (separate key, clamped) ---')
const DEF = { music: 0.4, effects: 0.8, musicWanted: true }
ok('defaults are music .4 / effects .8 and music wanted', eq(S.getSoundPrefs(), DEF))
S.setVolume('music', 0.75)
ok('setVolume updates state', eq(S.getSoundPrefs(), { music: 0.75, effects: 0.8, musicWanted: true }))
ok('persisted under "vol"', eq(JSON.parse(mem['vol']), { music: 0.75, effects: 0.8, musicWanted: true }))
ok('the vol key is separate from advent keys', mem['advent:vol'] === undefined)
S.setVolume('music', 5)
ok('clamped above 1', S.getSoundPrefs().music === 1)
S.setVolume('effects', -3)
ok('clamped below 0', S.getSoundPrefs().effects === 0)
S.setVolume('music', Number.NaN)
ok('NaN becomes 0 rather than corrupt', S.getSoundPrefs().music === 0)
mem['vol'] = JSON.stringify({ music: 'loud', effects: 0.5 })
storageListener?.({ key: 'vol', newValue: mem['vol'] })
ok('a non-numeric volume sanitized back to the default',
  eq(S.getSoundPrefs(), { music: 0.4, effects: 0.5, musicWanted: true }))

console.log('\n--- musicWanted: the opt-out must survive a reload ---')
// This is what stops the autostart nagging someone who deliberately muted it.
S.setMusicWanted(false)
ok('setMusicWanted(false) is stored', S.getSoundPrefs().musicWanted === false)
ok('and persisted, so a reload keeps it off',
  JSON.parse(mem['vol']).musicWanted === false)
mem['vol'] = JSON.stringify({ music: 0.4, effects: 0.8 })
storageListener?.({ key: 'vol', newValue: mem['vol'] })
ok('a stored object missing musicWanted falls back to wanted (older data)',
  S.getSoundPrefs().musicWanted === true)
mem['vol'] = JSON.stringify({ musicWanted: 'yes' })
storageListener?.({ key: 'vol', newValue: mem['vol'] })
ok('a non-boolean musicWanted falls back to true rather than blocking audio',
  S.getSoundPrefs().musicWanted === true)
S.setMusicWanted(false)
ok('setting the same value again does not churn the reference',
  (() => { const a = S.getSoundPrefs(); S.setMusicWanted(false); return S.getSoundPrefs() === a })())

console.log(`\n${fail === 0 ? 'ALL PASS' : `${fail} FAILURES`}  (${pass} passed)`)
process.exit(fail === 0 ? 0 : 1)
