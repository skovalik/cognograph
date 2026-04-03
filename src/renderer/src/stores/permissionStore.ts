// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Permission Store
 *
 * Zustand store for managing AI Editor permissions.
 * Tracks granted paths, pending requests, and workspace sandbox.
 *
 * v2 additions (Phase 3A PERMISSIONS):
 *   - Queue up to MAX_CONCURRENT_REQUESTS pending permission requests
 *   - 60-second auto-deny timeout per request
 *   - Batch approve/deny all pending requests
 *   - Structured display data from PermissionRequest
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import type {
  PermissionRequest as TransportPermissionRequest,
  PermissionDisplay,
} from '@shared/transport/types'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum number of concurrent permission requests in the queue. */
export const MAX_CONCURRENT_REQUESTS = 5

/** Timeout in milliseconds before a pending request is auto-denied. */
export const PERMISSION_TIMEOUT_MS = 60_000

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
  /** Structured display data carried from the transport layer */
  displayData?: {
    toolName: string
    description: string
    args?: Record<string, unknown>
  }
  /** Specialized display variant for permission card rendering (Phase 4B). */
  display?: PermissionDisplay
  /** Timer ID for auto-deny timeout */
  _timeoutId?: ReturnType<typeof setTimeout>
}

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface PermissionState {
  // Granted permissions
  grantedPermissions: Permission[]

  // Pending permission requests (max MAX_CONCURRENT_REQUESTS)
  pendingRequests: PermissionRequest[]

  // Overflow queue — requests that couldn't fit in pending
  overflowQueue: PermissionRequest[]

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
  createRequestFromTransport: (payload: TransportPermissionRequest) => string
  getPendingRequest: (requestId: string) => PermissionRequest | undefined
  clearPendingRequests: () => void

  // Batch operations
  approveAll: (duration: PermissionDuration) => void
  denyAll: () => void

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
// Timeout tracking (external to immer — timers are not serializable)
// -----------------------------------------------------------------------------

const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimeoutForRequest(requestId: string): void {
  const timerId = activeTimeouts.get(requestId)
  if (timerId !== undefined) {
    clearTimeout(timerId)
    activeTimeouts.delete(requestId)
  }
}

function clearAllTimeouts(): void {
  for (const timerId of activeTimeouts.values()) {
    clearTimeout(timerId)
  }
  activeTimeouts.clear()
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PermissionState = {
  grantedPermissions: [],
  pendingRequests: [],
  overflowQueue: [],
  workspaceSandboxPath: null
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Promote requests from overflow into pending when slots open up.
 * Mutates state in-place (must be called within an immer producer).
 */
function promoteFromOverflow(
  state: PermissionState,
  startTimeout: (requestId: string) => void
): void {
  while (
    state.pendingRequests.length < MAX_CONCURRENT_REQUESTS &&
    state.overflowQueue.length > 0
  ) {
    const next = state.overflowQueue.shift()
    if (next) {
      state.pendingRequests.push(next)
      startTimeout(next.id)
    }
  }
}

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const usePermissionStore = create<PermissionStore>()(
  persist(
    immer((set, get) => {
      /**
       * Start a 60-second auto-deny timer for a request.
       * Must be called outside immer producers (timers are side effects).
       */
      function startTimeoutForRequest(requestId: string): void {
        clearTimeoutForRequest(requestId)
        const timerId = setTimeout(() => {
          activeTimeouts.delete(requestId)
          // Auto-deny on timeout
          get().denyPermission(requestId)
        }, PERMISSION_TIMEOUT_MS)
        activeTimeouts.set(requestId, timerId)
      }

      return {
        ...initialState,

        // -----------------------------------------------------------------------
        // Permission Management
        // -----------------------------------------------------------------------

        grantPermission: (request, duration) => {
          clearTimeoutForRequest(request.id)

          set((state) => {
            // Remove from pending
            state.pendingRequests = state.pendingRequests.filter((r) => r.id !== request.id)
            // Also remove from overflow if it was there
            state.overflowQueue = state.overflowQueue.filter((r) => r.id !== request.id)

            // Calculate expiration
            let expiresAt: number | undefined
            if (duration === 'once') {
              expiresAt = Date.now() + 60000 // 1 minute grace period
            } else if (duration === 'session') {
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

            // Promote overflow requests into pending
            promoteFromOverflow(state, startTimeoutForRequest)
          })
        },

        denyPermission: (requestId) => {
          clearTimeoutForRequest(requestId)

          set((state) => {
            const request = state.pendingRequests.find((r) => r.id === requestId)
            if (request) {
              request.status = 'denied'
            }
            // Also check overflow
            const overflowRequest = state.overflowQueue.find((r) => r.id === requestId)
            if (overflowRequest) {
              state.overflowQueue = state.overflowQueue.filter((r) => r.id !== requestId)
            }
          })

          // Remove after a short delay to allow UI to update, then promote overflow
          setTimeout(() => {
            set((state) => {
              state.pendingRequests = state.pendingRequests.filter((r) => r.id !== requestId)
              promoteFromOverflow(state, startTimeoutForRequest)
            })
          }, 1000)
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
            const newRequest: PermissionRequest = {
              ...request,
              id,
              createdAt: Date.now(),
              status: 'pending'
            }

            if (state.pendingRequests.length < MAX_CONCURRENT_REQUESTS) {
              state.pendingRequests.push(newRequest)
            } else {
              state.overflowQueue.push(newRequest)
            }
          })

          // Start timeout if the request was added to pending (not overflow)
          const current = get()
          if (current.pendingRequests.some((r) => r.id === id)) {
            startTimeoutForRequest(id)
          }

          return id
        },

        createRequestFromTransport: (payload) => {
          return get().createRequest({
            type: 'shell_execute',
            command: typeof payload.args?.['command'] === 'string'
              ? payload.args['command']
              : undefined,
            reason: payload.description,
            displayData: {
              toolName: payload.toolName,
              description: payload.description,
              args: payload.args
            },
            display: payload.display
          })
        },

        getPendingRequest: (requestId) => {
          return get().pendingRequests.find((r) => r.id === requestId)
        },

        clearPendingRequests: () => {
          clearAllTimeouts()
          set((state) => {
            state.pendingRequests = []
            state.overflowQueue = []
          })
        },

        // -----------------------------------------------------------------------
        // Batch Operations
        // -----------------------------------------------------------------------

        approveAll: (duration) => {
          const pending = get().pendingRequests.filter((r) => r.status === 'pending')
          for (const request of pending) {
            get().grantPermission(request, duration)
          }
        },

        denyAll: () => {
          const pending = get().pendingRequests.filter((r) => r.status === 'pending')
          for (const request of pending) {
            get().denyPermission(request.id)
          }
          // Also clear overflow
          clearAllTimeouts()
          set((state) => {
            state.overflowQueue = []
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
      }
    }),
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

export const useOverflowQueue = () =>
  usePermissionStore((s) => s.overflowQueue)

export const useWorkspaceSandbox = () =>
  usePermissionStore((s) => s.workspaceSandboxPath)

export const useHasPermission = (type: PermissionType, resource: string) =>
  usePermissionStore((s) => s.hasPermission(type, resource))

export const usePendingCount = () =>
  usePermissionStore((s) => s.pendingRequests.filter((r) => r.status === 'pending').length)

export const useTotalQueuedCount = () =>
  usePermissionStore((s) => s.pendingRequests.length + s.overflowQueue.length)
