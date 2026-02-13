/**
 * Canvas Viewport Store
 *
 * Manages viewport state, focus mode, bookmarks, and saved views.
 * Extracted from workspaceStore as part of Week 2 Stream B Track 2 Phase 2.2a.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

// =============================================================================
// Store State
// =============================================================================

interface SavedView {
  id: string
  name: string
  viewport: { x: number; y: number; zoom: number }
  selectedNodeIds: string[]
  createdAt: number
}

interface CanvasViewportState {
  viewport: { x: number; y: number; zoom: number }
  focusModeNodeId: string | null
  bookmarkedNodeId: string | null
  numberedBookmarks: Record<number, string | null> // 1-9
  savedViews: SavedView[]
  lastCanvasClick: { x: number; y: number; time: number } | null
}

// =============================================================================
// Store Actions
// =============================================================================

interface CanvasViewportActions {
  // Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  fitView: () => void
  centerNode: (nodeId: string) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void

  // Focus mode
  setFocusModeNode: (nodeId: string | null) => void
  toggleFocusMode: () => void
  isFocusModeActive: () => boolean

  // Bookmarks
  setBookmarkedNode: (nodeId: string | null) => void
  toggleBookmark: () => void
  setNumberedBookmark: (num: number, nodeId: string | null) => void
  clearNumberedBookmark: (num: number) => void
  getNumberedBookmarkNodeId: (num: number) => string | null
  jumpToNumberedBookmark: (num: number) => string | null

  // Saved views
  saveView: (name: string, selectedNodeIds: string[]) => string
  restoreView: (viewId: string) => void
  deleteView: (viewId: string) => void
  renameView: (viewId: string, newName: string) => void

  // Canvas interaction
  recordCanvasClick: (position: { x: number; y: number }) => void
  getLastCanvasClick: () => { x: number; y: number; time: number } | null
}

// =============================================================================
// Store Type
// =============================================================================

type CanvasViewportStore = CanvasViewportState & CanvasViewportActions

// =============================================================================
// Initial State
// =============================================================================

const initialState: CanvasViewportState = {
  viewport: { x: 0, y: 0, zoom: 1 },
  focusModeNodeId: null,
  bookmarkedNodeId: null,
  numberedBookmarks: {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null
  },
  savedViews: [],
  lastCanvasClick: null
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useCanvasViewportStore = create<CanvasViewportStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ---------------------------------------------------------------------
      // Viewport
      // ---------------------------------------------------------------------

      setViewport: (viewport) => {
        set((state) => {
          state.viewport = viewport
        })
      },

      fitView: () => {
        // This would typically call React Flow's fitView()
        // Implementation depends on React Flow instance
      },

      centerNode: (nodeId) => {
        // This would typically calculate the viewport to center on a node
        // Implementation depends on node position and React Flow instance
      },

      zoomIn: () => {
        set((state) => {
          state.viewport.zoom = Math.min(state.viewport.zoom * 1.2, 4)
        })
      },

      zoomOut: () => {
        set((state) => {
          state.viewport.zoom = Math.max(state.viewport.zoom / 1.2, 0.1)
        })
      },

      resetZoom: () => {
        set((state) => {
          state.viewport.zoom = 1
        })
      },

      // ---------------------------------------------------------------------
      // Focus mode
      // ---------------------------------------------------------------------

      setFocusModeNode: (nodeId) => {
        set((state) => {
          state.focusModeNodeId = nodeId
        })
      },

      toggleFocusMode: () => {
        set((state) => {
          state.focusModeNodeId = state.focusModeNodeId ? null : state.bookmarkedNodeId
        })
      },

      isFocusModeActive: () => {
        return get().focusModeNodeId !== null
      },

      // ---------------------------------------------------------------------
      // Bookmarks
      // ---------------------------------------------------------------------

      setBookmarkedNode: (nodeId) => {
        set((state) => {
          state.bookmarkedNodeId = nodeId
        })
      },

      toggleBookmark: () => {
        set((state) => {
          // Toggle requires a selected node - implementation depends on selection store
          state.bookmarkedNodeId = state.bookmarkedNodeId ? null : state.bookmarkedNodeId
        })
      },

      setNumberedBookmark: (num, nodeId) => {
        set((state) => {
          if (num >= 1 && num <= 9) {
            state.numberedBookmarks[num] = nodeId
          }
        })
      },

      clearNumberedBookmark: (num) => {
        set((state) => {
          if (num >= 1 && num <= 9) {
            state.numberedBookmarks[num] = null
          }
        })
      },

      getNumberedBookmarkNodeId: (num) => {
        const bookmarks = get().numberedBookmarks
        if (num >= 1 && num <= 9) {
          return bookmarks[num] || null
        }
        return null
      },

      jumpToNumberedBookmark: (num) => {
        const nodeId = get().getNumberedBookmarkNodeId(num)
        if (nodeId) {
          get().centerNode(nodeId)
        }
        return nodeId
      },

      // ---------------------------------------------------------------------
      // Saved views
      // ---------------------------------------------------------------------

      saveView: (name, selectedNodeIds) => {
        const id = uuid()
        const newView: SavedView = {
          id,
          name,
          viewport: { ...get().viewport },
          selectedNodeIds: [...selectedNodeIds],
          createdAt: Date.now()
        }

        set((state) => {
          state.savedViews.push(newView)
        })

        return id
      },

      restoreView: (viewId) => {
        const view = get().savedViews.find((v) => v.id === viewId)
        if (view) {
          set((state) => {
            state.viewport = { ...view.viewport }
          })
          // Selection would be restored via selection store
        }
      },

      deleteView: (viewId) => {
        set((state) => {
          state.savedViews = state.savedViews.filter((v) => v.id !== viewId)
        })
      },

      renameView: (viewId, newName) => {
        set((state) => {
          const view = state.savedViews.find((v) => v.id === viewId)
          if (view) {
            view.name = newName
          }
        })
      },

      // ---------------------------------------------------------------------
      // Canvas interaction
      // ---------------------------------------------------------------------

      recordCanvasClick: (position) => {
        set((state) => {
          state.lastCanvasClick = {
            x: position.x,
            y: position.y,
            time: Date.now()
          }
        })
      },

      getLastCanvasClick: () => {
        return get().lastCanvasClick
      }
    }))
  )
)

// =============================================================================
// Selector Hooks
// =============================================================================

export const useViewport = () => useCanvasViewportStore((state) => state.viewport)

export const useFocusModeNodeId = (): string | null =>
  useCanvasViewportStore((state) => state.focusModeNodeId)

export const useIsFocusModeActive = (): boolean =>
  useCanvasViewportStore((state) => state.focusModeNodeId !== null)

export const useBookmarkedNodeId = (): string | null =>
  useCanvasViewportStore((state) => state.bookmarkedNodeId)

export const useIsNodeBookmarked = (nodeId: string): boolean =>
  useCanvasViewportStore((state) => state.bookmarkedNodeId === nodeId)

export const useNumberedBookmarks = (): Record<number, string | null> =>
  useCanvasViewportStore((state) => state.numberedBookmarks)

export const useNodeNumberedBookmark = (nodeId: string): number | null =>
  useCanvasViewportStore((state) => {
    for (let i = 1; i <= 9; i++) {
      if (state.numberedBookmarks[i] === nodeId) return i
    }
    return null
  })

export const useSavedViews = () => useCanvasViewportStore((state) => state.savedViews)

export const useLastCanvasClick = () => useCanvasViewportStore((state) => state.lastCanvasClick)
