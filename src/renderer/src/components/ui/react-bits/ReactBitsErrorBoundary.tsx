/**
 * Error boundary for React Bits visual effect components.
 *
 * React Bits components are copied source code that may throw during render
 * (canvas context creation failure, GSAP DOM mutation conflict, WebGL context lost).
 * This boundary catches those errors and renders a static CSS fallback so a single
 * effect failure never crashes the entire node or panel.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  /** Static fallback to render when the effect errors. Defaults to rendering children without effects. */
  fallback?: ReactNode
  /** Name of the wrapped component, used in the warning log */
  componentName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ReactBitsErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(
      `[ReactBits] ${this.props.componentName ?? 'Unknown'} failed to render:`,
      error.message,
      info.componentStack,
    )
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? this.props.children
    }
    return this.props.children
  }
}
