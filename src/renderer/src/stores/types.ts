/**
 * Store Types
 *
 * Type definitions for the split store architecture.
 * These interfaces define the logical groupings of state.
 *
 * Created as part of Batch 0B: Split workspaceStore
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  NodeData,
  EdgeData,
  HistoryAction,
  PropertySchema,
  ContextSettings,
  PendingExtraction,
  ThemeSettings,
  WorkspacePreferences
} from '@shared/types'

// =============================================================================
// Shared Types (re-exported from workspaceStore for now)
// =============================================================================

/**
 * Represents a node that has been soft-deleted and moved to trash
 */
export interface TrashedItem {
  node: Node<NodeData>
  edges: Edge<EdgeData>[] // Edges that were connected to this node
  deletedAt: number // Timestamp
}

/**
 * Represents a node displayed in a floating pinned window
 */
export interface PinnedWindow {
  nodeId: string
  position: { x: number; y: number } // Screen coordinates
  size: { width: number; height: number }
  minimized: boolean
  zIndex: number
}

/**
 * State for an extraction being dragged on the canvas
 */
export interface ExtractionDragState {
  extractionId: string
  position: { x: number; y: number }
  type: 'note' | 'task'
  title: string
}

/**
 * State for the last accepted extraction (for undo support)
 */
export interface LastAcceptedExtraction {
  extractionData: PendingExtraction
  createdNodeId: string
  createdEdgeId: string
  timestamp: number
}

// =============================================================================
// Canvas State
// =============================================================================

/**
 * CanvasState contains everything related to the visual canvas:
 * - Nodes and edges (the graph data)
 * - Viewport (pan/zoom)
 * - Selection state
 * - Clipboard
 * - Drag/resize tracking
 */
export interface CanvasState {
  // Core graph data
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]

  // Viewport
  viewport: { x: number; y: number; zoom: number }

  // Selection
  selectedNodeIds: string[]
  selectedEdgeIds: string[]

  // Clipboard
  clipboardNodes: Node<NodeData>[]
  clipboardEdges: Edge<EdgeData>[]
  clipboardState: { mode: 'cut' | 'copy'; nodeIds: string[] } | null

  // Interaction tracking
  lastCanvasClick: { x: number; y: number; time: number } | null
  lastCreatedNodeId: string | null
  dragStartPositions: Map<string, { x: number; y: number }>
  resizeStartDimensions: Map<string, { width: number; height: number }>

  // Visual feedback
  streamingConversations: Set<string>
  recentlySpawnedNodes: Set<string>
  spawningNodeIds: string[]
  nodeUpdatedAt: Map<string, number>
}

// =============================================================================
// UI State
// =============================================================================

/**
 * UIState contains everything related to UI chrome and layout:
 * - Panel visibility (properties, chat)
 * - Sidebar state
 * - Theme settings
 * - Floating windows
 * - Bookmarks
 */
export interface UIState {
  // Panels
  activePanel: 'none' | 'properties' | 'chat'
  activeChatNodeId: string | null
  openChatNodeIds: string[]

  // Left sidebar
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  leftSidebarTab: 'layers' | 'extractions' | 'activity' | 'dispatch' | 'bridge-log'
  expandedNodeIds: Set<string>
  layersSortMode: 'hierarchy' | 'type' | 'recent' | 'manual'
  manualLayerOrder: string[] | null
  layersFilter: string
  hiddenNodeTypes: Set<NodeData['type']>

  // Focus and bookmarks
  showMembersProjectId: string | null
  focusModeNodeId: string | null
  bookmarkedNodeId: string | null
  numberedBookmarks: Record<number, string | null>

  // Floating modals and pinned windows
  floatingPropertiesNodeIds: string[]
  pinnedWindows: PinnedWindow[]
  nextPinnedZIndex: number

  // Theme and preferences
  themeSettings: ThemeSettings
  workspacePreferences: WorkspacePreferences
}

// =============================================================================
// Features State
// =============================================================================

/**
 * FeaturesState contains everything related to features and persistence:
 * - Workspace identity and settings
 * - History (undo/redo)
 * - Extractions
 * - Sync/multiplayer
 * - Save status
 * - Trash
 */
export interface FeaturesState {
  // Workspace identity
  workspaceId: string | null
  workspaceName: string
  propertySchema: PropertySchema
  contextSettings: ContextSettings

  // History (undo/redo)
  history: HistoryAction[]
  historyIndex: number

  // Extractions
  pendingExtractions: PendingExtraction[]
  extractionSourceFilter: string | null
  isExtracting: string | null
  openExtractionPanelNodeId: string | null
  extractionDrag: ExtractionDragState | null
  lastAcceptedExtraction: LastAcceptedExtraction | null

  // Multiplayer
  syncMode: 'local' | 'multiplayer'
  multiplayerConfig: {
    serverUrl: string
    workspaceId: string
    token: string
    userName: string
    userColor: string
  } | null
  _syncSource: 'local' | 'yjs'

  // Status
  isDirty: boolean
  isLoading: boolean
  lastSaved: number | null
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'

  // Trash
  trash: TrashedItem[]
}

// =============================================================================
// Combined State (for compatibility during migration)
// =============================================================================

/**
 * Full workspace state combining all slices.
 * This is used during the migration period while workspaceStore
 * is being split into separate stores.
 */
export type WorkspaceStateShape = CanvasState & UIState & FeaturesState
