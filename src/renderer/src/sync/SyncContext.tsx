// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { LocalSyncProvider } from './LocalSyncProvider'
import { YjsSyncProvider } from './YjsSyncProvider'
import type { SyncProvider } from './SyncProvider'
import type { CollaborativeSyncProvider } from './CollaborativeSyncProvider'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { WorkspaceData } from '@shared/types'
import type { ConnectionStatus } from '@shared/multiplayerTypes'
import { logger } from '../utils/logger'
import { calculateAutoFitDimensions } from '../utils/textMeasure'
import { layoutEvents, requestFitView } from '../utils/layoutEvents'
import { toast } from 'react-hot-toast'

interface SyncContextValue {
  provider: SyncProvider
  collaborativeProvider: CollaborativeSyncProvider | null
  connectionStatus: ConnectionStatus
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncProvider(): SyncProvider | null {
  const ctx = useContext(SyncContext)
  return ctx?.provider || null
}

export function useCollaborativeProvider(): CollaborativeSyncProvider | null {
  const ctx = useContext(SyncContext)
  return ctx?.collaborativeProvider || null
}

export function useConnectionStatus(): ConnectionStatus {
  const ctx = useContext(SyncContext)
  return ctx?.connectionStatus || 'disconnected'
}

interface SyncProviderWrapperProps {
  children: React.ReactNode
}

export function SyncProviderWrapper({ children }: SyncProviderWrapperProps): JSX.Element {
  const localProviderRef = useRef<LocalSyncProvider | null>(null)
  const yjsProviderRef = useRef<YjsSyncProvider | null>(null)
  const autoFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  // Get the local provider instance (singleton per component lifecycle)
  if (!localProviderRef.current) {
    localProviderRef.current = new LocalSyncProvider()
  }
  const localProvider = localProviderRef.current

  const workspaceId = useWorkspaceStore((state) => state.workspaceId)
  const syncMode = useWorkspaceStore((state) => state.syncMode)
  const multiplayerConfig = useWorkspaceStore((state) => state.multiplayerConfig)

  // Determine which provider to use based on syncMode
  const isMultiplayer = syncMode === 'multiplayer'

  // Get or create YjsSyncProvider when in multiplayer mode
  const getYjsProvider = (): YjsSyncProvider => {
    if (!yjsProviderRef.current) {
      yjsProviderRef.current = new YjsSyncProvider()
    }
    return yjsProviderRef.current
  }

  // Cleanup on unmount — destroy providers to prevent memory leaks
  useEffect(() => {
    return () => {
      localProviderRef.current?.disconnect()
      yjsProviderRef.current?.disconnect()
    }
  }, [])

  // Connect/disconnect and set up subscriptions when workspaceId or syncMode changes
  useEffect(() => {
    if (!workspaceId) {
      localProvider.disconnect()
      if (yjsProviderRef.current) {
        yjsProviderRef.current.disconnect()
      }
      return
    }

    if (isMultiplayer) {
      // --- Multiplayer mode ---
      const yjsProvider = getYjsProvider()
      let cancelled = false

      // Apply multiplayer config from store if available
      if (multiplayerConfig) {
        yjsProvider.setConfig(multiplayerConfig)

        // Initialize Y.Doc from current workspace data (for first-time share)
        const workspaceData = useWorkspaceStore.getState().getWorkspaceData()
        yjsProvider.initializeFromWorkspaceData(workspaceData)
      }

      // Subscribe to connection status changes
      const unsubStatus = yjsProvider.onStatusChange((status) => {
        if (!cancelled) setConnectionStatus(status)
      })

      // Connect to workspace (async, with error handling)
      yjsProvider.connect(workspaceId).catch((err) => {
        if (!cancelled) {
          console.error('[SyncContext] Failed to connect:', err)
          setConnectionStatus('error')
        }
      })

      // Disconnect local provider
      localProvider.disconnect()

      return () => {
        cancelled = true
        unsubStatus()
        yjsProvider.disconnect()
      }
    } else {
      // --- Local mode (existing behavior) ---

      // Disconnect Yjs provider if it was active
      if (yjsProviderRef.current) {
        yjsProviderRef.current.disconnect()
      }
      setConnectionStatus('disconnected')

      // Set up save callbacks — track save status for UI indicator
      localProvider.setSaveStartCallback(() => {
        useWorkspaceStore.getState().setSaveStatus('saving')
      })
      localProvider.setSaveSuccessCallback(() => {
        useWorkspaceStore.getState().markClean()
        // Race condition fix: if changes arrived during the async save,
        // isDirty was set to true (no-op since already true) and markClean
        // just reset it to false. Those changes would be lost. Re-check
        // and queue another save if the store became dirty during the write.
        if (useWorkspaceStore.getState().isDirty) {
          const data = useWorkspaceStore.getState().getWorkspaceData()
          localProvider.save(data)
        }
      })
      localProvider.setSaveErrorCallback(() => {
        useWorkspaceStore.getState().setSaveStatus('error')
        toast.error("Could not save workspace. Check disk space or file permissions.")
      })

      // Connect to workspace (starts file watcher)
      localProvider.connect(workspaceId)

      // Subscribe to external changes — reload workspace from disk
      const unsubExternalChange = localProvider.onExternalChange((data: WorkspaceData) => {
        const currentId = useWorkspaceStore.getState().workspaceId
        if (data.id === currentId) {
          const prevNodeCount = useWorkspaceStore.getState().nodes.length
          logger.log('[SyncProvider] External change detected, reloading workspace')
          useWorkspaceStore.getState().loadWorkspace(data)

          // If new nodes appeared (e.g., from CLI Claude creating via MCP),
          // debounce auto-fit so rapid file changes settle before we resize.
          // Without debounce, each loadWorkspace overwrites the previous auto-fit
          // before the 2000ms save debounce can persist the resized dimensions.
          const newNodeCount = useWorkspaceStore.getState().nodes.length
          if (newNodeCount > prevNodeCount) {
            logger.log(`[SyncProvider] ${newNodeCount - prevNodeCount} new nodes detected, scheduling auto-fit`)
            // Cancel any pending auto-fit — only the last one fires
            if (autoFitTimerRef.current) clearTimeout(autoFitTimerRef.current)
            autoFitTimerRef.current = setTimeout(() => {
              autoFitTimerRef.current = null
              // Re-read fresh store state (not a stale closure snapshot)
              const store = useWorkspaceStore.getState()
              if (store.batchFitNodesToContent) {
                const items: Array<{ nodeId: string; width: number; height: number }> = []
                for (const node of store.nodes) {
                  const nd = node.data as any
                  const title = nd.title || ''
                  const content = nd.content || nd.description || ''
                  if (!content && !title) continue
                  const headerH = nd.type === 'note' ? 44 : 40
                  const dims = calculateAutoFitDimensions(title, content, headerH, 36, node.width ?? 280)
                  const isHtml = nd.contentType === 'html'
                  const contentFloor = isHtml
                    ? Math.max(480, Math.min(1200, Math.round(content.length * 0.9)))
                    : content.length > 500 ? 400 : content.length > 200 ? 300 : 0
                  const widthFloor = isHtml ? 680 : content.length > 300 ? 480 : content.length > 100 ? 340 : 0
                  const finalW = Math.max(node.width ?? 280, dims.width, widthFloor)
                  const finalH = Math.max(node.height ?? 140, dims.height, contentFloor)
                  if (finalW > (node.width ?? 280) || finalH > (node.height ?? 140)) {
                    items.push({ nodeId: node.id, width: finalW, height: finalH })
                  }
                }
                if (items.length > 0) {
                  store.batchFitNodesToContent(items)
                  logger.log(`[SyncProvider] Auto-fitted ${items.length} nodes`)
                  // Write resized dims to disk IMMEDIATELY — don't rely on the
                  // 2000ms debounced save which loses the race against rapid CLI writes.
                  // SELF_WRITE_GRACE_MS (1000ms) in workspace.ts suppresses the echo.
                  const resizedData = useWorkspaceStore.getState().getWorkspaceData()
                  localProvider.saveImmediate(resizedData)
                    .then(() => logger.log('[SyncProvider] Resized dims flushed to disk'))
                    .catch((err: unknown) => logger.log('[SyncProvider] saveImmediate failed:', err))
                }
              }
              // After auto-fit, dispatch layout so nodes get repositioned with proper spacing
              const convNode = store.nodes.find((n: any) => n.data?.type === 'conversation')
              layoutEvents.dispatchEvent(new CustomEvent('run-layout', {
                detail: {
                  nodeIds: store.nodes.filter((n: any) => n.data?.type !== 'conversation').map((n: any) => n.id),
                  edgeIds: [],
                  conversationId: convNode?.id
                }
              }))
              // Zoom to fit all nodes
              requestFitView(store.nodes.map((n: any) => n.id), 0.15, 300)
            }, 600) // 600ms > 500ms file watcher debounce — fires after rapid writes settle
          }
        }
      })

      // Subscribe to store's isDirty changes — trigger debounced save
      const unsubStore = useWorkspaceStore.subscribe(
        (state) => state.isDirty,
        (isDirty) => {
          if (!isDirty) return

          // In multiplayer mode, don't save locally (Yjs handles persistence)
          if (useWorkspaceStore.getState().syncMode === 'multiplayer') return

          const data = useWorkspaceStore.getState().getWorkspaceData()
          localProvider.save(data)
        }
      )

      // Flush dirty state on window close to prevent data loss
      const handleBeforeUnload = () => {
        if (useWorkspaceStore.getState().isDirty) {
          const data = useWorkspaceStore.getState().getWorkspaceData()
          localProvider.saveImmediate(data).catch(() => {})
        }
      }
      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        unsubExternalChange()
        unsubStore()
        localProvider.setSaveStartCallback(null)
        localProvider.setSaveSuccessCallback(null)
        localProvider.setSaveErrorCallback(null)
        localProvider.disconnect()
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [workspaceId, isMultiplayer, multiplayerConfig, localProvider])

  const activeProvider: SyncProvider = isMultiplayer
    ? getYjsProvider()
    : localProvider

  const collaborativeProvider: CollaborativeSyncProvider | null = isMultiplayer
    ? getYjsProvider()
    : null

  const contextValue: SyncContextValue = {
    provider: activeProvider,
    collaborativeProvider,
    connectionStatus
  }

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  )
}
