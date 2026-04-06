// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * microcompact.ts — Lightweight context compaction for the 85% threshold.
 *
 * When the conversation context reaches 85% of the token budget,
 * microcompaction runs BEFORE full LLM-based compaction. It:
 *
 * 1. Truncates old tool results to 2KB summaries
 * 2. Drops duplicate system messages
 * 3. Preserves the most recent N messages intact (default 10)
 *
 * Provider-aware: handles Anthropic, OpenAI, and Gemini tool_result
 * message formats (different role names and content structures).
 *
 * This is a synchronous, zero-LLM-call operation — fast enough to
 * run on every turn without noticeable latency.
 */

import type { LLMProvider } from '../tools/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum byte length for truncated tool results */
const TOOL_RESULT_MAX_BYTES = 2048

/** Default number of recent messages to preserve intact */
const DEFAULT_PRESERVE_RECENT = 10

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic message shape.
 * Each provider uses slightly different structures, but all messages
 * have at minimum a role and some form of content.
 */
export interface GenericMessage {
  role: string
  content: unknown
  /** Anthropic-specific: tool_use_id on tool_result blocks */
  tool_use_id?: string
  /** OpenAI-specific: tool_call_id on tool role messages */
  tool_call_id?: string
  /** Gemini-specific: parts array with functionResponse */
  parts?: unknown[]
}

/**
 * Result of a microcompaction pass.
 */
export interface MicrocompactResult {
  /** The compacted message array */
  messages: GenericMessage[]
  /** Number of messages removed (deduplication) */
  removedCount: number
  /** Number of tool results truncated */
  truncatedCount: number
}

// ---------------------------------------------------------------------------
// Tool result detection — provider-specific
// ---------------------------------------------------------------------------

/**
 * Detect whether a message is a tool result for the given provider.
 */
