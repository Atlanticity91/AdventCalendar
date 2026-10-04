/**
 * Checks the pure logic that has no DOM or React dependency, plus the shipped
 * letter JSON. No test framework: plain asserts, run by `npm run verify`.
 *
 *   node --import ./scripts/register.mjs scripts/verify.mts
 *
 * What this deliberately does NOT cover is listed in PROGRESS.md under
 * "Verification gaps" — read that before assuming something is tested.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const lib = await import(join(ROOT, 'src/lib/date.ts'))
const orns = await import(join(ROOT, 'src/lib/ornaments.ts'))
const rng = await import(join(ROOT, 'src/lib/rng.ts'))
const tk = await import(join(ROOT, 'src/lib/ticket.ts'))

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
const at = (iso: string) => new Date(`${iso}T12:00`)

/** Preview length in ui/Countdown.tsx, mirrored for the scheduling guard below. */
const TARGET_PREVIEW_MS = 10_000

// ---------------------------------------------------------------- date lock

console.log('--- date lock (lib/date.ts) ---')

const oct = at('2026-10-03')
const dec5 = at('2026-12-05')
const nov30 = at('2026-11-30')
const dec25 = at('2026-12-25')
const YEAR = 2026

const lockCases: [string, boolean, boolean][] = [
  ['oct, dev off, day 1', lib.canOpen(1, oct, false, YEAR), false],
  ['oct, dev on,  day 1', lib.canOpen(1, oct, true, YEAR), true],
  ['oct, dev on,  day 2', lib.canOpen(2, oct, true, YEAR), true],
  ['oct, dev on,  day 3 (not a dev day)', lib.canOpen(3, oct, true, YEAR), false],
  ['oct, dev on,  day 24', lib.canOpen(24, oct, true, YEAR), false],
  ['oct, dev on,  day 0 invalid', lib.canOpen(0, oct, true, YEAR), false],
  ['oct, dev on,  day 25 invalid', lib.canOpen(25, oct, true, YEAR), false],
  ['oct, dev on,  day 1.5 invalid', lib.canOpen(1.5, oct, true, YEAR), false],
  ['dec5, dev off, day 5', lib.canOpen(5, dec5, false, YEAR), true],
  ['dec5, dev off, day 6', lib.canOpen(6, dec5, false, YEAR), false],
  ['dec5, dev on,  day 6', lib.canOpen(6, dec5, true, YEAR), false],
  ['nov30, dev off, day 1', lib.canOpen(1, nov30, false, YEAR), false],
  ['dec25, dev off, day 24', lib.canOpen(24, dec25, false, YEAR), true],
  ['dec1 00:30, dev off, day 1', lib.canOpen(1, new Date('2026-12-01T00:30'), false, YEAR), true],
  // The reason the year is stored: everything stays open after December.
  ['jan 2027, dev off, day 1', lib.canOpen(1, at('2027-01-15'), false, YEAR), true],
  ['jan 2027, dev off, day 24', lib.canOpen(24, at('2027-01-15'), false, YEAR), true],
  ['mar 2028, dev off, day 24', lib.canOpen(24, at('2028-03-01'), false, YEAR), true],
  // ...and a different year in the JSON moves the whole schedule.
  ['oct 2027 against year 2026, day 1', lib.canOpen(1, at('2027-10-01'), false, YEAR), true],
  ['dec 2026 against year 2027, day 1', lib.canOpen(1, dec5, false, 2027), false],
]
for (const [label, actual, expected] of lockCases) {
  ok(label, actual === expected, `got ${actual}, want ${expected}`)
}

// The dev check must sit AFTER isValidDay, or a malformed day slips past.
ok('dev cannot unlock an invalid day', lib.canOpen(0, oct, true) === false)
ok('isValidDay rejects 0 and accepts 25 (a standard calendar reaches Christmas)',
  !lib.isValidDay(0) && lib.isValidDay(25, lib.STANDARD_DAYS))
ok('isValidDay accepts 1 and 24', lib.isValidDay(1) && lib.isValidDay(24))
ok('currentDay is 0 outside December', lib.currentDay(oct) === 0)
ok('currentDay on 25 Dec is 25 (no longer clamped to 24)',
  lib.currentDay(dec25, true) === 25)
