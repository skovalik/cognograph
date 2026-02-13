/**
 * Token Sync Service — Synchronizes auth tokens across browser tabs.
 *
 * Uses BroadcastChannel API to:
 * - Notify other tabs when a token is refreshed
 * - Coordinate so only one tab refreshes at a time
 * - Propagate token updates to all tabs
 */

type TokenMessage =
  | { type: 'TOKEN_REFRESHING'; workspaceId: string; tabId: string }
  | { type: 'TOKEN_REFRESHED'; workspaceId: string; token: string; expiresAt: string; tabId: string }
  | { type: 'TOKEN_REFRESH_FAILED'; workspaceId: string; error: string; tabId: string }
  | { type: 'TOKEN_REQUEST'; workspaceId: string; tabId: string }

type TokenListener = (token: string, expiresAt: string) => void

class TokenSyncService {
  private channel: BroadcastChannel | null = null
  private tabId: string
  private refreshingWorkspaces = new Set<string>()
  private listeners = new Map<string, Set<TokenListener>>()
  private isInitialized = false

  constructor() {
    // Generate unique tab ID
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * Initialize the token sync service.
   * Safe to call multiple times.
   */
  initialize(): void {
    if (this.isInitialized) return
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[TokenSync] BroadcastChannel not supported')
      return
    }

    try {
      this.channel = new BroadcastChannel('cognograph-token-sync')
      this.channel.onmessage = (event: MessageEvent<TokenMessage>) => {
        this.handleMessage(event.data)
      }
      this.isInitialized = true
      console.log('[TokenSync] Initialized for tab:', this.tabId)
    } catch (err) {
      console.error('[TokenSync] Failed to initialize:', err)
    }
  }

  /**
   * Clean up the service.
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    this.refreshingWorkspaces.clear()
    this.listeners.clear()
    this.isInitialized = false
  }

  /**
   * Register a listener for token updates for a workspace.
   */
  onTokenUpdate(workspaceId: string, listener: TokenListener): () => void {
    let set = this.listeners.get(workspaceId)
    if (!set) {
      set = new Set()
      this.listeners.set(workspaceId, set)
    }
    set.add(listener)

    return () => {
      set?.delete(listener)
      if (set?.size === 0) {
        this.listeners.delete(workspaceId)
      }
    }
  }

  /**
   * Check if any tab is currently refreshing the token for a workspace.
   */
  isRefreshing(workspaceId: string): boolean {
    return this.refreshingWorkspaces.has(workspaceId)
  }

  /**
   * Notify other tabs that this tab is refreshing a token.
   */
  notifyRefreshing(workspaceId: string): void {
    this.refreshingWorkspaces.add(workspaceId)
    this.broadcast({
      type: 'TOKEN_REFRESHING',
      workspaceId,
      tabId: this.tabId
    })
  }

  /**
   * Notify other tabs that token refresh succeeded.
   */
  notifyRefreshed(workspaceId: string, token: string, expiresAt: string): void {
    this.refreshingWorkspaces.delete(workspaceId)
    this.broadcast({
      type: 'TOKEN_REFRESHED',
      workspaceId,
      token,
      expiresAt,
      tabId: this.tabId
    })
  }

  /**
   * Notify other tabs that token refresh failed.
   */
  notifyRefreshFailed(workspaceId: string, error: string): void {
    this.refreshingWorkspaces.delete(workspaceId)
    this.broadcast({
      type: 'TOKEN_REFRESH_FAILED',
      workspaceId,
      error,
      tabId: this.tabId
    })
  }

  /**
   * Request token from other tabs (used when joining a workspace).
   */
  requestToken(workspaceId: string): void {
    this.broadcast({
      type: 'TOKEN_REQUEST',
      workspaceId,
      tabId: this.tabId
    })
  }

  private broadcast(message: TokenMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message)
      } catch (err) {
        // BroadcastChannel may fail in private browsing or after being closed
        console.warn('[TokenSync] Failed to broadcast:', err)
      }
    }
  }

  private handleMessage(message: TokenMessage): void {
    // Ignore messages from this tab
    if (message.tabId === this.tabId) return

    switch (message.type) {
      case 'TOKEN_REFRESHING':
        // Another tab is refreshing - don't start our own refresh
        this.refreshingWorkspaces.add(message.workspaceId)
        console.log(`[TokenSync] Tab ${message.tabId} is refreshing token for ${message.workspaceId}`)
        break

      case 'TOKEN_REFRESHED':
        // Another tab refreshed - update our token
        this.refreshingWorkspaces.delete(message.workspaceId)
        console.log(`[TokenSync] Received refreshed token from tab ${message.tabId}`)

        // Store the new token locally
        window.api.multiplayer.storeToken(message.workspaceId, message.token)

        // Notify listeners
        const listeners = this.listeners.get(message.workspaceId)
        if (listeners) {
          for (const listener of listeners) {
            listener(message.token, message.expiresAt)
          }
        }
        break

      case 'TOKEN_REFRESH_FAILED':
        // Another tab's refresh failed - we might need to take over
        this.refreshingWorkspaces.delete(message.workspaceId)
        console.warn(`[TokenSync] Refresh failed in tab ${message.tabId}:`, message.error)
        break

      case 'TOKEN_REQUEST':
        // Another tab is requesting token - share if we have it
        this.handleTokenRequest(message.workspaceId, message.tabId)
        break
    }
  }

  private async handleTokenRequest(workspaceId: string, requestingTabId: string): Promise<void> {
    // Check if we have a valid token
    const result = await window.api.multiplayer.getToken(workspaceId)
    if (result.success && result.token) {
      // Validate the token to get expiry
      const validation = await window.api.multiplayer.validateToken(workspaceId)
      if (validation.success && validation.expiresAt) {
        // Share the token
        this.broadcast({
          type: 'TOKEN_REFRESHED',
          workspaceId,
          token: result.token,
          expiresAt: validation.expiresAt,
          tabId: this.tabId
        })
        console.log(`[TokenSync] Shared token with tab ${requestingTabId}`)
      }
    }
  }
}

// Singleton instance
export const tokenSync = new TokenSyncService()

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  tokenSync.initialize()
}
