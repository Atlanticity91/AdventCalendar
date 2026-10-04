/**
 * Feature-detect WebGL, memoised at module level so it can be read during render
 * without creating a throwaway canvas on every tick.
 *
 * Returns false when WebGL is missing or the context cannot be created — the two
 * cases where the 3D calendar cannot be used at all, and where the text-only
 * list should be offered instead.
 */
let cached: boolean | null = null

function detect(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null)
    if (!gl) return false

    // Hand the context straight back rather than leaving a live one around.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

export function hasWebGL(): boolean {
  cached ??= detect()
  return cached
}
