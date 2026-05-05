// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it, vi } from 'vitest'
import {
  type ImageGenParams,
  type MediaResult,
  ProviderAdapter,
  type ProviderCapability,
} from '../providerAdapter'

// Concrete test adapter to exercise withRetry
class TestAdapter extends ProviderAdapter {
  readonly name = 'test'
  readonly capabilities: readonly ProviderCapability[] = ['image_gen']

  async generateImage(_params: ImageGenParams): Promise<MediaResult> {
    return { buffer: new Blob(), mimeType: 'image/png', metadata: {} }
  }

  // Expose withRetry for testing
  async testRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> {
    return this.withRetry(fn, maxRetries)
  }
}

describe('ProviderAdapter', () => {
  it('withRetry returns result on first success', async () => {
    const adapter = new TestAdapter(null)
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await adapter.testRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('withRetry retries on 429 with backoff', async () => {
    const adapter = new TestAdapter(null)
    const error429 = Object.assign(new Error('rate limit'), { status: 429 })
    const fn = vi.fn().mockRejectedValueOnce(error429).mockResolvedValue('ok')
    const result = await adapter.testRetry(fn, 3)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('withRetry retries on 500', async () => {
    const adapter = new TestAdapter(null)
    const error500 = Object.assign(new Error('server error'), { status: 500 })
    const fn = vi.fn().mockRejectedValueOnce(error500).mockResolvedValue('ok')
    const result = await adapter.testRetry(fn, 3)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('withRetry throws immediately on 400', async () => {
    const adapter = new TestAdapter(null)
    const error400 = Object.assign(new Error('bad request'), { status: 400 })
    const fn = vi.fn().mockRejectedValue(error400)
    await expect(adapter.testRetry(fn, 3)).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('withRetry exhausts retries and throws', async () => {
    const adapter = new TestAdapter(null)
    const error429 = Object.assign(new Error('rate limit'), { status: 429 })
    const fn = vi.fn().mockRejectedValue(error429)
    await expect(adapter.testRetry(fn, 2)).rejects.toThrow('rate limit')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('adapter classes are importable', async () => {
    const { StabilityAdapter } = await import('../adapters/stabilityAdapter')
    const { GeminiAdapter } = await import('../adapters/geminiAdapter')
    const { OpenAIAdapter } = await import('../adapters/openaiAdapter')
    const { ReplicateAdapter } = await import('../adapters/replicateAdapter')
    const { RunwayAdapter } = await import('../adapters/runwayAdapter')
    const { ElevenLabsAdapter } = await import('../adapters/elevenlabsAdapter')

    expect(new StabilityAdapter(null).name).toBe('stability')
    expect(new GeminiAdapter(null).name).toBe('gemini')
    expect(new OpenAIAdapter(null).name).toBe('openai')
    expect(new ReplicateAdapter(null).name).toBe('replicate')
    expect(new RunwayAdapter(null).name).toBe('runway')
    expect(new ElevenLabsAdapter(null).name).toBe('elevenlabs')
  })

  it('adapters report correct capabilities', async () => {
    const { StabilityAdapter } = await import('../adapters/stabilityAdapter')
    const { RunwayAdapter } = await import('../adapters/runwayAdapter')
    const { ElevenLabsAdapter } = await import('../adapters/elevenlabsAdapter')

    expect(new StabilityAdapter(null).capabilities).toContain('image_gen')
    expect(new RunwayAdapter(null).capabilities).toContain('video_gen')
    expect(new ElevenLabsAdapter(null).capabilities).toContain('audio_gen')
  })
})
