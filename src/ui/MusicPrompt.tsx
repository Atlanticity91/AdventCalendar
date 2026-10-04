import { startMusicFromGesture, useNeedsGesture } from '../lib/audio'
import './MusicPrompt.css'

/**
 * Shown only when an autoplay attempt was refused.
 *
 * Browsers suspend an AudioContext created without a user gesture, so on a first
 * visit there is no way to start music without one. Rather than leave the visitor
 * to find the Sound tab and wonder why the calendar is silent, this says so
 * plainly and gives them the one tap that unlocks it.
 *
 * It disappears the moment music is actually playing, and never appears for
 * someone who deliberately turned music off — `needsGesture` is false in that case.
 */
export function MusicPrompt({ day }: { day: number }) {
  const needed = useNeedsGesture()

  if (!needed) return null

  return (
    <button
      type="button"
      className="music-prompt"
      onClick={() => startMusicFromGesture(day)}
      aria-label="Turn on the music"
    >
      <span aria-hidden="true">♪</span>
      <span>Tap for music</span>
    </button>
  )
}