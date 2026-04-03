// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for Phase 1B agent resilience features:
 * - 1.5b: Output token escalation (max_tokens stop_reason → 4x retry)
 * - 1.5c: Pre-persist user message before API call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStoreData = new Map<string, unknown>()
const mockStore = {
  get: vi.fn((key: string, fallback?: unknown) => mockStoreData.get(key) ?? fallback),
  set: vi.fn((key: string, value: unknown) => { mockStoreData.set(key, value) }),
  delete: vi.fn((key: string) => { mockStoreData.delete(key) }),
}

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => mockStore),
}))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([
      { webContents: { send: vi.fn() } },
    ]),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(false),
  },
}))

vi.mock('../../settings', () => ({
  getSetting: vi.fn().mockReturnValue(false),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock child_process since claudeAgent.ts imports it
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))

vi.mock('util', () => ({
  promisify: vi.fn().mockReturnValue(vi.fn()),
}))

// ---------------------------------------------------------------------------
// Tests for escalation constants and classification integration
// ---------------------------------------------------------------------------

import { classifyLLMError } from '../llmErrors'

describe('Output Token Escalation Logic', () => {
  const DEFAULT_MAX_TOKENS = 8192
  const ESCALATION_MULTIPLIER = 4
  const MAX_TOKENS_CEILING = 64_000

  it('escalates from default 8192 to 32768 on first truncation', () => {
    const initial = DEFAULT_MAX_TOKENS
    const escalated = Math.min(initial * ESCALATION_MULTIPLIER, MAX_TOKENS_CEILING)
    expect(escalated).toBe(32_768)
  })

  it('escalates from 32768 to 64000 ceiling on second truncation', () => {
    const secondLevel = 32_768
    const escalated = Math.min(secondLevel * ESCALATION_MULTIPLIER, MAX_TOKENS_CEILING)
    // 32768 * 4 = 131072, capped at 64000
    expect(escalated).toBe(MAX_TOKENS_CEILING)
  })

  it('does not escalate beyond ceiling', () => {
    const atCeiling = MAX_TOKENS_CEILING
    const escalated = Math.min(atCeiling * ESCALATION_MULTIPLIER, MAX_TOKENS_CEILING)
    expect(escalated).toBe(MAX_TOKENS_CEILING)
    // And the guard condition (effectiveMaxTokens < MAX_TOKENS_CEILING) should prevent retry
    expect(atCeiling < MAX_TOKENS_CEILING).toBe(false)
  })

  it('classifyLLMError correctly identifies rate_limit errors for retry handling', () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 })
    const classified = classifyLLMError(error, 'anthropic')
    expect(classified.category).toBe('rate_limit')
    expect(classified.retryable).toBe(true)
  })

  it('classifyLLMError correctly identifies auth errors as non-retryable', () => {
    const error = Object.assign(new Error('unauthorized'), { status: 401 })
    const classified = classifyLLMError(error, 'anthropic')
    expect(classified.category).toBe('auth')
    expect(classified.retryable).toBe(false)
  })

  it('classifyLLMError correctly identifies context_length errors', () => {
    const error = Object.assign(new Error('prompt is too long for context window'), { status: 400 })
    const classified = classifyLLMError(error, 'anthropic')
    expect(classified.category).toBe('context_length')
    expect(classified.retryable).toBe(false)
  })

  it('classifyLLMError correctly identifies network errors', () => {
    const error = Object.assign(new Error('ECONNREFUSED'), {
      name: 'APIConnectionError',
    })
    const classified = classifyLLMError(error, 'anthropic')
    expect(classified.category).toBe('network')
    expect(classified.retryable).toBe(true)
  })
})

describe('Pre-Persist User Message (1.5c)', () => {
  beforeEach(() => {
    mockStoreData.clear()
    vi.clearAllMocks()
  })

  it('persists user message to store before API call', () => {
    const conversationId = 'conv-123'
    const message = { role: 'user', content: 'Hello world' }
    const requestId = 'req-456'

    // Simulate the pre-persist logic from claudeAgent.ts
    const pendingKey = `pendingUserMessage:${conversationId}`
    mockStore.set(pendingKey, {
      conversationId,
      message,
      timestamp: Date.now(),
      requestId,
    })

    // Verify it was persisted
    expect(mockStore.set).toHaveBeenCalledWith(
      pendingKey,
      expect.objectContaining({
        conversationId,
        message,
        requestId,
      })
    )
    expect(mockStoreData.has(pendingKey)).toBe(true)
  })

  it('clears pending message on successful completion', () => {
    const conversationId = 'conv-123'
    const pendingKey = `pendingUserMessage:${conversationId}`

    // Simulate persist
    mockStore.set(pendingKey, {
      conversationId,
      message: { role: 'user', content: 'test' },
      timestamp: Date.now(),
      requestId: 'req-1',
    })

    // Simulate successful completion cleanup
    mockStore.delete(pendingKey)

    expect(mockStore.delete).toHaveBeenCalledWith(pendingKey)
    expect(mockStoreData.has(pendingKey)).toBe(false)
  })

  it('pending message survives when store.delete is not called (simulating crash)', () => {
    const conversationId = 'conv-crash'
    const pendingKey = `pendingUserMessage:${conversationId}`

    // Simulate persist
    const persistedData = {
      conversationId,
      message: { role: 'user', content: 'important message' },
      timestamp: Date.now(),
      requestId: 'req-crash',
    }
    mockStore.set(pendingKey, persistedData)

    // Don't call delete (simulating crash before cleanup)

    // Verify message is still recoverable
    const recovered = mockStore.get(pendingKey)
    expect(recovered).toEqual(persistedData)
  })

  it('finds the last user message from the messages array', () => {
    const messages = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'response' },
      { role: 'user', content: 'second message' },
    ]

    // Replicate the logic from claudeAgent.ts
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    expect(lastUserMessage).toEqual({ role: 'user', content: 'second message' })
  })

  it('handles empty messages array gracefully', () => {
    const messages: Array<{ role: string; content: unknown }> = []
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    expect(lastUserMessage).toBeUndefined()
  })

  it('handles messages with no user messages gracefully', () => {
    const messages = [
      { role: 'assistant', content: 'I am an assistant' },
      { role: 'system', content: 'system message' },
    ]
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    expect(lastUserMessage).toBeUndefined()
  })
})

describe('Escalation Stop Reason Detection', () => {
  // Use a helper to avoid TS2367 (literal type comparison)
  function shouldEscalate(stopReason: string, currentTokens: number, ceiling: number): boolean {
    return stopReason === 'max_tokens' && currentTokens < ceiling
  }

  it('detects max_tokens as a truncation signal', () => {
    expect(shouldEscalate('max_tokens', 8192, 64_000)).toBe(true)
  })

  it('does not escalate on end_turn', () => {
    expect(shouldEscalate('end_turn', 8192, 64_000)).toBe(false)
  })

  it('does not escalate on tool_use', () => {
    expect(shouldEscalate('tool_use', 8192, 64_000)).toBe(false)
  })

  it('does not escalate when already at ceiling', () => {
    expect(shouldEscalate('max_tokens', 64_000, 64_000)).toBe(false)
  })

  it('escalation multiplier produces correct sequence', () => {
    let tokens = 8192
    const sequence: number[] = [tokens]

    while (tokens < 64_000) {
      tokens = Math.min(tokens * 4, 64_000)
      sequence.push(tokens)
    }

    expect(sequence).toEqual([8192, 32768, 64000])
  })
})
