// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useSemanticZoom - Hook for zoom-aware content rendering (5-level LOD system)
 *
 * ND-friendly feature: At far zoom, users see spatial layout without
 * being distracted by content. Content progressively reveals as they zoom in.
 *
 * 5 Zoom levels (Phase 1A):
 * - 'ultra-far' (< 0.05): Cluster/region shapes only, supports "knowing WHERE"
 * - 'far' (0.05-0.08): Titles and badges visible, can identify specific nodes
 * - 'mid' (0.08-0.12): Titles + lede + badges, summary card mode
 * - 'close' (0.12-1.0): Full content visible, can read and edit (iframe at ~15%)
 * - 'ultra-close' (>= 1.0): Full content + expanded toolbar + interactive controls
 *
 * Hysteresis prevents "threshold jitter" -- nodes flickering between LOD states
 * during zoom navigation. Standard cartographic practice (Weibel & Dutton, 1999).
 * Wider hysteresis (0.03) at close/ultra-close boundary since users frequently
 * rest at 100% zoom.
 */

import { useStore } from '@xyflow/react'
import { useMemo, useRef } from 'react'

// --- Types ----------------------------------------------------------------

export type ZoomLevel = 'ultra-far' | 'far' | 'mid' | 'close' | 'ultra-close'

export interface NodeContentVisibility {
  // Existing fields (backward compatible)
  showContent: boolean
  showTitle: boolean
  showBadges: boolean
  showLede: boolean
  zoomLevel: ZoomLevel

  // New fields (Phase 1A)
  showClusterSummary: boolean
  showEmbeddedContent: boolean
  showExpandedToolbar: boolean
  showInteractiveControls: boolean
  showFooter: boolean
  showHeader: boolean
  effectiveLevel: ZoomLevel

  // Phase 2 fields (LOD universalization)
  /** Whether the rich editor (TipTap/CodeMirror) should mount — close and ultra-close only */
  showEditor: boolean
  /** Whether placeholder shimmer bars should render (title/content stand-ins at far zoom) */
  showPlaceholders: boolean
  /** Numeric LOD level: 0=ultra-far, 1=far, 2=mid, 3=close, 4=ultra-close */
  lodLevel: 0 | 1 | 2 | 3 | 4
}

// --- Constants (exported for testing) -------------------------------------

/** Boundary thresholds between zoom levels */
export const THRESHOLDS = {
  ULTRA_FAR_FAR: 0.05,
  FAR_MID: 0.08,
  MID_CLOSE: 0.12,
  CLOSE_ULTRA_CLOSE: 1.0,
} as const

/** Maps ZoomLevel to numeric LOD level (0-4) */
export const ZOOM_LEVEL_TO_LOD: Record<ZoomLevel, 0 | 1 | 2 | 3 | 4> = {
  'ultra-far': 0,
  far: 1,
  mid: 2,
  close: 3,
  'ultra-close': 4,
} as const

/** Standard hysteresis offset for most boundaries */
export const HYSTERESIS = 0.02

/** Wider hysteresis at close/ultra-close boundary (users rest at 100% zoom) */
export const HYSTERESIS_WIDE = 0.03

// --- Pure functions (testable without React) ------------------------------

/**
 * Computes the next zoom level given a zoom value and the previous level.
 * Uses directional hysteresis to prevent jitter at boundaries.
 *
 * This is the pure-logic core of useSemanticZoom. Extracted so it can be
 * unit-tested without React hooks.
 */
export function computeZoomLevel(zoom: number, prev: ZoomLevel): ZoomLevel {
  const { ULTRA_FAR_FAR, FAR_MID, MID_CLOSE, CLOSE_ULTRA_CLOSE } = THRESHOLDS
  const H = HYSTERESIS
  const HW = HYSTERESIS_WIDE

  switch (prev) {
    case 'ultra-far': {
      if (zoom > CLOSE_ULTRA_CLOSE + HW) return 'ultra-close'
      if (zoom > MID_CLOSE + H) return 'close'
      if (zoom > FAR_MID + H) return 'mid'
      if (zoom > ULTRA_FAR_FAR + H) return 'far'
      return 'ultra-far'
    }
    case 'far': {
      if (zoom < ULTRA_FAR_FAR - H) return 'ultra-far'
      if (zoom > CLOSE_ULTRA_CLOSE + HW) return 'ultra-close'
      if (zoom > MID_CLOSE + H) return 'close'
      if (zoom > FAR_MID + H) return 'mid'
      return 'far'
    }
    case 'mid': {
      if (zoom < ULTRA_FAR_FAR - H) return 'ultra-far'
      if (zoom < FAR_MID - H) return 'far'
      if (zoom > CLOSE_ULTRA_CLOSE + HW) return 'ultra-close'
      if (zoom > MID_CLOSE + H) return 'close'
      return 'mid'
    }
    case 'close': {
      if (zoom < ULTRA_FAR_FAR - H) return 'ultra-far'
      if (zoom < FAR_MID - H) return 'far'
      if (zoom < MID_CLOSE - H) return 'mid'
      if (zoom > CLOSE_ULTRA_CLOSE + HW) return 'ultra-close'
      return 'close'
    }
    case 'ultra-close': {
      if (zoom < ULTRA_FAR_FAR - H) return 'ultra-far'
      if (zoom < FAR_MID - H) return 'far'
      if (zoom < MID_CLOSE - H) return 'mid'
      if (zoom < CLOSE_ULTRA_CLOSE - HW) return 'close'
      return 'ultra-close'
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = prev
      return _exhaustive
    }
  }
}

