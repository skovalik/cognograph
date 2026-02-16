// =============================================================================
// nodes.ts -- Node data interfaces and related types
//
// Contains: All 8 NodeData interfaces, NodeData union, Message, ContextSource,
// Agent types, workspace node defaults, type guard functions
// =============================================================================

import type { ContextMetadata } from './common'
import type { ExtractionSettings } from './extraction'
import type { ActionNodeData } from '../actionTypes'

// Re-export for convenience (these are used by NodeData union consumers)
export type { ActionNodeData } from '../actionTypes'

// -----------------------------------------------------------------------------
// Node Data Types (Discriminated Union)
// -----------------------------------------------------------------------------

export interface ConversationNodeData extends ContextMetadata {
  type: 'conversation'
  title: string
  messages: Message[]
  provider: 'anthropic' | 'gemini' | 'openai'
  parentId?: string
  color?: string // Custom node color
  collapsed?: boolean // Collapsed preview state
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown> // Flexible property storage
  extractionSettings?: ExtractionSettings // Auto-extraction configuration
  extractedTitles?: string[] // For duplicate detection

  // Agent mode settings
  mode?: 'chat' | 'agent' // Default: 'chat' (undefined = 'chat' for migration)
  agentSettings?: AgentSettings

  // Agent-specific fields (only meaningful when mode === 'agent')
  agentPreset?: string               // Preset template ID (e.g., 'canvas', 'code', 'research', 'custom')
  agentMemory?: AgentMemory          // Persistent memory across runs
  agentStatus?: AgentStatus          // Current lifecycle state
  lastRunAt?: string                 // ISO timestamp of last agent run
  totalTokensUsed?: number           // Cumulative tokens across all runs
  totalCostUSD?: number              // Cumulative estimated cost (USD)
  agentRunHistory?: AgentRunSummary[] // Last N run summaries (capped at 20)

  [key: string]: unknown
}

export interface ProjectNodeData extends ContextMetadata {
  type: 'project'
  title: string
  description: string
  collapsed: boolean
  childNodeIds: string[]
  color: string
  width?: number
  height?: number
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown> // Flexible property storage
  [key: string]: unknown
}

export type NoteMode = 'general' | 'persona' | 'reference' | 'examples' | 'background' | 'design-tokens' | 'page' | 'component' | 'content-model' | 'wp-config'

// -----------------------------------------------------------------------------
// Site Architecture Types (Page & Component note modes)
// -----------------------------------------------------------------------------

export type PageStatus = 'planned' | 'wireframed' | 'designed' | 'built' | 'live'
export type ComponentStatus = 'planned' | 'designed' | 'built' | 'tested'
export type ComponentType = 'section' | 'layout' | 'ui' | 'form' | 'nav' | 'footer' | 'utility'
export type ComponentLibrary = 'custom' | 'shadcn' | 'reactbits' | 'reactbits-pro'
export type PropType = 'string' | 'number' | 'boolean' | 'image' | 'richtext' | 'array' | 'enum'
export type ResponsiveBehavior = 'show' | 'hide' | 'stack' | 'collapse'

export interface ComponentRef {
  name: string
  artifactNodeId?: string
  designTokenNodeId?: string
  props?: Record<string, unknown>
  order: number
}

export interface PageSeoSettings {
  metaDescription?: string
  ogImage?: string
  noIndex?: boolean
}

export interface PageNoteFields {
  route: string
  title: string
  template?: string
  components: ComponentRef[]
  seo?: PageSeoSettings
  status: PageStatus
  previewUrl?: string
  contentSource?: 'static' | 'cms'
  cmsType?: string
  dynamicSegments?: string[]
}

export interface PropDefinition {
  name: string
  type: PropType
  required: boolean
  default?: string
  enumValues?: string[]
  description?: string
  cmsField?: string
}

