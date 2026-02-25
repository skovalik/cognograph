/**
 * useDepthOfField — Hook for depth-of-field visual ring computation (Phase 6A)
 *
 * Returns the CSS class and effective zoom level for a node based on its
 * graph distance from the DoF focus node. DoF can only REDUCE detail
 * (increase the effective LOD level), never increase it.
 *
 * Ring mapping:
 *   Ring 0 (focus):       no change
 *   Ring 1 (1-hop):       1 LOD reduction, slight dimming
 *   Ring 2 (2-hop):       2 LOD reductions, moderate dimming
 *   Ring 3 (3+ hops):     render as ultra-far equivalent, heavy dimming
 *   Disconnected (-1):    render as ultra-far, near-invisible
 */

import { useMemo } from 'react'
import { useContextVisualizationStore, DOF_DISCONNECTED } from '../stores/contextVisualizationStore'
import type { ZoomLevel } from './useSemanticZoom'

// --- Constants (exported for testing) -------------------------------------

/** Ordered zoom levels from most detail to least detail */
export const ZOOM_LEVEL_ORDER: readonly ZoomLevel[] = [
  'ultra-close',
  'close',
  'mid',
  'far',
  'ultra-far'
] as const

/** Maps ring number to the number of LOD levels to reduce */
export const RING_LOD_REDUCTION: Record<number, number> = {
  0: 0,  // focus node — no change
  1: 1,  // 1-hop — one LOD level reduction
  2: 2,  // 2-hop — two LOD level reductions
  3: 4   // 3+ hops — force to ultra-far
}

/** LOD reduction for disconnected nodes */
export const DISCONNECTED_LOD_REDUCTION = 4

/** Maps ring number to CSS class name */
export const RING_CSS_CLASS: Record<number, string> = {
  0: 'dof-ring-0',
  1: 'dof-ring-1',
  2: 'dof-ring-2',
  3: 'dof-ring-3'
}

export const DISCONNECTED_CSS_CLASS = 'dof-out-of-scope'

// --- Pure function (exported for testing) ---------------------------------

/**
 * Computes the effective zoom level after applying DoF ring reduction.
 * effectiveLOD = max(zoomLOD, dofReduction) — DoF can only REDUCE detail.
 *
 * @param currentLevel - The current zoom-based LOD level
 * @param ring - The DoF ring number (0-3 or -1 for disconnected)
 * @returns The effective zoom level after DoF reduction
 */
export function computeEffectiveZoomLevel(currentLevel: ZoomLevel, ring: number): ZoomLevel {
  const currentIndex = ZOOM_LEVEL_ORDER.indexOf(currentLevel)
  const reduction = ring === DOF_DISCONNECTED
    ? DISCONNECTED_LOD_REDUCTION
    : (RING_LOD_REDUCTION[ring] ?? DISCONNECTED_LOD_REDUCTION)

  // Higher index = less detail. DoF can only increase index (reduce detail).
  const effectiveIndex = Math.min(currentIndex + reduction, ZOOM_LEVEL_ORDER.length - 1)
  return ZOOM_LEVEL_ORDER[effectiveIndex]
}

/**
 * Returns the CSS class for a DoF ring number.
 */
export function getDofCssClass(ring: number): string {
  if (ring === DOF_DISCONNECTED) return DISCONNECTED_CSS_CLASS
  return RING_CSS_CLASS[ring] ?? DISCONNECTED_CSS_CLASS
}

// --- React Hook -----------------------------------------------------------

export interface DepthOfFieldResult {
  /** CSS class to apply (e.g., 'dof-ring-1', 'dof-out-of-scope', or '') */
  dofClass: string
  /** The effective zoom level after DoF reduction */
  effectiveZoomLevel: ZoomLevel
}

/**
 * Returns the depth-of-field CSS class and effective zoom level for a node.
 *
 * @param nodeId - The ID of the node to compute DoF for
 * @param currentZoomLevel - The current zoom-based LOD level
 * @returns Object with dofClass and effectiveZoomLevel
 */
export function useDepthOfField(nodeId: string, currentZoomLevel: ZoomLevel): DepthOfFieldResult {
  const dofEnabled = useContextVisualizationStore((s) => s.dofEnabled)
  const dofFocusNodeId = useContextVisualizationStore((s) => s.dofFocusNodeId)
  const ring = useContextVisualizationStore((s) => s.dofRings.get(nodeId) ?? DOF_DISCONNECTED)

  return useMemo(() => {
    // If DoF is not active, return no modification
    if (!dofEnabled || !dofFocusNodeId) {
      return {
        dofClass: '',
        effectiveZoomLevel: currentZoomLevel
      }
    }

    return {
      dofClass: getDofCssClass(ring),
      effectiveZoomLevel: computeEffectiveZoomLevel(currentZoomLevel, ring)
    }
  }, [dofEnabled, dofFocusNodeId, ring, currentZoomLevel])
}
