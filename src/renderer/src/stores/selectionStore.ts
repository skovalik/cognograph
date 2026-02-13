/**
 * Selection Store
 *
 * Manages selection state for nodes and edges, including box selection.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'

// =============================================================================
// Store State
// =============================================================================

interface SelectionState {
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  boxSelectRect: { x: number; y: number; width: number; height: number } | null
  lastCreatedNodeId: string | null
}

// =============================================================================
// Store Actions
// =============================================================================

interface SelectionActions {
  // Node selection
  setSelectedNodes: (nodeIds: string[]) => void
  toggleNodeSelection: (nodeId: string) => void
  addNodeToSelection: (nodeId: string) => void
  removeNodeFromSelection: (nodeId: string) => void
  isNodeSelected: (nodeId: string) => boolean

  // Edge selection
  setSelectedEdges: (edgeIds: string[]) => void
  toggleEdgeSelection: (edgeId: string) => void
  addEdgeToSelection: (edgeId: string) => void
  removeEdgeFromSelection: (edgeId: string) => void
  isEdgeSelected: (edgeId: string) => boolean

  // Combined selection
  clearSelection: () => void
  selectAll: (nodeIds: string[], edgeIds: string[]) => void
  getSelectedCount: () => number

  // Box selection
  startBoxSelect: (x: number, y: number) => void
  updateBoxSelect: (width: number, height: number) => void
  endBoxSelect: () => void

  // Last created node tracking
  setLastCreatedNodeId: (nodeId: string | null) => void
  clearLastCreatedNodeId: () => void
}

// =============================================================================
// Store Type
// =============================================================================

type SelectionStore = SelectionState & SelectionActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: SelectionState = {
  selectedNodeIds: [],
  selectedEdgeIds: [],
  boxSelectRect: null,
  lastCreatedNodeId: null
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useSelectionStore = create<SelectionStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Node selection
      // ---------------------------------------------------------------------

      setSelectedNodes: (nodeIds) => {
        set((state) => {
          state.selectedNodeIds = nodeIds
        })
      },

      toggleNodeSelection: (nodeId) => {
        set((state) => {
          const index = state.selectedNodeIds.indexOf(nodeId)
          if (index === -1) {
            state.selectedNodeIds.push(nodeId)
          } else {
            state.selectedNodeIds.splice(index, 1)
          }
        })
      },

      addNodeToSelection: (nodeId) => {
        set((state) => {
          if (!state.selectedNodeIds.includes(nodeId)) {
            state.selectedNodeIds.push(nodeId)
          }
        })
      },

      removeNodeFromSelection: (nodeId) => {
        set((state) => {
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId)
        })
      },

      isNodeSelected: (nodeId) => {
        return get().selectedNodeIds.includes(nodeId)
      },

      // ---------------------------------------------------------------------
      // Edge selection
      // ---------------------------------------------------------------------

      setSelectedEdges: (edgeIds) => {
        set((state) => {
          state.selectedEdgeIds = edgeIds
        })
      },

      toggleEdgeSelection: (edgeId) => {
        set((state) => {
          const index = state.selectedEdgeIds.indexOf(edgeId)
          if (index === -1) {
            state.selectedEdgeIds.push(edgeId)
          } else {
            state.selectedEdgeIds.splice(index, 1)
          }
        })
      },

      addEdgeToSelection: (edgeId) => {
        set((state) => {
          if (!state.selectedEdgeIds.includes(edgeId)) {
            state.selectedEdgeIds.push(edgeId)
          }
        })
      },

      removeEdgeFromSelection: (edgeId) => {
        set((state) => {
          state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => id !== edgeId)
        })
      },

      isEdgeSelected: (edgeId) => {
        return get().selectedEdgeIds.includes(edgeId)
      },

      // ---------------------------------------------------------------------
      // Combined selection
      // ---------------------------------------------------------------------

      clearSelection: () => {
        set((state) => {
          state.selectedNodeIds = []
          state.selectedEdgeIds = []
        })
      },

      selectAll: (nodeIds, edgeIds) => {
        set((state) => {
          state.selectedNodeIds = nodeIds
          state.selectedEdgeIds = edgeIds
        })
      },

      getSelectedCount: () => {
        const state = get()
        return state.selectedNodeIds.length + state.selectedEdgeIds.length
      },

      // ---------------------------------------------------------------------
      // Box selection
      // ---------------------------------------------------------------------

      startBoxSelect: (x, y) => {
        set((state) => {
          state.boxSelectRect = { x, y, width: 0, height: 0 }
        })
      },

      updateBoxSelect: (width, height) => {
        set((state) => {
          if (state.boxSelectRect) {
            state.boxSelectRect.width = width
            state.boxSelectRect.height = height
          }
        })
      },

      endBoxSelect: () => {
        set((state) => {
          state.boxSelectRect = null
        })
      },

      // ---------------------------------------------------------------------
      // Last created node tracking
      // ---------------------------------------------------------------------

      setLastCreatedNodeId: (nodeId) => {
        set((state) => {
          state.lastCreatedNodeId = nodeId
        })
      },

      clearLastCreatedNodeId: () => {
        set((state) => {
          state.lastCreatedNodeId = null
        })
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useSelectedNodeIds = (): string[] =>
  useSelectionStore((state) => state.selectedNodeIds)

export const useSelectedEdgeIds = (): string[] =>
  useSelectionStore((state) => state.selectedEdgeIds)

export const useIsNodeSelected = (nodeId: string): boolean =>
  useSelectionStore((state) => state.selectedNodeIds.includes(nodeId))

export const useIsEdgeSelected = (edgeId: string): boolean =>
  useSelectionStore((state) => state.selectedEdgeIds.includes(edgeId))

export const useSelectionCount = (): number =>
  useSelectionStore((state) => state.selectedNodeIds.length + state.selectedEdgeIds.length)

export const useBoxSelectRect = () => useSelectionStore((state) => state.boxSelectRect)

export const useLastCreatedNodeId = (): string | null =>
  useSelectionStore((state) => state.lastCreatedNodeId)
