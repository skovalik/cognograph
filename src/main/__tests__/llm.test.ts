// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { beforeEach, describe, expect, it, vi } from 'vitest'

// =============================================================================
// Mocks — must be defined before importing the module under test
// =============================================================================

// Capture the config passed to getGenerativeModel so we can assert on it
let capturedGeminiModelConfig: Record<string, unknown> | null = null

const mockSend = vi.fn()
const mockBrowserWindow = {
  webContents: { send: mockSend },
}

// Track ipcMain.handle registrations so we can invoke them directly
const ipcHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      ipcHandlers.set(channel, handler)
    }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [mockBrowserWindow]),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => false),
    decryptString: vi.fn(),
  },
}))

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get(_key: string, _fallback: unknown) {
        return {
          anthropic: 'test-anthropic-key',
          gemini: 'test-gemini-key',
          openai: 'test-openai-key',
        }
      }
    },
  }
})

// --- Anthropic mock ---
// Shared mock function so we can configure per-test behavior
const mockAnthropicMessagesStream = vi.fn()
const anthropicConstructorSpy = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: mockAnthropicMessagesStream,
      }
      constructor(...args: unknown[]) {
        anthropicConstructorSpy(...args)
      }
    },
  }
})

// --- Gemini mock ---
const mockGeminiSendMessageStream = vi.fn()
const mockGeminiStartChat = vi.fn(() => ({
  sendMessageStream: mockGeminiSendMessageStream,
}))
const mockGetGenerativeModel = vi.fn((config: Record<string, unknown>) => {
  capturedGeminiModelConfig = config
  return { startChat: mockGeminiStartChat }
})
const geminiConstructorSpy = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel = mockGetGenerativeModel
    constructor(...args: unknown[]) {
      geminiConstructorSpy(...args)
    }
  },
}))

// --- OpenAI mock ---
const mockOpenAICreate = vi.fn()
const openaiConstructorSpy = vi.fn()

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      }
      constructor(...args: unknown[]) {
        openaiConstructorSpy(...args)
      }
    },
  }
})

// =============================================================================
// Import after mocking
// =============================================================================

import { clearClientCache, getClientCacheSize, registerLLMHandlers } from '../llm'

// =============================================================================
// Helpers
// =============================================================================

function makeLLMRequest(
  overrides: Partial<{
    conversationId: string
    provider: 'anthropic' | 'gemini' | 'openai'
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    systemPrompt: string
    model: string
  }> = {},
) {
  return {
    conversationId: overrides.conversationId ?? 'conv-1',
    provider: overrides.provider ?? 'gemini',
    messages: overrides.messages ?? [{ role: 'user' as const, content: 'Hello' }],
    systemPrompt: overrides.systemPrompt,
    model: overrides.model,
  }
}

/** Call the registered llm:send handler (simulates ipcMain.handle invocation) */
async function invokeLLMSend(request: ReturnType<typeof makeLLMRequest>): Promise<void> {
  const handler = ipcHandlers.get('llm:send')
  if (!handler)
    throw new Error('llm:send handler not registered — call registerLLMHandlers() first')
  await handler({} /* _event */, request)
}

/** Creates a default empty Anthropic stream mock return value */
function makeEmptyAnthropicStream() {
  return {
    [Symbol.asyncIterator]: () => ({
      next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
    }),
    finalMessage: vi.fn().mockResolvedValue({ usage: null }),
  }
}

