/**
 * terminalManager.ts — Main-process terminal manager for embedded Claude Code sessions.
 *
 * Manages PTY lifecycle: spawn, write, resize, kill. Maintains a rolling scrollback
 * buffer (5000 lines) per session for replay when xterm.js remounts. Tracks session
 * status (running / idle / exited) with a 30-second idle timeout.
 *
 * node-pty is a native module — it must be installed and rebuilt for the target
 * Electron version via electron-rebuild. Until then, tests mock the module entirely.
 */

import { buildContextForNode, writeContextFile, getContextFilePath } from './contextWriter'

// node-pty is a native C++ addon. We lazy-load it so the app doesn't crash
// on startup if it's not installed. The import only fires when spawnTerminal()
// is actually called. Tests mock 'node-pty' via vi.mock which intercepts this.
type IPty = import('node-pty').IPty
let _pty: typeof import('node-pty') | undefined
async function loadPty(): Promise<typeof import('node-pty')> {
  if (!_pty) {
    _pty = await import('node-pty')
  }
  return _pty
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalSession {
  pty: IPty
  sessionId: string
  nodeId: string
  cols: number
  rows: number
  cwd: string
  pid: number
  scrollbackBuffer: string[]
  status: 'running' | 'idle' | 'exited'
  idleTimeout: ReturnType<typeof setTimeout> | null
}

export interface SpawnConfig {
  nodeId: string
  sessionId: string
  cwd?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
}

/** Callback signature for forwarding PTY data events (e.g. to renderer via IPC). */
export type TerminalDataForwarder = (nodeId: string, data: string) => void

/** Callback signature for forwarding PTY exit events (e.g. to renderer via IPC). */
export type TerminalExitForwarder = (nodeId: string, exitCode: number) => void

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCROLLBACK_LIMIT = 5000
const IDLE_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Session map + event forwarders
// ---------------------------------------------------------------------------

const sessions: Map<string, TerminalSession> = new Map()
let dataForwarder: TerminalDataForwarder | null = null
let exitForwarder: TerminalExitForwarder | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register callbacks that are invoked when PTY data/exit events occur.
 * Typically called once by the IPC handler registration to forward events
 * to the renderer via `webContents.send`.
 */
export function setEventForwarders(
  onData: TerminalDataForwarder,
  onExit: TerminalExitForwarder,
): void {
  dataForwarder = onData
  exitForwarder = onExit
}

/**
 * Spawn a new terminal session for the given node.
 *
 * - Windows: `cmd.exe /c claude`
 * - macOS/Linux: `/bin/bash -lc claude`
 *
 * Sets env vars: CLAUDE_SESSION_ID, COGNOGRAPH_NODE_ID, COGNOGRAPH_CONTEXT_FILE,
 * plus any custom env. Kicks off async context file writing as a background task.
 * Hooks onData (scrollback + idle timer) and onExit (status update).
 */
export async function spawnTerminal(config: SpawnConfig): Promise<TerminalSession> {
  const {
    nodeId,
    sessionId,
    cwd = process.cwd(),
    cols = 80,
    rows = 24,
    env = {},
  } = config

  // Evaluated at call time so tests can override process.platform
  const isWindows = process.platform === 'win32'
  const shell = isWindows ? 'cmd.exe' : '/bin/bash'
  const args = isWindows ? ['/c', 'claude'] : ['-lc', 'claude']

  // --- Context injection pipeline (fire-and-forget) ---
  // Build + write the context file in the background. The env var is set
  // synchronously (we know the path ahead of time), so the spawned process
  // can read the file once it's ready. The primary context path is via the
  // MCP `get_initial_context` tool; the file is a fallback.
  buildContextForNode(nodeId)
    .then(ctx => writeContextFile(ctx))
    .catch(err => console.warn('[TerminalManager] Context write failed (non-fatal):', err))

  const mergedEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    CLAUDE_SESSION_ID: sessionId,
    COGNOGRAPH_NODE_ID: nodeId,
    COGNOGRAPH_CONTEXT_FILE: getContextFilePath(nodeId),
    ...env,
  }

  const pty = await loadPty()
  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: mergedEnv,
  })

  const session: TerminalSession = {
    pty: ptyProcess,
    sessionId,
    nodeId,
    cols,
    rows,
    cwd,
    pid: ptyProcess.pid,
    scrollbackBuffer: [],
    status: 'running',
    idleTimeout: null,
  }

  // --- Idle timeout ---
  resetIdleTimer(session)

  // --- onData: scrollback + idle reset + forward to renderer ---
  ptyProcess.onData((data: string) => {
    appendToScrollback(session, data)

    // Any data means the session is active
    if (session.status === 'idle') {
      session.status = 'running'
    }

    resetIdleTimer(session)

    // Forward to renderer (if IPC forwarder is registered)
    dataForwarder?.(nodeId, data)
  })

  // --- onExit: mark exited, clean up timer + forward to renderer ---
  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'exited'
    clearIdleTimer(session)

    // Forward to renderer (if IPC forwarder is registered)
    exitForwarder?.(nodeId, exitCode)
  })

  sessions.set(nodeId, session)
  return session
}

