/**
 * YjsSyncProvider — Collaborative sync using Yjs CRDTs.
 *
 * Manages Y.Doc lifecycle, WebSocket connection to Hocuspocus server,
 * and offline persistence via y-indexeddb.
 *
 * In multiplayer mode, Y.Doc is the source of truth.
 * The YjsStoreBinding handles bidirectional sync with the Zustand store.
 */

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CollaborativeSyncProvider } from './CollaborativeSyncProvider'
import type { ExternalChangeCallback, UnsubscribeFn } from './SyncProvider'
import type { WorkspaceData } from '@shared/types'
import type { MultiplayerConfig, ConnectionStatus } from '@shared/multiplayerTypes'
import { YjsStoreBinding } from './YjsStoreBinding'
import { populateDocFromWorkspaceData, workspaceDataFromDoc } from './yjs-utils'
import { Awareness } from 'y-protocols/awareness'
import { tokenSync } from '../services/tokenSync'

/**
 * Type-safe interface for y-websocket's WebsocketProvider.
 * Captures only the API surface we actually use, avoiding `any`.
 */
interface WebsocketProviderLike {
  connect(): void
  disconnect(): void
  destroy(): void
  on(event: string, callback: (...args: unknown[]) => void): void
  awareness: Awareness
}

/** Current schema version for Y.Doc structure. Bump when node/edge fields change. */
const YDOC_SCHEMA_VERSION = 1

export class YjsSyncProvider implements CollaborativeSyncProvider {
  private doc: Y.Doc
  private binding: YjsStoreBinding | null = null
  private indexeddbProvider: IndexeddbPersistence | null = null
  private wsProvider: WebsocketProviderLike | null = null
  private awareness: Awareness | null = null

  private _workspaceId: string | null = null
  private _isConnected = false
  private _isOnline = false
  private _peerCount = 0
  private _connectionStatus: ConnectionStatus = 'disconnected'
  private _subscribers: Set<ExternalChangeCallback> = new Set()
  private _statusListeners: Set<(status: ConnectionStatus) => void> = new Set()

  private config: MultiplayerConfig | null = null
  private _reconnectAttempts = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private _tokenSyncUnsubscribe: (() => void) | null = null
  private _connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private _tokenRefreshRetries = 0

  // Constants
  private static readonly TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000 // 10 minutes before expiry
  private static readonly TOKEN_CHECK_INTERVAL_MS = 5 * 60 * 1000 // Check every 5 minutes
  private static readonly MAX_RECONNECT_ATTEMPTS = 10
  private static readonly MAX_TOKEN_REFRESH_RETRIES = 3
  private static readonly CONNECTION_TIMEOUT_MS = 15000 // 15 seconds

  constructor() {
    this.doc = new Y.Doc()
  }

  // ---------------------------------------------------------------------------
  // SyncProvider Interface
  // ---------------------------------------------------------------------------

  get isConnected(): boolean {
    return this._isConnected
  }

  get workspaceId(): string | null {
    return this._workspaceId
  }

  async connect(workspaceId: string): Promise<void> {
    if (this._workspaceId === workspaceId && this._isConnected) return

    // Disconnect previous if any
    this.disconnect()

    this._workspaceId = workspaceId
    this._isConnected = true
    this._reconnectAttempts = 0

    // Create fresh Y.Doc
    this.doc = new Y.Doc()

    // Set up IndexedDB persistence for offline support
    this.indexeddbProvider = new IndexeddbPersistence(`cognograph-yjs-${workspaceId}`, this.doc)

    // Use whenSynced promise (safe even if already synced)
    await this.indexeddbProvider.whenSynced
    console.log('[YjsSyncProvider] IndexedDB synced for workspace:', workspaceId)

    // Set up store binding
    this.binding = new YjsStoreBinding(this.doc)
    this.binding.bind()

    // If we have a multiplayer config, connect to WebSocket
    if (this.config) {
      try {
        await this.connectWebSocket()
      } catch (err) {
        // WebSocket connection failed, but local persistence works
        console.warn('[YjsSyncProvider] WebSocket connection failed, operating in offline mode:', err)
        this._connectionStatus = 'error'
        this.notifyStatusChange()
      }
    }
  }

