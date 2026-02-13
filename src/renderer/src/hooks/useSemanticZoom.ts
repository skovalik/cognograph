/**
 * useSemanticZoom - Hook for zoom-aware content rendering
 *
 * ND-friendly feature: At far zoom, users see spatial layout without
 * being distracted by content. Content progressively reveals as they zoom in.
 *
 * Zoom levels:
 * - 'far' (< 0.25): Only shapes/colors visible, supports "knowing WHERE"
 * - 'mid' (0.25-0.5): Titles and badges visible, can identify specific nodes
 * - 'close' (> 0.5): Full content visible, can read and edit
 */

import { useMemo } from 'react'
import { useStore } from '@xyflow/react'

export type ZoomLevel = 'far' | 'mid' | 'close'

// Zoom thresholds - tuned for earlier text visibility
// Far: shapes only, Mid: titles/previews, Close: full content
const FAR_ZOOM_THRESHOLD = 0.25
const MID_ZOOM_THRESHOLD = 0.5

/**
 * Returns the current semantic zoom level based on viewport zoom
 */
export function useSemanticZoom(): ZoomLevel {
  const zoom = useStore((state) => state.transform[2])

  return useMemo(() => {
    if (zoom < FAR_ZOOM_THRESHOLD) return 'far'
    if (zoom < MID_ZOOM_THRESHOLD) return 'mid'
    return 'close'
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
 * Returns visibility flags for node content based on zoom
 */
export function useNodeContentVisibility(): {
  showContent: boolean
  showTitle: boolean
  showBadges: boolean
  zoomLevel: ZoomLevel
} {
  const level = useSemanticZoom()

  return useMemo(() => ({
    showContent: level === 'close',
    showTitle: level !== 'far',
    showBadges: level !== 'far',
    zoomLevel: level
  }), [level])
}
