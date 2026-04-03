// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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

import { buildContextForNode, writeContextFile, getContextFilePath, getWorkspaceFilePath } from './contextWriter'
import { writeClaudeConfig, cleanupClaudeConfig } from './claudeConfigWriter'
import { existsSync } from 'fs'
import type { TerminalShell } from '../../shared/types/nodes'
import { getSafeEnv, mergeSafeEnv } from '../utils/safeEnv'

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
  /** CWD where .mcp.json + CLAUDE.md were written (for cleanup on exit) */
  claudeConfigCwd: string | null
}

export interface SpawnConfig {
  nodeId: string
  sessionId: string
  cwd?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  shell?: TerminalShell
  /** Node title for Claude Code context injection */
  nodeTitle?: string
  /** Active workspace ID from renderer — used to construct workspace path for MCP */
  workspaceId?: string
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
// Shell resolution
// ---------------------------------------------------------------------------

interface ShellResolution {
  executable: string
  args: string[]
  /** Whether to inject Cognograph context env vars + write context file. */
  injectContext: boolean
}

/**
 * Resolve the shell executable and arguments for a given TerminalShell value.
 * Falls back to claude-code if the requested shell is not available.
 */
function resolveShell(shell: TerminalShell | undefined, isWindows: boolean): ShellResolution {
  switch (shell) {
    case 'git-bash': {
      // Try common Git Bash paths on Windows; on Unix just use bash
      if (isWindows) {
        const candidates = [
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        ]
        // existsSync imported at top of file — this runs once at spawn time
        const found = candidates.find(p => existsSync(p))
        if (!found) {
          console.warn('[TerminalManager] Git Bash not found at standard paths, falling back to Claude Code')
          return resolveShell('claude-code', isWindows)
        }
        return { executable: found, args: ['--login'], injectContext: false }
      }
      return { executable: '/bin/bash', args: ['--login'], injectContext: false }
    }

    case 'powershell': {
      if (isWindows) {
        // Prefer PowerShell 7+ (pwsh) over Windows PowerShell 5.1
        return { executable: 'pwsh.exe', args: ['-NoLogo'], injectContext: false }
      }
      // pwsh on macOS/Linux (if installed)
      return { executable: 'pwsh', args: ['-NoLogo'], injectContext: false }
    }

    case 'cmd': {
      if (isWindows) {
        return { executable: 'cmd.exe', args: [], injectContext: false }
      }
      // cmd doesn't exist on Unix; fall back
      console.warn('[TerminalManager] cmd.exe not available on Unix, falling back to Claude Code')
      return resolveShell('claude-code', isWindows)
    }

    case 'claude-code':
    default: {
      // Current behavior — launch Claude Code via shell
      if (isWindows) {
        return { executable: 'cmd.exe', args: ['/c', 'claude'], injectContext: true }
      }
      return { executable: '/bin/bash', args: ['-lc', 'claude'], injectContext: true }
    }
  }
}

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
    shell: requestedShell,
    nodeTitle,
    workspaceId: passedWorkspaceId,
  } = config

  const isWindows = process.platform === 'win32'
  const { executable, args, injectContext } = resolveShell(requestedShell, isWindows)

  // Resolve workspace ID — prefer the one passed from renderer (always current),
  // fall back to settings.json (may be stale if workspace was switched).
  // Must resolve BEFORE the context/config promise so writeClaudeConfig gets the ID.
  let workspaceId = passedWorkspaceId || ''
  if (!workspaceId) {
    try {
      const wsPath = await getWorkspaceFilePath()
      if (wsPath) {
        workspaceId = wsPath.split(/[/\\]/).pop()?.replace('.json', '') ?? ''
      }
    } catch {
      // Non-fatal
    }
  }

  // --- Context injection + Claude Code MCP config (fire-and-forget) ---
  // Only inject Cognograph context for Claude Code shells.
  // Other shells get a plain spawn with no context file or env vars.
  // Build context and write .mcp.json + CLAUDE.md so Claude Code auto-connects
  // to Cognograph's MCP server on startup. The context file is a fallback;
  // the primary context path is via the MCP `get_initial_context` tool.
  // Always write MCP config so `claude` typed manually in any shell picks up Cognograph tools.
  // Full context/CLAUDE.md injection is only for dedicated Claude Code shells,
  // but .mcp.json is written for ALL shells so MCP tools are always available.
  let contextAndConfigPromise: Promise<string | null> = Promise.resolve(null)
  {
    contextAndConfigPromise = buildContextForNode(nodeId)
      .then(async (ctx) => {
        await writeContextFile(ctx)
        // Write .mcp.json + CLAUDE.md in the terminal's working directory
        const configResult = await writeClaudeConfig({
          nodeId,
          cwd,
          nodeTitle: nodeTitle || `Terminal ${nodeId.slice(0, 8)}`,
          contextMarkdown: ctx.markdown,
          workspaceId,
        })
        if (!configResult.success) {
          console.warn('[TerminalManager] Claude config write failed (non-fatal):', configResult.error)
        }
        return configResult.success ? cwd : null
      })
      .catch(err => {
        console.warn('[TerminalManager] Context/config write failed (non-fatal):', err)
        return null
      })
  }

  // Build safe env from allowlist, then merge user-provided + Cognograph-specific vars.
  // This prevents leaking secrets (API keys, DB URLs) from parent process.env.
  const cognographVars: Record<string, string> = {
    COLORTERM: 'truecolor',
    CLAUDE_SESSION_ID: sessionId,
    COGNOGRAPH_NODE_ID: nodeId,
    COGNOGRAPH_CONTEXT_FILE: getContextFilePath(nodeId),
    COGNOGRAPH_WORKSPACE_ID: workspaceId,
  }

  const mergedEnv = mergeSafeEnv(getSafeEnv(), { ...env, ...cognographVars })

  // Wait for .mcp.json to be written BEFORE spawning PTY.
  // Claude Code reads .mcp.json on startup — if we spawn first, it misses the config.
  await contextAndConfigPromise

  const pty = await loadPty()
  const ptyProcess = pty.spawn(executable, args, {
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
    claudeConfigCwd: null,
  }

  // Track the config directory for cleanup (resolves after PTY is already running)
  contextAndConfigPromise.then(configCwd => {
    session.claudeConfigCwd = configCwd
  }).catch(() => {
    // contextAndConfigPromise already catches internally and returns null -- this is belt-and-suspenders
  })

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

  // --- onExit: mark exited, clean up timer + config files + forward to renderer ---
  ptyProcess.onExit(({ exitCode }) => {
    session.status = 'exited'
    clearIdleTimer(session)

    // Clean up generated .mcp.json + CLAUDE.md
    // Clear claudeConfigCwd first to prevent duplicate cleanup if killTerminal is also called
    if (session.claudeConfigCwd) {
      const configCwd = session.claudeConfigCwd
      session.claudeConfigCwd = null
      cleanupClaudeConfig(configCwd).catch(err => {
        console.warn('[TerminalManager] Config cleanup failed (non-fatal):', err)
      })
    }

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

  // Clean up generated config files (only if not already cleaned up by onExit)
  // Note: if the process exits naturally before killTerminal is called,
  // onExit already ran cleanup. Double-calling cleanupClaudeConfig is safe
  // (it checks file contents before deleting), but we clear claudeConfigCwd
  // to prevent duplicate cleanup.
  if (session.claudeConfigCwd) {
    const configCwd = session.claudeConfigCwd
    session.claudeConfigCwd = null
    cleanupClaudeConfig(configCwd).catch(err => {
      console.warn('[TerminalManager] Config cleanup failed (non-fatal):', err)
    })
  }

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
