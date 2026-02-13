/**
 * Error Boundary for AI Property Assist in Compact Mode
 *
 * Prevents AI service failures from crashing entire node components.
 * Shows graceful degradation UI in compact mode.
 */

import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  compact?: boolean
}

interface State {
  hasError: boolean
  error?: Error
}

export class NodeAIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Sanitize error before logging (don't expose sensitive context)
    console.error('[AI Property Assist] Error:', {
      message: error.message,
      name: error.name,
      // Don't log full error object which might contain prompts/API keys
    })
  }

  render() {
    if (this.state.hasError && this.props.compact) {
      // Compact error UI - just disable button gracefully
      return (
        <button
          disabled
          className="p-1.5 rounded gui-text-secondary opacity-50 cursor-not-allowed"
          title="AI suggestions temporarily unavailable"
        >
          <AlertCircle className="w-3.5 h-3.5" />
        </button>
      )
    }

    if (this.state.hasError && !this.props.compact) {
      // Full error UI - show detailed error state
      return (
        <div className="p-4 gui-panel-secondary rounded border gui-border">
          <div className="flex items-center gap-2 gui-text mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="font-medium">AI Feature Error</span>
          </div>
          <p className="text-sm gui-text-secondary">
            Something went wrong with AI property suggestions. Please refresh the page.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-2 text-xs gui-text-secondary">
              <summary className="cursor-pointer hover:gui-text">Error details</summary>
              <pre className="mt-1 p-2 gui-panel rounded overflow-auto">
                {this.state.error?.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
