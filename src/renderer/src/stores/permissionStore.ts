/**
 * Permission Store
 *
 * Zustand store for managing AI Editor permissions.
 * Tracks granted paths, pending requests, and workspace sandbox.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PermissionType = 'filesystem_read' | 'filesystem_write' | 'network_fetch' | 'shell_execute'

export type PermissionDuration = 'once' | 'session' | 'workspace' | 'permanent'

export interface Permission {
  id: string
  type: PermissionType
  path?: string // For filesystem permissions
  domain?: string // For network permissions
  command?: string // For shell permissions
  grantedAt: number
  expiresAt?: number
  duration: PermissionDuration
}

export interface PermissionRequest {
  id: string
  type: PermissionType
  path?: string
  domain?: string
  command?: string
  reason: string
  preview?: string
  createdAt: number
  status: 'pending' | 'granted' | 'denied'
}

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface PermissionState {
  // Granted permissions
  grantedPermissions: Permission[]

  // Pending permission requests
  pendingRequests: PermissionRequest[]

  // Workspace sandbox path (auto-granted)
  workspaceSandboxPath: string | null
}

interface PermissionActions {
  // Permission management
  grantPermission: (request: PermissionRequest, duration: PermissionDuration) => void
  denyPermission: (requestId: string) => void
  revokePermission: (permissionId: string) => void
  clearExpiredPermissions: () => void

  // Request management
  createRequest: (request: Omit<PermissionRequest, 'id' | 'createdAt' | 'status'>) => string
  getPendingRequest: (requestId: string) => PermissionRequest | undefined
  clearPendingRequests: () => void

  // Sandbox management
  setWorkspaceSandbox: (path: string) => void
  clearWorkspaceSandbox: () => void

  // Permission checks
  hasPermission: (type: PermissionType, resource: string) => boolean
  isInSandbox: (path: string) => boolean

  // Get all permissions for a type
  getPermissionsOfType: (type: PermissionType) => Permission[]
}

type PermissionStore = PermissionState & PermissionActions

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PermissionState = {
  grantedPermissions: [],
  pendingRequests: [],
  workspaceSandboxPath: null
}

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const usePermissionStore = create<PermissionStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // Permission Management
      // -----------------------------------------------------------------------

      grantPermission: (request, duration) => {
        set((state) => {
          // Remove the pending request
          state.pendingRequests = state.pendingRequests.filter((r) => r.id !== request.id)

          // Calculate expiration
          let expiresAt: number | undefined
          if (duration === 'once') {
            // Expires immediately after use (will be checked and removed)
            expiresAt = Date.now() + 60000 // 1 minute grace period
          } else if (duration === 'session') {
            // Expires when app closes (handled by not persisting)
            expiresAt = undefined
          }

          // Add granted permission
          state.grantedPermissions.push({
            id: nanoid(),
            type: request.type,
            path: request.path,
            domain: request.domain,
            command: request.command,
            grantedAt: Date.now(),
            expiresAt,
            duration
          })
        })
      },

      denyPermission: (requestId) => {
        set((state) => {
          const request = state.pendingRequests.find((r) => r.id === requestId)
          if (request) {
            request.status = 'denied'
          }
          // Remove after a short delay to allow UI to update
          setTimeout(() => {
            set((s) => {
              s.pendingRequests = s.pendingRequests.filter((r) => r.id !== requestId)
            })
          }, 1000)
        })
      },

      revokePermission: (permissionId) => {
        set((state) => {
          state.grantedPermissions = state.grantedPermissions.filter(
            (p) => p.id !== permissionId
          )
        })
      },

      clearExpiredPermissions: () => {
        const now = Date.now()
        set((state) => {
          state.grantedPermissions = state.grantedPermissions.filter(
            (p) => !p.expiresAt || p.expiresAt > now
          )
        })
      },

      // -----------------------------------------------------------------------
      // Request Management
      // -----------------------------------------------------------------------

      createRequest: (request) => {
        const id = nanoid()
        set((state) => {
          state.pendingRequests.push({
            ...request,
            id,
            createdAt: Date.now(),
            status: 'pending'
          })
        })
        return id
      },

      getPendingRequest: (requestId) => {
        return get().pendingRequests.find((r) => r.id === requestId)
      },

      clearPendingRequests: () => {
        set((state) => {
          state.pendingRequests = []
        })
      },

      // -----------------------------------------------------------------------
      // Sandbox Management
      // -----------------------------------------------------------------------

      setWorkspaceSandbox: (path) => {
        set((state) => {
          state.workspaceSandboxPath = path
        })
      },

      clearWorkspaceSandbox: () => {
        set((state) => {
          state.workspaceSandboxPath = null
        })
      },

      // -----------------------------------------------------------------------
      // Permission Checks
      // -----------------------------------------------------------------------

      hasPermission: (type, resource) => {
        const state = get()

        // Check workspace sandbox first (auto-granted for filesystem)
        if (
          (type === 'filesystem_read' || type === 'filesystem_write') &&
          state.isInSandbox(resource)
        ) {
          return true
        }

        // Check granted permissions
        const now = Date.now()
        return state.grantedPermissions.some((p) => {
          // Check type matches
          if (p.type !== type) return false

          // Check not expired
          if (p.expiresAt && p.expiresAt < now) return false

          // Check resource matches
          switch (type) {
            case 'filesystem_read':
            case 'filesystem_write':
              // Check if resource is within the granted path
              return resource.startsWith(p.path ?? '')
            case 'network_fetch':
              // Check if domain matches
              return resource.includes(p.domain ?? '')
            case 'shell_execute':
              // Shell commands require exact match
              return resource === p.command
            default:
              return false
          }
        })
      },

      isInSandbox: (path) => {
        const sandboxPath = get().workspaceSandboxPath
        if (!sandboxPath) return false

        // Normalize paths for comparison
        const normalizedPath = path.toLowerCase().replace(/\\/g, '/')
        const normalizedSandbox = sandboxPath.toLowerCase().replace(/\\/g, '/')

        return normalizedPath.startsWith(normalizedSandbox)
      },

      // -----------------------------------------------------------------------
      // Getters
      // -----------------------------------------------------------------------

      getPermissionsOfType: (type) => {
        return get().grantedPermissions.filter((p) => p.type === type)
      }
    })),
    {
      name: 'cognograph-permissions',
      // Only persist workspace-level and permanent permissions
      partialize: (state) => ({
        grantedPermissions: state.grantedPermissions.filter(
          (p) => p.duration === 'workspace' || p.duration === 'permanent'
        ),
        workspaceSandboxPath: state.workspaceSandboxPath
      })
    }
  )
)

// -----------------------------------------------------------------------------
// Selectors
// -----------------------------------------------------------------------------

export const useGrantedPermissions = () =>
  usePermissionStore((s) => s.grantedPermissions)

export const usePendingRequests = () =>
  usePermissionStore((s) => s.pendingRequests)

export const useWorkspaceSandbox = () =>
  usePermissionStore((s) => s.workspaceSandboxPath)

export const useHasPermission = (type: PermissionType, resource: string) =>
  usePermissionStore((s) => s.hasPermission(type, resource))
