// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * compactionService.ts — LLM-powered full conversation compaction.
 *
 * When microcompact (truncate + dedup) isn't enough to bring context
 * below the token budget, this service calls the LLM to generate a
 * structured summary of the conversation so far.
 *
 * Design:
 * - Summary format: key decisions, current context, current task state
 * - Anti-drift: the original task description is always included in output
 * - Sandwich layout: [system prompt] → [compaction summary] → [recent messages]
 * - Compaction summary is placed in the DYNAMIC zone (after cache_control
 *   boundary), never in the cached static prefix
 * - Verbatim quotes from user messages are preserved in the summary
 * - 3-failure circuit breaker: if the LLM compaction call fails 3 times
 *   consecutively, the service stops trying and warns the user
 *
 * Provider-aware tool_result replacement:
 * - Anthropic: `role: 'user'` blocks with `tool_result` content type
 * - OpenAI: `role: 'tool'` messages
 * - Gemini: `role: 'function'` messages
 * Three separate code paths for replacing tool results with summaries.
 */

import type { LLMProvider } from '../tools/types'
import { logger } from '../utils/logger'
import { estimateTokens } from './tokenEstimation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max consecutive failures before circuit breaker trips */
const CIRCUIT_BREAKER_THRESHOLD = 3

/** Number of recent messages to preserve verbatim during compaction */
const DEFAULT_RECENT_WINDOW = 10

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Provider-agnostic message shape (same as microcompact.ts).
 */
export interface CompactionMessage {
  role: string
  content: unknown
  tool_use_id?: string
  tool_call_id?: string
  parts?: unknown[]
}

/**
 * Structured compaction summary.
 */
export interface CompactionSummary {
  /** Key decisions made during the conversation */
  keyDecisions: string[]
  /** Current working context / state of knowledge */
  context: string
  /** Current task state and what's in progress */
  currentTaskState: string
  /** Original task/request description (anti-drift) */
  originalTask: string
  /** Verbatim quotes from user messages worth preserving */
  verbatimQuotes: string[]
}

/**
 * Function signature for the LLM call used during compaction.
 * Injected as a dependency so the service is testable without
 * actually calling an LLM.
 */
export type CompactionLLMCall = (systemPrompt: string, userPrompt: string) => Promise<string>

/**
 * Result of a full compaction pass.
 */
export interface CompactionResult {
  /** Whether compaction succeeded */
  success: boolean
  /** The compacted message array (if success) */
  messages?: CompactionMessage[]
  /** The structured summary (if success) */
  summary?: CompactionSummary
  /** Error message (if failed) */
  error?: string
  /** Whether the circuit breaker has tripped */
  circuitBreakerTripped?: boolean
}

/**
 * Configuration for the compaction service.
 */
export interface CompactionConfig {
  /** LLM provider for format-aware processing */
  provider: LLMProvider
  /** The LLM call function for generating summaries */
  llmCall: CompactionLLMCall
  /** Number of recent messages to preserve (default 10) */
  recentWindow?: number
}

// ---------------------------------------------------------------------------
// Circuit breaker state
// ---------------------------------------------------------------------------

/**
 * Circuit breaker for LLM compaction calls.
 * Tracks consecutive failures and trips after CIRCUIT_BREAKER_THRESHOLD.
 */
export class CompactionCircuitBreaker {
  private _consecutiveFailures = 0
  private _tripped = false

  /** Record a failure. Returns true if the circuit breaker has now tripped. */
  recordFailure(): boolean {
    this._consecutiveFailures++
    if (this._consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      this._tripped = true
    }
    return this._tripped
  }

  /** Record a success, resetting the failure count. */
  recordSuccess(): void {
    this._consecutiveFailures = 0
    // Do NOT reset _tripped — once tripped, stays tripped until explicit reset
  }

  /** Whether the circuit breaker has tripped. */
  get isTripped(): boolean {
    return this._tripped
  }

  /** Get current consecutive failure count. */
  get failures(): number {
    return this._consecutiveFailures
  }

  /** Explicitly reset the circuit breaker. */
  reset(): void {
    this._consecutiveFailures = 0
    this._tripped = false
  }
}

// ---------------------------------------------------------------------------
// Summary extraction
// ---------------------------------------------------------------------------

/**
 * Extract the original task description from the conversation.
 * Looks for the first substantive user message (skipping tool results).
 */
