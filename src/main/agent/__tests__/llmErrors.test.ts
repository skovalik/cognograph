// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect } from 'vitest'
import { classifyLLMError, type LLMErrorCategory } from '../llmErrors'

// ---------------------------------------------------------------------------
// Helpers — build error-like objects matching SDK shapes
// ---------------------------------------------------------------------------

function makeSDKError(opts: {
  status?: number
  message?: string
  headers?: Record<string, string>
  name?: string
}): Error & { status?: number; headers?: Record<string, string> } {
  const err = new Error(opts.message ?? 'test error') as Error & {
    status?: number
    headers?: Record<string, string>
  }
  if (opts.status !== undefined) err.status = opts.status
  if (opts.headers) err.headers = opts.headers
  if (opts.name) err.name = opts.name
  return err
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe('classifyLLMError — Anthropic', () => {
  const provider = 'anthropic'

  it('classifies 429 as rate_limit (retryable)', () => {
    const err = makeSDKError({ status: 429 })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('rate_limit')
    expect(result.retryable).toBe(true)
    expect(result.status).toBe(429)
  })

  it('extracts retry-after header in seconds', () => {
    const err = makeSDKError({ status: 429, headers: { 'retry-after': '30' } })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('rate_limit')
    expect(result.retryAfterMs).toBe(30_000)
  })

  it('classifies 401 as auth (not retryable)', () => {
    const err = makeSDKError({ status: 401, message: 'Invalid API key' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('classifies 403 as auth (not retryable)', () => {
    const err = makeSDKError({ status: 403, message: 'Permission denied' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('classifies 500 as server (retryable)', () => {
    const err = makeSDKError({ status: 500, message: 'Internal server error' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('server')
    expect(result.retryable).toBe(true)
  })

  it('classifies 502 as server (retryable)', () => {
    const err = makeSDKError({ status: 502 })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('server')
    expect(result.retryable).toBe(true)
  })

  it('classifies 529 (overloaded) as server (retryable)', () => {
    const err = makeSDKError({ status: 529, message: 'Overloaded' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('server')
    expect(result.retryable).toBe(true)
  })

  it('classifies connection errors as network (retryable)', () => {
    const err = makeSDKError({ message: 'ECONNREFUSED', name: 'APIConnectionError' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('classifies connection timeout as network', () => {
    const err = makeSDKError({ message: 'Connection timeout', name: 'APIConnectionTimeoutError' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('classifies context length error from message', () => {
    const err = makeSDKError({ status: 400, message: 'prompt is too long: context length exceeded' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('context_length')
    expect(result.retryable).toBe(false)
  })

  it('classifies token limit error from message', () => {
    const err = makeSDKError({ status: 400, message: 'exceeds the maximum token limit' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('context_length')
    expect(result.retryable).toBe(false)
  })

  it('classifies unknown errors as unknown (not retryable)', () => {
    const err = makeSDKError({ status: 400, message: 'Bad request: invalid JSON' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('unknown')
    expect(result.retryable).toBe(false)
  })

  it('preserves the original error', () => {
    const err = makeSDKError({ status: 429 })
    const result = classifyLLMError(err, provider)
    expect(result.originalError).toBe(err)
  })
})

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

describe('classifyLLMError — OpenAI', () => {
  const provider = 'openai'

  it('classifies 429 as rate_limit', () => {
    const err = makeSDKError({ status: 429, message: 'Rate limit exceeded' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('classifies 401 as auth', () => {
    const err = makeSDKError({ status: 401, message: 'Incorrect API key provided' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('classifies 500+ as server', () => {
    const err = makeSDKError({ status: 503, message: 'Service unavailable' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('server')
    expect(result.retryable).toBe(true)
  })

  it('classifies context window exceeded', () => {
    const err = makeSDKError({
      status: 400,
      message: "This model's maximum context length is 128000 tokens. However, your messages resulted in 130000 tokens."
    })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('context_length')
    expect(result.retryable).toBe(false)
  })

  it('classifies ECONNRESET as network', () => {
    const err = makeSDKError({ message: 'read ECONNRESET' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('extracts retry-after header with Retry-After casing', () => {
    const err = makeSDKError({ status: 429, headers: { 'Retry-After': '60' } })
    const result = classifyLLMError(err, provider)
    expect(result.retryAfterMs).toBe(60_000)
  })
})

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

describe('classifyLLMError — Gemini', () => {
  const provider = 'gemini'

  it('classifies 429 as rate_limit', () => {
    const err = makeSDKError({ status: 429, message: 'Resource exhausted' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('classifies 401 as auth', () => {
    const err = makeSDKError({ status: 401, message: 'API key not valid' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('classifies 500 as server', () => {
    const err = makeSDKError({ status: 500, message: 'Internal error' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('server')
    expect(result.retryable).toBe(true)
  })

  it('classifies fetch errors without status as network', () => {
    const err = makeSDKError({ message: 'fetch failed', name: 'GoogleGenerativeAIFetchError' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('classifies context length error from message', () => {
    const err = makeSDKError({ status: 400, message: 'Input too long: exceeds context window' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('context_length')
    expect(result.retryable).toBe(false)
  })

  it('classifies unknown 400 as unknown', () => {
    const err = makeSDKError({ status: 400, message: 'Invalid argument' })
    const result = classifyLLMError(err, provider)
    expect(result.category).toBe('unknown')
    expect(result.retryable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Unknown provider
// ---------------------------------------------------------------------------

describe('classifyLLMError — unknown provider', () => {
  it('returns unknown category for unsupported providers', () => {
    const err = makeSDKError({ status: 429 })
    const result = classifyLLMError(err, 'cohere')
    expect(result.category).toBe('unknown')
    expect(result.retryable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('classifyLLMError — edge cases', () => {
  it('handles non-Error values', () => {
    const result = classifyLLMError('some string error', 'anthropic')
    expect(result.category).toBe('unknown')
    expect(result.message).toBe('some string error')
  })

  it('handles null', () => {
    const result = classifyLLMError(null, 'openai')
    expect(result.category).toBe('unknown')
  })

  it('handles plain objects with status', () => {
    const result = classifyLLMError({ status: 429, message: 'rate limited' }, 'anthropic')
    expect(result.category).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  const contextPatterns: Array<[string, LLMErrorCategory]> = [
    ['context length exceeded', 'context_length'],
    ['maximum context window', 'context_length'],
    ['token limit exceeded', 'context_length'],
    ['too many tokens', 'context_length'],
    ['input too long', 'context_length'],
    ['prompt is too long', 'context_length'],
  ]

  it.each(contextPatterns)('detects context length from message: "%s"', (msg, expected) => {
    const err = makeSDKError({ status: 400, message: msg })
    const result = classifyLLMError(err, 'anthropic')
    expect(result.category).toBe(expected)
  })
})
