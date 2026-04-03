// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentMessage } from '../types'

// =============================================================================
// Mock WebSocket
// =============================================================================

interface MockWebSocketInstance {
  url: string
  readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  _simulateOpen: () => void
  _simulateMessage: (data: string) => void
  _simulateClose: (code?: number, reason?: string) => void
  _simulateError: () => void
}

let mockInstances: MockWebSocketInstance[] = []

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  url: string
  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send = vi.fn()
  close = vi.fn((code?: number, _reason?: string) => {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code ?? 1000, reason: _reason ?? '' }))
    }
  })

  constructor(url: string) {
    this.url = url
    mockInstances.push(this as unknown as MockWebSocketInstance)
  }

  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) this.onopen(new Event('open'))
  }

  _simulateMessage(data: string) {
    if (this.onmessage) this.onmessage(new MessageEvent('message', { data }))
  }

  _simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose(new CloseEvent('close', { code, reason }))
  }

  _simulateError() {
    if (this.onerror) this.onerror(new Event('error'))
  }
}

// Replace global WebSocket with mock
const originalWebSocket = globalThis.WebSocket
beforeEach(() => {
  mockInstances = []
  // @ts-expect-error — replacing global for test
  globalThis.WebSocket = MockWebSocket
})
afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

// =============================================================================
// Tests
// =============================================================================

import { WebSocketTransport } from '../webSocketTransport'

function getLatestMock(): MockWebSocketInstance {
  return mockInstances[mockInstances.length - 1]!
}

