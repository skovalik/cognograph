// useCalmMode — PFD Phase 6F: Calm Mode Hook
//
// Provides computed calm mode state and a pure function for adjusting
// zoom levels based on the calm offset. Integrates with the 5-level
// LOD system from useSemanticZoom.

import { useMemo } from 'react'
import type { ZoomLevel } from './useSemanticZoom'
import {
  useCalmModeStore,
  getCalmOffset,
  shouldSuppressAnimations,
  isTextOnlyMode,
  type CalmLevel
} from '../stores/calmModeStore'

// --- Types -----------------------------------------------------------------

export interface CalmModeResult {
  /** Current calm level (0–3) */
  calmLevel: CalmLevel
  /** LOD shift offset (matches calmLevel value) */
  calmOffset: number
  /** True when non-essential animations should be suppressed (level 2+) */
  suppressAnimations: boolean
  /** True when in text-only mode (level 3) */
  textOnlyMode: boolean
}

// --- Ordered zoom levels for shifting -------------------------------------

const ZOOM_LEVEL_ORDER: readonly ZoomLevel[] = [
  'ultra-far',
  'far',
  'mid',
  'close',
  'ultra-close'
] as const

// --- Pure function (exported for testing) ----------------------------------

/**
 * Shifts a base zoom level toward ultra-far by the given calm offset.
 * Cannot go below ultra-far (index 0).
 *
 * Examples:
 * - computeEffectiveZoomWithCalm('close', 1) → 'mid'
 * - computeEffectiveZoomWithCalm('mid', 2) → 'ultra-far'
 * - computeEffectiveZoomWithCalm('far', 3) → 'ultra-far' (capped)
 * - computeEffectiveZoomWithCalm('ultra-close', 0) → 'ultra-close' (no change)
 */
export function computeEffectiveZoomWithCalm(
  baseZoomLevel: ZoomLevel,
  calmOffset: number
): ZoomLevel {
  const currentIndex = ZOOM_LEVEL_ORDER.indexOf(baseZoomLevel)
  if (currentIndex === -1) {
    // Fallback: unknown level, return as-is
    return baseZoomLevel
  }
  const shiftedIndex = Math.max(0, currentIndex - calmOffset)
  return ZOOM_LEVEL_ORDER[shiftedIndex]
}

// --- React Hook ------------------------------------------------------------

/**
 * Returns computed calm mode state derived from the calm mode store.
 * Use this hook in components that need to respond to calm level changes.
 */
export function useCalmMode(): CalmModeResult {
  const calmLevel = useCalmModeStore((state) => state.calmLevel)

  return useMemo(
    () => ({
      calmLevel,
      calmOffset: getCalmOffset(calmLevel),
      suppressAnimations: shouldSuppressAnimations(calmLevel),
      textOnlyMode: isTextOnlyMode(calmLevel)
    }),
    [calmLevel]
  )
}
