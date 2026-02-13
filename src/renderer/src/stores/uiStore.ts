/**
 * UI Store
 *
 * Manages UI chrome state: panels, sidebar, theme, bookmarks, floating windows.
 * This store is being extracted from workspaceStore as part of the store split.
 *
 * Created as part of Batch 0B: Split workspaceStore
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { enableMapSet } from 'immer'
import type { NodeData, ThemeSettings, WorkspacePreferences } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import type { UIState, PinnedWindow } from './types'

// Enable Immer support for Map and Set
enableMapSet()

// =============================================================================
// Action Types
// =============================================================================

interface UIActions {
  // Panels
  setActivePanel: (panel: 'none' | 'properties' | 'chat') => void
  setActiveChatNodeId: (nodeId: string | null) => void
  openChatNode: (nodeId: string) => void
  closeChatNode: (nodeId: string) => void

  // Left Sidebar
  toggleLeftSidebar: () => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarTab: (tab: 'layers' | 'extractions' | 'activity' | 'dispatch' | 'bridge-log') => void
  toggleNodeExpanded: (nodeId: string) => void
  setLayersSortMode: (mode: 'hierarchy' | 'type' | 'recent' | 'manual') => void
  setManualLayerOrder: (order: string[] | null) => void
  setLayersFilter: (filter: string) => void
  toggleHiddenNodeType: (type: NodeData['type']) => void

  // Focus and Bookmarks
  setShowMembersProjectId: (projectId: string | null) => void
  setFocusModeNodeId: (nodeId: string | null) => void
  setBookmarkedNodeId: (nodeId: string | null) => void
  setNumberedBookmark: (number: number, nodeId: string | null) => void
  jumpToNumberedBookmark: (number: number) => string | null

  // Floating Properties
  openFloatingProperties: (nodeId: string) => void
  closeFloatingProperties: (nodeId: string) => void

  // Pinned Windows
  pinWindow: (nodeId: string, position: { x: number; y: number }, size: { width: number; height: number }) => void
  unpinWindow: (nodeId: string) => void
  updatePinnedWindowPosition: (nodeId: string, position: { x: number; y: number }) => void
  updatePinnedWindowSize: (nodeId: string, size: { width: number; height: number }) => void
  minimizePinnedWindow: (nodeId: string) => void
  restorePinnedWindow: (nodeId: string) => void
  bringPinnedWindowToFront: (nodeId: string) => void

  // Theme
  setThemeSettings: (settings: Partial<ThemeSettings>) => void
  setWorkspacePreferences: (preferences: Partial<WorkspacePreferences>) => void
}

// =============================================================================
// Store Type
// =============================================================================

type UIStore = UIState & UIActions

// =============================================================================
// Initial State
// =============================================================================

const initialUIState: UIState = {
  // Panels
  activePanel: 'none',
  activeChatNodeId: null,
  openChatNodeIds: [],

  // Left sidebar
  leftSidebarOpen: true,
  leftSidebarWidth: 280,
  leftSidebarTab: 'layers',
  expandedNodeIds: new Set(),
  layersSortMode: 'hierarchy',
  manualLayerOrder: null,
  layersFilter: '',
  hiddenNodeTypes: new Set(),

  // Focus and bookmarks
  showMembersProjectId: null,
  focusModeNodeId: null,
  bookmarkedNodeId: null,
  numberedBookmarks: {},

  // Floating modals and pinned windows
  floatingPropertiesNodeIds: [],
  pinnedWindows: [],
  nextPinnedZIndex: 1000,

  // Theme and preferences (initialized from DEFAULT_THEME_SETTINGS)
  themeSettings: DEFAULT_THEME_SETTINGS,
  workspacePreferences: {
    propertiesDisplayMode: 'popup',
    chatDisplayMode: 'panel',
    showNodePreviews: true,
    autoSaveInterval: 30000
  }
}

// =============================================================================
// Store Creation
// =============================================================================

/**
 * UI store - manages panels, sidebar, theme, bookmarks, floating windows.
 *
 * NOTE: During migration, some actions delegate to workspaceStore.
 * Once migration is complete, the full implementations will live here.
 */
