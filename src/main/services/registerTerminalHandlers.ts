/**
 * registerTerminalHandlers.ts — IPC handler registration for terminal management.
 *
 * Bridges the terminalManager (PTY lifecycle) to the renderer via IPC:
 *   - Request/response: terminal:spawn, terminal:write, terminal:resize, terminal:kill, terminal:getScrollback
 *   - Push events: terminal:data (PTY output), terminal:exit (PTY exit code)
 *
 * Push events use webContents.send so the renderer can subscribe per-nodeId.
 */

import { ipcMain, BrowserWindow } from 'electron'
import {
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  getScrollback,
  setEventForwarders,
} from './terminalManager'
import type { TerminalSpawnConfig, TerminalSpawnResult } from '../../shared/types/terminal'

export function registerTerminalHandlers(): void {
  // ---------------------------------------------------------------------------
  // Request/response handlers (renderer invokes, main responds)
  // ---------------------------------------------------------------------------

  ipcMain.handle('terminal:spawn', async (_event, config: TerminalSpawnConfig): Promise<TerminalSpawnResult> => {
    try {
      const session = await spawnTerminal({
        nodeId: config.nodeId,
        sessionId: config.sessionId,
        cwd: config.cwd,
        cols: config.cols,
        rows: config.rows,
      })
      return { sessionId: session.sessionId, nodeId: session.nodeId, pid: session.pid }
    } catch (err) {
      throw new Error(
        `Failed to spawn terminal for node ${config.nodeId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle('terminal:write', async (_event, nodeId: string, data: string): Promise<void> => {
    writeTerminal(nodeId, data)
  })

  ipcMain.handle('terminal:resize', async (_event, nodeId: string, cols: number, rows: number): Promise<void> => {
    resizeTerminal(nodeId, cols, rows)
  })

  ipcMain.handle('terminal:kill', async (_event, nodeId: string): Promise<void> => {
    killTerminal(nodeId)
  })

  ipcMain.handle('terminal:getScrollback', async (_event, nodeId: string): Promise<string[]> => {
    return getScrollback(nodeId)
  })

  // ---------------------------------------------------------------------------
  // Push events (main sends to renderer when PTY emits data/exit)
  // ---------------------------------------------------------------------------

  setEventForwarders(
    // onData: forward PTY output to all renderer windows
    (nodeId: string, data: string) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('terminal:data', nodeId, data)
        }
      }
    },
    // onExit: forward PTY exit code to all renderer windows
    (nodeId: string, exitCode: number) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('terminal:exit', nodeId, exitCode)
        }
      }
    },
  )
}