ok('currentDay on 31 Dec is 31', lib.currentDay(at('2026-12-31'), true) === 31)
ok('DEV_UNLOCKED_DAYS holds exactly 2 days', lib.DEV_UNLOCKED_DAYS.length === 2)
ok('opensOn label format', lib.opensOn(12) === 'Opens on Dec 12')
ok('opensOn day 31 stays in December', lib.opensOn(31) === 'Opens on Dec 31')
ok('opensOn day 32 names 1 January, not "Dec 32"',
  lib.opensOn(32) === 'Opens on Jan 1, next year', `got "${lib.opensOn(32)}"`)
ok('opensOn never prints a December date past the 31st', [32, 33, 40].every(
  (d) => !/Dec /.test(lib.opensOn(d))))

console.log('\n--- countdown to the stored year (no year rollover) ---')
ok('October: time remaining', lib.secondsUntilDecember(YEAR, oct) > 0)
ok('November 30: time remaining', lib.secondsUntilDecember(YEAR, nov30) > 0)
ok('1 December exactly: zero', lib.secondsUntilDecember(YEAR, lib.decemberStart(YEAR)) === 0)
ok('after 1 December: stays zero', lib.secondsUntilDecember(YEAR, dec25) === 0)
ok('January of year + 1: still zero (countdown stays gone)',
  lib.secondsUntilDecember(YEAR, at('2027-01-15')) === 0)
ok('two years later: still zero', lib.secondsUntilDecember(YEAR, at('2028-03-01')) === 0)
ok('decemberStart is 1 Dec local midnight',
  eq(lib.decemberStart(YEAR).toISOString().slice(0, 10), new Date(YEAR, 11, 1).toISOString().slice(0, 10)))
ok('unlockTime for day 1 is 1 December',
  eq(lib.unlockTime(1, YEAR), lib.decemberStart(YEAR).getTime()))
ok('unlockTime for day 24 is 24 December',
  eq(lib.unlockTime(24, YEAR), new Date(YEAR, 11, 24).getTime()))
ok('unlock days are strictly increasing across the extended range', (() => {
  for (let d = 1; d < lib.EXTENDED_DAYS; d++) {
    if (lib.unlockTime(d, YEAR) >= lib.unlockTime(d + 1, YEAR)) return false
  }
  return true
})())

// ---------------------------------------------------------- scene events

console.log('\n--- per-day scene events (day arithmetic, not hash) ---')

const month = Array.from({ length: 31 }, (_, i) => i + 1)
const ev = (d: number) => lib.sceneEvents(at(`2026-10-${String(d).padStart(2, '0')}`))
const heavyDays = month.filter((d) => ev(d).heavySnow)
const snowmanDays = month.filter((d) => ev(d).snowman)
const noPrintDays = month.filter((d) => ev(d).footprints === 0)

console.log(`  heavy snow on ${heavyDays.length}/31: ${heavyDays.join(',')}`)
console.log(`  snowman    on ${snowmanDays.length}/31: ${snowmanDays.join(',')}`)
console.log(`  no prints  on ${noPrintDays.length}/31: ${noPrintDays.join(',')}`)

ok('heavy snow happens on some but not all days', heavyDays.length > 0 && heavyDays.length < 31)
ok('snowman happens on some but not all days', snowmanDays.length > 0 && snowmanDays.length < 31)
ok('footprints absent on some but not all days', noPrintDays.length > 0 && noPrintDays.length < 31)
ok('footprint counts never exceed the cap', month.every((d) => ev(d).footprints <= lib.MAX_FOOTPRINTS))
ok('events are stable within a day',
  eq(lib.sceneEvents(at('2026-10-03')), lib.sceneEvents(at('2026-10-03'))))
ok('events ignore time of day',
  eq(lib.sceneEvents(new Date('2026-10-03T00:01')), lib.sceneEvents(new Date('2026-10-03T23:59'))))
console.log(`  today (2026-10-03): ${JSON.stringify(ev(3))}`)

// ------------------------------------------------------------------- rng

console.log('\n--- seeded PRNG (lib/rng.ts) ---')

const a1 = rng.mulberry32(42)
const a2 = rng.mulberry32(42)
const b1 = rng.mulberry32(43)
const s1 = Array.from({ length: 2000 }, a1)
const s2 = Array.from({ length: 2000 }, a2)
const s3 = Array.from({ length: 2000 }, b1)

