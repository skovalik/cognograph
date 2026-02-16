/**
 * Health Check Service — Client-side server health polling.
 *
 * Periodically checks server health and updates connection status.
 * Triggers reconnection attempts when server becomes available.
 */

import { addBreadcrumb, captureMessage } from './sentry'
import { logger } from '../utils/logger'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unreachable'

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  uptime: number
  timestamp: string
}

export interface HealthCheckOptions {
  /** Server base URL */
  serverUrl: string
  /** Polling interval in ms (default: 30000 = 30s) */
  interval?: number
  /** Request timeout in ms (default: 5000 = 5s) */
  timeout?: number
  /** Callback when status changes */
  onStatusChange?: (status: HealthStatus, response?: HealthResponse) => void
  /** Callback when server becomes available after being unreachable */
  onServerAvailable?: () => void
}

// -----------------------------------------------------------------------------
// Health Check Manager
// -----------------------------------------------------------------------------

class HealthCheckManager {
  private serverUrl: string = ''
  private interval: number = 30000
  private timeout: number = 5000
  private onStatusChange?: (status: HealthStatus, response?: HealthResponse) => void
  private onServerAvailable?: () => void

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private currentStatus: HealthStatus = 'unreachable'
  private consecutiveFailures: number = 0
  private lastResponse: HealthResponse | null = null
  private isPolling: boolean = false

  /**
   * Start health polling with given options.
   */
  start(options: HealthCheckOptions): void {
    this.serverUrl = options.serverUrl
    this.interval = options.interval ?? 30000
    this.timeout = options.timeout ?? 5000
    this.onStatusChange = options.onStatusChange
    this.onServerAvailable = options.onServerAvailable

    // Stop any existing polling
    this.stop()

    // Initial check
    this.check()

    // Start periodic polling
    this.pollTimer = setInterval(() => {
      this.check()
    }, this.interval)

    logger.log('[HealthCheck] Started polling', { url: this.serverUrl, interval: this.interval })
  }

  /**
   * Stop health polling.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.isPolling = false
  }

  /**
   * Perform a single health check.
   */
  async check(): Promise<HealthStatus> {
    if (this.isPolling) {
      return this.currentStatus
    }

    this.isPolling = true

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.serverUrl}/health/ready`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: HealthResponse = await response.json()
      this.handleHealthResponse(data)

    } catch (error) {
      this.handleHealthError(error)
    } finally {
      this.isPolling = false
    }

    return this.currentStatus
  }

  /**
   * Get current health status.
   */
  getStatus(): HealthStatus {
    return this.currentStatus
  }

  /**
   * Get last health response.
   */
  getLastResponse(): HealthResponse | null {
    return this.lastResponse
  }

  /**
   * Check if server is reachable.
   */
  isReachable(): boolean {
    return this.currentStatus !== 'unreachable'
  }

  private handleHealthResponse(response: HealthResponse): void {
    const previousStatus = this.currentStatus
    const wasUnreachable = previousStatus === 'unreachable'

    this.lastResponse = response
    this.consecutiveFailures = 0

    // Map server status to our status
    switch (response.status) {
      case 'healthy':
        this.currentStatus = 'healthy'
        break
      case 'degraded':
        this.currentStatus = 'degraded'
        break
      case 'unhealthy':
        this.currentStatus = 'unhealthy'
        break
    }

    // Notify if status changed
    if (previousStatus !== this.currentStatus) {
      addBreadcrumb('health', `Server status: ${this.currentStatus}`, 'info', {
        previous: previousStatus,
        serverVersion: response.version,
        uptime: response.uptime
      })

      this.onStatusChange?.(this.currentStatus, response)

      // Special handling for server becoming available
      if (wasUnreachable) {
        logger.log('[HealthCheck] Server is now available')
        this.onServerAvailable?.()
      }
    }
  }

  private handleHealthError(error: unknown): void {
    const previousStatus = this.currentStatus
    this.consecutiveFailures++

    // After 3 consecutive failures, mark as unreachable
    if (this.consecutiveFailures >= 3) {
      this.currentStatus = 'unreachable'
    }

    // Notify if status changed to unreachable
    if (previousStatus !== 'unreachable' && this.currentStatus === 'unreachable') {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      addBreadcrumb('health', 'Server unreachable', 'warning', {
        error: errorMessage,
        failures: this.consecutiveFailures
      })

      console.warn('[HealthCheck] Server unreachable', { error: errorMessage })
      this.onStatusChange?.(this.currentStatus)

      // Log to Sentry if this is unexpected
      if (this.consecutiveFailures === 3) {
        captureMessage('Server became unreachable', 'warning')
      }
    }
  }
}

// Singleton instance
export const healthCheckManager = new HealthCheckManager()

// -----------------------------------------------------------------------------
// React Hooks
// -----------------------------------------------------------------------------

import { useState, useEffect } from 'react'

/**
 * Hook to track server health status.
 */
export function useServerHealth(serverUrl?: string): {
  status: HealthStatus
  response: HealthResponse | null
  isReachable: boolean
  checkNow: () => Promise<HealthStatus>
} {
  const [status, setStatus] = useState<HealthStatus>(healthCheckManager.getStatus())
  const [response, setResponse] = useState<HealthResponse | null>(healthCheckManager.getLastResponse())

  useEffect(() => {
    if (serverUrl) {
      healthCheckManager.start({
        serverUrl,
        onStatusChange: (newStatus, newResponse) => {
          setStatus(newStatus)
          if (newResponse) {
            setResponse(newResponse)
          }
        }
      })

      return () => {
        healthCheckManager.stop()
      }
    }
  }, [serverUrl])

  return {
    status,
    response,
    isReachable: status !== 'unreachable',
    checkNow: () => healthCheckManager.check()
  }
}

/**
 * Simple hook to check if server is reachable.
 */
export function useIsServerReachable(): boolean {
  const [isReachable, setIsReachable] = useState(healthCheckManager.isReachable())

  useEffect(() => {
    // Check periodically
    const checkInterval = setInterval(() => {
      setIsReachable(healthCheckManager.isReachable())
    }, 5000)

    return () => clearInterval(checkInterval)
  }, [])

  return isReachable
}