export interface ComponentNoteFields {
  name: string
  type: ComponentType
  library?: ComponentLibrary
  libraryComponent?: string
  props: PropDefinition[]
  slots?: string[]
  responsive?: {
    mobile: ResponsiveBehavior
    tablet: ResponsiveBehavior
  }
  artifactNodeId?: string
  figmaUrl?: string
  status: ComponentStatus
}

// -----------------------------------------------------------------------------
// Content Model Types (WordPress CPT + ACF)
// -----------------------------------------------------------------------------

export type ACFFieldType =
  | 'text' | 'textarea' | 'wysiwyg' | 'number' | 'url' | 'email'
  | 'image' | 'gallery' | 'select' | 'checkbox' | 'radio'
  | 'repeater' | 'flexible_content' | 'relationship'
  | 'date_picker' | 'color_picker' | 'true_false' | 'file'

export interface ACFField {
  name: string
  label: string
  type: ACFFieldType
  required: boolean
  instructions?: string
  choices?: string[]
  subFields?: ACFField[]
  layouts?: FlexibleLayout[]
  relatedPostType?: string
  mapsToComponentProp?: string
}

export interface FlexibleLayout {
  name: string
  label: string
  fields: ACFField[]
}

export interface TaxonomyRef {
  name: string
  label: string
  hierarchical: boolean
  terms?: string[]
}

export interface ACFFieldGroup {
  name: string
  label: string
  fields: ACFField[]
}

export type ContentModelSupport = 'title' | 'editor' | 'thumbnail' | 'excerpt' | 'custom-fields'

export interface ContentModelFields {
  postType: string
  singularLabel: string
  pluralLabel: string
  slug: string
  icon?: string
  supports: ContentModelSupport[]
  fieldGroups: ACFFieldGroup[]
  taxonomies: TaxonomyRef[]
  graphqlSingleName?: string
  graphqlPluralName?: string
}

// -----------------------------------------------------------------------------
// WordPress Config Types
// -----------------------------------------------------------------------------

export type WPAuthMethod = 'application-password' | 'jwt' | 'oauth'
export type WPEnvironment = 'development' | 'staging' | 'production'

export interface WPConfigFields {
  siteUrl: string
  graphqlEndpoint?: string
  restEndpoint?: string
  authMethod: WPAuthMethod
  credentialKey: string
  frontendUrl?: string
  deployHookUrl?: string
  environment: WPEnvironment
}

export interface NoteNodeData extends ContextMetadata {
  type: 'note'
  title: string
  content: string
  contentFormat?: 'plain' | 'html' // Track content format for rich text editing
  noteMode?: NoteMode // Preset mode that auto-configures contextRole/contextPriority
  page?: PageNoteFields // Structured data for noteMode === 'page'
  component?: ComponentNoteFields // Structured data for noteMode === 'component'
  contentModel?: ContentModelFields // Structured data for noteMode === 'content-model'
  wpConfig?: WPConfigFields // Structured data for noteMode === 'wp-config'
  parentId?: string
  color?: string // Custom node color
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown> // Flexible property storage
  [key: string]: unknown
}

export interface TaskNodeData extends ContextMetadata {
  type: 'task'
  title: string
  description: string
  descriptionFormat?: 'plain' | 'html' // Track description format for rich text editing
  status: 'todo' | 'in-progress' | 'done'
  priority: 'none' | 'low' | 'medium' | 'high'
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very-complex'
  dueDate?: number // Optional due date timestamp
  parentId?: string
  color?: string // Custom node color
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown> // Flexible property storage
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Artifact Types
// -----------------------------------------------------------------------------

export type ArtifactContentType =
  | 'code' // Source code files
  | 'markdown' // Markdown documents
  | 'html' // HTML (rendered preview available)
  | 'svg' // SVG graphics
  | 'mermaid' // Mermaid diagrams
  | 'json' // JSON data
  | 'text' // Plain text
  | 'csv' // Tabular data
  | 'image' // Base64 encoded images
  | 'custom' // User-defined custom type

export type ArtifactSource =
  | { type: 'file-drop'; filename: string; originalPath?: string }
  | { type: 'llm-response'; conversationId: string; messageId: string }
  | { type: 'url'; url: string }
  | { type: 'created'; method: 'manual' | 'extracted' }

export interface ArtifactVersion {
  version: number
  content: string
  timestamp: number
  changeSource: 'user-edit' | 'llm-update' | 'fork'
}

// Individual file within a multi-file artifact
export interface ArtifactFile {
  id: string // Unique identifier for the file
  filename: string // Display name (e.g., "index.ts", "styles.css")
  content: string // File content
  contentType: ArtifactContentType
  customContentType?: string // Used when contentType === 'custom'
  language?: string // For code files
  order: number // Display order in tabs
}

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

export interface ArtifactNodeData extends ContextMetadata {
  type: 'artifact'
  title: string

