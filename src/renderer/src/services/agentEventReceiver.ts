// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Event Receiver — passive event handler for renderer.
 *
 * Listens to IPC events from the main process (transport events) and
 * updates renderer stores accordingly. The renderer no longer executes
 * tools — it only DISPLAYS the results of tool execution happening in
 * the main process.
 *
 * Events handled:
 *   agent:tool-start   → show tool execution indicator in UI
 *   agent:tool-result  → update conversation with result
 *   agent:node-created → add node to canvas (preserves IncrementalBatchParser visual feedback)
 *   agent:stream-chunk → stream text to conversation UI (delegates to existing stream handler)
 *   agent:complete     → finalize conversation, update usage stats
 *
 * Created as part of Phase 2C: RENDERER-PASSIVIZE
 */

import type {
  Position,
  TokenUsage,
  ToolResult as TransportToolResult,
} from '@shared/transport/types'
import { useSessionStatsStore } from '../stores/sessionStatsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { layoutEvents } from '../utils/layoutEvents'
import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payloads received from the main process via IPC. */
export interface ToolStartPayload {
  conversationId: string
  toolName: string
  toolId: string
  toolInput?: Record<string, unknown>
}

export interface ToolResultPayload {
  conversationId: string
  toolId: string
  toolName: string
  result: TransportToolResult
}

export interface NodeCreatedPayload {
  conversationId: string
  nodeId: string
  type: string
  position: Position
  title?: string
  tempId?: string
}