  disconnect(): void {
    // Clear any pending reconnect timer
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    // Clear connection timeout
    this.clearConnectionTimeout()

    // Stop token refresh
    this.stopTokenRefresh()

    // Destroy network/persistence providers first so any pending updates
    // flush through the binding before it's unbound
    if (this.wsProvider) {
      this.wsProvider.disconnect()
      this.wsProvider.destroy()
      this.wsProvider = null
    }

    if (this.indexeddbProvider) {
      this.indexeddbProvider.destroy()
      this.indexeddbProvider = null
    }

    // Now unbind store (no more updates can arrive)
    if (this.binding) {
      this.binding.unbind()
      this.binding = null
    }

    // Properly destroy awareness to release all listeners
    if (this.awareness) {
      this.awareness.destroy()
      this.awareness = null
    }

    // Destroy the Y.Doc to release internal state and observers
    this.doc.destroy()
    this.doc = new Y.Doc() // Fresh doc for potential reconnection

    this._isConnected = false
    this._isOnline = false
    this._peerCount = 0
    this._workspaceId = null
    this._connectionStatus = 'disconnected'
    this._reconnectAttempts = 0
    this.notifyStatusChange()
  }

  async load(_workspaceId: string): Promise<WorkspaceData | null> {
    // In Yjs mode, data is loaded through the Y.Doc sync mechanism.
    // If we have local indexeddb data, we can extract it.
    if (this.doc.getMap('nodes').size > 0) {
      return workspaceDataFromDoc(this.doc)
    }
    return null
  }

  save(_data: WorkspaceData): void {
    // In multiplayer mode, saves happen through Y.Doc transactions.
    // The IndexedDB provider handles offline persistence automatically.
    // This is a no-op since the binding handles store → Y.Doc sync.
  }

  async saveImmediate(_data: WorkspaceData): Promise<boolean> {
    // Force IndexedDB flush
    if (this.indexeddbProvider) {
      await this.indexeddbProvider.whenSynced
      return true
    }
    return false
  }

  onExternalChange(callback: ExternalChangeCallback): UnsubscribeFn {
    this._subscribers.add(callback)
    return () => {
      this._subscribers.delete(callback)
    }
  }

  // ---------------------------------------------------------------------------
  // CollaborativeSyncProvider Interface
  // ---------------------------------------------------------------------------

  getDoc(): Y.Doc {
    return this.doc
  }

  getAwareness(): Awareness {
    if (!this.awareness) {
      // Create a standalone awareness if no WebSocket provider
      this.awareness = new Awareness(this.doc)
    }
    return this.awareness!
  }

  transact(fn: () => void, origin?: string): void {
    this.doc.transact(fn, origin || 'user')
  }

  get isOnline(): boolean {
    return this._isOnline
  }

  get peerCount(): number {
    return this._peerCount
  }

  // ---------------------------------------------------------------------------
  // Multiplayer Configuration
  // ---------------------------------------------------------------------------

  /**
   * Configure the multiplayer connection.
   * Call this before connect() to establish WebSocket connection.
   */
  setConfig(config: MultiplayerConfig): void {
    this.config = config
  }

