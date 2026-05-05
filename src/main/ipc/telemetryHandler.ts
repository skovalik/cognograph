// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { app, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

// IMPORTANT: Do NOT compute telemetryDir at module scope — app.getPath() is
// unavailable before app.whenReady(). Compute lazily inside each handler.

export function registerTelemetryHandlers(): void {
  ipcMain.on('telemetry:token-usage', async (_event, line: string) => {
    try {
      const telemetryDir = path.join(app.getPath('userData'), 'telemetry')
      if (!existsSync(telemetryDir)) await mkdir(telemetryDir, { recursive: true })
      await appendFile(path.join(telemetryDir, 'token-usage.jsonl'), line)
    } catch {
      /* telemetry must never break the app */
    }
  })

  ipcMain.on('telemetry:bfs-context', async (_event, line: string) => {
    try {
      const telemetryDir = path.join(app.getPath('userData'), 'telemetry')
      if (!existsSync(telemetryDir)) await mkdir(telemetryDir, { recursive: true })
      await appendFile(path.join(telemetryDir, 'bfs-context.jsonl'), line)
    } catch {
      /* silent */
    }
  })
}
