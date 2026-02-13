import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { enableMapSet } from 'immer'

// Enable Immer support for Map and Set (needed for streamingConversations and recentlySpawnedNodes)
enableMapSet()
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { v4 as uuid } from 'uuid'
import type {
  NodeData,
  WorkspaceData,
  HistoryAction,
  ConversationNodeData,
  ProjectNodeData,
  NoteNodeData,
  TaskNodeData,
  TextNodeData,
  ArtifactNodeData,
  WorkspaceNodeData,
  ActionNodeData,
  WorkspaceLLMSettings,
  WorkspaceContextRules,
  ArtifactContentType,
  ArtifactSource,
  ArtifactVersion,
  PropertySchema,
  PropertyDefinition,
  PropertyOption,
  EdgeData,
  EdgeWaypoint,
  ContextSettings,
  PendingExtraction,
  ExtractionSettings,
  ThemeSettings,
  WorkspacePreferences,
  PropertiesDisplayMode,
  ChatDisplayMode,
  ContextMetadata,
  Message
} from '@shared/types'
import { createActionData } from '@shared/actionTypes'
import { DEFAULT_EDGE_DATA, DEFAULT_CONTEXT_SETTINGS, DEFAULT_EXTRACTION_SETTINGS, DEFAULT_THEME_SETTINGS, DEFAULT_WORKSPACE_PREFERENCES, DEFAULT_WORKSPACE_LLM_SETTINGS, DEFAULT_WORKSPACE_CONTEXT_RULES, migrateEdgeStrength } from '@shared/types'
import { DEFAULT_GUI_DARK, DEFAULT_GUI_LIGHT } from '../constants/themePresets'
import {
  DEFAULT_PROPERTY_SCHEMA,
  BUILTIN_PROPERTIES,
  getPropertiesForNodeType
} from '../constants/properties'
import { getPresetColors } from '../constants/themePresets'
import { useSpatialRegionStore } from './spatialRegionStore'
import { computeGraphHash, getCachedContext, invalidateContextCache } from '../utils/contextCache'

// Import store types from dedicated types file
import type {
  TrashedItem,
  PinnedWindow,
  ExtractionDragState,
  LastAcceptedExtraction,
  CanvasState,
  UIState,
  FeaturesState,
  WorkspaceStateShape
} from './types'

// Import node factories
import {
  createConversationData,
  createProjectData,
  createNoteData,
  createTaskData,
  createArtifactData,
  createWorkspaceData,
  createTextData,
  createOrchestratorData,
  DEFAULT_NODE_DIMENSIONS
} from './nodeFactories'

// Re-export for backwards compatibility
export type { TrashedItem, PinnedWindow }

// -----------------------------------------------------------------------------
// Store Interface
// -----------------------------------------------------------------------------

interface WorkspaceState {
  // Workspace data
  workspaceId: string | null
  workspaceName: string
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
  viewport: { x: number; y: number; zoom: number }
  propertySchema: PropertySchema
  contextSettings: ContextSettings
  themeSettings: ThemeSettings
  workspacePreferences: WorkspacePreferences

  // UI state
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  activePanel: 'none' | 'properties' | 'chat'
  activeChatNodeId: string | null // Primary/focused chat
  openChatNodeIds: string[] // All open chats (for multiple panels)

  // Left sidebar state
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  leftSidebarTab: 'layers' | 'extractions'
  expandedNodeIds: Set<string> // Expanded nodes in layers panel
  layersSortMode: 'hierarchy' | 'type' | 'recent' | 'manual'
  manualLayerOrder: string[] | null
  layersFilter: string
  hiddenNodeTypes: Set<NodeData['type']> // Node types to hide from canvas
  showMembersProjectId: string | null // When set, dims non-members of this project on canvas
  focusModeNodeId: string | null // When set, dims all nodes except this one (Focus Mode)
  bookmarkedNodeId: string | null // Visual bookmark - "current focus" node with jump-to hotkey
  numberedBookmarks: Record<number, string | null> // 1-9 numbered bookmarks for instant spatial anchors

  // Extraction state
  pendingExtractions: PendingExtraction[]
  extractionSourceFilter: string | null // Filter extractions by source node
  isExtracting: string | null // nodeId currently being extracted, null if not

  // Spatial extraction state
  openExtractionPanelNodeId: string | null // Which node's extraction panel is open
  extractionDrag: {
    extractionId: string
    position: { x: number; y: number }
    type: 'note' | 'task'
    title: string
  } | null
  lastAcceptedExtraction: {
    extractionData: PendingExtraction
    createdNodeId: string
    createdEdgeId: string
    timestamp: number
  } | null

  // Visual feedback state
  streamingConversations: Set<string> // Set of nodeIds currently streaming
  recentlySpawnedNodes: Set<string> // Set of nodeIds that were just created (for spawn animation)
  spawningNodeIds: string[] // Array of nodeIds currently spawning (for extraction animations)
  nodeUpdatedAt: Map<string, number> // Tracks last content-edit time per node (for warmth indicator)

  // Floating properties modals (supports multiple pinned modals)
  floatingPropertiesNodeIds: string[] // Node IDs for floating properties modals

  // Pinned windows (nodes popped out as floating windows)
  pinnedWindows: PinnedWindow[]
  nextPinnedZIndex: number

  // History (undo/redo)
  history: HistoryAction[]
  historyIndex: number
  dragStartPositions: Map<string, { x: number; y: number }>
  resizeStartDimensions: Map<string, { width: number; height: number }>

  // Multiplayer
  syncMode: 'local' | 'multiplayer'
  multiplayerConfig: { serverUrl: string; workspaceId: string; token: string; userName: string; userColor: string } | null
  _syncSource: 'local' | 'yjs' // Prevents infinite sync loops

  // Status
  isDirty: boolean
  isLoading: boolean
  createdAt: number | null
  lastSaved: number | null
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'

  // Canvas interaction tracking
  lastCanvasClick: { x: number; y: number; time: number } | null
  lastCreatedNodeId: string | null

  // Clipboard
  clipboardNodes: Node<NodeData>[]
  clipboardEdges: Edge<EdgeData>[]
  clipboardState: { mode: 'cut' | 'copy'; nodeIds: string[] } | null

  // Trash (soft delete)
  trash: TrashedItem[]

  // Actions - Nodes
  addNode: (type: NodeData['type'], position: { x: number; y: number }) => string
  addAgentNode: (position: { x: number; y: number }) => string
  updateNode: (nodeId: string, data: Partial<NodeData>) => void
  updateBulkNodes: (nodeIds: string[], data: Partial<NodeData>) => void
  changeNodeType: (nodeId: string, newType: NodeData['type']) => void
  deleteNodes: (nodeIds: string[]) => void
  moveNode: (nodeId: string, position: { x: number; y: number }) => void
  resizeNode: (nodeId: string, dimensions: { width?: number; height?: number }) => void
  updateNodeDimensions: (nodeId: string, width: number, height: number) => void

  // Actions - Alignment & Distribution
  alignNodes: (nodeIds: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeNodes: (nodeIds: string[], direction: 'horizontal' | 'vertical') => void
  snapToGrid: (nodeIds: string[], gridSize?: number) => void
  arrangeInGrid: (nodeIds: string[], columns?: number) => void
  sortByType: (nodeIds: string[]) => void
  applyAutoLayout: (
    layoutType: 'hierarchical-down' | 'hierarchical-right' | 'hierarchical-up' | 'hierarchical-left' | 'force' | 'circular',
    nodeIds?: string[],
    spacing?: 'narrow' | 'default' | 'wide'
  ) => void

  // Actions - Clipboard
  copyNodes: (nodeIds: string[]) => void
  cutNodes: (nodeIds: string[]) => void
  pasteNodes: (position: { x: number; y: number }) => void
  clearClipboard: () => void

  // Actions - Archive
  archiveNodes: (nodeIds: string[]) => void
  restoreFromArchive: (nodeIds: string[]) => void
  getArchivedNodes: () => Node<NodeData>[]

  // Actions - Trash
  softDeleteNodes: (nodeIds: string[]) => void
  restoreFromTrash: (trashedItemIndex: number) => void
  permanentlyDelete: (trashedItemIndex: number) => void
  emptyTrash: () => void

  // Actions - Edges
  addEdge: (connection: Connection) => void
  updateEdge: (edgeId: string, data: Partial<EdgeData>, options?: { skipHistory?: boolean }) => void
  commitEdgeWaypointDrag: (edgeId: string, beforeWaypoints: EdgeWaypoint[] | undefined, afterWaypoints: EdgeWaypoint[] | undefined) => void
  deleteEdges: (edgeIds: string[]) => void
  reverseEdge: (edgeId: string) => void
  reconnectEdge: (oldEdge: Edge<EdgeData>, newConnection: Connection) => void
  linkSelectedNodes: (nodeIds: string[]) => void // Link nodes in a chain
  linkAllNodes: (nodeIds: string[]) => void // Link all pairs (N*(N-1)/2 edges)
  unlinkSelectedNodes: (nodeIds: string[]) => void // Remove edges between selected nodes

  // Actions - Outgoing Edge Colors
  setOutgoingEdgeColor: (nodeId: string, color: string | undefined) => void
  updateAllOutgoingEdges: (nodeId: string, color: string) => void
  resetOutgoingEdges: (nodeId: string) => void

  // Actions - React Flow callbacks
  onNodesChange: (changes: NodeChange<Node<NodeData>>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  // Actions - Selection
  setSelectedNodes: (nodeIds: string[]) => void
  setSelectedEdges: (edgeIds: string[]) => void
  clearSelection: () => void
  clearLastCreatedNodeId: () => void

  // Actions - Panels
  openChat: (nodeId: string) => void
  closeChat: (nodeId?: string) => void // Close specific chat or focused one
  openProperties: () => void
  closeProperties: () => void
  focusChat: (nodeId: string) => void // Focus a specific chat panel
  openFloatingProperties: (nodeId: string) => void
  closeFloatingProperties: (nodeId?: string) => void // Close specific or all floating modals

  // Actions - Pin Mode
  pinNode: (nodeId: string) => void
  unpinNode: (nodeId: string) => void
  updatePinnedWindow: (nodeId: string, updates: Partial<Omit<PinnedWindow, 'nodeId'>>) => void
  bringPinnedToFront: (nodeId: string) => void

  // Actions - Left Sidebar
  toggleLeftSidebar: () => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarTab: (tab: 'layers' | 'extractions') => void
  toggleNodeExpanded: (nodeId: string) => void
  setLayersSortMode: (mode: 'hierarchy' | 'type' | 'recent' | 'manual') => void
  setLayersFilter: (filter: string) => void
  toggleNodeTypeVisibility: (nodeType: NodeData['type']) => void
  setHiddenNodeTypes: (types: Set<NodeData['type']>) => void
  showAllNodeTypes: () => void
  hideAllNodeTypes: () => void
  setShowMembersProject: (projectId: string | null) => void
  setFocusModeNode: (nodeId: string | null) => void
  toggleFocusMode: () => void
  toggleNodeCollapsed: (nodeId: string) => void
  getChildNodeIds: (nodeId: string) => string[]
  setBookmarkedNode: (nodeId: string | null) => void
  toggleBookmark: () => void
  setNumberedBookmark: (num: number, nodeId: string | null) => void
  clearNumberedBookmark: (num: number) => void
  getNumberedBookmarkNodeId: (num: number) => string | null
  reorderLayers: (nodeIds: string[], targetIndex: number) => void
  moveNodesForward: (nodeIds: string[]) => void // Bring selected nodes forward (higher z-index)
  moveNodesBackward: (nodeIds: string[]) => void // Send selected nodes backward (lower z-index)

  // Actions - Extractions
  addPendingExtraction: (extraction: Omit<PendingExtraction, 'id' | 'status' | 'createdAt'>) => void
  acceptExtraction: (extractionId: string, position?: { x: number; y: number }) => void
  editExtraction: (extractionId: string, data: Partial<PendingExtraction['suggestedData']>) => void
  dismissExtraction: (extractionId: string) => void
  clearAllExtractions: (sourceNodeId?: string) => void
  setExtractionSourceFilter: (nodeId: string | null) => void
  setIsExtracting: (nodeId: string | null) => void
  updateExtractionSettings: (nodeId: string, settings: Partial<ExtractionSettings>) => void
  addExtractedTitle: (nodeId: string, title: string) => void

  // Actions - Spatial Extraction System
  openExtractionPanel: (nodeId: string) => void
  closeExtractionPanel: () => void
  startExtractionDrag: (extractionId: string, position: { x: number; y: number }) => void
  updateExtractionDragPosition: (position: { x: number; y: number }) => void
  dropExtraction: (flowPosition: { x: number; y: number }) => void
  cancelExtractionDrag: () => void
  acceptAllExtractions: (sourceNodeId: string) => void
  undoLastExtraction: () => void
  clearUndoExtraction: () => void

  // Actions - Visual Feedback
  setStreaming: (nodeId: string, isStreaming: boolean) => void

  // Actions - Messages
  addMessage: (nodeId: string, role: 'user' | 'assistant', content: string) => void
  updateLastMessage: (nodeId: string, content: string) => void
  setLastMessageUsage: (nodeId: string, usage: { inputTokens: number; outputTokens: number; costUSD?: number }) => void
  removeLastMessage: (nodeId: string) => void
  deleteMessage: (nodeId: string, messageIndex: number) => void
  addToolMessage: (nodeId: string, message: Message) => void

  // Actions - Workspace
  newWorkspace: () => void
  loadWorkspace: (data: WorkspaceData) => void
  getWorkspaceData: () => WorkspaceData
  updateWorkspaceName: (name: string) => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  markDirty: () => void
  markClean: () => void
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void
  setSyncMode: (mode: 'local' | 'multiplayer') => void
  setMultiplayerConfig: (config: { serverUrl: string; workspaceId: string; token: string; userName: string; userColor: string } | null) => void

  // Actions - History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  startNodeDrag: (nodeIds: string[]) => void
  commitNodeDrag: (nodeIds: string[]) => void
  startNodeResize: (nodeId: string) => void
  commitNodeResize: (nodeId: string) => void

  // Actions - Context
  getConnectedNodes: (nodeId: string) => Node<NodeData>[]
  getContextForNode: (nodeId: string) => string

  // Actions - Theme
  setThemeMode: (mode: 'dark' | 'light') => void
  setThemeColor: (nodeType: NodeData['type'], color: string) => void
  setCanvasBackground: (color: string) => void
  setCanvasGridColor: (color: string) => void
  resetThemeColors: () => void
  applyThemePreset: (presetId: string) => void
  addCustomColor: (color: string) => void
  removeCustomColor: (color: string) => void
  saveCustomPreset: (name: string) => string | null // Returns preset ID or null if at limit
  deleteCustomPreset: (presetId: string) => void
  applyCustomPreset: (presetId: string) => void
  setAIPaletteEnabled: (enabled: boolean) => void
  setEdgeStyle: (style: import('@shared/types').EdgeStyle) => void
  setGuiColors: (colors: import('@shared/types').GuiColors) => void
  setLinkColors: (colors: { default: string; active: string; inactive: string; selected: string }) => void
  setLinkGradientEnabled: (enabled: boolean) => void
  updateThemeSettings: (settings: Partial<import('@shared/types').ThemeSettings>) => void

  // Actions - Workspace Preferences
  setArtifactPropertiesDisplay: (mode: PropertiesDisplayMode) => void
  setPropertiesDisplayMode: (mode: PropertiesDisplayMode) => void
  setChatDisplayMode: (mode: ChatDisplayMode) => void
  setPropertiesSidebarWidth: (width: number) => void
  setShowTokenEstimates: (show: boolean) => void
  setPreferVerticalToolbar: (prefer: boolean) => void

  // Actions - Node Activation
  evaluateNodeActivation: (nodeId: string) => void
  evaluateAllNodeActivations: () => void

  // Actions - Project Grouping
  addNodeToProject: (nodeId: string, projectId: string) => void
  removeNodeFromProject: (nodeId: string) => void
  getNodeParentId: (nodeId: string) => string | null

  // Actions - Property Schema
  addCustomProperty: (definition: Omit<PropertyDefinition, 'id'>) => string
  updateCustomProperty: (propertyId: string, updates: Partial<PropertyDefinition>) => void
  deleteCustomProperty: (propertyId: string) => void
  addPropertyOption: (propertyId: string, option: Omit<PropertyOption, 'value'>) => string
  updatePropertyOption: (
    propertyId: string,
    value: string,
    updates: Partial<PropertyOption>
  ) => void
  deletePropertyOption: (propertyId: string, value: string) => void
  addPropertyToNodeType: (nodeType: NodeData['type'], propertyId: string) => void
  removePropertyFromNodeType: (nodeType: NodeData['type'], propertyId: string) => void
  updatePropertyDefaults: (nodeType: string, defaults: Record<string, unknown>) => void
  getPropertiesForNode: (nodeId: string) => PropertyDefinition[]
  getPropertyDefinition: (propertyId: string) => PropertyDefinition | undefined

  // Actions - Node Properties
  setNodeProperty: (nodeId: string, propertyId: string, value: unknown) => void
  getNodeProperty: (nodeId: string, propertyId: string) => unknown

  // Actions - Canvas Interaction
  recordCanvasClick: (position: { x: number; y: number }) => void

  // Actions - Artifacts
  createArtifactFromFile: (
    file: { name: string; content: string; isBase64?: boolean },
    position: { x: number; y: number }
  ) => string
  spawnArtifactFromLLM: (
    conversationNodeId: string,
    messageId: string,
    artifact: {
      type: ArtifactContentType
      language?: string
      title?: string
      content: string
    }
  ) => string
  updateArtifactContent: (artifactId: string, content: string, source: 'user-edit' | 'llm-update') => void

  // Actions - Workspace Nodes
  addNodesToWorkspace: (workspaceNodeId: string, nodeIds: string[]) => void
  removeNodesFromWorkspace: (workspaceNodeId: string, nodeIds: string[]) => void
  excludeNodesFromWorkspace: (workspaceNodeId: string, nodeIds: string[]) => void
  includeNodesInWorkspace: (workspaceNodeId: string, nodeIds: string[]) => void
  toggleWorkspaceVisibility: (workspaceNodeId: string) => void
  toggleWorkspaceLinks: (workspaceNodeId: string) => void
  getWorkspaceNodesForNode: (nodeId: string) => Node<WorkspaceNodeData>[]
  getEffectiveLLMSettings: (nodeId: string) => WorkspaceLLMSettings | null
  getEffectiveContextRules: (nodeId: string) => WorkspaceContextRules | null
  updateWorkspaceLLMSettings: (workspaceNodeId: string, settings: Partial<WorkspaceLLMSettings>) => void
  updateWorkspaceContextRules: (workspaceNodeId: string, rules: Partial<WorkspaceContextRules>) => void
}

// -----------------------------------------------------------------------------
// Default Node Data Factories
// -----------------------------------------------------------------------------
// NOTE: Node factories moved to nodeFactories.ts - imported above

// -----------------------------------------------------------------------------
// Artifact Helper Functions
// -----------------------------------------------------------------------------

/**
 * Map file extension to artifact content type
 */
const getContentTypeFromExtension = (ext: string): ArtifactContentType => {
  const typeMap: Record<string, ArtifactContentType> = {
    // Code files
    ts: 'code',
    tsx: 'code',
    js: 'code',
    jsx: 'code',
    py: 'code',
    rs: 'code',
    go: 'code',
    java: 'code',
    c: 'code',
    cpp: 'code',
    h: 'code',
    hpp: 'code',
    cs: 'code',
    rb: 'code',
    php: 'code',
    swift: 'code',
    kt: 'code',
    scala: 'code',
    vue: 'code',
    svelte: 'code',
    // Markup / Data
    md: 'markdown',
    markdown: 'markdown',
    html: 'html',
    htm: 'html',
    svg: 'svg',
    json: 'json',
    csv: 'csv',
    // Diagrams
    mermaid: 'mermaid',
    mmd: 'mermaid',
    // Images
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    // Text
    txt: 'text',
    log: 'text',
    cfg: 'text',
    ini: 'text',
    yaml: 'text',
    yml: 'text',
    toml: 'text',
    xml: 'text'
  }
  return typeMap[ext] || 'text'
}

/**
 * Map file extension to programming language for code highlighting
 */
const getLanguageFromExtension = (ext: string): string | undefined => {
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    ps1: 'powershell',
    dockerfile: 'dockerfile'
  }
  return langMap[ext]
}

// -----------------------------------------------------------------------------
// Property Migration Helper
// -----------------------------------------------------------------------------

/**
 * Migrate legacy node fields to the properties system.
 * This ensures backward compatibility when loading old workspaces.
 */
const migrateNodeProperties = (node: Node<NodeData>): Node<NodeData> => {
  const data = { ...node.data }

  // Initialize properties if not present
  if (!data.properties) {
    data.properties = {} as Record<string, unknown>
  }
  const properties = data.properties as Record<string, unknown>

  // Migrate context metadata fields
  if (data.contextRole && !properties.contextRole) {
    properties.contextRole = data.contextRole
  }
  if (data.contextPriority && !properties.contextPriority) {
    properties.contextPriority = data.contextPriority
  }
  if (data.tags && data.tags.length > 0 && !properties.tags) {
    properties.tags = data.tags
  }

  // Migrate task-specific fields
  if (data.type === 'task') {
    const taskData = data as TaskNodeData
    if (taskData.status && !data.properties.status) {
      data.properties.status = taskData.status
    }
    if (taskData.priority && !data.properties.priority) {
      data.properties.priority = taskData.priority
    }
    if (taskData.dueDate && !data.properties.dueDate) {
      data.properties.dueDate = taskData.dueDate
    }
  }

  // Migrate conversation nodes to have mode field (defaults to 'chat')
  if (data.type === 'conversation') {
    const convData = data as ConversationNodeData
    if (!convData.mode) {
      convData.mode = 'chat'
    }
  }

  return { ...node, data }
}

/**
 * Migrate all nodes in a workspace to use the properties system
 */
const migrateWorkspaceNodes = (nodes: Node<NodeData>[]): Node<NodeData>[] => {
  return nodes.map(migrateNodeProperties)
}

// -----------------------------------------------------------------------------
// History Action Label Helper
// -----------------------------------------------------------------------------

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
  }
}

