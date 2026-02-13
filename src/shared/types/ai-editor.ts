// =============================================================================
// ai-editor.ts -- AI Workspace Editor types
//
// Contains: MutationOp, MutationPlan, AIEditorMode, AIEditorScope,
// streaming types, preview types, context types, action template types
// =============================================================================

import type { NodeData } from './nodes'
import type { EdgeData, EdgeStrength } from './edges'
import type { SpatialRegion } from '../actionTypes'

// -----------------------------------------------------------------------------
// Position Resolution Types
// -----------------------------------------------------------------------------

/**
 * RelativePosition describes where a new node should be placed
 * using semantic positioning that can be resolved at execution time.
 */
export type RelativePosition =
  | { type: 'absolute'; x: number; y: number }
  | { type: 'relative-to'; anchor: string; direction: 'above' | 'below' | 'left' | 'right'; offset?: number }
  | { type: 'center-of-selection' }
  | { type: 'center-of-view' }
  | { type: 'below-selection'; index?: number }
  | { type: 'grid'; row: number; col: number; baseAnchor: string; spacing?: number }
  | { type: 'cluster'; near: string; spread?: number }

// Default spacing between nodes when using relative positioning
export const DEFAULT_NODE_SPACING = 50
export const DEFAULT_GRID_SPACING = 250
export const DEFAULT_CLUSTER_SPREAD = 100

/**
 * Default node dimensions by type
 * Consolidated single source of truth for all node sizing
 */
export const NODE_DEFAULTS: Record<NodeData['type'], { width: number; height: number }> = {
  conversation: { width: 300, height: 140 },
  project: { width: 400, height: 300 },
  note: { width: 280, height: 140 },
  task: { width: 260, height: 140 },
  artifact: { width: 320, height: 200 },
  workspace: { width: 320, height: 220 },
  text: { width: 200, height: 60 },
  action: { width: 280, height: 140 },
  orchestrator: { width: 360, height: 280 }
} as const

// -----------------------------------------------------------------------------
// Mutation Operation Types
// -----------------------------------------------------------------------------

/**
 * MutationOp is a discriminated union of all possible canvas operations.
 * Operations reference nodes by ID (existing) or tempId (new nodes).
 */
export type MutationOp =
  | {
      op: 'create-node'
      tempId: string // Temporary ID, resolved to real ID during execution
      type: NodeData['type']
      position: RelativePosition
      data: Partial<NodeData>
      dimensions?: { width: number; height: number }
    }
  | {
      op: 'delete-node'
      nodeId: string
      reason?: string // Why this node should be deleted
    }
  | {
      op: 'update-node'
      nodeId: string
      data: Partial<NodeData>
      merge?: boolean // If true, deep merge; if false, shallow replace
    }
  | {
      op: 'move-node'
      nodeId: string
      position: RelativePosition
    }
  | {
      op: 'create-edge'
      tempId?: string
      source: string // nodeId or tempId
      target: string // nodeId or tempId
      data?: Partial<EdgeData>
    }
  | {
      op: 'delete-edge'
      edgeId: string
      reason?: string
    }
  | {
      op: 'update-edge'
      edgeId: string
      data: Partial<EdgeData>
    }

// -----------------------------------------------------------------------------
// Plan Warning Types
// -----------------------------------------------------------------------------

export type PlanWarningLevel = 'info' | 'warning' | 'error'

export interface PlanWarning {
  level: PlanWarningLevel
  message: string
  affectedIds?: string[] // Node or edge IDs this warning relates to
  suggestion?: string // Suggested action to resolve
}

// -----------------------------------------------------------------------------
// AI Editor Mode Types (Legacy - see streaming types at end of file for new definitions)
// -----------------------------------------------------------------------------

