// =============================================================================
// src/shared/types/index.ts -- Barrel re-export
//
// This file preserves ALL existing import paths. Consumers continue to use:
//   import { NodeData, EdgeData, ... } from '@shared/types'
//   import type { ThemeSettings, ... } from '@shared/types'
//
// Runtime values use `export { }` and pure types use `export type { }`.
// =============================================================================

// --- common.ts ---
export type {
  Attachment,
  NodeShape,
  ContextMetadata,
  ActivationTrigger,
  NodeActivationCondition,
  PropertyType,
  PropertyOption,
  PropertyDefinition,
  PropertySchema,
  DeepPartial,
  DesignTokenType,
  DesignToken,
  DesignTokenSet,
} from './common'

// --- nodes.ts ---
export type {
  ConversationNodeData,
  ProjectNodeData,
  NoteMode,
  PageStatus,
  ComponentStatus,
  ComponentType,
  ComponentLibrary,
  PropType,
  ResponsiveBehavior,
  ComponentRef,
  PageSeoSettings,
  PageNoteFields,
  PropDefinition,
  ComponentNoteFields,
  NoteNodeData,
  ACFFieldType,
  ACFField,
  FlexibleLayout,
  TaxonomyRef,
  ACFFieldGroup,
  ContentModelSupport,
  ContentModelFields,
  WPAuthMethod,
  WPEnvironment,
  WPConfigFields,
  TaskNodeData,
  ArtifactContentType,
  ArtifactSource,
  ArtifactVersion,
  ArtifactFile,
  ArtifactNodeData,
  PreviewViewport,
  WorkspaceLLMSettings,
  AgentSettings,
  AgentToolDefinition,
  AgentErrorType,
  AgentError,
  AgentStatus,
  MemoryEntry,
  AgentMemory,
  AgentRunSummary,
  AgentPreset,
  WorkspaceContextRules,
  WorkspaceThemeDefaults,
  WorkspaceNodeData,
  TextNodeData,
  NodeData,
  Message,
  ContextSource,
  // Orchestrator types
  OrchestratorStrategy,
  FailurePolicyType,
  FailurePolicy,
  OrchestratorBudget,
  OrchestratorConditionType,
  OrchestratorCondition,
  ConnectedAgentStatus,
  ConnectedAgent,
  OrchestratorAgentResult,
  OrchestratorRunStatus,
  OrchestratorRun,
  OrchestratorNodeData,
} from './nodes'

export {
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_AGENT_STATUS,
  DEFAULT_AGENT_MEMORY,
  DEFAULT_AGENT_NODE_EXTENSIONS,
  DEFAULT_WORKSPACE_LLM_SETTINGS,
  DEFAULT_WORKSPACE_CONTEXT_RULES,
  isConversationNode,
  isProjectNode,
  isNoteNode,
  isTaskNode,
  isArtifactNode,
  isWorkspaceNode,
  isTextNode,
  isActionNode,
  isOrchestratorNode,
  // Orchestrator defaults
  DEFAULT_FAILURE_POLICY,
  DEFAULT_ORCHESTRATOR_BUDGET,
  createOrchestratorData,
} from './nodes'

// Re-export ActionNodeData, SpatialRegion, and RunAgentStep from actionTypes (preserves existing re-export)
export type { ActionNodeData, SpatialRegion, RunAgentStep } from '../actionTypes'

// --- edges.ts ---
export type {
  EdgeLineStyle,
  EdgeArrowStyle,
  EdgeStrokePreset,
  EdgeWaypoint,
  EdgeStrength,
  EdgeData,
  EdgeLabelPreset,
  EdgeStyle,
} from './edges'

export {
  DEFAULT_EDGE_DATA,
  migrateEdgeStrength,
  getContextDepthFromStrength,
  EDGE_LABEL_PRESETS,
} from './edges'

// --- workspace.ts ---
export type {
  WorkspaceData,
  WorkspaceInfo,
  AppSettings,
  LLMStreamOptions,
  IPCResponse,
  ContextSettings,
  ContextNode,
  PropertiesDisplayMode,
  ChatDisplayMode,
  MCPRecommendation,
  ProjectType,
  EncryptedCredential,
  WorkspacePreferences,
} from './workspace'

export {
  DEFAULT_CONTEXT_SETTINGS,
  DEFAULT_WORKSPACE_PREFERENCES,
} from './workspace'

// --- theme.ts ---
export type {
  ThemeMode,
  ThemePresetColors,
  ThemePreset,
  CustomThemePreset,
  GuiColors,
  ThemeSettings,
  AmbientEffectType,
  AmbientEffectSettings,
} from './theme'

