/**
 * Token Estimator - Cost Estimation and Formatting
 *
 * Extends the basic token estimation with:
 * - Per-model pricing (USD per 1M tokens)
 * - Cost estimation for input/output
 * - Formatting helpers for display
 * - Token breakdown by source
 */

import { estimateTokens, getModelContextLimit } from './tokenEstimation'

// -----------------------------------------------------------------------------
// Pricing Data (per 1M tokens, USD)
// -----------------------------------------------------------------------------

export interface ModelPricing {
  input: number // per 1M input tokens
  output: number // per 1M output tokens
}

/**
 * Pricing per 1M tokens for known models.
 * Updated as of early 2025.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude models
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
  'claude-3.5-haiku': { input: 0.8, output: 4 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-4': { input: 15, output: 75 },

  // OpenAI models
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Google models
  'gemini-pro': { input: 0.5, output: 1.5 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },

  // Fallback
  default: { input: 3, output: 15 }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TokenBreakdownItem {
  label: string
  nodeId?: string
  tokens: number
}

export interface TokenEstimate {
  inputTokens: number
  estimatedOutputTokens: number
  breakdown: TokenBreakdownItem[]
  cost: CostEstimate
  model: string
  contextLimit: number
  usagePercentage: number
}

export interface CostEstimate {
  inputCost: number
  outputCost: number
  totalCost: number
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Get pricing for a model, with fuzzy matching.
 */
export function getModelPricing(model?: string): ModelPricing {
  const fallback = MODEL_PRICING['default']!
  if (!model) return fallback

  // Exact match
  const exactMatch = MODEL_PRICING[model]
  if (exactMatch) return exactMatch

  // Partial match (case-insensitive)
  const lower = model.toLowerCase()
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (key !== 'default' && lower.includes(key.toLowerCase())) {
      return pricing
    }
  }

  return fallback
}

/**
 * Check if a model is an Anthropic (Claude) model
 */
function isAnthropicModel(model?: string): boolean {
  if (!model) return false
  return model.toLowerCase().includes('claude')
}

/**
 * Estimate cost in USD for given token counts.
 * Supports cache tokens for Anthropic models (different pricing for cache creation/read).
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model?: string,
  cacheCreationTokens?: number,
  cacheReadTokens?: number
): CostEstimate {
  const pricing = getModelPricing(model)
  let inputCost: number

  // Cache pricing is Anthropic-specific
  if (isAnthropicModel(model) && (cacheCreationTokens || cacheReadTokens)) {
    // Anthropic cache pricing:
    // - cache_creation: 1.25x input rate
    // - cache_read: 0.1x input rate (90% discount)
    // - regular input tokens: standard input rate
    const regularInputTokens = inputTokens - (cacheCreationTokens || 0) - (cacheReadTokens || 0)
    inputCost = (regularInputTokens / 1_000_000) * pricing.input
    inputCost += ((cacheCreationTokens || 0) / 1_000_000) * pricing.input * 1.25
    inputCost += ((cacheReadTokens || 0) / 1_000_000) * pricing.input * 0.1
  } else {
    // Standard pricing for non-Anthropic or when no cache tokens
    inputCost = (inputTokens / 1_000_000) * pricing.input
  }

  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost
  }
}

/**
 * Build a full token estimate for a conversation node.
 */
export function buildTokenEstimate(params: {
  contextText: string
  contextBreakdown?: { label: string; nodeId?: string; text: string }[]
  messages: { content: string }[]
  systemPrompt?: string
  currentInput?: string
  model?: string
  maxOutputTokens?: number
}): TokenEstimate {
  const {
    contextText,
    contextBreakdown,
    messages,
    systemPrompt,
    currentInput,
    model,
    maxOutputTokens = 4096
  } = params

  const breakdown: TokenBreakdownItem[] = []

  // System prompt
  const systemTokens = estimateTokens(systemPrompt || '')
  if (systemTokens > 0) {
    breakdown.push({ label: 'System prompt', tokens: systemTokens })
  }

  // Context from connected nodes
  if (contextBreakdown && contextBreakdown.length > 0) {
    for (const item of contextBreakdown) {
      breakdown.push({
        label: item.label,
        nodeId: item.nodeId,
        tokens: estimateTokens(item.text)
      })
    }
  } else if (contextText) {
    breakdown.push({ label: 'Context (connected nodes)', tokens: estimateTokens(contextText) })
  }

  // Conversation history
  const messageTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  if (messageTokens > 0) {
    breakdown.push({ label: 'Conversation history', tokens: messageTokens })
  }

  // Current input
  const inputDraftTokens = estimateTokens(currentInput || '')
  if (inputDraftTokens > 0) {
    breakdown.push({ label: 'Current message', tokens: inputDraftTokens })
  }

  const inputTokens = breakdown.reduce((sum, item) => sum + item.tokens, 0)
  const estimatedOutputTokens = Math.min(maxOutputTokens, 4096)
  const cost = estimateCost(inputTokens, estimatedOutputTokens, model)
  const contextLimit = getModelContextLimit(model)
  const usagePercentage = Math.min(100, (inputTokens / contextLimit) * 100)

  return {
    inputTokens,
    estimatedOutputTokens,
    breakdown,
    cost,
    model: model || 'default',
    contextLimit,
    usagePercentage
  }
}

// -----------------------------------------------------------------------------
// Formatting Helpers
// -----------------------------------------------------------------------------

/**
 * Format a cost value in USD.
 * Shows more decimal places for small values.
 */
export function formatCost(cost: number): string {
  if (typeof cost !== 'number' || isNaN(cost)) return '$0.00'
  if (cost === 0) return '$0.00'
  if (cost < 0.001) return '<$0.001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 0.1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

/**
 * Format token count for display (e.g., "12.5k", "1.2M").
 */
export function formatTokenCount(tokens: number): string {
  if (tokens === 0) return '0'
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`
  return `${(tokens / 1_000_000).toFixed(2)}M`
}