// NOTE: AIEditorMode type is defined at end of file with streaming types
// These descriptions are provided for backwards compatibility
export const AI_EDITOR_MODE_DESCRIPTIONS_LEGACY = {
  fix: {
    label: 'Fix',
    description: 'Fix issues in selected nodes (broken connections, missing data, inconsistencies)',
    icon: 'Wrench'
  },
  refactor: {
    label: 'Refactor',
    description: 'Restructure and improve organization (split nodes, merge content, update relationships)',
    icon: 'GitBranch'
  },
  organize: {
    label: 'Organize',
    description: 'Arrange and layout nodes spatially (align, distribute, group by type)',
    icon: 'LayoutGrid'
  },
  generate: {
    label: 'Generate',
    description: 'Create new nodes and connections based on prompt (brainstorm, expand, fill gaps)',
    icon: 'Sparkles'
  }
} as const

// -----------------------------------------------------------------------------
// AI Editor Scope Types (Legacy - see streaming types at end of file for new definitions)
// -----------------------------------------------------------------------------

// NOTE: AIEditorScope type is defined at end of file with streaming types
// These descriptions are provided for backwards compatibility
export const AI_EDITOR_SCOPE_DESCRIPTIONS_LEGACY = {
  single: {
    label: 'Single Node',
    description: 'Target node with full detail, connected nodes as context'
  },
  selection: {
    label: 'Selection',
    description: 'Only selected nodes and their immediate connections'
  },
  view: {
    label: 'Visible',
    description: 'All nodes currently visible in the viewport'
  },
  canvas: {
    label: 'Canvas',
    description: 'The entire workspace (may be slow for large workspaces)'
  }
} as const

// -----------------------------------------------------------------------------
// Mutation Plan Types
// -----------------------------------------------------------------------------

/**
 * MutationPlan is the output of the AI planning phase.
 * Contains all operations to perform and any warnings/clarifications.
 */
export interface MutationPlan {
  id: string
  mode: AIEditorMode
  prompt: string
  scope: AIEditorScope
  operations: MutationOp[]
  warnings: PlanWarning[]
  reasoning?: string // AI's explanation of what the plan does
  estimatedChanges?: {
    nodesCreated: number
    nodesDeleted: number
    nodesUpdated: number
    nodesMoved: number
    edgesCreated: number
    edgesDeleted: number
  }
}

// -----------------------------------------------------------------------------
// Preview State Types
// -----------------------------------------------------------------------------

export interface GhostNodePreview {
  tempId: string
  type: NodeData['type']
  position: { x: number; y: number } // Resolved absolute position
  dimensions: { width: number; height: number }
  data: Partial<NodeData>
}

export interface DeletionOverlayPreview {
  nodeId: string
  reason?: string
  nodeTitle?: string // Title of the node being deleted
  preservedIn?: string // Title of node that receives this content (for merges)
  preservedData?: Partial<NodeData> // Content that will be preserved elsewhere
}

export interface MovementPathPreview {
  nodeId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  nodeTitle?: string // Title of the node being moved
}

export interface EdgePreview {
  tempId?: string
  source: string
  target: string
  data?: Partial<EdgeData>
  isNew: boolean
  isDeleted?: boolean
}

/**
 * MutationPreviewState contains all the visual preview data
 * derived from a MutationPlan before execution.
 */
export interface MutationPreviewState {
  planId: string
  ghostNodes: GhostNodePreview[]
  deletionOverlays: DeletionOverlayPreview[]
  movementPaths: MovementPathPreview[]
  edgePreviews: EdgePreview[]
  nodeUpdates: Array<{ nodeId: string; changes: Partial<NodeData> }>
}

// -----------------------------------------------------------------------------
// AI Editor Context Types
// -----------------------------------------------------------------------------

/**
 * Summarized node for context (reduced token usage)
 */
export interface AIEditorNodeSummary {
  id: string
  type: NodeData['type']
  title: string
  position: { x: number; y: number }
  dimensions?: { width: number; height: number }
  // Type-specific summaries
  messageCount?: number // For conversations
  contentPreview?: string // First 200 chars for notes/artifacts
  status?: string // For tasks
  childCount?: number // For projects
  memberCount?: number // For workspaces
  // Metadata
  tags?: string[]
  contextRole?: string
  color?: string
}

/**
 * Summarized edge for context
 */
