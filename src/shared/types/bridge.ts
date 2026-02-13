// =============================================================================
// bridge.ts -- Spatial Command Bridge shared types
//
// Contains: All bridge-related types shared between main and renderer processes.
// Organized by phase for clarity, but shipped as one file.
// =============================================================================

// --- Phase 1: Activity Overlay ---

export type AgentActivityStatus =
  | 'running'
  | 'waiting-approval'
  | 'completed'
  | 'error'
  | 'paused'
  | 'queued'

export interface AgentActivityState {
  status: AgentActivityStatus
  currentAction?: string
  orchestratorId?: string
  runId?: string
  tokensUsed: number
  costUSD: number
  startedAt: number
  completedAt?: number
}

export interface OrchestratorActivityState {
  status: 'orchestrating' | 'paused' | 'completed' | 'error'
  runId: string
  agentCount: number
  completedAgentCount: number
  totalTokens: number
  totalCostUSD: number
  startedAt: number
}

export interface BridgeOverlayState {
  activeAgents: Record<string, AgentActivityState>
  activeOrchestrators: Record<string, OrchestratorActivityState>
  animatedEdgeIds: string[]
  totalActiveAgents: number
  totalTokensUsed: number
  totalCostUSD: number
  totalActiveRuns: number
}

// --- Phase 2: Audit Trail ---

export type AuditAction =
  | 'node-created'
  | 'node-updated'
  | 'node-deleted'
  | 'edge-created'
  | 'edge-deleted'
  | 'orchestration-started'
  | 'orchestration-completed'
  | 'orchestration-failed'
  | 'orchestration-aborted'
  | 'agent-started'
  | 'agent-completed'
  | 'agent-failed'
  | 'proposal-created'
  | 'proposal-approved'
  | 'proposal-rejected'
  | 'command-executed'
  | 'insight-applied'
  | 'insight-dismissed'
  | 'budget-warning'
  | 'budget-exceeded'

export type AuditActor =
  | { type: 'user' }
  | { type: 'agent'; agentNodeId: string; agentName: string; orchestratorId?: string }
  | { type: 'system'; service: string }

export interface CanvasAuditEvent {
  id: string
  timestamp: number
  actor: AuditActor
  action: AuditAction
  targetId: string
  targetType: string
  targetTitle?: string
  changes?: Record<string, { before: unknown; after: unknown }>
  context: {
    parentCommand?: string
    orchestrationId?: string
    runId?: string
    proposalId?: string
    costUSD?: number
    tokensUsed?: number
  }
  undoable: boolean
  undoData?: unknown
}

export interface AuditEventFilter {
  actions?: AuditAction[]
  actorTypes?: AuditActor['type'][]
  targetTypes?: string[]
  dateRange?: { start: number; end: number }
  searchText?: string
  orchestrationId?: string
}

// --- Phase 3: Ghost Nodes / Proposals ---

export type ProposedChangeType =
  | 'create-node'
  | 'update-node'
  | 'delete-node'
  | 'create-edge'
  | 'delete-edge'

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'expired'

export interface ProposedChange {
  id: string
  type: ProposedChangeType
  nodeType?: string
  nodeData?: Record<string, unknown>
  edgeData?: {
    source: string
    target: string
    data?: Record<string, unknown>
  }
  position?: { x: number; y: number }
  targetId?: string
  diff?: Record<string, { before: unknown; after: unknown }>
  agentNodeId: string
  agentName?: string
}

export interface Proposal {
  id: string
  status: ProposalStatus
  changes: ProposedChange[]
  createdAt: number
  resolvedAt?: number
  source: {
    type: 'agent-permission' | 'command-bar' | 'ambient-suggestion'
    commandText?: string
    insightId?: string
    agentNodeId?: string
    orchestratorId?: string
  }
  userModifications?: Record<string, Partial<ProposedChange>>
}

// --- Phase 4: Command Bar ---

export type CommandIntent =
  | 'create-workflow'
  | 'create-node'
  | 'connect-nodes'
  | 'run-orchestrator'
  | 'modify-canvas'
  | 'query-canvas'
  | 'control-agent'
  | 'set-policy'
  | 'unknown'

export type CommandStatus =
  | 'composing'
  | 'parsing'
  | 'proposed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface BridgeCommand {
  id: string
  raw: string
  parsed?: {
    intent: CommandIntent
    confidence: number
    targets: string[]
    parameters: Record<string, unknown>
    explanation: string
  }
  proposalId?: string
  status: CommandStatus
  createdAt: number
  completedAt?: number
  costUSD?: number
  error?: string
}

export interface CommandSuggestion {
  text: string
  intent: CommandIntent
  description: string
  source: 'recent' | 'template' | 'ai-completion' | 'contextual'
}

// --- Phase 5: Graph Intelligence ---

export type InsightType =
  | 'orphaned-cluster'
  | 'missing-connection'
  | 'redundant-nodes'
  | 'unbalanced-graph'
  | 'cost-anomaly'
  | 'workflow-optimization'
  | 'stale-content'
  | 'pattern-detected'

export type InsightPriority = 'low' | 'medium' | 'high'

export type InsightStatus =
  | 'new'
  | 'viewed'
  | 'applied'
  | 'dismissed'
  | 'expired'

export interface GraphInsight {
  id: string
  type: InsightType
  priority: InsightPriority
  status: InsightStatus
  title: string
  description: string
  affectedNodeIds: string[]
  suggestedChanges?: ProposedChange[]
  confidence: number
  detectedAt: number
  expiresAt?: number
  source: 'rule-based' | 'llm-powered'
  costUSD?: number
}

export interface CostSnapshot {
  timestamp: number
  sessionTokens: number
  sessionCostUSD: number
  orchestrationTokens: number
  orchestrationCostUSD: number
  ambientTokens: number
  ambientCostUSD: number
  budgetRemainingUSD?: number
}

// --- Bridge Settings ---

export interface BridgeSettings {
  enableOverlay: boolean
  autoShowOnActivity: boolean
  animationSpeed: 'slow' | 'medium' | 'fast'
  showEdgeAnimations: boolean
  badgePersistDuration: number
  enableAuditTrail: boolean
  maxAuditEvents: number
  auditRetentionDays: number
  enableProposals: boolean
  autoApproveThreshold: number
  ghostNodeOpacity: number
  proposalTimeoutMs: number
  enableCommandBar: boolean
  commandHistorySize: number
  showCommandSuggestions: boolean
  commandShortcut: string
  enableAmbientIntelligence: boolean
  analysisIntervalMs: number
  dailyBudgetUSD: number
  insightRetentionCount: number
}

export const DEFAULT_BRIDGE_SETTINGS: BridgeSettings = {
  enableOverlay: true,
  autoShowOnActivity: true,
  animationSpeed: 'medium',
  showEdgeAnimations: true,
  badgePersistDuration: 3000,
  enableAuditTrail: true,
  maxAuditEvents: 10000,
  auditRetentionDays: 30,
  enableProposals: true,
  autoApproveThreshold: 0,
  ghostNodeOpacity: 0.4,
  proposalTimeoutMs: 300000,
  enableCommandBar: true,
  commandHistorySize: 100,
  showCommandSuggestions: true,
  commandShortcut: '/',
  enableAmbientIntelligence: true,
  analysisIntervalMs: 30000,
  dailyBudgetUSD: 0.16,
  insightRetentionCount: 50,
}
