// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — logger is the only non-pure dep in agentLoop.ts
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock tokenEstimation so individual tests can override estimateTokens return values
vi.mock('../tokenEstimation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tokenEstimation')>()
  return {
    ...actual,
    estimateTokens: vi.fn(actual.estimateTokens),
  }
})

// Mock microcompact so individual tests can spy on it
vi.mock('../microcompact', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../microcompact')>()
  return {
    ...actual,
    microcompact: vi.fn(actual.microcompact),
  }
})

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { assembleToolPool } from '../../tools/assembleToolPool'
import { buildTool } from '../../tools/buildTool'
import type { ExecutionContext } from '../../tools/types'
import type { AgentLoopConfig, AgentLoopEvent } from '../agentLoop'
import { runAgentWithToolLoop } from '../agentLoop'
import { microcompact } from '../microcompact'
import { estimateTokens } from '../tokenEstimation'

// ---------------------------------------------------------------------------
// Mock Anthropic client
// ---------------------------------------------------------------------------

function makeFinalMessage(
  opts: {
    content?: Anthropic.ContentBlock[]
    stop_reason?: string
    usage?: { input_tokens: number; output_tokens: number }
  } = {},
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: opts.content ?? [{ type: 'text', text: 'Hello!' }],
    stop_reason: opts.stop_reason ?? 'end_turn',
    stop_sequence: null,
    usage: opts.usage ?? { input_tokens: 100, output_tokens: 50 },
  } as Anthropic.Message
}

function makeMockStream(finalMsg: Anthropic.Message, events: Anthropic.MessageStreamEvent[] = []) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event
      }
    },
    finalMessage: async () => finalMsg,
  }
}