export interface AIEditorEdgeSummary {
  id: string
  source: string
  target: string
  label?: string
  strength?: EdgeStrength
  direction?: 'unidirectional' | 'bidirectional'
}

/**
 * Full context sent to the LLM for plan generation.
 * Includes node summaries, relationships, and user intent.
 */
export interface AIEditorContext {
  mode: AIEditorMode
  prompt: string
  scope: AIEditorScope

  // Canvas state
  viewport: { x: number; y: number; zoom: number }
  canvasBounds: { minX: number; minY: number; maxX: number; maxY: number }

  // Selected nodes get full detail
  selectedNodes: AIEditorNodeSummary[]
  selectedNodeIds: string[]

  // Visible nodes get summaries
  visibleNodes: AIEditorNodeSummary[]

  // All canvas nodes (if scope is 'canvas') - minimal info
  allNodes?: Array<{ id: string; type: NodeData['type']; title: string; position: { x: number; y: number } }>

  // Edges
  edges: AIEditorEdgeSummary[]

  // Workspace settings if relevant
  workspaceSettings?: {
    defaultProvider: string
    themeMode: 'dark' | 'light'
  }

  // Token budget info
  estimatedTokens: number
  maxTokens: number

  // Learning data (optional, from LearningService)
  learningData?: {
    preferredMode?: 'generate' | 'edit' | 'organize' | 'automate' | 'ask'
    commonPatterns?: string[]
    avgOperations?: number
    frequentNodeTypes?: string[]
  }

  // Enhanced analysis (optional, added when using enhanced context builder)
  enhanced?: EnhancedContextAnalysis

  // Human-readable context descriptions for spatial/edge intelligence
  spatialDescription?: string
  edgeDescription?: string
  layoutSuggestions?: string[]

  // Streaming correlation ID — used to match emitted events to the requesting store
  requestId?: string
}

// -----------------------------------------------------------------------------
// Enhanced Context Analysis Types
// -----------------------------------------------------------------------------

export interface NodeCluster {
  id: string
  nodes: string[]
  dominantType: string
  centroid: { x: number; y: number }
}

export interface ContextChain {
  conversationId: string
  contextSources: string[]
  depth: number
}

export interface GraphAnalysis {
  clusters: NodeCluster[]
  centralNodes: string[] // Nodes with highest connectivity
  contextChains: ContextChain[]
  isolatedNodes: string[] // Nodes with no connections
}

// SpatialRegion is imported and re-exported from '../actionTypes' (line 6-7)
// Do not redefine here to avoid TS2440/TS2484 conflicts

export interface SpatialAnalysis {
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  density: number // Nodes per 1000px²
  regions: SpatialRegion[]
  overlappingNodes: string[][]
}

export interface WorkspaceAnalysis {
  totalNodes: number
  nodesByType: Record<string, number>
  projectHierarchy: Array<{ id: string; title: string; childCount: number; depth: number }>
  orphanedNodes: string[]
  recentlyModified: string[] // Placeholder for future use
}

export interface EnhancedContextAnalysis {
  graph: GraphAnalysis
  spatial: SpatialAnalysis
  workspace: WorkspaceAnalysis
}

// Default context token limits
export const AI_EDITOR_MAX_CONTEXT_TOKENS = 50000
export const AI_EDITOR_SELECTED_NODE_MAX_MESSAGES = 20
export const AI_EDITOR_RELATED_NODE_MAX_MESSAGES = 3

// -----------------------------------------------------------------------------
// AI Editor Conversation Types
// -----------------------------------------------------------------------------

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  plan?: MutationPlan
  timestamp: number
}

// -----------------------------------------------------------------------------
// AI Editor Store State Types
// -----------------------------------------------------------------------------

export interface AIEditorState {
  // Modal state
  isOpen: boolean
  isSidebarOpen: boolean
  mode: AIEditorMode
  prompt: string
  scope: AIEditorScope
  targetNodeId?: string // For 'single' scope: the specific node to edit
  useAgentMode: boolean // Use agent mode with tool use for smarter context gathering

