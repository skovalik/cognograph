// =============================================================================
// common.ts -- Foundational types with no domain dependencies
//
// Contains: Attachment, NodeShape, ContextMetadata, ActivationTrigger,
// NodeActivationCondition, PropertySystem types, DeepPartial
// =============================================================================

// -----------------------------------------------------------------------------
// Attachment Types
// -----------------------------------------------------------------------------

export interface Attachment {
  id: string
  filename: string
  originalPath: string
  storedPath: string // relative path within workspace attachments dir
  mimeType: string
  size: number // bytes
  addedAt: string // ISO date
  thumbnail?: string // base64 data URL for images
}

// -----------------------------------------------------------------------------
// Node Shape Types
// -----------------------------------------------------------------------------

export type NodeShape = 'rectangle' | 'rounded' | 'pill' | 'hexagon'

// -----------------------------------------------------------------------------
// Context Metadata (shared across node types)
// -----------------------------------------------------------------------------

export interface ContextMetadata {
  // Context injection settings
  contextRole?: 'reference' | 'instruction' | 'example' | 'background' | 'scope'
  contextPriority?: 'low' | 'medium' | 'high'
  contextLabel?: string // Custom label for context

  // Context traversal settings (per-node overrides)
  contextDepth?: number // null = use global default
  includeInContext?: boolean // default: true, allows exclusion from context

  // Node enabled/disabled state
  enabled?: boolean // default: true, if false node is greyed out and disabled
  activationCondition?: NodeActivationCondition // Optional conditional activation

  // Semantic metadata
  tags?: string[] // User-defined tags
  summary?: string // Brief summary for context
  keyEntities?: string[] // Important entities/concepts mentioned

  // Visual customization
  icon?: string // Custom Lucide icon name (e.g., 'star', 'heart', 'bookmark')
  iconColor?: string // Optional custom icon color (defaults to node color)
  nodeShape?: NodeShape // Node shape: rectangle, rounded, pill, hexagon (default: rectangle)
  hiddenProperties?: string[] // Property IDs hidden from card display
  transparent?: boolean // Per-node glass override (true=force glass, false=force solid, undefined=follow global)

  // Node folding (collapse children)
  collapsed?: boolean // If true, child nodes (via childNodeIds or outgoing edges) are hidden

  // Flexible positioning (pinned vs auto)
  layoutMode?: 'auto' | 'pinned' // 'pinned' = manually positioned, 'auto' = responds to auto-layout

  // Relationship hints
  relationshipType?: 'depends-on' | 'related-to' | 'implements' | 'references' | 'blocks'

  // Usage tracking (auto-updated)
  lastAccessedAt?: number
  accessCount?: number

  // Workspace integration
  useWorkspaceDefaults?: boolean // default: true, inherit settings from workspace nodes
  workspaceOverrides?: {
    llm?: Partial<{
      provider: 'anthropic' | 'gemini' | 'openai'
      model: string
      temperature: number
      maxTokens: number
      systemPrompt: string
    }>
    context?: Partial<{
      maxTokens: number
      maxDepth: number
      traversalMode: 'all' | 'ancestors-only' | 'custom'
      includeDisabledNodes: boolean
    }>
    theme?: string // Override color
  }

  // Outgoing edge color settings
  outgoingEdgeColor?: string // Color for new outgoing edges from this node

  // Node dimensions (for resizing)
  width?: number
  height?: number

  // File attachments
  attachments?: Attachment[]

  // Archiving (soft-hide from canvas without deleting)
  isArchived?: boolean
  archivedAt?: number
  archivedFromPosition?: { x: number; y: number }
}

// -----------------------------------------------------------------------------
// Node Activation Condition Types
// -----------------------------------------------------------------------------

export type ActivationTrigger = 'any-connected' | 'all-connected' | 'specific-node' | 'edge-property'

export interface NodeActivationCondition {
  trigger: ActivationTrigger
  // For 'specific-node' - the node ID that must be enabled
  sourceNodeId?: string
  // For 'edge-property' - the edge property and value to check
  edgeProperty?: string
  edgePropertyValue?: string | number | boolean
  // Invert the condition (enable when condition is NOT met)
  invert?: boolean
}

// -----------------------------------------------------------------------------
// Property System Types
// -----------------------------------------------------------------------------

export type PropertyType =
  | 'text' // Single line text
  | 'textarea' // Multi-line text
  | 'number' // Numeric value
  | 'select' // Single choice from options
  | 'multi-select' // Multiple choices from options
  | 'checkbox' // Boolean
  | 'date' // Date picker
  | 'datetime' // Date + time picker
  | 'url' // URL with validation
  | 'email' // Email with validation
  | 'status' // Special: status workflow (todo/in-progress/done)
  | 'priority' // Special: priority levels (low/medium/high)
  | 'relation' // Link to another node

export interface PropertyOption {
  value: string
  label: string
  color?: string // For visual tags
  icon?: string // Lucide icon name
}

export interface PropertyDefinition {
  id: string
  name: string // Display name
  type: PropertyType

  // Type-specific config
  options?: PropertyOption[] // For select/multi-select
  defaultValue?: unknown
  enableRichText?: boolean // For textarea: enable rich text formatting

  // Validation
  required?: boolean
  min?: number // For number
  max?: number // For number
  pattern?: string // Regex for text/url/email

  // Display
  icon?: string // Lucide icon name
  color?: string // For visual grouping
  showInCard?: boolean // Display on node card
  showInList?: boolean // Display in layers panel
}

export interface PropertySchema {
  // Custom property definitions (user-created)
  customProperties: PropertyDefinition[]

  // Options added to built-in properties (like new tags)
  builtinPropertyOptions: Record<string, PropertyOption[]>

  // Which properties are enabled per node type
  nodeTypeProperties: Record<string, string[]> // nodeType -> propertyIds

  // Default property values per node type (applied when creating new nodes)
  defaults?: Record<string, Record<string, unknown>> // nodeType -> { propertyId: defaultValue }
}

// -----------------------------------------------------------------------------
// Design Token Types
// -----------------------------------------------------------------------------

export type DesignTokenType = 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'opacity' | 'custom'

export interface DesignToken {
  value: string
  type: DesignTokenType
  description?: string
  category?: string
}

export interface DesignTokenSet {
  name: string
  description?: string
  tokens: Record<string, DesignToken>
}

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