// -----------------------------------------------------------------------------
// Store Implementation
// -----------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      workspaceId: null,
      workspaceName: 'Untitled Workspace',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      propertySchema: { ...DEFAULT_PROPERTY_SCHEMA },
      contextSettings: { ...DEFAULT_CONTEXT_SETTINGS },
      themeSettings: { ...DEFAULT_THEME_SETTINGS },
      workspacePreferences: { ...DEFAULT_WORKSPACE_PREFERENCES },
      selectedNodeIds: [],
      selectedEdgeIds: [],
      activePanel: 'none',
      activeChatNodeId: null,
      openChatNodeIds: [],
      leftSidebarOpen: false,
      leftSidebarWidth: 280,
      leftSidebarTab: 'layers',
      expandedNodeIds: new Set<string>(),
      layersSortMode: 'hierarchy' as const,
      manualLayerOrder: null,
      layersFilter: '',
      hiddenNodeTypes: new Set<NodeData['type']>(),
      showMembersProjectId: null,
      focusModeNodeId: null,
      bookmarkedNodeId: null,
      numberedBookmarks: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null },
      pendingExtractions: [],
      extractionSourceFilter: null,
      isExtracting: null,
      openExtractionPanelNodeId: null,
      extractionDrag: null,
      lastAcceptedExtraction: null,
      streamingConversations: new Set<string>(),
      recentlySpawnedNodes: new Set<string>(),
      spawningNodeIds: [],
      nodeUpdatedAt: new Map<string, number>(),
      floatingPropertiesNodeIds: [],
      pinnedWindows: [],
      nextPinnedZIndex: 1,
      history: [],
      historyIndex: -1,
      dragStartPositions: new Map<string, { x: number; y: number }>(),
      resizeStartDimensions: new Map<string, { width: number; height: number }>(),
      syncMode: 'local' as const,
      multiplayerConfig: null,
      _syncSource: 'local' as const,
      isDirty: false,
      isLoading: false,
      createdAt: null,
      lastSaved: null,
      saveStatus: 'saved' as const,
      lastCanvasClick: null,
      lastCreatedNodeId: null,
      clipboardNodes: [],
      clipboardEdges: [],
      clipboardState: null,
      trash: [],

      // ---------------------------------------------------------------------
      // Node Actions
      // ---------------------------------------------------------------------

      addNode: (type, position) => {
        const id = uuid()
        let data: NodeData
        let dimensions = { width: 280, height: 120 }

        switch (type) {
          case 'conversation':
            data = createConversationData()
            dimensions = { width: 300, height: 140 }
            break
          case 'project': {
            const projectColor = get().themeSettings?.nodeColors?.project || '#64748b'
            data = createProjectData(projectColor)
            dimensions = { width: 400, height: 300 }
            break
          }
          case 'note':
            data = createNoteData()
            dimensions = { width: 280, height: 140 }
            break
          case 'task':
            data = createTaskData()
            dimensions = { width: 260, height: 140 }
            break
          case 'artifact':
            data = createArtifactData()
            dimensions = { width: 320, height: 200 }
            break
          case 'workspace':
            data = createWorkspaceData()
            dimensions = { width: 320, height: 220 }
            break
          case 'text':
            data = createTextData()
            dimensions = { width: 200, height: 60 }
            break
          case 'action':
            data = createActionData()
            dimensions = { width: 280, height: 140 }
            break
          case 'orchestrator':
            data = createOrchestratorData()
            dimensions = { width: 360, height: 280 }
            break
          default:
            throw new Error(`Unknown node type: ${type}`)
        }

        set((state) => {
          // Apply default property values from schema if configured
          const typeDefaults = state.propertySchema?.defaults?.[type]
          if (typeDefaults) {
            for (const [key, value] of Object.entries(typeDefaults)) {
              if (value !== undefined && value !== null && value !== '') {
                // Apply to top-level data for built-in fields (status, priority, complexity)
                if (key in data) {
                  ;(data as Record<string, unknown>)[key] = value
                } else {
                  // Apply to properties bag for custom/dynamic properties
                  if (!data.properties) data.properties = {}
                  ;(data.properties as Record<string, unknown>)[key] = value
                }
              }
            }
          }

          // Compute zIndex higher than all existing nodes so new node appears on top
          const maxZ = state.nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0)

          const node: Node<NodeData> = {
            id,
            type,
            position,
            data,
            width: dimensions.width,
            height: dimensions.height,
            selected: true,
            zIndex: maxZ + 1
          }

          // Deselect all other nodes
          state.nodes.forEach(n => { n.selected = false })
          state.nodes.push(node)
          state.selectedNodeIds = [id]
          state.lastCreatedNodeId = id
          state.isDirty = true
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({ type: 'ADD_NODE', node: JSON.parse(JSON.stringify(node)) })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
          // Track spawned node for spawn animation
          state.recentlySpawnedNodes.add(id)
        })

        // Auto-clear spawn state after animation completes
        setTimeout(() => {
          set((state) => {
            state.recentlySpawnedNodes.delete(id)
          })
        }, 300) // Match animation duration in animations.css

        return id
      },

      /**
       * Add a new agent node (conversation with mode='agent', preset='general')
       */
      addAgentNode: (position: { x: number; y: number }) => {
        const id = get().addNode('conversation', position)
        // Immediately set mode to 'agent' and preset to 'general'
        get().updateNode(id, {
          mode: 'agent',
          agentPreset: 'general'
        })
        return id
      },

      updateNode: (nodeId, data) => {
        const enabledChanged = 'enabled' in data
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            const before = JSON.parse(JSON.stringify(node.data))
            const now = Date.now()
            Object.assign(node.data, data, { updatedAt: now })
            state.isDirty = true
            // Update warmth tracking (new Map reference so Zustand detects change)
            state.nodeUpdatedAt = new Map(state.nodeUpdatedAt)
            state.nodeUpdatedAt.set(nodeId, now)
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({
              type: 'UPDATE_NODE',
              nodeId,
              before,
              after: JSON.parse(JSON.stringify(node.data))
            })
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
        // If enabled state changed, evaluate dependent node activations
        if (enabledChanged) {
          // Schedule evaluation for next tick to allow state to settle
          setTimeout(() => {
            get().evaluateAllNodeActivations()
          }, 0)
        }
      },

      updateBulkNodes: (nodeIds, data) => {
        const enabledChanged = 'enabled' in data
        set((state) => {
          const updates: Array<{ nodeId: string; before: NodeData; after: NodeData }> = []

          for (const nodeId of nodeIds) {
            const node = state.nodes.find((n) => n.id === nodeId)
            if (node) {
              const before = JSON.parse(JSON.stringify(node.data))
              Object.assign(node.data, data, { updatedAt: Date.now() })
              updates.push({
                nodeId,
                before,
                after: JSON.parse(JSON.stringify(node.data))
              })
            }
          }

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            // Push a batch update action for undo/redo
            state.history.push({
              type: 'BULK_UPDATE_NODES',
              updates
            } as HistoryAction)
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
        // If enabled state changed, evaluate dependent node activations
        if (enabledChanged) {
          setTimeout(() => {
            get().evaluateAllNodeActivations()
          }, 0)
        }
      },

      alignNodes: (nodeIds, alignment) => {
        if (nodeIds.length < 2) return

        set((state) => {
          const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          if (targetNodes.length < 2) return

          // Calculate bounds
          const bounds = targetNodes.reduce(
            (acc, node) => {
              const width = (node.data as { width?: number }).width || 260
              const height = (node.data as { height?: number }).height || 140
              return {
                minX: Math.min(acc.minX, node.position.x),
                maxX: Math.max(acc.maxX, node.position.x + width),
                minY: Math.min(acc.minY, node.position.y),
                maxY: Math.max(acc.maxY, node.position.y + height),
                centerX: 0,
                centerY: 0
              }
            },
            { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, centerX: 0, centerY: 0 }
          )
          bounds.centerX = (bounds.minX + bounds.maxX) / 2
          bounds.centerY = (bounds.minY + bounds.maxY) / 2

          const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []

          targetNodes.forEach((node) => {
            const width = (node.data as { width?: number }).width || 260
            const height = (node.data as { height?: number }).height || 140
            const before = { x: node.position.x, y: node.position.y }
            let newX = node.position.x
            let newY = node.position.y

            switch (alignment) {
              case 'left':
                newX = bounds.minX
                break
              case 'center':
                newX = bounds.centerX - width / 2
                break
              case 'right':
                newX = bounds.maxX - width
                break
              case 'top':
                newY = bounds.minY
                break
              case 'middle':
                newY = bounds.centerY - height / 2
                break
              case 'bottom':
                newY = bounds.maxY - height
                break
            }

            if (newX !== before.x || newY !== before.y) {
              node.position = { x: newX, y: newY }
              updates.push({ nodeId: node.id, before, after: { x: newX, y: newY } })
            }
          })

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'ALIGN_NODES', updates } as HistoryAction)
            state.historyIndex++
          }
        })
      },

      distributeNodes: (nodeIds, direction) => {
        if (nodeIds.length < 3) return // Need at least 3 nodes to distribute

        set((state) => {
          const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          if (targetNodes.length < 3) return

          // Sort nodes by position
          const sorted = [...targetNodes].sort((a, b) =>
            direction === 'horizontal'
              ? a.position.x - b.position.x
              : a.position.y - b.position.y
          )

          // Calculate total span
          const first = sorted[0]!
          const last = sorted[sorted.length - 1]!
          // firstSize reserved for future offset calculation
          const lastSize = direction === 'horizontal'
            ? ((last.data as { width?: number }).width || 260)
            : ((last.data as { height?: number }).height || 140)

          const start = direction === 'horizontal' ? first.position.x : first.position.y
          const end = direction === 'horizontal'
            ? last.position.x + lastSize
            : last.position.y + lastSize

          // Calculate total node sizes (excluding gaps)
          const totalNodeSize = sorted.reduce((sum, node) => {
            const size = direction === 'horizontal'
              ? ((node.data as { width?: number }).width || 260)
              : ((node.data as { height?: number }).height || 140)
            return sum + size
          }, 0)

          // Calculate gap between nodes
          const totalGap = (end - start) - totalNodeSize
          const gap = totalGap / (sorted.length - 1)

          const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []
          let currentPos = start

          sorted.forEach((node, index) => {
            const before = { x: node.position.x, y: node.position.y }
            const size = direction === 'horizontal'
              ? ((node.data as { width?: number }).width || 260)
              : ((node.data as { height?: number }).height || 140)

            if (index === 0 || index === sorted.length - 1) {
              // Keep first and last in place
              currentPos += size + gap
              return
            }

            const newPos = direction === 'horizontal'
              ? { x: currentPos, y: node.position.y }
              : { x: node.position.x, y: currentPos }

            if (newPos.x !== before.x || newPos.y !== before.y) {
              node.position = newPos
              updates.push({ nodeId: node.id, before, after: newPos })
            }

            currentPos += size + gap
          })

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'DISTRIBUTE_NODES', updates } as HistoryAction)
            state.historyIndex++
          }
        })
      },

      snapToGrid: (nodeIds, gridSize = 20) => {
        if (nodeIds.length < 1) return

        set((state) => {
          const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          if (targetNodes.length < 1) return

          const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []

          targetNodes.forEach((node) => {
            const before = { x: node.position.x, y: node.position.y }
            const newX = Math.round(node.position.x / gridSize) * gridSize
            const newY = Math.round(node.position.y / gridSize) * gridSize

            if (newX !== before.x || newY !== before.y) {
              node.position = { x: newX, y: newY }
              updates.push({ nodeId: node.id, before, after: { x: newX, y: newY } })
            }
          })

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'SNAP_TO_GRID', updates } as HistoryAction)
            state.historyIndex++
          }
        })
      },

      arrangeInGrid: (nodeIds, columns = 3) => {
        if (nodeIds.length < 2) return

        set((state) => {
          const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          if (targetNodes.length < 2) return

          // Sort by current position (top-left to bottom-right) for predictable ordering
          const sorted = [...targetNodes].sort((a, b) => {
            const rowA = Math.round(a.position.y / 100)
            const rowB = Math.round(b.position.y / 100)
            if (rowA !== rowB) return rowA - rowB
            return a.position.x - b.position.x
          })

          // Use the top-left node as anchor point
          const anchorX = Math.min(...sorted.map((n) => n.position.x))
          const anchorY = Math.min(...sorted.map((n) => n.position.y))

          // Calculate spacing based on average node dimensions + gap
          const avgWidth = sorted.reduce((sum, n) => sum + ((n.data as { width?: number }).width || 260), 0) / sorted.length
          const avgHeight = sorted.reduce((sum, n) => sum + ((n.data as { height?: number }).height || 140), 0) / sorted.length
          const gapX = 40
          const gapY = 40

          const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []

          sorted.forEach((node, index) => {
            const col = index % columns
            const row = Math.floor(index / columns)
            const before = { x: node.position.x, y: node.position.y }
            const newX = anchorX + col * (avgWidth + gapX)
            const newY = anchorY + row * (avgHeight + gapY)

            if (newX !== before.x || newY !== before.y) {
              node.position = { x: newX, y: newY }
              updates.push({ nodeId: node.id, before, after: { x: newX, y: newY } })
            }
          })

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'ARRANGE_GRID', updates } as HistoryAction)
            state.historyIndex++
          }
        })
      },

      sortByType: (nodeIds) => {
        if (nodeIds.length < 2) return

        set((state) => {
          const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          if (targetNodes.length < 2) return

          // Group by type
          const typeOrder = ['conversation', 'task', 'note', 'project', 'artifact', 'workspace']
          const sorted = [...targetNodes].sort((a, b) => {
            const typeA = typeOrder.indexOf((a.data as NodeData).type)
            const typeB = typeOrder.indexOf((b.data as NodeData).type)
            if (typeA !== typeB) return typeA - typeB
            // Within same type, sort by title
            const titleA = (a.data as { title?: string }).title || ''
            const titleB = (b.data as { title?: string }).title || ''
            return titleA.localeCompare(titleB)
          })

          // Position sorted nodes in a grid using same anchor as arrangeInGrid
          const anchorX = Math.min(...targetNodes.map((n) => n.position.x))
          const anchorY = Math.min(...targetNodes.map((n) => n.position.y))
          const columns = Math.ceil(Math.sqrt(sorted.length))
          const avgWidth = sorted.reduce((sum, n) => sum + ((n.data as { width?: number }).width || 260), 0) / sorted.length
          const avgHeight = sorted.reduce((sum, n) => sum + ((n.data as { height?: number }).height || 140), 0) / sorted.length
          const gapX = 40
          const gapY = 40

          const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []

          sorted.forEach((node, index) => {
            const col = index % columns
            const row = Math.floor(index / columns)
            const before = { x: node.position.x, y: node.position.y }
            const newX = anchorX + col * (avgWidth + gapX)
            const newY = anchorY + row * (avgHeight + gapY)

            if (newX !== before.x || newY !== before.y) {
              node.position = { x: newX, y: newY }
              updates.push({ nodeId: node.id, before, after: { x: newX, y: newY } })
            }
          })

          if (updates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'ALIGN_NODES', updates } as HistoryAction)
            state.historyIndex++
          }
        })
      },

      applyAutoLayout: (layoutType, nodeIds, spacing = 'default') => {
        const state = get()
        // If no node IDs provided, use all nodes (excluding workspace nodes)
        const targetNodeIds = nodeIds && nodeIds.length > 0
          ? nodeIds
          : state.nodes.filter(n => n.data.type !== 'workspace').map(n => n.id)

        if (targetNodeIds.length < 2) return

        // Filter to only nodes that are not pinned (flexible positioning)
        const targetNodes = state.nodes.filter(n =>
          targetNodeIds.includes(n.id) && (n.data as ContextMetadata).layoutMode !== 'pinned'
        )
        if (targetNodes.length < 2) return

        // Import layout algorithm dynamically to avoid circular dependencies
        import('../utils/layoutAlgorithms').then(({ applyLayout }) => {
          const newPositions = applyLayout(layoutType, targetNodes, state.edges, { spacing })

          set((s) => {
            const updates: Array<{ nodeId: string; before: { x: number; y: number }; after: { x: number; y: number } }> = []

            s.nodes.forEach(node => {
              // Skip pinned nodes
              if ((node.data as ContextMetadata).layoutMode === 'pinned') return

              const newPos = newPositions.get(node.id)
              if (newPos) {
                const before = { x: node.position.x, y: node.position.y }
                if (newPos.x !== before.x || newPos.y !== before.y) {
                  node.position = newPos
                  updates.push({ nodeId: node.id, before, after: newPos })
                }
              }
            })

            if (updates.length > 0) {
              s.isDirty = true
              s.history = s.history.slice(0, s.historyIndex + 1)
              s.history.push({ type: 'ALIGN_NODES', updates } as HistoryAction)
              s.historyIndex++
            }
          })
        })
      },

      copyNodes: (nodeIds) => {
        if (nodeIds.length < 1) return

        const state = get()
        const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
        if (targetNodes.length < 1) return

        // Deep clone nodes
        const clonedNodes = JSON.parse(JSON.stringify(targetNodes)) as Node<NodeData>[]

        // Find edges between selected nodes
        const nodeIdSet = new Set(nodeIds)
        const clonedEdges = state.edges
          .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
          .map((e) => JSON.parse(JSON.stringify(e)) as Edge<EdgeData>)

        set((s) => {
          s.clipboardNodes = clonedNodes
          s.clipboardEdges = clonedEdges
          s.clipboardState = { mode: 'copy', nodeIds: [...nodeIds] }
        })
      },

      cutNodes: (nodeIds) => {
        if (nodeIds.length < 1) return

        const state = get()
        const targetNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
        if (targetNodes.length < 1) return

        // Deep clone nodes and edges between them
        const clonedNodes = JSON.parse(JSON.stringify(targetNodes)) as Node<NodeData>[]
        const nodeIdSet = new Set(nodeIds)
        const clonedEdges = state.edges
          .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
          .map((e) => JSON.parse(JSON.stringify(e)) as Edge<EdgeData>)

        set((s) => {
          s.clipboardNodes = clonedNodes
          s.clipboardEdges = clonedEdges
          s.clipboardState = { mode: 'cut', nodeIds: [...nodeIds] }
        })
      },

      clearClipboard: () => {
        set((s) => {
          s.clipboardState = null
          s.clipboardNodes = []
          s.clipboardEdges = []
        })
      },

      // ---------------------------------------------------------------------
      // Trash Actions
      // ---------------------------------------------------------------------

      archiveNodes: (nodeIds) => {
        set((state) => {
          const now = Date.now()
          const nodeIdSet = new Set(nodeIds)

          // Also archive children of any project nodes
          const allArchiveIds = new Set(nodeIds)
          for (const nodeId of nodeIds) {
            const node = state.nodes.find(n => n.id === nodeId)
            if (node?.data.type === 'project') {
              // Recursively find children
              const findChildren = (parentId: string): void => {
                state.nodes.forEach(n => {
                  if ((n.data as { parentId?: string }).parentId === parentId) {
                    allArchiveIds.add(n.id)
                    findChildren(n.id)
                  }
                })
              }
              findChildren(nodeId)
            }
          }

          state.nodes = state.nodes.map(n => {
            if (allArchiveIds.has(n.id)) {
              return {
                ...n,
                data: {
                  ...n.data,
                  isArchived: true,
                  archivedAt: now,
                  archivedFromPosition: { x: n.position.x, y: n.position.y }
                }
              }
            }
            return n
          })

          // Deselect archived nodes
          state.selectedNodeIds = state.selectedNodeIds.filter(id => !allArchiveIds.has(id))

          // Close panels for archived nodes
          if (state.activeChatNodeId && allArchiveIds.has(state.activeChatNodeId)) {
            state.activeChatNodeId = null
            state.activePanel = 'none'
          }
          state.openChatNodeIds = state.openChatNodeIds.filter(id => !allArchiveIds.has(id))
          state.pinnedWindows = state.pinnedWindows.filter(w => !allArchiveIds.has(w.nodeId))

          state.isDirty = true
        })
      },

      restoreFromArchive: (nodeIds) => {
        set((state) => {
          const nodeIdSet = new Set(nodeIds)
          state.nodes = state.nodes.map(n => {
            if (nodeIdSet.has(n.id) && n.data.isArchived) {
              const restoredPos = n.data.archivedFromPosition || n.position
              return {
                ...n,
                position: restoredPos,
                data: {
                  ...n.data,
                  isArchived: undefined,
                  archivedAt: undefined,
                  archivedFromPosition: undefined
                }
              }
            }
            return n
          })
          state.isDirty = true
        })
      },

      getArchivedNodes: () => {
        return get().nodes.filter(n => n.data.isArchived === true)
      },

      softDeleteNodes: (nodeIds) => {
        set((state) => {
          const now = Date.now()
          const nodesToTrash = state.nodes.filter((n) => nodeIds.includes(n.id))

          // For each node, collect its connected edges
          const trashedItems: TrashedItem[] = nodesToTrash.map(node => {
            const connectedEdges = state.edges.filter(
              (e) => e.source === node.id || e.target === node.id
            )
            return {
              node: JSON.parse(JSON.stringify(node)),
              edges: JSON.parse(JSON.stringify(connectedEdges)),
              deletedAt: now
            }
          })

          // Add to trash
          state.trash = [...state.trash, ...trashedItems]

          // Keep only last 50 items in trash
          if (state.trash.length > 50) {
            state.trash = state.trash.slice(-50)
          }

          // Remove nodes from canvas
          state.nodes = state.nodes.filter((n) => !nodeIds.includes(n.id))
          state.edges = state.edges.filter(
            (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
          )
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => !nodeIds.includes(id))
          state.isDirty = true

          // Close panels if the active node is deleted
          if (state.activeChatNodeId && nodeIds.includes(state.activeChatNodeId)) {
            state.activeChatNodeId = null
            state.activePanel = 'none'
          }

          // Close pinned windows for deleted nodes
          state.pinnedWindows = state.pinnedWindows.filter(w => !nodeIds.includes(w.nodeId))
        })
      },

      restoreFromTrash: (trashedItemIndex) => {
        set((state) => {
          const item = state.trash[trashedItemIndex]
          if (!item) return

          // Restore the node
          state.nodes.push(item.node)

          // Restore edges only if both source and target exist
          const existingNodeIds = new Set(state.nodes.map(n => n.id))
          const validEdges = item.edges.filter(
            e => existingNodeIds.has(e.source) && existingNodeIds.has(e.target)
          )
          state.edges = [...state.edges, ...validEdges]

          // Remove from trash
          state.trash = state.trash.filter((_, i) => i !== trashedItemIndex)
          state.isDirty = true

          // Mark as recently spawned for animation
          state.recentlySpawnedNodes.add(item.node.id)
        })
      },

      permanentlyDelete: (trashedItemIndex) => {
        set((state) => {
          state.trash = state.trash.filter((_, i) => i !== trashedItemIndex)
        })
      },

      emptyTrash: () => {
        set((state) => {
          state.trash = []
        })
      },

      pasteNodes: (position) => {
        const state = get()
        if (state.clipboardNodes.length < 1) return

        // Calculate center of clipboard nodes to use as offset reference
        const bounds = state.clipboardNodes.reduce(
          (acc, node) => ({
            minX: Math.min(acc.minX, node.position.x),
            minY: Math.min(acc.minY, node.position.y),
            maxX: Math.max(acc.maxX, node.position.x),
            maxY: Math.max(acc.maxY, node.position.y)
          }),
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        )
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2

        // Create ID mapping for new nodes
        const idMap = new Map<string, string>()
        state.clipboardNodes.forEach((node) => {
          idMap.set(node.id, uuid())
        })

        set((s) => {
          const newNodeIds: string[] = []

          // Create new nodes with offset positions and new IDs
          for (const node of state.clipboardNodes) {
            const newId = idMap.get(node.id)!
            const offsetX = node.position.x - centerX
            const offsetY = node.position.y - centerY
            const newNode: Node<NodeData> = {
              ...JSON.parse(JSON.stringify(node)),
              id: newId,
              position: {
                x: position.x + offsetX,
                y: position.y + offsetY
              },
              selected: true
            }
            s.nodes.push(newNode)
            newNodeIds.push(newId)

            // Add to history
            s.history = s.history.slice(0, s.historyIndex + 1)
            s.history.push({ type: 'ADD_NODE', node: JSON.parse(JSON.stringify(newNode)) } as HistoryAction)
            s.historyIndex++
          }

          // Recreate edges with new IDs
          for (const edge of state.clipboardEdges) {
            const newSource = idMap.get(edge.source)
            const newTarget = idMap.get(edge.target)
            if (newSource && newTarget) {
              const newEdge: Edge<EdgeData> = {
                ...JSON.parse(JSON.stringify(edge)),
                id: uuid(),
                source: newSource,
                target: newTarget
              }
              s.edges.push(newEdge)
              s.history = s.history.slice(0, s.historyIndex + 1)
              s.history.push({ type: 'ADD_EDGE', edge: JSON.parse(JSON.stringify(newEdge)) } as HistoryAction)
              s.historyIndex++
            }
          }

          // Select only the pasted nodes
          s.selectedNodeIds = newNodeIds
          s.isDirty = true
        })

        // If this was a cut operation, delete the original nodes and clear clipboard
        if (state.clipboardState?.mode === 'cut') {
          get().deleteNodes(state.clipboardState.nodeIds)
          set((s) => {
            s.clipboardState = null
            s.clipboardNodes = []
            s.clipboardEdges = []
          })
        } else {
          // Copy mode: clear clipboard state but keep contents for re-paste
          set((s) => {
            s.clipboardState = null
          })
        }
      },

      changeNodeType: (nodeId, newType) => {
        set((state) => {
          const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId)
          if (nodeIndex === -1) return

          const node = state.nodes[nodeIndex]!
          const oldData = node.data
          const oldType = oldData.type

          // Don't change if already the same type
          if (oldType === newType) return

          // Store before state for history
          const before = JSON.parse(JSON.stringify(node))

          // If the node's color matches its old type's theme color (or is unset),
          // update to the new type's theme color
          const oldTypeThemeColor = state.themeSettings?.nodeColors?.[oldType]
          const newTypeThemeColor = state.themeSettings?.nodeColors?.[newType]
          const resolvedColor = (!oldData.color || oldData.color === oldTypeThemeColor)
            ? newTypeThemeColor
            : oldData.color

          // Preserve common fields from ContextMetadata
          const commonFields = {
            title: oldData.title,
            color: resolvedColor,
            parentId: oldData.parentId,
            createdAt: oldData.createdAt,
            updatedAt: Date.now(),
            properties: (oldData.properties || {}) as Record<string, unknown>,
            tags: oldData.tags,
            summary: oldData.summary,
            keyEntities: oldData.keyEntities,
            contextRole: oldData.contextRole,
            contextPriority: oldData.contextPriority,
            activationCondition: oldData.activationCondition,
            enabled: oldData.enabled,
            width: (oldData as { width?: number }).width,
            height: (oldData as { height?: number }).height
          }

          // Map content between types (description <-> content)
          const oldDescription = (oldData as { description?: string }).description || ''
          const oldContent = (oldData as { content?: string }).content || ''
          const textContent = oldDescription || oldContent

          // Create new data based on target type
          let newData: NodeData
          switch (newType) {
            case 'note':
              newData = {
                ...commonFields,
                type: 'note',
                content: textContent
              } as NoteNodeData
              break
            case 'task':
              newData = {
                ...commonFields,
                type: 'task',
                description: textContent,
                status: 'todo',
                priority: 'none'
              } as TaskNodeData
              break
            case 'project':
              newData = {
                ...commonFields,
                type: 'project',
                description: textContent,
                collapsed: false,
                childNodeIds: (oldData as { childNodeIds?: string[] }).childNodeIds || [],
                color: oldData.color || '#8b5cf6'
              } as ProjectNodeData
              break
            case 'conversation': {
              // If converting from a type with text content, seed it as the first system message
              const existingMessages = (oldData as { messages?: unknown[] }).messages || []
              const seedMessages = existingMessages.length > 0
                ? existingMessages
                : textContent
                  ? [{ role: 'user', content: textContent, timestamp: Date.now() }]
                  : []
              newData = {
                ...commonFields,
                type: 'conversation',
                messages: seedMessages,
                provider: 'anthropic'
              } as ConversationNodeData
              break
            }
            case 'artifact':
              newData = {
                ...commonFields,
                type: 'artifact',
                content: textContent,
                contentType: 'markdown',
                source: { type: 'created', method: 'manual' },
                version: 1
              } as ArtifactNodeData
              break
            case 'workspace':
              newData = {
                ...commonFields,
                type: 'workspace',
                description: textContent,
                memberNodeIds: [],
                workspaceId: null,
                workspacePath: null
              } as unknown as WorkspaceNodeData
              break
            case 'text':
              newData = {
                ...commonFields,
                type: 'text',
                content: textContent
              } as TextNodeData
              break
            case 'action':
              newData = {
                ...commonFields,
                type: 'action',
                description: textContent,
                enabled: true,
                trigger: { type: 'manual' },
                conditions: [],
                actions: [],
                runCount: 0,
                errorCount: 0
              } as ActionNodeData
              break
            default:
              return
          }

          // Update node type and data
          node.type = newType
          node.data = newData as NodeData

          state.isDirty = true

          // Push to history
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({
            type: 'UPDATE_NODE',
            nodeId,
            before: before.data,
            after: JSON.parse(JSON.stringify(node.data))
          })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })
      },

      deleteNodes: (nodeIds) => {
        set((state) => {
          const deletedNodes = state.nodes.filter((n) => nodeIds.includes(n.id))
          const deletedEdges = state.edges.filter(
            (e) => nodeIds.includes(e.source) || nodeIds.includes(e.target)
          )

          state.nodes = state.nodes.filter((n) => !nodeIds.includes(n.id))
          state.edges = state.edges.filter(
            (e) => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
          )
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => !nodeIds.includes(id))
          state.isDirty = true

          // Push batch history action
          const actions: HistoryAction[] = [
            ...deletedNodes.map((node) => ({
              type: 'DELETE_NODE' as const,
              node: JSON.parse(JSON.stringify(node))
            })),
            ...deletedEdges.map((edge) => ({
              type: 'DELETE_EDGE' as const,
              edge: JSON.parse(JSON.stringify(edge))
            }))
          ]
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({ type: 'BATCH', actions })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }

          // Close panels if the active node is deleted
          if (state.activeChatNodeId && nodeIds.includes(state.activeChatNodeId)) {
            state.activeChatNodeId = null
            state.activePanel = 'none'
          }

          // Close pinned windows for deleted nodes
          state.pinnedWindows = state.pinnedWindows.filter(w => !nodeIds.includes(w.nodeId))
        })
      },

      moveNode: (nodeId, position) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            node.position = position
            state.isDirty = true
          }
        })
      },

      resizeNode: (nodeId, dimensions) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            const before = { width: node.width || 280, height: node.height || 120 }
            if (dimensions.width) node.width = Math.max(150, dimensions.width)
            if (dimensions.height) node.height = Math.max(80, dimensions.height)
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({
              type: 'RESIZE_NODE',
              nodeId,
              before,
              after: { width: node.width!, height: node.height! }
            })
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
      },

      updateNodeDimensions: (nodeId, width, height) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            node.width = Math.max(150, width)
            node.height = Math.max(80, height)
            // Also update in data for persistence (all node types support this now)
            ;(node.data as ContextMetadata).width = node.width
            ;(node.data as ContextMetadata).height = node.height
            state.isDirty = true
          }
        })
      },

      // ---------------------------------------------------------------------
      // Edge Actions
      // ---------------------------------------------------------------------

      addEdge: (connection) => {
        if (!connection.source || !connection.target) return

        // Check if both nodes share the same parentId (intra-project edge)
        const state = get()
        const sourceNode = state.nodes.find(n => n.id === connection.source)
        const targetNode = state.nodes.find(n => n.id === connection.target)
        const sourceParentId = sourceNode?.data?.parentId as string | undefined
        const targetParentId = targetNode?.data?.parentId as string | undefined
        const isIntraProject = !!(sourceParentId && targetParentId && sourceParentId === targetParentId)

        // Get source node's outgoing edge color if set
        const outgoingEdgeColor = (sourceNode?.data as ContextMetadata | undefined)?.outgoingEdgeColor

        const edgeId = `${connection.source}-${connection.target}`
        const edge: Edge<EdgeData> = {
          id: edgeId,
          type: 'custom',
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          className: 'edge-new', // Animation class for draw effect
          data: {
            ...DEFAULT_EDGE_DATA,
            intraProject: isIntraProject,
            color: outgoingEdgeColor // Will be undefined if not set, using default
          }
          // Note: Project nodes have z-index: -1 so all edges render above them automatically
        }

        set((state) => {
          // Prevent duplicate edges
          const exists = state.edges.some(
            (e) => e.source === edge.source && e.target === edge.target
          )
          if (!exists) {
            state.edges.push(edge)
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'ADD_EDGE', edge: JSON.parse(JSON.stringify(edge)) })
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
        // Evaluate activations when edge is added
        setTimeout(() => get().evaluateAllNodeActivations(), 0)

        // Remove edge-new class after animation completes (400ms animation duration)
        setTimeout(() => {
          set((state) => {
            const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
            const edge = state.edges[edgeIndex]
            if (edgeIndex !== -1 && edge && edge.className === 'edge-new') {
              state.edges[edgeIndex] = { ...edge, className: undefined }
            }
          })
        }, 450)
      },

      updateEdge: (edgeId, data, options) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
          const edge = state.edges[edgeIndex]
          if (edgeIndex !== -1 && edge) {
            const before = edge.data ? { ...edge.data } : { ...DEFAULT_EDGE_DATA }
            // Create new edge object to ensure React Flow detects the change
            const updatedEdge = {
              ...edge,
              data: { ...(edge.data || DEFAULT_EDGE_DATA), ...data }
            }
            state.edges[edgeIndex] = updatedEdge
            state.isDirty = true

            // Skip history during drag operations (history is committed at drag end)
            if (!options?.skipHistory) {
              state.history = state.history.slice(0, state.historyIndex + 1)
              state.history.push({
                type: 'UPDATE_EDGE',
                edgeId,
                before,
                after: { ...updatedEdge.data }
              })
              state.historyIndex++
              if (state.history.length > 100) {
                state.history = state.history.slice(-100)
                state.historyIndex = state.history.length - 1
              }
            }
          }
        })
        // Evaluate activations when edge properties change (for edge-property trigger)
        setTimeout(() => get().evaluateAllNodeActivations(), 0)
      },

      // Commit waypoint drag as a single undo action (called at drag end)
      commitEdgeWaypointDrag: (edgeId, beforeWaypoints, afterWaypoints) => {
        set((state) => {
          // Only add to history if waypoints actually changed
          const before = beforeWaypoints ? [...beforeWaypoints] : undefined
          const after = afterWaypoints ? [...afterWaypoints] : undefined
          const changed = JSON.stringify(before) !== JSON.stringify(after)

          if (changed) {
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({
              type: 'UPDATE_EDGE',
              edgeId,
              before: { waypoints: before },
              after: { waypoints: after }
            })
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
      },

      deleteEdges: (edgeIds) => {
        set((state) => {
          const deleted = state.edges.filter((e) => edgeIds.includes(e.id))
          state.edges = state.edges.filter((e) => !edgeIds.includes(e.id))
          state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => !edgeIds.includes(id))
          state.isDirty = true

          deleted.forEach((edge) => {
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({ type: 'DELETE_EDGE', edge: JSON.parse(JSON.stringify(edge)) })
            state.historyIndex++
          })
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })
        // Evaluate activations when edges are deleted
        setTimeout(() => get().evaluateAllNodeActivations(), 0)
      },

      linkSelectedNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        const state = get()
        // Sort nodes by position (top-left to bottom-right) for logical chaining
        const sortedNodes = [...nodeIds]
          .map((id) => state.nodes.find((n) => n.id === id))
          .filter((n) => n !== undefined)
          .sort((a, b) => {
            // Sort by Y first (top to bottom), then by X (left to right)
            const yDiff = a!.position.y - b!.position.y
            if (Math.abs(yDiff) > 50) return yDiff
            return a!.position.x - b!.position.x
          })

        // Create edges between consecutive nodes
        for (let i = 0; i < sortedNodes.length - 1; i++) {
          const source = sortedNodes[i]!
          const target = sortedNodes[i + 1]!
          const edgeId = `${source.id}-${target.id}`

          // Check if edge already exists
          const existingEdge = state.edges.find(
            (e) => e.id === edgeId || (e.source === source.id && e.target === target.id)
          )
          if (!existingEdge) {
            get().addEdge({
              source: source.id,
              target: target.id,
              sourceHandle: null,
              targetHandle: null
            })
          }
        }
      },

      linkAllNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        const state = get()
        const newEdges: Edge<EdgeData>[] = []

        // Create all-to-all edges (N*(N-1)/2 pairs)
        for (let i = 0; i < nodeIds.length; i++) {
          for (let j = i + 1; j < nodeIds.length; j++) {
            const sourceId = nodeIds[i]!
            const targetId = nodeIds[j]!
            const edgeId = `${sourceId}-${targetId}`
            const reverseId = `${targetId}-${sourceId}`

            // Check if edge already exists in either direction
            const exists = state.edges.some(
              (e) => e.id === edgeId || e.id === reverseId ||
                (e.source === sourceId && e.target === targetId) ||
                (e.source === targetId && e.target === sourceId)
            )
            if (!exists) {
              const sourceNode = state.nodes.find(n => n.id === sourceId)
              const outgoingEdgeColor = (sourceNode?.data as ContextMetadata | undefined)?.outgoingEdgeColor
              newEdges.push({
                id: edgeId,
                type: 'custom',
                source: sourceId,
                target: targetId,
                sourceHandle: null,
                targetHandle: null,
                data: { ...DEFAULT_EDGE_DATA, color: outgoingEdgeColor }
              })
            }
          }
        }

        if (newEdges.length > 0) {
          set((s) => {
            for (const edge of newEdges) {
              s.edges.push(edge)
            }
            // Single batch history entry for undo
            s.history = s.history.slice(0, s.historyIndex + 1)
            s.history.push({
              type: 'BATCH',
              actions: newEdges.map(edge => ({ type: 'ADD_EDGE', edge: JSON.parse(JSON.stringify(edge)) }))
            } as HistoryAction)
            s.historyIndex++
            s.isDirty = true
            if (s.history.length > 100) {
              s.history = s.history.slice(-100)
              s.historyIndex = s.history.length - 1
            }
          })
          setTimeout(() => get().evaluateAllNodeActivations(), 0)
        }
      },

      unlinkSelectedNodes: (nodeIds) => {
        if (nodeIds.length < 2) return

        const state = get()
        const nodeIdSet = new Set(nodeIds)

        // Find all edges between selected nodes
        const edgesToDelete = state.edges
          .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
          .map((e) => e.id)

        if (edgesToDelete.length > 0) {
          get().deleteEdges(edgesToDelete)
        }
      },

      reverseEdge: (edgeId) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === edgeId)
          if (edgeIndex === -1) return

          const edge = state.edges[edgeIndex]
          if (!edge) return

          // Store before state for history
          const before = JSON.parse(JSON.stringify(edge))

          // Keep the same edge ID — just swap source/target/handles
          // When reversing, convert handle types: -target becomes -source and vice versa
          const newSourceHandle = edge.targetHandle?.replace('-target', '-source') || null
          const newTargetHandle = edge.sourceHandle?.replace('-source', '-target') || null

          const reversedEdge = {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: newSourceHandle,
            targetHandle: newTargetHandle,
            data: edge.data ? { ...edge.data } : undefined
          }

          // Replace the entire edges array to ensure React Flow detects the change
          state.edges = [
            ...state.edges.slice(0, edgeIndex),
            reversedEdge,
            ...state.edges.slice(edgeIndex + 1)
          ]

          state.isDirty = true
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({
            type: 'REVERSE_EDGE',
            edgeId: edge.id,
            before,
            after: JSON.parse(JSON.stringify(reversedEdge))
          })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })
      },

      reconnectEdge: (oldEdge, newConnection) => {
        set((state) => {
          const edgeIndex = state.edges.findIndex((e) => e.id === oldEdge.id)
          if (edgeIndex === -1) return

          // Calculate new ID based on new connection
          const newId = `${newConnection.source}-${newConnection.target}`

          // Check if this edge already exists (prevent duplicate)
          const existingEdge = state.edges.find((e) => e.id === newId && e.id !== oldEdge.id)
          if (existingEdge) {
            // Edge already exists, just delete the old one
            state.edges.splice(edgeIndex, 1)
            state.isDirty = true
            return
          }

          // Store before state for history
          const before = JSON.parse(JSON.stringify(oldEdge))

          // Create reconnected edge
          const reconnectedEdge: Edge<EdgeData> = {
            ...oldEdge,
            id: newId,
            source: newConnection.source!,
            target: newConnection.target!,
            sourceHandle: newConnection.sourceHandle,
            targetHandle: newConnection.targetHandle
          }

          state.edges[edgeIndex] = reconnectedEdge

          // Update selection if this edge was selected
          const selectedIndex = state.selectedEdgeIds.indexOf(oldEdge.id)
          if (selectedIndex !== -1) {
            state.selectedEdgeIds[selectedIndex] = newId
          }

          state.isDirty = true
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({
            type: 'RECONNECT_EDGE',
            edgeId: before.id,
            before,
            after: JSON.parse(JSON.stringify(reconnectedEdge))
          })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })
        // Evaluate activations when edges are reconnected
        setTimeout(() => get().evaluateAllNodeActivations(), 0)
      },

      // ---------------------------------------------------------------------
      // Outgoing Edge Color Actions
      // ---------------------------------------------------------------------

      setOutgoingEdgeColor: (nodeId, color) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            ;(node.data as ContextMetadata).outgoingEdgeColor = color
            node.data.updatedAt = Date.now()
            state.isDirty = true
          }
        })
      },

      updateAllOutgoingEdges: (nodeId, color) => {
        set((state) => {
          // Find all edges where this node is the source
          const outgoingEdges = state.edges.filter((e) => e.source === nodeId)
          outgoingEdges.forEach((edge) => {
            if (!edge.data) {
              edge.data = { ...DEFAULT_EDGE_DATA }
            }
            edge.data.color = color
          })
          if (outgoingEdges.length > 0) {
            state.isDirty = true
          }
        })
      },

      resetOutgoingEdges: (nodeId) => {
        set((state) => {
          // Find all edges where this node is the source
          const outgoingEdges = state.edges.filter((e) => e.source === nodeId)
          outgoingEdges.forEach((edge) => {
            if (edge.data) {
              edge.data.color = undefined // Reset to default
            }
          })
          // Also clear the node's outgoingEdgeColor setting
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            ;(node.data as ContextMetadata).outgoingEdgeColor = undefined
            node.data.updatedAt = Date.now()
          }
          if (outgoingEdges.length > 0 || node) {
            state.isDirty = true
          }
        })
      },

      // ---------------------------------------------------------------------
      // React Flow Callbacks
      // ---------------------------------------------------------------------

      onNodesChange: (changes) => {
        set((state) => {
          state.nodes = applyNodeChanges(changes, state.nodes) as Node<NodeData>[]

          // Track selection changes (only scan if there are select-type changes)
          if (changes.some((c) => c.type === 'select')) {
            state.selectedNodeIds = state.nodes.filter((n) => n.selected).map((n) => n.id)
            // Open properties panel when a node is selected
            if (state.selectedNodeIds.length > 0 && state.activePanel !== 'chat') {
              state.activePanel = 'properties'
            }
          }

          // Mark dirty for position/dimension changes
          if (changes.some((c) => c.type === 'position' || c.type === 'dimensions')) {
            state.isDirty = true
          }
        })
      },

      onEdgesChange: (changes) => {
        set((state) => {
          state.edges = applyEdgeChanges(changes, state.edges) as Edge<EdgeData>[]

          // Track selection
          const selectionChanges = changes.filter((c) => c.type === 'select')
          if (selectionChanges.length > 0) {
            state.selectedEdgeIds = state.edges.filter((e) => e.selected).map((e) => e.id)
          }
        })
      },

      onConnect: (connection) => {
        get().addEdge(connection)
      },

      // ---------------------------------------------------------------------
      // Selection Actions
      // ---------------------------------------------------------------------

      setSelectedNodes: (nodeIds) => {
        set((state) => {
          state.selectedNodeIds = nodeIds
          state.nodes.forEach((n) => {
            n.selected = nodeIds.includes(n.id)
          })
          if (nodeIds.length > 0) {
            state.activePanel = 'properties'
          }
        })
      },

      setSelectedEdges: (edgeIds) => {
        set((state) => {
          state.selectedEdgeIds = edgeIds
          state.edges.forEach((e) => {
            e.selected = edgeIds.includes(e.id)
          })
        })
      },

      clearSelection: () => {
        set((state) => {
          state.selectedNodeIds = []
          state.selectedEdgeIds = []
          state.nodes.forEach((n) => {
            n.selected = false
          })
          state.edges.forEach((e) => {
            e.selected = false
          })
          state.activePanel = 'none'
        })
      },

      clearLastCreatedNodeId: () => {
        set((state) => {
          state.lastCreatedNodeId = null
        })
      },

      // ---------------------------------------------------------------------
      // Panel Actions
      // ---------------------------------------------------------------------

      openChat: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (node && node.data.type === 'conversation') {
          set((state) => {
            // Add to open chats if not already open
            if (!state.openChatNodeIds.includes(nodeId)) {
              state.openChatNodeIds.push(nodeId)
            }
            state.activeChatNodeId = nodeId
            state.activePanel = 'chat'
          })
        }
      },

      closeChat: (nodeId) => {
        set((state) => {
          const idToClose = nodeId || state.activeChatNodeId
          if (idToClose) {
            state.openChatNodeIds = state.openChatNodeIds.filter((id) => id !== idToClose)
          }
          // If closing the active chat, switch to another or none
          if (state.activeChatNodeId === idToClose) {
            state.activeChatNodeId = state.openChatNodeIds[0] || null
            if (!state.activeChatNodeId) {
              state.activePanel = state.selectedNodeIds.length > 0 ? 'properties' : 'none'
            }
          }
        })
      },

      focusChat: (nodeId) => {
        set((state) => {
          if (state.openChatNodeIds.includes(nodeId)) {
            state.activeChatNodeId = nodeId
            state.activePanel = 'chat'
          }
        })
      },

      openProperties: () => {
        set((state) => {
          state.activePanel = 'properties'
        })
      },

      closeProperties: () => {
        set((state) => {
          state.activePanel = 'none'
          // Also deselect nodes to hide the sidebar
          state.selectedNodeIds = []
          state.floatingPropertiesNodeIds = []
        })
      },

      openFloatingProperties: (nodeId) => {
        set((state) => {
          // Add to array if not already present
          if (!state.floatingPropertiesNodeIds.includes(nodeId)) {
            state.floatingPropertiesNodeIds.push(nodeId)
          }
        })
      },

      closeFloatingProperties: (nodeId) => {
        set((state) => {
          if (nodeId) {
            // Close specific modal
            state.floatingPropertiesNodeIds = state.floatingPropertiesNodeIds.filter(id => id !== nodeId)
          } else {
            // Close all modals and deselect
            state.floatingPropertiesNodeIds = []
            state.selectedNodeIds = []
          }
        })
      },

      // ---------------------------------------------------------------------
      // Pin Mode Actions
      // ---------------------------------------------------------------------

      pinNode: (nodeId) => {
        set((state) => {
          const node = state.nodes.find(n => n.id === nodeId)
          if (!node) return
          // Don't pin if already pinned
          if (state.pinnedWindows.some(w => w.nodeId === nodeId)) return

          // Cascade position for multiple pinned windows
          const viewportWidth = window.innerWidth
          const offsetIndex = state.pinnedWindows.length
          state.pinnedWindows.push({
            nodeId,
            position: {
              x: viewportWidth - 440,
              y: 80 + (offsetIndex * 50)
            },
            size: { width: 400, height: 350 },
            minimized: false,
            zIndex: state.nextPinnedZIndex
          })
          state.nextPinnedZIndex++
          state.isDirty = true
        })
      },

      unpinNode: (nodeId) => {
        set((state) => {
          state.pinnedWindows = state.pinnedWindows.filter(w => w.nodeId !== nodeId)
        })
      },

      updatePinnedWindow: (nodeId, updates) => {
        set((state) => {
          const window = state.pinnedWindows.find(w => w.nodeId === nodeId)
          if (window) {
            Object.assign(window, updates)
          }
        })
      },

      bringPinnedToFront: (nodeId) => {
        set((state) => {
          const window = state.pinnedWindows.find(w => w.nodeId === nodeId)
          if (window) {
            window.zIndex = state.nextPinnedZIndex
            state.nextPinnedZIndex++
          }
        })
      },

      // ---------------------------------------------------------------------
      // Left Sidebar Actions
      // ---------------------------------------------------------------------

      toggleLeftSidebar: () => {
        set((state) => {
          state.leftSidebarOpen = !state.leftSidebarOpen
        })
      },

      setLeftSidebarWidth: (width) => {
        set((state) => {
          state.leftSidebarWidth = Math.max(200, Math.min(400, width))
        })
      },

      setLeftSidebarTab: (tab) => {
        set((state) => {
          state.leftSidebarTab = tab
        })
      },

      toggleNodeExpanded: (nodeId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedNodeIds)
          if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId)
          } else {
            newExpanded.add(nodeId)
          }
          state.expandedNodeIds = newExpanded
        })
      },

      setLayersSortMode: (mode) => {
        set((state) => {
          state.layersSortMode = mode
        })
      },

      setLayersFilter: (filter) => {
        set((state) => {
          state.layersFilter = filter
        })
      },

      toggleNodeTypeVisibility: (nodeType) => {
        set((state) => {
          const newSet = new Set(state.hiddenNodeTypes)
          if (newSet.has(nodeType)) {
            newSet.delete(nodeType)
          } else {
            newSet.add(nodeType)
          }
          state.hiddenNodeTypes = newSet
        })
      },

      setHiddenNodeTypes: (types) => {
        set((state) => {
          state.hiddenNodeTypes = types
        })
      },

      showAllNodeTypes: () => {
        set((state) => {
          state.hiddenNodeTypes = new Set()
        })
      },

      hideAllNodeTypes: () => {
        set((state) => {
          state.hiddenNodeTypes = new Set([
            'conversation', 'note', 'task', 'project', 'artifact', 'workspace', 'text', 'action'
          ] as NodeData['type'][])
        })
      },

      setShowMembersProject: (projectId) => {
        set((state) => {
          state.showMembersProjectId = projectId
        })
      },

      setFocusModeNode: (nodeId) => {
        set((state) => {
          state.focusModeNodeId = nodeId
          // Clear show members when entering focus mode
          if (nodeId) {
            state.showMembersProjectId = null
          }
        })
      },

      toggleFocusMode: () => {
        set((state) => {
          if (state.focusModeNodeId) {
            // Exit focus mode
            state.focusModeNodeId = null
          } else if (state.selectedNodeIds.length === 1) {
            // Enter focus mode with selected node
            state.focusModeNodeId = state.selectedNodeIds[0]!
            // Clear show members when entering focus mode
            state.showMembersProjectId = null
          }
        })
      },

      toggleNodeCollapsed: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (!node) return

          const isCollapsed = !node.data.collapsed

          // Get child IDs based on node type
          let childIds: string[] = []
          if (node.data.type === 'project') {
            childIds = (node.data as ProjectNodeData).childNodeIds || []
          } else {
            // For other nodes, children are outgoing edge targets
            childIds = state.edges
              .filter((e) => e.source === nodeId)
              .map((e) => e.target)
          }

          // Update the node's collapsed state
          ;(node.data as ContextMetadata).collapsed = isCollapsed

          // Update hidden state for all child nodes and their edges
          childIds.forEach((childId) => {
            const childNode = state.nodes.find((n) => n.id === childId)
            if (childNode) {
              childNode.hidden = isCollapsed
            }
          })

          // Hide/show edges to children
          state.edges.forEach((edge) => {
            if (childIds.includes(edge.source) || childIds.includes(edge.target)) {
              edge.hidden = isCollapsed
            }
          })

          state.isDirty = true
        })
      },

      getChildNodeIds: (nodeId) => {
        const state = get()
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return []

        if (node.data.type === 'project') {
          return (node.data as ProjectNodeData).childNodeIds || []
        }
        // For other nodes, children are outgoing edge targets
        return state.edges.filter((e) => e.source === nodeId).map((e) => e.target)
      },

      setBookmarkedNode: (nodeId) => {
        set((state) => {
          state.bookmarkedNodeId = nodeId
        })
      },

      toggleBookmark: () => {
        set((state) => {
          if (state.selectedNodeIds.length === 1) {
            const selectedId = state.selectedNodeIds[0]!
            // Toggle: clear if same node, set if different
            state.bookmarkedNodeId = state.bookmarkedNodeId === selectedId ? null : selectedId
          }
        })
      },

      setNumberedBookmark: (num, nodeId) => {
        if (num < 1 || num > 9) return
        set((state) => {
          // If this node already has this number, clear it (toggle behavior)
          if (state.numberedBookmarks[num] === nodeId) {
            state.numberedBookmarks[num] = null
          } else {
            // Clear any existing bookmark for this node on other numbers
            for (let i = 1; i <= 9; i++) {
              if (state.numberedBookmarks[i] === nodeId) {
                state.numberedBookmarks[i] = null
              }
            }
            state.numberedBookmarks[num] = nodeId
          }
        })
      },

      clearNumberedBookmark: (num) => {
        if (num < 1 || num > 9) return
        set((state) => {
          state.numberedBookmarks[num] = null
        })
      },

      getNumberedBookmarkNodeId: (num) => {
        return get().numberedBookmarks[num] ?? null
      },

      reorderLayers: (nodeIds, targetIndex) => {
        set((state) => {
          const currentOrder = state.nodes.map(n => n.id)
          const draggedSet = new Set(nodeIds)
          // Count how many dragged items were before targetIndex in original order
          let adjustment = 0
          for (let i = 0; i < Math.min(targetIndex, currentOrder.length); i++) {
            if (draggedSet.has(currentOrder[i]!)) adjustment++
          }
          const remaining = currentOrder.filter(id => !draggedSet.has(id))
          const insertAt = Math.min(targetIndex - adjustment, remaining.length)
          remaining.splice(insertAt, 0, ...nodeIds)
          state.manualLayerOrder = remaining
          state.layersSortMode = 'manual'

          // Sync z-index with layer order (top of list = highest z-index)
          // This makes the Outline panel the source of truth for canvas z-order
          const zIndexUpdates: Array<{ nodeId: string; before: number; after: number }> = []
          remaining.forEach((id, index) => {
            const node = state.nodes.find(n => n.id === id)
            if (node) {
              const newZIndex = remaining.length - index // Top of list = highest z
              const oldZIndex = node.zIndex || 0
              if (oldZIndex !== newZIndex) {
                zIndexUpdates.push({ nodeId: id, before: oldZIndex, after: newZIndex })
                node.zIndex = newZIndex
              }
            }
          })

          // Add to undo history if z-indices changed
          if (zIndexUpdates.length > 0) {
            state.isDirty = true
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push({
              type: 'REORDER_LAYERS',
              updates: zIndexUpdates
            } as HistoryAction)
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
      },

      moveNodesForward: (nodeIds) => {
        if (nodeIds.length === 0) return

        const state = get()
        // Get current layer order (or default to nodes array order)
        const currentOrder = state.manualLayerOrder ?? state.nodes.map(n => n.id)

        // Find the highest index among selected nodes
        let maxIndex = -1
        for (const id of nodeIds) {
          const index = currentOrder.indexOf(id)
          if (index > maxIndex) maxIndex = index
        }

        // If already at the top (index 0), can't go forward
        if (maxIndex === 0) return

        // Move all selected nodes one position forward (toward index 0 = higher z-index)
        const targetIndex = Math.max(0, maxIndex - 1)
        get().reorderLayers(nodeIds, targetIndex)
      },

      moveNodesBackward: (nodeIds) => {
        if (nodeIds.length === 0) return

        const state = get()
        // Get current layer order (or default to nodes array order)
        const currentOrder = state.manualLayerOrder ?? state.nodes.map(n => n.id)

        // Find the lowest index among selected nodes
        let minIndex = currentOrder.length
        for (const id of nodeIds) {
          const index = currentOrder.indexOf(id)
          if (index !== -1 && index < minIndex) minIndex = index
        }

        // If already at the bottom (last index), can't go backward
        if (minIndex >= currentOrder.length - 1) return

        // Move all selected nodes one position backward (away from index 0 = lower z-index)
        const targetIndex = Math.min(currentOrder.length - 1, minIndex + 2)
        get().reorderLayers(nodeIds, targetIndex)
      },

      // ---------------------------------------------------------------------
      // Extraction Actions
      // ---------------------------------------------------------------------

      addPendingExtraction: (extraction) => {
        const id = uuid()
        set((state) => {
          state.pendingExtractions.push({
            ...extraction,
            id,
            status: 'pending',
            createdAt: Date.now()
          })
        })
      },

      acceptExtraction: (extractionId, position) => {
        const state = get()
        const extraction = state.pendingExtractions.find((e) => e.id === extractionId)
        if (!extraction) return

        // Find position near source node if not specified
        const sourceNode = state.nodes.find((n) => n.id === extraction.sourceNodeId)
        const finalPosition = position || {
          x: (sourceNode?.position.x || 0) + (sourceNode?.width || 300) + 50,
          y: sourceNode?.position.y || 0
        }

        // Create the node
        const nodeId = get().addNode(extraction.type, finalPosition)

        // Update node with suggested data
        const suggestedData = extraction.suggestedData
        if (extraction.type === 'note') {
          get().updateNode(nodeId, {
            title: suggestedData.title || 'Extracted Note',
            content: (suggestedData as Partial<NoteNodeData>).content || '',
            tags: suggestedData.tags
          } as Partial<NoteNodeData>)
        } else if (extraction.type === 'task') {
          get().updateNode(nodeId, {
            title: suggestedData.title || 'Extracted Task',
            description: (suggestedData as Partial<TaskNodeData>).description || '',
            priority: (suggestedData as Partial<TaskNodeData>).priority || 'none',
            status: 'todo',
            tags: suggestedData.tags
          } as Partial<TaskNodeData>)
        }

        // Create edge from source to new node
        if (extraction.sourceNodeId) {
          get().addEdge({
            source: extraction.sourceNodeId,
            target: nodeId,
            sourceHandle: 'bottom-source',
            targetHandle: 'top-target'
          })
          // Update edge label to 'extracted'
          const edgeId = `${extraction.sourceNodeId}-${nodeId}`
          get().updateEdge(edgeId, { label: 'extracted' })
        }

        // Record extracted title to avoid duplicates
        get().addExtractedTitle(extraction.sourceNodeId, suggestedData.title || '')

        // Remove from pending
        set((state) => {
          state.pendingExtractions = state.pendingExtractions.filter(
            (e) => e.id !== extractionId
          )
        })
      },

      editExtraction: (extractionId, data) => {
        set((state) => {
          const extraction = state.pendingExtractions.find((e) => e.id === extractionId)
          if (extraction) {
            extraction.suggestedData = { ...extraction.suggestedData, ...data }
            extraction.status = 'edited'
          }
        })
      },

      dismissExtraction: (extractionId) => {
        set((state) => {
          state.pendingExtractions = state.pendingExtractions.filter(
            (e) => e.id !== extractionId
          )
        })
      },

      clearAllExtractions: (sourceNodeId) => {
        set((state) => {
          if (sourceNodeId) {
            state.pendingExtractions = state.pendingExtractions.filter(
              (e) => e.sourceNodeId !== sourceNodeId
            )
          } else {
            state.pendingExtractions = []
          }
        })
      },

      setExtractionSourceFilter: (nodeId) => {
        set((state) => {
          state.extractionSourceFilter = nodeId
        })
      },

      setIsExtracting: (nodeId) => {
        set((state) => {
          state.isExtracting = nodeId
        })
      },

      // Visual Feedback Actions
      setStreaming: (nodeId, isStreaming) => {
        set((state) => {
          if (isStreaming) {
            state.streamingConversations.add(nodeId)
          } else {
            state.streamingConversations.delete(nodeId)
          }
        })
      },

      updateExtractionSettings: (nodeId, settings) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            convData.extractionSettings = {
              ...(convData.extractionSettings || DEFAULT_EXTRACTION_SETTINGS),
              ...settings
            }
            state.isDirty = true
          }
        })
      },

      addExtractedTitle: (nodeId, title) => {
        if (!title) return
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            if (!convData.extractedTitles) {
              convData.extractedTitles = []
            }
            if (!convData.extractedTitles.includes(title)) {
              convData.extractedTitles.push(title)
            }
          }
        })
      },

      // ---------------------------------------------------------------------
      // Spatial Extraction System Actions
      // ---------------------------------------------------------------------

      openExtractionPanel: (nodeId) => {
        set((state) => {
          state.openExtractionPanelNodeId = nodeId
        })
      },

      closeExtractionPanel: () => {
        set((state) => {
          state.openExtractionPanelNodeId = null
        })
      },

      startExtractionDrag: (extractionId, position) => {
        const state = get()
        const extraction = state.pendingExtractions.find((e) => e.id === extractionId)
        if (!extraction) return

        set((state) => {
          state.extractionDrag = {
            extractionId,
            position,
            type: extraction.type ?? 'note',
            title: extraction.suggestedData.title ?? 'Untitled'
          }
        })
      },

      updateExtractionDragPosition: (position) => {
        set((state) => {
          if (state.extractionDrag) {
            state.extractionDrag.position = position
          }
        })
      },

      dropExtraction: (flowPosition) => {
        const state = get()
        const drag = state.extractionDrag
        if (!drag) return

        const extraction = state.pendingExtractions.find((e) => e.id === drag.extractionId)
        if (!extraction) {
          set((s) => {
            s.extractionDrag = null
          })
          return
        }

        // Create node at drop position
        const nodeId = uuid()
        const edgeId = uuid()

        const newNode =
          extraction.type === 'task'
            ? {
                id: nodeId,
                type: 'task',
                position: flowPosition,
                data: {
                  type: 'task' as const,
                  title: extraction.suggestedData.title,
                  description: extraction.suggestedData.description || extraction.suggestedData.content || '',
                  status: extraction.suggestedData.status || 'todo',
                  priority: extraction.suggestedData.priority || 'medium',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  tags: extraction.suggestedData.tags || [],
                  properties: {}
                }
              }
            : {
                id: nodeId,
                type: 'note',
                position: flowPosition,
                data: {
                  type: 'note' as const,
                  title: extraction.suggestedData.title,
                  content: extraction.suggestedData.content || '',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  tags: extraction.suggestedData.tags || [],
                  properties: {}
                }
              }

        // Create edge from source to new node
        const newEdge = {
          id: edgeId,
          source: extraction.sourceNodeId,
          target: nodeId,
          sourceHandle: 'right-source',
          targetHandle: 'left-target',
          type: 'custom',
          data: { label: 'extracted' }
        }

        set((state) => {
          // Add node and edge
          state.nodes.push(newNode as typeof state.nodes[0])
          state.edges.push(newEdge as typeof state.edges[0])

          // Remove from pending extractions
          state.pendingExtractions = state.pendingExtractions.filter((e) => e.id !== drag.extractionId)

          // Store for undo
          state.lastAcceptedExtraction = {
            extractionData: extraction,
            createdNodeId: nodeId,
            createdEdgeId: edgeId,
            timestamp: Date.now()
          }

          // Clear drag state
          state.extractionDrag = null
          state.isDirty = true

          // Add to spawning nodes for animation
          state.spawningNodeIds.push(nodeId)
        })

        // Clear spawning animation after delay
        setTimeout(() => {
          set((state) => {
            state.spawningNodeIds = state.spawningNodeIds.filter((id) => id !== nodeId)
          })
        }, 500)
      },

      cancelExtractionDrag: () => {
        set((state) => {
          state.extractionDrag = null
        })
      },

      acceptAllExtractions: (sourceNodeId) => {
        const state = get()
        const extractions = state.pendingExtractions.filter((e) => e.sourceNodeId === sourceNodeId)
        if (extractions.length === 0) return

        // Get source node position
        const sourceNode = state.nodes.find((n) => n.id === sourceNodeId)
        if (!sourceNode) return

        const baseX = sourceNode.position.x + (sourceNode.measured?.width || 320) + 50
        const baseY = sourceNode.position.y
        const spacing = 120

        const newNodes: typeof state.nodes = []
        const newEdges: typeof state.edges = []
        const nodeIds: string[] = []

        extractions.forEach((extraction, index) => {
          const nodeId = uuid()
          const edgeId = uuid()
          nodeIds.push(nodeId)

          const position = {
            x: baseX,
            y: baseY + index * spacing
          }

          const newNode =
            extraction.type === 'task'
              ? {
                  id: nodeId,
                  type: 'task',
                  position,
                  data: {
                    type: 'task' as const,
                    title: extraction.suggestedData.title,
                    description: extraction.suggestedData.description || extraction.suggestedData.content || '',
                    status: extraction.suggestedData.status || 'todo',
                    priority: extraction.suggestedData.priority || 'medium',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    tags: extraction.suggestedData.tags || [],
                    properties: {}
                  }
                }
              : {
                  id: nodeId,
                  type: 'note',
                  position,
                  data: {
                    type: 'note' as const,
                    title: extraction.suggestedData.title,
                    content: extraction.suggestedData.content || '',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    tags: extraction.suggestedData.tags || [],
                    properties: {}
                  }
                }

          newNodes.push(newNode as typeof state.nodes[0])
          newEdges.push({
            id: edgeId,
            source: sourceNodeId,
            target: nodeId,
            sourceHandle: 'right-source',
            targetHandle: 'left-target',
            type: 'custom',
            data: { label: 'extracted' }
          } as typeof state.edges[0])
        })

        set((state) => {
          state.nodes.push(...newNodes)
          state.edges.push(...newEdges)
          state.pendingExtractions = state.pendingExtractions.filter((e) => e.sourceNodeId !== sourceNodeId)
          state.spawningNodeIds.push(...nodeIds)
          state.openExtractionPanelNodeId = null
          state.isDirty = true
        })

        // Clear spawning animations
        setTimeout(() => {
          set((state) => {
            state.spawningNodeIds = state.spawningNodeIds.filter((id) => !nodeIds.includes(id))
          })
        }, 500)
      },

      undoLastExtraction: () => {
        const state = get()
        const last = state.lastAcceptedExtraction
        if (!last) return

        // Only allow undo within 10 seconds
        if (Date.now() - last.timestamp > 10000) {
          set((s) => {
            s.lastAcceptedExtraction = null
          })
          return
        }

        set((state) => {
          // Remove the created node and edge
          state.nodes = state.nodes.filter((n) => n.id !== last.createdNodeId)
          state.edges = state.edges.filter((e) => e.id !== last.createdEdgeId)

          // Restore the extraction to pending
          state.pendingExtractions.push(last.extractionData)

          // Clear undo state
          state.lastAcceptedExtraction = null
          state.isDirty = true
        })
      },

      clearUndoExtraction: () => {
        set((state) => {
          state.lastAcceptedExtraction = null
        })
      },

      // ---------------------------------------------------------------------
      // Message Actions
      // ---------------------------------------------------------------------

      addMessage: (nodeId, role, content) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            const newMessage: Message = {
              id: uuid(),
              role,
              content,
              timestamp: Date.now()
            }
            convData.messages.push(newMessage)
            convData.updatedAt = Date.now()

            // Auto-title from first user message
            if (convData.title === 'New Conversation' && role === 'user') {
              convData.title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
            }

            // Record in undo history (only user messages — assistant messages are streaming-generated)
            if (role === 'user') {
              state.history = state.history.slice(0, state.historyIndex + 1)
              state.history.push({ type: 'ADD_MESSAGE', nodeId, message: JSON.parse(JSON.stringify(newMessage)) })
              state.historyIndex++
              if (state.history.length > 100) {
                state.history.shift()
                state.historyIndex--
              }
            }

            state.isDirty = true
          }
        })
      },

      removeLastMessage: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            if (convData.messages.length > 0) {
              const lastMsg = convData.messages[convData.messages.length - 1]
              // Only remove empty assistant messages (placeholders from cancelled streams)
              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === '') {
                convData.messages.pop()
                state.isDirty = true
              }
            }
          }
        })
      },

      deleteMessage: (nodeId, messageIndex) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            if (messageIndex >= 0 && messageIndex < convData.messages.length) {
              const deleted = convData.messages[messageIndex]!
              convData.messages.splice(messageIndex, 1)
              convData.updatedAt = Date.now()
              state.isDirty = true

              // Record in undo history
              state.history = state.history.slice(0, state.historyIndex + 1)
              state.history.push({
                type: 'DELETE_MESSAGE',
                nodeId,
                message: JSON.parse(JSON.stringify(deleted)),
                index: messageIndex
              })
              state.historyIndex++
              if (state.history.length > 100) {
                state.history.shift()
                state.historyIndex--
              }
            }
          }
        })
      },

      updateLastMessage: (nodeId, content) => {
        set((state) => {
          const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId)
          const node = state.nodes[nodeIndex]
          if (nodeIndex === -1 || !node) return

          if (node.data.type !== 'conversation') return

          const convData = node.data as ConversationNodeData
          const lastMessageIndex = convData.messages.length - 1
          if (lastMessageIndex < 0) return

          const lastMessage = convData.messages[lastMessageIndex]
          if (lastMessage?.role !== 'assistant') return

          // Create new message object to trigger React re-render
          const updatedMessage = { ...lastMessage, content }

          // Create new messages array
          const newMessages = [...convData.messages]
          newMessages[lastMessageIndex] = updatedMessage

          // Create new node data
          const newNodeData = {
            ...convData,
            messages: newMessages
          }

          // Create new nodes array
          const newNodes = [...state.nodes]
          newNodes[nodeIndex] = {
            ...node,
            id: node.id, // Ensure id is not undefined
            data: newNodeData
          } as typeof node

          state.nodes = newNodes
        })
      },

      setLastMessageUsage: (nodeId, usage) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (!node || node.data.type !== 'conversation') return
          const convData = node.data as ConversationNodeData
          const lastMsg = convData.messages[convData.messages.length - 1]
          if (!lastMsg || lastMsg.role !== 'assistant') return
          lastMsg.inputTokens = usage.inputTokens
          lastMsg.outputTokens = usage.outputTokens
          lastMsg.costUSD = usage.costUSD
          state.isDirty = true
        })
      },

      addToolMessage: (nodeId, message) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node && node.data.type === 'conversation') {
            const convData = node.data as ConversationNodeData
            convData.messages.push(message)
            convData.updatedAt = Date.now()
            state.isDirty = true
          }
        })
      },

      // ---------------------------------------------------------------------
      // Workspace Actions
      // ---------------------------------------------------------------------

      newWorkspace: () => {
        set((state) => {
          state.workspaceId = uuid()
          state.workspaceName = 'Untitled Workspace'
          state.nodes = []
          state.edges = []
          state.viewport = { x: 0, y: 0, zoom: 1 }
          state.propertySchema = { ...DEFAULT_PROPERTY_SCHEMA }
          state.contextSettings = { ...DEFAULT_CONTEXT_SETTINGS }
          state.themeSettings = { ...DEFAULT_THEME_SETTINGS }
          state.workspacePreferences = { ...DEFAULT_WORKSPACE_PREFERENCES }
          state.selectedNodeIds = []
          state.selectedEdgeIds = []
          state.activePanel = 'none'
          state.activeChatNodeId = null
          state.openChatNodeIds = []
          state.pinnedWindows = []
          state.nextPinnedZIndex = 1
          state.hiddenNodeTypes = new Set()
          state.history = []
          state.historyIndex = -1
          state.isDirty = false
          state.createdAt = Date.now()
          state.lastSaved = null
        })
      },

      loadWorkspace: (data) => {
        // Migrate nodes to use properties system
        const migratedNodes = migrateWorkspaceNodes(data.nodes)

        // Migrate edges to include EdgeData and custom type if missing
        // Also sanitize handles: sourceHandle must end with -source, targetHandle with -target
        // And migrate legacy weight-based edges to strength-based edges
        const migratedEdges: Edge<EdgeData>[] = data.edges.map((edge) => {
          let { sourceHandle, targetHandle } = edge

          // Fix swapped handles (e.g., from reversed edges)
          if (sourceHandle?.includes('-target')) {
            sourceHandle = sourceHandle.replace('-target', '-source')
          }
          if (targetHandle?.includes('-source')) {
            targetHandle = targetHandle.replace('-source', '-target')
          }

          // Ensure edge has EdgeData, applying defaults if missing
          const edgeData = edge.data || { ...DEFAULT_EDGE_DATA }

          // Migrate legacy weight to strength if needed
          const migratedData = migrateEdgeStrength(edgeData)

          return {
            ...edge,
            sourceHandle,
            targetHandle,
            type: edge.type || 'custom',
            data: migratedData
          }
        })

        // Prepare valid node IDs set for session restoration
        const validNodeIds = new Set(migratedNodes.map(n => n.id))

        set((state) => {
          state.workspaceId = data.id
          state.workspaceName = data.name
          state.nodes = migratedNodes
          state.edges = migratedEdges
          state.viewport = data.viewport
          state.propertySchema = data.propertySchema || { ...DEFAULT_PROPERTY_SCHEMA }
          state.contextSettings = data.contextSettings || { ...DEFAULT_CONTEXT_SETTINGS }
          const savedTheme = data.themeSettings || {}
          state.themeSettings = {
            ...DEFAULT_THEME_SETTINGS,
            ...savedTheme,
            nodeColors: {
              ...DEFAULT_THEME_SETTINGS.nodeColors,
              ...(savedTheme.nodeColors || {})
            },
            linkColors: {
              ...DEFAULT_THEME_SETTINGS.linkColors,
              ...(savedTheme.linkColors || {})
            },
            linkColorsDark: {
              ...DEFAULT_THEME_SETTINGS.linkColorsDark,
              ...(savedTheme.linkColorsDark || {})
            },
            linkColorsLight: {
              ...DEFAULT_THEME_SETTINGS.linkColorsLight,
              ...(savedTheme.linkColorsLight || {})
            }
          }

          // Migrate legacy ambient effect settings (pre-React Bits era)
          // Old format had: intensity, speed, density, scale, cursorInteraction, nodeInteraction, targetFps
          // New format uses: effectProps (per-effect native props)
          if (state.themeSettings.ambientEffect) {
            const ae = state.themeSettings.ambientEffect as Record<string, unknown>
            const hasLegacyProps = 'intensity' in ae || 'speed' in ae || 'density' in ae || 'cursorInteraction' in ae
            if (hasLegacyProps) {
              state.themeSettings.ambientEffect = {
                enabled: ae.enabled as boolean ?? false,
                effect: 'none',  // Old effect types no longer exist
                bloomIntensity: ae.bloomIntensity as number ?? 30,
                effectProps: {},
              }
            }
            // Ensure effectProps exists even on non-legacy workspaces
            if (!state.themeSettings.ambientEffect.effectProps) {
              state.themeSettings.ambientEffect.effectProps = {}
            }
          }

          state.workspacePreferences = { ...DEFAULT_WORKSPACE_PREFERENCES, ...(data.workspacePreferences || {}) }
          state.layersSortMode = data.layersSortMode || 'hierarchy'
          state.manualLayerOrder = data.manualLayerOrder || null
          state.syncMode = data.syncMode || 'local'

          // Session state restoration (ND feature - "where was I?")
          const session = data.sessionState
          if (session) {
            // Restore selection, filtering out deleted nodes
            const validSelection = (session.selectedNodeIds || []).filter(id => validNodeIds.has(id))
            state.selectedNodeIds = validSelection
            // Mark selected nodes
            migratedNodes.forEach(n => { n.selected = validSelection.includes(n.id) })

            // Restore sidebar state
            state.leftSidebarOpen = session.leftSidebarOpen ?? false
            state.leftSidebarTab = session.leftSidebarTab ?? 'layers'

            // Restore expanded nodes, filtering out deleted nodes
            const validExpanded = (session.expandedNodeIds || []).filter(id => validNodeIds.has(id))
            state.expandedNodeIds = new Set(validExpanded)
          } else {
            state.selectedNodeIds = []
            state.leftSidebarOpen = false
            state.leftSidebarTab = 'layers'
            state.expandedNodeIds = new Set()
          }

          // Restore hidden node types (Issue 14 fix: Set serialized as array)
          state.hiddenNodeTypes = new Set((data as Record<string, unknown>).hiddenNodeTypes as string[] || [])

          state.selectedEdgeIds = []
          state.activePanel = 'none'
          state.activeChatNodeId = null
          state.openChatNodeIds = []
          state.pinnedWindows = []
          state.nextPinnedZIndex = 1
          state.history = []
          state.historyIndex = -1
          state.isDirty = false
          state.createdAt = data.createdAt || data.updatedAt || Date.now()
          state.lastSaved = data.updatedAt
          state.isLoading = false
        })

        // Invalidate BFS context cache on workspace load (Optimization #9)
        invalidateContextCache()

        // Restore spatial regions
        useSpatialRegionStore.getState().loadRegions(data.spatialRegions || [])
      },

      getWorkspaceData: () => {
        const state = get()
        const spatialRegions = useSpatialRegionStore.getState().regions
        return {
          id: state.workspaceId || uuid(),
          name: state.workspaceName,
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          propertySchema: state.propertySchema,
          contextSettings: state.contextSettings,
          themeSettings: state.themeSettings,
          workspacePreferences: state.workspacePreferences,
          layersSortMode: state.layersSortMode,
          manualLayerOrder: state.manualLayerOrder,
          spatialRegions: spatialRegions.length > 0 ? spatialRegions : undefined,
          syncMode: state.syncMode !== 'local' ? state.syncMode : undefined,
          // Session state restoration (ND feature)
          sessionState: {
            selectedNodeIds: state.selectedNodeIds.length > 0 ? state.selectedNodeIds : undefined,
            leftSidebarOpen: state.leftSidebarOpen || undefined,
            leftSidebarTab: state.leftSidebarTab !== 'layers' ? state.leftSidebarTab : undefined,
            expandedNodeIds: state.expandedNodeIds.size > 0 ? Array.from(state.expandedNodeIds) : undefined
          },
          hiddenNodeTypes: state.hiddenNodeTypes.size > 0 ? Array.from(state.hiddenNodeTypes) : undefined,
          createdAt: state.createdAt || Date.now(),
          updatedAt: Date.now(),
          version: 1
        }
      },

      updateWorkspaceName: (name) => {
        set((state) => {
          state.workspaceName = name
          state.isDirty = true
        })
      },

      setViewport: (viewport) => {
        set((state) => {
          state.viewport = viewport
        })
      },

      markDirty: () => {
        set((state) => {
          state.isDirty = true
          state.saveStatus = 'unsaved'
        })
      },

      markClean: () => {
        set((state) => {
          state.isDirty = false
          state.lastSaved = Date.now()
          state.saveStatus = 'saved'
        })
      },

      setSaveStatus: (status) => {
        set((state) => {
          state.saveStatus = status
          // Sync isDirty for consistency
          if (status === 'saved') {
            state.isDirty = false
          } else if (status === 'unsaved') {
            state.isDirty = true
          }
        })
      },

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

      // ---------------------------------------------------------------------
      // History Actions (Undo/Redo)
      // ---------------------------------------------------------------------

      undo: () => {
        const { history, historyIndex } = get()
        if (historyIndex < 0) return

        const action = history[historyIndex]
        if (!action) return

        set((state) => {
          const applyUndo = (act: HistoryAction): void => {
            switch (act.type) {
              case 'ADD_NODE':
                state.nodes = state.nodes.filter((n) => n.id !== act.node.id)
                break
              case 'DELETE_NODE':
                state.nodes.push(JSON.parse(JSON.stringify(act.node)))
                break
              case 'UPDATE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) {
                  // Clear existing properties and restore before state
                  // (Object.assign alone doesn't remove newly-added properties)
                  Object.keys(node.data).forEach((key) => delete (node.data as Record<string, unknown>)[key])
                  Object.assign(node.data, act.before)
                  // Also restore React Flow node type if data.type changed (e.g. changeNodeType)
                  if (act.before.type && node.type !== act.before.type) {
                    node.type = act.before.type
                  }
                }
                break
              }
              case 'BULK_UPDATE_NODES': {
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) {
                    // Clear existing properties and restore before state
                    // (Object.assign alone doesn't remove newly-added properties)
                    Object.keys(node.data).forEach((key) => delete (node.data as Record<string, unknown>)[key])
                    Object.assign(node.data, update.before)
                  }
                }
                break
              }
              case 'ALIGN_NODES':
              case 'DISTRIBUTE_NODES':
              case 'SNAP_TO_GRID':
              case 'ARRANGE_GRID': {
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) node.position = update.before
                }
                break
              }
              case 'MOVE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) node.position = act.before
                break
              }
              case 'RESIZE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) {
                  node.width = act.before.width
                  node.height = act.before.height
                  ;(node.data as { width?: number; height?: number }).width = act.before.width
                  ;(node.data as { width?: number; height?: number }).height = act.before.height
                }
                break
              }
              case 'ADD_EDGE':
                state.edges = state.edges.filter((e) => e.id !== act.edge.id)
                break
              case 'DELETE_EDGE':
                state.edges.push(JSON.parse(JSON.stringify(act.edge)))
                break
              case 'UPDATE_EDGE': {
                const edge = state.edges.find((e) => e.id === act.edgeId)
                if (edge && edge.data) {
                  Object.assign(edge.data, act.before)
                }
                break
              }
              case 'REVERSE_EDGE': {
                // Restore the original edge
                const edgeIndex = state.edges.findIndex((e) => e.id === act.after.id)
                if (edgeIndex !== -1) {
                  state.edges[edgeIndex] = JSON.parse(JSON.stringify(act.before))
                }
                break
              }
              case 'REORDER_LAYERS': {
                // Restore previous z-index values
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) node.zIndex = update.before
                }
                break
              }
              case 'ADD_MESSAGE': {
                // Undo add = remove the message
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node && node.data.type === 'conversation') {
                  const convData = node.data as ConversationNodeData
                  convData.messages = convData.messages.filter((m) => m.id !== act.message.id)
                }
                break
              }
              case 'DELETE_MESSAGE': {
                // Undo delete = re-insert the message at its original index
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node && node.data.type === 'conversation') {
                  const convData = node.data as ConversationNodeData
                  convData.messages.splice(act.index, 0, JSON.parse(JSON.stringify(act.message)))
                }
                break
              }
              case 'BATCH':
                // Undo in reverse order
                ;[...act.actions].reverse().forEach(applyUndo)
                break
            }
          }

          applyUndo(action)
          state.historyIndex--
          state.isDirty = true
        })
      },

      redo: () => {
        const { history, historyIndex } = get()
        if (historyIndex >= history.length - 1) return

        const action = history[historyIndex + 1]
        if (!action) return

        set((state) => {
          const applyRedo = (act: HistoryAction): void => {
            switch (act.type) {
              case 'ADD_NODE':
                state.nodes.push(JSON.parse(JSON.stringify(act.node)))
                break
              case 'DELETE_NODE':
                state.nodes = state.nodes.filter((n) => n.id !== act.node.id)
                break
              case 'UPDATE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) {
                  Object.assign(node.data, act.after)
                  // Also restore React Flow node type if data.type changed (e.g. changeNodeType)
                  if (act.after.type && node.type !== act.after.type) {
                    node.type = act.after.type
                  }
                }
                break
              }
              case 'BULK_UPDATE_NODES': {
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) Object.assign(node.data, update.after)
                }
                break
              }
              case 'ALIGN_NODES':
              case 'DISTRIBUTE_NODES':
              case 'SNAP_TO_GRID':
              case 'ARRANGE_GRID': {
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) node.position = update.after
                }
                break
              }
              case 'MOVE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) node.position = act.after
                break
              }
              case 'RESIZE_NODE': {
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node) {
                  node.width = act.after.width
                  node.height = act.after.height
                  ;(node.data as { width?: number; height?: number }).width = act.after.width
                  ;(node.data as { width?: number; height?: number }).height = act.after.height
                }
                break
              }
              case 'ADD_EDGE':
                state.edges.push(JSON.parse(JSON.stringify(act.edge)))
                break
              case 'DELETE_EDGE':
                state.edges = state.edges.filter((e) => e.id !== act.edge.id)
                break
              case 'UPDATE_EDGE': {
                const edge = state.edges.find((e) => e.id === act.edgeId)
                if (edge && edge.data) {
                  Object.assign(edge.data, act.after)
                }
                break
              }
              case 'REVERSE_EDGE': {
                // Re-apply the reversed edge
                const edgeIndex = state.edges.findIndex((e) => e.id === act.before.id)
                if (edgeIndex !== -1) {
                  state.edges[edgeIndex] = JSON.parse(JSON.stringify(act.after))
                }
                break
              }
              case 'REORDER_LAYERS': {
                // Re-apply new z-index values
                for (const update of act.updates) {
                  const node = state.nodes.find((n) => n.id === update.nodeId)
                  if (node) node.zIndex = update.after
                }
                break
              }
              case 'ADD_MESSAGE': {
                // Redo add = re-insert the message
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node && node.data.type === 'conversation') {
                  const convData = node.data as ConversationNodeData
                  convData.messages.push(JSON.parse(JSON.stringify(act.message)))
                }
                break
              }
              case 'DELETE_MESSAGE': {
                // Redo delete = remove the message again
                const node = state.nodes.find((n) => n.id === act.nodeId)
                if (node && node.data.type === 'conversation') {
                  const convData = node.data as ConversationNodeData
                  convData.messages = convData.messages.filter((m) => m.id !== act.message.id)
                }
                break
              }
              case 'BATCH':
                act.actions.forEach(applyRedo)
                break
            }
          }

          applyRedo(action)
          state.historyIndex++
          state.isDirty = true
        })
      },

      canUndo: () => {
        return get().historyIndex >= 0
      },

      canRedo: () => {
        const { history, historyIndex } = get()
        return historyIndex < history.length - 1
      },

      startNodeDrag: (nodeIds) => {
        set((state) => {
          nodeIds.forEach((nodeId) => {
            const node = state.nodes.find((n) => n.id === nodeId)
            if (node) {
              state.dragStartPositions.set(nodeId, { x: node.position.x, y: node.position.y })
            }
          })
        })
      },

      commitNodeDrag: (nodeIds) => {
        set((state) => {
          const actions: HistoryAction[] = []
          nodeIds.forEach((nodeId) => {
            const before = state.dragStartPositions.get(nodeId)
            const node = state.nodes.find((n) => n.id === nodeId)
            if (before && node && (before.x !== node.position.x || before.y !== node.position.y)) {
              actions.push({
                type: 'MOVE_NODE',
                nodeId,
                before,
                after: { x: node.position.x, y: node.position.y }
              })
            }
          })
          state.dragStartPositions.clear()

          if (actions.length > 0) {
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push(actions.length === 1 ? actions[0]! : { type: 'BATCH', actions })
            state.historyIndex++
            if (state.history.length > 100) {
              state.history = state.history.slice(-100)
              state.historyIndex = state.history.length - 1
            }
          }
        })
      },

      startNodeResize: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (node) {
            const width = (node.data as { width?: number }).width || node.width || 280
            const height = (node.data as { height?: number }).height || node.height || 120
            state.resizeStartDimensions.set(nodeId, { width, height })
          }
        })
      },

      commitNodeResize: (nodeId) => {
        set((state) => {
          const before = state.resizeStartDimensions.get(nodeId)
          const node = state.nodes.find((n) => n.id === nodeId)
          if (before && node) {
            const width = (node.data as { width?: number }).width || node.width || 280
            const height = (node.data as { height?: number }).height || node.height || 120
            if (before.width !== width || before.height !== height) {
              state.history = state.history.slice(0, state.historyIndex + 1)
              state.history.push({
                type: 'RESIZE_NODE',
                nodeId,
                before,
                after: { width, height }
              })
              state.historyIndex++
              if (state.history.length > 100) {
                state.history = state.history.slice(-100)
                state.historyIndex = state.history.length - 1
              }
            }
          }
          state.resizeStartDimensions.delete(nodeId)
        })
      },

      // ---------------------------------------------------------------------
      // Context Actions
      // ---------------------------------------------------------------------

      getConnectedNodes: (nodeId) => {
        const { nodes, edges } = get()
        const connectedIds = new Set<string>()

        edges.forEach((edge) => {
          if (edge.source === nodeId) connectedIds.add(edge.target)
          if (edge.target === nodeId) connectedIds.add(edge.source)
        })

        return nodes.filter((n) => connectedIds.has(n.id))
      },

      getContextForNode: (nodeId) => {
        const { nodes, edges, contextSettings } = get()
        const maxDepth = contextSettings.globalDepth

        // Use context BFS cache (Optimization #9) to avoid redundant traversals.
        // Cache invalidates when graph structure changes. The hash includes:
        // - Node/edge counts + lastSaved timestamp (structural changes)
        // - workspaceId (workspace switches)
        // - historyIndex (mutations via undo/redo-tracked actions)
        // - Node ID fingerprint (structural additions/removals)
        // - Edge structure fingerprint (connection changes)
        // - Context depth (settings changes)
        //
        // Performance: At 500 nodes, hash computation is O(n) string joins (~0.01ms),
        // while BFS traversal is O(n*d) with 5-20ms per call. Cache saves 10-50x BFS calls.
        const { workspaceId, historyIndex, isDirty } = get()
        // Include node IDs and a content hint (first 20 chars of title) to detect content changes
        const nodeFingerprint = nodes.map(n => {
          const title = (n.data as { title?: string }).title || ''
          const content = (n.data as { content?: string }).content || ''
          return `${n.id}:${title.slice(0, 20)}:${content.length}`
        }).join(',')
        const edgeFingerprint = edges.map(e => `${e.source}>${e.target}:${e.data?.active !== false ? '1' : '0'}:${e.data?.direction || 'd'}:${e.data?.strength || 'n'}`).join(',')
        const graphHash = [
          computeGraphHash(nodes.length, edges.length, get().lastSaved || 0),
          workspaceId || '',
          historyIndex,
          isDirty ? '1' : '0',
          maxDepth,
          nodeFingerprint,
          edgeFingerprint
        ].join('|')
        return getCachedContext(nodeId, graphHash, () => {

        // BFS traversal to collect context nodes
        interface TraversalNode {
          node: Node<NodeData>
          depth: number
          strengthPriority: number // 3=strong, 2=normal, 1=light
          path: string[] // for cycle detection
        }

        // Derive numeric priority from edge strength (uses migrateEdgeStrength for legacy weight)
        const getEdgeStrengthPriority = (edge: Edge<EdgeData>): number => {
          const migrated = edge.data ? migrateEdgeStrength(edge.data) : null
          switch (migrated?.strength) {
            case 'strong': return 3
            case 'normal': return 2
            case 'light': return 1
            default: return 2
          }
        }

        const visited = new Set<string>()
        const result: TraversalNode[] = []
        const queue: TraversalNode[] = []

        // Get initial connected nodes (only INBOUND edges provide context)
        const getInboundEdges = (targetId: string) =>
          edges.filter((e) => {
            if (e.target !== targetId) return false
            if (e.data?.active === false) return false // Skip inactive edges
            return true
          })

        // Also consider bidirectional edges where this node is the source
        const getBidirectionalEdges = (targetId: string) =>
          edges.filter((e) => {
            if (e.source !== targetId) return false
            if (e.data?.active === false) return false
            if (e.data?.direction !== 'bidirectional') return false
            return true
          })

        // Seed the queue with depth-1 nodes
        const initialInbound = getInboundEdges(nodeId)
        const initialBidirectional = getBidirectionalEdges(nodeId)

        initialInbound.forEach((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source)
          if (sourceNode && sourceNode.data.includeInContext !== false) {
            queue.push({
              node: sourceNode,
              depth: 1,
              strengthPriority: getEdgeStrengthPriority(edge),
              path: [nodeId, sourceNode.id]
            })
          }
        })

        initialBidirectional.forEach((edge) => {
          const targetNode = nodes.find((n) => n.id === edge.target)
          if (targetNode && targetNode.data.includeInContext !== false && !visited.has(edge.target)) {
            queue.push({
              node: targetNode,
              depth: 1,
              strengthPriority: getEdgeStrengthPriority(edge),
              path: [nodeId, targetNode.id]
            })
          }
        })

        // BFS traversal
        while (queue.length > 0) {
          const current = queue.shift()!

          if (visited.has(current.node.id)) continue
          if (current.depth > maxDepth) continue

          visited.add(current.node.id)
          result.push(current)

          // Continue traversal for next depth (only if within depth limit)
          if (current.depth < maxDepth) {
            const nextInbound = getInboundEdges(current.node.id)
            const nextBidirectional = getBidirectionalEdges(current.node.id)

            nextInbound.forEach((edge) => {
              if (!visited.has(edge.source) && !current.path.includes(edge.source)) {
                const sourceNode = nodes.find((n) => n.id === edge.source)
                if (sourceNode && sourceNode.data.includeInContext !== false) {
                  queue.push({
                    node: sourceNode,
                    depth: current.depth + 1,
                    strengthPriority: getEdgeStrengthPriority(edge),
                    path: [...current.path, sourceNode.id]
                  })
                }
              }
            })

            nextBidirectional.forEach((edge) => {
              if (!visited.has(edge.target) && !current.path.includes(edge.target)) {
                const targetNode = nodes.find((n) => n.id === edge.target)
                if (targetNode && targetNode.data.includeInContext !== false) {
                  queue.push({
                    node: targetNode,
                    depth: current.depth + 1,
                    strengthPriority: getEdgeStrengthPriority(edge),
                    path: [...current.path, targetNode.id]
                  })
                }
              }
            })
          }
        }

        // Node type priority for sorting
        const getTypePriority = (node: Node<NodeData>): number => {
          const priorities: Record<string, number> = {
            workspace: 0, // Workspace configuration should come first
            orchestrator: 1, // Controller that provides context
            project: 1,
            note: 2,
            task: 3,
            artifact: 4,
            conversation: 5
          }
          return priorities[node.data.type] ?? 10
        }

        // Sort by: depth (closer first), then strength (higher first), then type priority
        const sortedResult = result.sort((a, b) => {
          if (a.depth !== b.depth) return a.depth - b.depth
          if (a.strengthPriority !== b.strengthPriority) return b.strengthPriority - a.strengthPriority
          return getTypePriority(a.node) - getTypePriority(b.node)
        })

        const contextNodes = sortedResult.map((item) => item.node)

        // Helper to get role label
        const getRoleLabel = (role: string | undefined, defaultRole: string): string => {
          const roleLabels: Record<string, string> = {
            reference: 'Reference',
            instruction: 'INSTRUCTION - Follow this guidance',
            example: 'Example/Template',
            background: 'Background Context',
            scope: 'Project Scope'
          }
          return roleLabels[role || defaultRole] || defaultRole
        }

        // Helper to get relationship label
        const getRelationshipLabel = (relationship: string | undefined): string => {
          const labels: Record<string, string> = {
            'depends-on': 'depends on',
            'related-to': 'related to',
            'implements': 'implements',
            'references': 'references',
            'blocks': 'blocks/blocked by'
          }
          return labels[relationship || ''] || ''
        }

        // Context nodes are already sorted by depth, strength, and type from BFS
        // Additionally sort by contextPriority within the same depth/strength/type
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        const finalSortedNodes = [...contextNodes].sort((a, b) => {
          const aPriority = (a.data as { contextPriority?: string }).contextPriority || 'medium'
          const bPriority = (b.data as { contextPriority?: string }).contextPriority || 'medium'
          return (priorityOrder[aPriority as keyof typeof priorityOrder] || 1) -
                 (priorityOrder[bPriority as keyof typeof priorityOrder] || 1)
        })

        const contextParts: string[] = []

        finalSortedNodes.forEach((node) => {
          const nodeData = node.data as {
            contextLabel?: string
            contextRole?: string
            contextPriority?: string
            tags?: string[]
            summary?: string
            keyEntities?: string[]
            relationshipType?: string
          }
          const customLabel = nodeData.contextLabel
          const priority = nodeData.contextPriority || 'medium'
          const priorityMarker = priority === 'high' ? ' [HIGH PRIORITY]' : ''

          // Build metadata section
          const metaParts: string[] = []
          const nodeTags = ((nodeData as Record<string, unknown>).properties as Record<string, unknown> | undefined)?.tags as string[] | undefined || nodeData.tags
          if (nodeTags && nodeTags.length > 0) {
            metaParts.push(`Tags: ${nodeTags.join(', ')}`)
          }
          if (nodeData.keyEntities && nodeData.keyEntities.length > 0) {
            metaParts.push(`Key concepts: ${nodeData.keyEntities.join(', ')}`)
          }
          if (nodeData.relationshipType) {
            metaParts.push(`Relationship: ${getRelationshipLabel(nodeData.relationshipType)}`)
          }
          const metaBlock = metaParts.length > 0 ? `\nMetadata: ${metaParts.join(' | ')}` : ''

          switch (node.data.type) {
            case 'note': {
              const noteData = node.data as NoteNodeData
              if (noteData.content) {
                const role = getRoleLabel(nodeData.contextRole, 'Reference')
                const label = customLabel || noteData.title
                const summary = nodeData.summary ? `\nSummary: ${nodeData.summary}` : ''
                contextParts.push(`[${role}: ${label}]${priorityMarker}${metaBlock}${summary}\n${noteData.content}`)
              }
              break
            }
            case 'project': {
              const projectData = node.data as ProjectNodeData
              if (projectData.description) {
                const role = getRoleLabel(nodeData.contextRole, 'Project Scope')
                const label = customLabel || projectData.title
                const summary = nodeData.summary ? `\nSummary: ${nodeData.summary}` : ''
                const childCount = projectData.childNodeIds.length
                const childInfo = childCount > 0 ? `\nContains ${childCount} items` : ''
                contextParts.push(`[${role}: ${label}]${priorityMarker}${metaBlock}${summary}${childInfo}\n${projectData.description}`)
              }
              break
            }
            case 'task': {
              const taskData = node.data as TaskNodeData
              const dueInfo = taskData.dueDate ? `\nDue: ${new Date(taskData.dueDate).toLocaleDateString()}` : ''
              contextParts.push(
                `[Task: ${taskData.title}]${metaBlock}\nStatus: ${taskData.status}\nPriority: ${taskData.priority}${dueInfo}\n${taskData.description || ''}`
              )
              break
            }
            case 'conversation': {
              const convData = node.data as ConversationNodeData
              const recentMessages = convData.messages.slice(-5)
              if (recentMessages.length > 0) {
                const msgText = recentMessages.map((m) => `${m.role}: ${m.content}`).join('\n')
                contextParts.push(`[Related Conversation: ${convData.title}]${metaBlock}\nProvider: ${convData.provider}\n${msgText}`)
              }
              break
            }
            case 'artifact': {
              const artifactData = node.data as ArtifactNodeData
              const format = artifactData.injectionFormat || 'full'
              let injectedContent: string

              switch (format) {
                case 'full':
                  injectedContent = artifactData.content
                  break
                case 'summary':
                  injectedContent = nodeData.summary || `[${artifactData.contentType} artifact: ${artifactData.title}]`
                  break
                case 'chunked':
                  // Truncate to maxInjectionTokens (rough estimate: 4 chars per token)
                  const maxChars = (artifactData.maxInjectionTokens || 2000) * 4
                  injectedContent = artifactData.content.length > maxChars
                    ? artifactData.content.slice(0, maxChars) + '\n[...truncated]'
                    : artifactData.content
                  break
                case 'reference-only':
                  injectedContent = `[Reference: ${artifactData.title} (${artifactData.contentType})]`
                  break
                default:
                  injectedContent = artifactData.content
              }

              const role = getRoleLabel(nodeData.contextRole, 'Artifact')
              const label = customLabel || artifactData.title
              const langInfo = artifactData.language ? ` (${artifactData.language})` : ''
              contextParts.push(`[${role}: ${label}]${langInfo}${priorityMarker}${metaBlock}\n${injectedContent}`)
              break
            }
            case 'workspace': {
              const wsData = node.data as WorkspaceNodeData
              const role = getRoleLabel(nodeData.contextRole, 'Workspace Configuration')
              const label = customLabel || wsData.title
              const summary = nodeData.summary ? `\nSummary: ${nodeData.summary}` : ''
              const memberCount = wsData.includedNodeIds?.length || 0
              const memberInfo = memberCount > 0 ? `\nMembers: ${memberCount} nodes included` : ''

              // Include LLM settings if configured
              const llmInfo: string[] = []
              if (wsData.llmSettings?.provider) {
                llmInfo.push(`Provider: ${wsData.llmSettings.provider}`)
              }
              if (wsData.llmSettings?.model) {
                llmInfo.push(`Model: ${wsData.llmSettings.model}`)
              }
              if (wsData.llmSettings?.systemPrompt) {
                llmInfo.push(`System instructions: ${wsData.llmSettings.systemPrompt}`)
              }
              const llmBlock = llmInfo.length > 0 ? `\nLLM Configuration: ${llmInfo.join(' | ')}` : ''

              // Include context rules if configured
              const contextInfo: string[] = []
              if (wsData.contextRules?.maxDepth !== undefined) {
                contextInfo.push(`Max context depth: ${wsData.contextRules.maxDepth}`)
              }
              if (wsData.contextRules?.maxTokens !== undefined) {
                contextInfo.push(`Max tokens: ${wsData.contextRules.maxTokens}`)
              }
              if (wsData.contextRules?.traversalMode) {
                contextInfo.push(`Traversal: ${wsData.contextRules.traversalMode}`)
              }
              const contextBlock = contextInfo.length > 0 ? `\nContext rules: ${contextInfo.join(' | ')}` : ''

              contextParts.push(`[${role}: ${label}]${priorityMarker}${metaBlock}${summary}${memberInfo}${llmBlock}${contextBlock}\n${wsData.description || ''}`)
              break
            }
            case 'text': {
              const textData = node.data as TextNodeData
              if (textData.content) {
                const role = getRoleLabel(nodeData.contextRole, 'Text')
                const label = customLabel || 'Text'
                const summary = nodeData.summary ? `\nSummary: ${nodeData.summary}` : ''
                contextParts.push(`[${role}: ${label}]${priorityMarker}${metaBlock}${summary}\n${textData.content}`)
              }
              break
            }
            case 'orchestrator': {
              const orchData = node.data as { title: string; strategy: string; connectedAgents: unknown[]; description?: string }
              const role = getRoleLabel(nodeData.contextRole, 'Orchestrator')
              const label = customLabel || orchData.title
              contextParts.push(`[${role}: ${label}]${priorityMarker}${metaBlock}\nStrategy: ${orchData.strategy}\nAgents: ${orchData.connectedAgents.length}\n${orchData.description || ''}`)
              break
            }
          }

          // Append attachment info if node has attachments (always as separate context part with attribution)
          const attachments = (node.data as { attachments?: { filename: string; mimeType: string; size: number }[] }).attachments
          if (attachments && attachments.length > 0) {
            const attachmentList = attachments.map((a) =>
              `  - ${a.filename} (${a.mimeType}, ${a.size > 1024 ? `${(a.size / 1024).toFixed(0)}KB` : `${a.size}B`})`
            ).join('\n')
            const nodeTitle = (node.data as { title?: string }).title || node.data.type || 'Node'
            contextParts.push(`[Attached files: ${nodeTitle}]\n${attachmentList}`)
          }
        })

        return contextParts.join('\n\n---\n\n')
        }) // end getCachedContext
      },

      // ---------------------------------------------------------------------
      // Theme Actions
      // ---------------------------------------------------------------------

      setThemeMode: (mode) => {
        set((state) => {
          const prevMode = state.themeSettings.mode
          state.themeSettings.mode = mode

          // If on a preset, re-apply preset colors for the new mode
          if (state.themeSettings.currentPresetId) {
            const presetColors = getPresetColors(state.themeSettings.currentPresetId, mode)
            if (presetColors) {
              state.themeSettings.canvasBackground = presetColors.canvasBackground
              state.themeSettings.canvasGridColor = presetColors.canvasGridColor
              state.themeSettings.nodeColors = { ...presetColors.nodeColors }
              // Also apply GUI colors from preset if available
              if (presetColors.guiColors) {
                state.themeSettings.guiColors = presetColors.guiColors
              }
            }
          } else {
            // Custom theme - switch to the stored per-mode canvas colors
            if (mode === 'dark') {
              // Save current colors to light before switching
              if (prevMode === 'light') {
                state.themeSettings.canvasBackgroundLight = state.themeSettings.canvasBackground
                state.themeSettings.canvasGridColorLight = state.themeSettings.canvasGridColor
                state.themeSettings.guiColorsLight = state.themeSettings.guiColors
              }
              // Load dark colors
              state.themeSettings.canvasBackground = state.themeSettings.canvasBackgroundDark || 'linear-gradient(135deg, #0d0d14 0%, #0f0f1a 50%, #0d0d14 100%)'
              state.themeSettings.canvasGridColor = state.themeSettings.canvasGridColorDark || '#1e1e2e'
              state.themeSettings.guiColors = state.themeSettings.guiColorsDark || DEFAULT_GUI_DARK
            } else {
              // Save current colors to dark before switching
              if (prevMode === 'dark') {
                state.themeSettings.canvasBackgroundDark = state.themeSettings.canvasBackground
                state.themeSettings.canvasGridColorDark = state.themeSettings.canvasGridColor
                state.themeSettings.guiColorsDark = state.themeSettings.guiColors
              }
              // Load light colors
              state.themeSettings.canvasBackground = state.themeSettings.canvasBackgroundLight || 'linear-gradient(135deg, #fafbff 0%, #f5f3ff 50%, #fafbff 100%)'
              state.themeSettings.canvasGridColor = state.themeSettings.canvasGridColorLight || '#e2e4f0'
              state.themeSettings.guiColors = state.themeSettings.guiColorsLight || DEFAULT_GUI_LIGHT
            }
          }
          state.isDirty = true
        })
      },

      setThemeColor: (nodeType, color) => {
        set((state) => {
          state.themeSettings.nodeColors[nodeType] = color
          state.themeSettings.currentPresetId = null // Mark as custom
          state.isDirty = true
        })
      },

      setCanvasBackground: (color) => {
        set((state) => {
          state.themeSettings.canvasBackground = color
          // Also update the per-mode storage
          if (state.themeSettings.mode === 'dark') {
            state.themeSettings.canvasBackgroundDark = color
          } else {
            state.themeSettings.canvasBackgroundLight = color
          }
          state.themeSettings.currentPresetId = null // Mark as custom
          state.isDirty = true
        })
      },

      setCanvasGridColor: (color) => {
        set((state) => {
          state.themeSettings.canvasGridColor = color
          // Also update the per-mode storage
          if (state.themeSettings.mode === 'dark') {
            state.themeSettings.canvasGridColorDark = color
          } else {
            state.themeSettings.canvasGridColorLight = color
          }
          state.themeSettings.currentPresetId = null // Mark as custom
          state.isDirty = true
        })
      },

      resetThemeColors: () => {
        set((state) => {
          state.themeSettings = { ...DEFAULT_THEME_SETTINGS }
          state.isDirty = true
        })
      },

      applyThemePreset: (presetId) => {
        set((state) => {
          const presetColors = getPresetColors(presetId, state.themeSettings.mode)
          if (presetColors) {
            state.themeSettings.currentPresetId = presetId
            state.themeSettings.canvasBackground = presetColors.canvasBackground
            state.themeSettings.canvasGridColor = presetColors.canvasGridColor
            state.themeSettings.nodeColors = { ...presetColors.nodeColors }

            // Store per-mode canvas values so they persist when switching modes
            if (state.themeSettings.mode === 'dark') {
              state.themeSettings.canvasBackgroundDark = presetColors.canvasBackground
              state.themeSettings.canvasGridColorDark = presetColors.canvasGridColor
            } else {
              state.themeSettings.canvasBackgroundLight = presetColors.canvasBackground
              state.themeSettings.canvasGridColorLight = presetColors.canvasGridColor
            }

            // Also fetch and store the opposite mode's colors for proper mode switching
            const oppositeMode = state.themeSettings.mode === 'dark' ? 'light' : 'dark'
            const oppositeColors = getPresetColors(presetId, oppositeMode)
            if (oppositeColors) {
              if (oppositeMode === 'dark') {
                state.themeSettings.canvasBackgroundDark = oppositeColors.canvasBackground
                state.themeSettings.canvasGridColorDark = oppositeColors.canvasGridColor
              } else {
                state.themeSettings.canvasBackgroundLight = oppositeColors.canvasBackground
                state.themeSettings.canvasGridColorLight = oppositeColors.canvasGridColor
              }
            }

            // Apply GUI colors from preset if available
            if (presetColors.guiColors) {
              state.themeSettings.guiColors = presetColors.guiColors
              if (state.themeSettings.mode === 'dark') {
                state.themeSettings.guiColorsDark = presetColors.guiColors
              } else {
                state.themeSettings.guiColorsLight = presetColors.guiColors
              }
            }

            // Also store the opposite mode's GUI colors
            if (oppositeColors?.guiColors) {
              if (oppositeMode === 'dark') {
                state.themeSettings.guiColorsDark = oppositeColors.guiColors
              } else {
                state.themeSettings.guiColorsLight = oppositeColors.guiColors
              }
            }

            state.isDirty = true
          }
        })
      },

      addCustomColor: (color) => {
        set((state) => {
          // Initialize if not present
          if (!state.themeSettings.customColors) {
            state.themeSettings.customColors = []
          }
          // Only add if not already present and valid hex
          if (/^#[0-9A-Fa-f]{6}$/.test(color) && !state.themeSettings.customColors.includes(color)) {
            // Limit to 12 custom colors, remove oldest if at limit
            if (state.themeSettings.customColors.length >= 12) {
              state.themeSettings.customColors.shift()
            }
            state.themeSettings.customColors.push(color)
            state.isDirty = true
          }
        })
      },

      removeCustomColor: (color) => {
        set((state) => {
          if (state.themeSettings.customColors) {
            state.themeSettings.customColors = state.themeSettings.customColors.filter(c => c !== color)
            state.isDirty = true
          }
        })
      },

      saveCustomPreset: (name) => {
        let presetId: string | null = null
        set((state) => {
          // Initialize if not present
          if (!state.themeSettings.customPresets) {
            state.themeSettings.customPresets = []
          }
          // Check if at limit (4 presets max)
          if (state.themeSettings.customPresets.length >= 4) {
            presetId = null
            return
          }
          // Create new preset from current settings with per-mode canvas colors
          presetId = `custom-${Date.now()}`
          state.themeSettings.customPresets.push({
            id: presetId,
            name: name || `Custom ${state.themeSettings.customPresets.length + 1}`,
            nodeColors: { ...state.themeSettings.nodeColors },
            canvasBackground: state.themeSettings.canvasBackground,
            canvasGridColor: state.themeSettings.canvasGridColor,
            canvasBackgroundDark: state.themeSettings.canvasBackgroundDark,
            canvasGridColorDark: state.themeSettings.canvasGridColorDark,
            canvasBackgroundLight: state.themeSettings.canvasBackgroundLight,
            canvasGridColorLight: state.themeSettings.canvasGridColorLight
          })
          state.isDirty = true
        })
        return presetId
      },

      deleteCustomPreset: (presetId) => {
        set((state) => {
          if (state.themeSettings.customPresets) {
            state.themeSettings.customPresets = state.themeSettings.customPresets.filter(p => p.id !== presetId)
            state.isDirty = true
          }
        })
      },

      applyCustomPreset: (presetId) => {
        set((state) => {
          const preset = state.themeSettings.customPresets?.find(p => p.id === presetId)
          if (preset) {
            state.themeSettings.nodeColors = { ...preset.nodeColors }
            // Apply per-mode canvas colors if available, otherwise use legacy colors
            const mode = state.themeSettings.mode
            if (mode === 'dark') {
              state.themeSettings.canvasBackground = preset.canvasBackgroundDark || preset.canvasBackground
              state.themeSettings.canvasGridColor = preset.canvasGridColorDark || preset.canvasGridColor
            } else {
              state.themeSettings.canvasBackground = preset.canvasBackgroundLight || preset.canvasBackground
              state.themeSettings.canvasGridColor = preset.canvasGridColorLight || preset.canvasGridColor
            }
            // Store all per-mode colors
            state.themeSettings.canvasBackgroundDark = preset.canvasBackgroundDark || preset.canvasBackground
            state.themeSettings.canvasGridColorDark = preset.canvasGridColorDark || preset.canvasGridColor
            state.themeSettings.canvasBackgroundLight = preset.canvasBackgroundLight || preset.canvasBackground
            state.themeSettings.canvasGridColorLight = preset.canvasGridColorLight || preset.canvasGridColor
            state.themeSettings.currentPresetId = null // Mark as custom since it's a user preset
            state.isDirty = true
          }
        })
      },

      setAIPaletteEnabled: (enabled) => {
        set((state) => {
          state.themeSettings.aiPaletteEnabled = enabled
          state.isDirty = true
        })
      },

      setEdgeStyle: (style) => {
        set((state) => {
          state.themeSettings.edgeStyle = style
          state.isDirty = true
        })
      },

      setGuiColors: (colors) => {
        set((state) => {
          const modeKey = state.themeSettings.mode === 'light' ? 'guiColorsLight' : 'guiColorsDark'
          state.themeSettings.guiColors = colors
          state.themeSettings[modeKey] = colors
          state.isDirty = true
        })
      },

      setLinkColors: (colors) => {
        set((state) => {
          const modeKey = state.themeSettings.mode === 'light' ? 'linkColorsLight' : 'linkColorsDark'
          state.themeSettings.linkColors = colors
          state.themeSettings[modeKey] = colors
          state.isDirty = true
        })
      },

      setLinkGradientEnabled: (enabled) => {
        set((state) => {
          state.themeSettings.linkGradientEnabled = enabled
          state.isDirty = true
        })
      },

      updateThemeSettings: (settings) => {
        set((state) => {
          state.themeSettings = {
            ...state.themeSettings,
            ...settings,
            ...(settings.nodeColors ? { nodeColors: { ...state.themeSettings.nodeColors, ...settings.nodeColors } } : {}),
            ...(settings.linkColors ? { linkColors: { ...state.themeSettings.linkColors, ...settings.linkColors } } : {}),
            ...(settings.linkColorsDark ? { linkColorsDark: { ...state.themeSettings.linkColorsDark, ...settings.linkColorsDark } } : {}),
            ...(settings.linkColorsLight ? { linkColorsLight: { ...state.themeSettings.linkColorsLight, ...settings.linkColorsLight } } : {})
          }
          state.isDirty = true
        })
      },

      // ---------------------------------------------------------------------
      // Workspace Preferences Actions
      // ---------------------------------------------------------------------

      setArtifactPropertiesDisplay: (mode) => {
        set((state) => {
          state.workspacePreferences.artifactPropertiesDisplay = mode
          state.isDirty = true
        })
      },

      setPropertiesDisplayMode: (mode) => {
        set((state) => {
          state.workspacePreferences.propertiesDisplayMode = mode
          // Close floating properties modals when switching to sidebar mode
          if (mode === 'sidebar') {
            state.floatingPropertiesNodeIds = []
          }
          state.isDirty = true
        })
      },

      setChatDisplayMode: (mode) => {
        set((state) => {
          state.workspacePreferences.chatDisplayMode = mode
          state.isDirty = true
        })
      },

      setPropertiesSidebarWidth: (width) => {
        set((state) => {
          state.workspacePreferences.propertiesSidebarWidth = Math.max(280, Math.min(600, width))
          state.isDirty = true
        })
      },

      setShowTokenEstimates: (show) => {
        set((state) => {
          state.workspacePreferences.showTokenEstimates = show
          state.isDirty = true
        })
      },

      setPreferVerticalToolbar: (prefer) => {
        set((state) => {
          state.workspacePreferences.preferVerticalToolbar = prefer
          state.isDirty = true
        })
      },

      // ---------------------------------------------------------------------
      // Node Activation Actions
      // ---------------------------------------------------------------------

      evaluateNodeActivation: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (!node) return

          const nodeData = node.data as ContextMetadata
          const condition = nodeData.activationCondition
          if (!condition) return // No condition = manual control only

          // Get incoming edges to this node
          const incomingEdges = state.edges.filter((e) => e.target === nodeId)

          let conditionMet = false

          switch (condition.trigger) {
            case 'any-connected': {
              // Any connected source node is enabled
              conditionMet = incomingEdges.some((edge) => {
                const sourceNode = state.nodes.find((n) => n.id === edge.source)
                return sourceNode && (sourceNode.data as ContextMetadata).enabled !== false
              })
              break
            }

            case 'all-connected': {
              // All connected source nodes are enabled
              if (incomingEdges.length === 0) {
                conditionMet = false
              } else {
                conditionMet = incomingEdges.every((edge) => {
                  const sourceNode = state.nodes.find((n) => n.id === edge.source)
                  return sourceNode && (sourceNode.data as ContextMetadata).enabled !== false
                })
              }
              break
            }

            case 'specific-node': {
              // Specific source node is enabled
              if (condition.sourceNodeId) {
                const sourceNode = state.nodes.find((n) => n.id === condition.sourceNodeId)
                const isConnected = incomingEdges.some((e) => e.source === condition.sourceNodeId)
                conditionMet = !!(isConnected && sourceNode && (sourceNode.data as ContextMetadata).enabled !== false)
              }
              break
            }

            case 'edge-property': {
              // Check edge property value
              if (condition.edgeProperty) {
                conditionMet = incomingEdges.some((edge) => {
                  const edgeData = edge.data as EdgeData | undefined
                  if (!edgeData?.properties) return false
                  const propValue = edgeData.properties[condition.edgeProperty!]
                  return propValue === condition.edgePropertyValue
                })
              }
              break
            }
          }

          // Apply inversion if specified
          if (condition.invert) {
            conditionMet = !conditionMet
          }

          // Update enabled state based on condition result
          nodeData.enabled = conditionMet
          state.isDirty = true
        })
      },

      evaluateAllNodeActivations: () => {
        const state = get()
        // Evaluate nodes that have activation conditions
        state.nodes.forEach((node) => {
          const nodeData = node.data as ContextMetadata
          if (nodeData.activationCondition) {
            get().evaluateNodeActivation(node.id)
          }
        })
      },

      // ---------------------------------------------------------------------
      // Project Grouping Actions
      // ---------------------------------------------------------------------

      addNodeToProject: (nodeId, projectId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          const project = state.nodes.find((n) => n.id === projectId)

          if (!node || !project || project.data.type !== 'project') return
          if (node.data.type === 'project') return // Can't nest projects

          // Remove from old parent if exists
          const oldParentId = (node.data as { parentId?: string }).parentId
          if (oldParentId) {
            const oldParent = state.nodes.find((n) => n.id === oldParentId)
            if (oldParent && oldParent.data.type === 'project') {
              const projectData = oldParent.data as ProjectNodeData
              projectData.childNodeIds = projectData.childNodeIds.filter((id) => id !== nodeId)
            }
          }

          // Add to new parent
          const projectData = project.data as ProjectNodeData
          if (!projectData.childNodeIds.includes(nodeId)) {
            projectData.childNodeIds.push(nodeId)
          }

          // Update node's parentId
          ;(node.data as { parentId?: string }).parentId = projectId

          // Optionally inherit parent's color (style inheritance)
          const inheritStyle = state.themeSettings.inheritParentStyle !== false // Default: true
          if (inheritStyle) {
            const projectData = project.data as ProjectNodeData
            const projectColor = projectData.color
            // Note: Already checked node.data.type !== 'project' above (line 4389)
            if (projectColor) {
              // Inherit the project's color as the node's color
              ;(node.data as { color?: string }).color = projectColor
            }
          }

          // Update intraProject flag for edges connected to this node
          // Note: Project nodes have z-index: -1 so all edges render above them automatically
          state.edges.forEach((edge) => {
            if (edge.source === nodeId || edge.target === nodeId) {
              const sourceNode = state.nodes.find(n => n.id === edge.source)
              const targetNode = state.nodes.find(n => n.id === edge.target)
              const sourceParent = (sourceNode?.data as { parentId?: string })?.parentId
              const targetParent = (targetNode?.data as { parentId?: string })?.parentId
              const isIntraProject = !!(sourceParent && targetParent && sourceParent === targetParent)
              if (edge.data) {
                edge.data.intraProject = isIntraProject
              }
            }
          })

          state.isDirty = true
        })
      },

      removeNodeFromProject: (nodeId) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (!node) return

          const parentId = (node.data as { parentId?: string }).parentId
          if (!parentId) return

          const parent = state.nodes.find((n) => n.id === parentId)
          if (parent && parent.data.type === 'project') {
            const projectData = parent.data as ProjectNodeData
            projectData.childNodeIds = projectData.childNodeIds.filter((id) => id !== nodeId)
          }

          // Clear node's parentId
          ;(node.data as { parentId?: string }).parentId = undefined

          // Update intraProject flag for edges connected to this node
          // Since node is no longer in a project, all its edges lose intraProject status
          // Note: Project nodes have z-index: -1 so all edges render above them automatically
          state.edges.forEach((edge) => {
            if (edge.source === nodeId || edge.target === nodeId) {
              if (edge.data) {
                edge.data.intraProject = false
              }
            }
          })

          state.isDirty = true
        })
      },

      getNodeParentId: (nodeId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (!node) return null
        return (node.data as { parentId?: string }).parentId || null
      },

      // ---------------------------------------------------------------------
      // Property Schema Actions
      // ---------------------------------------------------------------------

      addCustomProperty: (definition) => {
        const id = `custom-${uuid()}`
        set((state) => {
          state.propertySchema.customProperties.push({
            ...definition,
            id
          })
          state.isDirty = true
        })
        return id
      },

      updateCustomProperty: (propertyId, updates) => {
        set((state) => {
          const index = state.propertySchema.customProperties.findIndex((p) => p.id === propertyId)
          if (index !== -1) {
            const existing = state.propertySchema.customProperties[index]
            if (existing) {
              state.propertySchema.customProperties[index] = {
                ...existing,
                ...updates,
                id: existing.id // Ensure id is always present
              } as PropertyDefinition
              state.isDirty = true
            }
          }
        })
      },

      deleteCustomProperty: (propertyId) => {
        set((state) => {
          state.propertySchema.customProperties = state.propertySchema.customProperties.filter(
            (p) => p.id !== propertyId
          )
          // Also remove from all node type mappings
          for (const nodeType of Object.keys(state.propertySchema.nodeTypeProperties)) {
            const props = state.propertySchema.nodeTypeProperties[nodeType]
            if (props) {
              state.propertySchema.nodeTypeProperties[nodeType] = props.filter(
                (id) => id !== propertyId
              )
            }
          }
          state.isDirty = true
        })
      },

      updatePropertyDefaults: (nodeType, defaults) => {
        set((state) => {
          if (!state.propertySchema.defaults) {
            state.propertySchema.defaults = {}
          }
          state.propertySchema.defaults[nodeType] = defaults
          state.isDirty = true
        })
      },

      addPropertyOption: (propertyId, option) => {
        const value = option.label.toLowerCase().replace(/\s+/g, '-')
        set((state) => {
          // Check if it's a built-in property
          if (propertyId in BUILTIN_PROPERTIES) {
            if (!state.propertySchema.builtinPropertyOptions[propertyId]) {
              state.propertySchema.builtinPropertyOptions[propertyId] = []
            }
            state.propertySchema.builtinPropertyOptions[propertyId].push({
              ...option,
              value
            })
          } else {
            // Custom property
            const prop = state.propertySchema.customProperties.find((p) => p.id === propertyId)
            if (prop) {
              if (!prop.options) prop.options = []
              prop.options.push({ ...option, value })
            }
          }
          state.isDirty = true
        })
        return value
      },

      updatePropertyOption: (propertyId, value, updates) => {
        set((state) => {
          if (propertyId in BUILTIN_PROPERTIES) {
            // Ensure the options array exists
            if (!state.propertySchema.builtinPropertyOptions[propertyId]) {
              state.propertySchema.builtinPropertyOptions[propertyId] = []
            }
            const options = state.propertySchema.builtinPropertyOptions[propertyId]
            const index = options.findIndex((o) => o.value === value)

            if (index !== -1) {
              // Option already exists in user customizations - update it
              const existing = options[index]!
              options[index] = {
                value: existing.value,
                label: updates.label ?? existing.label,
                color: updates.color ?? existing.color,
                icon: updates.icon !== undefined ? updates.icon : existing.icon
              }
            } else {
              // Option is a built-in default - copy it to user customizations with updates
              const builtinOptions = BUILTIN_PROPERTIES[propertyId]?.options || []
              const builtinOption = builtinOptions.find((o) => o.value === value)
              if (builtinOption) {
                options.push({
                  value: builtinOption.value,
                  label: updates.label ?? builtinOption.label,
                  color: updates.color ?? builtinOption.color,
                  icon: updates.icon !== undefined ? updates.icon : builtinOption.icon
                })
              }
            }
          } else {
            const prop = state.propertySchema.customProperties.find((p) => p.id === propertyId)
            if (prop?.options) {
              const index = prop.options.findIndex((o) => o.value === value)
              const existing = index !== -1 ? prop.options[index] : undefined
              if (existing) {
                prop.options[index] = {
                  value: existing.value,
                  label: updates.label ?? existing.label,
                  color: updates.color ?? existing.color,
                  icon: updates.icon !== undefined ? updates.icon : existing.icon
                }
              }
            }
          }
          state.isDirty = true
        })
      },

      deletePropertyOption: (propertyId, value) => {
        set((state) => {
          if (propertyId in BUILTIN_PROPERTIES) {
            const options = state.propertySchema.builtinPropertyOptions[propertyId]
            if (options) {
              state.propertySchema.builtinPropertyOptions[propertyId] = options.filter(
                (o) => o.value !== value
              )
            }
          } else {
            const prop = state.propertySchema.customProperties.find((p) => p.id === propertyId)
            if (prop?.options) {
              prop.options = prop.options.filter((o) => o.value !== value)
            }
          }
          state.isDirty = true
        })
      },

      addPropertyToNodeType: (nodeType, propertyId) => {
        set((state) => {
          if (!state.propertySchema.nodeTypeProperties[nodeType]) {
            state.propertySchema.nodeTypeProperties[nodeType] = []
          }
          if (!state.propertySchema.nodeTypeProperties[nodeType].includes(propertyId)) {
            state.propertySchema.nodeTypeProperties[nodeType].push(propertyId)
          }
          state.isDirty = true
        })
      },

      removePropertyFromNodeType: (nodeType, propertyId) => {
        set((state) => {
          if (state.propertySchema.nodeTypeProperties[nodeType]) {
            state.propertySchema.nodeTypeProperties[nodeType] =
              state.propertySchema.nodeTypeProperties[nodeType].filter((id) => id !== propertyId)
          }
          state.isDirty = true
        })
      },

      getPropertiesForNode: (nodeId) => {
        const state = get()
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return []
        return getPropertiesForNodeType(node.data.type, state.propertySchema)
      },

      getPropertyDefinition: (propertyId) => {
        const state = get()
        // Check built-in first
        if (propertyId in BUILTIN_PROPERTIES) {
          return BUILTIN_PROPERTIES[propertyId]
        }
        // Then check custom
        return state.propertySchema.customProperties.find((p) => p.id === propertyId)
      },

      // ---------------------------------------------------------------------
      // Node Properties Actions
      // ---------------------------------------------------------------------

      setNodeProperty: (nodeId, propertyId, value) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === nodeId)
          if (!node) return

          if (!(node.data as Record<string, unknown>).properties) {
            (node.data as Record<string, unknown>).properties = {}
          }
          ((node.data as Record<string, unknown>).properties as Record<string, unknown>)[propertyId] = value

          // Sync tags to legacy location for backward compatibility
          if (propertyId === 'tags') {
            node.data.tags = value as string[]
          }

          node.data.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      getNodeProperty: (nodeId, propertyId) => {
        const state = get()
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return undefined
        return node.data.properties?.[propertyId]
      },

      // ---------------------------------------------------------------------
      // Canvas Interaction Actions
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

      // ---------------------------------------------------------------------
      // Artifact Actions
      // ---------------------------------------------------------------------

      createArtifactFromFile: (file, position) => {
        const id = uuid()
        const extension = file.name.split('.').pop()?.toLowerCase() || ''
        const contentType = getContentTypeFromExtension(extension)
        const language = getLanguageFromExtension(extension)

        const data: ArtifactNodeData = {
          ...createArtifactData(contentType, {
            type: 'file-drop',
            filename: file.name
          }),
          title: file.name,
          content: file.content,
          language
        }

        const node: Node<NodeData> = {
          id,
          type: 'artifact',
          position,
          data,
          width: 320,
          height: 200,
          selected: false
        }

        set((state) => {
          state.nodes.push(node)
          state.isDirty = true
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({ type: 'ADD_NODE', node: JSON.parse(JSON.stringify(node)) })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })

        return id
      },

      spawnArtifactFromLLM: (conversationNodeId, messageId, artifact) => {
        const id = uuid()
        const convNode = get().nodes.find((n) => n.id === conversationNodeId)
        if (!convNode) return id // Return id anyway for consistency

        // Calculate position to the right of conversation node
        const position = {
          x: convNode.position.x + (convNode.width || 300) + 50,
          y: convNode.position.y
        }

        const data: ArtifactNodeData = {
          ...createArtifactData(artifact.type, {
            type: 'llm-response',
            conversationId: conversationNodeId,
            messageId
          }),
          title: artifact.title || `${artifact.type} artifact`,
          content: artifact.content,
          language: artifact.language,
          sourceNodeId: conversationNodeId,
          sourceMessageId: messageId
        }

        const node: Node<NodeData> = {
          id,
          type: 'artifact',
          position,
          data,
          width: 320,
          height: 200,
          selected: false
        }

        set((state) => {
          state.nodes.push(node)

          // Auto-create edge from conversation to artifact
          const edge: Edge<EdgeData> = {
            id: `${conversationNodeId}-${id}`,
            type: 'custom',
            source: conversationNodeId,
            target: id,
            sourceHandle: 'bottom-source',
            targetHandle: 'top-target',
            data: { ...DEFAULT_EDGE_DATA, label: 'spawned' }
          }
          state.edges.push(edge)

          state.isDirty = true
          state.history = state.history.slice(0, state.historyIndex + 1)
          state.history.push({
            type: 'BATCH',
            actions: [
              { type: 'ADD_NODE', node: JSON.parse(JSON.stringify(node)) },
              { type: 'ADD_EDGE', edge: JSON.parse(JSON.stringify(edge)) }
            ]
          })
          state.historyIndex++
          if (state.history.length > 100) {
            state.history = state.history.slice(-100)
            state.historyIndex = state.history.length - 1
          }
        })

        return id
      },

      updateArtifactContent: (artifactId, content, source) => {
        set((state) => {
          const node = state.nodes.find((n) => n.id === artifactId)
          if (!node || node.data.type !== 'artifact') return

          const artifactData = node.data as ArtifactNodeData

          if (artifactData.versioningMode === 'fork') {
            // Fork mode: create a new artifact (handled elsewhere for full fork)
            // Here we just update for now
          }

          // Save current version to history (keep last 10)
          const newVersionHistory: ArtifactVersion[] = [
            ...artifactData.versionHistory.slice(-9),
            {
              version: artifactData.version,
              content: artifactData.content,
              timestamp: Date.now(),
              changeSource: source
            }
          ]

          // Update artifact
          artifactData.content = content
          artifactData.version = artifactData.version + 1
          artifactData.versionHistory = newVersionHistory
          artifactData.updatedAt = Date.now()

          state.isDirty = true
        })
      },

      // ---------------------------------------------------------------------
      // Workspace Node Actions
      // ---------------------------------------------------------------------

      addNodesToWorkspace: (workspaceNodeId, nodeIds) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          const newIds = nodeIds.filter(
            (id) => !wsData.includedNodeIds.includes(id) && id !== workspaceNodeId
          )

          wsData.includedNodeIds = [...wsData.includedNodeIds, ...newIds]
          // Remove from excluded if they were there
          wsData.excludedNodeIds = wsData.excludedNodeIds.filter((id) => !newIds.includes(id))
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      removeNodesFromWorkspace: (workspaceNodeId, nodeIds) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          wsData.includedNodeIds = wsData.includedNodeIds.filter((id) => !nodeIds.includes(id))
          wsData.excludedNodeIds = wsData.excludedNodeIds.filter((id) => !nodeIds.includes(id))
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      excludeNodesFromWorkspace: (workspaceNodeId, nodeIds) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          const newExclusions = nodeIds.filter(
            (id) => !wsData.excludedNodeIds.includes(id) && id !== workspaceNodeId
          )
          wsData.excludedNodeIds = [...wsData.excludedNodeIds, ...newExclusions]
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      includeNodesInWorkspace: (workspaceNodeId, nodeIds) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          // Remove from excluded list
          wsData.excludedNodeIds = wsData.excludedNodeIds.filter((id) => !nodeIds.includes(id))
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      toggleWorkspaceVisibility: (workspaceNodeId) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          wsData.showOnCanvas = !wsData.showOnCanvas
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      toggleWorkspaceLinks: (workspaceNodeId) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          wsData.showLinks = !wsData.showLinks
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      getWorkspaceNodesForNode: (nodeId) => {
        const state = get()
        // Find all workspace nodes that include this node (and don't exclude it)
        return state.nodes.filter((n) => {
          if (n.data.type !== 'workspace') return false
          const wsData = n.data as WorkspaceNodeData
          return (
            wsData.includedNodeIds.includes(nodeId) && !wsData.excludedNodeIds.includes(nodeId)
          )
        }) as Node<WorkspaceNodeData>[]
      },

      getEffectiveLLMSettings: (nodeId) => {
        const state = get()
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return null

        // Check if node opts out of workspace defaults
        if (node.data.useWorkspaceDefaults === false) {
          return node.data.workspaceOverrides?.llm
            ? { ...DEFAULT_WORKSPACE_LLM_SETTINGS, ...node.data.workspaceOverrides.llm }
            : null
        }

        // Find workspace nodes containing this node
        const workspaceNodes = state.nodes.filter((n) => {
          if (n.data.type !== 'workspace') return false
          const wsData = n.data as WorkspaceNodeData
          return (
            wsData.includedNodeIds.includes(nodeId) && !wsData.excludedNodeIds.includes(nodeId)
          )
        }) as Node<WorkspaceNodeData>[]

        if (workspaceNodes.length === 0) return null

        // Merge settings from all workspaces (last one wins for conflicts)
        let mergedSettings: WorkspaceLLMSettings = { ...DEFAULT_WORKSPACE_LLM_SETTINGS }
        for (const wsNode of workspaceNodes) {
          const wsData = wsNode.data as WorkspaceNodeData
          mergedSettings = { ...mergedSettings, ...wsData.llmSettings }
        }

        // Apply node-level overrides
        if (node.data.workspaceOverrides?.llm) {
          mergedSettings = { ...mergedSettings, ...node.data.workspaceOverrides.llm }
        }

        return mergedSettings
      },

      getEffectiveContextRules: (nodeId) => {
        const state = get()
        const node = state.nodes.find((n) => n.id === nodeId)
        if (!node) return null

        // Check if node opts out of workspace defaults
        if (node.data.useWorkspaceDefaults === false) {
          return node.data.workspaceOverrides?.context
            ? { ...DEFAULT_WORKSPACE_CONTEXT_RULES, ...node.data.workspaceOverrides.context }
            : null
        }

        // Find workspace nodes containing this node
        const workspaceNodes = state.nodes.filter((n) => {
          if (n.data.type !== 'workspace') return false
          const wsData = n.data as WorkspaceNodeData
          return (
            wsData.includedNodeIds.includes(nodeId) && !wsData.excludedNodeIds.includes(nodeId)
          )
        }) as Node<WorkspaceNodeData>[]

        if (workspaceNodes.length === 0) return null

        // Merge rules from all workspaces (last one wins for conflicts)
        let mergedRules: WorkspaceContextRules = { ...DEFAULT_WORKSPACE_CONTEXT_RULES }
        for (const wsNode of workspaceNodes) {
          const wsData = wsNode.data as WorkspaceNodeData
          mergedRules = { ...mergedRules, ...wsData.contextRules }
        }

        // Apply node-level overrides
        if (node.data.workspaceOverrides?.context) {
          mergedRules = { ...mergedRules, ...node.data.workspaceOverrides.context }
        }

        return mergedRules
      },

      updateWorkspaceLLMSettings: (workspaceNodeId, settings) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          wsData.llmSettings = { ...wsData.llmSettings, ...settings }
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      },

      updateWorkspaceContextRules: (workspaceNodeId, rules) => {
        set((state) => {
          const wsNode = state.nodes.find((n) => n.id === workspaceNodeId)
          if (!wsNode || wsNode.data.type !== 'workspace') return

          const wsData = wsNode.data as WorkspaceNodeData
          wsData.contextRules = { ...wsData.contextRules, ...rules }
          wsData.updatedAt = Date.now()
          state.isDirty = true
        })
      }
    }))
  )
)