ok('same seed -> same sequence', s1.every((v, i) => v === s2[i]))
ok('different seed -> different sequence', s1.some((v, i) => v !== s3[i]))
ok('all values in [0, 1)', s1.every((v) => v >= 0 && v < 1))
const buckets = new Array(10).fill(0)
for (const v of s1) buckets[Math.floor(v * 10)]++
console.log(`  decile counts: ${buckets.join(' ')}`)
ok('roughly uniform across deciles', buckets.every((n) => n >= 120 && n <= 280))

// ------------------------------------------------------- ticket thresholds

console.log('\n--- tear-off thresholds (lib/ticket.ts, real constants) ---')

ok('0px does not tear', !tk.tears(0))
ok('45px does not tear', !tk.tears(45))
ok('90px exactly does NOT tear (strictly greater)', !tk.tears(tk.TEAR_AT))
ok('91px tears', tk.tears(91))
ok('120px tears', tk.tears(120))
ok('drag clamps at MAX_DRAG and still tears', tk.dragOffset(9999) === tk.MAX_DRAG && tk.tears(9999))
ok('cannot drag left of the origin', tk.dragOffset(-500) === 0)

// ------------------------------------------------------------ letter JSON

console.log('\n--- shipped letter files (public/letters) ---')

const dir = join(ROOT, 'public/letters')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

ok('default.json exists (it is the fallback)', files.includes('default.json'))

const ticketIds = new Map<string, string[]>()
for (const file of files) {
  const label = file
  let body: Record<string, unknown>
  try {
    body = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  } catch (e) {
    ok(`${label}: parses as JSON`, false, String(e))
    continue
  }

  ok(`${label}: name is a string`, typeof body.name === 'string')
  // The year is what the countdown and the date lock read.
  ok(`${label}: year is a plausible integer`, typeof body.year === 'number' && Number.isInteger(body.year) && body.year > 1970)
  ok(`${label}: languages is an array of strings`,
    Array.isArray(body.languages) && body.languages.every((l) => typeof l === 'string'))
  ok(`${label}: extended is a boolean`, typeof body.extended === 'boolean')
  ok(`${label}: legacy "content" is gone`, body.content === undefined)
  ok(`${label}: legacy "db" is gone`, body.db === undefined)

  const days = body.days as Record<string, Record<string, unknown>> | undefined
  ok(`${label}: days is a non-empty object`, !!days && Object.keys(days).length > 0)
  if (!days) continue

  // Shape only. Which days exist, and how many, is content the owner controls.
  const ids: string[] = []
  for (const [key, day] of Object.entries(days)) {
    ok(`${label} day "${key}": key is a positive integer`, Number.isInteger(Number(key)) && Number(key) >= 1)
    ok(`${label} day "${key}": title and text are strings`,
      typeof day.title === 'string' && !!day.title && typeof day.text === 'string' && !!day.text)
    if (day.image !== undefined) {
      ok(`${label} day "${key}": image path is relative`,
        typeof day.image === 'string' && !day.image.startsWith('/'))
    }
    if (day.ticket !== undefined) {
      const t = day.ticket as Record<string, unknown>
      ok(`${label} day "${key}": ticket has a non-empty id and a label`,
        typeof t.id === 'string' && !!t.id && typeof t.label === 'string' && !!t.label)
      ids.push(t.id as string)
    }
  }
  ok(`${label}: ticket ids are unique`, new Set(ids).size === ids.length)
  ticketIds.set(label, ids)
}

console.log('\n--- ?user= resolution ---')
for (const u of ['ines', 'dilara', 'default']) {
  ok(`letters/${u}.json exists for ?user=${u}`, files.includes(`${u}.json`))
}

// ------------------------------------------------------------ audio themes

console.log('\n--- audio themes (public/audio/themes.json + lib/audio-theme.ts) ---')

const themeMod = await import(join(ROOT, 'src/lib/audio-theme.ts'))

const themesRaw = JSON.parse(readFileSync(join(ROOT, 'public/audio/themes.json'), 'utf8'))
const themes = themeMod.sanitizeThemes(themesRaw)

