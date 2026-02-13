// =============================================================================
// ACTION NODE TYPES
// =============================================================================

// -----------------------------------------------------------------------------
// Trigger Types
// -----------------------------------------------------------------------------

export type ActionTriggerType =
  | 'property-change'
  | 'manual'
  | 'schedule'
  | 'node-created'
  | 'connection-made'
  | 'region-enter'
  | 'region-exit'
  | 'cluster-size'
  | 'proximity'
  | 'children-complete'
  | 'ancestor-change'
  | 'connection-count'
  | 'isolation'

export interface PropertyChangeTrigger {
  type: 'property-change'
  property: string // Property path to watch (e.g., 'status', 'priority')
  fromValue?: unknown // Optional: only trigger when changing FROM this value
  toValue?: unknown // Optional: only trigger when changing TO this value
  nodeFilter?: string // Optional: node type filter ('task', 'note', etc.)
}

export interface ManualTrigger {
  type: 'manual'
}

export interface ScheduleTrigger {
  type: 'schedule'
  cron: string // Cron expression (e.g., '*/5 * * * *' for every 5 minutes)
  lastFired?: number // Timestamp of last fire
}

export interface NodeCreatedTrigger {
  type: 'node-created'
  nodeTypeFilter?: string // Only trigger for specific node types
}

export interface ConnectionMadeTrigger {
  type: 'connection-made'
  direction?: 'incoming' | 'outgoing' | 'any'
  nodeTypeFilter?: string // Only trigger when connected to specific type
}

export interface RegionEnterTrigger {
  type: 'region-enter'
  regionId: string
}

export interface RegionExitTrigger {
  type: 'region-exit'
  regionId: string
}

export interface ClusterSizeTrigger {
  type: 'cluster-size'
  regionId: string
  threshold: number // Trigger when N nodes are in region
  comparison: 'gte' | 'lte' | 'eq' // greater-than-or-equal, less-than-or-equal, equal
}

export interface ProximityTrigger {
  type: 'proximity'
  targetNodeId: string // Node to measure distance from
  distance: number // Pixel distance threshold
  direction: 'entering' | 'leaving' // Trigger on getting close or moving away
}

export interface ChildrenCompleteTrigger {
  type: 'children-complete'
  property: string // Property to check (e.g., 'status')
  targetValue: unknown // Value that means "complete" (e.g., 'done')
  requireAll: boolean // All children must match (true) or any (false)
}

export interface AncestorChangeTrigger {
  type: 'ancestor-change'
  property: string // Property to watch on ancestors
  depth?: number // How many levels up to watch (default: unlimited)
}

export interface ConnectionCountTrigger {
  type: 'connection-count'
  threshold: number
  comparison: 'gte' | 'lte' | 'eq'
  direction?: 'incoming' | 'outgoing' | 'any'
}

export interface IsolationTrigger {
  type: 'isolation'
  // Fires when a node has 0 connections
}

export type ActionTrigger =
  | PropertyChangeTrigger
  | ManualTrigger
  | ScheduleTrigger
  | NodeCreatedTrigger
  | ConnectionMadeTrigger
  | RegionEnterTrigger
  | RegionExitTrigger
  | ClusterSizeTrigger
  | ProximityTrigger
  | ChildrenCompleteTrigger
  | AncestorChangeTrigger
  | ConnectionCountTrigger
  | IsolationTrigger

// -----------------------------------------------------------------------------
// Condition Types
// -----------------------------------------------------------------------------

export type ConditionOperator =
  | 'equals'
  | 'not-equals'
  | 'contains'
  | 'not-contains'
  | 'greater-than'
  | 'less-than'
  | 'is-empty'
  | 'is-not-empty'
  | 'matches-regex'

export interface ActionCondition {
  id: string
  field: string // Property path to check (e.g., 'data.status', 'data.priority')
  operator: ConditionOperator
  value?: unknown // Not needed for is-empty/is-not-empty
  target: 'trigger-node' | 'action-node' | 'specific-node'
  targetNodeId?: string // Only when target is 'specific-node'
}

// -----------------------------------------------------------------------------
// Action Step Types
// -----------------------------------------------------------------------------

export type ActionStepType =
  | 'update-property'
  | 'create-node'
  | 'delete-node'
  | 'move-node'
  | 'link-nodes'
  | 'unlink-nodes'
  | 'wait'
  | 'condition'
  | 'llm-call'
  | 'http-request'
  | 'run-agent'
  | 'run-orchestrator'

export type ActionStepErrorBehavior = 'stop' | 'continue' | 'retry'

export interface ActionStepBase {
  id: string
  type: ActionStepType
  label?: string // User-friendly name for this step
  onError: ActionStepErrorBehavior
  disabled?: boolean
}

export interface UpdatePropertyStep extends ActionStepBase {
  type: 'update-property'
  config: {
    target: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
    property: string
    value: unknown
  }
}

