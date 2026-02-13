/**
 * Saved Views Store
 *
 * ND-friendly feature: Save and recall viewport/filter configurations.
 * "Switch to my task view" → consistent context switching.
 *
 * A view captures:
 * - Viewport position and zoom
 * - Hidden node types (filter state)
 * - Focus mode node (if any)
 * - Optional: selected nodes
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type { NodeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SavedView {
  id: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number

  // Viewport state
  viewport: {
    x: number
    y: number
    zoom: number
  }

  // Filter state
  hiddenNodeTypes: NodeData['type'][]

  // Focus state
  focusModeNodeId: string | null

  // Optional selection
  selectedNodeIds?: string[]

  // Keyboard shortcut (1-9, optional)
  shortcutKey?: number
}

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface SavedViewsState {
  views: SavedView[]
  activeViewId: string | null
}

interface SavedViewsActions {
  // CRUD
  saveCurrentView: (
    name: string,
    viewport: { x: number; y: number; zoom: number },
    hiddenNodeTypes: Set<NodeData['type']>,
    focusModeNodeId: string | null,
    selectedNodeIds?: string[]
  ) => string

  updateView: (id: string, updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>) => void
  deleteView: (id: string) => void

  // Navigation
  setActiveView: (id: string | null) => void

  // Shortcuts
  assignShortcut: (viewId: string, key: number | undefined) => void
  getViewByShortcut: (key: number) => SavedView | undefined

  // Persistence
  loadViews: (views: SavedView[]) => void
  getViewsForSave: () => SavedView[]
}

type SavedViewsStore = SavedViewsState & SavedViewsActions

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useSavedViewsStore = create<SavedViewsStore>()(
  immer((set, get) => ({
    views: [],
    activeViewId: null,

    saveCurrentView: (name, viewport, hiddenNodeTypes, focusModeNodeId, selectedNodeIds) => {
      const id = uuid()
      const now = Date.now()

      const view: SavedView = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        viewport,
        hiddenNodeTypes: Array.from(hiddenNodeTypes),
        focusModeNodeId,
        selectedNodeIds
      }

      set((state) => {
        state.views.push(view)
      })

      return id
    },

    updateView: (id, updates) => {
      set((state) => {
        const view = state.views.find(v => v.id === id)
        if (view) {
          Object.assign(view, updates, { updatedAt: Date.now() })
        }
      })
    },

    deleteView: (id) => {
      set((state) => {
        state.views = state.views.filter(v => v.id !== id)
        if (state.activeViewId === id) {
          state.activeViewId = null
        }
      })
    },

    setActiveView: (id) => {
      set((state) => {
        state.activeViewId = id
      })
    },

    assignShortcut: (viewId, key) => {
      set((state) => {
        // Clear existing shortcut with this key
        if (key !== undefined) {
          state.views.forEach(v => {
            if (v.shortcutKey === key) {
              v.shortcutKey = undefined
            }
          })
        }

        // Assign new shortcut
        const view = state.views.find(v => v.id === viewId)
        if (view) {
          view.shortcutKey = key
          view.updatedAt = Date.now()
        }
      })
    },

    getViewByShortcut: (key) => {
      return get().views.find(v => v.shortcutKey === key)
    },

    loadViews: (views) => {
      set((state) => {
        state.views = views
      })
    },

    getViewsForSave: () => {
      return get().views
    }
  }))
)