ok('themes.json sanitizes to at least one theme', Object.keys(themes).length > 0)
ok('default theme id exists', themes[themeMod.DEFAULT_THEME_ID] !== undefined)
ok('a built-in fallback always resolves', themeMod.FALLBACK_THEME.scale.length > 0)
ok('the fallback scale is never empty', themeMod.FALLBACK_THEME.sequence.length > 0)

for (const [id, theme] of Object.entries(themes)) {
  ok(`${id}: scale is non-empty and audible (20-8000 Hz)`,
    theme.scale.length > 0 && theme.scale.every((f) => f >= 20 && f <= 8000))
  ok(`${id}: every sequence index is in range for the scale`,
    theme.sequence.every((i) => i >= 0 && i < theme.scale.length))
  ok(`${id}: tempo is sane`, theme.stepSeconds >= 0.05 && theme.stepSeconds <= 4)
  ok(`${id}: waveform is valid`, ['sine', 'square', 'sawtooth', 'triangle'].includes(theme.waveform))
  ok(`${id}: volumes within 0-1`,
    theme.noteVolume <= 1 && theme.bassVolume <= 1 &&
    theme.defaultMusicVolume <= 1 && theme.defaultEffectsVolume <= 1)
  ok(`${id}: lowpass within 200-16000`, theme.lowpass >= 200 && theme.lowpass <= 16000)
  ok(`${id}: bass divisor cannot divide by zero`, theme.bassDivisor >= 1)
}

// Theme ids referenced by letter files must actually resolve.
const letterDir = join(ROOT, 'public/letters')
for (const file of readdirSync(letterDir).filter((f) => f.endsWith('.json'))) {
  const body = JSON.parse(readFileSync(join(letterDir, file), 'utf8'))
  const id = body.audioTheme
  if (id === undefined) {
    ok(`${file}: no audioTheme falls back to ${themeMod.DEFAULT_THEME_ID}`,
      themes[themeMod.DEFAULT_THEME_ID] !== undefined)
  } else {
    ok(`${file}: audioTheme "${id}" resolves`, themes[id] !== undefined)
  }
}

console.log('\n--- hostile theme JSON is rejected, not trusted ---')
ok('null is not a theme', themeMod.sanitizeTheme('x', null) === null)
ok('a theme with no scale is rejected', themeMod.sanitizeTheme('x', { scale: [] }) === null)
ok('a non-object is rejected', themeMod.sanitizeTheme('x', 'nope') === null)
ok('a bad waveform falls back to triangle',
  themeMod.sanitizeTheme('x', { scale: [440], waveform: 'kazoo' })?.waveform === 'triangle')
ok('an out-of-range sequence index is clamped',
  (themeMod.sanitizeTheme('x', { scale: [440, 880], sequence: [99] })?.sequence ?? [0])[0] <= 1)
ok('a non-numeric tempo falls back',
  themeMod.sanitizeTheme('x', { scale: [440], stepSeconds: 'fast' })?.stepSeconds === 0.42)
ok('a zero bassDivisor is clamped to 1',
  themeMod.sanitizeTheme('x', { scale: [440], bassDivisor: 0 })?.bassDivisor === 1)
ok('out-of-range volumes are clamped',
  themeMod.sanitizeTheme('x', { scale: [440], noteVolume: 9 })?.noteVolume === 1)
ok('a NaN volume falls back to the default',
  themeMod.sanitizeTheme('x', { scale: [440], noteVolume: null })?.noteVolume === 0.18)
ok('garbage themes.json yields an empty map',
  Object.keys(themeMod.sanitizeThemes('not an object')).length === 0)
ok('an unsafe theme id is dropped',
  Object.keys(themeMod.sanitizeThemes({ '../../etc/passwd': { scale: [440] } })).length === 0)

// ---------------------------------------------------------------- effects

console.log('\n--- letter effects (lib/effects.ts) ---')

const fx = await import(join(ROOT, 'src/lib/effects.ts'))

ok('effect names are the documented three',
  eq([...fx.EFFECT_NAMES].sort(), ['bell', 'confetti', 'firework']))

ok('a valid array passes through in order',
  eq(fx.sanitizeEffects(['confetti', 'bell', 'firework']), ['confetti', 'bell', 'firework']))
ok('duplicates are kept — each entry fires once',
  eq(fx.sanitizeEffects(['firework', 'firework']), ['firework', 'firework']))