  // Plan generation
  isGeneratingPlan: boolean
  generationError: string | null
  currentPlan: MutationPlan | null

  // Streaming state
  streamingPhase: StreamingPhase
  streamingText: string
  streamingRequestId: string | null

  // Preview
  previewState: MutationPreviewState | null
  isPreviewVisible: boolean

  // Execution
  isExecutingPlan: boolean
  executionError: string | null

  // Temp ID mapping (populated during execution)
  tempIdToRealId: Map<string, string>

  // Conversation history for refinement
  conversationHistory: ConversationMessage[]
}

export const DEFAULT_AI_EDITOR_STATE: Omit<AIEditorState, 'tempIdToRealId' | 'conversationHistory'> & { tempIdToRealId: Record<string, string>; conversationHistory: ConversationMessage[] } = {
  isOpen: false,
  isSidebarOpen: false,
  mode: 'generate',
  prompt: '',
  scope: 'selection',
  useAgentMode: true, // Default to agent mode for smarter plans
  isGeneratingPlan: false,
  generationError: null,
  currentPlan: null,
  streamingPhase: 'idle',
  streamingText: '',
  streamingRequestId: null,
  previewState: null,
  isPreviewVisible: true,
  isExecutingPlan: false,
  executionError: null,
  tempIdToRealId: {},
  conversationHistory: []
}

// -----------------------------------------------------------------------------
// IPC Types for AI Editor
// -----------------------------------------------------------------------------

export interface GeneratePlanRequest {
  context: AIEditorContext
}

export interface GeneratePlanResponse {
  success: boolean
  plan?: MutationPlan
  error?: string
}

// =============================================================================
// ACTION TEMPLATE TYPES
// =============================================================================

/**
 * Trigger conditions for action templates (simplified version for AI Editor)
 * NOTE: Renamed from ActionTrigger to avoid collision with the richer
 * discriminated union ActionTrigger in actionTypes.ts
 */
export interface AIEditorActionTrigger {
  type: 'node-created' | 'node-updated' | 'node-completed' | 'edge-created' | 'schedule' | 'manual'
  nodeType?: NodeData['type']
  condition?: string // Expression like "task.status === 'done'"
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'hourly'
    time?: string // HH:MM format
    dayOfWeek?: number // 0-6 for weekly
    dayOfMonth?: number // 1-31 for monthly
  }
}

/**
 * Action step types (simplified version for AI Editor)
 * NOTE: Renamed from ActionStep to avoid collision with the richer
 * discriminated union ActionStep in actionTypes.ts
 */
export interface AIEditorActionStep {
  type: 'ai-generate' | 'ai-summarize' | 'create-node' | 'update-node' | 'create-edge' | 'notify'
  params: Record<string, unknown>
  delay?: number // ms delay before executing
  condition?: string // Optional condition to check before executing
}

/**
 * Variable definition for template customization
 */
export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'node-type' | 'node-select'
  label: string
  description?: string
  defaultValue?: unknown
  required?: boolean
  options?: Array<{ label: string; value: unknown }>
}

/**
 * Action template for reusable automation patterns
 */
