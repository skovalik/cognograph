// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/shared/transport/webSocketTransport.ts -- WebSocket transport
//
// Browser-compatible WebSocket transport implementing the Transport interface.
// Handles reconnection with exponential backoff, message serialization, and
// buffering during disconnects.
//
// Created as part of Phase 5A: WEB-BACKEND hardening
// =============================================================================

import type { AgentMessage, Transport } from './types'

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

export interface WebSocketTransportConfig {
  /** WebSocket server URL (e.g., 'wss://api.cognograph.app/ws/agent') */
  url: string

  /** Authentication token sent as query parameter. */
  token?: string

  /** Maximum reconnection attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number

  /** Initial reconnect delay in ms. Default: 1000 */
  initialReconnectDelayMs?: number

  /** Maximum reconnect delay in ms (cap for exponential backoff). Default: 30000 */
  maxReconnectDelayMs?: number

  /** Heartbeat ping interval in ms. Default: 30000 */
  pingIntervalMs?: number

  /** Maximum number of messages to buffer during reconnect. Default: 100 */
  maxBufferSize?: number
}

// -----------------------------------------------------------------------------
// Implementation
// -----------------------------------------------------------------------------

/**
 * WebSocket transport for cloud agent communication.
 *
 * Features:
 * - Automatic reconnection with exponential backoff + jitter
 * - Message buffering during disconnects (flushed on reconnect)
 * - Heartbeat pings to detect stale connections
 * - JSON serialization/deserialization of AgentMessage
 *
 * Usage:
 * ```ts
 * const transport = new WebSocketTransport({
 *   url: 'wss://api.cognograph.app/ws/agent',
 *   token: 'jwt-token-here',
 * })
 * transport.connect()
 * transport.onMessage((msg) => console.log(msg))
 * transport.send({ channel: 'notification', payload: { ... } })
 * ```
 */
export class WebSocketTransport implements Transport {
  private readonly config: Required<WebSocketTransportConfig>
  private ws: WebSocket | null = null
  private messageHandlers: Array<(message: AgentMessage) => void> = []
  private disconnectHandlers: Array<() => void> = []
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private buffer: AgentMessage[] = []
  private _ready = false
  private _disposed = false
  private _intentionallyClosed = false

  constructor(config: WebSocketTransportConfig) {
    this.config = {
      url: config.url,
      token: config.token ?? '',
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      initialReconnectDelayMs: config.initialReconnectDelayMs ?? 1000,
      maxReconnectDelayMs: config.maxReconnectDelayMs ?? 30_000,
      pingIntervalMs: config.pingIntervalMs ?? 30_000,
      maxBufferSize: config.maxBufferSize ?? 100,
    }
  }

  // ---------------------------------------------------------------------------
  // Transport interface
  // ---------------------------------------------------------------------------

  send(message: AgentMessage): void {
    if (this._disposed) return

    if (this._ready && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // Buffer messages during reconnect
      if (this.buffer.length < this.config.maxBufferSize) {
        this.buffer.push(message)
      }
      // Silently drop if buffer is full — better than OOM
    }
  }

  onMessage(handler: (message: AgentMessage) => void): void {
    this.messageHandlers.push(handler)
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler)
  }

  isReady(): boolean {
    return this._ready && !this._disposed
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initiate the WebSocket connection. Call this after registering handlers.
   */
  connect(): void {
    if (this._disposed) return
    this._intentionallyClosed = false
    this.createConnection()
  }

  /**
   * Permanently close the transport. No reconnection will be attempted.
   * Clears all handlers and timers.
   */
  dispose(): void {
    this._disposed = true
    this._intentionallyClosed = true
    this._ready = false

    this.clearTimers()

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Transport disposed')
      }
      this.ws = null
    }

    this.messageHandlers = []
    this.disconnectHandlers = []
    this.buffer = []
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private buildUrl(): string {
    const base = this.config.url
    if (this.config.token) {
      const separator = base.includes('?') ? '&' : '?'
      return `${base}${separator}token=${encodeURIComponent(this.config.token)}`
    }
    return base
  }

  private createConnection(): void {
    if (this._disposed) return

    try {
      this.ws = new WebSocket(this.buildUrl())
    } catch (err) {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this._ready = true
      this.reconnectAttempts = 0
      this.startPingInterval()
      this.flushBuffer()
    }

    this.ws.onmessage = (event: MessageEvent) => {
      // Ignore pong responses
      if (event.data === 'pong') return

      try {
        const message = JSON.parse(
          typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer),
        ) as AgentMessage

        // Validate basic shape
        if (!message.channel || message.payload === undefined) return

        for (const handler of this.messageHandlers) {
          try {
            handler(message)
          } catch {
            // Don't let a handler error kill the transport
          }
        }
      } catch {
        // Malformed message — skip
      }
    }

    this.ws.onerror = () => {
      // The close event will fire next — handle reconnection there
    }

    this.ws.onclose = (event: CloseEvent) => {
      const wasReady = this._ready
      this._ready = false
      this.clearPingInterval()

      if (wasReady) {
        for (const handler of this.disconnectHandlers) {
          try {
            handler()
          } catch {
            // Don't let a handler error kill reconnection
          }
        }
      }

      // Don't reconnect if intentionally closed or disposed
      if (this._intentionallyClosed || this._disposed) return

      // 1000 = normal close, 1001 = going away (server shutdown)
      // Reconnect on all other codes, or if the server is shutting down
      if (event.code !== 1000) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect(): void {
    if (this._disposed || this._intentionallyClosed) return
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      // Exhausted reconnection attempts — already notified via onclose handler
      return
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.config.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelayMs,
    )
    const jitter = Math.random() * baseDelay * 0.3 // up to 30% jitter
    const delay = baseDelay + jitter

    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.createConnection()
    }, delay)
  }

  private flushBuffer(): void {
    if (!this._ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const toSend = this.buffer.splice(0)
    for (const message of toSend) {
      try {
        this.ws.send(JSON.stringify(message))
      } catch {
        // Re-buffer on failure
        this.buffer.unshift(message)
        break
      }
    }
  }

  private startPingInterval(): void {
    this.clearPingInterval()
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('ping')
        } catch {
          // Connection may be stale — close will trigger reconnect
        }
      }
    }, this.config.pingIntervalMs)
  }

  private clearPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private clearTimers(): void {
    this.clearPingInterval()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
