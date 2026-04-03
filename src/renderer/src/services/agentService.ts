// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Service — manages agent lifecycle, streaming, and tool loop coordination.
 *
 * ARCHITECTURE NOTE (Phase 2C: RENDERER-PASSIVIZE):
 * This file is being refactored toward a passive event-driven model.
 *
 * CURRENT (transitional): The renderer runs the tool loop — it receives stream
 * chunks from the main process, detects tool_use stop reasons, calls executeTool()
 * locally, and sends continuation messages. This is the "active" model.
 *
 * TARGET: The main process runs the tool loop (via agentLoop.ts). The renderer
 * receives transport events via agentEventReceiver.ts and only updates UI state.
 * The runAgentLoop() function here will be replaced by a simple IPC call to
 * start the agent, with all progress tracked via transport events.
 *
 * What stays in this file permanently:
 *   - Agent state management (AgentState, agentStates map)
 *   - Public API (sendAgentMessage, pauseAgent, resumeAgent, stopAgent, etc.)
 *   - Stream text handling (text_delta → update conversation UI)
 *   - buildMessagesForAPI (message format conversion)
 *   - External stream handler registration (for chatToolService)
 *
 * What will be removed after main-process tool loop migration:
 *   - Tool execution in handleStreamChunk (tool_use_start/delta/end handling)
 *   - executeTool() calls from runAgentLoop
 *   - IncrementalBatchParser streaming (moves to main process)
 *   - Direct tool call tracking (toolCallCount, etc.)
 */

import type {
  AgentMemory,
  AgentStatus,
  ConversationNodeData,
  HistoryAction,
  Message,
} from '@shared/types'
import { DEFAULT_AGENT_MEMORY, DEFAULT_AGENT_SETTINGS } from '@shared/types'
import toast from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import type { AgentStreamChunk } from '../../../preload/index'
import { getPresetById } from '../constants/agentPresets'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { IncrementalBatchParser } from '../utils/incrementalJsonParser'
import { layoutEvents } from '../utils/layoutEvents'
import { logger } from '../utils/logger'
import { estimateCost } from '../utils/tokenEstimator'
import {
  executeTool,
  getMCPToolsForAgent,
  getToolsForAgent,
  setMCPToolServerMap,
} from './agentTools'

// -----------------------------------------------------------------------------
// Agent State (per-agent Map, not singleton)
// -----------------------------------------------------------------------------

interface AgentState {
  isRunning: boolean
  currentRequestId: string | null
  currentConversationId: string
  pendingQueue: QueuedMessage[]
  accumulatedText: string
  currentToolUse: {
    id: string
    name: string
    inputJson: string
  } | null
  historyActions: HistoryAction[] // Collect all actions for batch undo
  iterationResolve: ((value: { stopReason: string }) => void) | null // Per-agent (Fix 1)
  pauseRequested: boolean // Graceful pause flag (Fix 5)
  streamingStarted: boolean // Whether first text_delta has been received (Fix 2 — thinking animation)
  iterationTimeout: ReturnType<typeof setTimeout> | null // 5 min timeout per iteration
  toolCallCount: number // Track across the run for run summary
  runStartedAt: number | null // For run summary timing
  // Token tracking accumulators (accumulate across all iterations in runAgentLoop)
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  // AbortController per run — allows cancellation of the current run and prevents
  // state mutation during async operations if the run has been superseded (Fix 1.3-C)
  abortController: AbortController | null
  // Streaming batch_create — incremental node creation during tool_use_delta
  streamingParser: IncrementalBatchParser | null
  streamingTempIdMap: Map<string, string> | null
  streamingDeferredEdges: Record<string, unknown>[] | null
  streamingNodeCount: number
  streamingExecuted: boolean
  streamingToolResult: string | null
}

interface QueuedMessage {
  conversationId: string
  content: string
  timestamp: number
}

// Per-agent state map — supports concurrent agents
const agentStates = new Map<string, AgentState>()

let streamUnsubscribe: (() => void) | null = null
let isServiceInitialized = false

// External stream handlers — used by chatToolService to piggyback on the stream listener
interface ExternalStreamHandler {
  onChunk(chunk: AgentStreamChunk): void
}
const externalStreamHandlers = new Map<string, ExternalStreamHandler>()

// Iteration timeout duration: 5 minutes
const ITERATION_TIMEOUT_MS = 5 * 60 * 1000

// -----------------------------------------------------------------------------
// State Management Helpers
// -----------------------------------------------------------------------------

function getOrCreateState(conversationId: string): AgentState {
  if (!agentStates.has(conversationId)) {
    agentStates.set(conversationId, {
      isRunning: false,
      currentRequestId: null,
      currentConversationId: conversationId,
      pendingQueue: [],
      accumulatedText: '',
      currentToolUse: null,
      historyActions: [],
      iterationResolve: null,
      pauseRequested: false,
      streamingStarted: false,
      iterationTimeout: null,
      toolCallCount: 0,
      runStartedAt: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      abortController: null,
      streamingParser: null,
      streamingTempIdMap: null,
      streamingDeferredEdges: null,
      streamingNodeCount: 0,
      streamingExecuted: false,
      streamingToolResult: null,
    })
  }
  return agentStates.get(conversationId)!
}

