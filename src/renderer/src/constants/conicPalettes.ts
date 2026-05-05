// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { useShallow } from 'zustand/react/shallow'
import { useWorkspaceStore } from '../stores/workspaceStore'

type ConicPalette = [string, string, string, string]

/**
 * Fallback palette used when the active theme does not provide a 4-color
 * `toolbarIconAccent` array. Gold quartet — matches the historical default.
 */
export const FALLBACK_CONIC_PALETTE: ConicPalette = ['#C8963E', '#E5B95C', '#d4a056', '#b8860b']

/**
 * Theme-driven conic palette for the thinking ring (conic-thinking.css).
 *
 * Reads `themeSettings.guiColors.toolbarIconAccent` from the workspace store
 * and returns a 4-color tuple suitable for `--conic-color-1..4` CSS vars.
 * Unified across all node types — node-type semantic differentiation is
 * intentionally dropped in favor of global theme cohesion (plan F3).
 *
 * Recomputes when the accent array reference changes; shallow equality keeps
 * the subscription cheap across unrelated theme updates.
 */
export function useConicPalette(): ConicPalette {
  return useWorkspaceStore(
    useShallow((s): ConicPalette => {
      const accents = s.themeSettings.guiColors?.toolbarIconAccent
      if (accents && accents.length >= 4) {
        return [accents[0], accents[1], accents[2], accents[3]]
      }
      return FALLBACK_CONIC_PALETTE
    }),
  )
}

/**
 * Legacy per-node-type palettes. Kept temporarily for any caller that has
 * not migrated to `useConicPalette`; all shipped callers SHOULD migrate.
 * @deprecated Use `useConicPalette()` — the global theme drives this now.
 */
export const CONIC_PALETTES: Record<string, ConicPalette> = {
  conversation: ['#3b82f6', '#6366f1', '#a78bfa', '#e879f9'],
  note: ['#f59e0b', '#fbbf24', '#f97316', '#fb7185'],
  task: ['#6B9E84', '#34d399', '#2dd4bf', '#38bdf8'],
  artifact: ['#5A8EAB', '#38bdf8', '#818cf8', '#c084fc'],
  project: ['#7C7CAB', '#8b5cf6', '#a78bfa', '#c084fc'],
  action: ['#C4845A', '#f97316', '#fb923c', '#fbbf24'],
  orchestrator: ['#a855f7', '#c084fc', '#e879f9', '#f472b6'],
  default: FALLBACK_CONIC_PALETTE,
}
