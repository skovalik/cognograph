// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { WorkspaceData } from '@shared/types'
import type { SyncProvider, ExternalChangeCallback, UnsubscribeFn } from './SyncProvider'
import { useProgramStore } from '../stores/programStore'

const DEFAULT_SAVE_DEBOUNCE_MS = 2000

/**
 * LocalSyncProvider implements SyncProvider using existing IPC calls
 * to the main process for file-based workspace persistence.
 *
 * Responsibilities:
 * - Debounced auto-save via window.api.workspace.save()
 * - File watching via workspace:watch IPC (main process uses fs.watch)
 * - External change detection and notification to subscribers
 */
export class LocalSyncProvider implements SyncProvider {
  private _workspaceId: string | null = null
  private _isConnected = false
  private _subscribers: Set<ExternalChangeCallback> = new Set()
  private _saveTimer: ReturnType<typeof setTimeout> | null = null
  private _unsubscribeExternalChange: (() => void) | null = null
  private _onSaveSuccess: (() => void) | null = null
  private _onSaveStart: (() => void) | null = null
  private _onSaveError: (() => void) | null = null
  private _watcherStarted = false
  private _watchPromise: Promise<void> | null = null

  /** Monotonically increasing save version counter — incremented each time a save is initiated.
   *  Used to detect stale saves: if _saveVersion has advanced by the time a save completes,
   *  the written data may already be outdated and another save is triggered. */
  private _saveVersion = 0

  get isConnected(): boolean {
    return this._isConnected
  }

  get workspaceId(): string | null {
    return this._workspaceId
  }

  /** Set a callback that fires after each successful debounced save */
  setSaveSuccessCallback(callback: (() => void) | null): void {
    this._onSaveSuccess = callback
  }

  /** Set a callback that fires when saving starts */
  setSaveStartCallback(callback: (() => void) | null): void {
    this._onSaveStart = callback
  }

  /** Set a callback that fires when saving fails */
  setSaveErrorCallback(callback: (() => void) | null): void {
    this._onSaveError = callback
  }

  async connect(workspaceId: string): Promise<void> {
    // Disconnect from any previous workspace
    if (this._isConnected) {
      this.disconnect()
    }

    this._workspaceId = workspaceId
    this._isConnected = true

    // Start file watcher in main process (may fail if file doesn't exist yet for new workspaces)
    const watchResult = await window.api.workspace.watch(workspaceId)
    this._watcherStarted = watchResult.success

    // Listen for external change events from main process
    this._unsubscribeExternalChange = window.api.workspace.onExternalChange(
      async (changedId: string) => {
        if (changedId !== this._workspaceId) return

        // Reload the workspace data and notify subscribers
        const data = await this.load(changedId)
        if (data) {
          for (const callback of this._subscribers) {
            try {
              callback(data)
            } catch (err) {
              console.error('[LocalSyncProvider] Subscriber error:', err)
            }
          }
        }
      }
    )
  }

  disconnect(): void {
    // Cancel any pending save
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }

    // Stop file watcher
    if (this._workspaceId) {
      window.api.workspace.unwatch(this._workspaceId)
    }

    // Unsubscribe from IPC events
    if (this._unsubscribeExternalChange) {
      this._unsubscribeExternalChange()
      this._unsubscribeExternalChange = null
    }

    this._workspaceId = null
    this._isConnected = false
    this._watcherStarted = false
    this._watchPromise = null
  }

  /** Start watcher if not already active (for new workspaces after first save) */
  private async _ensureWatching(): Promise<void> {
    if (this._watcherStarted || !this._workspaceId) return
    if (this._watchPromise) return this._watchPromise
    this._watchPromise = (async () => {
      const result = await window.api.workspace.watch(this._workspaceId!)
      this._watcherStarted = result.success
      this._watchPromise = null
    })()
    return this._watchPromise
  }

  async load(workspaceId: string): Promise<WorkspaceData | null> {
    try {
      const result = await window.api.workspace.load(workspaceId)
      if (result.success && result.data) {
        return result.data as WorkspaceData
      }
      return null
    } catch (error) {
      console.error('[LocalSyncProvider] Load error:', error)
      return null
    }
  }

  save(_data: WorkspaceData): void {
    // Check if auto-save is enabled
    const { autoSave } = useProgramStore.getState()
    if (!autoSave.enabled) return

    // Debounced save - cancels any pending save and schedules a new one
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
    }

    const debounceMs = autoSave.intervalMs || DEFAULT_SAVE_DEBOUNCE_MS

    this._saveTimer = setTimeout(async () => {
      this._saveTimer = null
      this._onSaveStart?.()

      // Capture version at the moment we snapshot state — if it advances during
      // the async IPC save, the data we wrote is already stale.
      const versionAtSave = ++this._saveVersion

      try {
        // Re-read fresh data at execution time — the data parameter was captured
        // when isDirty first fired, but more changes may have arrived during debounce.
        const { useWorkspaceStore } = await import('../stores/workspaceStore')
        const freshData = useWorkspaceStore.getState().getWorkspaceData()
        const result = await window.api.workspace.save(freshData)
        if (result.success) {
          await this._ensureWatching()

          // If the save version advanced while we were writing, another mutation
          // occurred after our snapshot — trigger another save to persist it.
          if (this._saveVersion !== versionAtSave) {
            console.warn('[LocalSyncProvider] State changed during save — scheduling follow-up save')
            this.save(undefined as unknown as WorkspaceData) // re-enter debounced path
          } else {
            this._onSaveSuccess?.()
          }
        } else {
          console.error('[LocalSyncProvider] Auto-save failed:', result.error)
          this._onSaveError?.()
        }
      } catch (error) {
        console.error('[LocalSyncProvider] Auto-save error:', error)
        this._onSaveError?.()
      }
    }, debounceMs)
  }

  async saveImmediate(data: WorkspaceData): Promise<boolean> {
    // Cancel any pending debounced save
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }

    this._onSaveStart?.()

    // Capture version at snapshot time — same race-detection logic as debounced save.
    const versionAtSave = ++this._saveVersion

    try {
      const result = await window.api.workspace.save(data)
      if (result.success) {
        await this._ensureWatching()

        // If version advanced during the IPC round-trip, queue a follow-up save.
        if (this._saveVersion !== versionAtSave) {
          console.warn('[LocalSyncProvider] State changed during immediate save — scheduling follow-up save')
          this.save(undefined as unknown as WorkspaceData) // re-enter debounced path
        } else {
          this._onSaveSuccess?.()
        }
      } else {
        this._onSaveError?.()
      }
      return result.success
    } catch (error) {
      console.error('[LocalSyncProvider] Immediate save error:', error)
      this._onSaveError?.()
      return false
    }
  }

  onExternalChange(callback: ExternalChangeCallback): UnsubscribeFn {
    this._subscribers.add(callback)
    return () => {
      this._subscribers.delete(callback)
    }
  }
}