function findStateByRequestId(requestId: string): AgentState | undefined {
  for (const state of agentStates.values()) {
    if (state.currentRequestId === requestId) return state
  }
  return undefined
}

function cleanupState(conversationId: string): void {
  const state = agentStates.get(conversationId)
  if (state?.iterationTimeout) {
    clearTimeout(state.iterationTimeout)
  }
  if (state?.abortController) {
    state.abortController.abort()
    state.abortController = null
  }
  agentStates.delete(conversationId)
}

function resetAgentState(conversationId: string): void {
  const state = agentStates.get(conversationId)
  if (!state) return

  if (state.iterationTimeout) {
    clearTimeout(state.iterationTimeout)
  }

  // Abort any in-flight async operations for this run (Fix 1.3-C)
  if (state.abortController) {
    state.abortController.abort()
    state.abortController = null
  }

  state.isRunning = false
  state.currentRequestId = null
  state.accumulatedText = ''
  state.currentToolUse = null
  state.historyActions = []
  state.iterationResolve = null
  state.pauseRequested = false
  state.streamingStarted = false
  state.iterationTimeout = null
  state.toolCallCount = 0
  state.runStartedAt = null
  state.streamingParser = null
  state.streamingTempIdMap = null
  state.streamingDeferredEdges = null
  state.streamingNodeCount = 0
  state.streamingExecuted = false
  state.streamingToolResult = null
}

// -----------------------------------------------------------------------------
// Startup Recovery (Fix 3)
// -----------------------------------------------------------------------------

