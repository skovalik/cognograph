// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Generic retry utility for LLM API calls with exponential backoff,
 * jitter, and retry-after header support.
 *
 * Designed to be wired into streaming loops (claudeAgent.ts) and
 * non-streaming calls (llm.ts) in a future pass.
 *
 * TODO: Wire into claudeAgent.ts — lines ~458 and ~567 create Anthropic
 *       clients that should use the client cache from llm.ts. The inline
 *       retry logic at lines ~584-647 should be replaced with withRetry.
 */

import { type ClassifiedLLMError, classifyLLMError } from './llmErrors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number
  /** LLM provider name for error classification */
  provider: string
  /** AbortSignal for cooperative cancellation */
  signal?: AbortSignal
  /**
   * Optional callback invoked before each retry wait.
   * Useful for logging or notifying the UI.
   */
  onRetry?: (info: RetryInfo) => void
}

export interface RetryInfo {
  attempt: number
  maxRetries: number
  classified: ClassifiedLLMError
  delayMs: number
}

// ---------------------------------------------------------------------------
// Jitter helper
// ---------------------------------------------------------------------------

/**
 * Full-jitter exponential backoff.
 * delay = random(0, min(maxDelay, base * 2^attempt))
 */
function jitteredDelay(base: number, attempt: number, max: number): number {
  const exponential = base * 2 ** attempt
  const capped = Math.min(exponential, max)
  return Math.floor(Math.random() * capped)
}

// ---------------------------------------------------------------------------
// Sleep with abort
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(resolve, ms)

    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute an async callback with retry logic. Retries only on errors
 * classified as retryable (rate_limit, server, network).
 *
 * Auth and context_length errors are thrown immediately.
 *
 * Works with both streaming and non-streaming callbacks — the callback
 * is responsible for its own streaming iteration. If it throws, the
 * entire callback is retried from scratch.
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   async (signal) => {
 *     const stream = await client.messages.stream(params, { signal })
 *     for await (const event of stream) { ... }
 *     return stream.finalMessage()
 *   },
 *   { provider: 'anthropic', signal: controller.signal }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    provider,
    signal,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(signal)
    } catch (error: unknown) {
      lastError = error

      // Respect cooperative cancellation — never retry aborts
      if (signal?.aborted) {
        throw error
      }

      // Classify the error
      const classified = classifyLLMError(error, provider)

      // Non-retryable errors: throw immediately
      if (!classified.retryable) {
        throw error
      }

      // Out of retries: throw
      if (attempt >= maxRetries) {
        throw error
      }

      // Calculate delay: prefer retry-after header, fall back to jittered backoff
      const backoffDelay = jitteredDelay(baseDelayMs, attempt, maxDelayMs)
      const delayMs = classified.retryAfterMs
        ? Math.max(classified.retryAfterMs, backoffDelay)
        : backoffDelay

      // Notify caller before waiting
      onRetry?.({
        attempt: attempt + 1,
        maxRetries,
        classified,
        delayMs,
      })

      // Wait with abort awareness
      await sleep(delayMs, signal)
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError
}
