// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * mcpAgentSpans.test.ts — OTel wrap unit tests.
 *
 * Verifies the two service-tier wrappers (withMcpToolSpan + withAgentTurnSpan):
 *   - Forward fn() result on success.
 *   - Forward thrown errors after recording + ending the span.
 *   - Attach the safe metadata attributes (tool.name + mcp.server_id for
 *     MCP; ai.model + token attrs for agent turns).
 *   - Pass NO prompt body, NO tool args, NO response body to the
 *     underlying Sentry tracer (the privacy contract; the wrappers
 *     don't auto-strip — the test verifies the wrappers' own surface
 *     is clean and that callers can set additional safe attributes
 *     without leaking PII).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface CapturedSpan {
  name: string
  attributes?: Record<string, unknown>
  events: Array<{ kind: 'setAttribute'; key: string; value: unknown } | { kind: 'end' }>
}

const captured: CapturedSpan[] = []

vi.mock('@sentry/electron/main', () => ({
  startInactiveSpan: vi.fn((args: { name: string; attributes?: Record<string, unknown> }) => {
    const record: CapturedSpan = {
      name: args.name,
      attributes: args.attributes,
      events: [],
    }
    captured.push(record)
    return {
      end: vi.fn(() => {
        record.events.push({ kind: 'end' })
      }),
      setAttribute: vi.fn((key: string, value: unknown) => {
        record.events.push({ kind: 'setAttribute', key, value })
      }),
    }
  }),
  captureException: vi.fn(),
}))

import { withAgentTurnSpan, withMcpToolSpan } from '../mcpAgentSpans'

beforeEach(() => {
  captured.length = 0
})

afterEach(() => {
  captured.length = 0
})

describe('withMcpToolSpan', () => {
  it('forwards fn() result + ends the span on success', async () => {
    const result = await withMcpToolSpan(
      { 'tool.name': 'read_file', 'mcp.server_id': 'fs' },
      async () => ({ ok: true }),
    )
    expect(result).toEqual({ ok: true })
    expect(captured).toHaveLength(1)
    expect(captured[0]!.name).toBe('mcp.tool_call')
    expect(captured[0]!.attributes).toEqual({ 'tool.name': 'read_file', 'mcp.server_id': 'fs' })
    expect(captured[0]!.events.some((e) => e.kind === 'end')).toBe(true)
  })

  it('records exception + ends span + rethrows on failure', async () => {
    const boom = new Error('mcp tool boom')
    let thrown: unknown = null
    try {
      await withMcpToolSpan({ 'tool.name': 'crash', 'mcp.server_id': 'fs' }, async () => {
        throw boom
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBe(boom)
    expect(captured[0]!.events.some((e) => e.kind === 'end')).toBe(true)
  })

  it('attaches NO prompt/args/body/input/response attribute keys', async () => {
    await withMcpToolSpan({ 'tool.name': 'read_file', 'mcp.server_id': 'fs' }, async () => 'result')
    const attrs = captured[0]!.attributes ?? {}
    const banned = ['prompt', 'messages', 'body', 'args', 'input', 'response', 'content', 'text']
    for (const key of banned) {
      expect(attrs).not.toHaveProperty(key)
    }
  })
})

describe('withAgentTurnSpan', () => {
  it('forwards fn() result + ends span; ai.model attached upfront', async () => {
    const result = await withAgentTurnSpan({ 'ai.model': 'claude-sonnet-4-6' }, async () => 'x')
    expect(result).toBe('x')
    expect(captured[0]!.name).toBe('agent.turn')
    expect(captured[0]!.attributes).toEqual({ 'ai.model': 'claude-sonnet-4-6' })
  })

  it('passes the span to the callback so tokens can be set post-hoc', async () => {
    await withAgentTurnSpan({ 'ai.model': 'claude-sonnet-4-6' }, async (span) => {
      span.setAttribute('ai.tokens_in', 1234)
      span.setAttribute('ai.tokens_out', 567)
      span.setAttribute('ai.usd', 0.0042)
    })
    const events = captured[0]!.events.filter(
      (e): e is { kind: 'setAttribute'; key: string; value: unknown } => e.kind === 'setAttribute',
    )
    expect(events.find((e) => e.key === 'ai.tokens_in')?.value).toBe(1234)
    expect(events.find((e) => e.key === 'ai.tokens_out')?.value).toBe(567)
    expect(events.find((e) => e.key === 'ai.usd')?.value).toBe(0.0042)
  })

  it('rethrows + ends span on error in callback', async () => {
    const boom = new Error('turn failed')
    let thrown: unknown = null
    try {
      await withAgentTurnSpan({ 'ai.model': 'claude-sonnet-4-6' }, async () => {
        throw boom
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBe(boom)
    expect(captured[0]!.events.some((e) => e.kind === 'end')).toBe(true)
  })

  it('attaches NO prompt/messages/body/input attributes upfront', async () => {
    await withAgentTurnSpan({ 'ai.model': 'claude-sonnet-4-6' }, async () => undefined)
    const attrs = captured[0]!.attributes ?? {}
    const banned = ['prompt', 'messages', 'body', 'args', 'input', 'response', 'content', 'text']
    for (const key of banned) {
      expect(attrs).not.toHaveProperty(key)
    }
  })

  it('strips undefined attribute values (sanitizeAttributes)', async () => {
    await withAgentTurnSpan(
      { 'ai.model': 'claude-sonnet-4-6', 'ai.tokens_in': undefined, 'ai.usd': undefined },
      async () => undefined,
    )
    const attrs = captured[0]!.attributes ?? {}
    expect(attrs).toEqual({ 'ai.model': 'claude-sonnet-4-6' })
    expect(attrs).not.toHaveProperty('ai.tokens_in')
    expect(attrs).not.toHaveProperty('ai.usd')
  })
})