function recoverStaleAgentStates(): void {
  const store = useWorkspaceStore.getState()
  for (const node of store.nodes) {
    if (node.data.type !== 'conversation') continue
    const convData = node.data as ConversationNodeData
    if (convData.mode !== 'agent') continue

    if (convData.agentStatus === 'running' || convData.agentStatus === 'paused') {
      store.updateNode(node.id, {
        agentStatus: 'error' as AgentStatus,
      })

      // Finalize the last run entry if it exists and is incomplete
      const history = convData.agentRunHistory || []
      const lastRun = history[history.length - 1]
      if (lastRun && !lastRun.completedAt) {
        const updatedHistory = [...history]
        updatedHistory[updatedHistory.length - 1] = {
          ...lastRun,
          completedAt: new Date().toISOString(),
          status: 'error' as const,
          errorMessage: 'Agent was interrupted by app restart. Click Retry to resume.',
        }
        store.updateNode(node.id, { agentRunHistory: updatedHistory })
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Run Summary Helpers
// -----------------------------------------------------------------------------

function createRunEntry(conversationId: string): void {
  const state = getOrCreateState(conversationId)
  state.runStartedAt = Date.now()
  state.toolCallCount = 0
  // Reset token accumulators for new run
  state.totalInputTokens = 0
  state.totalOutputTokens = 0
  state.totalCacheCreationTokens = 0
  state.totalCacheReadTokens = 0

  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)
  if (!node) return

  const convData = node.data as ConversationNodeData
  const history = [...(convData.agentRunHistory || [])]

  // Cap at 20 entries
  if (history.length >= 20) {
    history.shift()
  }

  history.push({
    runId: uuid(),
    startedAt: new Date().toISOString(),
    status: 'completed', // Will be updated on completion
    toolCallCount: 0,
    tokensUsed: 0, // Will be calculated in finalizeRunEntry
    costUSD: 0, // Will be calculated in finalizeRunEntry
    inputTokens: 0,
    outputTokens: 0,
  })

  store.updateNode(conversationId, {
    agentRunHistory: history,
    agentStatus: 'running' as AgentStatus,
    lastRunAt: new Date().toISOString(),
  })
}

function finalizeRunEntry(
  conversationId: string,
  status: 'completed' | 'error' | 'cancelled' | 'paused',
  errorMessage?: string,
): void {
  const agentState = agentStates.get(conversationId)
  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)
  if (!node) return

  const convData = node.data as ConversationNodeData
  const history = [...(convData.agentRunHistory || [])]
  const lastRun = history[history.length - 1]

  if (lastRun && !lastRun.completedAt) {
    // Calculate token cost using accumulated tokens from all iterations
    const inputTokens = agentState?.totalInputTokens ?? 0
    const outputTokens = agentState?.totalOutputTokens ?? 0
    const cacheCreationTokens = agentState?.totalCacheCreationTokens ?? 0
    const cacheReadTokens = agentState?.totalCacheReadTokens ?? 0
    const model = convData.workspaceOverrides?.llm?.model || 'claude-sonnet-4-6'

    const cost = estimateCost(
      inputTokens,
      outputTokens,
      model,
      cacheCreationTokens,
      cacheReadTokens,
    )

    history[history.length - 1] = {
      ...lastRun,
      completedAt: new Date().toISOString(),
      status,
      toolCallCount: agentState?.toolCallCount ?? lastRun.toolCallCount,
      // New token tracking fields
      inputTokens,
      outputTokens,
      cacheCreationTokens: cacheCreationTokens || undefined,
      cacheReadTokens: cacheReadTokens || undefined,
      tokensUsed: inputTokens + outputTokens, // Backwards compat
      costUSD: cost.totalCost,
      errorMessage,
    }
  }

  const newStatus: AgentStatus =
    status === 'completed'
      ? 'completed'
      : status === 'paused'
        ? 'paused'
        : status === 'cancelled'
          ? 'idle'
          : 'error'

  store.updateNode(conversationId, {
    agentRunHistory: history,
    agentStatus: newStatus,
  })
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function initAgentService(): void {
  // Strict single-initialization guard
  if (isServiceInitialized) {
    logger.log('[AgentService] Already initialized, skipping')
    return
  }

  if (!window.api?.agent) {
    console.warn('[AgentService] window.api.agent not available yet')
    return
  }

  // Mark as initialized BEFORE registering to prevent race conditions
  isServiceInitialized = true

  // Clean up any existing listener first (defensive)
  if (streamUnsubscribe) {
    logger.log('[AgentService] Cleaning up old listener')
    streamUnsubscribe()
    streamUnsubscribe = null
  }

  streamUnsubscribe = window.api.agent.onStreamChunk(handleStreamChunk)
  logger.log('[AgentService] Initialized stream listener (single instance)')

  // Recover any stale agent states from previous session (Fix 3)
  recoverStaleAgentStates()
}

export async function sendAgentMessage(
  conversationId: string,
  content: string,
  options: { priority?: boolean } = {},
): Promise<void> {
  // Initialize service if needed
  initAgentService()

  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)

  if (!node || node.data.type !== 'conversation') {
    throw new Error('Invalid conversation node')
  }

  const convData = node.data as ConversationNodeData

  // Add user message immediately
  store.addMessage(conversationId, 'user', content)

  // If not in agent mode, this shouldn't be called (use regular chat)
  if (convData.mode !== 'agent') {
    console.warn('[AgentService] sendAgentMessage called but node is not in agent mode')
    return
  }

  const agentState = getOrCreateState(conversationId)

  // Queue if already running for THIS agent
  if (agentState.isRunning) {
    if (options.priority) {
      agentState.pendingQueue.unshift({ conversationId, content, timestamp: Date.now() })
    } else {
      agentState.pendingQueue.push({ conversationId, content, timestamp: Date.now() })
    }
    logger.log(
      `[AgentService] Queued message for ${conversationId}, queue length: ${agentState.pendingQueue.length}`,
    )
    return
  }

  // Start agent loop
  await runAgentLoop(conversationId)
}

/**
 * Run an agent from external trigger (e.g., action step, trigger).
 * Unlike sendAgentMessage, does not add a user message first.
 */
export async function runAgent(conversationId: string): Promise<void> {
  initAgentService()

  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)

  if (!node || node.data.type !== 'conversation') {
    throw new Error('Invalid conversation node')
  }

  const convData = node.data as ConversationNodeData
  if (convData.mode !== 'agent') {
    throw new Error('Node is not in agent mode')
  }

  const agentState = getOrCreateState(conversationId)
  if (agentState.isRunning) {
    console.warn(`[AgentService] Agent ${conversationId} is already running`)
    return
  }

  await runAgentLoop(conversationId)
}

export function pauseAgent(conversationId: string): void {
  const agentState = agentStates.get(conversationId)
  if (!agentState?.isRunning) return

  agentState.pauseRequested = true

  // Also abort the current API call if one is active
  if (agentState.currentRequestId && window.api?.agent) {
    window.api.agent.cancel(agentState.currentRequestId)
  }

  logger.log(`[AgentService] Pause requested for ${conversationId}`)
}

export async function resumeAgent(conversationId: string): Promise<void> {
  const agentState = agentStates.get(conversationId)
  if (!agentState) return

  // Clear pause state
  agentState.pauseRequested = false

  // Re-enter the agent loop
  await runAgentLoop(conversationId)
}

export function stopAgent(conversationId: string): void {
  const agentState = agentStates.get(conversationId)
  if (!agentState) return

  // Signal abort to the run loop FIRST — this ensures any in-flight async
  // operations see the abort before we tear down state (Fix 1.3-C).
  if (agentState.abortController) {
    agentState.abortController.abort()
  }

  // Abort any active request
  if (agentState.currentRequestId && window.api?.agent) {
    window.api.agent.cancel(agentState.currentRequestId)
  }

  // Clear streaming state
  const store = useWorkspaceStore.getState()
  store.setStreaming(conversationId, false)

  // Clear MCP tool routing map (no per-agent MCP connections to clean up —
  // MCP connections are app-level, cleaned up on app quit)
  setMCPToolServerMap(new Map())

  // Finalize run
  finalizeRunEntry(conversationId, 'cancelled')
  resetAgentState(conversationId)
}

export function retryAgent(conversationId: string): Promise<void> {
  const store = useWorkspaceStore.getState()
  store.updateNode(conversationId, { agentStatus: 'idle' as AgentStatus })
  resetAgentState(conversationId)
  return runAgentLoop(conversationId)
}

/**
 * Interrupt a specific agent (backward-compatible with old singleton API).
 * If no conversationId provided, interrupts the first running agent found.
 */
export function interruptAgent(conversationId?: string): void {
  if (conversationId) {
    stopAgent(conversationId)
    return
  }

  // Legacy: find any running agent and stop it
  for (const [cid, state] of agentStates.entries()) {
    if (state.isRunning) {
      stopAgent(cid)
      return
    }
  }
}

export function clearAgentQueue(conversationId?: string): void {
  if (conversationId) {
    const state = agentStates.get(conversationId)
    if (state) state.pendingQueue = []
  } else {
    // Legacy: clear all queues
    for (const state of agentStates.values()) {
      state.pendingQueue = []
    }
  }
}

export function getAgentState(conversationId?: string): {
  isRunning: boolean
  currentConversationId: string | null
  queueLength: number
} {
  if (conversationId) {
    const state = agentStates.get(conversationId)
    return {
      isRunning: state?.isRunning ?? false,
      currentConversationId: conversationId,
      queueLength: state?.pendingQueue.length ?? 0,
    }
  }

  // Legacy: find any running agent
  for (const state of agentStates.values()) {
    if (state.isRunning) {
      return {
        isRunning: true,
        currentConversationId: state.currentConversationId,
        queueLength: state.pendingQueue.length,
      }
    }
  }

  return { isRunning: false, currentConversationId: null, queueLength: 0 }
}

export function getAgentStatus(conversationId: string): AgentStatus {
  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)
  if (!node || node.data.type !== 'conversation') return 'idle'
  const convData = node.data as ConversationNodeData
  return convData.agentStatus ?? 'idle'
}

