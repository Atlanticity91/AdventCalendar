/** Total on-screen life of a toast, in ms. Must match the `toast-life` keyframe
 *  duration in Toast.css — App unmounts the toast after this long. */
export const TOAST_DURATION = 1800

export interface ToastState {
  /** Bumped on every new toast so React remounts the node and replays the CSS
   *  animation, even when the text is identical to the previous one. */
  id: number
  message: string
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null

  return (
    <div className="toast" key={toast.id} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}