/**
 * Persistence Store
 *
 * Manages workspace persistence, save status, and workspace metadata.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { WorkspaceData } from '@shared/types'

// =============================================================================
// Store State
// =============================================================================

interface PersistenceState {
  currentWorkspacePath: string | null
  workspaceId: string | null
  workspaceName: string
  isDirty: boolean
  isLoading: boolean
  createdAt: number | null
  lastSaved: number | null
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  autoSaveEnabled: boolean
  autoSaveInterval: number // ms
}

// =============================================================================
// Store Actions
// =============================================================================

interface PersistenceActions {
  // Workspace lifecycle
  newWorkspace: () => void
  loadWorkspace: (data: WorkspaceData) => void
  saveWorkspace: () => Promise<void>
  closeWorkspace: () => void

  // Workspace metadata
  updateWorkspaceName: (name: string) => void
  setWorkspaceId: (id: string | null) => void
  setWorkspacePath: (path: string | null) => void

  // Save status
  markDirty: () => void
  markClean: () => void
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void
  setIsLoading: (isLoading: boolean) => void

  // Auto-save
  enableAutoSave: () => void
  disableAutoSave: () => void
  setAutoSaveInterval: (interval: number) => void

  // Workspace data
  getWorkspaceData: () => WorkspaceData
  importWorkspaceData: (data: WorkspaceData) => void

  // Timestamps
  setCreatedAt: (timestamp: number) => void
  setLastSaved: (timestamp: number) => void
}

// =============================================================================
// Store Type
// =============================================================================

type PersistenceStore = PersistenceState & PersistenceActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: PersistenceState = {
  currentWorkspacePath: null,
  workspaceId: null,
  workspaceName: 'Untitled Workspace',
  isDirty: false,
  isLoading: false,
  createdAt: null,
  lastSaved: null,
  saveStatus: 'saved',
  autoSaveEnabled: true,
  autoSaveInterval: 2000 // 2 seconds
}

// =============================================================================
// Store Implementation
// =============================================================================

export const usePersistenceStore = create<PersistenceStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Workspace lifecycle
      // ---------------------------------------------------------------------

      newWorkspace: () => {
        set((state) => {
          state.workspaceId = uuid()
          state.workspaceName = 'Untitled Workspace'
          state.currentWorkspacePath = null
          state.isDirty = false
          state.isLoading = false
          state.createdAt = Date.now()
          state.lastSaved = null
          state.saveStatus = 'saved'
        })
      },

      loadWorkspace: (data) => {
        set((state) => {
          state.workspaceId = data.workspaceId || null
          state.workspaceName = data.workspaceName || 'Untitled Workspace'
          state.createdAt = data.createdAt || Date.now()
          state.lastSaved = Date.now()
          state.isDirty = false
          state.isLoading = false
          state.saveStatus = 'saved'
        })
      },

      saveWorkspace: async () => {
        set((state) => {
          state.saveStatus = 'saving'
        })

        try {
          // This would typically call an IPC handler to save the workspace
          // await window.api.saveWorkspace(get().getWorkspaceData())

          set((state) => {
            state.lastSaved = Date.now()
            state.isDirty = false
            state.saveStatus = 'saved'
          })
        } catch (error) {
          set((state) => {
            state.saveStatus = 'error'
          })
          throw error
        }
      },

      closeWorkspace: () => {
        set((state) => {
          state.workspaceId = null
          state.workspaceName = 'Untitled Workspace'
          state.currentWorkspacePath = null
          state.isDirty = false
          state.isLoading = false
          state.createdAt = null
          state.lastSaved = null
          state.saveStatus = 'saved'
        })
      },

      // ---------------------------------------------------------------------
      // Workspace metadata
      // ---------------------------------------------------------------------

      updateWorkspaceName: (name) => {
        set((state) => {
          state.workspaceName = name
          state.isDirty = true
        })
      },

      setWorkspaceId: (id) => {
        set((state) => {
          state.workspaceId = id
        })
      },

      setWorkspacePath: (path) => {
        set((state) => {
          state.currentWorkspacePath = path
        })
      },

      // ---------------------------------------------------------------------
      // Save status
      // ---------------------------------------------------------------------

      markDirty: () => {
        set((state) => {
          state.isDirty = true
          if (state.saveStatus === 'saved') {
            state.saveStatus = 'unsaved'
          }
        })
      },

      markClean: () => {
        set((state) => {
          state.isDirty = false
          state.saveStatus = 'saved'
        })
      },

      setSaveStatus: (status) => {
        set((state) => {
          state.saveStatus = status
        })
      },

      setIsLoading: (isLoading) => {
        set((state) => {
          state.isLoading = isLoading
        })
      },

      // ---------------------------------------------------------------------
      // Auto-save
      // ---------------------------------------------------------------------

      enableAutoSave: () => {
        set((state) => {
          state.autoSaveEnabled = true
        })
      },

      disableAutoSave: () => {
        set((state) => {
          state.autoSaveEnabled = false
        })
      },

      setAutoSaveInterval: (interval) => {
        set((state) => {
          state.autoSaveInterval = Math.max(1000, interval) // Minimum 1 second
        })
      },

      // ---------------------------------------------------------------------
      // Workspace data
      // ---------------------------------------------------------------------

      getWorkspaceData: () => {
        // This would collect data from all stores to create a WorkspaceData object
        // For now, return a minimal structure
        const state = get()
        return {
          workspaceId: state.workspaceId || undefined,
          workspaceName: state.workspaceName,
          nodes: [], // Would be collected from nodesStore
          edges: [], // Would be collected from edgesStore
          viewport: { x: 0, y: 0, zoom: 1 }, // Would be collected from canvasViewportStore
          propertySchema: { properties: [] }, // Would be collected from propertiesStore
          createdAt: state.createdAt || undefined,
          lastSaved: state.lastSaved || undefined
        } as WorkspaceData
      },

      importWorkspaceData: (data) => {
        get().loadWorkspace(data)
        // This would also distribute data to other stores
      },

      // ---------------------------------------------------------------------
      // Timestamps
      // ---------------------------------------------------------------------

      setCreatedAt: (timestamp) => {
        set((state) => {
          state.createdAt = timestamp
        })
      },

      setLastSaved: (timestamp) => {
        set((state) => {
          state.lastSaved = timestamp
        })
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useWorkspaceName = (): string =>
  usePersistenceStore((state) => state.workspaceName)

export const useWorkspaceId = (): string | null =>
  usePersistenceStore((state) => state.workspaceId)

export const useWorkspacePath = (): string | null =>
  usePersistenceStore((state) => state.currentWorkspacePath)

export const useIsDirty = (): boolean => usePersistenceStore((state) => state.isDirty)

export const useIsLoading = (): boolean => usePersistenceStore((state) => state.isLoading)

export const useSaveStatus = (): 'saved' | 'saving' | 'unsaved' | 'error' =>
  usePersistenceStore((state) => state.saveStatus)

export const useLastSaved = (): number | null =>
  usePersistenceStore((state) => state.lastSaved)

export const useAutoSaveEnabled = (): boolean =>
  usePersistenceStore((state) => state.autoSaveEnabled)

export const useAutoSaveInterval = (): number =>
  usePersistenceStore((state) => state.autoSaveInterval)