export interface CreateNodeStep extends ActionStepBase {
  type: 'create-node'
  config: {
    nodeType: string
    title: string
    position: 'near-trigger' | 'near-action' | 'absolute'
    offsetX?: number
    offsetY?: number
    absoluteX?: number
    absoluteY?: number
    initialData?: Record<string, unknown>
    variableName?: string // Store created node ID in context.variables[variableName]
  }
}

export interface DeleteNodeStep extends ActionStepBase {
  type: 'delete-node'
  config: {
    target: 'trigger-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
  }
}

export interface MoveNodeStep extends ActionStepBase {
  type: 'move-node'
  config: {
    target: 'trigger-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
    position: 'relative' | 'absolute'
    x: number
    y: number
  }
}

export interface LinkNodesStep extends ActionStepBase {
  type: 'link-nodes'
  config: {
    source: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    sourceNodeId?: string
    target: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
    label?: string
  }
}

export interface UnlinkNodesStep extends ActionStepBase {
  type: 'unlink-nodes'
  config: {
    source: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    sourceNodeId?: string
    target: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
  }
}

export interface WaitStep extends ActionStepBase {
  type: 'wait'
  config: {
    duration: number // milliseconds
  }
}

export interface ConditionStep extends ActionStepBase {
  type: 'condition'
  config: {
    field: string
    operator: ConditionOperator
    value?: unknown
    target: 'trigger-node' | 'action-node' | 'specific-node' | 'created-node'
    targetNodeId?: string
    skipCount: number // How many subsequent steps to skip if condition is false
  }
}

export interface LLMCallStep extends ActionStepBase {
  type: 'llm-call'
  config: {
    connectorId?: string // Use specific connector, or default
    prompt: string // Prompt template with {{variables}}
    systemPrompt?: string // Optional system prompt template
    variableName?: string // Store response in context.variables[variableName]
    maxTokens?: number
    temperature?: number
    autoCreateOutput?: boolean // Auto-create output node with LLM response (default: true)
    outputNodeType?: 'note' | 'task' | 'conversation' // Type of output node to create
    outputPosition?: 'right' | 'below' | 'near-trigger' // Position of output node relative to action
  }
}

export interface HttpRequestStep extends ActionStepBase {
  type: 'http-request'
  config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    url: string // Supports {{variable}} templates
    headers?: Record<string, string>
    body?: string // Supports {{variable}} templates
    variableName?: string // Store response in context.variables[variableName]
    timeout?: number // ms, default 30000
  }
}

export interface RunAgentStep extends ActionStepBase {
  type: 'run-agent'
  config: {
    agentNodeId: string   // ID of the agent-mode conversation node to run
    prompt?: string       // Optional prompt to send to the agent
    successCondition?: string // Optional condition to evaluate after run
    timeout?: number      // ms, default 300000 (5 minutes)
  }
}

export interface RunOrchestratorStep extends ActionStepBase {
  type: 'run-orchestrator'
  config: {
    orchestratorNodeId: string  // ID of the orchestrator node to run
    timeout?: number            // ms, default 600000 (10 minutes)
  }
}

export type ActionStep =
  | UpdatePropertyStep
  | CreateNodeStep
  | DeleteNodeStep
  | MoveNodeStep
  | LinkNodesStep
  | UnlinkNodesStep
  | WaitStep
  | ConditionStep
  | LLMCallStep
  | HttpRequestStep
  | RunAgentStep
  | RunOrchestratorStep

// -----------------------------------------------------------------------------
// Execution Context
// -----------------------------------------------------------------------------

export interface ExecutionContext {
  triggerNodeId: string
  actionNodeId: string
  event: ActionEvent
  variables: Record<string, unknown> // Runtime variables (created node IDs, LLM responses, etc.)
  startedAt: number
}

// -----------------------------------------------------------------------------
// Event Types (internal bus)
// -----------------------------------------------------------------------------

export type ActionEventType =
  | 'property-change'
  | 'node-created'
  | 'connection-made'
  | 'connection-removed'
  | 'node-position-change'
  | 'schedule-tick'
  | 'manual'

export interface ActionEvent {
  type: ActionEventType
  nodeId: string
  timestamp: number
  data?: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// Spatial Region Types
// -----------------------------------------------------------------------------

export interface SpatialRegion {
  id: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  color?: string
  linkedActionIds?: string[]
  nodes?: string[] // Node IDs contained in this region (used by spatial analysis)
}

// -----------------------------------------------------------------------------
// Action Node Data (extends ContextMetadata from types.ts)
// -----------------------------------------------------------------------------

import type { ContextMetadata } from './types'

export interface ActionNodeData extends ContextMetadata {
  type: 'action'
  title: string
  description?: string
  enabled: boolean

  // Trigger configuration
  trigger: ActionTrigger

  // Conditions (all must pass for action to execute)
  conditions: ActionCondition[]

  // Steps to execute when triggered
  actions: ActionStep[]

  // Execution stats
  lastRun?: number
  runCount: number
  errorCount: number
  lastError?: string

