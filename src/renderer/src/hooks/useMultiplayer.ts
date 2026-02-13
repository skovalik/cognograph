/**
 * useMultiplayer — Hook for managing multiplayer connection state.
 *
 * Provides:
 * - Connection status
 * - Share/Join workspace flows
 * - User list from awareness
 * - Permission level
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useCollaborativeProvider, useConnectionStatus } from '../sync'
import { YjsSyncProvider } from '../sync/YjsSyncProvider'
import type { ConnectionStatus, UserPresence, TokenPermission } from '@shared/multiplayerTypes'

interface MultiplayerState {
  isMultiplayer: boolean
  connectionStatus: ConnectionStatus
  connectedUsers: UserPresence[]
  permissions: TokenPermission | null
  serverUrl: string | null
  token: string | null
}

interface MultiplayerActions {
  shareWorkspace: () => Promise<{ success: boolean; inviteUrl?: string; error?: string }>
  joinWorkspace: (inviteLink: string) => Promise<{ success: boolean; error?: string }>
  createInvite: (permissions?: TokenPermission) => Promise<{ success: boolean; inviteUrl?: string; error?: string }>
  disconnect: () => void
  goOffline: () => void
  goOnline: () => Promise<void>
}

export function useMultiplayer(): MultiplayerState & MultiplayerActions {
  const syncMode = useWorkspaceStore((s) => s.syncMode)
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const workspaceName = useWorkspaceStore((s) => s.workspaceName)
  const connectionStatus = useConnectionStatus()
  const collaborativeProvider = useCollaborativeProvider()

  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([])
  const [permissions, setPermissions] = useState<TokenPermission | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Track awareness changes for user list
  useEffect(() => {
    if (!collaborativeProvider) {
      setConnectedUsers([])
      return
    }

    const awareness = collaborativeProvider.getAwareness()
    const updateUsers = (): void => {
      const states = awareness.getStates()
      const users: UserPresence[] = []
      states.forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) {
          users.push({
            id: state.user.id || String(clientId),
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#888888',
            cursor: state.cursor || null,
            selectedNodeIds: state.selectedNodeIds || [],
            viewportBounds: state.viewportBounds || { x: 0, y: 0, width: 0, height: 0 },
            lastActive: Date.now()
          })
        }
      })
      setConnectedUsers(users)
    }

    awareness.on('change', updateUsers)
    updateUsers()

    return () => {
      awareness.off('change', updateUsers)
    }
  }, [collaborativeProvider])

  // Listen for deep link join events (uses ref to avoid stale closure)
  const handleJoinRef = useRef<(wsId: string, token: string) => Promise<{ success: boolean; error?: string }>>(
    async () => ({ success: false, error: 'Not initialized' })
  )

  useEffect(() => {
    const unsub = window.api.multiplayer.onDeepLink(async (data) => {
      if (data.workspaceId && data.token) {
        await handleJoinRef.current(data.workspaceId, data.token)
      }
    })
    return unsub
  }, [])

  const shareWorkspace = useCallback(async () => {
    if (!workspaceId || !workspaceName) {
      return { success: false, error: 'No workspace loaded' }
    }

    // 1. Create workspace on server and get admin token
    const result = await window.api.multiplayer.shareWorkspace(workspaceId, workspaceName)
    if (!result.success) {
      return { success: false, error: result.error }
    }

    // 2. Store the server URL and token (local state for UI)
    setServerUrl(result.serverUrl || null)
    setToken(result.token || null)
    setPermissions('admin')

    // 3. Store multiplayer config in Zustand store (SyncContext will apply it)
    const config = {
      serverUrl: result.serverUrl || 'ws://localhost:3001',
      workspaceId,
      token: result.token || '',
      userName: 'Host',
      userColor: '#4f46e5'
    }
    useWorkspaceStore.getState().setMultiplayerConfig(config)

    // 4. Switch to multiplayer mode (SyncContext will create provider and apply config)
    useWorkspaceStore.getState().setSyncMode('multiplayer')

    // 5. Create an invite link for sharing
    const inviteResult = await window.api.multiplayer.createInvite(workspaceId, 'write')
    return {
      success: true,
      inviteUrl: inviteResult.inviteUrl
    }
  }, [workspaceId, workspaceName])

  const handleJoin = async (wsId: string, wsToken: string): Promise<{ success: boolean; error?: string }> => {
    // Get WebSocket URL
    const urlResult = await window.api.multiplayer.getServerUrl()
    const wsUrl = urlResult.wsUrl || 'ws://localhost:3001'

    // Store the token securely for future API calls
    await window.api.multiplayer.storeToken(wsId, wsToken)

    setServerUrl(wsUrl)
    setToken(wsToken)
    setPermissions('write')

    // Generate random guest identity
    const guestHex = Math.random().toString(16).slice(2, 6)
    const guestColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
    const guestColor = guestColors[Math.floor(Math.random() * guestColors.length)]

    // Store multiplayer config in Zustand store
    const config = {
      serverUrl: wsUrl,
      workspaceId: wsId,
      token: wsToken,
      userName: `Guest-${guestHex}`,
      userColor: guestColor
    }
    useWorkspaceStore.getState().setMultiplayerConfig(config)

    // Switch to multiplayer mode (this will trigger SyncContext to create YjsSyncProvider)
    useWorkspaceStore.getState().setSyncMode('multiplayer')

    return { success: true }
  }

  // Keep ref updated with latest handleJoin
  handleJoinRef.current = handleJoin

  const joinWorkspace = useCallback(async (inviteLink: string) => {
    // Parse the invite link
    const parsed = await window.api.multiplayer.parseInviteLink(inviteLink)
    if (!parsed.success || !parsed.workspaceId || !parsed.token) {
      return { success: false, error: parsed.error || 'Invalid invite link data' }
    }

    return handleJoin(parsed.workspaceId, parsed.token)
  }, [])

  const createInvite = useCallback(async (invitePermissions: TokenPermission = 'write') => {
    if (!workspaceId) {
      return { success: false, error: 'No workspace loaded' }
    }

    const result = await window.api.multiplayer.createInvite(workspaceId, invitePermissions)
    return {
      success: result.success,
      inviteUrl: result.inviteUrl,
      error: result.error
    }
  }, [workspaceId])

  const disconnect = useCallback(async () => {
    // Remove stored token on disconnect
    if (workspaceId) {
      await window.api.multiplayer.removeToken(workspaceId)
    }

    useWorkspaceStore.getState().setSyncMode('local')
    setServerUrl(null)
    setToken(null)
    setPermissions(null)
    setConnectedUsers([])
  }, [workspaceId])

  const goOffline = useCallback(() => {
    if (collaborativeProvider) {
      const provider = collaborativeProvider as YjsSyncProvider
      provider.goOffline()
    }
  }, [collaborativeProvider])

  const goOnline = useCallback(async () => {
    if (collaborativeProvider) {
      const provider = collaborativeProvider as YjsSyncProvider
      await provider.goOnline()
    }
  }, [collaborativeProvider])

  return {
    isMultiplayer: syncMode === 'multiplayer',
    connectionStatus,
    connectedUsers,
    permissions,
    serverUrl,
    token,
    shareWorkspace,
    joinWorkspace,
    createInvite,
    disconnect,
    goOffline,
    goOnline
  }
}
