// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * costTracker.ts — Per-model token usage and estimated USD cost tracking.
 *
 * Normalizes cache pricing across three provider formats:
 * - Anthropic: `cache_read` tokens at 0.1x input price
 * - OpenAI: `cached` tokens at 0.5x input price
 * - Gemini: explicit cache pricing (distinct rate)
 *
 * Accumulates per-session and per-conversation totals.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUsageRecord {
  uncachedInput: number
  cachedInput: number
  cacheWrite: number
  output: number
  estimatedCostUSD: number
  model: string
  provider: string
  timestamp: string
}

/** Pricing per million tokens (USD). */
interface ModelPricing {
  input: number
  cachedInput: number
  cacheWrite: number
  output: number
}

// ---------------------------------------------------------------------------
// Model Pricing Table (per 1M tokens, USD)
// ---------------------------------------------------------------------------

/**
 * Pricing data sourced from provider pricing pages as of 2026-03.
 * Update when providers change rates.
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── Anthropic ──────────────────────────────────────────────────────────
  // Cache read = 0.1x input price, cache write = 1.25x input price
  'claude-opus-4': {
    input: 15.0,
    cachedInput: 1.5,     // 0.1x input
    cacheWrite: 18.75,    // 1.25x input
    output: 75.0,
  },
  'claude-sonnet-4': {
    input: 3.0,
    cachedInput: 0.3,     // 0.1x input
    cacheWrite: 3.75,     // 1.25x input
    output: 15.0,
  },
  'claude-haiku-4': {
    input: 0.8,
    cachedInput: 0.08,    // 0.1x input
    cacheWrite: 1.0,      // 1.25x input
    output: 4.0,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────
  // Cached = 0.5x input price, no separate cache write tier
  'gpt-4.1': {
    input: 2.0,
    cachedInput: 0.5,     // 0.25x input (per OpenAI April 2025)
    cacheWrite: 2.0,      // same as input (automatic caching)
    output: 8.0,
  },
  'gpt-4.1-mini': {
    input: 0.4,
    cachedInput: 0.1,     // 0.25x input
    cacheWrite: 0.4,      // same as input
    output: 1.6,
  },
  'o3': {
    input: 2.0,
    cachedInput: 0.5,     // 0.25x input
    cacheWrite: 2.0,      // same as input
    output: 8.0,
  },
  'o3-mini': {
    input: 1.1,
    cachedInput: 0.275,   // 0.25x input
    cacheWrite: 1.1,      // same as input
    output: 4.4,
  },

  // ── Gemini ─────────────────────────────────────────────────────────────
  // Gemini has explicit cache pricing tiers
  'gemini-2.5-pro': {
    input: 1.25,
    cachedInput: 0.3125,  // explicit cache price
    cacheWrite: 4.5,      // cache storage write
    output: 10.0,
  },
  'gemini-2.5-flash': {
    input: 0.15,
    cachedInput: 0.0375,  // explicit cache price
    cacheWrite: 1.0,      // cache storage write
    output: 0.6,
  },
}

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

/** All usage records for the current session. */
let sessionRecords: TokenUsageRecord[] = []

/** Usage records keyed by conversation ID. */
const conversationRecords = new Map<string, TokenUsageRecord[]>()

// ---------------------------------------------------------------------------
// Cost Calculation
// ---------------------------------------------------------------------------

/**
 * Look up pricing for a model, trying exact match then prefix match.
 * Returns undefined if no pricing is found.
 */
function findPricing(model: string): ModelPricing | undefined {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]

  // Prefix/alias match — handle versioned model names
  // e.g., "claude-sonnet-4-20260514" → "claude-sonnet-4"
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(key)) return MODEL_PRICING[key]
  }

  return undefined
}

/**
 * Calculate estimated cost in USD for a token usage record.
 * Returns 0 if the model is not in the pricing table.
 */
