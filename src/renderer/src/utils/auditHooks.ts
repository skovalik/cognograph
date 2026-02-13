/**
 * Audit Event Emission Hooks
 *
 * Provides helper functions to emit CanvasAuditEvents from
 * workspace store actions and orchestrator events.
 * Uses RAF batching (Optimization #8) to prevent re-render storms.
 */

import { useAuditStore } from '../stores/auditStore'
import type {
  CanvasAuditEvent,
  AuditAction,
  AuditActor,
} from '@shared/types/bridge'

// =============================================================================
// Core Emit Function
// =============================================================================

/**
 * Emit an audit event with optional metadata.
 * Uses RAF batching by default for high-frequency events.
 */
export function emitAuditEvent(
  action: AuditAction,
  targetId: string,
  targetType: string,
  options: {
    actor?: AuditActor
    targetTitle?: string
    changes?: Record<string, { before: unknown; after: unknown }>
    context?: Partial<CanvasAuditEvent['context']>
    undoable?: boolean
    undoData?: unknown
    batched?: boolean
  } = {}
): void {
  const event: CanvasAuditEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    actor: options.actor ?? { type: 'user' },
    action,
    targetId,
    targetType,
    targetTitle: options.targetTitle,
    changes: options.changes,
    context: options.context ?? {},
    undoable: options.undoable ?? false,
    undoData: options.undoData,
  }

  // Use batched add for high-frequency events (orchestrator lifecycle, etc.)
  if (options.batched !== false) {
    useAuditStore.getState().addEventBatched(event)
  } else {
    useAuditStore.getState().addEvent(event)
  }
}

// =============================================================================
// Convenience Helpers for Workspace Actions
// =============================================================================

/**
 * Emit audit event for node creation.
 */
export function emitNodeCreated(
  nodeId: string,
  nodeType: string,
  title: string,
  actor?: AuditActor
): void {
  emitAuditEvent('node-created', nodeId, nodeType, {
    actor,
    targetTitle: title,
    undoable: true,
    undoData: { nodeId },
    batched: false, // User actions are immediate
  })
}

/**
 * Emit audit event for node deletion.
 * Stores the full node data for undo support.
 */
export function emitNodeDeleted(
  nodeId: string,
  nodeType: string,
  title: string,
  nodeSnapshot?: unknown,
  actor?: AuditActor
): void {
  emitAuditEvent('node-deleted', nodeId, nodeType, {
    actor,
    targetTitle: title,
    undoable: !!nodeSnapshot,
    undoData: nodeSnapshot ? { node: nodeSnapshot } : undefined,
    batched: false,
  })
}

/**
 * Emit audit event for node update.
 */
export function emitNodeUpdated(
  nodeId: string,
  nodeType: string,
  title: string,
  changes: Record<string, { before: unknown; after: unknown }>,
  actor?: AuditActor
): void {
  emitAuditEvent('node-updated', nodeId, nodeType, {
    actor,
    targetTitle: title,
    changes,
    undoable: true,
    undoData: { targetId: nodeId, before: changes },
    batched: false,
  })
}

/**
 * Emit audit event for edge creation.
 */
export function emitEdgeCreated(
  edgeId: string,
  sourceId: string,
  targetId: string,
  actor?: AuditActor
): void {
  emitAuditEvent('edge-created', edgeId, 'edge', {
    actor,
    targetTitle: `${sourceId} -> ${targetId}`,
    undoable: true,
    undoData: { edgeId },
    batched: false,
  })
}

/**
 * Emit audit event for edge deletion.
 */
export function emitEdgeDeleted(
  edgeId: string,
  edgeSnapshot?: unknown,
  actor?: AuditActor
): void {
  emitAuditEvent('edge-deleted', edgeId, 'edge', {
    actor,
    undoable: !!edgeSnapshot,
    undoData: edgeSnapshot ? { edge: edgeSnapshot } : undefined,
    batched: false,
  })
}

// =============================================================================
// Convenience Helpers for Orchestrator Events
// =============================================================================

/**
 * Emit audit event for orchestration lifecycle.
 * These use batched mode since they can come in rapid bursts.
 */
export function emitOrchestrationStarted(
  orchestratorId: string,
  runId: string
): void {
  emitAuditEvent('orchestration-started', orchestratorId, 'orchestrator', {
    actor: { type: 'user' },
    context: { orchestrationId: orchestratorId, runId },
    batched: true,
  })
}

export function emitOrchestrationCompleted(
  orchestratorId: string,
  runId: string,
  costUSD?: number,
  tokensUsed?: number
): void {
  emitAuditEvent('orchestration-completed', orchestratorId, 'orchestrator', {
    actor: { type: 'system', service: 'orchestrator' },
    context: { orchestrationId: orchestratorId, runId, costUSD, tokensUsed },
    batched: true,
  })
}

export function emitOrchestrationFailed(
  orchestratorId: string,
  runId: string,
  error?: string
): void {
  emitAuditEvent('orchestration-failed', orchestratorId, 'orchestrator', {
    actor: { type: 'system', service: 'orchestrator' },
    targetTitle: error,
    context: { orchestrationId: orchestratorId, runId },
    batched: true,
  })
}

export function emitAgentStarted(
  agentNodeId: string,
  agentName: string,
  orchestratorId: string,
  runId: string
): void {
  emitAuditEvent('agent-started', agentNodeId, 'conversation', {
    actor: {
      type: 'agent',
      agentNodeId,
      agentName,
      orchestratorId,
    },
    context: { orchestrationId: orchestratorId, runId },
    batched: true,
  })
}

export function emitAgentCompleted(
  agentNodeId: string,
  agentName: string,
  orchestratorId: string,
  runId: string,
  costUSD?: number,
  tokensUsed?: number
): void {
  emitAuditEvent('agent-completed', agentNodeId, 'conversation', {
    actor: {
      type: 'agent',
      agentNodeId,
      agentName,
      orchestratorId,
    },
    context: { orchestrationId: orchestratorId, runId, costUSD, tokensUsed },
    batched: true,
  })
}

export function emitAgentFailed(
  agentNodeId: string,
  agentName: string,
  orchestratorId: string,
  runId: string,
  error?: string
): void {
  emitAuditEvent('agent-failed', agentNodeId, 'conversation', {
    actor: {
      type: 'agent',
      agentNodeId,
      agentName,
      orchestratorId,
    },
    targetTitle: error,
    context: { orchestrationId: orchestratorId, runId },
    batched: true,
  })
}

// =============================================================================
// Insight Events
// =============================================================================

export function emitInsightApplied(insightId: string): void {
  emitAuditEvent('insight-applied', insightId, 'insight', {
    actor: { type: 'system', service: 'graphIntelligence' },
    batched: true,
  })
}

export function emitInsightDismissed(insightId: string): void {
  emitAuditEvent('insight-dismissed', insightId, 'insight', {
    actor: { type: 'user' },
    batched: true,
  })
}