function isToolResultMessage(msg: GenericMessage, provider: LLMProvider): boolean {
  switch (provider) {
    case 'anthropic':
      // Anthropic: role: 'user' with content array containing { type: 'tool_result' }
      if (msg.role !== 'user' || !Array.isArray(msg.content)) return false
      return (msg.content as Array<Record<string, unknown>>).some(
        (block) => block.type === 'tool_result',
      )

    case 'openai':
      // OpenAI: role: 'tool' messages
      return msg.role === 'tool'

    case 'gemini':
      // Gemini: role: 'function' messages
      return msg.role === 'function'

    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Tool result truncation — provider-specific
// ---------------------------------------------------------------------------

/**
 * Truncate a tool result message's content to maxBytes.
 * Returns a new message (never mutates the original).
 */
function truncateToolResult(
  msg: GenericMessage,
  provider: LLMProvider,
  maxBytes: number,
): GenericMessage {
  switch (provider) {
    case 'anthropic':
      return truncateAnthropicToolResult(msg, maxBytes)
    case 'openai':
      return truncateOpenAIToolResult(msg, maxBytes)
    case 'gemini':
      return truncateGeminiToolResult(msg, maxBytes)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}

/**
 * Anthropic tool results: `role: 'user'`, content is an array of
 * `{ type: 'tool_result', tool_use_id, content: [{ type: 'text', text }] }` blocks.
 *
 * Returns the SAME reference if nothing was truncated (allows caller to detect changes).
 */
function truncateAnthropicToolResult(msg: GenericMessage, maxBytes: number): GenericMessage {
  if (!Array.isArray(msg.content)) return msg

  let changed = false
  const newContent = (msg.content as Array<Record<string, unknown>>).map((block) => {
    if (block.type !== 'tool_result') return block

    const innerContent = block.content
    if (!Array.isArray(innerContent)) return block

    let innerChanged = false
    const truncatedInner = (innerContent as Array<Record<string, unknown>>).map((item) => {
      if (item.type !== 'text' || typeof item.text !== 'string') return item
      if (item.text.length <= maxBytes) return item
      innerChanged = true
      return {
        ...item,
        text: item.text.slice(0, maxBytes) + '\n\n[... truncated by microcompact]',
      }
    })

    if (!innerChanged) return block
    changed = true
    return { ...block, content: truncatedInner }
  })

  if (!changed) return msg
  return { ...msg, content: newContent }
}

/**
 * OpenAI tool results: `role: 'tool'`, content is a string.
 */
function truncateOpenAIToolResult(msg: GenericMessage, maxBytes: number): GenericMessage {
  if (typeof msg.content !== 'string') return msg
  if (msg.content.length <= maxBytes) return msg

  return {
    ...msg,
    content: msg.content.slice(0, maxBytes) + '\n\n[... truncated by microcompact]',
  }
}

/**
 * Gemini tool results: `role: 'function'`, parts array with
 * `{ functionResponse: { name, response } }` objects.
 *
 * Returns the SAME reference if nothing was truncated (allows caller to detect changes).
 */
function truncateGeminiToolResult(msg: GenericMessage, maxBytes: number): GenericMessage {
  if (!Array.isArray(msg.parts)) return msg

  let changed = false
  const newParts = (msg.parts as Array<Record<string, unknown>>).map((part) => {
    const fr = part.functionResponse
    if (!fr || typeof fr !== 'object') return part

    const fnResp = fr as Record<string, unknown>
    const response = fnResp.response
    if (typeof response !== 'string') {
      // If response is an object, stringify and truncate
      const serialized = JSON.stringify(response)
      if (serialized.length <= maxBytes) return part
      changed = true
      return {
        ...part,
        functionResponse: {
          ...fnResp,
          response: serialized.slice(0, maxBytes) + '\n\n[... truncated by microcompact]',
        },
      }
    }

    if (response.length <= maxBytes) return part
    changed = true
    return {
      ...part,
      functionResponse: {
        ...fnResp,
        response: response.slice(0, maxBytes) + '\n\n[... truncated by microcompact]',
      },
    }
  })

  if (!changed) return msg
  return { ...msg, content: msg.content, parts: newParts }
}

// ---------------------------------------------------------------------------
// System message deduplication
// ---------------------------------------------------------------------------

/**
 * Get the text content of a system message for comparison.
 */
function getSystemMessageText(msg: GenericMessage): string | null {
  if (msg.role !== 'system') return null

  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    // Anthropic system blocks: [{ type: 'text', text: '...' }]
    return (msg.content as Array<Record<string, unknown>>)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run microcompaction on a message array.
 *
 * Steps:
 * 1. Identify the "protected tail" (most recent preserveRecent messages)
 * 2. In the older messages:
 *    a. Truncate tool result content to TOOL_RESULT_MAX_BYTES
 *    b. Drop duplicate system messages (keep the first occurrence)
 * 3. Return the compacted message array with stats
 *
 * @param messages - Full conversation history
 * @param provider - LLM provider for format-aware processing
 * @param preserveRecent - Number of recent messages to keep intact (default 10)
 * @returns MicrocompactResult with compacted messages and stats
 */
export function microcompact(
  messages: GenericMessage[],
  provider: LLMProvider,
  preserveRecent: number = DEFAULT_PRESERVE_RECENT,
): MicrocompactResult {
  if (messages.length === 0) {
    return { messages: [], removedCount: 0, truncatedCount: 0 }
  }

  // Split into older (compactable) and recent (protected) segments
  const splitIndex = Math.max(0, messages.length - preserveRecent)
  const olderMessages = messages.slice(0, splitIndex)
  const recentMessages = messages.slice(splitIndex)

  let removedCount = 0
  let truncatedCount = 0

  // Track system message texts for deduplication
  const seenSystemTexts = new Set<string>()

  const compactedOlder: GenericMessage[] = []

  for (const msg of olderMessages) {
    // --- Deduplicate system messages ---
    const sysText = getSystemMessageText(msg)
    if (sysText !== null) {
      if (seenSystemTexts.has(sysText)) {
        removedCount++
        continue // Drop this duplicate
      }
      seenSystemTexts.add(sysText)
    }

    // --- Truncate tool results ---
    if (isToolResultMessage(msg, provider)) {
      const truncated = truncateToolResult(msg, provider, TOOL_RESULT_MAX_BYTES)
      // Check if truncation actually happened by comparing references
      if (truncated !== msg) {
        truncatedCount++
      }
      compactedOlder.push(truncated)
    } else {
      compactedOlder.push(msg)
    }
  }

  return {
    messages: [...compactedOlder, ...recentMessages],
    removedCount,
    truncatedCount,
  }
}
