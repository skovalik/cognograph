// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * registerTerminalHandlers.ts — IPC handler registration for terminal management.
 *
 * Bridges the terminalManager (PTY lifecycle) to the renderer via IPC:
 *   - Request/response: terminal:spawn, terminal:write, terminal:resize, terminal:kill, terminal:getScrollback
 *   - Push events: terminal:data (PTY output), terminal:exit (PTY exit code),
 *                  terminal:statusChange (PTY running/idle/exited),
 *                  terminal:thinkingChange (spinner-detected LLM/CLI activity — drives conic ring)
 *
 * Push events use webContents.send so the renderer can subscribe per-nodeId.
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import type { TerminalSpawnConfig, TerminalSpawnResult } from '../../shared/types/terminal'
import {
  getScrollback,
  killTerminal,
  resizeTerminal,
  setEventForwarders,
  setPinned,
  spawnTerminal,
  writeTerminal,
} from './terminalManager'

// -----------------------------------------------------------------------------
// Spinner detection — drives the conic "thinking" ring for CLI nodes.
//
// When Claude Code (or any CLI) emits a spinner glyph prefixed by \r or a CSI
// cursor sequence, we treat that as "the CLI is actively producing / thinking"
// and flip setStreaming(nodeId, true) in the renderer via the terminal:thinkingChange
// IPC channel. A 2000ms debounce clears the flag after the spinner stops emitting.
//
// Spinner alphabet (broad on purpose — cli-spinner libs ship dozens of variants):
//   - Braille block U+2800–U+28FF (ora "dots", default for many tools)
//   - Dingbats stars U+2722–U+2740 (Claude Code's ✻ ✶ ✢ rotation)
//   - Geometric circles U+25CB–U+25CF, U+25D0–U+25D3, U+25F4–U+25F7 (half-circle arcs)
//   - Record/media glyph U+23FA, U+25C9, U+25CE, U+23F8–U+23FE (⏺ etc.)
// All candidates require a \r or \x1B within the prior 16 chars to reject
// literary / logo occurrences (Claude Code's static banner contains ✻ too).
//
// Chunk-boundary buffering: PTY data arrives in arbitrary-size chunks from the
// OS. A spinner frame may split as "…\r\x1B[K" in chunk N and "✻ Pondering" in
// chunk N+1 — the prefix would be lost to a naive scan. We retain the last 16
// chars of the previous chunk per nodeId so the lookback survives boundaries.
//
// Why 2000ms (not 300ms): Claude Code's PTY output pauses the spinner during
// tool calls and plain-text streaming. Pauses >debounce flip `isStreaming` off,
// which removes `.is-thinking`, which restarts `@keyframes conic-rotate` from
// 0deg AND swaps `background` between a conic gradient and the terminal bg —
// two non-interpolable values, visible as a blink. 2s masks typical tool-call
// pauses so the ring stays continuously lit across a single assistant turn.
//
// This is distinct from terminal:statusChange ('running' | 'idle' | 'exited'),
// which tracks PTY liveness — a shell at a bash prompt is 'running' but NOT
// thinking, so the two signals deliberately diverge. See plan 2026-04-15.
// -----------------------------------------------------------------------------

const DEBOUNCE_MS = 2000
const PREFIX_LOOKBACK = 16
const thinkingState = new Map<
  string,
  { isThinking: boolean; timer: NodeJS.Timeout | null; tail: string }
>()

// Dev-only diagnostic logging. Enable by setting env var DEBUG_SPINNER=1 before
// launching Electron (e.g. `DEBUG_SPINNER=1 npm run dev`). Logs:
//   - [spinner] chunk: hex-preview of every PTY chunk (first 80 chars)
//   - [spinner] codepoints: unique non-ASCII codepoints seen in each chunk
//   - [spinner] hit: which glyph triggered detection
//   - [spinner] → ON / → OFF: thinking-state transitions
// Kept off by default because it's chatty on active PTYs; gated env-var so
// turning on / off doesn't need a rebuild of the detector code.
const DEBUG_SPINNER = process.env.DEBUG_SPINNER === '1'
function describeChunk(chunk: string): string {
  const preview = chunk.slice(0, 80).replace(/\r/g, '\\r').replace(/\x1b/g, '\\e')
  const codepoints = new Set<number>()
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk.charCodeAt(i)
    if (c > 0x7f) codepoints.add(c)
  }
  const hex = [...codepoints]
    .map((c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0'))
    .slice(0, 12)
    .join(' ')
  return `preview=${JSON.stringify(preview)} non-ascii=[${hex}]`
}

/** True if `code` is a spinner glyph in any of the known alphabets. */
function isSpinnerCodepoint(code: number): boolean {
  // Braille (ora "dots" / "dots2" / etc.)
  if (code >= 0x2800 && code <= 0x28ff) return true
  // Dingbats stars — Claude Code's rotation (✻ ✶ ✢ ✷ ✸ ✹ ✺ ✼ ✽ ✾ ✿ ❀ ❁)
  if (code >= 0x2722 && code <= 0x2740) return true
  // Geometric circles / arcs (circleHalves, dots, arc)
  if (code >= 0x25cb && code <= 0x25cf) return true
  if (code >= 0x25d0 && code <= 0x25d3) return true
  if (code >= 0x25f4 && code <= 0x25f7) return true
  // Media / record glyphs (⏺ ⏻ ⏼ ⏽ ⏾ ⏿) + large filled circles
  if (code >= 0x23fa && code <= 0x23fe) return true
  if (code === 0x25c9 || code === 0x25ce) return true
  return false
}

/**
 * Scan a PTY chunk for any spinner glyph preceded by a \r or \x1B within
 * PREFIX_LOOKBACK chars. Uses `prefix` (the retained tail of the previous
 * chunk) to preserve detection across chunk boundaries.
 */
function containsSpinnerChar(chunk: string, prefix: string): boolean {
  const combined = prefix + chunk
  const offset = prefix.length
  for (let i = offset; i < combined.length; i++) {
    if (!isSpinnerCodepoint(combined.charCodeAt(i))) continue
    const start = Math.max(0, i - PREFIX_LOOKBACK)
    for (let j = start; j < i; j++) {
      const c = combined.charCodeAt(j)
      if (c === 0x0d || c === 0x1b) return true
    }
  }
  return false
}

function broadcastThinking(nodeId: string, thinking: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:thinkingChange', nodeId, thinking)
    }
  }
}

