/**
 * Offline Store — Manages offline state and operation queue.
 *
 * Tracks network connectivity and queues operations when offline.
 * Automatically syncs pending operations when back online.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addBreadcrumb, captureMessage } from '../services/sentry'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PendingOperation {
  id: string
  type: 'api_call' | 'sync' | 'save'
  endpoint?: string
  method?: string
  payload?: unknown
  workspaceId?: string
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface OfflineState {
  // State
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  pendingOperations: PendingOperation[]
  syncError: string | null

  // Actions
  setOnline: (isOnline: boolean) => void
  queueOperation: (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) => string
  removeOperation: (id: string) => void
  clearOperations: (workspaceId?: string) => void
  startSync: () => void
  finishSync: (error?: string) => void
  processQueue: () => Promise<void>
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      lastSyncTime: null,
      pendingOperations: [],
      syncError: null,

      /**
       * Update online status.
       */
      setOnline: (isOnline) => {
        const wasOffline = !get().isOnline
        set({ isOnline, syncError: null })

        addBreadcrumb('network', isOnline ? 'Went online' : 'Went offline', 'info')

        // If we just came back online, start syncing
        if (wasOffline && isOnline) {
          get().processQueue()
        }
      },

      /**
       * Queue an operation for later execution.
       */
      queueOperation: (operation) => {
        const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const fullOperation: PendingOperation = {
          ...operation,
          id,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: operation.maxRetries ?? 3
        }

        set((state) => ({
          pendingOperations: [...state.pendingOperations, fullOperation]
        }))

        addBreadcrumb('offline', `Queued operation: ${operation.type}`, 'info', {
          operationId: id,
          endpoint: operation.endpoint
        })

        return id
      },

      /**
       * Remove an operation from the queue.
       */
      removeOperation: (id) => {
        set((state) => ({
          pendingOperations: state.pendingOperations.filter((op) => op.id !== id)
        }))
      },

      /**
       * Clear all operations (optionally filtered by workspace).
       */
      clearOperations: (workspaceId) => {
        if (workspaceId) {
          set((state) => ({
            pendingOperations: state.pendingOperations.filter(
              (op) => op.workspaceId !== workspaceId
            )
          }))
        } else {
          set({ pendingOperations: [] })
        }
      },

      /**
       * Mark sync as started.
       */
      startSync: () => {
        set({ isSyncing: true, syncError: null })
      },

      /**
       * Mark sync as finished.
       */
      finishSync: (error) => {
        set({
          isSyncing: false,
          lastSyncTime: error ? get().lastSyncTime : Date.now(),
          syncError: error || null
        })
      },

      /**
       * Process all pending operations in the queue.
       */
      processQueue: async () => {
        const { isOnline, isSyncing, pendingOperations } = get()

        // Don't process if offline or already syncing
        if (!isOnline || isSyncing || pendingOperations.length === 0) {
          return
        }

        get().startSync()

        const operations = [...pendingOperations]
        const failedOperations: PendingOperation[] = []

        for (const operation of operations) {
          try {
            await processOperation(operation)
            get().removeOperation(operation.id)
          } catch (error) {
            console.error('[Offline] Operation failed:', operation.id, error)

            // Increment retry count
            const updatedOp = {
              ...operation,
              retryCount: operation.retryCount + 1
            }

            // Keep if under retry limit
            if (updatedOp.retryCount < updatedOp.maxRetries) {
              failedOperations.push(updatedOp)
            } else {
              // Drop operation after max retries
              captureMessage(
                `Operation dropped after ${updatedOp.maxRetries} retries: ${operation.type}`,
                'warning'
              )
            }
          }
        }

        // Update queue with failed operations
        set((state) => ({
          pendingOperations: [
            ...state.pendingOperations.filter(
              (op) => !operations.some((o) => o.id === op.id)
            ),
            ...failedOperations
          ]
        }))

        get().finishSync(
          failedOperations.length > 0 ? `${failedOperations.length} operations failed` : undefined
        )
      }
    }),
    {
      name: 'cognograph-offline',
      partialize: (state) => ({
        pendingOperations: state.pendingOperations,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)

// -----------------------------------------------------------------------------
// Operation Processor
// -----------------------------------------------------------------------------

/**
 * Process a single operation from the queue.
 */
async function processOperation(operation: PendingOperation): Promise<void> {
  switch (operation.type) {
    case 'api_call':
      if (!operation.endpoint || !operation.method) {
        throw new Error('Invalid API call operation: missing endpoint or method')
      }
      await fetch(operation.endpoint, {
        method: operation.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: operation.payload ? JSON.stringify(operation.payload) : undefined
      })
      break

    case 'sync':
      // Trigger Yjs sync through the provider
      // This is handled by the YjsSyncProvider when it reconnects
      break

    case 'save':
      // Local save operations
      if (operation.workspaceId && operation.payload) {
        await window.api.workspace.save(operation.workspaceId, operation.payload as string)
      }
      break

    default:
      throw new Error(`Unknown operation type: ${operation.type}`)
  }
}

// -----------------------------------------------------------------------------
// Network Event Listeners
// -----------------------------------------------------------------------------

/**
 * Initialize network event listeners.
 * Call this once when the app starts.
 */
export function initOfflineListeners(): () => void {
  const handleOnline = (): void => {
    useOfflineStore.getState().setOnline(true)
  }

  const handleOffline = (): void => {
    useOfflineStore.getState().setOnline(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Set initial state
  useOfflineStore.getState().setOnline(navigator.onLine)

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

/**
 * Hook to get online status.
 */
export function useIsOnline(): boolean {
  return useOfflineStore((state) => state.isOnline)
}

/**
 * Hook to get pending operation count.
 */
export function usePendingCount(): number {
  return useOfflineStore((state) => state.pendingOperations.length)
}

/**
 * Hook to check if we're syncing.
 */
export function useIsSyncing(): boolean {
  return useOfflineStore((state) => state.isSyncing)
}