  // Content - single file mode (legacy, still supported)
  content: string // The actual file content
  contentType: ArtifactContentType // What kind of artifact
  customContentType?: string // Used when contentType === 'custom'
  language?: string // For code: 'typescript', 'python', etc.

  // Multi-file mode (optional)
  files?: ArtifactFile[] // Multiple files in one artifact
  activeFileId?: string // Currently selected file ID

  // Source tracking
  source: ArtifactSource
  sourceNodeId?: string // If spawned from a conversation
  sourceMessageId?: string // Specific message that created it

  // Versioning
  version: number // Increments on edit
  versionHistory: ArtifactVersion[] // Previous versions (limited to 10)
  versioningMode: 'update' | 'fork' // User preference per artifact

  // Injection settings
  injectionFormat: 'full' | 'summary' | 'chunked' | 'reference-only'
  maxInjectionTokens?: number // Limit for chunked mode

  // Display
  collapsed: boolean
  previewLines: number // How many lines to show when collapsed
  color?: string // Custom node color

  // Preview fields (optional — only used when previewEnabled is true)
  previewEnabled?: boolean          // When true, renders iframe instead of code editor
  previewUrl?: string               // e.g., "http://localhost:3000"
  previewPath?: string              // e.g., "/about" — appended to URL
  previewScale?: number             // 0.5 to 1.0, default 1.0
  previewViewport?: PreviewViewport // viewport preset: 'desktop' | 'tablet' | 'mobile'
  previewAutoRefresh?: boolean      // auto-refresh on content change
  previewRefreshInterval?: number   // ms, default 2000 (minimum 1000, 0 = disabled)

  // Standard fields
  parentId?: string
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown> // Flexible property storage
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Workspace Node Types
// -----------------------------------------------------------------------------

export interface WorkspaceLLMSettings {
  provider: 'anthropic' | 'gemini' | 'openai'
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

// -----------------------------------------------------------------------------
// Agent Mode Types
// -----------------------------------------------------------------------------

export interface AgentSettings {
  // Tool permissions — canvas
  canCreateNodes: boolean
  canDeleteNodes: boolean
  canModifyNodes: boolean
  canCreateEdges: boolean
  canDeleteEdges: boolean

  // Behavior
  autoExecuteTools: boolean // If false, ask for confirmation
  maxToolCallsPerTurn: number // Prevent runaway loops (default: 10)

  // Context scope for agent operations
  scopeMode: 'connected' | 'selection' | 'viewport' | 'workspace'

  // Filesystem tools (Path B)
  canReadFiles: boolean
  canWriteFiles: boolean
  canExecuteCommands: boolean
  allowedPaths: string[]    // filesystem sandbox — empty = no access
  allowedCommands: string[] // command whitelist — empty = all allowed (with canExecuteCommands)

  // MCP client (Path C) — server config IDs to expose to this agent
  mcpServers: string[]
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  // Canvas tools
  canCreateNodes: true,
  canDeleteNodes: false, // Conservative default
  canModifyNodes: true,
  canCreateEdges: true,
  canDeleteEdges: false,
  autoExecuteTools: true,
  maxToolCallsPerTurn: 10,
  scopeMode: 'connected',

