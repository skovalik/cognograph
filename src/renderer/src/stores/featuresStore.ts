/**
 * Features Store
 *
 * Manages feature-related state: workspace identity, history, extractions, sync, status.
 * This store is being extracted from workspaceStore as part of the store split.
 *
 * Created as part of Batch 0B: Split workspaceStore
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  HistoryAction,
  PropertySchema,
  ContextSettings,
  PendingExtraction
} from '@shared/types'
import type { FeaturesState, TrashedItem, ExtractionDragState, LastAcceptedExtraction } from './types'

// =============================================================================
// Action Types
// =============================================================================

interface FeaturesActions {
  // Workspace Identity
  setWorkspaceId: (id: string | null) => void
  setWorkspaceName: (name: string) => void
  setPropertySchema: (schema: PropertySchema) => void
  setContextSettings: (settings: ContextSettings) => void

  // History (undo/redo)
  pushHistory: (action: HistoryAction) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void

  // Extractions
  addPendingExtraction: (extraction: PendingExtraction) => void
  removePendingExtraction: (id: string) => void
  clearPendingExtractions: () => void
  setExtractionSourceFilter: (sourceId: string | null) => void
  setIsExtracting: (nodeId: string | null) => void
  setOpenExtractionPanelNodeId: (nodeId: string | null) => void
  setExtractionDrag: (drag: ExtractionDragState | null) => void
  setLastAcceptedExtraction: (extraction: LastAcceptedExtraction | null) => void

  // Multiplayer
  setSyncMode: (mode: 'local' | 'multiplayer') => void
  setMultiplayerConfig: (config: FeaturesState['multiplayerConfig']) => void
  setSyncSource: (source: 'local' | 'yjs') => void

  // Status
  setIsDirty: (isDirty: boolean) => void
  setIsLoading: (isLoading: boolean) => void
  setLastSaved: (timestamp: number | null) => void
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void

  // Trash
  moveToTrash: (item: TrashedItem) => void
  restoreFromTrash: (nodeId: string) => TrashedItem | null
  emptyTrash: () => void
  getTrashItem: (nodeId: string) => TrashedItem | null
}

// =============================================================================
// Store Type
// =============================================================================

type FeaturesStore = FeaturesState & FeaturesActions

// =============================================================================
// Initial State
// =============================================================================

const initialFeaturesState: FeaturesState = {
  // Workspace identity
  workspaceId: null,
  workspaceName: 'Untitled Workspace',
  propertySchema: { properties: [] },
  contextSettings: {
    defaultContextDepth: 2,
    maxTokens: 50000,
    defaultEdgeWeight: 5
  },

  // History
  history: [],
  historyIndex: -1,

  // Extractions
  pendingExtractions: [],
  extractionSourceFilter: null,
  isExtracting: null,
  openExtractionPanelNodeId: null,
  extractionDrag: null,
  lastAcceptedExtraction: null,

  // Multiplayer
  syncMode: 'local',
  multiplayerConfig: null,
  _syncSource: 'local',

  // Status
  isDirty: false,
  isLoading: false,
  lastSaved: null,
  saveStatus: 'saved',

  // Trash
  trash: []
}

// =============================================================================
// Store Creation
// =============================================================================

/**
 * Features store - manages workspace, history, extractions, sync, status.
 *
 * NOTE: During migration, some actions may delegate to workspaceStore.
 * Once migration is complete, the full implementations will live here.
 */
