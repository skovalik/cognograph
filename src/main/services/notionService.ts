import { Client } from '@notionhq/client'
import { safeStorage } from 'electron'
import Store from 'electron-store'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SettingsSchema {
  encryptedApiKeys: {
    anthropic?: string
    gemini?: string
    openai?: string
    notion?: string
  }
  notionWorkflowsDbId?: string
  notionExecLogDbId?: string
  notionSyncEnabled?: boolean
}

interface TokenBucketState {
  tokens: number
  lastRefill: number
}

interface CircuitBreakerState {
  failures: Array<{ timestamp: number }>
  state: 'closed' | 'open' | 'half-open'
  lastProbeTime: number
}

export interface NotionClientConfig {
  workflowsDbId: string
  execLogDbId: string
}

// -----------------------------------------------------------------------------
// Token Bucket Rate Limiter
// -----------------------------------------------------------------------------

class TokenBucketRateLimiter {
  private state: TokenBucketState
  private readonly capacity = 3 // Burst capacity
  private readonly refillRate = 1 // Tokens per second
  private readonly refillInterval = 1000 // 1 second in ms

  constructor() {
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
}

// -----------------------------------------------------------------------------
// Circuit Breaker
// -----------------------------------------------------------------------------

class CircuitBreaker {
  private state: CircuitBreakerState
  private readonly windowMs = 60000 // 60 second sliding window
  private readonly failureThreshold = 5
  private readonly cooldownMs = 60000 // 60 second cooldown before half-open

  constructor() {
    this.state = {
      failures: [],
      state: 'closed',
      lastProbeTime: 0
    }
  }

  recordFailure(): void {
    const now = Date.now()
    this.state.failures.push({ timestamp: now })

    // Remove failures outside the sliding window
    this.state.failures = this.state.failures.filter(
      f => now - f.timestamp < this.windowMs
    )

    // Trip if threshold exceeded
    if (this.state.failures.length >= this.failureThreshold) {
      this.state.state = 'open'
      console.warn('[NotionService] Circuit breaker OPEN - too many failures')
    }
  }

  recordSuccess(): void {
    // Clear failures and close circuit
    this.state.failures = []
    if (this.state.state !== 'closed') {
      console.log('[NotionService] Circuit breaker CLOSED - connection restored')
    }
    this.state.state = 'closed'
  }

  shouldAllowRequest(): boolean {
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
        console.log('[NotionService] Circuit breaker HALF-OPEN - attempting probe')
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
}

// -----------------------------------------------------------------------------
// Notion Service
// -----------------------------------------------------------------------------

class NotionService {
  private client: Client | null = null
  private rateLimiter = new TokenBucketRateLimiter()
  private circuitBreaker = new CircuitBreaker()
  private store = new Store<SettingsSchema>()
  private consecutiveRateLimits = 0

  getToken(): string | null {
    try {
      const encryptedKeys = this.store.get('encryptedApiKeys', {})
      const encrypted = encryptedKeys.notion
      if (!encrypted) return null

      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
        return decrypted
      }
      // Fallback: return as-is
      return encrypted
    } catch (err) {
      console.error('[NotionService] Failed to decrypt token:', err)
      return null
    }
  }

  getConfig(): NotionClientConfig | null {
    const workflowsDbId = this.store.get('notionWorkflowsDbId')
    const execLogDbId = this.store.get('notionExecLogDbId')

    if (!workflowsDbId || !execLogDbId) {
      return null
    }

    return {
      workflowsDbId: workflowsDbId as string,
      execLogDbId: execLogDbId as string
    }
  }

  isSyncEnabled(): boolean {
    return this.store.get('notionSyncEnabled', true) as boolean
  }

  private initClient(): boolean {
    const token = this.getToken()
    if (!token) {
      console.warn('[NotionService] No Notion token configured')
      return false
    }

    if (!this.client) {
      this.client = new Client({ auth: token })
      console.log(`[NotionService] Client initialized (token: ...${token.slice(-4)})`)
    }

    return true
  }