export const useUIStore = create<UIStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialUIState,

      // -------------------------------------------------------------------------
      // Panels (can implement directly)
      // -------------------------------------------------------------------------

      setActivePanel: (panel) => {
        set((state) => {
          state.activePanel = panel
        })
      },

      setActiveChatNodeId: (nodeId) => {
        set((state) => {
          state.activeChatNodeId = nodeId
        })
      },

      openChatNode: (nodeId) => {
        set((state) => {
          if (!state.openChatNodeIds.includes(nodeId)) {
            state.openChatNodeIds.push(nodeId)
          }
          state.activeChatNodeId = nodeId
        })
      },

      closeChatNode: (nodeId) => {
        set((state) => {
          state.openChatNodeIds = state.openChatNodeIds.filter((id) => id !== nodeId)
          if (state.activeChatNodeId === nodeId) {
            state.activeChatNodeId = state.openChatNodeIds[0] ?? null
          }
        })
      },

      // -------------------------------------------------------------------------
      // Left Sidebar (can implement directly)
      // -------------------------------------------------------------------------

      toggleLeftSidebar: () => {
        set((state) => {
          state.leftSidebarOpen = !state.leftSidebarOpen
        })
      },

      setLeftSidebarWidth: (width) => {
        set((state) => {
          state.leftSidebarWidth = Math.max(200, Math.min(600, width))
        })
      },

      setLeftSidebarTab: (tab) => {
        set((state) => {
          state.leftSidebarTab = tab
        })
      },

      toggleNodeExpanded: (nodeId) => {
        set((state) => {
          if (state.expandedNodeIds.has(nodeId)) {
            state.expandedNodeIds.delete(nodeId)
          } else {
            state.expandedNodeIds.add(nodeId)
          }
        })
      },

      setLayersSortMode: (mode) => {
        set((state) => {
          state.layersSortMode = mode
        })
      },

      setManualLayerOrder: (order) => {
        set((state) => {
          state.manualLayerOrder = order
        })
      },

      setLayersFilter: (filter) => {
        set((state) => {
          state.layersFilter = filter
        })
      },

      toggleHiddenNodeType: (type) => {
        set((state) => {
          if (state.hiddenNodeTypes.has(type)) {
            state.hiddenNodeTypes.delete(type)
          } else {
            state.hiddenNodeTypes.add(type)
          }
        })
      },

      // -------------------------------------------------------------------------
      // Focus and Bookmarks (can implement directly)
      // -------------------------------------------------------------------------

      setShowMembersProjectId: (projectId) => {
        set((state) => {
          state.showMembersProjectId = projectId
        })
      },

      setFocusModeNodeId: (nodeId) => {
        set((state) => {
          state.focusModeNodeId = nodeId
        })
      },

      setBookmarkedNodeId: (nodeId) => {
        set((state) => {
          state.bookmarkedNodeId = nodeId
        })
      },

      setNumberedBookmark: (number, nodeId) => {
        set((state) => {
          state.numberedBookmarks[number] = nodeId
        })
      },

      jumpToNumberedBookmark: (number) => {
        return get().numberedBookmarks[number] ?? null
      },

      // -------------------------------------------------------------------------
      // Floating Properties (can implement directly)
      // -------------------------------------------------------------------------

      openFloatingProperties: (nodeId) => {
        set((state) => {
          if (!state.floatingPropertiesNodeIds.includes(nodeId)) {
            state.floatingPropertiesNodeIds.push(nodeId)
          }
        })
      },

      closeFloatingProperties: (nodeId) => {
        set((state) => {
          state.floatingPropertiesNodeIds = state.floatingPropertiesNodeIds.filter(
            (id) => id !== nodeId
          )
        })
      },

      // -------------------------------------------------------------------------
      // Pinned Windows (can implement directly)
      // -------------------------------------------------------------------------

      pinWindow: (nodeId, position, size) => {
        set((state) => {
          // Don't pin if already pinned
          if (state.pinnedWindows.some((w) => w.nodeId === nodeId)) return

          const newWindow: PinnedWindow = {
            nodeId,
            position,
            size,
            minimized: false,
            zIndex: state.nextPinnedZIndex
          }
          state.pinnedWindows.push(newWindow)
          state.nextPinnedZIndex++
        })
      },

      unpinWindow: (nodeId) => {
        set((state) => {
          state.pinnedWindows = state.pinnedWindows.filter((w) => w.nodeId !== nodeId)
        })
      },

      updatePinnedWindowPosition: (nodeId, position) => {
        set((state) => {
          const window = state.pinnedWindows.find((w) => w.nodeId === nodeId)
          if (window) {
            window.position = position
          }
        })
      },

      updatePinnedWindowSize: (nodeId, size) => {
        set((state) => {
          const window = state.pinnedWindows.find((w) => w.nodeId === nodeId)
          if (window) {
            window.size = size
          }
        })
      },

      minimizePinnedWindow: (nodeId) => {
        set((state) => {
          const window = state.pinnedWindows.find((w) => w.nodeId === nodeId)
          if (window) {
            window.minimized = true
          }
        })
      },

      restorePinnedWindow: (nodeId) => {
        set((state) => {
          const window = state.pinnedWindows.find((w) => w.nodeId === nodeId)
          if (window) {
            window.minimized = false
          }
        })
      },

      bringPinnedWindowToFront: (nodeId) => {
        set((state) => {
          const window = state.pinnedWindows.find((w) => w.nodeId === nodeId)
          if (window) {
            window.zIndex = state.nextPinnedZIndex
            state.nextPinnedZIndex++
          }
        })
      },

      // -------------------------------------------------------------------------
      // Theme (can implement directly)
      // -------------------------------------------------------------------------

      setThemeSettings: (settings) => {
        set((state) => {
          state.themeSettings = { ...state.themeSettings, ...settings }
        })
      },

      setWorkspacePreferences: (preferences) => {
        set((state) => {
          state.workspacePreferences = { ...state.workspacePreferences, ...preferences }
        })
      }
    }))
  )
)

// =============================================================================
// Selectors
// =============================================================================

/**
 * Get active panel
 */
export const selectActivePanel = (state: UIStore) => state.activePanel

/**
 * Get active chat node ID
 */
export const selectActiveChatNodeId = (state: UIStore) => state.activeChatNodeId

/**
 * Get left sidebar open state
 */
export const selectLeftSidebarOpen = (state: UIStore) => state.leftSidebarOpen

/**
 * Get left sidebar tab
 */
export const selectLeftSidebarTab = (state: UIStore) => state.leftSidebarTab

/**
 * Check if a node is expanded in layers panel
 */
export const selectIsNodeExpanded = (nodeId: string) => (state: UIStore) =>
  state.expandedNodeIds.has(nodeId)

/**
 * Get theme settings
 */
export const selectThemeSettings = (state: UIStore) => state.themeSettings

/**
 * Get pinned windows
 */
export const selectPinnedWindows = (state: UIStore) => state.pinnedWindows

/**
 * Check if a node is pinned
 */
export const selectIsNodePinned = (nodeId: string) => (state: UIStore) =>
  state.pinnedWindows.some((w) => w.nodeId === nodeId)
