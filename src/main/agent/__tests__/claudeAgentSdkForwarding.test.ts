// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tests for the SDK-path assistant-message forwarding helper in claudeAgent.ts.
 *
 * The Agent SDK's `query()` iterator yields messages of type 'assistant' whose
 * `message.content` is an array of blocks. Each block can be `{ type: 'text',
 * text: ... }` OR `{ type: 'tool_use', id, name, input }`. The forwarder must
 * translate BOTH into AgentStreamChunk events so the renderer can render the
 * assistant's text AND the tool_use bubbles.
 *
 * Pre-fix behavior: only text blocks were forwarded; tool_use blocks were
 * silently dropped, leaving the UI with no indication that the SDK called a
 * tool. Users saw "continue" buttons after empty assistant bubbles because
 * the last message had no visible content and streaming had ended.
 */

import { describe, expect, it, vi } from 'vitest'

// claudeAgent.ts transitively loads electron + sdkTools (which registers an
// ipcMain.on listener at module load). In the test environment those APIs
// don't exist — stub the minimal surface needed for the module to import.
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(false),
  },
}))
vi.mock('electron-store', () => ({
  default: class MockStore {
    get = vi.fn()
    set = vi.fn()
    delete = vi.fn()
  },
}))
// Tracer.startSpan is wired in via mcpClient -> services/mcpAgentSpans.
// Mock the Sentry main entry so the static import chain resolves under jsdom.
vi.mock('@sentry/electron/main', () => ({
  startInactiveSpan: vi.fn(() => ({
    end: vi.fn(),
    setAttribute: vi.fn(),
  })),
  captureException: vi.fn(),
}))
vi.mock('../../settings', () => ({ getSetting: vi.fn().mockReturnValue(false) }))
vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { forwardAssistantMessageBlocks } = await import('../claudeAgent')

const BASE_META = { requestId: 'req-1', conversationId: 'conv-1' }

describe('forwardAssistantMessageBlocks', () => {
  it('forwards text blocks as text_delta chunks', () => {
    const sendChunk = vi.fn()
    const assistantMsg = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Hello, world.' }],
      },
    }

    forwardAssistantMessageBlocks(assistantMsg, sendChunk, BASE_META)

    expect(sendChunk).toHaveBeenCalledTimes(1)
    expect(sendChunk).toHaveBeenCalledWith({
      ...BASE_META,
      type: 'text_delta',
      content: 'Hello, world.',
    })
  })

  it('forwards tool_use blocks as tool_use_start chunks', () => {
    const sendChunk = vi.fn()
    const assistantMsg = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_abc123',
            name: 'mcp__cognograph_canvas__create_node',
            input: { nodeType: 'note', position: { x: 100, y: 200 } },
          },
        ],
      },
    }

    forwardAssistantMessageBlocks(assistantMsg, sendChunk, BASE_META)

    expect(sendChunk).toHaveBeenCalledTimes(1)
    expect(sendChunk).toHaveBeenCalledWith({
      ...BASE_META,
      type: 'tool_use_start',
      toolUseId: 'toolu_abc123',
      toolName: 'mcp__cognograph_canvas__create_node',
    })
  })

  it('forwards mixed text + tool_use blocks in order', () => {
    const sendChunk = vi.fn()
    const assistantMsg = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Creating a node.' },
          { type: 'tool_use', id: 'toolu_1', name: 'create_node', input: {} },
          { type: 'text', text: ' Done.' },
        ],
      },
    }

    forwardAssistantMessageBlocks(assistantMsg, sendChunk, BASE_META)

    expect(sendChunk).toHaveBeenCalledTimes(3)
    expect(sendChunk).toHaveBeenNthCalledWith(1, {
      ...BASE_META,
      type: 'text_delta',
      content: 'Creating a node.',
    })
    expect(sendChunk).toHaveBeenNthCalledWith(2, {
      ...BASE_META,
      type: 'tool_use_start',
      toolUseId: 'toolu_1',
      toolName: 'create_node',
    })
    expect(sendChunk).toHaveBeenNthCalledWith(3, {
      ...BASE_META,
      type: 'text_delta',
      content: ' Done.',
    })
  })

  it('ignores blocks of unrecognized type without throwing', () => {
    const sendChunk = vi.fn()
    const assistantMsg = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'visible' },
          { type: 'unknown_future_block_type', data: 'anything' },
        ],
      },
    }

    expect(() => forwardAssistantMessageBlocks(assistantMsg, sendChunk, BASE_META)).not.toThrow()
    expect(sendChunk).toHaveBeenCalledTimes(1)
    expect(sendChunk).toHaveBeenCalledWith({
      ...BASE_META,
      type: 'text_delta',
      content: 'visible',
    })
  })

  it('is a no-op for non-assistant messages', () => {
    const sendChunk = vi.fn()
    const systemMsg = { type: 'system', subtype: 'init', session_id: 's1' }
    const resultMsg = { type: 'result', subtype: 'success', stop_reason: 'end_turn' }

    forwardAssistantMessageBlocks(systemMsg, sendChunk, BASE_META)
    forwardAssistantMessageBlocks(resultMsg, sendChunk, BASE_META)

    expect(sendChunk).not.toHaveBeenCalled()
  })

  it('handles an assistant message with empty content array', () => {
    const sendChunk = vi.fn()
    const assistantMsg = {
      type: 'assistant',
      message: { content: [] },
    }

    forwardAssistantMessageBlocks(assistantMsg, sendChunk, BASE_META)

    expect(sendChunk).not.toHaveBeenCalled()
  })
})
