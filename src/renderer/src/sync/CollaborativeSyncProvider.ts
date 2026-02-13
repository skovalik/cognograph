import type { SyncProvider } from './SyncProvider'
import type { Doc as YDoc } from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

/**
 * CollaborativeSyncProvider extends SyncProvider with Yjs-specific capabilities.
 *
 * Used when workspace is in multiplayer mode. Provides access to the underlying
 * Y.Doc and Awareness instance for real-time collaboration features.
 */
export interface CollaborativeSyncProvider extends SyncProvider {
  /** Get the underlying Yjs document */
  getDoc(): YDoc

  /** Get the awareness instance for presence/cursors */
  getAwareness(): Awareness

  /**
   * Execute a batch of Y.Doc mutations in a single transaction.
   * This groups changes so observers fire once, and produces a single
   * update message for network efficiency.
   */
  transact(fn: () => void, origin?: string): void

  /** Whether the provider is currently connected to the collaboration server */
  readonly isOnline: boolean

  /** Number of connected peers */
  readonly peerCount: number
}
