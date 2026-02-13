/**
 * Token Estimation Utilities
 *
 * Provides rough token estimates for context window usage visualization.
 * Uses ~4 characters per token as a reasonable approximation for English text.
 *
 * Note: Actual tokenization varies by model (Claude uses ~4 chars/token,
 * GPT models use ~3.5-4 chars/token). This is good enough for visual feedback.
 */

/**
 * Estimate token count from text
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Get usage level category based on percentage
 * @param percentage Usage percentage (0-100)
 * @returns Usage level category
 */
export function getUsageLevel(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
  if (percentage < 50) return 'low'
  if (percentage < 75) return 'medium'
  if (percentage < 90) return 'high'
  return 'critical'
}

/**
 * Context window limits for various models (in tokens)
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Anthropic Claude models
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3.5-haiku': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,

  // OpenAI models
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,

  // Google models
  'gemini-pro': 32000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,

  // Default fallback
  default: 100000
}

/**
 * Get context window limit for a given model
 * @param model Model name/ID
 * @returns Context limit in tokens
 */
export function getModelContextLimit(model?: string): number {
  const defaultLimit = MODEL_CONTEXT_LIMITS['default'] ?? 100000

  if (!model) return defaultLimit

  // Try exact match first
  const exactMatch = MODEL_CONTEXT_LIMITS[model]
  if (exactMatch !== undefined) {
    return exactMatch
  }

  // Try partial match (case-insensitive)
  const lowerModel = model.toLowerCase()
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (key !== 'default' && lowerModel.includes(key.toLowerCase())) {
      return limit
    }
  }

  return defaultLimit
}

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  contextTokens: number // Tokens from connected nodes
  messageTokens: number // Tokens from conversation history
  systemTokens: number // System prompt tokens
  totalTokens: number // Sum of above
  maxTokens: number // Model's context limit
  percentage: number // 0-100
}

/**
 * Calculate token usage for a conversation
 * @param contextText Context from connected nodes
 * @param messages Conversation messages
 * @param systemPrompt Optional system prompt
 * @param model Model name for context limit lookup
 * @returns Token usage breakdown
 */
export function calculateTokenUsage(
  contextText: string,
  messages: { content: string }[],
  systemPrompt?: string,
  model?: string
): TokenUsage {
  const contextTokens = estimateTokens(contextText)
  const messageTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  const systemTokens = estimateTokens(systemPrompt || '')
  const totalTokens = contextTokens + messageTokens + systemTokens
  const maxTokens = getModelContextLimit(model)
  const percentage = Math.min(100, (totalTokens / maxTokens) * 100)

  return {
    contextTokens,
    messageTokens,
    systemTokens,
    totalTokens,
    maxTokens,
    percentage
  }
}
