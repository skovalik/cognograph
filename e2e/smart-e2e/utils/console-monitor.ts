/**
 * Console Error Monitoring
 *
 * Tracks console errors, warnings, and uncaught exceptions during tests.
 */

import type { Page } from '@playwright/test'

export interface ConsoleEntry {
  type: 'log' | 'info' | 'warn' | 'error' | 'uncaught'
  message: string
  timestamp: number
  stack?: string
}

export class ConsoleMonitor {
  private entries: ConsoleEntry[] = []

  constructor(page: Page) {
    // Track console messages
    page.on('console', (msg) => {
      this.entries.push({
        type: msg.type() as any,
        message: msg.text(),
        timestamp: Date.now()
      })
    })

    // Track uncaught errors
    page.on('pageerror', (err) => {
      this.entries.push({
        type: 'uncaught',
        message: err.message,
        timestamp: Date.now(),
        stack: err.stack
      })
    })
  }

  /**
   * Get all errors
   */
  getErrors(): ConsoleEntry[] {
    return this.entries.filter((e) => e.type === 'error' || e.type === 'uncaught')
  }

  /**
   * Get all warnings
   */
  getWarnings(): ConsoleEntry[] {
    return this.entries.filter((e) => e.type === 'warn')
  }

  /**
   * Get all entries
   */
  getAll(): ConsoleEntry[] {
    return [...this.entries]
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = []
  }

  /**
   * Assert no critical errors
   */
  assertNoErrors(allowList: string[] = []): void {
    const errors = this.getErrors()

    // Filter out allowed errors
    const criticalErrors = errors.filter((err) => {
      return !allowList.some((pattern) => err.message.includes(pattern))
    })

    if (criticalErrors.length > 0) {
      const errorList = criticalErrors.map((e) => `  [${e.type}] ${e.message}`).join('\n')
      throw new Error(`Console errors detected:\n${errorList}`)
    }
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.getErrors().length
  }

  /**
   * Get warning count
   */
  getWarningCount(): number {
    return this.getWarnings().length
  }
}