// -----------------------------------------------------------------------------
// Agent Loop
// -----------------------------------------------------------------------------

async function runAgentLoop(conversationId: string): Promise<void> {
  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)
  if (!node) return

  const convData = node.data as ConversationNodeData
  const settings = convData.agentSettings || DEFAULT_AGENT_SETTINGS

  const agentState = getOrCreateState(conversationId)

  // Mutual exclusion: if a run is already in progress for this conversation,
  // reject immediately to prevent concurrent state mutations (Fix 1.3-C).
  if (
    agentState.isRunning &&
    agentState.abortController &&
    !agentState.abortController.signal.aborted
  ) {
    console.warn(
      `[AgentService] [${conversationId}] Rejecting concurrent run — agent already in progress`,
    )
    return
  }

  // Abort any leftover controller from a previous run
  if (agentState.abortController) {
    agentState.abortController.abort()
  }

  // Create a new AbortController for this run
  const abortController = new AbortController()
  agentState.abortController = abortController

  agentState.isRunning = true
  agentState.currentRequestId = uuid()
  agentState.accumulatedText = ''
  agentState.currentToolUse = null
  agentState.historyActions = []
  agentState.pauseRequested = false

  // Create run entry for history tracking
  createRunEntry(conversationId)

  let toolCallCount = 0
  const maxToolCalls = settings.maxToolCallsPerTurn

  // Set streaming state for UI
  store.setStreaming(conversationId, true)

  // Add placeholder assistant message
  store.addMessage(conversationId, 'assistant', '')

  // Resolve preset for system prompt prefix and memory
  const preset = convData.agentPreset ? getPresetById(convData.agentPreset) : undefined
  const memory: AgentMemory | undefined = convData.agentMemory
  const systemPromptPrefix = preset?.systemPromptPrefix

  try {
    while (agentState.isRunning && toolCallCount <= maxToolCalls) {
      // Check pause before starting iteration
      if (agentState.pauseRequested) {
        agentState.pauseRequested = false
        agentState.isRunning = false
        finalizeRunEntry(conversationId, 'paused')
        return
      }

      // Check if this run has been aborted (Fix 1.3-C) — another run may have
      // superseded us, or stopAgent was called during an async gap.
      if (abortController.signal.aborted) {
        logger.log(`[AgentService] [${conversationId}] Run aborted, exiting loop`)
        return
      }

      // Build messages for API (convert our Message format to Anthropic format)
      const messages = buildMessagesForAPI(conversationId)

      // Get context
      const context = store.getContextForNode(conversationId)

      // Get tools based on permissions (pass conversationId for context-chain path derivation)
      const canvasAndFsTools = getToolsForAgent(settings, conversationId)

      // Fetch MCP tools if the agent has MCP servers configured
      const { tools: mcpTools, mcpToolServerMap } = await getMCPToolsForAgent(settings)
      setMCPToolServerMap(mcpToolServerMap)

      const tools = [...canvasAndFsTools, ...mcpTools]

      logger.log(
        `[AgentService] [${conversationId}] Sending request with ${tools.length} tools, requestId: ${agentState.currentRequestId}`,
      )
      logger.log(
        `[AgentService] [${conversationId}] Stream listener registered: ${!!streamUnsubscribe}`,
      )
      logger.log(
        `[AgentService] [${conversationId}] Messages being sent (${messages.length} messages)`,
      )

      // Set up completion promise BEFORE sending request
      // This ensures we don't miss the 'done' event
      const completionPromise = waitForIterationComplete(conversationId)

      // Set up iteration timeout (5 minutes)
      if (agentState.iterationTimeout) {
        clearTimeout(agentState.iterationTimeout)
      }
      agentState.iterationTimeout = setTimeout(() => {
        console.warn(
          `[AgentService] [${conversationId}] Iteration timeout reached (${ITERATION_TIMEOUT_MS}ms)`,
        )
        agentState.iterationResolve?.({ stopReason: 'timeout' })
      }, ITERATION_TIMEOUT_MS)

      // Send request — catch IPC errors so the user isn't stuck waiting
      try {
        window.api.agent.sendWithTools({
          requestId: agentState.currentRequestId!,
          conversationId,
          messages,
          context: context || '',
          tools,
          model: convData.workspaceOverrides?.llm?.model || 'claude-sonnet-4-6',
          memory: memory || undefined,
          systemPromptPrefix: systemPromptPrefix || undefined,
        })
      } catch (ipcError) {
        console.error('[AgentService] IPC sendWithTools failed:', ipcError)
        toast.error('Failed to start agent — check your connection and try again')
        finalizeRunEntry(conversationId, 'error')
        resetAgentState(conversationId)
        store.setStreaming(conversationId, false)
        return
      }

      logger.log(`[AgentService] [${conversationId}] Request sent, waiting for completion...`)

      // Wait for this iteration to complete (via stream events)
      const { stopReason } = await completionPromise

      // Clear iteration timeout
      if (agentState.iterationTimeout) {
        clearTimeout(agentState.iterationTimeout)
        agentState.iterationTimeout = null
      }

      logger.log(`[AgentService] [${conversationId}] Iteration complete, stopReason: ${stopReason}`)

      // Check if we need to continue (tool was called)
      if (!agentState.isRunning) break

      // Check for timeout
      if (stopReason === 'timeout') {
        store.updateLastMessage(
          conversationId,
          agentState.accumulatedText + '\n\n[Iteration timed out after 5 minutes]',
        )
        finalizeRunEntry(conversationId, 'error', 'Iteration timeout (5 minutes)')
        break
      }

      // Check for error
      if (stopReason === 'error') {
        finalizeRunEntry(conversationId, 'error', 'Stream error')
        break
      }

      // Process any pending tool calls
      if (stopReason === 'tool_use' && agentState.currentToolUse) {
        // Explicit type to preserve narrowing (TS control flow doesn't track module-level mutations)
        const toolUse = agentState.currentToolUse as { id: string; name: string; inputJson: string }
        toolCallCount++
        agentState.toolCallCount = toolCallCount

        // Streaming batch_create was already executed during tool_use_delta/tool_use_end —
        // skip executeTool and use the cached result for conversation history.
        if (agentState.streamingExecuted && agentState.streamingToolResult) {
          const toolUseMsg: Message = {
            id: uuid(),
            role: 'tool_use',
            content: `Calling ${toolUse.name}`,
            timestamp: Date.now(),
            toolName: toolUse.name,
            toolInput: JSON.parse(toolUse.inputJson || '{}'),
            toolUseId: toolUse.id,
          }
          store.addToolMessage(conversationId, toolUseMsg)

          const toolResultMsg: Message = {
            id: uuid(),
            role: 'tool_result',
            content: agentState.streamingToolResult,
            timestamp: Date.now(),
            toolResultFor: toolUse.id,
            isError: false,
          }
          store.addToolMessage(conversationId, toolResultMsg)

          // Clean up streaming state
          agentState.streamingExecuted = false
          agentState.streamingToolResult = null

          // Reset for next iteration
          agentState.currentToolUse = null
          agentState.accumulatedText = ''
          const newRequestId = uuid()
          logger.log(
            `[AgentService] [${conversationId}] Streaming batch_create complete, new requestId: ${newRequestId}`,
          )
          agentState.currentRequestId = newRequestId
          store.addMessage(conversationId, 'assistant', '')
          continue
        }

        // Parse tool input once with error handling — malformed JSON from the
        // stream must not crash the agent loop (Fix 1.3-B).
        let parsedToolInput: Record<string, unknown>
        try {
          parsedToolInput = JSON.parse(toolUse.inputJson || '{}')
        } catch (parseError) {
          console.error(
            `[AgentService] [${conversationId}] Failed to parse tool input JSON for ${toolUse.name}:`,
            parseError,
          )
          logger.log(`[AgentService] [${conversationId}] Raw inputJson: ${toolUse.inputJson}`)

          // Add an error tool_result so Claude sees the failure and can recover
          const errorToolUseMsg: Message = {
            id: uuid(),
            role: 'tool_use',
            content: `Calling ${toolUse.name}`,
            timestamp: Date.now(),
            toolName: toolUse.name,
            toolInput: {},
            toolUseId: toolUse.id,
          }
          store.addToolMessage(conversationId, errorToolUseMsg)

          const errorToolResultMsg: Message = {
            id: uuid(),
            role: 'tool_result',
            content: `Error: Malformed tool input JSON — could not parse arguments for ${toolUse.name}`,
            timestamp: Date.now(),
            toolResultFor: toolUse.id,
            isError: true,
          }
          store.addToolMessage(conversationId, errorToolResultMsg)

          // Reset for next iteration and let the loop continue
          agentState.currentToolUse = null
          agentState.accumulatedText = ''
          const newRequestId = uuid()
          agentState.currentRequestId = newRequestId
          store.addMessage(conversationId, 'assistant', '')
          continue
        }

        // Add tool_use message
        const toolUseMsg: Message = {
          id: uuid(),
          role: 'tool_use',
          content: `Calling ${toolUse.name}`,
          timestamp: Date.now(),
          toolName: toolUse.name,
          toolInput: parsedToolInput,
          toolUseId: toolUse.id,
        }
        store.addToolMessage(conversationId, toolUseMsg)

        // Execute tool (async for filesystem IPC tools, sync for canvas tools)
        logger.log(`[AgentService] [${conversationId}] Executing tool: ${toolUse.name}`)
        const result = await executeTool(toolUse.name, parsedToolInput, conversationId)

        // Add tool_result message
        const toolResultMsg: Message = {
          id: uuid(),
          role: 'tool_result',
          content: result.success
            ? JSON.stringify(result.result, null, 2)
            : `Error: ${result.error}`,
          timestamp: Date.now(),
          toolResultFor: toolUse.id,
          isError: !result.success,
        }
        store.addToolMessage(conversationId, toolResultMsg)

        // Show error toast for tool failures
        if (!result.success) {
          toast.error(`Tool error: ${result.error}`)
        }

        // Check abort after tool execution — async gap where state may have changed (Fix 1.3-C)
        if (abortController.signal.aborted) {
          logger.log(
            `[AgentService] [${conversationId}] Run aborted after tool execution, exiting loop`,
          )
          return
        }

        // Check pause after tool execution (Fix 5)
        if (agentState.pauseRequested) {
          agentState.pauseRequested = false
          agentState.isRunning = false
          finalizeRunEntry(conversationId, 'paused')
          store.setStreaming(conversationId, false)
          return
        }

        // Reset for next iteration
        agentState.currentToolUse = null
        agentState.accumulatedText = ''
        const newRequestId = uuid()
        logger.log(
          `[AgentService] [${conversationId}] Tool executed, new requestId for next iteration: ${newRequestId}`,
        )
        agentState.currentRequestId = newRequestId

        // Add empty placeholder for next assistant response
        store.addMessage(conversationId, 'assistant', '')

        // Continue loop to let Claude see the result
        if (toolCallCount <= maxToolCalls && agentState.isRunning) {
          continue
        }
        break
      }

      // Normal end of turn
      if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
        finalizeRunEntry(conversationId, 'completed')
        break
      }

      // Max tokens reached
      if (stopReason === 'max_tokens') {
        store.updateLastMessage(
          conversationId,
          agentState.accumulatedText + '\n\n[Response truncated due to length limit]',
        )
        finalizeRunEntry(conversationId, 'completed')
        break
      }

      // Unknown stop reason or cancelled
      finalizeRunEntry(conversationId, 'completed')
      break
    }

    if (toolCallCount > maxToolCalls) {
      store.addMessage(
        conversationId,
        'assistant',
        `I've reached the maximum tool calls (${maxToolCalls}) for this turn. Let me know if you'd like me to continue.`,
      )
      finalizeRunEntry(conversationId, 'completed')
    }
  } catch (error) {
    console.error(`[AgentService] [${conversationId}] Agent error:`, error)

    const errorMessage = (error as Error).message
    if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
      toast.error('API authentication failed. Please check your API key.')
    } else if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      toast.error('Rate limit exceeded. Please wait and try again.')
    } else if (errorMessage.includes('network')) {
      toast.error('Network error. Please check your connection.')
    }

    store.updateLastMessage(conversationId, `Sorry, I encountered an error: ${errorMessage}`)
    finalizeRunEntry(conversationId, 'error', errorMessage)
  } finally {
    store.setStreaming(conversationId, false)
    resetAgentState(conversationId)

    // Process queue for this agent
    const agentState = agentStates.get(conversationId)
    if (agentState && agentState.pendingQueue.length > 0) {
      const next = agentState.pendingQueue.shift()!
      setTimeout(() => runAgentLoop(next.conversationId), 100)
    }
  }
}

