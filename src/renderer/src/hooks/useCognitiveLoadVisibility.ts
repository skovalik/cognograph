// useCognitiveLoadVisibility — PFD Phase 6F: Cognitive Load Meter Visibility Rules
//
// Controls when the CognitiveLoadMeter is visible based on zoom level
// and current cognitive load. At overview zoom (ultra-far), it is always
// visible. At working zoom (close, ultra-close), it hides so the user
// can focus on content. At intermediate levels, it appears only when
// cognitive load exceeds a threshold.

import { useMemo } from 'react'
import type { ZoomLevel } from './useSemanticZoom'

// --- Types -----------------------------------------------------------------

export interface CognitiveLoadVisibilityResult {
  /** Whether the cognitive load meter should be displayed */
  isVisible: boolean
  /** Human-readable explanation of the visibility decision */
  reason: string
}

// --- Constants (exported for testing) --------------------------------------

/** Cognitive load threshold for showing the meter at intermediate zoom levels */
export const INTERMEDIATE_LOAD_THRESHOLD = 0.7

// --- Pure function (exported for testing) ----------------------------------

/**
 * Determines whether the cognitive load meter should be visible.
 *
 * Rules:
 * - L0 (ultra-far): ALWAYS visible — user is in overview/navigation mode
 * - L1-L2 (far/mid): Visible only when cognitiveLoad > 0.7 — alert mode
 * - L3-L4 (close/ultra-close): HIDDEN — user is focused on content
 *
 * @param zoomLevel - Current semantic zoom level
 * @param cognitiveLoad - Normalized cognitive load (0.0 to 1.0)
 */
export function computeCognitiveLoadVisibility(
  zoomLevel: ZoomLevel,
  cognitiveLoad: number
): CognitiveLoadVisibilityResult {
  switch (zoomLevel) {
    case 'ultra-far':
      return {
        isVisible: true,
        reason: 'Always visible at overview zoom'
      }

    case 'far':
    case 'mid':
      if (cognitiveLoad > INTERMEDIATE_LOAD_THRESHOLD) {
        return {
          isVisible: true,
          reason: `Cognitive load (${cognitiveLoad.toFixed(2)}) exceeds threshold (${INTERMEDIATE_LOAD_THRESHOLD})`
        }
      }
      return {
        isVisible: false,
        reason: `Cognitive load (${cognitiveLoad.toFixed(2)}) below threshold (${INTERMEDIATE_LOAD_THRESHOLD})`
      }

    case 'close':
    case 'ultra-close':
      return {
        isVisible: false,
        reason: 'Hidden at content-focus zoom levels'
      }

    default: {
      // Exhaustiveness check
      const _exhaustive: never = zoomLevel
      return _exhaustive
    }
  }
}

// --- React Hook ------------------------------------------------------------

/**
 * Hook that computes cognitive load meter visibility based on zoom level
 * and current cognitive load.
 */
export function useCognitiveLoadVisibility(
  zoomLevel: ZoomLevel,
  cognitiveLoad: number
): CognitiveLoadVisibilityResult {
  return useMemo(
    () => computeCognitiveLoadVisibility(zoomLevel, cognitiveLoad),
    [zoomLevel, cognitiveLoad]
  )
}