export const useFeaturesStore = create<FeaturesStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialFeaturesState,

      // -------------------------------------------------------------------------
      // Workspace Identity (can implement directly)
      // -------------------------------------------------------------------------

      setWorkspaceId: (id) => {
        set((state) => {
          state.workspaceId = id
        })
      },

      setWorkspaceName: (name) => {
        set((state) => {
          state.workspaceName = name
          state.isDirty = true
        })
      },

      setPropertySchema: (schema) => {
        set((state) => {
          state.propertySchema = schema
          state.isDirty = true
        })
      },

      setContextSettings: (settings) => {
        set((state) => {
          state.contextSettings = settings
          state.isDirty = true
        })
      },

      // -------------------------------------------------------------------------
      // History (stubs - complex logic depends on canvas state)
      // -------------------------------------------------------------------------

      pushHistory: (action) => {
        set((state) => {
          // Truncate future history when adding new action
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push(action)
          state.historyIndex = state.history.length - 1
        })
      },

      undo: () => {
        throw new Error('[featuresStore] undo not yet migrated - use workspaceStore')
      },

      redo: () => {
        throw new Error('[featuresStore] redo not yet migrated - use workspaceStore')
      },

      clearHistory: () => {
        set((state) => {
          state.history = []
          state.historyIndex = -1
        })
      },

      // -------------------------------------------------------------------------
      // Extractions (can implement directly)
      // -------------------------------------------------------------------------

      addPendingExtraction: (extraction) => {
        set((state) => {
          state.pendingExtractions.push(extraction)
        })
      },

      removePendingExtraction: (id) => {
        set((state) => {
          state.pendingExtractions = state.pendingExtractions.filter((e) => e.id !== id)
        })
      },

      clearPendingExtractions: () => {
        set((state) => {
          state.pendingExtractions = []
        })
      },

      setExtractionSourceFilter: (sourceId) => {
        set((state) => {
          state.extractionSourceFilter = sourceId
        })
      },

      setIsExtracting: (nodeId) => {
        set((state) => {
          state.isExtracting = nodeId
        })
      },

      setOpenExtractionPanelNodeId: (nodeId) => {
        set((state) => {
          state.openExtractionPanelNodeId = nodeId
        })
      },

      setExtractionDrag: (drag) => {
        set((state) => {
          state.extractionDrag = drag
        })
      },

      setLastAcceptedExtraction: (extraction) => {
        set((state) => {
          state.lastAcceptedExtraction = extraction
        })
      },

      // -------------------------------------------------------------------------
      // Multiplayer (can implement directly)
      // -------------------------------------------------------------------------

      setSyncMode: (mode) => {
        set((state) => {
          state.syncMode = mode
        })
      },

      setMultiplayerConfig: (config) => {
        set((state) => {
          state.multiplayerConfig = config
        })
      },

      setSyncSource: (source) => {
        set((state) => {
          state._syncSource = source
        })
      },

      // -------------------------------------------------------------------------
      // Status (can implement directly)
      // -------------------------------------------------------------------------

      setIsDirty: (isDirty) => {
        set((state) => {
          state.isDirty = isDirty
        })
      },

      setIsLoading: (isLoading) => {
        set((state) => {
          state.isLoading = isLoading
        })
      },

      setLastSaved: (timestamp) => {
        set((state) => {
          state.lastSaved = timestamp
        })
      },

      setSaveStatus: (status) => {
        set((state) => {
          state.saveStatus = status
        })
      },

      // -------------------------------------------------------------------------
      // Trash (can implement directly)
      // -------------------------------------------------------------------------

      moveToTrash: (item) => {
        set((state) => {
          state.trash.push(item)
        })
      },

      restoreFromTrash: (nodeId) => {
        const state = get()
        const item = state.trash.find((t) => t.node.id === nodeId)
        if (!item) return null

        set((state) => {
          state.trash = state.trash.filter((t) => t.node.id !== nodeId)
        })

        return item
      },

      emptyTrash: () => {
        set((state) => {
          state.trash = []
        })
      },

      getTrashItem: (nodeId) => {
        return get().trash.find((t) => t.node.id === nodeId) ?? null
      }
    }))
  )
)

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get workspace ID
 */
export const selectWorkspaceId = (state: FeaturesStore) => state.workspaceId

/**
 * Get workspace name
 */
export const selectWorkspaceName = (state: FeaturesStore) => state.workspaceName

/**
 * Get dirty state
 */
export const selectIsDirty = (state: FeaturesStore) => state.isDirty

/**
 * Get loading state
 */
export const selectIsLoading = (state: FeaturesStore) => state.isLoading

/**
 * Get save status
 */
export const selectSaveStatus = (state: FeaturesStore) => state.saveStatus

/**
 * Get history state
 */
export const selectHistoryState = (state: FeaturesStore) => ({
  canUndo: state.historyIndex >= 0,
  canRedo: state.historyIndex < state.history.length - 1,
  historyLength: state.history.length,
  historyIndex: state.historyIndex
})

/**
 * Get pending extractions
 */
export const selectPendingExtractions = (state: FeaturesStore) => state.pendingExtractions

/**
 * Get pending extractions for a specific source
 */
export const selectPendingExtractionsForSource = (sourceId: string) => (state: FeaturesStore) =>
  state.pendingExtractions.filter((e) => e.sourceNodeId === sourceId)

/**
 * Get trash items
 */
export const selectTrash = (state: FeaturesStore) => state.trash

/**
 * Get sync mode
 */
export const selectSyncMode = (state: FeaturesStore) => state.syncMode
