// Letter effects. A letter may carry an `effects` array in its JSON; opening that
// letter fires each entry in turn. Nothing is keyed to a day number — day 24 and
// 25 are just the days that happen to declare an effect.
//
// This is display-only. It is not a security control and reveals nothing that the
// letters themselves do not already ship.

export const EFFECT_NAMES = ['firework', 'confetti', 'bell'] as const

export type EffectName = (typeof EFFECT_NAMES)[number]

/** Unknown names are dropped rather than failing the whole letter. */
export function sanitizeEffects(raw: unknown): EffectName[] {
  if (!Array.isArray(raw)) return []
  const out: EffectName[] = []
  for (const value of raw) {
    if (typeof value === 'string' && (EFFECT_NAMES as readonly string[]).includes(value)) {
      out.push(value as EffectName)
    }
  }
  return out
}
