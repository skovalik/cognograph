/**
 * Sentry Integration — Renderer Process Error Tracking
 *
 * Initializes Sentry for the React renderer process.
 * Captures component errors, network failures, and user interactions.
 */

import * as Sentry from '@sentry/electron/renderer'

// Type declaration for Vite's import.meta.env
declare global {
  interface ImportMeta {
    env: {
      VITE_SENTRY_DSN?: string
      VITE_APP_VERSION?: string
      MODE: string
      PROD: boolean
      DEV: boolean
    }
  }
}

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

let isInitialized = false

/**
 * Initialize Sentry for the renderer process.
 */
export function initSentry(): void {
  if (isInitialized) return
  if (!SENTRY_DSN) {
    console.log('[Sentry] No DSN configured, error tracking disabled')
    return
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE || 'development',
      release: `cognograph@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,

      // Only send errors in production
      enabled: import.meta.env.PROD,

      // Sample rate for performance monitoring
      tracesSampleRate: 0.1,

      // Replay configuration (capture 10% of sessions, 100% on error)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      integrations: [
        // Capture console errors
        Sentry.breadcrumbsIntegration({
          console: true,
          dom: true,
          fetch: true,
          history: true,
          sentry: true,
          xhr: true
        }),
        // React-specific error boundary integration
        Sentry.browserTracingIntegration(),
        // Session replay for debugging
        Sentry.replayIntegration({
          // Mask all text and block all media by default
          maskAllText: true,
          blockAllMedia: true
        })
      ],

      // Filter sensitive data
      beforeSend(event) {
        // Remove potential PII from error messages
        if (event.message) {
          // Remove email-like patterns
          event.message = event.message.replace(
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            '[email]'
          )
          // Remove potential tokens/keys
          event.message = event.message.replace(
            /[a-zA-Z0-9_-]{32,}/g,
            '[token]'
          )
        }
        return event
      },

      // Filter breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Don't log sensitive fetch URLs
        if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
          const url = breadcrumb.data.url as string
          if (url.includes('token') || url.includes('auth') || url.includes('stripe')) {
            breadcrumb.data.url = '[redacted]'
          }
        }
        return breadcrumb
      }
    })

    isInitialized = true
    console.log('[Sentry] Initialized for renderer process')
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err)
  }
}

/**
 * Set user context for error tracking.
 */
export function setUser(userId: string | null): void {
  if (!isInitialized) return

  if (userId) {
    Sentry.setUser({ id: userId })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Set workspace context.
 */
export function setWorkspaceContext(workspaceId: string | null, workspaceName?: string): void {
  if (!isInitialized) return

  if (workspaceId) {
    Sentry.setContext('workspace', {
      id: workspaceId,
      name: workspaceName || 'Unknown'
    })
  } else {
    Sentry.setContext('workspace', null)
  }
}

/**
 * Set connection context.
 */
export function setConnectionContext(
  status: 'connected' | 'disconnected' | 'reconnecting',
  isHost: boolean,
  peerCount: number
): void {
  if (!isInitialized) return

  Sentry.setContext('connection', {
    status,
    isHost,
    peerCount
  })
}

/**
 * Add a breadcrumb for user actions.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
): void {
  if (!isInitialized) return

  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
    timestamp: Date.now() / 1000
  })
}

/**
 * Capture an exception with optional context.
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string {
  if (!isInitialized) {
    console.error('[Sentry] Not initialized, error not sent:', error)
    return ''
  }

  return Sentry.captureException(error, {
    extra: context
  })
}

/**
 * Capture a message.
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info'
): string {
  if (!isInitialized) {
    console.log('[Sentry] Not initialized, message not sent:', message)
    return ''
  }

  return Sentry.captureMessage(message, level)
}

// Note: withErrorBoundary and ErrorBoundary are not available in @sentry/electron/renderer
// Use the custom ErrorBoundary component from components/ErrorBoundary.tsx instead
