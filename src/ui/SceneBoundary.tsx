import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Called when the scene blows up, so the app can switch to the text list. */
  onFailure: () => void
}

interface State {
  failed: boolean
}

/**
 * Feature detection only covers "can a WebGL context be created". The scene can
 * still fail at runtime — a driver crash, a lost context, an out-of-memory GPU.
 * This catches that and hands over to the text list instead of leaving a blank
 * screen.
 *
 * Error boundaries have to be class components; there is no hook equivalent.
 */
export class SceneBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The 3D scene failed; falling back to the text list.', error, info)
    this.props.onFailure()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
