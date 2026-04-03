// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ToolResult as MainToolResult } from '../../tools/types'
import type { AgentLoopEvent } from '../agentLoop'
import { bridgeEventToIPC } from '../eventBridge'

// ---------------------------------------------------------------------------
// Mock BrowserWindow — only webContents.send is used by the bridge
// ---------------------------------------------------------------------------

function makeMockWindow() {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST_ID = 'req-test-1'
const CONVERSATION_ID = 'conv-test-1'

function call(
  event: AgentLoopEvent,
  window: BrowserWindow,
  requestId = REQUEST_ID,
  conversationId = CONVERSATION_ID,
) {
  bridgeEventToIPC(event, requestId, conversationId, window)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bridgeEventToIPC — text-delta', () => {
  it('sends on agent:stream with correct payload', () => {
    const window = makeMockWindow()
    const event: AgentLoopEvent = { type: 'text-delta', content: 'Hello world' }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledOnce()
    expect(window.webContents.send).toHaveBeenCalledWith('agent:stream', {
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      type: 'text_delta',
      content: 'Hello world',
    })
  })
})

describe('bridgeEventToIPC — tool-start', () => {
  it('sends on agent:tool-start with conversationId, toolName, toolId, toolInput', () => {
    const window = makeMockWindow()
    const event: AgentLoopEvent = {
      type: 'tool-start',
      toolName: 'echo',
      toolId: 'call_abc',
      toolInput: { message: 'hello' },
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledOnce()
    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-start', {
      conversationId: CONVERSATION_ID,
      toolName: 'echo',
      toolId: 'call_abc',
      toolInput: { message: 'hello' },
    })
  })
})

describe('bridgeEventToIPC — tool-result', () => {
  it('success with JSON-parseable text content → output is parsed JSON object', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [{ type: 'text', text: '{"id":"node-1","type":"default"}' }],
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'create_node',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledOnce()
    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'create_node',
      result: {
        success: true,
        output: { id: 'node-1', type: 'default' },
      },
    })
  })

  it('success with non-JSON text → output is the raw string', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [{ type: 'text', text: 'Echo: hello' }],
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'echo',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'echo',
      result: {
        success: true,
        output: 'Echo: hello',
      },
    })
  })

  it('isError: true → result.success is false, result.error has the text', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [{ type: 'text', text: 'Permission denied' }],
      isError: true,
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'read_file',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'read_file',
      result: {
        success: false,
        error: 'Permission denied',
      },
    })
  })

  it('isError: true with no text block → error falls back to "Tool failed"', () => {
    const window = makeMockWindow()
    // Image-only content, no text block
    const result: MainToolResult = {
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'abc' },
        },
      ],
      isError: true,
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'screenshot',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'screenshot',
      result: {
        success: false,
        error: 'Tool failed',
      },
    })
  })

  it('empty content array → output is null (valid for a successful tool with no output)', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [],
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'some_tool',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'some_tool',
      result: {
        success: true,
        output: null,
      },
    })
  })

  it('first block is non-text, second block is text → reads the text block correctly', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: 'imgdata' },
        },
        { type: 'text', text: '{"status":"ok"}' },
      ],
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_abc',
      toolName: 'mixed_tool',
      result,
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledWith('agent:tool-result', {
      conversationId: CONVERSATION_ID,
      toolId: 'call_abc',
      toolName: 'mixed_tool',
      result: {
        success: true,
        output: { status: 'ok' },
      },
    })
  })
})

describe('bridgeEventToIPC — node-created', () => {
  it('single-node → sends on agent:node-created', () => {
    const window = makeMockWindow()
    const event: AgentLoopEvent = {
      type: 'node-created',
      nodeId: 'real-node-42',
      nodeType: 'artifact',
    }

    call(event, window)

    expect(window.webContents.send).toHaveBeenCalledOnce()
    expect(window.webContents.send).toHaveBeenCalledWith('agent:node-created', {
      conversationId: CONVERSATION_ID,
      nodeId: 'real-node-42',
      type: 'artifact',
      position: { x: 0, y: 0 },
    })
  })
})

describe('bridgeEventToIPC — batch_create does NOT double-emit node-created', () => {
  it('tool-result for batch_create only sends one agent:tool-result, no agent:node-created', () => {
    const window = makeMockWindow()
    const result: MainToolResult = {
      content: [
        {
          type: 'text',
          text: '{"nodeMap":{"temp-1":"real-1","temp-2":"real-2"}}',
        },
      ],
    }
    const event: AgentLoopEvent = {
      type: 'tool-result',
      toolId: 'call_batch',
      toolName: 'batch_create',
      result,
    }

    call(event, window)

    // Should only have been called once — only agent:tool-result, no agent:node-created
    expect(window.webContents.send).toHaveBeenCalledOnce()
    expect(window.webContents.send).toHaveBeenCalledWith(
      'agent:tool-result',
      expect.objectContaining({
        toolName: 'batch_create',
      }),
    )
    const calls = (window.webContents.send as ReturnType<typeof vi.fn>).mock.calls
    const nodeCreatedCalls = calls.filter(([channel]) => channel === 'agent:node-created')
    expect(nodeCreatedCalls).toHaveLength(0)
  })
})