function evaluateSpinnerChunk(nodeId: string, chunk: string): void {
  let state = thinkingState.get(nodeId)
  if (!state) {
    state = { isThinking: false, timer: null, tail: '' }
    thinkingState.set(nodeId, state)
  }
  const hit = containsSpinnerChar(chunk, state.tail)
  if (DEBUG_SPINNER) {
    console.log(`[spinner] chunk ${nodeId.slice(0, 6)} hit=${hit} ${describeChunk(chunk)}`)
  }
  // Retain the last PREFIX_LOOKBACK chars of this chunk as the next chunk's
  // prefix so a spinner frame split across a chunk boundary still detects.
  state.tail =
    chunk.length >= PREFIX_LOOKBACK
      ? chunk.slice(chunk.length - PREFIX_LOOKBACK)
      : state.tail + chunk
  if (state.tail.length > PREFIX_LOOKBACK) {
    state.tail = state.tail.slice(state.tail.length - PREFIX_LOOKBACK)
  }
  if (!hit) return
  if (!state.isThinking) {
    state.isThinking = true
    if (DEBUG_SPINNER) console.log(`[spinner] ${nodeId.slice(0, 6)} → ON`)
    broadcastThinking(nodeId, true)
  }
  if (state.timer) clearTimeout(state.timer)
  state.timer = setTimeout(() => {
    const s = thinkingState.get(nodeId)
    if (!s) return
    s.isThinking = false
    s.timer = null
    if (DEBUG_SPINNER) console.log(`[spinner] ${nodeId.slice(0, 6)} → OFF`)
    broadcastThinking(nodeId, false)
  }, DEBOUNCE_MS)
}

function cleanupThinking(nodeId: string): void {
  const state = thinkingState.get(nodeId)
  if (!state) return
  if (state.timer) clearTimeout(state.timer)
  if (state.isThinking) broadcastThinking(nodeId, false)
  thinkingState.delete(nodeId)
}

// Clear all timers on app quit so nothing dangles during teardown.
app.on('before-quit', () => {
  for (const state of thinkingState.values()) {
    if (state.timer) clearTimeout(state.timer)
  }
  thinkingState.clear()
})

export function registerTerminalHandlers(): void {
  // ---------------------------------------------------------------------------
  // Request/response handlers (renderer invokes, main responds)
  // ---------------------------------------------------------------------------

  ipcMain.handle(
    'terminal:spawn',
    async (_event, config: TerminalSpawnConfig): Promise<TerminalSpawnResult> => {
      try {
        const session = await spawnTerminal({
          nodeId: config.nodeId,
          sessionId: config.sessionId,
          cwd: config.cwd,
          cols: config.cols,
          rows: config.rows,
          shell: config.shell,
          nodeTitle: config.nodeTitle,
          workspaceId: config.workspaceId,
        })
        return { sessionId: session.sessionId, nodeId: session.nodeId, pid: session.pid }
      } catch (err) {
        throw new Error(
          `Failed to spawn terminal for node ${config.nodeId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    },
  )

  ipcMain.on('terminal:write', (_event, nodeId: string, data: string) => {
    writeTerminal(nodeId, data)
  })

  ipcMain.on('terminal:resize', (_event, nodeId: string, cols: number, rows: number) => {
    resizeTerminal(nodeId, cols, rows)
  })

  ipcMain.handle('terminal:kill', async (_event, nodeId: string): Promise<void> => {
    killTerminal(nodeId)
  })

  ipcMain.handle('terminal:pin', async (_event, nodeId: string, pinned: boolean): Promise<void> => {
    setPinned(nodeId, pinned)
  })

  ipcMain.handle('terminal:getScrollback', async (_event, nodeId: string): Promise<string[]> => {
    return getScrollback(nodeId)
  })

  // ---------------------------------------------------------------------------
  // Push events (main sends to renderer when PTY emits data/exit)
  // ---------------------------------------------------------------------------

  setEventForwarders(
    // onData: forward PTY output — scoped channel for per-instance + global for tee
    (nodeId: string, data: string) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal:data:${nodeId}`, data)
          win.webContents.send('terminal:data', nodeId, data)
        }
      }
      // Tee for spinner detection — must not block the data path above.
      evaluateSpinnerChunk(nodeId, data)
    },
    // onExit: forward PTY exit code — scoped + global
    (nodeId: string, exitCode: number) => {
      cleanupThinking(nodeId)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(`terminal:exit:${nodeId}`, exitCode)
          win.webContents.send('terminal:exit', nodeId, exitCode)
        }
      }
    },
    // onStatusChange: forward terminal status transitions (global only — no per-instance listener)
    (nodeId: string, status: string) => {
      if (status === 'exited') cleanupThinking(nodeId)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('terminal:statusChange', nodeId, status)
        }
      }
    },
  )
}
