// Circuit Breaker Pattern
// Generic circuit breaker for resilient API calls

interface CircuitBreakerState {
  failures: Array<{ timestamp: number }>
  state: 'closed' | 'open' | 'half-open'
  lastProbeTime: number
}

export interface CircuitBreakerOptions {
  /** Sliding window duration for counting failures (ms) */
  windowMs?: number
  /** Number of failures within window to trip the breaker */
  failureThreshold?: number
  /** Cooldown before attempting half-open probe (ms) */
  cooldownMs?: number
}

/**
 * Circuit breaker for resilient API calls.
 *
 * States:
 * - CLOSED: Normal operation, all requests allowed
 * - OPEN: Too many failures, all requests blocked
 * - HALF-OPEN: Cooldown elapsed, one probe request allowed
 *
 * Example:
 *   const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 60000 })
 *
 *   try {
 *     await breaker.call(async () => {
 *       const response = await fetch('https://api.example.com')
 *       return response.json()
 *     })
 *   } catch (err) {
 *     if (err.message === 'Circuit breaker is OPEN') {
 *       // Handle service unavailable
 *     }
 *   }
 */
export class CircuitBreaker {
  private state: CircuitBreakerState
  private readonly windowMs: number
  private readonly failureThreshold: number
  private readonly cooldownMs: number

  constructor(options: CircuitBreakerOptions = {}) {
    this.windowMs = options.windowMs ?? 60000 // 60 seconds
    this.failureThreshold = options.failureThreshold ?? 5
    this.cooldownMs = options.cooldownMs ?? 60000 // 60 seconds

    this.state = {
      failures: [],
      state: 'closed',
      lastProbeTime: 0
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   * Throws if circuit is open.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.shouldAllowRequest()) {
      throw new Error('Circuit breaker is OPEN')
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (err) {
      this.recordFailure()
      throw err
    }
  }

  private recordFailure(): void {
    const now = Date.now()
    this.state.failures.push({ timestamp: now })

    // Remove failures outside the sliding window
    this.state.failures = this.state.failures.filter(
      f => now - f.timestamp < this.windowMs
    )

    // Trip if threshold exceeded
    if (this.state.failures.length >= this.failureThreshold) {
      this.state.state = 'open'
      console.warn('[CircuitBreaker] OPEN - too many failures')
    }
  }

  private recordSuccess(): void {
    // Clear failures and close circuit
    this.state.failures = []
    if (this.state.state !== 'closed') {
      console.log('[CircuitBreaker] CLOSED - connection restored')
    }
    this.state.state = 'closed'
  }

  private shouldAllowRequest(): boolean {
    const now = Date.now()

    if (this.state.state === 'closed') {
      return true
    }

    if (this.state.state === 'open') {
      // Check if cooldown has elapsed - if so, enter half-open
      const lastFailure = this.state.failures[this.state.failures.length - 1]
      if (lastFailure && now - lastFailure.timestamp > this.cooldownMs) {
        this.state.state = 'half-open'
        this.state.lastProbeTime = now
        console.log('[CircuitBreaker] HALF-OPEN - attempting probe')
        return true // Allow one probe request
      }
      return false
    }

    // half-open: already sent probe, wait for result
    return false
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state.state
  }

  /** Reset the circuit breaker to closed state (for testing/admin) */
  reset(): void {
    this.state.failures = []
    this.state.state = 'closed'
    this.state.lastProbeTime = 0
  }
}
