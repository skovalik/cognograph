// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Unified LLM error classification across all three providers
 * (Anthropic, OpenAI, Gemini). Used by withRetry to decide
 * whether an error is retryable.
 */

export type LLMErrorCategory =
  | 'rate_limit' // 429 — throttled, retryable after backoff
  | 'auth' // 401/403 — bad key or permissions, NOT retryable
  | 'server' // 500+ — transient server error, retryable
  | 'context_length' // context window exceeded, NOT retryable
  | 'network' // connection/timeout, retryable
  | 'unknown' // unclassifiable

export interface ClassifiedLLMError {
  category: LLMErrorCategory
  retryable: boolean
  status: number | undefined
  retryAfterMs: number | undefined
  originalError: unknown
  message: string
}

// ---------------------------------------------------------------------------
// Context-length detection patterns
// ---------------------------------------------------------------------------

const CONTEXT_LENGTH_PATTERNS = [
  /context.?length/i,
  /context.?window/i,
  /token.?limit/i,
  /max.?tokens/i,
  /maximum.?context/i,
  /too.?many.?tokens/i,
  /input.?too.?long/i,
  /prompt.?is.?too.?long/i,
  /exceeds?.+(?:context|token|length)/i,
]

function isContextLengthError(message: string): boolean {
  return CONTEXT_LENGTH_PATTERNS.some((pattern) => pattern.test(message))
}

// ---------------------------------------------------------------------------
// Header extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extracts retry-after value in milliseconds from various header sources.
 * SDKs expose headers in different ways — some as plain objects, some as
 * Headers instances.
 */
function extractRetryAfterMs(headers: unknown): number | undefined {
  if (!headers) return undefined

  let raw: string | null | undefined

  // Headers object (fetch-style)
  if (typeof (headers as Headers).get === 'function') {
    raw = (headers as Headers).get('retry-after')
  }

  // Plain object (some SDK wrappers)
  if (!raw && typeof headers === 'object' && headers !== null) {
    const obj = headers as Record<string, unknown>
    raw = (obj['retry-after'] ?? obj['Retry-After']) as string | undefined
  }

  if (!raw) return undefined

  const seconds = Number(raw)
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000
  }

  // RFC 7231 HTTP-date — not common for LLM APIs but handle it
  const date = Date.parse(raw)
  if (!Number.isNaN(date)) {
    const delta = date - Date.now()
    return delta > 0 ? delta : undefined
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Provider-specific classification
// ---------------------------------------------------------------------------

function classifyAnthropicOrOpenAI(error: unknown): ClassifiedLLMError {
  // Guard against null/undefined/primitive values
  if (error == null || typeof error !== 'object') {
    return {
      category: 'unknown',
      retryable: false,
      status: undefined,
      retryAfterMs: undefined,
      originalError: error,
      message: String(error),
    }
  }

  // Both SDKs use .status and .headers on APIError
  const status = (error as { status?: number }).status
  const headers = (error as { headers?: unknown }).headers
  const message = (error as Error).message ?? String(error)
  const retryAfterMs = extractRetryAfterMs(headers)

  // Connection errors have status === undefined
  if (status === undefined) {
    // Check if it's a connection/network error by class name
    const name = (error as Error).name ?? ''
    const constructor = (error as { constructor?: { name?: string } }).constructor?.name ?? ''
    if (
      name === 'APIConnectionError' ||
      name === 'APIConnectionTimeoutError' ||
      constructor === 'APIConnectionError' ||
      constructor === 'APIConnectionTimeoutError' ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch.?fail/i.test(message)
    ) {
      return {
        category: 'network',
        retryable: true,
        status,
        retryAfterMs,
        originalError: error,
        message,
      }
    }
  }

  if (status === 429) {
    return {
      category: 'rate_limit',
      retryable: true,
      status,
      retryAfterMs,
      originalError: error,
      message,
    }
  }

  if (status === 401 || status === 403) {
    return {
      category: 'auth',
      retryable: false,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  // === Phase 3A addition — 413 is context_length (retryable with compaction) ===
  if (status === 413) {
    return {
      category: 'context_length',
      retryable: true,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }
  // === end Phase 3A addition ===

  if (status !== undefined && status >= 500) {
    return {
      category: 'server',
      retryable: true,
      status,
      retryAfterMs,
      originalError: error,
      message,
    }
  }

  // Context length can come as 400 with a descriptive message
  if (isContextLengthError(message)) {
    return {
      category: 'context_length',
      retryable: false,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  return {
    category: 'unknown',
    retryable: false,
    status,
    retryAfterMs: undefined,
    originalError: error,
    message,
  }
}

function classifyGemini(error: unknown): ClassifiedLLMError {
  // Guard against null/undefined/primitive values
  if (error == null || typeof error !== 'object') {
    return {
      category: 'unknown',
      retryable: false,
      status: undefined,
      retryAfterMs: undefined,
      originalError: error,
      message: String(error),
    }
  }

  // GoogleGenerativeAIFetchError has .status (number | undefined)
  const status = (error as { status?: number }).status
  const message = (error as Error).message ?? String(error)

  // Network-level errors (no status)
  if (status === undefined) {
    const name = (error as Error).name ?? ''
    if (
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch.?fail/i.test(message) ||
      name === 'GoogleGenerativeAIFetchError'
    ) {
      return {
        category: 'network',
        retryable: true,
        status,
        retryAfterMs: undefined,
        originalError: error,
        message,
      }
    }
  }

  if (status === 429) {
    return {
      category: 'rate_limit',
      retryable: true,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  if (status === 401 || status === 403) {
    return {
      category: 'auth',
      retryable: false,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  // === Phase 3A addition — 413 is context_length (retryable with compaction) ===
  if (status === 413) {
    return {
      category: 'context_length',
      retryable: true,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }
  // === end Phase 3A addition ===

  if (status !== undefined && status >= 500) {
    return {
      category: 'server',
      retryable: true,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  if (isContextLengthError(message)) {
    return {
      category: 'context_length',
      retryable: false,
      status,
      retryAfterMs: undefined,
      originalError: error,
      message,
    }
  }

  return {
    category: 'unknown',
    retryable: false,
    status,
    retryAfterMs: undefined,
    originalError: error,
    message,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify an LLM error into a standard category with retryability info.
 *
 * @param error - The raw error thrown by the SDK
 * @param provider - 'anthropic' | 'openai' | 'gemini'
 */
export function classifyLLMError(error: unknown, provider: string): ClassifiedLLMError {
  switch (provider) {
    case 'anthropic':
    case 'openai':
      return classifyAnthropicOrOpenAI(error)
    case 'gemini':
      return classifyGemini(error)
    default:
      return {
        category: 'unknown',
        retryable: false,
        status: undefined,
        retryAfterMs: undefined,
        originalError: error,
        message: (error as Error).message ?? String(error),
      }
  }
}
