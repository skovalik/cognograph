// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/shared/types/index.ts -- Barrel re-export
//
// This file preserves ALL existing import paths. Consumers continue to use:
//   import { NodeData, EdgeData, ... } from '@shared/types'
//   import type { ThemeSettings, ... } from '@shared/types'
//
// Runtime values use `export { }` and pure types use `export type { }`.
// =============================================================================

// Re-export ActionNodeData, SpatialRegion, and RunAgentStep from actionTypes (preserves existing re-export)
export type { ActionNodeData, RunAgentStep, SpatialRegion } from '../actionTypes'
// --- ai-editor.ts ---
export type {
  ActionTemplate,
  AIEditorContext,
  AIEditorEdgeSummary,
  AIEditorMode,
  AIEditorNodeSummary,
  AIEditorScope,
  AIEditorState,
  ContextChain,
  ConversationMessage,
  DeletionOverlayPreview,
  EdgePreview,
  EnhancedContextAnalysis,
  GeneratePlanRequest,
  GeneratePlanResponse,
  GhostNodePreview,
  GraphAnalysis,
  MovementPathPreview,
  MutationOp,
  MutationPlan,
  MutationPreviewState,
  NodeCluster,
  PlanCancelledPayload,
  PlanChunkPayload,
  PlanCompletePayload,
  PlanErrorPayload,
  PlanPhasePayload,
  PlanWarning,
  PlanWarningLevel,
  RelativePosition,
  SpatialAnalysis,
  StreamingPhase,
  TemplateVariable,
  WorkspaceAnalysis,
} from './ai-editor'
export {
  AI_EDITOR_MAX_CONTEXT_TOKENS,
  AI_EDITOR_MODE_DESCRIPTIONS,
  AI_EDITOR_MODE_DESCRIPTIONS_LEGACY,
  AI_EDITOR_RELATED_NODE_MAX_MESSAGES,
  AI_EDITOR_SCOPE_DESCRIPTIONS,
  AI_EDITOR_SCOPE_DESCRIPTIONS_LEGACY,
  AI_EDITOR_SELECTED_NODE_MAX_MESSAGES,
  DEFAULT_AI_EDITOR_STATE,
  DEFAULT_CLUSTER_SPREAD,
  DEFAULT_GRID_SPACING,
  DEFAULT_NODE_SPACING,
  NODE_DEFAULTS,
  STREAMING_VALID_TRANSITIONS,
} from './ai-editor'
// --- bridge.ts ---
export type {
  AgentActivityState,
  AgentActivityStatus,
  AuditAction,
  AuditActor,
  AuditEventFilter,
  BridgeCommand,
  BridgeOverlayState,
  BridgeSettings,
  CanvasAuditEvent,
  CommandIntent,
  CommandStatus,
  CommandSuggestion,
  CostSnapshot,
  GraphInsight,
  InsightPriority,
  InsightStatus,
  InsightType,
  OrchestratorActivityState,
  Proposal,
  ProposalStatus,
  ProposedChange,
  ProposedChangeType,
} from './bridge'
export { DEFAULT_BRIDGE_SETTINGS } from './bridge'
// --- common.ts ---
export type {
  ActivationTrigger,
  Attachment,
  ContextMetadata,
  DeepPartial,
  DesignToken,
  DesignTokenSet,
  DesignTokenType,
  NodeActivationCondition,
  NodeShape,
  PropertyDefinition,
  PropertyOption,
  PropertySchema,
  PropertyType,
} from './common'
// --- edges.ts ---
export type {
  AgentEdgeResult,
  EdgeArrowStyle,
  EdgeData,
  EdgeLabelPreset,
  EdgeLineStyle,
  EdgeSemanticType,
  EdgeStrength,
  EdgeStrokePreset,
  EdgeStyle,
  EdgeWaypoint,
} from './edges'
export {
  AGENT_RESULT_SUMMARY_MAX_CHARS,
  DEFAULT_EDGE_DATA,
  EDGE_LABEL_PRESETS,
  getContextDepthFromStrength,
  migrateEdgeStrength,
} from './edges'
// --- extraction.ts ---
export type {
  ExtractableArtifactType,
  ExtractableNodeType,
  ExtractionDragData,
  ExtractionResult,
  ExtractionSettings,
  ExtractionUndoData,
  PendingExtraction,
} from './extraction'
export {
  DEFAULT_EXTRACTION_SETTINGS,
  EXTRACTABLE_ARTIFACT_TYPES,
  EXTRACTABLE_NODE_TYPES,
  isExtractableArtifactType,
  isExtractableNodeType,
} from './extraction'
// --- glass.ts ---
export type {
  GlassSettings,
  GlassStyle,
} from './glass'
export { DEFAULT_GLASS_SETTINGS } from './glass'
// --- history.ts ---
export type {
  Connector,
  ConnectorProvider,
  ConnectorState,
  ConnectorStatus,
  HistoryAction,
  LLMConnector,
  MCPConnector,
} from './history'
export {
  CONNECTOR_PROVIDER_INFO,
  DEFAULT_CONNECTOR_STATE,
} from './history'
// --- nodes.ts ---
export type {
  ACFField,
  ACFFieldGroup,
  ACFFieldType,
  AgentError,
  AgentErrorType,
  AgentMemory,
  AgentPreset,
  AgentRunSummary,
  AgentSettings,
  AgentStatus,
  AgentToolDefinition,
  ArtifactContentType,
  ArtifactFile,
  ArtifactMediaMetadata,
  ArtifactNodeData,
  ArtifactSource,
  ArtifactVersion,
  ComponentLibrary,
  ComponentNoteFields,
  ComponentRef,
  ComponentStatus,
  ComponentType,
  ConnectedAgent,
  ConnectedAgentStatus,
  ContentModelFields,
  ContentModelSupport,
  ContextSource,
  ConversationNodeData,
  FailurePolicy,
  FailurePolicyType,
  FlexibleLayout,
  MemoryEntry,
  Message,
  NodeData,
  NoteMode,
  NoteNodeData,
  OrchestratorAgentResult,
  OrchestratorBudget,
  OrchestratorCondition,
  OrchestratorConditionType,
  OrchestratorNodeData,
  OrchestratorRun,
  OrchestratorRunStatus,
  // Orchestrator types
  OrchestratorStrategy,
  PageNoteFields,
  PageSeoSettings,
  PageStatus,
  PreviewViewport,
  ProjectNodeData,
  PropDefinition,
  PropType,
  ResponsiveBehavior,
  TaskNodeData,
  TaxonomyRef,
  TerminalShell,
  TextNodeData,
  WorkspaceContextRules,
  WorkspaceLLMSettings,
  WorkspaceNodeData,
  WorkspaceThemeDefaults,
  WPAuthMethod,
  WPConfigFields,
  WPEnvironment,
} from './nodes'
export {
  createOrchestratorData,
  DEFAULT_AGENT_MEMORY,
  DEFAULT_AGENT_NODE_EXTENSIONS,
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_AGENT_STATUS,
  // Orchestrator defaults
  DEFAULT_FAILURE_POLICY,
  DEFAULT_ORCHESTRATOR_BUDGET,
  DEFAULT_WORKSPACE_CONTEXT_RULES,
  DEFAULT_WORKSPACE_LLM_SETTINGS,
  isActionNode,
  isArtifactNode,
  isConversationNode,
  isNoteNode,
  isOrchestratorNode,
  isProjectNode,
  isTaskNode,
  isTextNode,
  isWorkspaceNode,
  TERMINAL_SHELL_OPTIONS,
} from './nodes'
// --- templates.ts ---
export type {
  NodeTemplate,
  PlaceholderDefinition,
  PlaceholderType,
  TemplateEdge,
  TemplateFolder,
  TemplateLibrary,
  TemplateNode,
} from './templates'
export {
  DEFAULT_TEMPLATE_LIBRARY,
  PLACEHOLDER_PATTERNS,
  SYSTEM_TEMPLATES,
} from './templates'
// --- terminal.ts ---
export type {
  TerminalSpawnConfig,
  TerminalSpawnResult,
} from './terminal'
// --- theme.ts ---
export type {
  AccentPreset,
  AccentTheme,
  AmbientEffectSettings,
  AmbientEffectType,
  CustomThemePreset,
  FontTheme,
  GridStyle,
  GuiColors,
  PresetAccent,
  ThemeMode,
  ThemePreset,
  ThemePresetColors,
  ThemeSettings,
} from './theme'
export {
  ACCENT_PRESETS,
  DEFAULT_AMBIENT_EFFECT,
  DEFAULT_GUI_COLORS_DARK,
  DEFAULT_GUI_COLORS_LIGHT,
  DEFAULT_LINK_COLORS_DARK,
  DEFAULT_LINK_COLORS_LIGHT,
  DEFAULT_THEME_SETTINGS,
  FONT_LOAD_URLS,
  FONT_THEMES,
  LIGHT_MODE_PRESETS,
  LIGHT_THEME_DEFAULTS,
  PRESET_ACCENT_PALETTES,
} from './theme'
// --- workspace.ts ---
export type {
  AppSettings,
  ChatDisplayMode,
  CommandLogEntry,
  ContextNode,
  ContextSettings,
  EncryptedCredential,
  IPCResponse,
  LLMStreamOptions,
  MCPRecommendation,
  ProjectType,
  PropertiesDisplayMode,
  WorkspaceData,
  WorkspaceInfo,
  WorkspacePreferences,
} from './workspace'
export {
  DEFAULT_CONTEXT_SETTINGS,
  DEFAULT_WORKSPACE_PREFERENCES,
} from './workspace'