  // Filesystem — conservative defaults (all off)
  canReadFiles: false,
  canWriteFiles: false,
  canExecuteCommands: false,
  allowedPaths: [],
  allowedCommands: [],
  mcpServers: [],
}

export interface AgentToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export type AgentErrorType =
  | 'api_auth' // API key issues
  | 'api_rate_limit' // Rate limited
  | 'api_network' // Network issues
  | 'tool_execution' // Tool failed
  | 'tool_permission' // Permission denied
  | 'max_iterations' // Too many tool calls

export interface AgentError {
  type: AgentErrorType
  message: string
  toolName?: string
  toolUseId?: string
  recoverable: boolean
}

// -----------------------------------------------------------------------------
// Agent Status & Memory Types
// -----------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed'

export const DEFAULT_AGENT_STATUS: AgentStatus = 'idle'

export interface MemoryEntry {
  key: string           // Lookup key (e.g., 'project_root', 'coding_style')
  value: string         // Content (free-form text)
  createdAt: string     // ISO timestamp
  updatedAt?: string    // ISO timestamp of last update
  source: 'agent' | 'user'  // Who created/modified this entry
}

export interface AgentMemory {
  entries: MemoryEntry[]
  maxEntries: number       // Max number of entries (default: 50)
  maxKeyLength: number     // Max characters per key (default: 100)
  maxValueLength: number   // Max characters per value (default: 10000)
}

export const DEFAULT_AGENT_MEMORY: AgentMemory = {
  entries: [],
  maxEntries: 50,
  maxKeyLength: 100,
  maxValueLength: 10000
}

export interface AgentRunSummary {
  runId: string
  startedAt: string       // ISO timestamp
  completedAt?: string    // ISO timestamp
  status: 'completed' | 'error' | 'cancelled' | 'paused'
  toolCallCount: number
  tokensUsed: number
  costUSD: number
  errorMessage?: string
  summary?: string        // Agent-generated summary of what it did
}

export const DEFAULT_AGENT_NODE_EXTENSIONS = {
  agentPreset: 'custom',
  agentMemory: DEFAULT_AGENT_MEMORY,
  agentStatus: 'idle' as AgentStatus,
  lastRunAt: undefined,
  totalTokensUsed: 0,
  totalCostUSD: 0,
  agentRunHistory: [] as AgentRunSummary[]
}

// -----------------------------------------------------------------------------
// Agent Preset Type
// -----------------------------------------------------------------------------

export interface AgentPreset {
  id: string
  name: string
  description: string
  icon: string                         // Lucide icon name
  systemPromptPrefix?: string          // Prepended BEFORE the default agent system prompt
  agentSettings: Partial<AgentSettings> // Overrides — merged as { ...DEFAULT_AGENT_SETTINGS, ...preset.agentSettings }
  memorySeeds?: MemoryEntry[]          // Pre-populated memory entries
  suggestedConnections?: string[]      // Node types to suggest connecting (e.g., ['artifact', 'note'])
}

export interface WorkspaceContextRules {
  maxTokens: number
  maxDepth: number
  traversalMode: 'all' | 'ancestors-only' | 'custom'
  includeDisabledNodes: boolean
}

export interface WorkspaceThemeDefaults {
  conversation?: string
  note?: string
  task?: string
  artifact?: string
  text?: string
  action?: string
}

export interface WorkspaceNodeData extends ContextMetadata {
  type: 'workspace'
  title: string
  description: string

  // Visibility
  showOnCanvas: boolean // Toggle canvas visibility
  showLinks: boolean // Show links to member nodes (default: false)
  linkColor: string // Distinct color for workspace links (default: '#ef4444' red)
  linkDirection: 'to-members' | 'from-members' | 'bidirectional' // Direction of links (default: 'to-members')

  // LLM Defaults - inherited by conversation nodes in this workspace
  llmSettings: WorkspaceLLMSettings

  // Context Rules - applied during context building
  contextRules: WorkspaceContextRules