/**
 * Computes node content visibility flags for a given zoom level.
 * Pure function -- no React dependency. Extracted for testing.
 *
 * Visibility matrix (Phase 2 — LOD universalization):
 *
 * | Flag                   | ultra-far | far   | mid   | close | ultra-close |
 * |------------------------|-----------|-------|-------|-------|-------------|
 * | lodLevel               |     0     |   1   |   2   |   3   |      4      |
 * | showClusterSummary     |     T     |   F   |   F   |   F   |      F      |
 * | showPlaceholders       |     F     |   T   |   F   |   F   |      F      |
 * | showHeader             |     F     |   T   |   T   |   T   |      T      |
 * | showTitle              |     F     |   T   |   T   |   T   |      T      |
 * | showBadges             |     F     |   T   |   T   |   T   |      T      |
 * | showLede               |     F     |   F   |   T   |   F   |      F      |
 * | showFooter             |     F     |   F   |   T   |   T   |      T      |
 * | showContent            |     F     |   F   |   F   |   T   |      T      |
 * | showEmbeddedContent    |     F     |   F   |   F   |   T   |      T      |
 * | showEditor             |     F     |   F   |   F   |   T   |      T      |
 * | showInteractiveControls|     F     |   F   |   F   |   T   |      T      |
 * | showExpandedToolbar    |     F     |   F   |   F   |   F   |      T      |
 * | effectiveLevel         | =zoomLvl  |   =   |   =   |   =   |      =      |
 */
export function computeNodeContentVisibility(level: ZoomLevel): NodeContentVisibility {
  const lodLevel = ZOOM_LEVEL_TO_LOD[level]

  switch (level) {
    case 'ultra-far':
      return {
        showContent: false,
        showTitle: false,
        showBadges: false,
        showLede: false,
        zoomLevel: level,
        showClusterSummary: true,
        showEmbeddedContent: false,
        showExpandedToolbar: false,
        showInteractiveControls: false,
        showFooter: false,
        showHeader: false,
        effectiveLevel: level,
        showEditor: false,
        showPlaceholders: false,
        lodLevel,
      }
    case 'far':
      return {
        showContent: false,
        showTitle: true,
        showBadges: true,
        showLede: false,
        zoomLevel: level,
        showClusterSummary: false,
        showEmbeddedContent: false,
        showExpandedToolbar: false,
        showInteractiveControls: false,
        showFooter: false,
        showHeader: true,
        effectiveLevel: level,
        showEditor: false,
        showPlaceholders: true,
        lodLevel,
      }
    case 'mid':
      return {
        showContent: false,
        showTitle: true,
        showBadges: true,
        showLede: true,
        zoomLevel: level,
        showClusterSummary: false,
        showEmbeddedContent: false,
        showExpandedToolbar: false,
        showInteractiveControls: false,
        showFooter: true,
        showHeader: true,
        effectiveLevel: level,
        showEditor: false,
        showPlaceholders: false,
        lodLevel,
      }
    case 'close':
      return {
        showContent: true,
        showTitle: true,
        showBadges: true,
        showLede: false,
        zoomLevel: level,
        showClusterSummary: false,
        showEmbeddedContent: true,
        showExpandedToolbar: false,
        showInteractiveControls: true,
        showFooter: true,
        showHeader: true,
        effectiveLevel: level,
        showEditor: true,
        showPlaceholders: false,
        lodLevel,
      }
    case 'ultra-close':
      return {
        showContent: true,
        showTitle: true,
        showBadges: true,
        showLede: false,
        zoomLevel: level,
        showClusterSummary: false,
        showEmbeddedContent: true,
        showExpandedToolbar: true,
        showInteractiveControls: true,
        showFooter: true,
        showHeader: true,
        effectiveLevel: level,
        showEditor: true,
        showPlaceholders: false,
        lodLevel,
      }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}

// --- React Hooks ----------------------------------------------------------

/**
 * Returns the current semantic zoom level based on viewport zoom.
 * Uses hysteresis to prevent flickering at threshold boundaries.
 */
export function useSemanticZoom(): ZoomLevel {
  const zoom = useStore((state) => state.transform[2])
  const prevLevelRef = useRef<ZoomLevel>('close')

  return useMemo(() => {
    const next = computeZoomLevel(zoom, prevLevelRef.current)
    prevLevelRef.current = next
    return next
  }, [zoom])
}

/**
 * Returns the current numeric zoom value
 */
export function useZoomValue(): number {
  return useStore((state) => state.transform[2])
}

/**
 * Returns CSS class for current zoom level
 * Add to .react-flow container or use in node components
 */
export function useSemanticZoomClass(): string {
  const level = useSemanticZoom()
  return `semantic-zoom-${level}`
}

/**
 * Returns visibility flags for node content based on zoom.
 * Nodes use these flags to implement true LOD rendering -- different
 * DOM content at each zoom level, not just opacity changes.
 */
export function useNodeContentVisibility(): NodeContentVisibility {
  const level = useSemanticZoom()

  return useMemo(() => computeNodeContentVisibility(level), [level])
}
