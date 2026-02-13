/**
 * Sentry Integration — Main Process Error Tracking
 *
 * Initializes Sentry for the Electron main process.
 * Captures uncaught exceptions, unhandled rejections, and manual error reports.
 */

import * as Sentry from '@sentry/electron/main'
import { app } from 'electron'

const SENTRY_DSN = process.env.SENTRY_DSN || ''

let isInitialized = false

/**
 * Initialize Sentry for the main process.
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
      environment: process.env.NODE_ENV || 'development',
      release: `cognograph@${app.getVersion()}`,

      // Only send errors in production
      enabled: process.env.NODE_ENV === 'production',

      // Sample rate for performance monitoring
      tracesSampleRate: 0.1,

      // Configure integrations
      // Note: breadcrumbsIntegration is not available in @sentry/electron/main
      // Using default integrations which include console and fetch breadcrumbs
      integrations: [],

      // Filter sensitive data
      beforeSend(event) {
        // Remove file paths that might contain usernames
        if (event.exception?.values) {
          event.exception.values.forEach((value) => {
            if (value.stacktrace?.frames) {
              value.stacktrace.frames.forEach((frame) => {
                if (frame.filename) {
                  // Normalize paths to remove user-specific directories
                  frame.filename = frame.filename.replace(
                    /\/Users\/[^/]+\//g,
                    '/Users/[redacted]/'
                  )
                  frame.filename = frame.filename.replace(
                    /C:\\Users\\[^\\]+\\/g,
                    'C:\\Users\\[redacted]\\'
                  )
                }
              })
            }
          })
        }
        return event
      },

      // Filter breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Don't log sensitive IPC messages
        if (breadcrumb.category === 'ipc' && breadcrumb.data?.channel) {
          const sensitiveChannels = ['token', 'auth', 'password', 'secret']
          if (sensitiveChannels.some(c => breadcrumb.data?.channel?.includes(c))) {
            breadcrumb.data = { channel: '[redacted]' }
          }
        }
        return breadcrumb
      }
    })

    isInitialized = true
    console.log('[Sentry] Initialized for main process')
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
 * Set additional context.
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!isInitialized) return
  Sentry.setContext(name, context)
}

/**
 * Add a breadcrumb.
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
 * Capture an exception.
 */
export function captureException(error: Error, context?: Record<string, unknown>): string {
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

/**
 * Flush pending events before app quits.
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (!isInitialized) return true

  try {
    await Sentry.flush(timeout)
    return true
  } catch {
    return false
  }
}