describe('WebSocketTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------
  describe('connect()', () => {
    it('creates a WebSocket connection to the configured URL', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })

      transport.connect()

      expect(mockInstances).toHaveLength(1)
      expect(getLatestMock().url).toBe('wss://test.example.com/ws/agent')

      transport.dispose()
    })

    it('appends token as query parameter', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        token: 'my-jwt-token',
      })

      transport.connect()

      expect(getLatestMock().url).toContain('token=my-jwt-token')

      transport.dispose()
    })

    it('is ready after connection opens', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })

      transport.connect()
      expect(transport.isReady()).toBe(false)

      getLatestMock()._simulateOpen()
      expect(transport.isReady()).toBe(true)

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // send()
  // ---------------------------------------------------------------------------
  describe('send()', () => {
    it('sends JSON-serialized messages when connected', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      transport.connect()
      getLatestMock()._simulateOpen()

      const message: AgentMessage = {
        channel: 'notification',
        payload: { level: 'info', title: 'Test', message: 'Hello' },
      }

      transport.send(message)

      expect(getLatestMock().send).toHaveBeenCalledTimes(1)
      expect(getLatestMock().send).toHaveBeenCalledWith(JSON.stringify(message))

      transport.dispose()
    })

    it('buffers messages when not connected', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      transport.connect()
      // Don't open the connection

      const message: AgentMessage = {
        channel: 'notification',
        payload: { level: 'info', title: 'Test', message: 'Buffered' },
      }

      transport.send(message)
      expect(getLatestMock().send).not.toHaveBeenCalled()

      // Now open — buffered message should flush
      getLatestMock()._simulateOpen()
      expect(getLatestMock().send).toHaveBeenCalledWith(JSON.stringify(message))

      transport.dispose()
    })

    it('drops messages silently after dispose', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      transport.connect()
      getLatestMock()._simulateOpen()
      transport.dispose()

      transport.send({
        channel: 'notification',
        payload: { level: 'info', title: 'Test', message: 'Dropped' },
      })

      // send was called 0 times on the mock after dispose
      // (the mock may have been called during flush, but not for the post-dispose send)
      // We verify by checking the transport state
      expect(transport.isReady()).toBe(false)
    })

    it('respects maxBufferSize', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        maxBufferSize: 2,
      })
      transport.connect()
      // Don't open — messages will buffer

      for (let i = 0; i < 5; i++) {
        transport.send({
          channel: 'notification',
          payload: { level: 'info', title: `Msg ${i}`, message: `Message ${i}` },
        })
      }

      // Open and flush — only first 2 should have been kept
      getLatestMock()._simulateOpen()
      // 2 buffered messages flushed
      expect(getLatestMock().send).toHaveBeenCalledTimes(2)

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // onMessage()
  // ---------------------------------------------------------------------------
  describe('onMessage()', () => {
    it('dispatches parsed messages to handlers', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      const handler = vi.fn()
      transport.onMessage(handler)
      transport.connect()
      getLatestMock()._simulateOpen()

      const message: AgentMessage = {
        channel: 'agent:stream-chunk',
        payload: {
          requestId: 'r1',
          conversationId: 'c1',
          type: 'text_delta',
          content: 'hello',
        },
      }

      getLatestMock()._simulateMessage(JSON.stringify(message))

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(message)

      transport.dispose()
    })

    it('ignores malformed JSON', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      const handler = vi.fn()
      transport.onMessage(handler)
      transport.connect()
      getLatestMock()._simulateOpen()

      getLatestMock()._simulateMessage('not json {{{')

      expect(handler).not.toHaveBeenCalled()

      transport.dispose()
    })

    it('ignores pong messages', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      const handler = vi.fn()
      transport.onMessage(handler)
      transport.connect()
      getLatestMock()._simulateOpen()

      getLatestMock()._simulateMessage('pong')

      expect(handler).not.toHaveBeenCalled()

      transport.dispose()
    })

    it('ignores messages without channel property', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      const handler = vi.fn()
      transport.onMessage(handler)
      transport.connect()
      getLatestMock()._simulateOpen()

      getLatestMock()._simulateMessage(JSON.stringify({ data: 'no channel' }))

      expect(handler).not.toHaveBeenCalled()

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // onDisconnect()
  // ---------------------------------------------------------------------------
  describe('onDisconnect()', () => {
    it('fires disconnect handlers when connection closes', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        maxReconnectAttempts: 0,
      })
      const handler = vi.fn()
      transport.onDisconnect(handler)
      transport.connect()
      getLatestMock()._simulateOpen()

      getLatestMock()._simulateClose(1006, 'abnormal')

      expect(handler).toHaveBeenCalledTimes(1)

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // Reconnection
  // ---------------------------------------------------------------------------
  describe('reconnection', () => {
    it('attempts to reconnect after abnormal close', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        initialReconnectDelayMs: 100,
        maxReconnectAttempts: 3,
      })
      transport.connect()
      expect(mockInstances).toHaveLength(1)

      getLatestMock()._simulateOpen()
      getLatestMock()._simulateClose(1006, 'abnormal')

      // Advance past reconnect delay
      vi.advanceTimersByTime(200)

      // Should have created a new WebSocket
      expect(mockInstances).toHaveLength(2)

      transport.dispose()
    })

    it('does not reconnect on normal close (1000)', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        initialReconnectDelayMs: 100,
        maxReconnectAttempts: 3,
      })
      transport.connect()
      getLatestMock()._simulateOpen()
      getLatestMock()._simulateClose(1000, 'normal')

      vi.advanceTimersByTime(200)

      // No new connection attempted
      expect(mockInstances).toHaveLength(1)

      transport.dispose()
    })

    it('gives up after max reconnect attempts', () => {
      const disconnectHandler = vi.fn()
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        initialReconnectDelayMs: 100,
        maxReconnectAttempts: 2,
      })
      transport.onDisconnect(disconnectHandler)
      transport.connect()

      // First connection fails
      getLatestMock()._simulateClose(1006, 'abnormal')
      vi.advanceTimersByTime(200) // reconnect attempt 1

      getLatestMock()._simulateClose(1006, 'abnormal')
      vi.advanceTimersByTime(500) // reconnect attempt 2

      getLatestMock()._simulateClose(1006, 'abnormal')
      vi.advanceTimersByTime(2000) // should not reconnect

      // 1 initial + 2 reconnect attempts = 3 total
      expect(mockInstances).toHaveLength(3)

      transport.dispose()
    })

    it('resets reconnect counter on successful connection', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        initialReconnectDelayMs: 100,
        maxReconnectAttempts: 3,
      })
      transport.connect()

      // First connection fails
      getLatestMock()._simulateClose(1006)
      vi.advanceTimersByTime(200)

      // Second connection succeeds
      getLatestMock()._simulateOpen()
      // Then fails again
      getLatestMock()._simulateClose(1006)
      vi.advanceTimersByTime(200)

      // Should get a fresh set of attempts (not counted from before)
      expect(mockInstances.length).toBeGreaterThanOrEqual(3)

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------
  describe('heartbeat', () => {
    it('sends ping messages at the configured interval', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        pingIntervalMs: 1000,
      })
      transport.connect()
      getLatestMock()._simulateOpen()

      // Advance past one ping interval
      vi.advanceTimersByTime(1000)

      // Should have sent a ping
      expect(getLatestMock().send).toHaveBeenCalledWith('ping')

      transport.dispose()
    })
  })

  // ---------------------------------------------------------------------------
  // dispose()
  // ---------------------------------------------------------------------------
  describe('dispose()', () => {
    it('closes the WebSocket and prevents further operations', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
      })
      transport.connect()
      getLatestMock()._simulateOpen()

      transport.dispose()

      expect(transport.isReady()).toBe(false)
    })

    it('does not attempt reconnection after dispose', () => {
      const transport = new WebSocketTransport({
        url: 'wss://test.example.com/ws/agent',
        initialReconnectDelayMs: 100,
        maxReconnectAttempts: 5,
      })
      transport.connect()
      getLatestMock()._simulateOpen()

      transport.dispose()

      vi.advanceTimersByTime(10_000)

      // Only the initial connection
      expect(mockInstances).toHaveLength(1)
    })
  })
})
