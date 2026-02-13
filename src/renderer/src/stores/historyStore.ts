/**
 * History Store
 *
 * Manages undo/redo history and drag/resize tracking for history commits.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { enableMapSet } from 'immer'
import type { HistoryAction } from '@shared/types'

// Enable Immer support for Map
enableMapSet()

// =============================================================================
// Store State
// =============================================================================

interface HistoryState {
  history: HistoryAction[]
  historyIndex: number
  dragStartPositions: Map<string, { x: number; y: number }>
  resizeStartDimensions: Map<string, { width: number; height: number }>
}

// =============================================================================
// Store Actions
// =============================================================================

interface HistoryActions {
  // History management
  pushHistory: (action: HistoryAction) => void
  undo: () => HistoryAction | null
  redo: () => HistoryAction | null
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void

  // Node drag tracking
  startNodeDrag: (nodeIds: string[], positions: Map<string, { x: number; y: number }>) => void
  commitNodeDrag: (nodeIds: string[], finalPositions: Map<string, { x: number; y: number }>) => void

  // Node resize tracking
  startNodeResize: (nodeId: string, dimensions: { width: number; height: number }) => void
  commitNodeResize: (nodeId: string, finalDimensions: { width: number; height: number }) => void

  // Batch operations
  startBatch: () => void
  commitBatch: (actions: HistoryAction[]) => void

  // History navigation
  getHistoryAtIndex: (index: number) => HistoryAction | null
  getHistoryLength: () => number
  getCurrentHistoryIndex: () => number
}

// =============================================================================
// Store Type
// =============================================================================

type HistoryStore = HistoryState & HistoryActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: HistoryState = {
  history: [],
  historyIndex: -1,
  dragStartPositions: new Map(),
  resizeStartDimensions: new Map()
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a human-readable label for a history action
 */
export function getHistoryActionLabel(action: HistoryAction): string {
  switch (action.type) {
    case 'MOVE_NODE':
      return 'Move node'
    case 'RESIZE_NODE':
      return 'Resize node'
    case 'ALIGN_NODES':
      return `Align ${action.updates.length} nodes`
    case 'DISTRIBUTE_NODES':
      return `Distribute ${action.updates.length} nodes`
    case 'SNAP_TO_GRID':
      return `Snap ${action.updates.length} nodes to grid`
    case 'ARRANGE_GRID':
      return `Arrange ${action.updates.length} nodes in grid`
    case 'ADD_NODE':
      return 'Create node'
    case 'DELETE_NODE':
      return 'Delete node'
    case 'UPDATE_NODE':
      return 'Edit node'
    case 'BULK_UPDATE_NODES':
      return `Edit ${action.updates.length} nodes`
    case 'ADD_EDGE':
      return 'Create connection'
    case 'DELETE_EDGE':
      return 'Delete connection'
    case 'UPDATE_EDGE':
      return 'Edit connection'
    case 'REVERSE_EDGE':
      return 'Reverse connection'
    case 'RECONNECT_EDGE':
      return 'Reconnect edge'
    case 'REORDER_LAYERS':
      return `Reorder ${action.updates.length} layers`
    case 'ADD_MESSAGE':
      return `Add ${action.message.role} message`
    case 'DELETE_MESSAGE':
      return `Delete ${action.message.role} message`
    case 'BATCH':
      return `${action.actions.length} actions`
    default:
      return 'Unknown action'
  }
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useHistoryStore = create<HistoryStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // History management
      // ---------------------------------------------------------------------

      pushHistory: (action) => {
        set((state) => {
          // Truncate history after current index
          state.history = state.history.slice(0, state.historyIndex + 1)

          // Add new action
          state.history.push(action)
          state.historyIndex++

          // Limit history to 100 entries
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })
      },

      undo: () => {
        const state = get()
        if (state.historyIndex < 0) return null

        const action = state.history[state.historyIndex]

        set((s) => {
          s.historyIndex--
        })

        return action || null
      },

      redo: () => {
        const state = get()
        if (state.historyIndex >= state.history.length - 1) return null

        const action = state.history[state.historyIndex + 1]

        set((s) => {
          s.historyIndex++
        })

        return action || null
      },

      canUndo: () => {
        return get().historyIndex >= 0
      },

      canRedo: () => {
        const state = get()
        return state.historyIndex < state.history.length - 1
      },

      clearHistory: () => {
        set((state) => {
          state.history = []
          state.historyIndex = -1
        })
      },

      // ---------------------------------------------------------------------
      // Node drag tracking
      // ---------------------------------------------------------------------

      startNodeDrag: (nodeIds, positions) => {
        set((state) => {
          state.dragStartPositions = new Map(positions)
        })
      },

      commitNodeDrag: (nodeIds, finalPositions) => {
        const startPositions = get().dragStartPositions

        // Build update list for history
        const updates: Array<{
          nodeId: string
          before: { x: number; y: number }
          after: { x: number; y: number }
        }> = []

        for (const nodeId of nodeIds) {
          const before = startPositions.get(nodeId)
          const after = finalPositions.get(nodeId)
          if (before && after && (before.x !== after.x || before.y !== after.y)) {
            updates.push({ nodeId, before, after })
          }
        }

        if (updates.length > 0) {
          get().pushHistory({ type: 'MOVE_NODE', updates } as HistoryAction)
        }

        // Clear drag state
        set((state) => {
          state.dragStartPositions.clear()
        })
      },

      // ---------------------------------------------------------------------
      // Node resize tracking
      // ---------------------------------------------------------------------

      startNodeResize: (nodeId, dimensions) => {
        set((state) => {
          state.resizeStartDimensions.set(nodeId, dimensions)
        })
      },

      commitNodeResize: (nodeId, finalDimensions) => {
        const startDimensions = get().resizeStartDimensions.get(nodeId)

        if (
          startDimensions &&
          (startDimensions.width !== finalDimensions.width ||
            startDimensions.height !== finalDimensions.height)
        ) {
          get().pushHistory({
            type: 'RESIZE_NODE',
            nodeId,
            before: startDimensions,
            after: finalDimensions
          } as HistoryAction)
        }

        // Clear resize state
        set((state) => {
          state.resizeStartDimensions.delete(nodeId)
        })
      },

      // ---------------------------------------------------------------------
      // Batch operations
      // ---------------------------------------------------------------------

      startBatch: () => {
        // Batches are handled at the action level
        // This is a placeholder for future batch tracking
      },

      commitBatch: (actions) => {
        if (actions.length === 0) return

        if (actions.length === 1) {
          get().pushHistory(actions[0]!)
        } else {
          get().pushHistory({ type: 'BATCH', actions })
        }
      },

      // ---------------------------------------------------------------------
      // History navigation
      // ---------------------------------------------------------------------

      getHistoryAtIndex: (index) => {
        const state = get()
        if (index < 0 || index >= state.history.length) return null
        return state.history[index] || null
      },

      getHistoryLength: () => {
        return get().history.length
      },

      getCurrentHistoryIndex: () => {
        return get().historyIndex
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useCanUndo = (): boolean => useHistoryStore((state) => state.historyIndex >= 0)

export const useCanRedo = (): boolean =>
  useHistoryStore((state) => state.historyIndex < state.history.length - 1)

export const useHistoryLength = (): number => useHistoryStore((state) => state.history.length)

export const useCurrentHistoryIndex = (): number => useHistoryStore((state) => state.historyIndex)

export const useHistoryActions = (): HistoryAction[] => useHistoryStore((state) => state.history)
