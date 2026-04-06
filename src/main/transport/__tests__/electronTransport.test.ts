// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { AgentMessage } from '@shared/transport/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// =============================================================================
// Mocks — vi.hoisted() ensures these are available inside vi.mock() factories
// =============================================================================

const { ipcOnListeners, mockRemoveListener } = vi.hoisted(() => {
  const ipcOnListeners = new Map<string, Array<(event: unknown, payload: unknown) => void>>()
  const mockRemoveListener = vi.fn(
    (channel: string, listener: (event: unknown, payload: unknown) => void) => {
      const existing = ipcOnListeners.get(channel) || []
      const idx = existing.indexOf(listener)
      if (idx >= 0) existing.splice(idx, 1)
      ipcOnListeners.set(channel, existing)
    },
  )
  return { ipcOnListeners, mockRemoveListener }
})

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
      const existing = ipcOnListeners.get(channel) || []
      existing.push(listener)
      ipcOnListeners.set(channel, existing)
    }),
    removeListener: mockRemoveListener,
  },
}))

// =============================================================================
// Test helpers
// =============================================================================

function createMockWebContents() {
  const destroyedHandlers: Array<() => void> = []
  return {
    send: vi.fn(),
    once: vi.fn((event: string, handler: () => void) => {
      if (event === 'destroyed') {
        destroyedHandlers.push(handler)
      }
    }),
    // Test helper to simulate destruction
    _simulateDestroyed: () => {
      for (const h of destroyedHandlers) h()
    },
  }
}

function createMockBrowserWindow(overrides?: { isDestroyed?: () => boolean }) {
  const webContents = createMockWebContents()
  return {
    webContents,
    isDestroyed: overrides?.isDestroyed ?? vi.fn(() => false),
    _webContents: webContents,
  }
}

// =============================================================================
// Tests
// =============================================================================

// Import after mocks are set up
import { ElectronTransport } from '../electronTransport'

