import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { LocalSyncProvider } from './LocalSyncProvider'
import { YjsSyncProvider } from './YjsSyncProvider'
import type { SyncProvider } from './SyncProvider'
import type { CollaborativeSyncProvider } from './CollaborativeSyncProvider'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { WorkspaceData } from '@shared/types'
import type { ConnectionStatus } from '@shared/multiplayerTypes'
import { logger } from '../utils/logger'

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
      })
      localProvider.setSaveErrorCallback(() => {
        useWorkspaceStore.getState().setSaveStatus('error')
      })

      // Connect to workspace (starts file watcher)
      localProvider.connect(workspaceId)

      // Subscribe to external changes — reload workspace from disk
      const unsubExternalChange = localProvider.onExternalChange((data: WorkspaceData) => {
        const currentId = useWorkspaceStore.getState().workspaceId
        if (data.id === currentId) {
          logger.log('[SyncProvider] External change detected, reloading workspace')
          useWorkspaceStore.getState().loadWorkspace(data)
        }
      })

      // Subscribe to store's isDirty changes — trigger debounced save
      let isFirstChange = true
      const unsubStore = useWorkspaceStore.subscribe(
        (state) => state.isDirty,
        (isDirty) => {
          // Skip the initial subscription firing
          if (isFirstChange) {
            isFirstChange = false
            return
          }
          if (!isDirty) return

          // In multiplayer mode, don't save locally (Yjs handles persistence)
          if (useWorkspaceStore.getState().syncMode === 'multiplayer') return

          const data = useWorkspaceStore.getState().getWorkspaceData()
          localProvider.save(data)
        }
      )

      return () => {
        unsubExternalChange()
        unsubStore()
        localProvider.setSaveStartCallback(null)
        localProvider.setSaveSuccessCallback(null)
        localProvider.setSaveErrorCallback(null)
        localProvider.disconnect()
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