  /**
   * Get current connection status.
   */
  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus
  }

  /**
   * Subscribe to connection status changes.
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): UnsubscribeFn {
    this._statusListeners.add(listener)
    return () => this._statusListeners.delete(listener)
  }

  /**
   * Populate the Y.Doc from a local workspace snapshot.
   * Used when sharing a workspace for the first time.
   */
  initializeFromWorkspaceData(data: WorkspaceData): void {
    populateDocFromWorkspaceData(this.doc, data)
  }

  // ---------------------------------------------------------------------------
  // WebSocket Connection
  // ---------------------------------------------------------------------------

  private async connectWebSocket(): Promise<void> {
    if (!this.config || !this._workspaceId) return

    this._connectionStatus = 'connecting'
    this.notifyStatusChange()

    // Clear any existing connection timeout
    this.clearConnectionTimeout()

    try {
      // Dynamic import to avoid bundling y-websocket when not needed
      const { WebsocketProvider } = await import('y-websocket')

      this.wsProvider = new WebsocketProvider(
        this.config.serverUrl,
        this._workspaceId,
        this.doc,
        {
          params: {
            token: this.config.token
          }
        }
      ) as unknown as WebsocketProviderLike

      this.awareness = this.wsProvider.awareness

      // Set local awareness state
      this.awareness!.setLocalStateField('user', {
        id: this.config.userName,
        name: this.config.userName,
        color: this.config.userColor
      })

      // Start connection timeout — if still connecting after 15s, treat as error
      this._connectionTimeoutTimer = setTimeout(() => {
        if (this._connectionStatus === 'connecting') {
          console.warn('[YjsSyncProvider] Connection timeout after 15s')
          this._connectionStatus = 'error'
          this.notifyStatusChange()
          // Disconnect to avoid lingering connection attempts
          if (this.wsProvider) {
            this.wsProvider.disconnect()
          }
        }
      }, YjsSyncProvider.CONNECTION_TIMEOUT_MS)

      // Connection status handlers
      this.wsProvider.on('status', ((...args: unknown[]) => {
        const { status } = args[0] as { status: string }
        if (status === 'connected') {
          this.clearConnectionTimeout()
          this._isOnline = true
          this._connectionStatus = 'connected'
          this._reconnectAttempts = 0 // Reset backoff on successful connect
          this._tokenRefreshRetries = 0 // Reset token retry counter
          // Validate schema version on connect
          this.validateSchemaVersion()
          // Start token refresh timer on successful connection
          this.startTokenRefresh()
        } else if (status === 'disconnected') {
          this._isOnline = false
          this._connectionStatus = 'disconnected'
        } else if (status === 'connecting') {
          this._connectionStatus = 'connecting'
        }
        this.notifyStatusChange()
      }))

      // Track peer count via awareness
      this.awareness!.on('change', () => {
        const states = this.awareness!.getStates()
        this._peerCount = states.size - 1 // Exclude self
      })

      // Sync status
      this.wsProvider.on('sync', ((...args: unknown[]) => {
        const isSynced = args[0] as boolean
        if (isSynced) {
          this._connectionStatus = 'connected'
          console.log('[YjsSyncProvider] WebSocket synced with server')
        } else {
          this._connectionStatus = 'syncing'
        }
        this.notifyStatusChange()
      }))

    } catch (err) {
      this.clearConnectionTimeout()
      console.error('[YjsSyncProvider] Failed to connect WebSocket:', err)
      this._connectionStatus = 'error'
      this.notifyStatusChange()
    }
  }

  private clearConnectionTimeout(): void {
    if (this._connectionTimeoutTimer) {
      clearTimeout(this._connectionTimeoutTimer)
      this._connectionTimeoutTimer = null
    }
  }

  /**
   * Disconnect from the WebSocket server but keep local state.
   */
  goOffline(): void {
    if (this.wsProvider) {
      this.wsProvider.disconnect()
      this._isOnline = false
      this._connectionStatus = 'disconnected'
      this.notifyStatusChange()
    }
  }

  /**
   * Reconnect to the WebSocket server with exponential backoff.
   * Stops after MAX_RECONNECT_ATTEMPTS and sets error status.
   */
  async goOnline(): Promise<void> {
    // Check if we've exceeded max reconnect attempts
    if (this._reconnectAttempts >= YjsSyncProvider.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[YjsSyncProvider] Max reconnect attempts (${YjsSyncProvider.MAX_RECONNECT_ATTEMPTS}) reached`)
      this._connectionStatus = 'error'
      this.notifyStatusChange()
      return
    }

    // Calculate backoff delay: 1s, 2s, 4s, 8s, max 30s
    const backoffMs = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000)
    this._reconnectAttempts++

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    if (this._reconnectAttempts > 1) {
      // Apply backoff delay for non-first attempts
      await new Promise<void>((resolve) => {
        this._reconnectTimer = setTimeout(resolve, backoffMs)
      })
    }

    if (this.wsProvider) {
      this.wsProvider.connect()
    } else if (this.config) {
      try {
        await this.connectWebSocket()
      } catch {
        // Will be handled by status listeners
      }
    }
  }

  /**
   * Reset reconnect counter (e.g. after user taps "Retry").
   */
  resetReconnectAttempts(): void {
    this._reconnectAttempts = 0
    this._tokenRefreshRetries = 0
  }

  private notifyStatusChange(): void {
    for (const listener of this._statusListeners) {
      listener(this._connectionStatus)
    }
  }

  // ---------------------------------------------------------------------------
  // Token Refresh Management
  // ---------------------------------------------------------------------------

  /**
   * Start the token refresh timer.
   * Validates token and schedules refresh before expiry.
   */
  private async startTokenRefresh(): Promise<void> {
    if (!this._workspaceId) return

    // Clear any existing timer
    this.stopTokenRefresh()

    // Set up cross-tab token sync listener
    if (!this._tokenSyncUnsubscribe) {
      this._tokenSyncUnsubscribe = tokenSync.onTokenUpdate(this._workspaceId, (newToken, expiresAt) => {
        console.log('[YjsSyncProvider] Received token update from another tab')
        // Update our config with the new token
        if (this.config) {
          this.config.token = newToken
          // Reconnect with new token if we're online
          if (this.wsProvider && this._isOnline) {
            this.reconnectWithNewToken(newToken)
          }
        }
        // Reschedule refresh based on new expiry
        this.scheduleRefresh(new Date(expiresAt).getTime() - Date.now())
      })
    }

    try {
      // Validate current token and get expiry info
      const result = await window.api.multiplayer.validateToken(this._workspaceId)

      if (!result.success || !result.valid) {
        console.warn('[YjsSyncProvider] Token validation failed:', result.error)
        // Token is invalid - trigger re-auth flow
        this._connectionStatus = 'error'
        this.notifyStatusChange()
        return
      }

      // Calculate when to refresh
      const expiresIn = result.expiresIn ?? YjsSyncProvider.TOKEN_CHECK_INTERVAL_MS
      this.scheduleRefresh(expiresIn)

    } catch (err) {
      console.error('[YjsSyncProvider] Failed to start token refresh:', err)
      this._tokenRefreshRetries++
      if (this._tokenRefreshRetries >= YjsSyncProvider.MAX_TOKEN_REFRESH_RETRIES) {
        console.warn('[YjsSyncProvider] Max token refresh retries reached — stopping')
        this._connectionStatus = 'error'
        this.notifyStatusChange()
        return
      }
      // Retry in 1 minute (with limit)
      this._tokenRefreshTimer = setTimeout(() => {
        this.startTokenRefresh()
      }, 60000)
    }
  }

  /**
   * Refresh the token and update the WebSocket connection.
   * Uses tokenSync service to coordinate across tabs.
   */
  private async refreshToken(): Promise<void> {
    if (!this._workspaceId) return

    // Check if another tab is already refreshing
    if (tokenSync.isRefreshing(this._workspaceId)) {
      console.log('[YjsSyncProvider] Another tab is refreshing, waiting...')
      // Schedule check for when refresh completes
      this._tokenRefreshTimer = setTimeout(() => {
        this.startTokenRefresh()
      }, 5000) // Check again in 5 seconds
      return
    }

    console.log('[YjsSyncProvider] Refreshing token...')

    // Notify other tabs we're refreshing
    tokenSync.notifyRefreshing(this._workspaceId)

    try {
      const result = await window.api.multiplayer.refreshToken(this._workspaceId)

      if (!result.success) {
        console.error('[YjsSyncProvider] Token refresh failed:', result.error)
        tokenSync.notifyRefreshFailed(this._workspaceId, result.error || 'Unknown error')

        if (result.code === 'TOKEN_EXPIRED' || result.code === 'NO_TOKEN') {
          // Token is expired/invalid - need to reconnect with new auth
          this._connectionStatus = 'error'
          this.notifyStatusChange()
          // Don't retry - user needs to re-authenticate
          return
        }

        // Other errors - retry with limit
        this._tokenRefreshRetries++
        if (this._tokenRefreshRetries >= YjsSyncProvider.MAX_TOKEN_REFRESH_RETRIES) {
          console.warn('[YjsSyncProvider] Max token refresh retries reached — stopping')
          this._connectionStatus = 'error'
          this.notifyStatusChange()
          return
        }
        this._tokenRefreshTimer = setTimeout(() => {
          this.refreshToken()
        }, 60000)
        return
      }

      console.log('[YjsSyncProvider] Token refreshed successfully')
      this._tokenRefreshRetries = 0 // Reset on success

      // Notify other tabs of the new token
      if (result.token && result.expiresAt) {
        tokenSync.notifyRefreshed(this._workspaceId, result.token, result.expiresAt)
      }

      // Update config with new token
      if (this.config && result.token) {
        this.config.token = result.token

        // Update WebSocket provider's auth params if connected
        if (this.wsProvider && this._isOnline) {
          // y-websocket doesn't have a built-in way to update auth params
          // We need to reconnect with the new token
          await this.reconnectWithNewToken(result.token)
        }
      }

      // Schedule next refresh
      this.startTokenRefresh()

    } catch (err) {
      console.error('[YjsSyncProvider] Token refresh error:', err)
      tokenSync.notifyRefreshFailed(this._workspaceId, (err as Error).message)
      this._tokenRefreshRetries++
      if (this._tokenRefreshRetries >= YjsSyncProvider.MAX_TOKEN_REFRESH_RETRIES) {
        console.warn('[YjsSyncProvider] Max token refresh retries reached — stopping')
        this._connectionStatus = 'error'
        this.notifyStatusChange()
        return
      }
      // Retry in 1 minute (with limit)
      this._tokenRefreshTimer = setTimeout(() => {
        this.refreshToken()
      }, 60000)
    }
  }

  /**
   * Reconnect to WebSocket with a new token.
   */
  private async reconnectWithNewToken(newToken: string): Promise<void> {
    if (!this.wsProvider) return

    console.log('[YjsSyncProvider] Reconnecting with new token...')

    // Store current sync state
    const wasOnline = this._isOnline

    // Disconnect current provider
    this.wsProvider.disconnect()
    this.wsProvider.destroy()
    this.wsProvider = null

    // Reconnect with new token
    if (this.config && this._workspaceId) {
      this.config.token = newToken
      await this.connectWebSocket()

      if (wasOnline && this._connectionStatus !== 'connected') {
        // Connection failed - status will be updated by event handlers
        console.warn('[YjsSyncProvider] Failed to reconnect after token refresh')
      }
    }
  }

  /**
   * Schedule a token refresh for a given time in the future.
   */
  private scheduleRefresh(expiresIn: number): void {
    // Clear any existing timer
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer)
    }

    // Calculate when to refresh (10 minutes before expiry, minimum 30 seconds)
    const refreshIn = Math.max(
      expiresIn - YjsSyncProvider.TOKEN_REFRESH_BUFFER_MS,
      30000
    )

    console.log(`[YjsSyncProvider] Token refresh scheduled in ${Math.round(refreshIn / 1000)}s`)

    this._tokenRefreshTimer = setTimeout(() => {
      this.refreshToken()
    }, refreshIn)
  }

  /**
   * Validate Y.Doc schema version on connect.
   * Writes version if missing, warns on mismatch.
   */
  private validateSchemaVersion(): void {
    const yMeta = this.doc.getMap('meta')
    const remoteVersion = yMeta.get('schemaVersion') as number | undefined

    if (remoteVersion === undefined) {
      // First connection — stamp the schema version
      this.doc.transact(() => {
        yMeta.set('schemaVersion', YDOC_SCHEMA_VERSION)
      }, 'schema-init')
    } else if (remoteVersion > YDOC_SCHEMA_VERSION) {
      console.warn(
        `[YjsSyncProvider] Schema version mismatch: remote=${remoteVersion}, local=${YDOC_SCHEMA_VERSION}. ` +
        'This workspace was created with a newer version of Cognograph.'
      )
      // Don't block writes for now, just warn — future: optionally block writes
    }
  }

  /**
   * Stop the token refresh timer and cleanup listeners.
   */
  private stopTokenRefresh(): void {
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer)
      this._tokenRefreshTimer = null
    }

    if (this._tokenSyncUnsubscribe) {
      this._tokenSyncUnsubscribe()
      this._tokenSyncUnsubscribe = null
    }
  }
}