export {
  DEFAULT_GUI_COLORS_DARK,
  DEFAULT_GUI_COLORS_LIGHT,
  DEFAULT_AMBIENT_EFFECT,
  LIGHT_MODE_PRESETS,
  DEFAULT_LINK_COLORS_DARK,
  DEFAULT_LINK_COLORS_LIGHT,
  DEFAULT_THEME_SETTINGS,
  LIGHT_THEME_DEFAULTS,
} from './theme'

// --- templates.ts ---
export type {
  PlaceholderType,
  PlaceholderDefinition,
  TemplateNode,
  TemplateEdge,
  TemplateFolder,
  NodeTemplate,
  TemplateLibrary,
} from './templates'

export {
  DEFAULT_TEMPLATE_LIBRARY,
  PLACEHOLDER_PATTERNS,
  SYSTEM_TEMPLATES,
} from './templates'

// --- ai-editor.ts ---
export type {
  RelativePosition,
  MutationOp,
  PlanWarningLevel,
  PlanWarning,
  MutationPlan,
  GhostNodePreview,
  DeletionOverlayPreview,
  MovementPathPreview,
  EdgePreview,
  MutationPreviewState,
  AIEditorNodeSummary,
  AIEditorEdgeSummary,
  AIEditorContext,
  NodeCluster,
  ContextChain,
  GraphAnalysis,
  SpatialAnalysis,
  WorkspaceAnalysis,
  EnhancedContextAnalysis,
  ConversationMessage,
  AIEditorState,
  GeneratePlanRequest,
  GeneratePlanResponse,
  ActionTemplate,
  TemplateVariable,
  StreamingPhase,
  PlanPhasePayload,
  PlanChunkPayload,
  PlanCompletePayload,
  PlanErrorPayload,
  PlanCancelledPayload,
  AIEditorMode,
  AIEditorScope,
} from './ai-editor'

export {
  DEFAULT_NODE_SPACING,
  DEFAULT_GRID_SPACING,
  DEFAULT_CLUSTER_SPREAD,
  NODE_DEFAULTS,
  AI_EDITOR_MODE_DESCRIPTIONS_LEGACY,
  AI_EDITOR_SCOPE_DESCRIPTIONS_LEGACY,
  DEFAULT_AI_EDITOR_STATE,
  AI_EDITOR_MAX_CONTEXT_TOKENS,
  AI_EDITOR_SELECTED_NODE_MAX_MESSAGES,
  AI_EDITOR_RELATED_NODE_MAX_MESSAGES,
  STREAMING_VALID_TRANSITIONS,
  AI_EDITOR_MODE_DESCRIPTIONS,
  AI_EDITOR_SCOPE_DESCRIPTIONS,
} from './ai-editor'

// --- history.ts ---
export type {
  HistoryAction,
  ConnectorProvider,
  ConnectorStatus,
  LLMConnector,
  MCPConnector,
  Connector,
  ConnectorState,
} from './history'

export {
  DEFAULT_CONNECTOR_STATE,
  CONNECTOR_PROVIDER_INFO,
} from './history'

// --- extraction.ts ---
export type {
  ExtractionSettings,
  PendingExtraction,
  ExtractionResult,
  ExtractableNodeType,
  ExtractableArtifactType,
  ExtractionDragData,
  ExtractionUndoData,
} from './extraction'

export {
  DEFAULT_EXTRACTION_SETTINGS,
  EXTRACTABLE_NODE_TYPES,
  EXTRACTABLE_ARTIFACT_TYPES,
  isExtractableNodeType,
  isExtractableArtifactType,
} from './extraction'

// --- glass.ts ---
export type {
  GlassStyle,
  GlassSettings,
} from './glass'

export {
  DEFAULT_GLASS_SETTINGS,
} from './glass'

// --- terminal.ts ---
export type {
  TerminalSpawnConfig,
  TerminalSpawnResult,
} from './terminal'

// --- bridge.ts ---
export type {
  AgentActivityStatus,
  AgentActivityState,
  OrchestratorActivityState,
  BridgeOverlayState,
  AuditAction,
  AuditActor,
  CanvasAuditEvent,
  AuditEventFilter,
  ProposedChangeType,
  ProposalStatus,
  ProposedChange,
  Proposal,
  CommandIntent,
  CommandStatus,
  BridgeCommand,
  CommandSuggestion,
  InsightType,
  InsightPriority,
  InsightStatus,
  GraphInsight,
  CostSnapshot,
  BridgeSettings,
} from './bridge'

export {
  DEFAULT_BRIDGE_SETTINGS,
} from './bridge'
