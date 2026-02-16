/**
 * Store Testing Utilities
 *
 * Helper functions for testing Zustand stores in Cognograph.
 */

import { useWorkspaceStore } from '../renderer/src/stores/workspaceStore'
import { useAIEditorStore } from '../renderer/src/stores/aiEditorStore'
import { invalidateContextCache } from '../renderer/src/utils/contextCache'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '../shared/types'

// -----------------------------------------------------------------------------
// Store Reset Utilities
// -----------------------------------------------------------------------------

/**
 * Reset workspaceStore to initial state.
 * Call in beforeEach to ensure test isolation.
 *
 * NOTE: Only resets the properties that matter for test isolation.
 * Uses partial setState to preserve store functions and default values.
 */
export function resetWorkspaceStore(): void {
  // Clear the context cache to avoid stale results across tests
  invalidateContextCache()
  
  // Don't use replace (second arg = true) as it removes functions
  useWorkspaceStore.setState({
    // Core data
    nodes: [],
    edges: [],
    workspaceId: null,
    workspaceName: 'Untitled',
    viewport: { x: 0, y: 0, zoom: 1 },

    // Selection
    selectedNodeIds: [],
    selectedEdgeIds: [],

    // History
    history: [],
    historyIndex: -1,

    // UI State
    activePanel: 'none',
    activeChatNodeId: null,
    openChatNodeIds: [],
    leftSidebarOpen: false,
    expandedNodeIds: new Set<string>(),
    floatingPropertiesNodeIds: [],

    // Transient state
    streamingConversations: new Set<string>(),
    recentlySpawnedNodes: new Set<string>(),
    nodeUpdatedAt: new Map<string, number>(),
    dragStartPositions: new Map<string, { x: number; y: number }>(),
    resizeStartDimensions: new Map<string, { width: number; height: number }>(),

    // Flags
    isDirty: false,
    isLoading: false,
    lastSaved: null,
    lastCreatedNodeId: null,
    lastCanvasClick: null,

    // Clipboard
    clipboardNodes: [],
    clipboardEdges: [],
    clipboardState: null,

    // Extraction
    pendingExtractions: [],
    extractionSourceFilter: null,
    isExtracting: null,

    // Pin mode
    pinnedWindows: [],
    nextPinnedZIndex: 1,

    // Sync
    syncMode: 'local' as const,
    _syncSource: 'local' as const
  })
}

/**
 * Reset aiEditorStore to initial state.
 * Call in beforeEach to ensure test isolation.
 *
 * NOTE: Uses partial setState to preserve store functions.
 */
export function resetAIEditorStore(): void {
  // Don't use replace (second arg = true) as it removes functions
  useAIEditorStore.setState({
    isOpen: false,
    mode: 'organize',
    scope: 'selection',
    prompt: '',
    targetNodeId: undefined,
    isGeneratingPlan: false,
    isExecutingPlan: false,
    currentPlan: null,
    previewState: null,
    isPreviewVisible: true,
    generationError: null,
    executionError: null,
    tempIdToRealId: new Map(),
    useAgentMode: false
  })
}

/**
 * Reset all stores to initial state.
 */
export function resetAllStores(): void {
  resetWorkspaceStore()
  resetAIEditorStore()
}

// -----------------------------------------------------------------------------
// Store Access Utilities
// -----------------------------------------------------------------------------

/**
 * Get current workspace store state (for assertions).
 */
export function getWorkspaceState() {
  return useWorkspaceStore.getState()
}

/**
 * Get current AI editor store state (for assertions).
 */
export function getAIEditorState() {
  return useAIEditorStore.getState()
}

// -----------------------------------------------------------------------------
// Store Action Helpers
// -----------------------------------------------------------------------------

/**
 * Add a node to the workspace store directly (bypassing addNode action).
 * Useful for setting up test fixtures.
 */
export function seedNode(node: Node<NodeData>): void {
  useWorkspaceStore.setState((state) => ({
    nodes: [...state.nodes, node]
  }))
}

/**
 * Add multiple nodes to the workspace store.
 */
export function seedNodes(nodes: Node<NodeData>[]): void {
  useWorkspaceStore.setState((state) => ({
    nodes: [...state.nodes, ...nodes]
  }))
}

/**
 * Add an edge to the workspace store directly.
 */
export function seedEdge(edge: Edge<EdgeData>): void {
  useWorkspaceStore.setState((state) => ({
    edges: [...state.edges, edge]
  }))
}

/**
 * Add multiple edges to the workspace store.
 */
export function seedEdges(edges: Edge<EdgeData>[]): void {
  useWorkspaceStore.setState((state) => ({
    edges: [...state.edges, ...edges]
  }))
}

/**
 * Seed a complete workspace fixture.
 */
export function seedWorkspace(fixture: {
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
}): void {
  useWorkspaceStore.setState({
    nodes: fixture.nodes,
    edges: fixture.edges
  })
}

// -----------------------------------------------------------------------------
// History Utilities
// -----------------------------------------------------------------------------

/**
 * Get current history state for assertions.
 */
export function getHistoryState() {
  const state = useWorkspaceStore.getState()
  return {
    history: state.history,
    historyIndex: state.historyIndex,
    canUndo: state.canUndo(),
    canRedo: state.canRedo()
  }
}

/**
 * Clear history without affecting nodes/edges.
 */
export function clearHistory(): void {
  useWorkspaceStore.setState({
    history: [],
    historyIndex: -1
  })
}
