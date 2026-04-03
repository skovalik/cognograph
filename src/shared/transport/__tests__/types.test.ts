// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect } from 'vitest'
import type {
  AgentMessage,
  AgentMessageChannel,
  PayloadFor,
  Transport,
  AgentStreamChunk,
  ToolResult,
  PermissionRequest,
  PermissionResponse,
  Notification,
  TokenUsage,
  Position,
} from '../types'

// =============================================================================
// Type-level assertions
//
// These tests verify that the Transport types compile correctly and that the
// discriminated union / channel extraction types work as expected. If any
// type relationship breaks, TypeScript will refuse to compile this file.
// =============================================================================

/** Helper: assert a value is assignable to a type (compile-time only). */
function assertType<T>(_value: T): void {
  // no-op — the assertion is purely at the type level
}

describe('Transport types', () => {
  // ---------------------------------------------------------------------------
  // AgentMessageChannel covers all expected channels
  // ---------------------------------------------------------------------------
  it('AgentMessageChannel includes all defined channels', () => {
    const channels: AgentMessageChannel[] = [
      'agent:stream-chunk',
      'agent:tool-start',
      'agent:tool-result',
      'agent:node-created',
      'agent:complete',
      'permission:request',
      'permission:response',
      'notification',
    ]

    // Runtime sanity — we have 8 channels
    expect(channels).toHaveLength(8)

    // Each channel string is a valid AgentMessageChannel (compile-time)
    for (const ch of channels) {
      assertType<AgentMessageChannel>(ch)
    }
  })

  // ---------------------------------------------------------------------------
  // PayloadFor correctly extracts payload types
  // ---------------------------------------------------------------------------
  it('PayloadFor extracts correct payload type for agent:stream-chunk', () => {
    const payload: PayloadFor<'agent:stream-chunk'> = {
      requestId: 'r1',
      conversationId: 'c1',
      type: 'text_delta',
      content: 'hello',
    }
    assertType<AgentStreamChunk>(payload)
    expect(payload.type).toBe('text_delta')
  })

  it('PayloadFor extracts correct payload type for agent:tool-start', () => {
    const payload: PayloadFor<'agent:tool-start'> = {
      toolName: 'read_file',
      toolId: 't1',
    }
    expect(payload.toolName).toBe('read_file')
    expect(payload.toolId).toBe('t1')
  })

  it('PayloadFor extracts correct payload type for agent:tool-result', () => {
    const result: ToolResult = { success: true, output: 'data' }
    const payload: PayloadFor<'agent:tool-result'> = {
      toolId: 't1',
      result,
    }
    expect(payload.result.success).toBe(true)
  })

  it('PayloadFor extracts correct payload type for agent:node-created', () => {
    const payload: PayloadFor<'agent:node-created'> = {
      nodeId: 'n1',
      type: 'note',
      position: { x: 100, y: 200 },
    }
    assertType<Position>(payload.position)
    expect(payload.position.x).toBe(100)
  })

  it('PayloadFor extracts correct payload type for agent:complete', () => {
    const usage: TokenUsage = { input_tokens: 100, output_tokens: 50 }
    const payload: PayloadFor<'agent:complete'> = {
      conversationId: 'c1',
      usage,
    }
    expect(payload.usage.input_tokens).toBe(100)
  })

  it('PayloadFor extracts correct payload type for permission:request', () => {
    const payload: PayloadFor<'permission:request'> = {
      requestId: 'p1',
      toolName: 'write_file',
      description: 'Write to /tmp/foo',
    }
    assertType<PermissionRequest>(payload)
    expect(payload.toolName).toBe('write_file')
  })

  it('PayloadFor extracts correct payload type for permission:response', () => {
    const payload: PayloadFor<'permission:response'> = {
      requestId: 'p1',
      granted: true,
    }
    assertType<PermissionResponse>(payload)
    expect(payload.granted).toBe(true)
  })

  it('PayloadFor extracts correct payload type for notification', () => {
    const payload: PayloadFor<'notification'> = {
      level: 'info',
      title: 'Done',
      message: 'Task complete',
    }
    assertType<Notification>(payload)
    expect(payload.level).toBe('info')
  })

  // ---------------------------------------------------------------------------
  // AgentMessage construction is type-safe
  // ---------------------------------------------------------------------------
  it('AgentMessage can be constructed for each channel', () => {
    const messages: AgentMessage[] = [
      {
        channel: 'agent:stream-chunk',
        payload: { requestId: 'r1', conversationId: 'c1', type: 'text_delta', content: 'hi' },
      },
      {
        channel: 'agent:tool-start',
        payload: { toolName: 'bash', toolId: 't1' },
      },
      {
        channel: 'agent:tool-result',
        payload: { toolId: 't1', result: { success: true } },
      },
      {
        channel: 'agent:node-created',
        payload: { nodeId: 'n1', type: 'artifact', position: { x: 0, y: 0 } },
      },
      {
        channel: 'agent:complete',
        payload: { conversationId: 'c1', usage: { input_tokens: 10, output_tokens: 5 } },
      },
      {
        channel: 'permission:request',
        payload: { requestId: 'p1', toolName: 'bash', description: 'run ls' },
      },
      {
        channel: 'permission:response',
        payload: { requestId: 'p1', granted: false },
      },
      {
        channel: 'notification',
        payload: { level: 'warning', title: 'Warn', message: 'Low tokens' },
      },
    ]

    expect(messages).toHaveLength(8)
  })

  // ---------------------------------------------------------------------------
  // AgentStreamChunk union discriminator
  // ---------------------------------------------------------------------------
  it('AgentStreamChunk discriminates on type field', () => {
    const chunk: AgentStreamChunk = {
      requestId: 'r1',
      conversationId: 'c1',
      type: 'done',
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    }

    // Discriminated union narrows correctly
    if (chunk.type === 'done') {
      expect(chunk.stopReason).toBe('end_turn')
      expect(chunk.usage?.input_tokens).toBe(100)
    }
  })

  // ---------------------------------------------------------------------------
  // Transport interface structural check
  // ---------------------------------------------------------------------------
  it('Transport interface is structurally compatible with a mock', () => {
    const mock: Transport = {
      send: () => {},
      onMessage: () => {},
      onDisconnect: () => {},
      isReady: () => true,
    }

    expect(mock.isReady()).toBe(true)
  })
})
