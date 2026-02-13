// =============================================================================
// MULTIPLAYER TYPES - Shared between client and server
// =============================================================================

// -----------------------------------------------------------------------------
// User Presence (Yjs Awareness)
// -----------------------------------------------------------------------------

export interface UserPresence {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  selectedNodeIds: string[]
  viewportBounds: { x: number; y: number; width: number; height: number }
  lastActive: number
}

// -----------------------------------------------------------------------------
// Multiplayer Configuration
// -----------------------------------------------------------------------------

export interface MultiplayerConfig {
  serverUrl: string
  workspaceId: string
  token: string
  userName: string
  userColor: string
}

// -----------------------------------------------------------------------------
// Workspace Sync Mode
// -----------------------------------------------------------------------------

export type SyncMode = 'local' | 'multiplayer'

// -----------------------------------------------------------------------------
// Invite / Token Types
// -----------------------------------------------------------------------------

export type TokenPermission = 'read' | 'write' | 'admin'

export interface WorkspaceToken {
  id: string
  workspaceId: string
  token: string
  permissions: TokenPermission
  expiresAt: string | null
  createdAt: string
}

export interface InviteLink {
  url: string
  token: string
  workspaceId: string
  permissions: TokenPermission
  expiresAt: string | null
}

// -----------------------------------------------------------------------------
// Connection State
// -----------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  error: string | null
  connectedUsers: UserPresence[]
  lastSyncedAt: number | null
}

// -----------------------------------------------------------------------------
// Branch Types
// -----------------------------------------------------------------------------

export interface WorkspaceBranch {
  id: string
  workspaceId: string
  name: string
  parentBranchId: string | null
  snapshotId: string
  createdAt: string
  updatedAt: string
}

export interface BranchSnapshot {
  id: string
  workspaceId: string
  branchId: string
  state: Uint8Array // Encoded Yjs state
  createdAt: string
}