  async request<T>(
    fn: (client: Client) => Promise<T>,
    operation: string
  ): Promise<{ success: true; data: T } | { success: false; error: string; shouldSuspend?: boolean }> {
    // Check circuit breaker
    if (!this.circuitBreaker.shouldAllowRequest()) {
      return {
        success: false,
        error: 'Circuit breaker open - sync paused'
      }
    }

    // Initialize client if needed
    if (!this.initClient() || !this.client) {
      return {
        success: false,
        error: 'Notion token not configured'
      }
    }

    // Rate limiting
    try {
      await this.rateLimiter.acquire()
    } catch (err) {
      return {
        success: false,
        error: 'Rate limiter error: ' + String(err)
      }
    }

    // Execute request with retry logic
    let lastError: string = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await fn(this.client)
        this.circuitBreaker.recordSuccess()
        this.consecutiveRateLimits = 0
        return { success: true, data: result }
      } catch (err: any) {
        lastError = err.message || String(err)
        console.warn(`[NotionService] ${operation} attempt ${attempt}/3 failed:`, lastError)

        // Handle specific error codes
        if (err.code === 'unauthorized' || err.status === 401) {
          // Token invalid - suspend ALL sync
          console.error('[NotionService] 401 Unauthorized - token invalid, suspending all sync')
          return {
            success: false,
            error: 'Notion token invalid or revoked',
            shouldSuspend: true
          }
        }

        if (err.code === 'rate_limited' || err.status === 429) {
          this.consecutiveRateLimits++

          // Parse Retry-After header (value is in SECONDS)
          const retryAfterSeconds = parseInt(err.headers?.['retry-after'] || '1')
          const retryAfterMs = retryAfterSeconds * 1000

          // Exponential backoff with Retry-After
          const backoffMs = Math.min(
            retryAfterMs,
            Math.pow(2, attempt - 1) * 1000, // 1s, 2s, 4s
            30000 // Max 30s
          )

          console.warn(`[NotionService] Rate limited, waiting ${backoffMs}ms (Retry-After: ${retryAfterSeconds}s)`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))

          // After 5 consecutive rate limits, pause for 60s
          if (this.consecutiveRateLimits >= 5) {
            console.warn('[NotionService] 5 consecutive rate limits, pausing for 60s')
            await new Promise(resolve => setTimeout(resolve, 60000))
            this.consecutiveRateLimits = 0
          }

          continue // Retry
        }

        if (err.status === 404) {
          // Database not found - suspend sync for this DB
          return {
            success: false,
            error: 'Notion database not found',
            shouldSuspend: true
          }
        }

        // Record failure for circuit breaker
        this.circuitBreaker.recordFailure()

        // Wait before retry
        if (attempt < 3) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000
          await new Promise(resolve => setTimeout(resolve, backoffMs))
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: `Failed after 3 attempts: ${lastError}`
    }
  }

  async testConnection(): Promise<{ success: boolean; workspaceName?: string; error?: string }> {
    const result = await this.request(
      (client) => client.users.me({}),
      'testConnection'
    )

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // Extract workspace name from user object
    const user = result.data as any
    const workspaceName = user.workspace_name || user.name || 'Notion Workspace'

    return {
      success: true,
      workspaceName
    }
  }

  getCircuitBreakerState(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  // Additional methods for plugin interface
  isConnected(): boolean {
    return this.client !== null
  }

  hasToken(): boolean {
    return this.getToken() !== null
  }

  hasConfig(): boolean {
    return this.getConfig() !== null
  }

  setToken(token: string): void {
    const encryptedKeys = this.store.get('encryptedApiKeys', {})
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token).toString('base64')
      : token
    encryptedKeys.notion = encrypted
    this.store.set('encryptedApiKeys', encryptedKeys)
    // Reinitialize client with new token
    this.client = null
    this.initClient()
  }

  setConfig(workflowsDbId: string, execLogDbId: string): void {
    this.store.set('notionWorkflowsDbId', workflowsDbId)
    this.store.set('notionExecLogDbId', execLogDbId)
  }

  setSyncEnabled(enabled: boolean): void {
    this.store.set('notionSyncEnabled', enabled)
  }

  async getWorkflowsSchema(): Promise<{ properties: Record<string, { type: string }> } | { error: string }> {
    try {
      const config = this.getConfig()
      if (!config) {
        return { error: 'No database configured' }
      }

      const result = await this.request(
        async (client) => {
          const db = await client.databases.retrieve({ database_id: config.workflowsDbId })
          return db
        },
        'getWorkflowsSchema'
      )

      if (!result.success) {
        return { error: result.error }
      }

      // Convert to simple property name → type map
      const properties: Record<string, { type: string }> = {}
      const dbProperties = (result.data as any).properties
      if (dbProperties) {
        for (const [name, prop] of Object.entries(dbProperties)) {
          properties[name] = { type: (prop as any).type }
        }
      }

      return { properties }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

// Singleton instance
export const notionService = new NotionService()