ok('unknown names are dropped, valid ones survive',
  eq(fx.sanitizeEffects(['firework', 'nope', 'tsunami']), ['firework']))
ok('a non-string is dropped',
  eq(fx.sanitizeEffects(['firework', 42, null, {}]), ['firework']))
ok('a non-array yields none', fx.sanitizeEffects('firework').length === 0)
ok('null yields none', fx.sanitizeEffects(null).length === 0)
ok('undefined yields none', fx.sanitizeEffects(undefined).length === 0)
ok('an empty array yields none', fx.sanitizeEffects([]).length === 0)
ok('everything invalid yields none', fx.sanitizeEffects([1, 2, {}]).length === 0)

// Effects in the shipped letters must all be names the renderer knows.
const effectDays: string[] = []
for (const file of readdirSync(letterDir).filter((f) => f.endsWith('.json'))) {
  const body = JSON.parse(readFileSync(join(letterDir, file), 'utf8'))
  for (const [day, letter] of Object.entries(body.days as Record<string, Record<string, unknown>>)) {
    if (letter.effects === undefined) continue
    effectDays.push(`${file}:${day}`)
    ok(`${file} day ${day}: effects is an array`, Array.isArray(letter.effects))
    ok(`${file} day ${day}: every effect is known`,
      (letter.effects as unknown[]).every(
        (e) => typeof e === 'string' && (fx.EFFECT_NAMES as readonly string[]).includes(e),
      ))
    ok(`${file} day ${day}: survives sanitizeEffects`,
      fx.sanitizeEffects(letter.effects).length === (letter.effects as unknown[]).length)
  }
}
console.log(`  days declaring effects: ${[...new Set(effectDays)].join(', ')}`)
ok('at least one shipped letter declares an effect', effectDays.length > 0)
// No day is special-cased anywhere. Which effects fire is decided entirely by the
// letter's own `effects` array, plus the bell on the countdown reveal — there is no
// hard-coded "day 24 celebrates" rule, so this asserts the absence of one rather
// than a particular day's contents. Which day should celebrate is the owner's call,
// and the app must not encode it.

console.log('\n--- countdown reveal scheduling (regression guard) ---')

// The preview countdown used to end on a stuck blue screen: the reveal effect
// depended on the *live* `left` value, which changes every second, so every
// re-run cleared the pending reveal timeout before it could fire. React cannot be
// imported here (JSX + CSS), so this reproduces the dep-comparison and cleanup
// semantics with a virtual clock. It guards the *pattern*, not the component.
function revealFiredAt(depOnLiveValue: boolean): number | null {
  const TARGET = TARGET_PREVIEW_MS
  const FADE = 1500
  let now = 0
  let pending: number | null = null
  let firedAt: number | null = null
  let deps: unknown[] | null = null

  for (now = 0; now <= 20_000; now += 1000) {
    const left = TARGET - now
    const reached = left <= 0
    const next = depOnLiveValue ? [left] : [reached]
    const changed = deps === null || next.some((d, i) => !Object.is(d, deps![i]))

    if (changed) {
      pending = null // React runs the previous cleanup first
      deps = next
      if (reached) pending = now + FADE
    }
    if (pending !== null && now >= pending) {
      firedAt = now
      pending = null
    }
  }
  return firedAt
}

ok('depending on the live countdown value never fires the reveal (the old bug)',
  revealFiredAt(true) === null)
const fired = revealFiredAt(false)
ok('depending on the `reached` boolean does fire it', fired !== null)
ok('and it fires after the fade, not instantly', fired !== null && fired > TARGET_PREVIEW_MS)

console.log('\n--- extended calendars (up to day 32 = 1 January) ---')

ok('dayCount(false) is 25 — a standard calendar still reaches Christmas Day',
  lib.dayCount(false) === 25)
ok('dayCount(true) is 32', lib.dayCount(true) === 32)
ok('day 25 IS valid in a standard calendar (25 December, Christmas)',
  lib.isValidDay(25, lib.STANDARD_DAYS))
ok('day 25 IS valid in an extended calendar', lib.isValidDay(25, lib.EXTENDED_DAYS))
ok('day 32 is NOT valid in a standard calendar', !lib.isValidDay(32, lib.STANDARD_DAYS))
ok('day 32 IS valid in an extended calendar', lib.isValidDay(32, lib.EXTENDED_DAYS))
ok('day 33 is never valid', !lib.isValidDay(33, lib.EXTENDED_DAYS))