function makeClient(streamFn: (...args: unknown[]) => unknown): Anthropic {
  return {
    messages: {
      stream: streamFn,
    },
  } as unknown as Anthropic
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(): ExecutionContext {
  return {
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    allowedPaths: ['/workspace'],
    messages: [],
    activeMcpServerIds: [],
    metadata: {},
  }
}

function makeEchoTool() {
  return buildTool({
    name: 'echo',
    description: 'Echoes message',
    inputSchema: z.object({ message: z.string() }),
    isReadOnly: true,
    async call(input) {
      const { message } = input as { message: string }
      return { content: [{ type: 'text', text: `Echo: ${message}` }] }
    },
  })
}

function makePool(tools = [makeEchoTool()]) {
  return assembleToolPool(tools, [])
}

function baseConfig(overrides: Partial<AgentLoopConfig> = {}): AgentLoopConfig {
  const finalMsg = makeFinalMessage()
  const streamFn = vi.fn().mockResolvedValue(makeMockStream(finalMsg))

  return {
    client: makeClient(streamFn),
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a test assistant.',
    messages: [{ role: 'user' as const, content: 'Hello' }],
    toolPool: makePool(),
    executionContext: makeContext(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAgentWithToolLoop — basic flow', () => {
  it('returns on end_turn with no tool calls', async () => {
    const config = baseConfig()
    const result = await runAgentWithToolLoop(config)

    expect(result.stopReason).toBe('end_turn')
    expect(result.turnCount).toBe(1)
    expect(result.usage.input_tokens).toBe(100)
    expect(result.usage.output_tokens).toBe(50)
  })

  it('emits text-delta events during streaming', async () => {
    const events: AgentLoopEvent[] = []
    const textEvent: Anthropic.MessageStreamEvent = {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello world' },
    }

    const finalMsg = makeFinalMessage()
    const streamFn = vi.fn().mockResolvedValue(makeMockStream(finalMsg, [textEvent]))

    const config = baseConfig({
      client: makeClient(streamFn),
      onEvent: (e) => events.push(e),
    })

    await runAgentWithToolLoop(config)

    expect(events).toContainEqual({
      type: 'text-delta',
      content: 'Hello world',
    })
  })
})

describe('runAgentWithToolLoop — tool execution', () => {
  it('executes tool calls and injects results back', async () => {
    // Turn 1: LLM returns a tool_use block
    const toolUseMessage = makeFinalMessage({
      content: [
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'echo',
          input: { message: 'test' },
        } as unknown as Anthropic.ContentBlock,
      ],
      stop_reason: 'tool_use',
    })

    // Turn 2: LLM returns final text
    const textMessage = makeFinalMessage({
      content: [{ type: 'text', text: 'Done!' }],
      stop_reason: 'end_turn',
    })

    // Capture messages at each call (array is mutated in-place after call)
    const capturedMessages: Anthropic.MessageParam[][] = []
    const streamFn = vi
      .fn()
      .mockImplementation((params: { messages: Anthropic.MessageParam[] }) => {
        capturedMessages.push([...params.messages]) // snapshot
        if (capturedMessages.length === 1) return makeMockStream(toolUseMessage)
        return makeMockStream(textMessage)
      })

    const events: AgentLoopEvent[] = []

    const config = baseConfig({
      client: makeClient(streamFn),
      onEvent: (e) => events.push(e),
    })

    const result = await runAgentWithToolLoop(config)

    expect(result.turnCount).toBe(2)
    expect(result.stopReason).toBe('end_turn')

    // Tool events should have been emitted
    const toolStarts = events.filter((e) => e.type === 'tool-start')
    expect(toolStarts).toHaveLength(1)
    expect(toolStarts[0]).toMatchObject({
      type: 'tool-start',
      toolName: 'echo',
      toolId: 'call_1',
      toolInput: { message: 'test' },
    })

    const toolResults = events.filter((e) => e.type === 'tool-result')
    expect(toolResults).toHaveLength(1)
    expect(toolResults[0]).toMatchObject({
      type: 'tool-result',
      toolId: 'call_1',
      toolName: 'echo',
    })

    // Check the messages snapshot from the second call
    const secondCallMessages = capturedMessages[1]
    expect(secondCallMessages).toBeDefined()
    // Should have: user msg, assistant tool_use, user tool_result
    expect(secondCallMessages!.length).toBe(3)
    // Last message should be user with tool_result content
    const lastMsg = secondCallMessages![secondCallMessages!.length - 1]
    expect(lastMsg?.role).toBe('user')
    expect(Array.isArray(lastMsg?.content)).toBe(true)
    const toolResultBlock = (lastMsg?.content as Anthropic.ToolResultBlockParam[])[0]
    expect(toolResultBlock?.type).toBe('tool_result')
    expect(toolResultBlock?.tool_use_id).toBe('call_1')
  })
})

describe('runAgentWithToolLoop — maxTurns', () => {
  it('terminates after maxTurns even with continuous tool calls', async () => {
    // Every turn returns a tool_use — loop should terminate at maxTurns
    const toolUseMessage = makeFinalMessage({
      content: [
        {
          type: 'tool_use',
          id: 'call_inf',
          name: 'echo',
          input: { message: 'loop' },
        } as unknown as Anthropic.ContentBlock,
      ],
      stop_reason: 'tool_use',
    })

    const streamFn = vi.fn().mockResolvedValue(makeMockStream(toolUseMessage))

    const config = baseConfig({
      client: makeClient(streamFn),
      maxTurns: 3,
    })

    const result = await runAgentWithToolLoop(config)

    expect(result.turnCount).toBe(3)
    // Usage should accumulate across all 3 turns
    expect(result.usage.input_tokens).toBe(300) // 100 * 3
    expect(result.usage.output_tokens).toBe(150) // 50 * 3
  })
})

describe('runAgentWithToolLoop — escalation', () => {
  it('escalates max_tokens on truncation and continues', async () => {
    // Turn 1: truncated response
    const truncatedMsg = makeFinalMessage({
      content: [{ type: 'text', text: 'Partial...' }],
      stop_reason: 'max_tokens',
    })

    // Turn 2: full response
    const fullMsg = makeFinalMessage({
      content: [{ type: 'text', text: 'Complete!' }],
      stop_reason: 'end_turn',
    })

    const streamFn = vi
      .fn()
      .mockResolvedValueOnce(makeMockStream(truncatedMsg))
      .mockResolvedValueOnce(makeMockStream(fullMsg))

    const events: AgentLoopEvent[] = []

    const config = baseConfig({
      client: makeClient(streamFn),
      maxTokens: 8192,
      onEvent: (e) => events.push(e),
    })

    const result = await runAgentWithToolLoop(config)

    expect(result.turnCount).toBe(2)
    expect(result.stopReason).toBe('end_turn')

    // Second call should have escalated max_tokens (8192 * 4 = 32768)
    const secondCallParams = streamFn.mock.calls[1]?.[0] as Record<string, unknown>
    expect(secondCallParams?.max_tokens).toBe(32768)

    // Should have emitted escalation text
    const textDeltas = events.filter((e) => e.type === 'text-delta')
    const escalationMsg = textDeltas.find(
      (e) => e.type === 'text-delta' && e.content.includes('truncated'),
    )
    expect(escalationMsg).toBeDefined()
  })
})

describe('runAgentWithToolLoop — cancellation', () => {
  it('respects abort signal', async () => {
    const controller = new AbortController()
    // Abort before even starting
    controller.abort()

    const config = baseConfig({
      signal: controller.signal,
    })

    const result = await runAgentWithToolLoop(config)

    expect(result.stopReason).toBe('cancelled')
    expect(result.turnCount).toBe(0)
  })
})

describe('runAgentWithToolLoop — tool validation errors', () => {
  it('returns tool error for invalid input (Zod validation)', async () => {
    // Tool call with invalid input (message should be string, not number)
    const toolUseMessage = makeFinalMessage({
      content: [
        {
          type: 'tool_use',
          id: 'call_bad',
          name: 'echo',
          input: { message: 42 },
        } as unknown as Anthropic.ContentBlock,
      ],
      stop_reason: 'tool_use',
    })

    const textMessage = makeFinalMessage({
      content: [{ type: 'text', text: 'OK' }],
      stop_reason: 'end_turn',
    })

    // Capture messages at each call
    const capturedMessages: Anthropic.MessageParam[][] = []
    const streamFn = vi
      .fn()
      .mockImplementation((params: { messages: Anthropic.MessageParam[] }) => {
        capturedMessages.push([...params.messages])
        if (capturedMessages.length === 1) return makeMockStream(toolUseMessage)
        return makeMockStream(textMessage)
      })

    const events: AgentLoopEvent[] = []

    const config = baseConfig({
      client: makeClient(streamFn),
      onEvent: (e) => events.push(e),
    })

    const result = await runAgentWithToolLoop(config)

    // Should still complete — errors are returned as results, not thrown
    expect(result.turnCount).toBe(2)

    // Tool result event should have isError
    const toolResultEvents = events.filter((e) => e.type === 'tool-result')
    expect(toolResultEvents).toHaveLength(1)
    const trEvent = toolResultEvents[0] as Extract<AgentLoopEvent, { type: 'tool-result' }>
    expect(trEvent.result.isError).toBe(true)

    // Check the messages snapshot from the second call
    const secondCallMessages = capturedMessages[1]
    expect(secondCallMessages).toBeDefined()
    const lastMsg = secondCallMessages![secondCallMessages!.length - 1]
    const toolResultBlock = (lastMsg?.content as Anthropic.ToolResultBlockParam[])[0]
    expect(toolResultBlock?.is_error).toBe(true)
  })
})

describe('runAgentWithToolLoop — proactive compaction', () => {
  it('compacts messages when over 75% token budget', async () => {
    // Approach: mock estimateTokens to return a value that exceeds 75% of maxTokens.
    // With maxTokens=8192, the threshold is 8192 * 0.75 = 6144.
    // We return 7000 so the condition fires on turn 1.
    //
    // microcompact is also mocked (wrapping the real impl) so we can spy on calls.
    // After compaction, the loop continues normally to end_turn.

    const mockedEstimateTokens = vi.mocked(estimateTokens)
    const mockedMicrocompact = vi.mocked(microcompact)

    // Return a token count above the 75% threshold (8192 * 0.75 = 6144)
    mockedEstimateTokens.mockReturnValue(7000)

    // Spy is already wrapping real impl — keep default behavior for the compaction call
    mockedMicrocompact.mockClear()

    const finalMsg = makeFinalMessage()
    const streamFn = vi.fn().mockResolvedValue(makeMockStream(finalMsg))

    const config = baseConfig({
      client: makeClient(streamFn),
      maxTokens: 8192,
    })

    const result = await runAgentWithToolLoop(config)

    // Loop should complete normally
    expect(result.stopReason).toBe('end_turn')
    expect(result.turnCount).toBe(1)

    // microcompact should have been called once (proactive C3 path on turn 1)
    expect(mockedMicrocompact).toHaveBeenCalledTimes(1)
    expect(mockedMicrocompact).toHaveBeenCalledWith(expect.any(Array), 'anthropic')

    // Restore mocks so subsequent tests use real implementations
    mockedEstimateTokens.mockRestore()
    mockedMicrocompact.mockRestore()
  })
})