  // Standard node fields
  color?: string
  parentId?: string
  createdAt: number
  updatedAt: number
  properties?: Record<string, unknown>
  [key: string]: unknown
}

// Default factory
export const createActionData = (): ActionNodeData => ({
  type: 'action',
  title: 'New Action',
  description: '',
  enabled: true,
  trigger: { type: 'manual' },
  conditions: [],
  actions: [],
  runCount: 0,
  errorCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now()
})

// =============================================================================
// AI CONFIGURATION TYPES
// =============================================================================

// -----------------------------------------------------------------------------
// Clarifying Questions
// -----------------------------------------------------------------------------

export type AIQuestionType = 'select' | 'multiselect' | 'text' | 'node-picker' | 'slider'

export interface AIQuestionOption {
  value: string
  label: string
  description?: string
}

export interface AIQuestionBase {
  id: string
  question: string
  context?: string // Why we're asking
  required: boolean
  default?: string
}

export interface AISelectQuestion extends AIQuestionBase {
  type: 'select'
  options: AIQuestionOption[]
}

export interface AIMultiSelectQuestion extends AIQuestionBase {
  type: 'multiselect'
  options: AIQuestionOption[]
}

export interface AITextQuestion extends AIQuestionBase {
  type: 'text'
  placeholder?: string
}

export interface AINodePickerQuestion extends AIQuestionBase {
  type: 'node-picker'
  nodeTypeFilter?: string
}

export interface AISliderQuestion extends AIQuestionBase {
  type: 'slider'
  min: number
  max: number
  step: number
  unit?: string
}

export type AIClarifyingQuestion =
  | AISelectQuestion
  | AIMultiSelectQuestion
  | AITextQuestion
  | AINodePickerQuestion
  | AISliderQuestion

// -----------------------------------------------------------------------------
// AI Configuration Response
// -----------------------------------------------------------------------------

export type AIConfigConfidence = 'high' | 'medium' | 'low'

export interface AIGeneratedConfig {
  trigger: ActionTrigger
  conditions: ActionCondition[]
  actions: ActionStep[]
  explanation: string // Human-readable summary
}

export interface AIConfigResponse {
  confidence: AIConfigConfidence

  // If confident enough to suggest
  config?: AIGeneratedConfig

  // If needs clarification
  questions?: AIClarifyingQuestion[]

  // Plain-English summary of what the action will do (for plan review)
  planSummary?: string

  // Optional title suggestion
  suggestedTitle?: string

  // Limitations or warnings
  limitations?: string[]

  // Always included
  reasoning: string // Why this config or these questions
}

// -----------------------------------------------------------------------------
// Streaming State
// -----------------------------------------------------------------------------

export type AIStreamingPhase = 'analyzing' | 'trigger' | 'conditions' | 'steps' | 'complete'

export interface AIStreamingState {
  phase: AIStreamingPhase
  partialConfig: Partial<AIGeneratedConfig>
  currentStep?: number
  message?: string
}

// -----------------------------------------------------------------------------
// Action Context for AI
// -----------------------------------------------------------------------------

export interface AIActionContext {
  actionNodeId: string
  connectedNodes: Array<{
    id: string
    type: string
    title: string
    properties?: Record<string, unknown>
  }>
  nearbyNodes: Array<{
    id: string
    type: string
    title: string
    distance: number
  }>
  workspaceStats: Record<string, number> // node type counts
  existingConfig?: {
    trigger: ActionTrigger
    conditions: ActionCondition[]
    actions: ActionStep[]
  }
  propertyValues?: Record<string, Record<string, string[]>> // nodeType -> property -> observed values
}

// -----------------------------------------------------------------------------
// Learning System
// -----------------------------------------------------------------------------

export interface AIConfigPattern {
  descriptionKeywords: string[]
  triggerType: ActionTriggerType
  stepTypes: ActionStepType[]
  successRate: number
  usageCount: number
  lastUsed: number
}

// -----------------------------------------------------------------------------
// Feedback
// -----------------------------------------------------------------------------

export interface AIConfigFeedback {
  sessionId: string
  rating: 'positive' | 'negative'
  feedback?: string
  hadModifications: boolean
  config: AIGeneratedConfig
  questionRounds: number
  timestamp: number
}

// -----------------------------------------------------------------------------
// Description Templates
// -----------------------------------------------------------------------------

export interface AIDescriptionTemplate {
  id: string
  label: string
  template: string
  category: 'triggers' | 'actions' | 'complete'
}

// -----------------------------------------------------------------------------
// Multi-turn Session
// -----------------------------------------------------------------------------

export interface AIQuestionRound {
  roundNumber: number
  questions: AIClarifyingQuestion[]
  answers: Record<string, string>
  timestamp: number
}

export interface AIMultiTurnSession {
  id: string
  startedAt: number
  description: string
  rounds: AIQuestionRound[]
  finalConfig?: AIGeneratedConfig
}
