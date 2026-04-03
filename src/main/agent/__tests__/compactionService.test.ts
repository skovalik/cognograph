// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  compactConversation,
  shouldFullCompact,
  CompactionCircuitBreaker,
  type CompactionMessage,
  type CompactionConfig,
  type CompactionSummary,
  type CompactionLLMCall,
} from '../compactionService'

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeUserMessage(text: string): CompactionMessage {
  return { role: 'user', content: text }
}

function makeAssistantMessage(text: string): CompactionMessage {
  return { role: 'assistant', content: text }
}

/** Anthropic-format tool result */
function makeAnthropicToolResult(text: string, toolUseId = 'tool_01'): CompactionMessage {
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

/** Anthropic-format assistant tool_use message */
function makeAnthropicToolUse(name: string, toolId = 'tool_01'): CompactionMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: toolId,
        name,
        input: {},
      },
    ],
  }
}

/** OpenAI-format tool result */
function makeOpenAIToolResult(text: string, toolCallId = 'call_01'): CompactionMessage {
  return {
    role: 'tool',
    content: text,
    tool_call_id: toolCallId,
  }
}

/** Gemini-format tool result */
function makeGeminiToolResult(response: string, name = 'search'): CompactionMessage {
  return {
    role: 'function',
    content: undefined,
    parts: [{ functionResponse: { name, response } }],
  }
}

/** Valid summary JSON response from the LLM */
function validSummaryJSON(overrides?: Partial<CompactionSummary>): string {
  const summary: CompactionSummary = {
    keyDecisions: ['Decided to use React', 'Chose dark theme'],
    context: 'Working on a dashboard component',
    currentTaskState: 'Header complete, sidebar in progress',
    originalTask: 'Build a dashboard with React',
    verbatimQuotes: ['I prefer dark theme'],
    ...overrides,
  }
  return JSON.stringify(summary)
}

/** Create a mock LLM call that returns a valid summary */
function mockLLMCall(response?: string): CompactionLLMCall {
  return vi.fn().mockResolvedValue(response ?? validSummaryJSON())
}

/** Create a mock LLM call that throws */
function failingLLMCall(error = 'API timeout'): CompactionLLMCall {
  return vi.fn().mockRejectedValue(new Error(error))
}

/** Default config factory */
function makeConfig(overrides?: Partial<CompactionConfig>): CompactionConfig {
  return {
    provider: 'anthropic',
    llmCall: mockLLMCall(),
    recentWindow: 3,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompactionCircuitBreaker', () => {
  let breaker: CompactionCircuitBreaker

  beforeEach(() => {
    breaker = new CompactionCircuitBreaker()
  })

  it('starts in non-tripped state', () => {
    expect(breaker.isTripped).toBe(false)
    expect(breaker.failures).toBe(0)
  })

  it('trips after 3 consecutive failures', () => {
    expect(breaker.recordFailure()).toBe(false) // 1
    expect(breaker.recordFailure()).toBe(false) // 2
    expect(breaker.recordFailure()).toBe(true)  // 3 — tripped
    expect(breaker.isTripped).toBe(true)
    expect(breaker.failures).toBe(3)
  })

  it('resets failure count on success (but stays tripped)', () => {
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordFailure() // tripped
    breaker.recordSuccess()
    expect(breaker.failures).toBe(0)
    expect(breaker.isTripped).toBe(true) // still tripped
  })

  it('fully resets with reset()', () => {
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.reset()
    expect(breaker.failures).toBe(0)
    expect(breaker.isTripped).toBe(false)
  })

  it('does not trip if successes interrupt failures', () => {
    breaker.recordFailure()
    breaker.recordFailure()
    breaker.recordSuccess() // resets count
    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.isTripped).toBe(false)
    expect(breaker.failures).toBe(2)
  })
})