export interface ActionTemplate {
  id: string
  name: string
  description: string
  category: 'automation' | 'workflow' | 'integration' | 'deployment' | 'generation'
  icon?: string
  triggers: AIEditorActionTrigger[]
  steps: AIEditorActionStep[]
  variables: TemplateVariable[]
  createdAt: number
  updatedAt: number
  usageCount: number
  isBuiltIn: boolean
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

/**
 * Phases of plan generation
 */
export type StreamingPhase =
  | 'idle'        // Not generating
  | 'connecting'  // Establishing API connection
  | 'analyzing'   // AI is reading the context
  | 'thinking'    // AI is reasoning about the request
  | 'generating'  // AI is outputting the plan
  | 'parsing'     // Parsing final JSON
  | 'complete'    // Successfully finished
  | 'cancelled'   // User cancelled
  | 'error'       // Failed

/**
 * Valid state transitions for streaming phase state machine
 */
export const STREAMING_VALID_TRANSITIONS: Record<StreamingPhase, StreamingPhase[]> = {
  idle: ['connecting'],
  connecting: ['analyzing', 'error', 'cancelled'],
  analyzing: ['thinking', 'generating', 'error', 'cancelled'],
  thinking: ['generating', 'error', 'cancelled'],
  generating: ['parsing', 'error', 'cancelled'],
  parsing: ['complete', 'error', 'cancelled'],
  complete: ['idle'],
  cancelled: ['idle'],
  error: ['idle']
}

/**
 * Payload for phase change events
 * CRITICAL: requestId required to match events to correct generation request
 */
export interface PlanPhasePayload {
  /** Request ID for matching events to generation */
  requestId: string
  phase: StreamingPhase
  message?: string  // Human-readable status, e.g., "Analyzing 12 nodes..."
}

/**
 * Payload for operation chunk events
 * CRITICAL: requestId required to prevent cross-pollination between concurrent requests
 */
export interface PlanChunkPayload {
  /** Request ID for matching events to generation */
  requestId: string
  /** Index of this operation in the plan (0-based) */
  index: number
  /** The operation that was parsed */
  operation: MutationOp
  /** Estimated total operations (may change as more stream in) */
  estimatedTotal?: number
}

/**
 * Payload for plan completion
 */
export interface PlanCompletePayload {
  /** Request ID for matching events to generation */
  requestId: string
  plan: MutationPlan
  /** Total generation time in milliseconds */
  durationMs: number
}

/**
 * Payload for plan errors
 */
export interface PlanErrorPayload {
  /** Request ID for matching events to generation */
  requestId: string
  error: string
  /** Phase where error occurred */
  phase: StreamingPhase
  /** Whether this is retryable */
  retryable: boolean
  /** Partial operations if any were parsed before error */
  partialOperations?: MutationOp[]
}

/**
 * Payload for cancellation acknowledgment
 */
export interface PlanCancelledPayload {
  /** Request ID for matching events to generation */
  requestId: string
  /** Operations that were parsed before cancellation */
  partialOperations: MutationOp[]
  /** Phase when cancelled */
  cancelledAt: StreamingPhase
}

/**
 * AI Editor operation modes
 */
export type AIEditorMode = 'generate' | 'edit' | 'organize' | 'automate' | 'ask'

/**
 * AI Editor mode descriptions for UI
 */
export const AI_EDITOR_MODE_DESCRIPTIONS: Record<AIEditorMode, { label: string; description: string; icon: string }> = {
  generate: {
    label: 'Generate',
    description: 'Create new nodes and connections based on prompt (brainstorm, expand, fill gaps)',
    icon: 'Sparkles'
  },
  edit: {
    label: 'Edit',
    description: 'Modify content of selected nodes (rewrite, expand, summarize)',
    icon: 'Pencil'
  },
  organize: {
    label: 'Organize',
    description: 'Arrange and layout nodes spatially (align, distribute, group by type)',
    icon: 'LayoutGrid'
  },
  automate: {
    label: 'Automate',
    description: 'Create action nodes with triggers and conditions',
    icon: 'Zap'
  },
  ask: {
    label: 'Ask',
    description: 'Ask questions about your workspace content',
    icon: 'MessageCircle'
  }
}

/**
 * AI Editor operation scope
 */
export type AIEditorScope = 'selection' | 'canvas' | 'workspace' | 'single' | 'view'

/**
 * AI Editor scope descriptions for UI
 */
export const AI_EDITOR_SCOPE_DESCRIPTIONS: Record<AIEditorScope, { label: string; description: string }> = {
  selection: {
    label: 'Selection',
    description: 'Only selected nodes and their immediate connections'
  },
  canvas: {
    label: 'Canvas',
    description: 'All nodes currently visible in the viewport'
  },
  workspace: {
    label: 'Workspace',
    description: 'The entire workspace (may be slow for large workspaces)'
  },
  single: {
    label: 'Single Node',
    description: 'Target a specific node by ID'
  },
  view: {
    label: 'Viewport',
    description: 'Current visible area of the canvas'
  }
}