// -----------------------------------------------------------------------------
// Selector Hooks (for performance)
// -----------------------------------------------------------------------------

export const useNodes = (): Node<NodeData>[] => useWorkspaceStore((state) => state.nodes)
export const useEdges = (): Edge<EdgeData>[] => useWorkspaceStore((state) => state.edges)
export const useContextSettings = (): ContextSettings =>
  useWorkspaceStore((state) => state.contextSettings)
export const useSelectedNodeIds = (): string[] =>
  useWorkspaceStore((state) => state.selectedNodeIds)
export const useActivePanel = (): 'none' | 'properties' | 'chat' =>
  useWorkspaceStore((state) => state.activePanel)
export const useActiveChatNodeId = (): string | null =>
  useWorkspaceStore((state) => state.activeChatNodeId)
export const useIsDirty = (): boolean => useWorkspaceStore((state) => state.isDirty)
export const usePropertySchema = (): PropertySchema =>
  useWorkspaceStore((state) => state.propertySchema)
export const usePendingExtractions = (): PendingExtraction[] =>
  useWorkspaceStore((state) => state.pendingExtractions)
export const useIsExtracting = (): string | null =>
  useWorkspaceStore((state) => state.isExtracting)
export const useLastCanvasClick = (): { x: number; y: number; time: number } | null =>
  useWorkspaceStore((state) => state.lastCanvasClick)

