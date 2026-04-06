// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/main/transport/electronTransport.ts -- Electron IPC transport
//
// Wraps BrowserWindow.webContents.send() and ipcMain.on() behind the
// Transport interface. Drop-in replacement for direct webContents.send()
// calls in the main process.
//
// Created as part of Phase 1: TRANSPORT-ABSTRACTION
// =============================================================================

import type { AgentMessage, AgentMessageChannel, Transport } from '@shared/transport/types'
import { type BrowserWindow, type IpcMainEvent, ipcMain } from 'electron'

/**
 * All channels that the transport listens on for incoming messages from the
 * renderer. This is the inverse direction — renderer → main.
 */
const ALL_CHANNELS: readonly AgentMessageChannel[] = [
  'agent:stream-chunk',
  'agent:tool-start',
  'agent:tool-result',
  'agent:node-created',
  'agent:complete',
  'permission:request',
  'permission:response',
  'notification',
] as const

/**
 * Electron IPC transport implementation.
 *
 * - `send()` pushes messages to the renderer via `webContents.send()`.
 * - `onMessage()` registers `ipcMain.on()` listeners for all agent channels.
 * - `isReady()` returns false when the window has been destroyed.
 * - `onDisconnect()` fires when the window's webContents is destroyed.
 */
export class ElectronTransport implements Transport {
  private readonly window: BrowserWindow
  private messageHandlers: Array<(message: AgentMessage) => void> = []
  private disconnectHandlers: Array<() => void> = []
  private ipcListeners: Array<{
    channel: string
    listener: (event: IpcMainEvent, payload: unknown) => void
  }> = []
  private destroyed = false

  constructor(window: BrowserWindow) {
    this.window = window

    // Listen for window destruction to fire disconnect handlers
    this.window.webContents.once('destroyed', () => {
      this.destroyed = true
      for (const handler of this.disconnectHandlers) {
        handler()
      }
    })
  }

  send(message: AgentMessage): void {
    if (this.destroyed || this.window.isDestroyed()) {
      return // Silently drop — window is gone
    }
    this.window.webContents.send(message.channel, message.payload)
  }

  onMessage(handler: (message: AgentMessage) => void): void {
    this.messageHandlers.push(handler)

    // On first handler registration, set up ipcMain listeners
    if (this.messageHandlers.length === 1) {
      this.registerIpcListeners()
    }
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandlers.push(handler)

    // If already destroyed, fire immediately
    if (this.destroyed || this.window.isDestroyed()) {
      handler()
    }
  }

  isReady(): boolean {
    return !this.destroyed && !this.window.isDestroyed()
  }

  /**
   * Clean up all ipcMain listeners. Call this when the transport is no longer
   * needed (e.g., window close) to prevent listener leaks.
   */
  dispose(): void {
    for (const { channel, listener } of this.ipcListeners) {
      ipcMain.removeListener(channel, listener)
    }
    this.ipcListeners = []
    this.messageHandlers = []
    this.disconnectHandlers = []
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private registerIpcListeners(): void {
    for (const channel of ALL_CHANNELS) {
      const listener = (_event: IpcMainEvent, payload: unknown) => {
        const message = { channel, payload } as AgentMessage
        for (const handler of this.messageHandlers) {
          handler(message)
        }
      }

      ipcMain.on(channel, listener)
      this.ipcListeners.push({ channel, listener })
    }
  }
}
