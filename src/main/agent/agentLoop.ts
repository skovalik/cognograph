// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Loop Core — tool-use execution loop for the API path.
 *
 * Streams responses from the LLM, parses tool calls from FINAL accumulated
 * messages (not streaming partials), executes them via the shared toolExecutor,
 * injects results back into messages, and repeats until end_turn or maxTurns.
 *
 * This module has NO Electron dependencies — it takes an Anthropic client
 * and ToolPool as parameters. This separation keeps the loop testable
 * without mocking IPC, safeStorage, or BrowserWindow.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { parseToolCalls } from '../tools/responseParser'
import { executeToolCallsConcurrently } from '../tools/toolExecutor'
import type {
  ExecutionContext,
  NormalizedToolCall,
  ToolPool,
  ToolResult,
  ToolResultContentImage,
} from '../tools/types'
import { logger } from '../utils/logger'
import { type GenericMessage, microcompact } from './microcompact'
import { estimateTokens } from './tokenEstimation'
import { withRetry } from './withRetry'

// === Phase 1B additions — preserve across Phase 2 rewrite ===
/** Default max_tokens for API calls */
const DEFAULT_MAX_TOKENS = 8192
/** Escalation multiplier when response is truncated (stop_reason: max_tokens) */
const ESCALATION_MULTIPLIER = 4
/** Absolute ceiling for escalated max_tokens */
const MAX_TOKENS_CEILING = 64_000
// === end Phase 1B additions ===

/** C3: Fraction of effectiveMaxTokens at which proactive microcompaction triggers */
const PROACTIVE_COMPACT_THRESHOLD = 0.75

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for runAgentWithToolLoop.
 */
export interface AgentLoopConfig {
  /** Anthropic client instance */
  client: Anthropic
  /** Model to use */
  model: string
  /** System prompt */
  systemPrompt: string
  /** Initial conversation messages */
  messages: Anthropic.MessageParam[]
  /** Assembled tool pool with all available tools */
  toolPool: ToolPool
  /** Execution context for tool calls */
  executionContext: ExecutionContext
  /** Maximum number of tool-use loop turns (default: 25) */
  maxTurns?: number
  /** Initial max_tokens for API calls */
  maxTokens?: number
  /** AbortSignal for cooperative cancellation */
  signal?: AbortSignal
  /** Callback for transport events */
  onEvent?: (event: AgentLoopEvent) => void

  /** Callback between turns — refresh context, check budget */
  onTurnEnd?: (ctx: {
    turnCount: number
    messages: Anthropic.MessageParam[]
    lastToolCalls: NormalizedToolCall[]
  }) => Promise<{ systemPrompt?: string } | void>
}

/**
 * Events emitted during the agent loop.
 *
 * tool-start includes toolInput so the bridge can forward it to the renderer
 * for display in the tool badge (toolInput was added for Final-13 / C-FIX-2).
 *
 * tool-result includes toolName so the bridge can route batch_create results
 * correctly without having to re-resolve the tool name from the toolId
 * (toolName was added for Final-15 / C-FIX-2).
 */
export type AgentLoopEvent =
  | { type: 'tool-start'; toolName: string; toolId: string; toolInput: Record<string, unknown> }
  | { type: 'tool-result'; toolId: string; toolName: string; result: ToolResult }
  | { type: 'text-delta'; content: string }
  | { type: 'node-created'; nodeId: string; nodeType: string }
  /** Emitted at the START of each LLM turn after the first. The renderer uses
   * this to create a new assistant message placeholder and reset its text buffer
   * so that text from subsequent turns does not merge into the previous message. */
  | { type: 'turn-start'; turnIndex: number }

/**
 * Result of a completed agent loop.
 */
export interface AgentLoopResult {
  /** Final accumulated response messages (all assistant + tool_result messages) */
  messages: Anthropic.MessageParam[]
  /** Final stop reason */
  stopReason: string
  /** Total token usage across all turns */
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  /** Number of tool-use loop turns executed */
  turnCount: number
}

