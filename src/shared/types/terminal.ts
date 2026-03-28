// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { TerminalShell } from './nodes'

// =============================================================================
// src/shared/types/terminal.ts — Shared types for the terminal IPC bridge
//
// These types are used by main process (IPC handlers), preload (API bridge),
// and renderer (via window.api.terminal). Keep in sync across all three layers.
// =============================================================================

/** Configuration for spawning a new terminal session. */
export interface TerminalSpawnConfig {
  /** The canvas node ID that owns this terminal. */
  nodeId: string
  /** Unique session identifier. */
  sessionId: string
  /** Working directory for the PTY. Defaults to process.cwd(). */
  cwd?: string
  /** Terminal columns. Defaults to 80. */
  cols?: number
  /** Terminal rows. Defaults to 24. */
  rows?: number
  /** Which shell to spawn. Defaults to 'claude-code'. */
  shell?: TerminalShell
  /** Node title for Claude Code context injection. */
  nodeTitle?: string
  /** Active workspace ID — ensures MCP server points to the correct workspace. */
  workspaceId?: string
}

/** Result returned to renderer after spawning a terminal. */
export interface TerminalSpawnResult {
  sessionId: string
  nodeId: string
  pid: number
}
