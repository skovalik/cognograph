// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useNodeContentVisibility — Re-export barrel for the LOD visibility hook
 *
 * The canonical implementation lives in useSemanticZoom.ts alongside the
 * zoom-level computation logic it depends on. This module re-exports the
 * hook and its supporting types/functions so consumers can import from
 * either location:
 *
 *   import { useNodeContentVisibility } from '../hooks/useNodeContentVisibility'
 *   // or
 *   import { useNodeContentVisibility } from '../hooks/useSemanticZoom'
 *
 * Both resolve to the same implementation.
 */

export {
  // Pure functions (for testing)
  computeNodeContentVisibility,
  computeZoomLevel,
  HYSTERESIS,
  HYSTERESIS_WIDE,
  // Types
  type NodeContentVisibility,
  // Constants (for testing)
  THRESHOLDS,
  // Hook
  useNodeContentVisibility,
  ZOOM_LEVEL_TO_LOD,
  type ZoomLevel,
} from './useSemanticZoom'
