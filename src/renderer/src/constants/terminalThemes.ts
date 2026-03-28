// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * terminalThemes.ts — xterm.js ITheme definitions for dark and light modes.
 *
 * These are passed directly to `terminal.options.theme` at runtime.
 * xterm.js renders to <canvas>, so CSS custom properties don't apply —
 * concrete hex colors are required.
 *
 * ANSI color choices:
 * - Dark mode: Vivid colors on #1a1a2e background (existing palette, unchanged)
 * - Light mode: Tailwind 600-700 shades on #f1f5f9 background (4.5:1+ contrast)
 */

import type { ITheme } from '@xterm/xterm'
import type { ThemeMode } from '@shared/types'

// ---------------------------------------------------------------------------
// Dark Mode Terminal Theme
// ---------------------------------------------------------------------------

export const TERMINAL_THEME_DARK: ITheme = {
  background: '#1a1a2e',
  foreground: '#e0e0e0',
  cursor: '#7c3aed',
  cursorAccent: '#1a1a2e',
  selectionBackground: 'rgba(124, 58, 237, 0.3)',
  selectionForeground: undefined,
  black: '#1a1a2e',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e0e0e0',
  brightBlack: '#4a4a5e',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
}

// ---------------------------------------------------------------------------
// Light Mode Terminal Theme
// ---------------------------------------------------------------------------

export const TERMINAL_THEME_LIGHT: ITheme = {
  background: '#f1f5f9',        // slate-100 — matches --terminal-bg light
  foreground: '#334155',         // slate-700 — matches --terminal-text light
  cursor: '#6d28d9',             // violet-700 — darker cursor for light bg
  cursorAccent: '#f1f5f9',       // matches background
  selectionBackground: 'rgba(109, 40, 217, 0.2)',
  selectionForeground: undefined,
  black: '#1e293b',              // slate-800 — visible on light bg
  red: '#dc2626',                // red-600
  green: '#16a34a',              // green-600
  yellow: '#ca8a04',             // yellow-600 — darkened for light bg readability
  blue: '#2563eb',               // blue-600
  magenta: '#9333ea',            // purple-600
  cyan: '#0891b2',               // cyan-600
  white: '#f1f5f9',              // slate-100 — same as background (intentional: ANSI white on light bg is invisible by design, matching typical light terminal behavior)
  brightBlack: '#64748b',        // slate-500
  brightRed: '#b91c1c',          // red-700
  brightGreen: '#15803d',        // green-700
  brightYellow: '#a16207',       // yellow-700
  brightBlue: '#1d4ed8',         // blue-700
  brightMagenta: '#7c3aed',      // violet-600
  brightCyan: '#0e7490',         // cyan-700
  brightWhite: '#334155',        // slate-700 — readable, not blinding white
}

// ---------------------------------------------------------------------------
// Theme Resolver
// ---------------------------------------------------------------------------

/**
 * Returns the terminal theme for the given mode, with optional accent color
 * overrides for cursor and selection.
 */
export function getTerminalTheme(
  mode: ThemeMode,
  accentColor?: string
): ITheme {
  const base = mode === 'light' ? TERMINAL_THEME_LIGHT : TERMINAL_THEME_DARK
  // Always spread — xterm.js uses reference comparison for theme objects.
  // Returning the constant directly and reassigning it would be a no-op repaint.
  if (!accentColor) return { ...base }
  return {
    ...base,
    cursor: accentColor,
    selectionBackground: `${accentColor}4D`, // 30% opacity
  }
}

// ---------------------------------------------------------------------------
// Focus Escape Tooltip Colors
// ---------------------------------------------------------------------------

/** Tooltip text color for the "Ctrl+` to return to canvas" hint. */
export const TERMINAL_TOOLTIP_COLOR = {
  dark: 'rgba(224, 224, 224, 0.4)',
  light: 'rgba(51, 65, 85, 0.5)',    // slate-700 at 50%
} as const
