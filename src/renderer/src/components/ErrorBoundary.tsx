/**
 * ErrorBoundary — Enhanced error boundary with recovery options.
 *
 * Catches React errors, reports to Sentry, and provides user-friendly recovery options.
 * Supports workspace-specific error handling and automatic retry.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react'
import { captureException, addBreadcrumb } from '../services/sentry'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Fallback UI when error occurs. If not provided, default error UI is shown. */
  fallback?: ReactNode
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Whether to show technical details (default: false in production) */
  showDetails?: boolean
  /** Component name for error context */
  componentName?: string
  /** Enable automatic retry after delay (in ms) */
  autoRetryDelay?: number
  /** Maximum number of auto-retries */
  maxAutoRetries?: number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
  showTechnicalDetails: boolean
  isRetrying: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showTechnicalDetails: false,
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Add breadcrumb for context
    addBreadcrumb('error', `Error caught in ${this.props.componentName || 'component'}`, 'error', {
      componentStack: errorInfo.componentStack
    })

    // Report to Sentry
    captureException(error, {
      componentName: this.props.componentName,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    })

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Auto-retry if configured
    const { autoRetryDelay, maxAutoRetries = 3 } = this.props
    if (autoRetryDelay && this.state.retryCount < maxAutoRetries) {
      this.scheduleAutoRetry(autoRetryDelay)
    }
  }

  componentWillUnmount(): void {
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer)
    }
  }

  private scheduleAutoRetry(delay: number): void {
    this.autoRetryTimer = setTimeout(() => {
      this.handleRetry()
    }, delay)
  }

  private handleRetry = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: true
    }))

    // Reset isRetrying after a brief moment
    setTimeout(() => {
      this.setState({ isRetrying: false })
    }, 100)
  }

  private handleGoHome = (): void => {
    // Navigate to workspace list or home
    window.location.hash = ''
    window.location.reload()
  }

  private handleReportBug = (): void => {
    const { error, errorInfo } = this.state
    const errorDetails = encodeURIComponent(
      `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent: ${errorInfo?.componentStack}`
    )
    window.open(
      `https://github.com/cognograph/cognograph/issues/new?title=Bug%20Report&body=${errorDetails}`,
      '_blank'
    )
  }

  private toggleTechnicalDetails = (): void => {
    this.setState((prevState) => ({
      showTechnicalDetails: !prevState.showTechnicalDetails
    }))
  }

  render(): ReactNode {
    const { hasError, error, errorInfo, showTechnicalDetails, isRetrying, retryCount } = this.state
    const { children, fallback, showDetails = import.meta.env.DEV, maxAutoRetries = 3 } = this.props

    if (!hasError) {
      return children
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback
    }

    const canAutoRetry = retryCount < maxAutoRetries

    // Default error UI
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)] shadow-lg">
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Something went wrong
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {this.props.componentName
                    ? `Error in ${this.props.componentName}`
                    : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="p-6">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {error?.message || 'Unknown error'}
            </p>

            {/* Auto-retry status */}
            {canAutoRetry && retryCount > 0 && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Auto-retry attempt {retryCount} of {maxAutoRetries}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleRetry}
                disabled={isRetrying}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
              >
                <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors"
              >
                <Home size={16} />
                Go to Home
              </button>

              <button
                onClick={this.handleReportBug}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Bug size={14} />
                Report this issue
              </button>
            </div>
          </div>

          {/* Technical Details (collapsible) */}
          {showDetails && (
            <div className="border-t border-[var(--border-default)]">
              <button
                onClick={this.toggleTechnicalDetails}
                className="flex items-center justify-between w-full p-4 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <span>Technical Details</span>
                {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showTechnicalDetails && (
                <div className="p-4 pt-0">
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg overflow-auto max-h-48">
                    <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
                      {error?.stack || 'No stack trace available'}
                    </pre>
                  </div>

                  {errorInfo?.componentStack && (
                    <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-lg overflow-auto max-h-48">
                      <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                        Component Stack:
                      </p>
                      <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

// -----------------------------------------------------------------------------
// Higher-Order Component
// -----------------------------------------------------------------------------

/**
 * HOC to wrap a component with ErrorBoundary.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...options} componentName={options?.componentName || displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return WithErrorBoundary
}

export default ErrorBoundary