function calculateCost(
  uncachedInput: number,
  cachedInput: number,
  cacheWrite: number,
  output: number,
  model: string,
): number {
  const pricing = findPricing(model)
  if (!pricing) return 0

  const perToken = 1_000_000 // pricing is per 1M tokens
  return (
    (uncachedInput * pricing.input) / perToken +
    (cachedInput * pricing.cachedInput) / perToken +
    (cacheWrite * pricing.cacheWrite) / perToken +
    (output * pricing.output) / perToken
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a usage event and accumulate into session and conversation totals.
 *
 * @param usage - Token counts by category.
 * @param model - Model identifier (e.g., "claude-sonnet-4").
 * @param provider - Provider name (e.g., "anthropic", "openai", "gemini").
 * @param conversationId - Optional conversation ID for per-conversation tracking.
 * @returns The recorded usage with estimated cost.
 */
export function recordUsage(
  usage: {
    uncachedInput: number
    cachedInput: number
    cacheWrite?: number
    output: number
  },
  model: string,
  provider: string,
  conversationId?: string,
): TokenUsageRecord {
  const cacheWrite = usage.cacheWrite ?? 0
  const estimatedCostUSD = calculateCost(
    usage.uncachedInput,
    usage.cachedInput,
    cacheWrite,
    usage.output,
    model,
  )

  const record: TokenUsageRecord = {
    uncachedInput: usage.uncachedInput,
    cachedInput: usage.cachedInput,
    cacheWrite,
    output: usage.output,
    estimatedCostUSD,
    model,
    provider,
    timestamp: new Date().toISOString(),
  }

  sessionRecords.push(record)

  if (conversationId) {
    const existing = conversationRecords.get(conversationId) ?? []
    existing.push(record)
    conversationRecords.set(conversationId, existing)
  }

  return record
}

/**
 * Get accumulated session totals across all models.
 */
export function getSessionTotal(): {
  uncachedInput: number
  cachedInput: number
  cacheWrite: number
  output: number
  estimatedCostUSD: number
  recordCount: number
} {
  return aggregateRecords(sessionRecords)
}

/**
 * Get accumulated totals for a specific conversation.
 * Returns zero-initialized totals if the conversation ID is not found.
 */
export function getConversationTotal(conversationId: string): {
  uncachedInput: number
  cachedInput: number
  cacheWrite: number
  output: number
  estimatedCostUSD: number
  recordCount: number
} {
  const records = conversationRecords.get(conversationId) ?? []
  return aggregateRecords(records)
}

/**
 * Reset session totals and all conversation records.
 */
export function resetSession(): void {
  sessionRecords = []
  conversationRecords.clear()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aggregateRecords(records: TokenUsageRecord[]): {
  uncachedInput: number
  cachedInput: number
  cacheWrite: number
  output: number
  estimatedCostUSD: number
  recordCount: number
} {
  let uncachedInput = 0
  let cachedInput = 0
  let cacheWrite = 0
  let output = 0
  let estimatedCostUSD = 0

  for (const r of records) {
    uncachedInput += r.uncachedInput
    cachedInput += r.cachedInput
    cacheWrite += r.cacheWrite
    output += r.output
    estimatedCostUSD += r.estimatedCostUSD
  }

  return { uncachedInput, cachedInput, cacheWrite, output, estimatedCostUSD, recordCount: records.length }
}

// ---------------------------------------------------------------------------
// Testing Internals
// ---------------------------------------------------------------------------

/**
 * Exposed for testing — get the pricing table.
 * @internal
 */
export function _getModelPricing(): Record<string, ModelPricing> {
  return MODEL_PRICING
}

/**
 * Exposed for testing — direct cost calculation.
 * @internal
 */
export function _calculateCost(
  uncachedInput: number,
  cachedInput: number,
  cacheWrite: number,
  output: number,
  model: string,
): number {
  return calculateCost(uncachedInput, cachedInput, cacheWrite, output, model)
}
