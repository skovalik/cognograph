// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * mcpBridgeIpc.ts — IPC query utility for MCP bridge.
 *
 * Generic main→renderer query with correlation ID, timeout, and cleanup.
 * Pattern copied from claudeAgent.ts getContextForConversation (lines 180-218).
 */

import crypto from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'

export type QueryFn = (
  type: string,
  params?: Record<string, unknown>,
  workspaceId?: string,
) => Promise<unknown>

const pendingQueries = new Map<
  string,
  { resolve: (data: unknown) => void; timer: NodeJS.Timeout }
>()

// Guard: ipcMain may be undefined in test environments (vitest without electron mock)
ipcMain?.on('bridge:response', (event, data: { requestId: string; result: unknown }) => {
  const origin = event.senderFrame?.url ?? ''
  if (!origin.startsWith('app://') && !origin.startsWith('http://localhost')) {
    return
  }

  const pending = pendingQueries.get(data.requestId)
  if (!pending) return
  clearTimeout(pending.timer)
  pendingQueries.delete(data.requestId)
  pending.resolve(data.result)
})

/**
 * Query the renderer's Zustand store via IPC round-trip.
 * main sends 'bridge:query' → renderer reads store → sends 'bridge:response'.
 * Times out after 5s and returns null.
 */
export async function bridgeQuery(
  type: string,
  params: Record<string, unknown> = {},
  workspaceId?: string,
): Promise<unknown> {
  const win = findWindowForWorkspace(workspaceId)
  if (!win || win.isDestroyed()) return null

  return new Promise((resolve) => {
    const requestId = crypto.randomUUID()
    const timer = setTimeout(() => {
      pendingQueries.delete(requestId)
      resolve(null)
    }, 5000)

    pendingQueries.set(requestId, { resolve, timer })
    win.webContents.send('bridge:query', { requestId, type, params })
  })
}

function findWindowForWorkspace(workspaceId?: string): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
  if (windows.length === 0) return null
  if (!workspaceId || windows.length === 1) return windows[0] ?? null
  return windows[0] ?? null
}