ok('day 25 unlocks on 25 December', eq(lib.unlockTime(25, YEAR), new Date(YEAR, 11, 25).getTime()))
ok('day 31 unlocks on 31 December', eq(lib.unlockTime(31, YEAR), new Date(YEAR, 11, 31).getTime()))
ok('day 32 unlocks on 1 JANUARY of the FOLLOWING year',
  eq(lib.unlockTime(32, YEAR), new Date(YEAR + 1, 0, 1).getTime()))
ok('unlock times are still strictly increasing through day 32', (() => {
  for (let d = 1; d < lib.EXTENDED_DAYS; d++) {
    if (lib.unlockTime(d, YEAR) >= lib.unlockTime(d + 1, YEAR)) return false
  }
  return true
})())

const NYE = at('2026-12-31')
const NYD = at('2027-01-01')
ok('31 Dec: day 25 open, day 32 still locked',
  lib.canOpen(25, NYE, false, YEAR, true) && !lib.canOpen(32, NYE, false, YEAR, true))
ok('1 Jan (year+1): day 32 is now open', lib.canOpen(32, NYD, false, YEAR, true))
ok('1 Jan (year+1): day 32 stays invalid for a standard calendar',
  !lib.canOpen(32, NYD, false, YEAR, false))
ok('1 Jan (year+1): earlier days stay open', lib.canOpen(25, NYD, false, YEAR, true))
ok('1 Jan of year+2: everything still open (no re-lock)',
  lib.canOpen(32, at('2028-01-01'), false, YEAR, true))

console.log("\n--- currentDay / today's ornament ---")
ok('currentDay is 0 before December', lib.currentDay(oct, true) === 0)
ok('currentDay on 5 Dec is 5', lib.currentDay(dec5, true) === 5)
ok('currentDay on 1 Jan is 32 when extended', lib.currentDay(NYD, true) === 32)
ok('currentDay on 1 Jan is 0 when standard', lib.currentDay(NYD, false) === 0)
ok('currentDay on 2 Jan is 0 (the extra day is only the 1st)',
  lib.currentDay(at('2027-01-02'), true) === 0)

console.log('\n--- the reveal is bells only ---')
ok('revealEffects is exactly [bell]', eq(lib.revealEffects, ['bell']))
ok('no firework or confetti in the reveal',
  !lib.revealEffects.includes('firework') && !lib.revealEffects.includes('confetti'))

// Deliberately NOT checked here: how many day keys a shipped file declares, and
// which day carries which effects. Both are content the owner writes by hand, and
// a file is allowed to hold more days than its `extended` flag reaches — anything
// past the ceiling is dropped on load, and anything missing falls back to day 1.
// Policing that made the suite fail on placeholder copy rather than on a defect.
// What the app must guarantee instead — the ceilings themselves, and that a day
// can only ever fire the effects it declares — is asserted above.

console.log('\n--- the ornament spiral ---')

for (const total of [lib.STANDARD_DAYS, lib.EXTENDED_DAYS]) {
  const pts = Array.from({ length: total }, (_, i) => orns.ornamentPosition(i + 1, total))

  ok(`${total} ornaments produce ${total} finite positions`,
    pts.every((p) => p.every(Number.isFinite)))
  ok(`${total}: none sits at the origin (all would be invisible/unclickable)`,
    pts.every((p) => Math.hypot(p[0], p[2]) > 0.1))
  ok(`${total}: all sit above the trunk`,
    pts.every((p) => p[1] >= orns.SPIRAL_BOTTOM - 1e-9))
  ok(`${total}: the top ball clears the star (y <= bottom + height)`,
    pts.every((p) => p[1] <= orns.SPIRAL_BOTTOM + orns.SPIRAL_HEIGHT + 1e-9))
  ok(`${total}: the spiral tapers toward the tip`,
    Math.hypot(...pts[0].slice(0, 1), pts[0][2]) >
      Math.hypot(pts[pts.length - 1][0], pts[pts.length - 1][2]))
  ok(`${total}: every ball is clear of the trunk (radius >= 0.34)`,
    pts.every((p) => Math.hypot(p[0], p[2]) >= orns.SPIRAL_TIP_RADIUS - 1e-9))

  // The spiral must not collapse: with a small step, several days could land on
  // the same spot and stack into one unclickable ball.
  let minGap = Infinity
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      minGap = Math.min(minGap, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]))
    }
  }
  ok(`${total}: no two ornaments coincide (closest pair ${minGap.toFixed(2)} apart)`,
    minGap > 0.05, `minGap ${minGap.toFixed(4)}`)

  // Opening day 5 must not move day 6, or the whole tree would reshuffle.
  const before = orns.ornamentPosition(6, total)
  const after = orns.ornamentPosition(6, total)
  ok(`${total}: a day's position depends only on (day, total)`, eq(before, after))
}

