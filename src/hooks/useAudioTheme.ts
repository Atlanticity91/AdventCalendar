import { useEffect, useState } from 'react'
import {
  FALLBACK_THEME,
  DEFAULT_THEME_ID,
  loadThemes,
  type AudioTheme,
} from '../lib/audio-theme'

/**
 * Resolve the audio theme named by a letter file's `audioTheme` flag.
 *
 * Falls back to `classic` while the themes file is loading, and again if the id
 * does not resolve — a typo in a letter file should never leave the calendar
 * silent. Always returns a theme, so callers never handle null.
 */
export function useAudioTheme(themeId: string | undefined): AudioTheme {
  const [themes, setThemes] = useState<Record<string, AudioTheme> | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadThemes().then((loaded) => {
      if (!cancelled) setThemes(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!themes) return FALLBACK_THEME
  return themes[themeId ?? DEFAULT_THEME_ID] ?? themes[DEFAULT_THEME_ID] ?? FALLBACK_THEME
}
