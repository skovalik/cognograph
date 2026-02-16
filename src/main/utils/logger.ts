/**
 * Development logger utility for main process
 *
 * In production builds, only errors and warnings are logged.
 * Debug logs are stripped to improve performance and reduce noise.
 */

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

export const logger = {
  /**
   * Log debug information (development only)
   */
  log: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * Log errors (always logged)
   */
  error: (...args: unknown[]): void => {
    console.error(...args)
  },

  /**
   * Log warnings (always logged)
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },

  /**
   * Log informational messages (development only)
   */
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.info(...args)
    }
  },

  /**
   * Log debug messages (development only)
   */
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.debug(...args)
    }
  }
}
