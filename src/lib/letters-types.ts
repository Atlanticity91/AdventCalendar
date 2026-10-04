import type { EffectName } from './effects'

export interface Ticket {
  id: string
  label: string
  note?: string
}

export interface LetterContent {
  title: string
  text: string
  image?: string
  ticket?: Ticket
  /** Fired when this letter opens, in order. See lib/effects.ts. */
  effects?: EffectName[]
}