describe('compactConversation', () => {
  let breaker: CompactionCircuitBreaker

  beforeEach(() => {
    breaker = new CompactionCircuitBreaker()
  })

  // -------------------------------------------------------------------------
  // Successful compaction
  // -------------------------------------------------------------------------

  it('generates a summary and returns compacted messages', async () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('Build a dashboard with React'),
      makeAnthropicToolUse('search_nodes'),
      makeAnthropicToolResult('Found 3 nodes'),
      makeAssistantMessage('I found relevant nodes.'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const config = makeConfig()
    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(true)
    expect(result.summary).toBeDefined()
    expect(result.summary!.keyDecisions).toContain('Decided to use React')
    expect(result.messages).toBeDefined()
    expect(result.circuitBreakerTripped).toBeUndefined()
  })

  it('places compaction summary between older messages and recent window', async () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('Build a dashboard'),
      makeAssistantMessage('Sure, let me help.'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const config = makeConfig({ recentWindow: 3 })
    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(true)
    const compacted = result.messages!

    // The summary message should be before the last 3 messages
    const summaryIdx = compacted.findIndex(
      (m) => typeof m.content === 'string' && (m.content as string).includes('Conversation Compaction Summary')
    )
    expect(summaryIdx).toBeGreaterThan(-1)
    expect(summaryIdx).toBe(compacted.length - 4) // 3 recent + summary at -4
  })

  // -------------------------------------------------------------------------
  // Verbatim quotes preserved
  // -------------------------------------------------------------------------

  it('preserves verbatim quotes from user messages', async () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('I prefer dark theme and you should always use TypeScript'),
      makeAssistantMessage('Understood.'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const config = makeConfig()
    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(true)
    // The summary should contain quotes extracted from the user's message
    expect(result.summary!.verbatimQuotes.length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Summary in dynamic zone
  // -------------------------------------------------------------------------

  it('summary message is a user-role message (dynamic zone compatible)', async () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('Original task'),
      makeAssistantMessage('Response'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const config = makeConfig({ recentWindow: 3 })
    const result = await compactConversation(messages, config, breaker)

    const summaryMsg = result.messages!.find(
      (m) => typeof m.content === 'string' && (m.content as string).includes('Compaction Summary')
    )
    expect(summaryMsg).toBeDefined()
    expect(summaryMsg!.role).toBe('user') // User role = dynamic zone, not system/cached
  })

  // -------------------------------------------------------------------------
  // Circuit breaker fires after 3 failures
  // -------------------------------------------------------------------------

  it('fails gracefully on LLM error', async () => {
    const config = makeConfig({ llmCall: failingLLMCall('API timeout') })
    const messages = [makeUserMessage('Hello'), makeUserMessage('R1'), makeUserMessage('R2'), makeUserMessage('R3')]

    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(false)
    expect(result.error).toContain('API timeout')
    expect(breaker.failures).toBe(1)
  })

  it('trips circuit breaker after 3 consecutive LLM failures', async () => {
    const config = makeConfig({ llmCall: failingLLMCall('timeout') })
    const messages = [makeUserMessage('Hello'), makeUserMessage('R1'), makeUserMessage('R2'), makeUserMessage('R3')]

    await compactConversation(messages, config, breaker)
    await compactConversation(messages, config, breaker)
    const result3 = await compactConversation(messages, config, breaker)

    expect(result3.circuitBreakerTripped).toBe(true)
    expect(breaker.isTripped).toBe(true)

    // 4th call should be rejected immediately without calling LLM
    const result4 = await compactConversation(messages, config, breaker)
    expect(result4.success).toBe(false)
    expect(result4.circuitBreakerTripped).toBe(true)
    expect(result4.error).toContain('circuit breaker')
    expect(config.llmCall).toHaveBeenCalledTimes(3) // NOT 4
  })

  // -------------------------------------------------------------------------
  // Provider-specific tool_result replacement
  // -------------------------------------------------------------------------

  describe('Anthropic tool_result replacement', () => {
    it('removes Anthropic tool_result messages from compacted output', async () => {
      const messages: CompactionMessage[] = [
        makeUserMessage('Build a dashboard'),
        makeAnthropicToolUse('search_nodes'),
        makeAnthropicToolResult('Found 3 nodes: ...'),
        makeAssistantMessage('Done searching.'),
        makeUserMessage('Recent 1'),
        makeAssistantMessage('Recent 2'),
        makeUserMessage('Recent 3'),
      ]

      const config = makeConfig({ provider: 'anthropic' })
      const result = await compactConversation(messages, config, breaker)

      expect(result.success).toBe(true)
      // No tool_result messages should remain in the older portion
      const olderMessages = result.messages!.slice(0, -3)
      const hasToolResult = olderMessages.some(
        (m) =>
          m.role === 'user' &&
          Array.isArray(m.content) &&
          (m.content as Array<Record<string, unknown>>).some((b) => b.type === 'tool_result')
      )
      expect(hasToolResult).toBe(false)
    })
  })

  describe('OpenAI tool_result replacement', () => {
    it('removes OpenAI tool role messages from compacted output', async () => {
      const messages: CompactionMessage[] = [
        makeUserMessage('Build a dashboard'),
        makeAssistantMessage('Let me search.'),
        makeOpenAIToolResult('Found results'),
        makeAssistantMessage('Done.'),
        makeUserMessage('Recent 1'),
        makeAssistantMessage('Recent 2'),
        makeUserMessage('Recent 3'),
      ]

      const config = makeConfig({ provider: 'openai' })
      const result = await compactConversation(messages, config, breaker)

      expect(result.success).toBe(true)
      const olderMessages = result.messages!.slice(0, -3)
      const hasToolMsg = olderMessages.some((m) => m.role === 'tool')
      expect(hasToolMsg).toBe(false)
    })
  })

  describe('Gemini tool_result replacement', () => {
    it('removes Gemini function role messages from compacted output', async () => {
      const messages: CompactionMessage[] = [
        makeUserMessage('Build a dashboard'),
        makeAssistantMessage('Searching...'),
        makeGeminiToolResult('Search results here'),
        makeAssistantMessage('Found it.'),
        makeUserMessage('Recent 1'),
        makeAssistantMessage('Recent 2'),
        makeUserMessage('Recent 3'),
      ]

      const config = makeConfig({ provider: 'gemini' })
      const result = await compactConversation(messages, config, breaker)

      expect(result.success).toBe(true)
      const olderMessages = result.messages!.slice(0, -3)
      const hasFunctionMsg = olderMessages.some((m) => m.role === 'function')
      expect(hasFunctionMsg).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Parse failure handling
  // -------------------------------------------------------------------------

  it('fails gracefully when LLM returns invalid JSON', async () => {
    const config = makeConfig({
      llmCall: vi.fn().mockResolvedValue('This is not valid JSON at all'),
    })
    const messages = [makeUserMessage('Hello'), makeUserMessage('R1'), makeUserMessage('R2'), makeUserMessage('R3')]

    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(false)
    expect(result.error).toContain('parse')
    expect(breaker.failures).toBe(1)
  })

  it('handles LLM response wrapped in markdown fences', async () => {
    const wrappedResponse = '```json\n' + validSummaryJSON() + '\n```'
    const config = makeConfig({
      llmCall: vi.fn().mockResolvedValue(wrappedResponse),
    })
    const messages = [
      makeUserMessage('Build a dashboard'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const result = await compactConversation(messages, config, breaker)
    expect(result.success).toBe(true)
    expect(result.summary).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Anti-drift: original task preserved
  // -------------------------------------------------------------------------

  it('includes the original task in the summary', async () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('Build a real-time chat application with WebSockets'),
      makeAssistantMessage('I will help with that.'),
      makeUserMessage('Recent 1'),
      makeAssistantMessage('Recent 2'),
      makeUserMessage('Recent 3'),
    ]

    const config = makeConfig()
    const result = await compactConversation(messages, config, breaker)

    expect(result.success).toBe(true)
    // The compacted messages should contain a summary message mentioning the original task
    const summaryMsg = result.messages!.find(
      (m) => typeof m.content === 'string' && (m.content as string).includes('Original Task')
    )
    expect(summaryMsg).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Empty messages
  // -------------------------------------------------------------------------

  it('handles empty message array', async () => {
    const config = makeConfig()
    const result = await compactConversation([], config, breaker)

    expect(result.success).toBe(true)
    expect(result.messages).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// shouldFullCompact
// ---------------------------------------------------------------------------

describe('shouldFullCompact', () => {
  it('returns true when messages exceed 90% of token budget', () => {
    // Create messages totaling roughly 1000 tokens
    // chars/4 ≈ tokens for prose, so ~4000 chars ≈ 1000 tokens
    const messages: CompactionMessage[] = [
      makeUserMessage('x'.repeat(4000)),
    ]

    // Budget of 1000 tokens → 90% = 900. Our message should be ~1004 tokens.
    expect(shouldFullCompact(messages, 'anthropic', 1000)).toBe(true)
  })

  it('returns false when messages are under 90% of token budget', () => {
    const messages: CompactionMessage[] = [
      makeUserMessage('Hello'),
    ]

    expect(shouldFullCompact(messages, 'anthropic', 100000)).toBe(false)
  })
})