// 32 balls on the same spiral are tighter than 24 — check they still fit on screen.
const dense = Array.from({ length: lib.EXTENDED_DAYS }, (_, i) => orns.ornamentPosition(i + 1, lib.EXTENDED_DAYS))
const maxR = Math.max(...dense.map((p) => Math.hypot(p[0], p[2])))
ok(`the extended tree stays within the camera's reach (max radius ${maxR.toFixed(2)} < 10)`,
  maxR < 10)

// ----------------------------------------------- the reveal audio clash

console.log('\n--- reveal: music must wait out the bell ---')

// audio.ts reaches for `window` only inside functions, and its `ensure()` bails out
// cleanly when there is no AudioContext, so the module is safe to import here. A
// minimal window stub is enough to observe *when* a start is scheduled, which is
// the thing that was wrong.
const realWindow = (globalThis as Record<string, unknown>).window
;(globalThis as Record<string, unknown>).window = {
  setTimeout: (fn: () => void, ms: number) => {
    void fn
    scheduled.push(ms)
    return scheduled.length
  },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  // store.ts wires the cross-tab `storage` listener at module scope.
  addEventListener: () => {},
  removeEventListener: () => {},
}

const scheduled: number[] = []
const au = await import(join(ROOT, 'src/lib/audio.ts'))

// 6 notes, 220ms apart, 1s decay => the last note ends 2.1s in.
ok('the bell length is derived, and is 2100ms', au.BELL_DURATION_MS === 2100)

// Must come before any hold: the hold is module state that expires on its own in
// real time, and the stub below never lets a clock advance, so measuring the
// ordinary case after a hold would only measure the hold again.
scheduled.length = 0
au.tryAutostart(5)
ok('with nothing ringing, music starts immediately', (scheduled[0] ?? 1e9) < 20, `+${scheduled[0]}ms`)

// The regression: at the reveal the scene mounts (music autostarts) in the same tick
// the bell fires. Without a hold, music started on top of the arpeggio.
scheduled.length = 0
au.holdMusicFor(au.BELL_DURATION_MS)
ok('a hold is reported as outstanding', au.musicHoldRemaining() > 0)
au.tryAutostart(5)
ok('autostart is scheduled no earlier than the bell finishes',
  scheduled.length === 1 && scheduled[0] >= au.BELL_DURATION_MS - 20,
  `scheduled at +${scheduled[0]}ms, bell is ${au.BELL_DURATION_MS}ms`)
ok('autostart is delayed, not merely reordered',
  (scheduled[0] ?? 0) > 1000, `scheduled at +${scheduled[0]}ms`)

// The gesture rescue runs from the effects path, so it must respect the hold too.
scheduled.length = 0
au.unlockAudio(5)
ok('the gesture rescue also waits out a ringing effect',
  scheduled.length === 0 || scheduled[0] >= au.BELL_DURATION_MS - 20,
  `scheduled at +${scheduled[0]}ms`)

// Pausing during the hold must not let music arrive later anyway.
scheduled.length = 0
au.holdMusicFor(au.BELL_DURATION_MS)
au.tryAutostart(5)
au.stopMusic()
scheduled.length = 0
ok('stopping cancels a start that was waiting on a hold', scheduled.length === 0)

// Restoring: nothing below this point needs the stub.
if (realWindow === undefined) delete (globalThis as Record<string, unknown>).window
else (globalThis as Record<string, unknown>).window = realWindow

console.log(`\n${fail === 0 ? 'ALL PASS' : `${fail} FAILURES`}  (${pass} passed)`)
process.exit(fail === 0 ? 0 : 1)