function extractOriginalTask(messages: CompactionMessage[], provider: LLMProvider): string {
  for (const msg of messages) {
    if (msg.role !== 'user') continue

    // Skip tool result messages
    if (provider === 'anthropic' && Array.isArray(msg.content)) {
      const hasToolResult = (msg.content as Array<Record<string, unknown>>).some(
        (block) => block.type === 'tool_result',
      )
      if (hasToolResult) continue
    }
    if (provider === 'openai' && msg.role === 'tool') continue
    if (provider === 'gemini' && msg.role === 'function') continue

    // Extract text content
    if (typeof msg.content === 'string') return msg.content
    if (Array.isArray(msg.content)) {
      const texts = (msg.content as Array<Record<string, unknown>>)
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
      if (texts.length > 0) return texts.join('\n')
    }
  }
  return '(No original task found)'
}

/**
 * Extract verbatim quotes from user messages.
 * Returns short, notable quotes (not entire messages).
 */
function extractVerbatimQuotes(messages: CompactionMessage[]): string[] {
  const quotes: string[] = []

  for (const msg of messages) {
    if (msg.role !== 'user') continue

    let text: string | undefined
    if (typeof msg.content === 'string') {
      text = msg.content
    } else if (Array.isArray(msg.content)) {
      const texts = (msg.content as Array<Record<string, unknown>>)
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
      text = texts.join('\n')
    }

    if (!text) continue

    // Extract sentences that look like decisions, preferences, or corrections
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const sentence of sentences) {
      // Keep sentences that are directive or evaluative
      if (
        sentence.length > 10 &&
        sentence.length < 200 &&
        (/\b(should|must|always|never|prefer|want|need|don't|do not|instead)\b/i.test(sentence) ||
          /\b(yes|no|correct|wrong|exactly|that's right)\b/i.test(sentence))
      ) {
        quotes.push(sentence)
      }
    }
  }

  // Cap at 10 quotes to keep the summary manageable
  return quotes.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Compaction prompt
// ---------------------------------------------------------------------------

/**
 * Build the LLM prompt for generating a compaction summary.
 */
function buildCompactionPrompt(
  messages: CompactionMessage[],
  originalTask: string,
  verbatimQuotes: string[],
): string {
  // Serialize messages into a readable transcript
  const transcript = messages
    .map((msg) => {
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      } else if (Array.isArray(msg.content)) {
        content = (msg.content as Array<Record<string, unknown>>)
          .map((b) => {
            if (b.type === 'text' && typeof b.text === 'string') return b.text as string
            if (b.type === 'tool_use') return `[Tool call: ${b.name as string}]`
            if (b.type === 'tool_result') return `[Tool result]`
            return '[other content]'
          })
          .join('\n')
      }
      return `[${msg.role}]: ${content}`
    })
    .join('\n\n')

  // Truncate transcript if too long (keep under ~50k chars)
  const maxTranscript = 50_000
  const truncatedTranscript =
    transcript.length > maxTranscript
      ? transcript.slice(0, maxTranscript) + '\n\n[... transcript truncated for compaction]'
      : transcript

  const quotesSection =
    verbatimQuotes.length > 0
      ? `\n\nVerbatim quotes from user (PRESERVE THESE):\n${verbatimQuotes.map((q) => `- "${q}"`).join('\n')}`
      : ''

  return `You are compacting a conversation to fit within the context window. Generate a structured JSON summary.

Original task/request:
${originalTask}
${quotesSection}

Conversation transcript:
${truncatedTranscript}

Respond with ONLY a valid JSON object (no markdown fencing, no commentary) matching this shape:
{
  "keyDecisions": ["decision 1", "decision 2", ...],
  "context": "Current state of knowledge and working context",
  "currentTaskState": "What is currently in progress, what's done, what's next",
  "originalTask": "The original task verbatim (copy from above)",
  "verbatimQuotes": ["quote 1", "quote 2", ...]
}

Rules:
1. keyDecisions: List every significant decision made during the conversation.
2. context: Summarize what's known, what files/data have been examined, what's been established.
3. currentTaskState: Be specific about what's done, what's in progress, and what's next.
4. originalTask: Copy the original task description verbatim from above.
5. verbatimQuotes: Include all verbatim quotes provided above, plus any other notable user statements.`
}

/**
 * System prompt for the compaction LLM call.
 */
const COMPACTION_SYSTEM_PROMPT =
  'You are a conversation compactor. Your job is to produce structured JSON summaries ' +
  'of conversations that preserve all important context, decisions, and user preferences. ' +
  'You must output valid JSON only — no markdown, no commentary, no explanation.'

// ---------------------------------------------------------------------------
// Summary parsing
// ---------------------------------------------------------------------------

/**
 * Parse the LLM's response into a CompactionSummary.
 * Handles JSON wrapped in markdown fences or with trailing text.
 */
function parseSummaryResponse(response: string): CompactionSummary | null {
  let jsonStr = response.trim()

  // Strip markdown fences if present
  if (jsonStr.startsWith('```')) {
    const firstNewline = jsonStr.indexOf('\n')
    const lastFence = jsonStr.lastIndexOf('```')
    if (firstNewline !== -1 && lastFence > firstNewline) {
      jsonStr = jsonStr.slice(firstNewline + 1, lastFence).trim()
    }
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      keyDecisions: Array.isArray(parsed.keyDecisions)
        ? (parsed.keyDecisions as unknown[]).filter((d): d is string => typeof d === 'string')
        : [],
      context: typeof parsed.context === 'string' ? parsed.context : '',
      currentTaskState: typeof parsed.currentTaskState === 'string' ? parsed.currentTaskState : '',
      originalTask: typeof parsed.originalTask === 'string' ? parsed.originalTask : '',
      verbatimQuotes: Array.isArray(parsed.verbatimQuotes)
        ? (parsed.verbatimQuotes as unknown[]).filter((q): q is string => typeof q === 'string')
        : [],
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Tool result replacement — provider-specific
// ---------------------------------------------------------------------------

/**
 * Replace tool result messages with a summary message.
 * Returns old messages with tool results replaced by a compact text summary.
 */
function replaceToolResults(
  messages: CompactionMessage[],
  summary: CompactionSummary,
  provider: LLMProvider,
  recentWindow: number,
): CompactionMessage[] {
  const splitIndex = Math.max(0, messages.length - recentWindow)
  const olderMessages = messages.slice(0, splitIndex)
  const recentMessages = messages.slice(splitIndex)

  // Build the summary text block
  const summaryText = formatSummaryText(summary)

  // Filter older messages: drop tool results and their paired assistant tool_use messages
  const compacted: CompactionMessage[] = []

  for (const msg of olderMessages) {
    if (isToolResultForProvider(msg, provider)) {
      // Drop tool result messages
      continue
    }

    if (msg.role === 'assistant' && hasToolUseContent(msg)) {
      // Drop assistant messages that only contain tool_use blocks
      // Keep assistant messages that have text content alongside tool_use
      if (hasOnlyToolUseContent(msg)) continue
      // Strip tool_use blocks but keep text
      compacted.push(stripToolUseBlocks(msg))
      continue
    }

    compacted.push(msg)
  }

  // Insert the compaction summary as a system-style user message
  // (placed in the dynamic zone — between system prompt and recent messages)
  const summaryMessage: CompactionMessage = {
    role: 'user',
    content: summaryText,
  }

  return [...compacted, summaryMessage, ...recentMessages]
}

/**
 * Check if a message is a tool result for the given provider.
 */
function isToolResultForProvider(msg: CompactionMessage, provider: LLMProvider): boolean {
  switch (provider) {
    case 'anthropic':
      if (msg.role !== 'user' || !Array.isArray(msg.content)) return false
      return (msg.content as Array<Record<string, unknown>>).some(
        (block) => block.type === 'tool_result',
      )
    case 'openai':
      return msg.role === 'tool'
    case 'gemini':
      return msg.role === 'function'
    default: {
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}

/**
 * Check if an assistant message contains tool_use blocks.
 */
function hasToolUseContent(msg: CompactionMessage): boolean {
  if (!Array.isArray(msg.content)) return false
  return (msg.content as Array<Record<string, unknown>>).some((block) => block.type === 'tool_use')
}

/**
 * Check if an assistant message contains ONLY tool_use blocks (no text).
 */
function hasOnlyToolUseContent(msg: CompactionMessage): boolean {
  if (!Array.isArray(msg.content)) return false
  const blocks = msg.content as Array<Record<string, unknown>>
  return blocks.every((block) => block.type === 'tool_use')
}

/**
 * Remove tool_use blocks from an assistant message, keeping text.
 */
function stripToolUseBlocks(msg: CompactionMessage): CompactionMessage {
  if (!Array.isArray(msg.content)) return msg
  const blocks = msg.content as Array<Record<string, unknown>>
  const textBlocks = blocks.filter((block) => block.type !== 'tool_use')
  return { ...msg, content: textBlocks }
}

// ---------------------------------------------------------------------------
// Summary formatting
// ---------------------------------------------------------------------------

/**
 * Format a CompactionSummary into a readable text block for injection
 * into the conversation as a dynamic-zone message.
 */
function formatSummaryText(summary: CompactionSummary): string {
  const parts: string[] = [
    '## Conversation Compaction Summary',
    '',
    '### Original Task',
    summary.originalTask || '(not captured)',
    '',
    '### Key Decisions',
  ]

  if (summary.keyDecisions.length > 0) {
    for (const decision of summary.keyDecisions) {
      parts.push(`- ${decision}`)
    }
  } else {
    parts.push('(none recorded)')
  }

  parts.push('', '### Current Context', summary.context || '(none)', '')
  parts.push('### Current Task State', summary.currentTaskState || '(none)', '')

  if (summary.verbatimQuotes.length > 0) {
    parts.push('### User Quotes (verbatim)')
    for (const quote of summary.verbatimQuotes) {
      parts.push(`> "${quote}"`)
    }
  }

  parts.push('', '---', '(This summary was generated by automatic context compaction.)')

  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run full LLM-powered compaction on a conversation.
 *
 * Flow:
 * 1. Extract the original task and verbatim user quotes
 * 2. Build a compaction prompt from the conversation transcript
 * 3. Call the LLM to generate a structured summary
 * 4. Parse the summary response
 * 5. Replace tool results with the summary (provider-aware)
 * 6. Return compacted messages in sandwich layout:
 *    [existing system prompt context] → [compaction summary] → [recent messages]
 *
 * If the LLM call fails, the circuit breaker tracks failures and trips
 * after 3 consecutive failures.
 *
 * @param messages - Full conversation history
 * @param config - Compaction configuration (provider, LLM call, etc.)
 * @param circuitBreaker - Circuit breaker instance (shared across calls)
 * @returns CompactionResult
 */
export async function compactConversation(
  messages: CompactionMessage[],
  config: CompactionConfig,
  circuitBreaker: CompactionCircuitBreaker,
): Promise<CompactionResult> {
  // Check circuit breaker
  if (circuitBreaker.isTripped) {
    return {
      success: false,
      error:
        'Compaction circuit breaker is tripped — too many consecutive failures. Context may be too large for continued operation.',
      circuitBreakerTripped: true,
    }
  }

  const recentWindow = config.recentWindow ?? DEFAULT_RECENT_WINDOW

  if (messages.length === 0) {
    return { success: true, messages: [], summary: undefined }
  }

  // Extract context for the summary
  const originalTask = extractOriginalTask(messages, config.provider)
  const verbatimQuotes = extractVerbatimQuotes(messages)

  // Build prompt
  const prompt = buildCompactionPrompt(messages, originalTask, verbatimQuotes)

  // Call LLM
  let response: string
  try {
    response = await config.llmCall(COMPACTION_SYSTEM_PROMPT, prompt)
  } catch (err) {
    const tripped = circuitBreaker.recordFailure()
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.warn(
      `[CompactionService] LLM call failed (${circuitBreaker.failures}/${CIRCUIT_BREAKER_THRESHOLD}): ${errorMsg}`,
    )
    return {
      success: false,
      error: `Compaction LLM call failed: ${errorMsg}`,
      circuitBreakerTripped: tripped,
    }
  }

  // Parse summary
  const summary = parseSummaryResponse(response)
  if (!summary) {
    const tripped = circuitBreaker.recordFailure()
    logger.warn(
      `[CompactionService] Failed to parse summary response (${circuitBreaker.failures}/${CIRCUIT_BREAKER_THRESHOLD})`,
    )
    return {
      success: false,
      error: 'Failed to parse compaction summary from LLM response',
      circuitBreakerTripped: tripped,
    }
  }

  // Ensure verbatim quotes from extraction are preserved in the summary
  const allQuotes = new Set([...summary.verbatimQuotes, ...verbatimQuotes])
  summary.verbatimQuotes = [...allQuotes]

  // Ensure original task is preserved (anti-drift)
  if (!summary.originalTask || summary.originalTask === '') {
    summary.originalTask = originalTask
  }

  // Replace tool results with summary
  const compactedMessages = replaceToolResults(messages, summary, config.provider, recentWindow)

  // Record success
  circuitBreaker.recordSuccess()

  logger.log(
    `[CompactionService] Compaction successful. ` +
      `${messages.length} → ${compactedMessages.length} messages, ` +
      `${summary.keyDecisions.length} decisions, ` +
      `${summary.verbatimQuotes.length} quotes preserved`,
  )

  return {
    success: true,
    messages: compactedMessages,
    summary,
  }
}

/**
 * Estimate whether full compaction would be beneficial.
 *
 * Returns true if the messages contain enough tool results and older
 * messages that compaction would meaningfully reduce token count.
 *
 * @param messages - Conversation messages
 * @param provider - LLM provider
 * @param tokenBudget - Maximum token budget
 * @returns true if compaction is recommended
 */
export function shouldFullCompact(
  messages: CompactionMessage[],
  provider: LLMProvider,
  tokenBudget: number,
): boolean {
  // Estimate current tokens
  let totalTokens = 0
  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    totalTokens += estimateTokens(text) + 4 // +4 for message overhead
  }

  // Compaction is worthwhile if we're over 90% of budget
  return totalTokens >= tokenBudget * 0.9
}