// Visual Feedback Selector Hooks
export const useIsStreaming = (nodeId: string): boolean =>
  useWorkspaceStore((state) => state.streamingConversations.has(nodeId))

export const useIsSpawning = (nodeId: string): boolean =>
  useWorkspaceStore((state) => state.recentlySpawnedNodes.has(nodeId))

export const useNodeWarmth = (nodeId: string): 'hot' | 'warm' | 'cool' | null => {
  return useWorkspaceStore((state) => {
    const lastUpdate = state.nodeUpdatedAt.get(nodeId)
    if (!lastUpdate) return null

    const elapsed = Date.now() - lastUpdate

    if (elapsed < 30000) return 'hot' // 30 seconds
    if (elapsed < 120000) return 'warm' // 2 minutes
    if (elapsed < 300000) return 'cool' // 5 minutes
    return null
  })
}

export const useIsNodePinned = (nodeId: string): boolean =>
  useWorkspaceStore((state) => state.pinnedWindows.some(w => w.nodeId === nodeId))

export const useIsNodeLayoutPinned = (nodeId: string): boolean =>
  useWorkspaceStore((state) => {
    const node = state.nodes.find(n => n.id === nodeId)
    return (node?.data as ContextMetadata)?.layoutMode === 'pinned'
  })

export const useIsNodeBookmarked = (nodeId: string): boolean =>
  useWorkspaceStore((state) => state.bookmarkedNodeId === nodeId)