// -----------------------------------------------------------------------------
// Stream Handling
// -----------------------------------------------------------------------------

function waitForIterationComplete(conversationId: string): Promise<{ stopReason: string }> {
  const agentState = getOrCreateState(conversationId)
  return new Promise((resolve) => {
    agentState.iterationResolve = resolve
  })
}

function handleStreamChunk(chunk: AgentStreamChunk): void {
  logger.log('[AgentService] Received chunk:', chunk.type, 'for request:', chunk.requestId)

  // Check external handlers first (chatToolService piggybacks here)
  const externalHandler = externalStreamHandlers.get(chunk.requestId)
  if (externalHandler) {
    externalHandler.onChunk(chunk)
    return
  }

  // Find which agent this chunk belongs to by requestId
  const agentState = findStateByRequestId(chunk.requestId)
  if (!agentState) {
    console.warn('[AgentService] Ignoring chunk - no agent found for requestId:', chunk.requestId)
    return
  }

  // Ignore chunks for stopped runs — prevents stop button race condition
  // where late-arriving chunks re-enable streaming state after interrupt
  if (!agentState.isRunning) {
    logger.log('[AgentService] Ignoring chunk for stopped run:', chunk.requestId)
    return
  }

  const conversationId = agentState.currentConversationId
  const store = useWorkspaceStore.getState()

  switch (chunk.type) {
    case 'text_delta':
      if (!agentState.streamingStarted) {
        agentState.streamingStarted = true
        store.setStreaming(conversationId, true)
      }
      agentState.accumulatedText += chunk.content || ''
      logger.log(
        `[AgentService] [${conversationId}] text_delta - accumulated length:`,
        agentState.accumulatedText.length,
      )
      store.updateLastMessage(conversationId, agentState.accumulatedText)
      break

    case 'tool_use_start':
      if (!chunk.toolUseId || !chunk.toolName) {
        console.error(
          `[AgentService] [${conversationId}] tool_use_start chunk missing toolUseId or toolName, skipping`,
          {
            toolUseId: chunk.toolUseId,
            toolName: chunk.toolName,
          },
        )
        break
      }
      agentState.currentToolUse = {
        id: chunk.toolUseId,
        name: chunk.toolName,
        inputJson: '',
      }
      // Streaming execution for batch_create — create nodes incrementally
      if (chunk.toolName === 'batch_create') {
        agentState.streamingParser = new IncrementalBatchParser()
        agentState.streamingTempIdMap = new Map<string, string>()
        agentState.streamingDeferredEdges = []
        agentState.streamingNodeCount = 0
      }
      break

    case 'tool_use_delta':
      if (agentState.currentToolUse) {
        agentState.currentToolUse.inputJson += chunk.toolInput || ''

        // Streaming batch_create — parse and create nodes incrementally
        if (
          agentState.streamingParser &&
          agentState.streamingTempIdMap &&
          agentState.streamingDeferredEdges
        ) {
          const events = agentState.streamingParser.feed(chunk.toolInput || '')
          for (const event of events) {
            if (event.type === 'node') {
              const nodeData = event.data as Record<string, unknown>
              const tempId =
                (nodeData.temp_id as string) || `streaming-${agentState.streamingNodeCount}`
              const nodeType = (nodeData.type as string) || 'note'

              // Position in a rough grid relative to conversation node
              const convNode = store.nodes.find((n) => n.id === conversationId)
              const baseX = convNode?.position?.x ?? 0
              const baseY = convNode?.position?.y ?? 0
              const col = agentState.streamingNodeCount % 4
              const row = Math.floor(agentState.streamingNodeCount / 4)
              const pos = { x: baseX + col * 350, y: baseY + 200 + row * 300 }

              const realId = store.addNode(nodeType as Parameters<typeof store.addNode>[0], pos)
              const updateData: Record<string, unknown> = {}
              if (nodeData.title) updateData.title = nodeData.title
              if (nodeData.content) updateData.content = nodeData.content
              if (nodeData.description) updateData.description = nodeData.description
              if (nodeData.contentType) updateData.contentType = nodeData.contentType
              if (nodeData.status) updateData.status = nodeData.status
              if (nodeData.priority) updateData.priority = nodeData.priority
              store.updateNode(realId, updateData)

              agentState.streamingTempIdMap.set(tempId, realId)
              agentState.streamingNodeCount++
            } else if (event.type === 'edge') {
              agentState.streamingDeferredEdges.push(event.data)
            }
            // error events are logged but don't stop streaming
            if (event.type === 'error') {
              console.warn(
                `[AgentService] [${conversationId}] Streaming parse error:`,
                event.message,
              )
            }
          }
        }
      }
      break

    case 'tool_use_end':
      // Streaming batch_create — create deferred edges and dispatch layout
      if (agentState.streamingParser && agentState.currentToolUse?.name === 'batch_create') {
        const tempIdMap = agentState.streamingTempIdMap!
        const deferredEdges = agentState.streamingDeferredEdges!

        // Create all deferred edges now that all nodes exist
        const createdEdgeIds: string[] = []
        for (const edgeData of deferredEdges) {
          const sourceId = tempIdMap.get(edgeData.source as string) || (edgeData.source as string)
          const targetId = tempIdMap.get(edgeData.target as string) || (edgeData.target as string)
          store.addEdge({
            source: sourceId,
            target: targetId,
            sourceHandle: null,
            targetHandle: null,
          })
          const edgeId = `${sourceId}-${targetId}`
          createdEdgeIds.push(edgeId)
          if (edgeData.label) {
            store.updateEdge(edgeId, { label: edgeData.label as string })
          }
        }

        // Dispatch layout pipeline via EventTarget (avoids circular dependency with chatToolService)
        const createdNodeIds = Array.from(tempIdMap.values())
        layoutEvents.dispatchEvent(
          new CustomEvent('run-layout', {
            detail: { nodeIds: createdNodeIds, edgeIds: createdEdgeIds, conversationId },
          }),
        )

        // Mark tool as already executed — skip executeTool in the done/loop handler
        agentState.streamingExecuted = true
        agentState.streamingToolResult = JSON.stringify({
          success: true,
          nodesCreated: tempIdMap.size,
          edgesCreated: deferredEdges.length,
          nodeMap: Object.fromEntries(tempIdMap),
        })

        // Cleanup parser state
        agentState.streamingParser = null
        agentState.streamingTempIdMap = null
        agentState.streamingDeferredEdges = null
        agentState.streamingNodeCount = 0
      }
      break

    case 'run_layout' as any:
      // Agent SDK path: tools executed in-process, no streaming parser.
      // Collect ALL nodes reachable from the conversation node (BFS traversal),
      // not just direct neighbors — the demo graph is multi-level deep.
      {
        const layoutStore = useWorkspaceStore.getState()
        const connectedNodeIds = new Set<string>()
        const queue = [conversationId]
        const visited = new Set<string>([conversationId])
        while (queue.length > 0) {
          const current = queue.shift()!
          const edges = layoutStore.edges.filter(
            (e) => e.source === current || e.target === current,
          )
          for (const e of edges) {
            const neighbor = e.source === current ? e.target : e.source
            if (!visited.has(neighbor)) {
              visited.add(neighbor)
              connectedNodeIds.add(neighbor)
              queue.push(neighbor)
            }
          }
        }
        if (connectedNodeIds.size > 0) {
          // layoutEvents already imported at top of file
          layoutEvents.dispatchEvent(
            new CustomEvent('run-layout', {
              detail: {
                nodeIds: Array.from(connectedNodeIds),
                edgeIds: [],
                conversationId,
              },
            }),
          )
        }
      }
      break

    case 'turn_start':
      // Emitted by agentLoop at the start of each turn after the first.
      // Reset the text accumulator and create a new assistant placeholder so
      // that subsequent text_delta events appear in a fresh message bubble
      // rather than appending to the previous turn's message.
      agentState.accumulatedText = ''
      agentState.streamingStarted = false
      store.addMessage(conversationId, 'assistant', '')
      logger.log(
        `[AgentService] [${conversationId}] turn_start — new assistant placeholder created for turn ${(chunk as any).turnIndex}`,
      )
      break

    case 'done':
      // Accumulate token usage across iterations (multi-turn agent runs)
      if (chunk.usage) {
        agentState.totalInputTokens += chunk.usage.input_tokens
        agentState.totalOutputTokens += chunk.usage.output_tokens
        agentState.totalCacheCreationTokens += chunk.usage.cache_creation_input_tokens || 0
        agentState.totalCacheReadTokens += chunk.usage.cache_read_input_tokens || 0
      }
      agentState.iterationResolve?.({ stopReason: chunk.stopReason || 'end_turn' })
      break

    case 'error':
      console.error(`[AgentService] [${conversationId}] Stream error:`, chunk.error)
      if (chunk.stack) console.error(`[AgentService] Stack:`, chunk.stack)

      // Show toast for critical errors
      if (chunk.error?.includes('authentication') || chunk.error?.includes('API key')) {
        toast.error('Set up your API key in Settings → AI to use this feature.')
      } else if (chunk.error?.includes('rate') || chunk.error?.includes('429')) {
        toast.error('Rate limit exceeded. Please wait and try again.')
      } else if (chunk.error?.includes('network')) {
        toast.error('Network error. Please check your connection.')
      }

      // Update message with error
      store.updateLastMessage(conversationId, `Error: ${chunk.error}`)

      agentState.iterationResolve?.({ stopReason: 'error' })
      break
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function registerExternalStreamHandler(
  requestId: string,
  handler: ExternalStreamHandler,
): void {
  externalStreamHandlers.set(requestId, handler)
}

export function unregisterExternalStreamHandler(requestId: string): void {
  externalStreamHandlers.delete(requestId)
}

export function buildMessagesForAPI(
  conversationId: string,
): Array<{ role: string; content: unknown }> {
  const store = useWorkspaceStore.getState()
  const node = store.nodes.find((n) => n.id === conversationId)
  if (!node) return []

  const convData = node.data as ConversationNodeData
  const apiMessages: Array<{ role: string; content: unknown }> = []

  // Build messages, consolidating assistant text + tool_use into single messages
  // Anthropic API requires tool_use to be in the same message as any preceding text
  let i = 0
  while (i < convData.messages.length) {
    const msg = convData.messages[i]!

    // Skip empty assistant messages (placeholders)
    if (msg.role === 'assistant' && !msg.content.trim()) {
      i++
      continue
    }

    if (msg.role === 'user') {
      apiMessages.push({ role: 'user', content: msg.content })
      i++
    } else if (msg.role === 'assistant') {
      // Check if the next message is a tool_use - if so, consolidate them
      const nextMsg = convData.messages[i + 1]
      if (nextMsg && nextMsg.role === 'tool_use') {
        // Build content array with text block and tool_use block
        const contentBlocks: unknown[] = []

        // Add text block if there's content
        if (msg.content.trim()) {
          contentBlocks.push({
            type: 'text',
            text: msg.content,
          })
        }

        // Add tool_use block
        contentBlocks.push({
          type: 'tool_use',
          id: nextMsg.toolUseId,
          name: nextMsg.toolName,
          input: nextMsg.toolInput,
        })

        apiMessages.push({
          role: 'assistant',
          content: contentBlocks,
        })
        i += 2 // Skip both messages
      } else {
        // Just a text message
        apiMessages.push({ role: 'assistant', content: msg.content })
        i++
      }
    } else if (msg.role === 'tool_use') {
      // Standalone tool_use (shouldn't happen with proper consolidation above, but handle it)
      apiMessages.push({
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: msg.toolUseId,
            name: msg.toolName,
            input: msg.toolInput,
          },
        ],
      })
      i++
    } else if (msg.role === 'tool_result') {
      apiMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolResultFor,
            content: msg.content,
            is_error: msg.isError,
          },
        ],
      })
      i++
    } else {
      i++
    }
  }

  return apiMessages
}
