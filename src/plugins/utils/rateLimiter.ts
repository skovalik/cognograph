// Token Bucket Rate Limiter
// Generic rate limiting utility for API calls

interface TokenBucketState {
  tokens: number
  lastRefill: number
}

export interface RateLimiterOptions {
  /** Burst capacity (max tokens that can accumulate) */
  capacity?: number
  /** Tokens added per second */
  tokensPerSecond?: number
}

/**
 * Token bucket rate limiter.
 * Allows bursts up to `capacity`, refills at `tokensPerSecond`.
 *
 * Example:
 *   const limiter = new TokenBucketRateLimiter({ capacity: 3, tokensPerSecond: 1 })
 *   await limiter.acquire()  // Waits if no tokens available
 */
export class TokenBucketRateLimiter {
  private state: TokenBucketState
  private readonly capacity: number
  private readonly refillRate: number
  private readonly refillInterval = 1000 // 1 second in ms

  constructor(options: RateLimiterOptions = {}) {
    this.capacity = options.capacity ?? 3
    this.refillRate = options.tokensPerSecond ?? 1
    this.state = {
      tokens: this.capacity,
      lastRefill: Date.now()
    }
  }

  async acquire(): Promise<void> {
    // Refill tokens based on time elapsed
    const now = Date.now()
    const timeSinceLastRefill = now - this.state.lastRefill
    const tokensToAdd = Math.floor(timeSinceLastRefill / this.refillInterval) * this.refillRate

    if (tokensToAdd > 0) {
      this.state.tokens = Math.min(this.capacity, this.state.tokens + tokensToAdd)
      this.state.lastRefill = now
    }

    // If no tokens available, wait
    if (this.state.tokens < 1) {
      const waitTime = this.refillInterval - (now - this.state.lastRefill)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      this.state.tokens = 1
      this.state.lastRefill = Date.now()
    }

    // Consume a token
    this.state.tokens -= 1
  }

  /** Get current token count (for debugging/monitoring) */
  getAvailableTokens(): number {
    return this.state.tokens
  }
}
