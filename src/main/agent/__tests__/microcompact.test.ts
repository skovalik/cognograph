// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import { type GenericMessage, microcompact } from '../microcompact'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Anthropic-format tool result message */
function makeAnthropicToolResult(text: string, toolUseId = 'tool_01'): GenericMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: [{ type: 'text', text }],
      },
    ],
  }
}

/** OpenAI-format tool result message */
function makeOpenAIToolResult(text: string, toolCallId = 'call_01'): GenericMessage {
  return {
    role: 'tool',
    content: text,
    tool_call_id: toolCallId,
  }
}

/** Gemini-format tool result message */
function makeGeminiToolResult(response: string, name = 'search'): GenericMessage {
  return {
    role: 'function',
    content: undefined,
    parts: [
      {
        functionResponse: {
          name,
          response,
        },
      },
    ],
  }
}

function makeUserMessage(text: string): GenericMessage {
  return { role: 'user', content: text }
}

function makeAssistantMessage(text: string): GenericMessage {
  return { role: 'assistant', content: text }
}

function makeSystemMessage(text: string): GenericMessage {
  return { role: 'system', content: text }
}

/** Generate a long string of specified length */
function longString(length: number): string {
  return 'x'.repeat(length)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('microcompact', () => {
  // -------------------------------------------------------------------------
  // Empty / trivial cases
  // -------------------------------------------------------------------------

  it('handles empty message array', () => {
    const result = microcompact([], 'anthropic')
    expect(result.messages).toHaveLength(0)
    expect(result.removedCount).toBe(0)
    expect(result.truncatedCount).toBe(0)
  })

  it('returns messages unchanged when fewer than preserveRecent', () => {
    const messages: GenericMessage[] = [makeUserMessage('Hello'), makeAssistantMessage('Hi there')]
    const result = microcompact(messages, 'anthropic', 10)
    expect(result.messages).toEqual(messages)
    expect(result.removedCount).toBe(0)
    expect(result.truncatedCount).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Keeps recent messages intact
  // -------------------------------------------------------------------------

  it('preserves the most recent N messages intact', () => {
    const messages: GenericMessage[] = []
    for (let i = 0; i < 20; i++) {
      messages.push(makeUserMessage(`Message ${i}`))
    }

    const result = microcompact(messages, 'anthropic', 5)

    // The last 5 messages should be exactly preserved
    const last5 = result.messages.slice(-5)
    expect(last5).toEqual(messages.slice(-5))
  })

  it('respects custom preserveRecent parameter', () => {
    const bigToolResult = makeAnthropicToolResult(longString(5000))
    const messages: GenericMessage[] = [
      bigToolResult,
      makeAssistantMessage('Response 1'),
      makeUserMessage('Follow up'),
      makeAssistantMessage('Response 2'),
    ]

    // preserveRecent = 2 means only last 2 are protected
    const result = microcompact(messages, 'anthropic', 2)
    expect(result.truncatedCount).toBe(1) // The tool result was truncated
  })

  // -------------------------------------------------------------------------
  // Tool result truncation — Anthropic
  // -------------------------------------------------------------------------

  describe('Anthropic tool result truncation', () => {
    it('truncates old tool results exceeding 2KB', () => {
      const bigContent = longString(5000) // 5KB, well over 2KB limit
      const messages: GenericMessage[] = [
        makeAnthropicToolResult(bigContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)

      // The tool result (index 0) should have been truncated
      expect(result.truncatedCount).toBe(1)
      const firstMsg = result.messages[0]!
      const content = (firstMsg.content as Array<Record<string, unknown>>)[0]!
      const innerContent = (content.content as Array<Record<string, unknown>>)[0]!
      expect((innerContent.text as string).length).toBeLessThan(bigContent.length)
      expect(innerContent.text as string).toContain('[... truncated by microcompact]')
    })

    it('does not truncate tool results under 2KB', () => {
      const smallContent = longString(100)
      const messages: GenericMessage[] = [
        makeAnthropicToolResult(smallContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)
      expect(result.truncatedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Tool result truncation — OpenAI
  // -------------------------------------------------------------------------

  describe('OpenAI tool result truncation', () => {
    it('truncates old tool results exceeding 2KB', () => {
      const bigContent = longString(5000)
      const messages: GenericMessage[] = [
        makeOpenAIToolResult(bigContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'openai', 10)
      expect(result.truncatedCount).toBe(1)

      const firstMsg = result.messages[0]!
      expect(typeof firstMsg.content).toBe('string')
      expect((firstMsg.content as string).length).toBeLessThan(bigContent.length)
      expect(firstMsg.content as string).toContain('[... truncated by microcompact]')
    })

    it('does not truncate small OpenAI tool results', () => {
      const smallContent = longString(100)
      const messages: GenericMessage[] = [
        makeOpenAIToolResult(smallContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'openai', 10)
      expect(result.truncatedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Tool result truncation — Gemini
  // -------------------------------------------------------------------------

  describe('Gemini tool result truncation', () => {
    it('truncates old tool results exceeding 2KB', () => {
      const bigContent = longString(5000)
      const messages: GenericMessage[] = [
        makeGeminiToolResult(bigContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'gemini', 10)
      expect(result.truncatedCount).toBe(1)

      const firstMsg = result.messages[0]!
      const parts = firstMsg.parts as Array<Record<string, unknown>>
      const fr = parts[0]!.functionResponse as Record<string, unknown>
      expect(typeof fr.response).toBe('string')
      expect((fr.response as string).length).toBeLessThan(bigContent.length)
      expect(fr.response as string).toContain('[... truncated by microcompact]')
    })

    it('does not truncate small Gemini tool results', () => {
      const smallContent = longString(100)
      const messages: GenericMessage[] = [
        makeGeminiToolResult(smallContent),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'gemini', 10)
      expect(result.truncatedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // System message deduplication
  // -------------------------------------------------------------------------

  describe('system message deduplication', () => {
    it('drops duplicate system messages', () => {
      const messages: GenericMessage[] = [
        makeSystemMessage('You are an assistant.'),
        makeUserMessage('Hello'),
        makeSystemMessage('You are an assistant.'), // duplicate
        makeAssistantMessage('Hi'),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)
      expect(result.removedCount).toBe(1)

      // Only one system message should remain in the older portion
      const systemMsgs = result.messages.filter((m) => m.role === 'system')
      expect(systemMsgs).toHaveLength(1)
    })

    it('keeps non-duplicate system messages', () => {
      const messages: GenericMessage[] = [
        makeSystemMessage('First system message'),
        makeUserMessage('Hello'),
        makeSystemMessage('Second system message'), // different content
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)
      expect(result.removedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Provider-aware detection
  // -------------------------------------------------------------------------

  describe('provider-aware tool result detection', () => {
    it('detects Anthropic tool results correctly', () => {
      const messages: GenericMessage[] = [
        makeAnthropicToolResult(longString(5000)),
        makeUserMessage('Not a tool result'),
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)
      expect(result.truncatedCount).toBe(1)
    })

    it('does not treat regular user messages as tool results', () => {
      const messages: GenericMessage[] = [
        makeUserMessage(longString(5000)), // long user message, NOT a tool result
        ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
      ]

      const result = microcompact(messages, 'anthropic', 10)
      expect(result.truncatedCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Combined behavior
  // -------------------------------------------------------------------------

  it('truncates AND deduplicates in a single pass', () => {
    const messages: GenericMessage[] = [
      makeSystemMessage('System prompt'),
      makeAnthropicToolResult(longString(5000)),
      makeSystemMessage('System prompt'), // duplicate
      makeAnthropicToolResult(longString(3000)),
      ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
    ]

    const result = microcompact(messages, 'anthropic', 10)
    expect(result.removedCount).toBe(1) // 1 duplicate system message removed
    expect(result.truncatedCount).toBe(2) // 2 tool results truncated
    expect(result.messages).toHaveLength(13) // 14 original - 1 removed
  })

  // -------------------------------------------------------------------------
  // Never mutates input
  // -------------------------------------------------------------------------

  it('does not mutate the original message array', () => {
    const original = longString(5000)
    const messages: GenericMessage[] = [
      makeAnthropicToolResult(original),
      ...Array.from({ length: 10 }, (_, i) => makeUserMessage(`Recent ${i}`)),
    ]

    const messagesCopy = JSON.parse(JSON.stringify(messages)) as GenericMessage[]
    microcompact(messages, 'anthropic', 10)

    // Original array should be unchanged
    expect(JSON.stringify(messages)).toBe(JSON.stringify(messagesCopy))
  })
})