describe('ElectronTransport', () => {
  beforeEach(() => {
    ipcOnListeners.clear()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // send()
  // ---------------------------------------------------------------------------
  describe('send()', () => {
    it('sends message via webContents.send with channel and payload', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const message: AgentMessage = {
        channel: 'agent:stream-chunk',
        payload: {
          requestId: 'r1',
          conversationId: 'c1',
          type: 'text_delta',
          content: 'hello',
        },
      }

      transport.send(message)

      expect(win.webContents.send).toHaveBeenCalledTimes(1)
      expect(win.webContents.send).toHaveBeenCalledWith('agent:stream-chunk', message.payload)
    })

    it('sends different channel types correctly', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const messages: AgentMessage[] = [
        {
          channel: 'agent:complete',
          payload: { conversationId: 'c1', usage: { input_tokens: 10, output_tokens: 5 } },
        },
        {
          channel: 'notification',
          payload: { level: 'info', title: 'Test', message: 'Hello' },
        },
        {
          channel: 'permission:request',
          payload: { requestId: 'p1', toolName: 'bash', description: 'run cmd' },
        },
      ]

      for (const msg of messages) {
        transport.send(msg)
      }

      expect(win.webContents.send).toHaveBeenCalledTimes(3)
      expect(win.webContents.send).toHaveBeenNthCalledWith(
        1,
        'agent:complete',
        messages[0]!.payload,
      )
      expect(win.webContents.send).toHaveBeenNthCalledWith(2, 'notification', messages[1]!.payload)
      expect(win.webContents.send).toHaveBeenNthCalledWith(
        3,
        'permission:request',
        messages[2]!.payload,
      )
    })

    it('silently drops messages when window is destroyed', () => {
      const win = createMockBrowserWindow({ isDestroyed: () => true })
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      transport.send({
        channel: 'notification',
        payload: { level: 'info', title: 'Test', message: 'Dropped' },
      })

      expect(win.webContents.send).not.toHaveBeenCalled()
    })

    it('silently drops messages after webContents destroyed event', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      // Simulate destruction
      win._webContents._simulateDestroyed()

      transport.send({
        channel: 'notification',
        payload: { level: 'info', title: 'Test', message: 'Dropped' },
      })

      expect(win.webContents.send).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // onMessage()
  // ---------------------------------------------------------------------------
  describe('onMessage()', () => {
    it('registers ipcMain listeners for all channels on first handler', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const handler = vi.fn()
      transport.onMessage(handler)

      // Should have registered listeners for all 8 channels
      expect(ipcOnListeners.size).toBe(8)
      expect(ipcOnListeners.has('agent:stream-chunk')).toBe(true)
      expect(ipcOnListeners.has('agent:tool-start')).toBe(true)
      expect(ipcOnListeners.has('agent:tool-result')).toBe(true)
      expect(ipcOnListeners.has('agent:node-created')).toBe(true)
      expect(ipcOnListeners.has('agent:complete')).toBe(true)
      expect(ipcOnListeners.has('permission:request')).toBe(true)
      expect(ipcOnListeners.has('permission:response')).toBe(true)
      expect(ipcOnListeners.has('notification')).toBe(true)
    })

    it('dispatches incoming IPC events to registered handlers', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const handler = vi.fn()
      transport.onMessage(handler)

      // Simulate an incoming IPC message on agent:stream-chunk
      const payload = { requestId: 'r1', conversationId: 'c1', type: 'text_delta', content: 'hi' }
      const listeners = ipcOnListeners.get('agent:stream-chunk')!
      for (const listener of listeners) {
        listener({}, payload)
      }

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        channel: 'agent:stream-chunk',
        payload,
      })
    })

    it('dispatches to multiple handlers', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const handler1 = vi.fn()
      const handler2 = vi.fn()
      transport.onMessage(handler1)
      transport.onMessage(handler2)

      // Simulate notification
      const payload = { level: 'error', title: 'Err', message: 'fail' }
      const listeners = ipcOnListeners.get('notification')!
      for (const listener of listeners) {
        listener({}, payload)
      }

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // onDisconnect()
  // ---------------------------------------------------------------------------
  describe('onDisconnect()', () => {
    it('fires disconnect handler when webContents is destroyed', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const disconnectHandler = vi.fn()
      transport.onDisconnect(disconnectHandler)

      expect(disconnectHandler).not.toHaveBeenCalled()

      // Simulate window destruction
      win._webContents._simulateDestroyed()

      expect(disconnectHandler).toHaveBeenCalledTimes(1)
    })

    it('fires immediately if window is already destroyed', () => {
      const win = createMockBrowserWindow({ isDestroyed: () => true })
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      const disconnectHandler = vi.fn()
      transport.onDisconnect(disconnectHandler)

      expect(disconnectHandler).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // isReady()
  // ---------------------------------------------------------------------------
  describe('isReady()', () => {
    it('returns true for a live window', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      expect(transport.isReady()).toBe(true)
    })

    it('returns false when window.isDestroyed() returns true', () => {
      const win = createMockBrowserWindow({ isDestroyed: () => true })
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      expect(transport.isReady()).toBe(false)
    })

    it('returns false after webContents destroyed event', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      expect(transport.isReady()).toBe(true)

      win._webContents._simulateDestroyed()

      expect(transport.isReady()).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // dispose()
  // ---------------------------------------------------------------------------
  describe('dispose()', () => {
    it('removes all ipcMain listeners and clears handlers', () => {
      const win = createMockBrowserWindow()
      const transport = new ElectronTransport(win as unknown as Electron.BrowserWindow)

      transport.onMessage(vi.fn())
      transport.onDisconnect(vi.fn())

      // Listeners registered
      expect(ipcOnListeners.size).toBe(8)

      transport.dispose()

      // ipcMain.removeListener should have been called for each channel
      expect(mockRemoveListener).toHaveBeenCalledTimes(8)
    })
  })
})