// Numbered bookmark hooks
export const useNodeNumberedBookmark = (nodeId: string): number | null =>
  useWorkspaceStore((state) => {
    for (let i = 1; i <= 9; i++) {
      if (state.numberedBookmarks[i] === nodeId) return i
    }
    return null
  })

export const useNumberedBookmarks = (): Record<number, string | null> =>
  useWorkspaceStore((state) => state.numberedBookmarks)

// ---------------------------------------------------------------------
// Spatial Extraction System Selectors
// ---------------------------------------------------------------------

/** Get count of pending extractions for a specific node */
export const useExtractionCountForNode = (nodeId: string): number =>
  useWorkspaceStore((state) => state.pendingExtractions.filter((e) => e.sourceNodeId === nodeId).length)

/** Get all pending extractions for a specific node */
export const useExtractionsForNode = (nodeId: string): PendingExtraction[] =>
  useWorkspaceStore((state) => state.pendingExtractions.filter((e) => e.sourceNodeId === nodeId))

/** Get extractions sorted by confidence (highest first) */
export const useSortedExtractionsForNode = (nodeId: string): PendingExtraction[] =>
  useWorkspaceStore((state) =>
    state.pendingExtractions
      .filter((e) => e.sourceNodeId === nodeId)
      .sort((a, b) => b.confidence - a.confidence)
  )

/** Get which node's extraction panel is open */
export const useOpenExtractionPanelNodeId = (): string | null =>
  useWorkspaceStore((state) => state.openExtractionPanelNodeId)

/** Check if a specific node's extraction panel is open */
export const useIsExtractionPanelOpen = (nodeId: string): boolean =>
  useWorkspaceStore((state) => state.openExtractionPanelNodeId === nodeId)

/** Get current extraction drag state */
export const useExtractionDrag = () => useWorkspaceStore((state) => state.extractionDrag)

/** Get last accepted extraction for undo */
export const useLastAcceptedExtraction = () => useWorkspaceStore((state) => state.lastAcceptedExtraction)