// ---------------------------------------------------------------------------
// Agent Loop
// ---------------------------------------------------------------------------

/**
 * Run the API-path agent loop with tool execution.
 *
 * Streams responses from the LLM, parses tool calls from FINAL messages
 * (not partial streaming), executes them via the shared toolExecutor,
 * injects results back into messages, and repeats until end_turn or maxTurns.
 *
 * === Phase 1B additions are preserved ===
 * - Output token escalation (effectiveMaxTokens, ESCALATION_MULTIPLIER)
 */
export async function runAgentWithToolLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const { client, model, toolPool, signal, onEvent, onTurnEnd } = config
  let systemPrompt = config.systemPrompt

  const maxTurns = config.maxTurns ?? 25
  let messages = [...config.messages] // Copy to avoid mutating caller's array

  // === Phase 1B additions — preserve across Phase 2 rewrite ===
  let effectiveMaxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS
  // === end Phase 1B additions ===

  let currentCtx = config.executionContext

  // Accumulate usage across turns
  const totalUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }

  // Generate Anthropic tool definitions from pool
  const anthropicTools = toolPool.toAnthropicFormat()

  let turnCount = 0
  let lastStopReason = 'end_turn'

  // C2: readCache persists across all turns so repeated reads of the same file
  // return FILE_UNCHANGED_STUB rather than resending identical content.
  const readCache = new Map<string, string>()

  // C4: tombstoned is set after actual tool_results are injected on abort,
  // preventing any further turns (onTurnEnd, next LLM call) after cancellation.
  let tombstoned = false

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) {
      lastStopReason = 'cancelled'
      break
    }

    turnCount++

    // Emit turn-start for turns after the first — the renderer uses this to
    // create a new assistant message placeholder and reset its text accumulator
    // so that text from subsequent turns does not merge into the previous bubble.
    // Turn 1 is excluded: the renderer already created a placeholder before
    // calling sendWithTools (in runAgentLoop's store.addMessage call).
    if (turn > 0) {
      onEvent?.({ type: 'turn-start', turnIndex: turn })
    }

    // === C3: Proactive microcompaction at 75% token budget ===
    // Runs BEFORE the API call to prevent context overflow (vs C1's reactive
    // onRetry path which handles 413s after they occur).
    const estimatedTokens = estimateTokens(JSON.stringify(messages))
    if (estimatedTokens > effectiveMaxTokens * PROACTIVE_COMPACT_THRESHOLD) {
      const compactResult = microcompact(messages as unknown as GenericMessage[], 'anthropic')
      messages = compactResult.messages as unknown as Anthropic.MessageParam[]
      logger.info(
        `[AgentLoop] Proactive microcompact at turn ${turnCount} — ` +
          `estimated ${estimatedTokens} tokens (>${Math.round(effectiveMaxTokens * PROACTIVE_COMPACT_THRESHOLD)} budget), ` +
          `removed ${compactResult.removedCount} msgs, ` +
          `truncated ${compactResult.truncatedCount} tool results`,
      )
    }

    // === C5: Stream Idle Watchdog ===
    // Create a child AbortController so we can abort on idle timeout
    // independently from the outer cancellation signal.
    const watchdog = new AbortController()
    if (signal) {
      signal.addEventListener('abort', () => watchdog.abort(signal.reason), { once: true })
    }
    let watchdogTimer = setTimeout(() => watchdog.abort(new Error('Stream idle timeout')), 90_000)

    // === C1: Wire withRetry + C5 watchdog around the stream call ===
    // eslint-disable-next-line prefer-const
    let stream: ReturnType<typeof client.messages.stream>
    try {
      stream = await withRetry(
        async (_retrySignal) => {
          // Reset the watchdog timer on each retry attempt
          clearTimeout(watchdogTimer)
          watchdogTimer = setTimeout(() => watchdog.abort(new Error('Stream idle timeout')), 90_000)
          return client.messages.stream(
            {
              model,
              max_tokens: effectiveMaxTokens,
              system: systemPrompt,
              messages,
              tools: anthropicTools.length > 0 ? (anthropicTools as Anthropic.Tool[]) : undefined,
            },
            // Always pass watchdog.signal — the outer signal already cascades to the
            // watchdog via the addEventListener above, so both abort paths are covered:
            //   outer signal aborts → watchdog aborts → SDK stream aborts
            //   watchdog timeout   → watchdog aborts → SDK stream aborts
            { signal: watchdog.signal },
          )
        },
        {
          maxRetries: 3,
          provider: 'anthropic',
          signal: watchdog.signal,
          onRetry: (info) => {
            // On context_length / 413, microcompact messages before retrying
            if (info.classified.status === 413 || info.classified.category === 'context_length') {
              const result = microcompact(messages as GenericMessage[], 'anthropic')
              messages = result.messages as Anthropic.MessageParam[]
              logger.warn(
                `[AgentLoop] Context overflow on attempt ${info.attempt} — ` +
                  `microcompacted: removed ${result.removedCount} msgs, ` +
                  `truncated ${result.truncatedCount} tool results`,
              )
            }
          },
        },
      )

      // Forward text deltas during streaming; reset watchdog on each event
      for await (const event of stream) {
        clearTimeout(watchdogTimer)
        watchdogTimer = setTimeout(() => watchdog.abort(new Error('Stream idle timeout')), 90_000)

        if (signal?.aborted) break

        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onEvent?.({ type: 'text-delta', content: event.delta.text })
        }
      }
      // Clear watchdog after stream ends normally
      clearTimeout(watchdogTimer)
    } catch (err) {
      // Clear watchdog on any throw (withRetry exhausted, stream error, etc.)
      // so the timer never fires on a stale AbortController after this turn exits.
      clearTimeout(watchdogTimer)
      throw err
    }

    const finalMessage = await stream.finalMessage()

    // Accumulate usage
    if (finalMessage.usage) {
      totalUsage.input_tokens += finalMessage.usage.input_tokens
      totalUsage.output_tokens += finalMessage.usage.output_tokens
      const usage = finalMessage.usage as Record<string, unknown>
      if (typeof usage.cache_creation_input_tokens === 'number') {
        totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens
      }
      if (typeof usage.cache_read_input_tokens === 'number') {
        totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens
      }
    }

    lastStopReason = finalMessage.stop_reason || 'end_turn'

    // === Phase 1B additions — preserve across Phase 2 rewrite ===
    // 1.5b: If response was truncated (max_tokens), escalate and retry
    if (
      lastStopReason === 'max_tokens' &&
      effectiveMaxTokens < MAX_TOKENS_CEILING &&
      !signal?.aborted
    ) {
      const previousTokens = effectiveMaxTokens
      effectiveMaxTokens = Math.min(effectiveMaxTokens * ESCALATION_MULTIPLIER, MAX_TOKENS_CEILING)
      logger.warn(
        `[AgentLoop] Output truncated (stop_reason: max_tokens). ` +
          `Escalating max_tokens: ${previousTokens} → ${effectiveMaxTokens}`,
      )
      onEvent?.({
        type: 'text-delta',
        content: `\n\n*Response was truncated — retrying with higher token limit (${effectiveMaxTokens})...*\n\n`,
      })
      // Add the truncated assistant message, then continue loop
      messages.push({
        role: 'assistant',
        content: finalMessage.content as Anthropic.ContentBlock[],
      })
      // Add a user message requesting continuation
      messages.push({
        role: 'user',
        content: 'Please continue from where you left off.',
      })
      continue
    }
    // === end Phase 1B additions (1.5b escalation) ===

    // Parse tool calls from the final message
    const toolCalls = parseToolCalls(finalMessage, 'anthropic')

    // If no tool calls, we're done — this is a final text response
    if (toolCalls.length === 0) {
      // Add the final assistant message to history
      messages.push({
        role: 'assistant',
        content: finalMessage.content as Anthropic.ContentBlock[],
      })
      break
    }

    // Add the assistant message with tool_use blocks to history
    messages.push({
      role: 'assistant',
      content: finalMessage.content as Anthropic.ContentBlock[],
    })

    // C2: Emit tool-start events before concurrent execution (H-FIX-2: emit events
    // from agentLoop, not from inside the executor).
    for (const call of toolCalls) {
      onEvent?.({ type: 'tool-start', toolName: call.name, toolId: call.id, toolInput: call.input })
    }

    // C2: Execute all tool calls concurrently with the shared readCache.
    // The ReadWriteLock inside executeToolCallsConcurrently ensures reads run in
    // parallel while writes run exclusively — no additional coordination needed here.
    const { results, updatedContext } = await executeToolCallsConcurrently(
      toolCalls,
      toolPool,
      currentCtx,
      { readCache },
    )
    currentCtx = updatedContext

    // C2: Emit tool-result events AFTER execution (H-FIX-2).
    // C4: Also detect node-created events here, by index.
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i]!
      const result = results[i]!

      // Emit tool-result (toolName included for bridge routing — Final-15)
      onEvent?.({ type: 'tool-result', toolId: call.id, toolName: call.name, result })

      // Detect node creation for node-created events
      if (call.name === 'create_node' && !result.isError && result.content[0]?.type === 'text') {
        try {
          const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>
          if (typeof parsed.id === 'string' && typeof parsed.type === 'string') {
            onEvent?.({
              type: 'node-created',
              nodeId: parsed.id as string,
              nodeType: parsed.type as string,
            })
          }
        } catch {
          // JSON parse failure — not a node creation result, ignore
        }
      }
    }

    // C4: Build Anthropic-format tool_result blocks from the results array.
    // executeToolCallsConcurrently pre-allocates a fixed-length array via Promise.all —
    // every slot is filled before the promise resolves, so aborted tools get an
    // errorResult("Tool X aborted") rather than a missing slot. We ALWAYS inject
    // results here (including those abort error results) to satisfy the API contract:
    // every tool_use block must have a matching tool_result before the next turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = toolCalls.map((call, i) => {
      const result = results[i]!
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: result.content.map((c) => {
          if (c.type === 'text') {
            return { type: 'text' as const, text: c.text }
          }
          // Image content
          return {
            type: 'image' as const,
            source: (c as ToolResultContentImage).source,
          }
        }),
        is_error: result.isError ?? false,
      }
    })

    // Inject results ALWAYS — before checking for abort.
    // This ensures every tool_use block in messages has a matching tool_result,
    // satisfying the Anthropic API contract regardless of cancellation state.
    messages.push({
      role: 'user',
      content: toolResults,
    })

    // C4: THEN check for abort — tombstone prevents the next turn, not result injection.
    if (signal?.aborted) {
      tombstoned = true
      lastStopReason = 'cancelled'
      break
    }

    // Call onTurnEnd for context refresh / budget checks before next iteration
    // (only reached when not tombstoned)
    if (onTurnEnd) {
      const turnUpdate = await onTurnEnd({ turnCount, messages, lastToolCalls: toolCalls })
      if (turnUpdate?.systemPrompt) {
        systemPrompt = turnUpdate.systemPrompt
      }
    }

    // Continue loop — the next turn will send messages with tool results
  }

  return {
    messages,
    stopReason: lastStopReason,
    usage: {
      input_tokens: totalUsage.input_tokens,
      output_tokens: totalUsage.output_tokens,
      ...(totalUsage.cache_creation_input_tokens > 0
        ? { cache_creation_input_tokens: totalUsage.cache_creation_input_tokens }
        : {}),
      ...(totalUsage.cache_read_input_tokens > 0
        ? { cache_read_input_tokens: totalUsage.cache_read_input_tokens }
        : {}),
    },
    turnCount,
  }
}
