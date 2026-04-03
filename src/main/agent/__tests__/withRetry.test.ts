// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withRetry, type RetryOptions, type RetryInfo } from '../withRetry'

// ---------------------------------------------------------------------------
// Helpers
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

const defaultOpts: RetryOptions = {
  provider: 'anthropic',
  maxRetries: 3,
  baseDelayMs: 1,   // 1ms for fast tests
  maxDelayMs: 10,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, defaultOpts)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Retryable errors
  // -------------------------------------------------------------------------

  it('retries on rate_limit (429) and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({ status: 429 }))
      .mockRejectedValueOnce(makeSDKError({ status: 429 }))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, defaultOpts)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('retries on server error (500) and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({ status: 500 }))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, defaultOpts)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on network error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({ message: 'ECONNREFUSED', name: 'APIConnectionError' }))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, defaultOpts)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // Non-retryable errors
  // -------------------------------------------------------------------------

  it('does NOT retry on auth error (401)', async () => {
    const authErr = makeSDKError({ status: 401, message: 'Invalid API key' })
    const fn = vi.fn().mockRejectedValue(authErr)

    await expect(withRetry(fn, defaultOpts)).rejects.toThrow('Invalid API key')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on auth error (403)', async () => {
    const fn = vi.fn().mockRejectedValue(makeSDKError({ status: 403 }))

    await expect(withRetry(fn, defaultOpts)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on context_length error', async () => {
    const fn = vi.fn().mockRejectedValue(
      makeSDKError({ status: 400, message: 'context length exceeded' })
    )

    await expect(withRetry(fn, defaultOpts)).rejects.toThrow()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Max retries exhausted
  // -------------------------------------------------------------------------

  it('throws after max retries are exhausted', async () => {
    const err = makeSDKError({ status: 429, message: 'rate limited' })
    const fn = vi.fn().mockRejectedValue(err)

    await expect(withRetry(fn, { ...defaultOpts, maxRetries: 2 })).rejects.toThrow('rate limited')
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3)
  })

  // -------------------------------------------------------------------------
  // retry-after header
  // -------------------------------------------------------------------------

  it('respects retry-after header when present', async () => {
    const err = makeSDKError({
      status: 429,
      message: 'rate limited',
      headers: { 'retry-after': '1' }  // 1 second
    })
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok')

    const onRetry = vi.fn()

    const result = await withRetry(fn, { ...defaultOpts, onRetry })
    expect(result).toBe('ok')

    // The delay should be at least the retry-after (1000ms), but since
    // baseDelayMs is 1ms, jittered backoff would be < 1000ms, so
    // retry-after wins
    expect(onRetry).toHaveBeenCalledTimes(1)
    const info: RetryInfo = onRetry.mock.calls[0]![0] as RetryInfo
    expect(info.delayMs).toBeGreaterThanOrEqual(1000)
  })

  // -------------------------------------------------------------------------
  // onRetry callback
  // -------------------------------------------------------------------------

  it('calls onRetry with correct info before each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({ status: 429 }))
      .mockRejectedValueOnce(makeSDKError({ status: 500 }))
      .mockResolvedValue('ok')

    const onRetry = vi.fn()

    await withRetry(fn, { ...defaultOpts, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(2)

    const first: RetryInfo = onRetry.mock.calls[0]![0] as RetryInfo
    expect(first.attempt).toBe(1)
    expect(first.classified.category).toBe('rate_limit')

    const second: RetryInfo = onRetry.mock.calls[1]![0] as RetryInfo
    expect(second.attempt).toBe(2)
    expect(second.classified.category).toBe('server')
  })

  // -------------------------------------------------------------------------
  // Abort signal
  // -------------------------------------------------------------------------

  it('does not retry when abort signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const fn = vi.fn().mockRejectedValue(makeSDKError({ status: 429 }))

    await expect(
      withRetry(fn, { ...defaultOpts, signal: controller.signal })
    ).rejects.toThrow()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes signal to the callback', async () => {
    const controller = new AbortController()
    const fn = vi.fn().mockImplementation((signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal)
      return Promise.resolve('ok')
    })

    await withRetry(fn, { ...defaultOpts, signal: controller.signal })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Exponential backoff
  // -------------------------------------------------------------------------

  it('uses exponential backoff with jitter', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({ status: 429 }))
      .mockRejectedValueOnce(makeSDKError({ status: 429 }))
      .mockResolvedValue('ok')

    const retryDelays: number[] = []
    const onRetry = vi.fn((info: RetryInfo) => {
      retryDelays.push(info.delayMs)
    })

    await withRetry(fn, {
      ...defaultOpts,
      baseDelayMs: 100,
      maxDelayMs: 10000,
      onRetry,
    })

    expect(retryDelays.length).toBe(2)
    // First retry: jitter of random(0, min(10000, 100 * 2^0)) = random(0, 100)
    expect(retryDelays[0]).toBeLessThanOrEqual(100)
    // Second retry: jitter of random(0, min(10000, 100 * 2^1)) = random(0, 200)
    expect(retryDelays[1]).toBeLessThanOrEqual(200)
  })

  // -------------------------------------------------------------------------
  // Gemini provider
  // -------------------------------------------------------------------------

  it('works with gemini provider errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeSDKError({
        status: 429,
        message: 'Resource exhausted',
        name: 'GoogleGenerativeAIFetchError'
      }))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { ...defaultOpts, provider: 'gemini' })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
