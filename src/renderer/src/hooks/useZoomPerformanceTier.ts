// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Zoom Performance Tier — pure function for proactive effect throttling.
 *
 * NOT a React hook. Called from onViewportChange in App.tsx to compute
 * the current performance tier based on zoom level with hysteresis
 * to prevent jitter at boundaries.
 */

export type ZoomPerfTier = 'full' | 'reduced' | 'minimal'

// Hysteresis thresholds to prevent jitter at boundaries
const THRESHOLDS = {
  // Zoom OUT past these -> enter tier
  // Raised from 0.34/0.14 — lag starts at 50% with many nodes on canvas
  enter: { reduced: 0.55, minimal: 0.2 },
  // Zoom IN past these -> leave tier
  leave: { reduced: 0.6, minimal: 0.25 },
}

/**
 * Pure function — compute zoom performance tier with hysteresis.
 * Called from onViewportChange in App.tsx.
 */
export function computeZoomPerfTier(currentZoom: number, prevTier: ZoomPerfTier): ZoomPerfTier {
  if (prevTier === 'minimal') {
    if (currentZoom > THRESHOLDS.leave.minimal) {
      return currentZoom > THRESHOLDS.leave.reduced ? 'full' : 'reduced'
    }
    return 'minimal'
  }
  if (prevTier === 'reduced') {
    if (currentZoom > THRESHOLDS.leave.reduced) return 'full'
    if (currentZoom < THRESHOLDS.enter.minimal) return 'minimal'
    return 'reduced'
  }
  // prevTier === 'full'
  if (currentZoom < THRESHOLDS.enter.minimal) return 'minimal'
  if (currentZoom < THRESHOLDS.enter.reduced) return 'reduced'
  return 'full'
}
