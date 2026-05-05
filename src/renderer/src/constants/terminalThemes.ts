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
 *
 * Preset-driven "chrome" colors: When a `guiColors` object is supplied to
 * `getTerminalTheme`, the bg / fg / cursor / selection and the non-ANSI white
 * shades track the active preset (sunset → warm browns; forest → green; etc.).
 * ANSI 0-15 syntax colors stay fixed so program output (Claude Code, grep, ls)
 * remains readable across all presets.
 */

import type { GuiColors, ThemeMode } from '@shared/types'
import type { ITheme } from '@xterm/xterm'

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
  background: '#f1f5f9', // slate-100 — matches --terminal-bg light
  foreground: '#334155', // slate-700 — matches --terminal-text light
  cursor: '#6d28d9', // violet-700 — darker cursor for light bg
  cursorAccent: '#f1f5f9', // matches background
  selectionBackground: 'rgba(109, 40, 217, 0.2)',
  selectionForeground: undefined,
  black: '#1e293b', // slate-800 — visible on light bg
  red: '#dc2626', // red-600
  green: '#16a34a', // green-600
  yellow: '#ca8a04', // yellow-600 — darkened for light bg readability
  blue: '#2563eb', // blue-600
  magenta: '#9333ea', // purple-600
  cyan: '#0891b2', // cyan-600
  white: '#f1f5f9', // slate-100 — same as background (intentional: ANSI white on light bg is invisible by design, matching typical light terminal behavior)
  brightBlack: '#64748b', // slate-500
  brightRed: '#b91c1c', // red-700
  brightGreen: '#15803d', // green-700
  brightYellow: '#a16207', // yellow-700
  brightBlue: '#1d4ed8', // blue-700
  brightMagenta: '#7c3aed', // violet-600
  brightCyan: '#0e7490', // cyan-700
  brightWhite: '#334155', // slate-700 — readable, not blinding white
}

// ---------------------------------------------------------------------------
// Theme Resolver
// ---------------------------------------------------------------------------

/**
 * Returns the terminal theme for the given mode, optionally tinted by the
 * active preset's `guiColors`. When `guiColors` is present:
 *   - Chrome (bg / fg / cursor / selection / whites / black) tracks the preset
 *   - yellow + brightYellow + magenta + brightMagenta are remapped from the
 *     preset's `toolbarIconAccent[0..3]` quartet (the same 4 colors that drive
 *     the conic thinking ring), so Claude Code's yellow robot banner, yarn/
 *     ora warnings, and other ANSI-33/35 output take on the preset's palette
 *   - red / green / blue / cyan + bright variants stay fixed for semantics
 *     (error-red, success-green, info-blue)
 *
 * `accentColor` overrides `guiColors.accentPrimary` for the cursor when it's
 * a valid hex/rgb string. Legacy callers pass `'var(--accent-glow)'` — we
 * detect + skip that (xterm can't parse CSS variables) and fall back to the
 * preset's accentPrimary hex instead.
 */

const HEX_OR_RGB = /^(#[0-9a-f]{3,8}|rgba?\()/i
const isValidColor = (c: string | undefined): c is string => !!c && HEX_OR_RGB.test(c)

export function getTerminalTheme(
  mode: ThemeMode,
  accentColor?: string,
  guiColors?: GuiColors,
): ITheme {
  const base = mode === 'light' ? TERMINAL_THEME_LIGHT : TERMINAL_THEME_DARK

  // Always spread — xterm.js uses reference comparison for theme objects.
  const result: ITheme = { ...base }

  if (guiColors) {
    const bg = guiColors.panelBackground
    const fg = guiColors.textPrimary
    // Prefer explicit accentColor prop, but only if valid hex/rgb. Otherwise
    // (e.g. pre-existing `'var(--accent-glow)'` on legacy terminal nodes) fall
    // back to the preset's accentPrimary — always a hex.
    const accent = isValidColor(accentColor) ? accentColor : guiColors.accentPrimary
    result.background = bg
    result.foreground = fg
    result.cursor = accent
    result.cursorAccent = bg
    result.selectionBackground = `${guiColors.accentSecondary || accent}4D` // 30%
    // Keep ANSI white readable on the preset background: brightWhite = fg,
    // white = textSecondary (muted but visible).
    result.brightWhite = fg
    result.white = guiColors.textSecondary || fg
    // Black matches bg to avoid literal black text on warm backgrounds.
    result.black = bg

    // Option C preset cohesion: ANSI yellow+magenta pair remap to the preset's
    // 4-color accent quartet. Red/green/blue stay semantic.
    const quartet = guiColors.toolbarIconAccent
    if (quartet && quartet.length >= 4) {
      result.yellow = quartet[0]
      result.brightYellow = quartet[1]
      result.magenta = quartet[2]
      result.brightMagenta = quartet[3]
    }
    return result
  }

  // Fallback path (no guiColors): validate accentColor before applying so we
  // don't leak a CSS-var string into xterm's color parser.
  if (isValidColor(accentColor)) {
    result.cursor = accentColor
    result.selectionBackground = `${accentColor}4D`
  }
  return result
}

// ---------------------------------------------------------------------------
// Focus Escape Tooltip Colors
// ---------------------------------------------------------------------------

/** Tooltip text color for the "Ctrl+` to return to canvas" hint. */
export const TERMINAL_TOOLTIP_COLOR = {
  dark: 'rgba(224, 224, 224, 0.4)',
  light: 'rgba(51, 65, 85, 0.5)', // slate-700 at 50%
} as const