export interface AgentCompletePayload {
  conversationId: string
  usage: TokenUsage
  stopReason: string
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let initialized = false
let cleanupFns: Array<() => void> = []

// Track nodes created during the current agent run for layout pipeline
const pendingLayoutNodes = new Map<string, string[]>()
const pendingLayoutEdges = new Map<string, string[]>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the event receiver. Safe to call multiple times —
 * subsequent calls are no-ops.
 */
export function initAgentEventReceiver(): void {
  if (initialized) {
    logger.log('[AgentEventReceiver] Already initialized, skipping')
    return
  }

  if (!window.api) {
    console.warn('[AgentEventReceiver] window.api not available yet')
    return
  }

  initialized = true

  // Register IPC listeners for transport events
  // These correspond to the channels defined in @shared/transport/types.ts
  if (window.api.agent?.onToolStart) {
    const unsub = window.api.agent.onToolStart(handleToolStart)
    cleanupFns.push(unsub)
  }

  if (window.api.agent?.onToolResult) {
    const unsub = window.api.agent.onToolResult(handleToolResult)
    cleanupFns.push(unsub)
  }

  if (window.api.agent?.onNodeCreated) {
    const unsub = window.api.agent.onNodeCreated(handleNodeCreated)
    cleanupFns.push(unsub)
  }

  if (window.api.agent?.onComplete) {
    const unsub = window.api.agent.onComplete(handleAgentComplete)
    cleanupFns.push(unsub)
  }

  // Context refresh IPC — C-FIX-3
  // Main process requests BFS context for a conversation; we respond with the string.
  if (window.api.context?.onRequest) {
    window.api.context.onRequest(handleContextRequest)
    cleanupFns.push(() => {
      // No structured unsub for this channel — the preload uses removeAllListeners
      // on re-init. No-op cleanup is safe here.
    })
  }

  logger.log('[AgentEventReceiver] Initialized — listening for transport events')
}

/**
 * Tear down all event listeners. Called on app unmount or hot reload.
 */
export function disposeAgentEventReceiver(): void {
  for (const fn of cleanupFns) {
    fn()
  }
  cleanupFns = []
  pendingLayoutNodes.clear()
  pendingLayoutEdges.clear()
  initialized = false
  logger.log('[AgentEventReceiver] Disposed')
}

/**
 * Track a node ID for post-completion layout. Called externally when
 * streaming batch_create creates nodes during tool_use_delta events.
 */
export function trackCreatedNode(conversationId: string, nodeId: string): void {
  if (!pendingLayoutNodes.has(conversationId)) {
    pendingLayoutNodes.set(conversationId, [])
  }
  pendingLayoutNodes.get(conversationId)!.push(nodeId)
}

/**
 * Track an edge ID for post-completion layout.
 */
export function trackCreatedEdge(conversationId: string, edgeId: string): void {
  if (!pendingLayoutEdges.has(conversationId)) {
    pendingLayoutEdges.set(conversationId, [])
  }
  pendingLayoutEdges.get(conversationId)!.push(edgeId)
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

function handleToolStart(payload: ToolStartPayload): void {
  logger.log(
    `[AgentEventReceiver] tool-start: ${payload.toolName} (${payload.toolId}) for ${payload.conversationId}`,
  )

  const store = useWorkspaceStore.getState()

  // Add a tool_use message to the conversation to show the tool badge in UI
  if (payload.conversationId) {
    store.addToolMessage(payload.conversationId, {
      id: payload.toolId,
      role: 'tool_use' as const,
      content: `Calling ${payload.toolName}`,
      timestamp: Date.now(),
      toolName: payload.toolName,
      toolInput: payload.toolInput ?? {},
      toolUseId: payload.toolId,
    })
  }
}

function handleToolResult(payload: ToolResultPayload): void {
  logger.log(
    `[AgentEventReceiver] tool-result: ${payload.toolName} (${payload.toolId}) success=${payload.result.success}`,
  )

  const store = useWorkspaceStore.getState()

  if (payload.conversationId) {
    const resultContent = payload.result.success
      ? JSON.stringify(payload.result.output ?? {}, null, 2)
      : `Error: ${payload.result.error ?? 'Unknown error'}`

    store.addToolMessage(payload.conversationId, {
      id: `result-${payload.toolId}`,
      role: 'tool_result' as const,
      content: resultContent,
      timestamp: Date.now(),
      toolResultFor: payload.toolId,
      isError: !payload.result.success,
    })

    // Track created nodes/edges for layout pipeline
    if (payload.result.success && payload.result.output) {
      const output = payload.result.output as Record<string, unknown>

      // create_node returns { nodeId }
      if (payload.toolName === 'create_node' && output.nodeId) {
        trackCreatedNode(payload.conversationId, output.nodeId as string)
      }

      // link_nodes returns { edgeId }
      if (payload.toolName === 'link_nodes' && output.edgeId) {
        trackCreatedEdge(payload.conversationId, output.edgeId as string)
      }

      // batch_create returns { nodeMap: Record<tempId, realId> }
      if (payload.toolName === 'batch_create' && output.nodeMap) {
        const nodeMap = output.nodeMap as Record<string, string>
        for (const realId of Object.values(nodeMap)) {
          trackCreatedNode(payload.conversationId, realId)
        }
      }
    }
  }
}

function handleNodeCreated(payload: NodeCreatedPayload): void {
  logger.log(
    `[AgentEventReceiver] node-created: ${payload.nodeId} type=${payload.type} at (${payload.position.x}, ${payload.position.y})`,
  )

  // The node was already created by the main process tool executor.
  // The workspace store should already have it via workspace sync.
  // If it doesn't (e.g., the main process created it but the store
  // hasn't synced yet), we don't create it here — the store sync
  // mechanism handles that.

  // Track for layout
  if (payload.conversationId) {
    trackCreatedNode(payload.conversationId, payload.nodeId)
  }

  // Dispatch a layout event so the canvas can re-layout if needed
  layoutEvents.dispatchEvent(
    new CustomEvent('node-created', {
      detail: {
        nodeId: payload.nodeId,
        type: payload.type,
        position: payload.position,
        conversationId: payload.conversationId,
      },
    }),
  )
}

function handleAgentComplete(payload: AgentCompletePayload): void {
  logger.log(
    `[AgentEventReceiver] complete: ${payload.conversationId} stopReason=${payload.stopReason}`,
  )

  const store = useWorkspaceStore.getState()

  // Clear streaming state
  store.setStreaming(payload.conversationId, false)

  // Record usage stats
  if (payload.usage) {
    const { input_tokens, output_tokens } = payload.usage
    if (input_tokens > 0 || output_tokens > 0) {
      store.setLastMessageUsage?.(payload.conversationId, {
        inputTokens: input_tokens,
        outputTokens: output_tokens,
      })
      useSessionStatsStore.getState().recordUsage?.({
        inputTokens: input_tokens,
        outputTokens: output_tokens,
      })
    }
  }

  // Run layout pipeline for any created nodes
  const createdNodeIds = pendingLayoutNodes.get(payload.conversationId) ?? []
  const createdEdgeIds = pendingLayoutEdges.get(payload.conversationId) ?? []

  if (createdNodeIds.length > 0) {
    // Double rAF: first frame lets React render the nodes, second frame lets
    // React Flow measure their DOM dimensions (measured.width/height).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layoutEvents.dispatchEvent(
          new CustomEvent('run-layout', {
            detail: {
              nodeIds: createdNodeIds,
              edgeIds: createdEdgeIds,
              conversationId: payload.conversationId,
            },
          }),
        )
      })
    })
  }

  // Clean up tracking
  pendingLayoutNodes.delete(payload.conversationId)
  pendingLayoutEdges.delete(payload.conversationId)
}

function handleContextRequest(data: { requestId: string; conversationId: string }): void {
  const store = useWorkspaceStore.getState()
  const context = store.getContextForNode(data.conversationId)
  window.api.context?.sendResponse(data.requestId, context)
}

// ---------------------------------------------------------------------------
// For testing
// ---------------------------------------------------------------------------

export const __test__ = {
  handleToolStart,
  handleToolResult,
  handleNodeCreated,
  handleAgentComplete,
  pendingLayoutNodes,
  pendingLayoutEdges,
}
