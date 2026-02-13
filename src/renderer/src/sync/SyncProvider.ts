import type { WorkspaceData } from '@shared/types'

/**
 * SyncProvider abstraction layer for workspace persistence.
 *
 * Sits between the Zustand store and the IPC layer, owning:
 * - Persistence (debounced saves)
 * - External change detection (file watching)
 *
 * The store continues to own all node/edge mutations.
 * UI-only state (selections, panels, history) stays in Zustand untouched.
 */

export type ExternalChangeCallback = (data: WorkspaceData) => void
export type UnsubscribeFn = () => void

export interface SyncProvider {
  /** Connect to a workspace by ID, start watching for external changes */
  connect(workspaceId: string): Promise<void>

  /** Disconnect from the current workspace, stop watching */
  disconnect(): void

  /** Whether the provider is currently connected */
  readonly isConnected: boolean

  /** The workspace ID currently connected to (null if disconnected) */
  readonly workspaceId: string | null

  /** Load workspace data from persistence */
  load(workspaceId: string): Promise<WorkspaceData | null>

  /** Save workspace data (debounced internally) */
  save(data: WorkspaceData): void

  /** Force an immediate save (bypasses debounce, used for Ctrl+S) */
  saveImmediate(data: WorkspaceData): Promise<boolean>

  /** Subscribe to external changes (file modified outside the app) */
  onExternalChange(callback: ExternalChangeCallback): UnsubscribeFn
}