  // Theme Defaults - colors for nodes in this workspace
  themeDefaults: WorkspaceThemeDefaults

  // Membership
  includedNodeIds: string[] // Nodes that belong to this workspace
  excludedNodeIds: string[] // Exclusions override inclusions

  // Standard fields
  color?: string // Custom node color
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown>
  [key: string]: unknown
}

export const DEFAULT_WORKSPACE_LLM_SETTINGS: WorkspaceLLMSettings = {
  provider: 'anthropic',
  temperature: 0.7,
  maxTokens: 4096
}

export const DEFAULT_WORKSPACE_CONTEXT_RULES: WorkspaceContextRules = {
  maxTokens: 8000,
  maxDepth: 2,
  traversalMode: 'all',
  includeDisabledNodes: false
}

export interface TextNodeData extends ContextMetadata {
  type: 'text'
  content: string // HTML from TipTap
  contentFormat?: 'plain' | 'html'
  parentId?: string
  color?: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

// -----------------------------------------------------------------------------
// Orchestrator Types
// -----------------------------------------------------------------------------

export type OrchestratorStrategy = 'sequential' | 'parallel' | 'conditional'

export type FailurePolicyType = 'retry-and-continue' | 'skip-failed' | 'abort-all'

export interface FailurePolicy {
  type: FailurePolicyType
  /** Max retries per agent before applying the policy. Default: 1 */
  maxRetries: number
  /** Delay in ms between retries. Default: 2000 */
  retryDelayMs: number
}

export const DEFAULT_FAILURE_POLICY: FailurePolicy = {
  type: 'retry-and-continue',
  maxRetries: 1,
  retryDelayMs: 2000,
}

export interface OrchestratorBudget {
  /** Max total tokens across all agents in a single run. undefined = unlimited */
  maxTotalTokens?: number
  /** Max total cost in USD across all agents. undefined = unlimited */
  maxTotalCostUSD?: number
  /** Max tokens for any single agent run. undefined = unlimited */
  maxTokensPerAgent?: number
  /** Max cost for any single agent run. undefined = unlimited */
  maxCostPerAgent?: number
}

export const DEFAULT_ORCHESTRATOR_BUDGET: OrchestratorBudget = {
  maxTotalTokens: undefined,
  maxTotalCostUSD: undefined,
  maxTokensPerAgent: undefined,
  maxCostPerAgent: undefined,
}

export type OrchestratorConditionType =
  | 'agent-succeeded'
  | 'agent-failed'
  | 'output-contains'
  | 'output-matches'
  | 'token-count-below'
  | 'custom-expression'

export interface OrchestratorCondition {
  id: string
  type: OrchestratorConditionType
  /** For output-contains/output-matches: the value to check against */
  value?: string
  /** For token-count-below: the threshold */
  threshold?: number
  /** For custom-expression: a safe JS expression (NOT implemented in Phase 1) */
  expression?: string
  /** Invert the condition result */
  invert: boolean
}

export type ConnectedAgentStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying'

export interface ConnectedAgent {
  /** Node ID of the conversation node in agent mode */
  nodeId: string
  /** Execution order for sequential strategy (0-based). Ignored for parallel. */
  order: number
  /** Optional prompt override injected into the agent's context */
  promptOverride?: string
  /** For conditional strategy: conditions that must pass for this agent to run */
  conditions: OrchestratorCondition[]
  /** Runtime status — set during orchestration, reset on new run */
  status: ConnectedAgentStatus
  /** Number of retries attempted in current run */
  retryCount: number
  /** Last error message if status is 'failed' */
  lastError?: string
}

export interface OrchestratorAgentResult {
  agentNodeId: string
  status: 'completed' | 'failed' | 'skipped'
  /** Final text output from the agent (last assistant message) */
  output?: string
  /** Error message if failed */
  error?: string
  /** Token usage for this agent run */
  inputTokens: number
  outputTokens: number
  costUSD: number
  /** Duration in ms */
  durationMs: number
  /** Number of tool calls made */
  toolCallCount: number
  startedAt: number
  completedAt: number
}

export type OrchestratorRunStatus =
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'completed-with-errors'
  | 'failed'
  | 'aborted'

export interface OrchestratorRun {
  id: string
  status: OrchestratorRunStatus
  strategy: OrchestratorStrategy
  startedAt: number
  completedAt?: number
  /** Per-agent results in execution order */
  agentResults: OrchestratorAgentResult[]
  /** Aggregate token usage */
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUSD: number
  /** Total duration in ms */
  totalDurationMs: number
  /** Error that caused abort/failure (if any) */
  error?: string
  /** ID of the parent orchestration if triggered by another orchestrator (cycle detection) */
  parentOrchestrationId?: string
}

export interface OrchestratorNodeData extends ContextMetadata {
  type: 'orchestrator'
  title: string
  description?: string

