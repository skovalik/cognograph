// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * tokenEstimation.ts — Heuristic token estimation for budget decisions.
 *
 * Provides fast, zero-dependency token counting for:
 * - BFS context budget enforcement (contextWriter.ts)
 * - Compaction threshold detection (shouldCompact)
 * - Message-level estimation for conversation history
 *
 * Accuracy target: within 20% of actual tiktoken counts for typical content.
 * Uses chars/4 for English prose, chars/2 for code-heavy content.
 *
 * Structured so tiktoken can be added as an optional dependency later —
 * the tryTiktoken() path is a conditional import with heuristic fallback.
 */

// ---------------------------------------------------------------------------
// Tiktoken integration point (optional dependency — NOT installed)
// ---------------------------------------------------------------------------

/**
 * Attempt to load tiktoken for precise counting.
 * Returns null if the package is not installed.
 *
 * To enable: `npm install tiktoken` and this will auto-detect it.
 * The rest of the module falls back to heuristics when tiktoken is absent.
 */
let tiktokenEncoder: { encode: (text: string) => { length: number } } | null = null
let tiktokenAttempted = false

function tryLoadTiktoken(): typeof tiktokenEncoder {
  if (tiktokenAttempted) return tiktokenEncoder
  tiktokenAttempted = true

  try {
    // Dynamic require — only succeeds if tiktoken is installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tiktoken = require('tiktoken')
    tiktokenEncoder = tiktoken.encoding_for_model('claude-3-5-sonnet-20241022')
    return tiktokenEncoder
  } catch {
    // tiktoken not installed — use heuristic fallback
    return null
  }
}

// ---------------------------------------------------------------------------
// Content classification
// ---------------------------------------------------------------------------

/**
 * Detect whether content is code-heavy.
 * Code typically tokenizes at ~2 chars/token due to operators, brackets,
 * short variable names, and whitespace patterns.
 *
 * Heuristic: if >30% of lines match common code patterns, treat as code.
 */
function isCodeHeavy(text: string): boolean {
  if (text.length === 0) return false

  const lines = text.split('\n')
  if (lines.length === 0) return false

  let codeLineCount = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Common code indicators
    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('let ') ||
      trimmed.startsWith('var ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('if (') ||
      trimmed.startsWith('for (') ||
      trimmed.startsWith('while (') ||
      trimmed.startsWith('return ') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('*/') ||
      trimmed.startsWith('#include') ||
      trimmed.startsWith('def ') ||
      trimmed.startsWith('async ') ||
      trimmed.endsWith('{') ||
      trimmed.endsWith('}') ||
      trimmed.endsWith(';') ||
      trimmed.endsWith('=>') ||
      /^[}\])][ ,;]*$/.test(trimmed)
    ) {
      codeLineCount++
    }
  }

  return codeLineCount / lines.length > 0.3
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Estimate the token count of a text string.
 *
 * Uses chars/4 for English prose and chars/2 for code-heavy content.
 * Returns 0 for empty strings.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0

  const divisor = isCodeHeavy(text) ? 2 : 4
  return Math.ceil(text.length / divisor)
}

/**
 * Precise token count using tiktoken if available, heuristic fallback otherwise.
 * Prefer this for compaction threshold decisions where accuracy matters.
 */
export function countTokensPrecise(text: string): number {
  const encoder = tryLoadTiktoken()
  if (encoder) {
    return encoder.encode(text).length
  }
  return estimateTokens(text)
}

/**
 * Determine whether the current context should be compacted.
 *
 * Triggers at 85% of maxTokens. Uses tiktoken for the count if available,
 * otherwise falls back to the heuristic estimator.
 *
 * @param currentTokens - Current estimated token count (pre-computed)
 * @param maxTokens - Maximum token budget for the context window
 * @returns true if currentTokens >= 85% of maxTokens
 */
export function shouldCompact(currentTokens: number, maxTokens: number): boolean {
  if (maxTokens <= 0) return false
  const threshold = maxTokens * 0.85
  return currentTokens >= threshold
}

/**
 * Estimate total tokens for an array of chat messages.
 *
 * Accounts for per-message overhead (~4 tokens for role/delimiter markers)
 * as per Anthropic's message formatting.
 */
export function estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
  const PER_MESSAGE_OVERHEAD = 4 // role marker + delimiters

  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content) + PER_MESSAGE_OVERHEAD
  }

  return total
}

/**
 * Reset the tiktoken loader state (for testing).
 * @internal
 */
export function _resetTiktokenState(): void {
  tiktokenEncoder = null
  tiktokenAttempted = false
}
