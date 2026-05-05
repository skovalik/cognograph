// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Main-process media-fetch dispatcher tests.
 *
 * Verifies the dispatcher (a) injects auth from safeStorage, never from
 * the request, (b) does not leak the API key in the response, (c)
 * supports the three auth styles (bearer / xi-api-key / query-key), and
 * (d) reports the missing-key error path explicitly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// electron-store and electron must be mocked before importing mediaFetch.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

const storeData: { encryptedApiKeys: Record<string, string> } = { encryptedApiKeys: {} }
vi.mock('electron-store', () => {
  return {
    default: class Store {
      get(key: string) {
        return (storeData as unknown as Record<string, unknown>)[key]
      }
      set(key: string, value: unknown) {
        ;(storeData as unknown as Record<string, unknown>)[key] = value
      }
    },
  }
})

import { _resetForTest, executeMediaFetch } from '../mediaFetch'

const ORIGINAL_FETCH = globalThis.fetch

describe('executeMediaFetch', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    storeData.encryptedApiKeys = {}
    _resetForTest()
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
  })

  it('returns missing-key error when no key is configured', async () => {
    const res = await executeMediaFetch({
      provider: 'openai',
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: { prompt: 'test' },
      responseKind: 'json',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('No API key configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('injects Authorization: Bearer for bearer-style providers', async () => {
    storeData.encryptedApiKeys = { openai: 'sk-openai-test' }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'openai',
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: { prompt: 'test' },
      responseKind: 'json',
    })
    expect(res.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [callUrl, callOpts] = fetchSpy.mock.calls[0]!
    expect(callUrl).toBe('https://api.openai.com/v1/images/generations')
    expect((callOpts as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer sk-openai-test',
    )
  })

  it('injects xi-api-key header for ElevenLabs', async () => {
    storeData.encryptedApiKeys = { elevenlabs: 'el-key-test' }
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'elevenlabs',
      url: 'https://api.elevenlabs.io/v1/text-to-speech/voice-id',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: { text: 'hi' },
      responseKind: 'binary',
    })
    expect(res.ok).toBe(true)
    const [, callOpts] = fetchSpy.mock.calls[0]!
    expect((callOpts as { headers: Record<string, string> }).headers['xi-api-key']).toBe(
      'el-key-test',
    )
    expect((callOpts as { headers: Record<string, string> }).headers.Authorization).toBeUndefined()
  })

  it('injects ?key= query param for Gemini', async () => {
    storeData.encryptedApiKeys = { google: 'gemini-key-test' }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: {},
      responseKind: 'json',
    })
    expect(res.ok).toBe(true)
    const [callUrl, callOpts] = fetchSpy.mock.calls[0]!
    expect(callUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=gemini-key-test',
    )
    // Auth must NOT be in any header — Gemini auth is query-only.
    expect((callOpts as { headers: Record<string, string> }).headers.Authorization).toBeUndefined()
    expect((callOpts as { headers: Record<string, string> }).headers['xi-api-key']).toBeUndefined()
  })

  it('honors authStyleOverride: none for output-URL fetches (no key needed)', async () => {
    // No keys in store; should succeed because authStyleOverride='none'.
    storeData.encryptedApiKeys = {}
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'replicate',
      url: 'https://replicate.delivery/output/abc.png',
      method: 'GET',
      bodyKind: 'none',
      responseKind: 'binary',
      authStyleOverride: 'none',
    })
    expect(res.ok).toBe(true)
    const [, callOpts] = fetchSpy.mock.calls[0]!
    expect((callOpts as { headers: Record<string, string> }).headers.Authorization).toBeUndefined()
  })

  it('returns binary ArrayBuffer + mimeType for binary responses', async () => {
    storeData.encryptedApiKeys = { stability: 'stab-test' }
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header
    fetchSpy.mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'stability',
      url: 'https://api.stability.ai/v2beta/stable-image/generate/core',
      method: 'POST',
      bodyKind: 'form',
      bodyForm: [{ name: 'prompt', kind: 'string', value: 'test' }],
      responseKind: 'binary',
    })
    expect(res.ok).toBe(true)
    expect(res.binary?.mimeType).toBe('image/png')
    expect(res.binary?.bytes).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(res.binary!.bytes)).toEqual(bytes)
  })

  it('does not leak the API key in the response', async () => {
    storeData.encryptedApiKeys = { openai: 'super-secret-key-12345' }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'openai',
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: {},
      responseKind: 'json',
    })
    const serialized = JSON.stringify(res)
    expect(serialized).not.toContain('super-secret-key-12345')
  })

  it('returns ok=false with status for non-2xx JSON responses', async () => {
    storeData.encryptedApiKeys = { openai: 'sk-test' }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'openai',
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: {},
      responseKind: 'json',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(429)
    expect(res.json).toEqual({ error: 'rate limited' })
  })

  it('returns network error when fetch throws', async () => {
    storeData.encryptedApiKeys = { openai: 'sk-test' }
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await executeMediaFetch({
      provider: 'openai',
      url: 'https://api.openai.com/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: {},
      responseKind: 'json',
    })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(0)
    expect(res.error).toContain('ECONNREFUSED')
  })

  it('aliases gemini → google for key lookup (existing user storage)', async () => {
    storeData.encryptedApiKeys = { google: 'gemini-via-google-key' }
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent',
      method: 'POST',
      bodyKind: 'json',
      bodyJson: {},
      responseKind: 'json',
    })
    expect(res.ok).toBe(true)
    const [callUrl] = fetchSpy.mock.calls[0]!
    expect(callUrl).toContain('?key=gemini-via-google-key')
  })

  it('builds FormData body from serialized fields', async () => {
    storeData.encryptedApiKeys = { stability: 'stab-test' }
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    )
    const res = await executeMediaFetch({
      provider: 'stability',
      url: 'https://api.stability.ai/v2beta/stable-image/generate/core',
      method: 'POST',
      bodyKind: 'form',
      bodyForm: [
        { name: 'prompt', kind: 'string', value: 'a cat' },
        {
          name: 'image',
          kind: 'blob',
          blob: { bytes: new Uint8Array([1, 2, 3]).buffer, mimeType: 'image/png' },
        },
      ],
      responseKind: 'binary',
    })
    expect(res.ok).toBe(true)
    const [, callOpts] = fetchSpy.mock.calls[0]!
    expect((callOpts as { body: BodyInit }).body).toBeInstanceOf(FormData)
    const fd = (callOpts as { body: FormData }).body
    expect(fd.get('prompt')).toBe('a cat')
    expect(fd.get('image')).toBeInstanceOf(Blob)
  })
})