  // Pipeline configuration
  strategy: OrchestratorStrategy
  failurePolicy: FailurePolicy
  budget: OrchestratorBudget

  // Connected agents — mirrors spatial graph, with ordering and conditions
  connectedAgents: ConnectedAgent[]

  // Run state
  currentRun?: OrchestratorRun
  runHistory: OrchestratorRun[]
  /** Max runs to keep in history. Default: 20 */
  maxHistoryRuns: number

  // Visual
  color?: string
  collapsed?: boolean

  // Standard fields
  parentId?: string
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown>
  [key: string]: unknown
}

export function createOrchestratorData(): OrchestratorNodeData {
  return {
    type: 'orchestrator',
    title: 'New Orchestrator',
    description: '',
    strategy: 'sequential',
    failurePolicy: { ...DEFAULT_FAILURE_POLICY },
    budget: { ...DEFAULT_ORCHESTRATOR_BUDGET },
    connectedAgents: [],
    runHistory: [],
    maxHistoryRuns: 20,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export type NodeData =
  | ConversationNodeData
  | ProjectNodeData
  | NoteNodeData
  | TaskNodeData
  | ArtifactNodeData
  | WorkspaceNodeData
  | TextNodeData
  | ActionNodeData
  | OrchestratorNodeData

// -----------------------------------------------------------------------------
// Message Types
// -----------------------------------------------------------------------------

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result'
  content: string
  timestamp: number
  contextSources?: ContextSource[]

  // Token usage (from actual API response, not estimation)
  inputTokens?: number
  outputTokens?: number
  costUSD?: number // Computed from MODEL_PRICING at time of response

  // Agent mode extensions
  toolName?: string // For tool_use: which tool was called
  toolInput?: Record<string, unknown> // For tool_use: input parameters
  toolUseId?: string // For tool_use: unique ID for this tool call
  toolResultFor?: string // For tool_result: which toolUseId this answers
  isError?: boolean // For tool_result: was this an error?
}

export interface ContextSource {
  nodeId: string
  nodeType: NodeData['type']
  title: string
  excerpt: string
}

// -----------------------------------------------------------------------------
// Type Guards
// -----------------------------------------------------------------------------

export function isConversationNode(data: NodeData): data is ConversationNodeData {
  return data.type === 'conversation'
}

export function isProjectNode(data: NodeData): data is ProjectNodeData {
  return data.type === 'project'
}

export function isNoteNode(data: NodeData): data is NoteNodeData {
  return data.type === 'note'
}

export function isTaskNode(data: NodeData): data is TaskNodeData {
  return data.type === 'task'
}

export function isArtifactNode(data: NodeData): data is ArtifactNodeData {
  return data.type === 'artifact'
}

export function isWorkspaceNode(data: NodeData): data is WorkspaceNodeData {
  return data.type === 'workspace'
}

export function isTextNode(data: NodeData): data is TextNodeData {
  return data.type === 'text'
}

export function isActionNode(data: NodeData): data is ActionNodeData {
  return data.type === 'action'
}

export function isOrchestratorNode(data: NodeData): data is OrchestratorNodeData {
  return data.type === 'orchestrator'
}