/**
 * Write data to the PTY stdin for the given node.
 * No-op if the nodeId is unknown or session has exited.
 */
export function writeTerminal(nodeId: string, data: string): void {
  const session = sessions.get(nodeId)
  if (!session || session.status === 'exited') return
  session.pty.write(data)
}

/**
 * Resize the PTY for the given node.
 */
export function resizeTerminal(nodeId: string, cols: number, rows: number): void {
  const session = sessions.get(nodeId)
  if (!session) return
  session.pty.resize(cols, rows)
  session.cols = cols
  session.rows = rows
}

/**
 * Kill the PTY for the given node and remove from the session map.
 * No-op if the nodeId is unknown. Safe to call on exited sessions.
 */
export function killTerminal(nodeId: string): void {
  const session = sessions.get(nodeId)
  if (!session) return

  clearIdleTimer(session)

  // Only send kill if the process hasn't already exited
  if (session.status !== 'exited') {
    try {
      session.pty.kill()
    } catch {
      // PTY may already be dead — ignore errors
    }
  }

  sessions.delete(nodeId)
}

/**
 * Kill all sessions. Called on Electron `before-quit`.
 */
export function killAll(): void {
  for (const [nodeId] of sessions) {
    killTerminal(nodeId)
  }
}

/**
 * Get the scrollback buffer for replay.
 * Returns an empty array if the nodeId is unknown.
 */
export function getScrollback(nodeId: string): string[] {
  const session = sessions.get(nodeId)
  if (!session) return []
  return [...session.scrollbackBuffer]
}

/**
 * Get session info for the given node.
 */
export function getSession(nodeId: string): TerminalSession | undefined {
  return sessions.get(nodeId)
}

/**
 * Get all sessions (for status display).
 */
export function getAllSessions(): Map<string, TerminalSession> {
  return sessions
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Append data to the rolling scrollback buffer.
 * Splits by newlines, trims from front if over SCROLLBACK_LIMIT.
 */
function appendToScrollback(session: TerminalSession, data: string): void {
  const lines = data.split('\n')

  // If the last element is empty (data ended with \n), drop it to avoid
  // accumulating empty strings.
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  session.scrollbackBuffer.push(...lines)

  // Trim from front if over limit
  if (session.scrollbackBuffer.length > SCROLLBACK_LIMIT) {
    const excess = session.scrollbackBuffer.length - SCROLLBACK_LIMIT
    session.scrollbackBuffer.splice(0, excess)
  }
}

/**
 * Reset (or start) the idle timer for a session.
 * After IDLE_TIMEOUT_MS of no data, status -> 'idle'.
 */
function resetIdleTimer(session: TerminalSession): void {
  clearIdleTimer(session)

  session.idleTimeout = setTimeout(() => {
    if (session.status === 'running') {
      session.status = 'idle'
    }
  }, IDLE_TIMEOUT_MS)
}

/**
 * Clear the idle timer for a session.
 */
function clearIdleTimer(session: TerminalSession): void {
  if (session.idleTimeout !== null) {
    clearTimeout(session.idleTimeout)
    session.idleTimeout = null
  }
}