/** Creates a default empty Gemini stream mock return value */
function makeEmptyGeminiStream() {
  return {
    stream: (async function* () {
      /* no chunks */
    })(),
    response: Promise.resolve({ usageMetadata: null }),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('llm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ipcHandlers.clear()
    capturedGeminiModelConfig = null
    clearClientCache()

    // Default mocks: empty streams that complete immediately
    mockGeminiSendMessageStream.mockResolvedValue(makeEmptyGeminiStream())
    mockAnthropicMessagesStream.mockResolvedValue(makeEmptyAnthropicStream())
    mockOpenAICreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        /* no chunks */
      },
    })

    // Register handlers so ipcHandlers map is populated
    registerLLMHandlers()
  })

  // ---------------------------------------------------------------------------
  // Task 1: Gemini systemInstruction (0.2a)
  // ---------------------------------------------------------------------------

  describe('Gemini systemInstruction', () => {
    it('passes systemInstruction to getGenerativeModel when systemPrompt is provided', async () => {
      const request = makeLLMRequest({
        provider: 'gemini',
        systemPrompt: 'You are a spatial AI assistant with full BFS context.',
      })

      await invokeLLMSend(request)

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1)
      expect(capturedGeminiModelConfig).not.toBeNull()
      expect(capturedGeminiModelConfig!.systemInstruction).toBe(
        'You are a spatial AI assistant with full BFS context.',
      )
    })

    it('passes undefined systemInstruction when systemPrompt is omitted', async () => {
      const request = makeLLMRequest({
        provider: 'gemini',
        // no systemPrompt
      })

      await invokeLLMSend(request)

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1)
      expect(capturedGeminiModelConfig).not.toBeNull()
      expect(capturedGeminiModelConfig!.systemInstruction).toBeUndefined()
    })

    it('passes the correct model alongside systemInstruction', async () => {
      const request = makeLLMRequest({
        provider: 'gemini',
        systemPrompt: 'Context here',
        model: 'gemini-2.0-flash',
      })

      await invokeLLMSend(request)

      expect(capturedGeminiModelConfig).toEqual({
        model: 'gemini-2.0-flash',
        systemInstruction: 'Context here',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Task 2: Duplicate llm:send abort (0.3g)
  // ---------------------------------------------------------------------------

  describe('duplicate stream abort', () => {
    it('aborts existing Gemini stream when a second send arrives for the same conversationId', async () => {
      let resolveFirstStream!: () => void
      const firstStreamHang = new Promise<void>((r) => {
        resolveFirstStream = r
      })

      // First call: stream that hangs (simulates in-flight request)
      mockGeminiSendMessageStream.mockResolvedValueOnce({
        stream: (async function* () {
          await firstStreamHang
        })(),
        response: Promise.resolve({ usageMetadata: null }),
      })

      // Second call: normal fast stream
      mockGeminiSendMessageStream.mockResolvedValueOnce(makeEmptyGeminiStream())

      // Start first stream (don't await — it will hang)
      const firstPromise = invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-dup',
          provider: 'gemini',
          systemPrompt: 'First request context',
        }),
      )

      // Give the first stream a tick to register its AbortController
      await new Promise((r) => setTimeout(r, 10))

      // The second send for the same conversationId should abort the first
      await invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-dup',
          provider: 'gemini',
          systemPrompt: 'Second request context',
        }),
      )

      // Resolve the first stream so the promise settles
      resolveFirstStream()
      await firstPromise.catch(() => {
        /* expected abort */
      })

      // getGenerativeModel called twice (once per stream)
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2)

      // llm:complete was sent for the second stream
      const completeCalls = mockSend.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === 'llm:complete' &&
          (call[1] as Record<string, unknown>).conversationId === 'conv-dup',
      )
      expect(completeCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('aborts existing Anthropic stream when a second send arrives for the same conversationId', async () => {
      let firstAbortSignalAborted = false
      let resolveFirstStream!: () => void
      const firstStreamHang = new Promise<void>((r) => {
        resolveFirstStream = r
      })

      // First Anthropic call: captures the signal and hangs the stream
      mockAnthropicMessagesStream.mockImplementationOnce(
        (_params: unknown, opts?: { signal?: AbortSignal }) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              firstAbortSignalAborted = true
            })
          }
          return Promise.resolve({
            [Symbol.asyncIterator]: () => ({
              async next() {
                await firstStreamHang
                return { done: true, value: undefined }
              },
            }),
            finalMessage: vi.fn().mockResolvedValue({ usage: null }),
          })
        },
      )

      // Second call: normal empty stream
      mockAnthropicMessagesStream.mockImplementationOnce(() =>
        Promise.resolve(makeEmptyAnthropicStream()),
      )

      // Start first stream (will hang)
      const firstPromise = invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-anthropic-dup',
          provider: 'anthropic',
          systemPrompt: 'First',
        }),
      )

      await new Promise((r) => setTimeout(r, 10))

      // Second send should abort the first
      await invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-anthropic-dup',
          provider: 'anthropic',
          systemPrompt: 'Second',
        }),
      )

      // Resolve first stream and let it settle
      resolveFirstStream()
      await firstPromise.catch(() => {
        /* expected */
      })

      // The first controller's signal should have been aborted
      expect(firstAbortSignalAborted).toBe(true)
    })

    it('does not abort when different conversationIds are used', async () => {
      await invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-a',
          provider: 'gemini',
          systemPrompt: 'Context A',
        }),
      )

      await invokeLLMSend(
        makeLLMRequest({
          conversationId: 'conv-b',
          provider: 'gemini',
          systemPrompt: 'Context B',
        }),
      )

      // Both should complete normally
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2)

      const completeConvIds = mockSend.mock.calls
        .filter((call: unknown[]) => call[0] === 'llm:complete')
        .map((call: unknown[]) => (call[1] as Record<string, unknown>).conversationId)

      expect(completeConvIds).toContain('conv-a')
      expect(completeConvIds).toContain('conv-b')
    })
  })

  // ---------------------------------------------------------------------------
  // Task 3: Client caching (1.1c)
  // ---------------------------------------------------------------------------

  describe('client caching', () => {
    it('reuses Anthropic client across multiple calls', async () => {
      mockAnthropicMessagesStream.mockResolvedValue(makeEmptyAnthropicStream())

      await invokeLLMSend(makeLLMRequest({ provider: 'anthropic', conversationId: 'c1' }))
      await invokeLLMSend(makeLLMRequest({ provider: 'anthropic', conversationId: 'c2' }))

      // Constructor should be called only once (cached after first use)
      expect(anthropicConstructorSpy).toHaveBeenCalledTimes(1)
      // But the stream method should be called twice
      expect(mockAnthropicMessagesStream).toHaveBeenCalledTimes(2)
    })

    it('reuses Gemini client across multiple calls', async () => {
      await invokeLLMSend(makeLLMRequest({ provider: 'gemini', conversationId: 'c1' }))
      await invokeLLMSend(makeLLMRequest({ provider: 'gemini', conversationId: 'c2' }))

      // Constructor should be called only once
      expect(geminiConstructorSpy).toHaveBeenCalledTimes(1)
      // But getGenerativeModel is called each time (different model configs possible)
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2)
    })

    it('reuses OpenAI client across multiple calls', async () => {
      mockOpenAICreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          /* no chunks */
        },
      })

      await invokeLLMSend(makeLLMRequest({ provider: 'openai', conversationId: 'c1' }))
      await invokeLLMSend(makeLLMRequest({ provider: 'openai', conversationId: 'c2' }))

      // Constructor should be called only once
      expect(openaiConstructorSpy).toHaveBeenCalledTimes(1)
      expect(mockOpenAICreate).toHaveBeenCalledTimes(2)
    })

    it('clearClientCache resets the cache', async () => {
      await invokeLLMSend(makeLLMRequest({ provider: 'anthropic', conversationId: 'c1' }))
      expect(getClientCacheSize()).toBeGreaterThan(0)

      clearClientCache()
      expect(getClientCacheSize()).toBe(0)

      // After clearing, a new call should create a new client
      await invokeLLMSend(makeLLMRequest({ provider: 'anthropic', conversationId: 'c2' }))
      expect(anthropicConstructorSpy).toHaveBeenCalledTimes(2)
    })
  })
})
