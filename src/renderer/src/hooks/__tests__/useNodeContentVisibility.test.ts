// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useNodeContentVisibility -- Tests for Phase 2 LOD extensions
 *
 * Tests the new fields added to NodeContentVisibility:
 * - showEditor: whether rich editors (TipTap/CodeMirror) should mount
 * - showPlaceholders: whether shimmer placeholder bars should render
 * - lodLevel: numeric LOD level (0-4)
 *
 * Also tests that existing fields remain backward-compatible.
 * Pure function tests (no React hooks required).
 */

import { describe, expect, it } from 'vitest'
import {
  computeNodeContentVisibility,
  computeZoomLevel,
  HYSTERESIS,
  HYSTERESIS_WIDE,
  type NodeContentVisibility,
  THRESHOLDS,
  ZOOM_LEVEL_TO_LOD,
  type ZoomLevel,
} from '../useNodeContentVisibility'

// --- Helper: simulate a zoom sweep ----------------------------------------
function sweepZoom(zoomValues: number[], startLevel: ZoomLevel = 'close'): ZoomLevel {
  let level = startLevel
  for (const z of zoomValues) {
    level = computeZoomLevel(z, level)
  }
  return level
}

// --- 1. lodLevel numeric mapping ------------------------------------------
describe('lodLevel -- numeric LOD mapping', () => {
  it('returns lodLevel=0 at ultra-far', () => {
    const vis = computeNodeContentVisibility('ultra-far')
    expect(vis.lodLevel).toBe(0)
  })

  it('returns lodLevel=1 at far', () => {
    const vis = computeNodeContentVisibility('far')
    expect(vis.lodLevel).toBe(1)
  })

  it('returns lodLevel=2 at mid', () => {
    const vis = computeNodeContentVisibility('mid')
    expect(vis.lodLevel).toBe(2)
  })

  it('returns lodLevel=3 at close', () => {
    const vis = computeNodeContentVisibility('close')
    expect(vis.lodLevel).toBe(3)
  })

  it('returns lodLevel=4 at ultra-close', () => {
    const vis = computeNodeContentVisibility('ultra-close')
    expect(vis.lodLevel).toBe(4)
  })

  it('ZOOM_LEVEL_TO_LOD maps all 5 levels correctly', () => {
    expect(ZOOM_LEVEL_TO_LOD['ultra-far']).toBe(0)
    expect(ZOOM_LEVEL_TO_LOD['far']).toBe(1)
    expect(ZOOM_LEVEL_TO_LOD['mid']).toBe(2)
    expect(ZOOM_LEVEL_TO_LOD['close']).toBe(3)
    expect(ZOOM_LEVEL_TO_LOD['ultra-close']).toBe(4)
  })

  it('lodLevel increases monotonically with zoom level', () => {
    const levels: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']
    const lodValues = levels.map((l) => computeNodeContentVisibility(l).lodLevel)
    for (let i = 1; i < lodValues.length; i++) {
      expect(lodValues[i]).toBeGreaterThan(lodValues[i - 1])
    }
  })
})

// --- 2. showEditor -- only at close and ultra-close -----------------------
describe('showEditor -- rich editor mounting', () => {
  it('showEditor=false at ultra-far (L0)', () => {
    expect(computeNodeContentVisibility('ultra-far').showEditor).toBe(false)
  })

  it('showEditor=false at far (L1)', () => {
    expect(computeNodeContentVisibility('far').showEditor).toBe(false)
  })

  it('showEditor=false at mid (L2)', () => {
    expect(computeNodeContentVisibility('mid').showEditor).toBe(false)
  })

  it('showEditor=true at close (L3)', () => {
    expect(computeNodeContentVisibility('close').showEditor).toBe(true)
  })

  it('showEditor=true at ultra-close (L4)', () => {
    expect(computeNodeContentVisibility('ultra-close').showEditor).toBe(true)
  })

  it('showEditor matches showContent at all levels', () => {
    // Editor should mount exactly when content is visible
    const levels: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']
    for (const level of levels) {
      const vis = computeNodeContentVisibility(level)
      expect(vis.showEditor).toBe(vis.showContent)
    }
  })
})

// --- 3. showPlaceholders -- only at far (L1) ------------------------------
describe('showPlaceholders -- shimmer placeholder bars', () => {
  it('showPlaceholders=false at ultra-far (L0) -- too far for even placeholders', () => {
    expect(computeNodeContentVisibility('ultra-far').showPlaceholders).toBe(false)
  })

  it('showPlaceholders=true at far (L1) -- title visible but content replaced by shimmers', () => {
    expect(computeNodeContentVisibility('far').showPlaceholders).toBe(true)
  })

  it('showPlaceholders=false at mid (L2) -- real lede/badges visible', () => {
    expect(computeNodeContentVisibility('mid').showPlaceholders).toBe(false)
  })

  it('showPlaceholders=false at close (L3) -- full content visible', () => {
    expect(computeNodeContentVisibility('close').showPlaceholders).toBe(false)
  })

  it('showPlaceholders=false at ultra-close (L4) -- full content visible', () => {
    expect(computeNodeContentVisibility('ultra-close').showPlaceholders).toBe(false)
  })

  it('showPlaceholders and showContent are mutually exclusive', () => {
    const levels: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']
    for (const level of levels) {
      const vis = computeNodeContentVisibility(level)
      // They should never both be true
      expect(vis.showPlaceholders && vis.showContent).toBe(false)
    }
  })
})

// --- 4. Backward compatibility -- existing fields unchanged ---------------
describe('backward compatibility -- existing fields preserved', () => {
  it('ultra-far: all original fields unchanged', () => {
    const vis = computeNodeContentVisibility('ultra-far')
    expect(vis.showContent).toBe(false)
    expect(vis.showTitle).toBe(false)
    expect(vis.showBadges).toBe(false)
    expect(vis.showLede).toBe(false)
    expect(vis.zoomLevel).toBe('ultra-far')
    expect(vis.showClusterSummary).toBe(true)
    expect(vis.showEmbeddedContent).toBe(false)
    expect(vis.showExpandedToolbar).toBe(false)
    expect(vis.showInteractiveControls).toBe(false)
    expect(vis.showFooter).toBe(false)
    expect(vis.showHeader).toBe(false)
    expect(vis.effectiveLevel).toBe('ultra-far')
  })

  it('far: all original fields unchanged', () => {
    const vis = computeNodeContentVisibility('far')
    expect(vis.showContent).toBe(false)
    expect(vis.showTitle).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(false)
    expect(vis.zoomLevel).toBe('far')
    expect(vis.showClusterSummary).toBe(false)
    expect(vis.showHeader).toBe(true)
  })

  it('mid: all original fields unchanged', () => {
    const vis = computeNodeContentVisibility('mid')
    expect(vis.showContent).toBe(false)
    expect(vis.showTitle).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(true)
    expect(vis.zoomLevel).toBe('mid')
    expect(vis.showFooter).toBe(true)
    expect(vis.showHeader).toBe(true)
  })

  it('close: all original fields unchanged', () => {
    const vis = computeNodeContentVisibility('close')
    expect(vis.showContent).toBe(true)
    expect(vis.showTitle).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(false)
    expect(vis.zoomLevel).toBe('close')
    expect(vis.showEmbeddedContent).toBe(true)
    expect(vis.showInteractiveControls).toBe(true)
    expect(vis.showFooter).toBe(true)
    expect(vis.showHeader).toBe(true)
  })

  it('ultra-close: all original fields unchanged', () => {
    const vis = computeNodeContentVisibility('ultra-close')
    expect(vis.showContent).toBe(true)
    expect(vis.showTitle).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(false)
    expect(vis.zoomLevel).toBe('ultra-close')
    expect(vis.showExpandedToolbar).toBe(true)
    expect(vis.showEmbeddedContent).toBe(true)
    expect(vis.showInteractiveControls).toBe(true)
    expect(vis.showFooter).toBe(true)
    expect(vis.showHeader).toBe(true)
  })
})

// --- 5. Hysteresis: new fields remain stable at boundaries ----------------
describe('hysteresis -- new fields stable at boundaries', () => {
  it('lodLevel stays at 2 (mid) when oscillating around mid/close boundary', () => {
    // Start at mid, oscillate around 0.12
    const values = [0.13, 0.11, 0.13, 0.11, 0.13]
    const finalLevel = sweepZoom(values, 'mid')
    expect(finalLevel).toBe('mid')
    expect(computeNodeContentVisibility(finalLevel).lodLevel).toBe(2)
    expect(computeNodeContentVisibility(finalLevel).showEditor).toBe(false)
  })

  it('lodLevel stays at 3 (close) when oscillating around close/ultra-close boundary', () => {
    // Start at close, oscillate around 1.0
    const values = [1.01, 0.99, 1.01, 0.99]
    const finalLevel = sweepZoom(values, 'close')
    expect(finalLevel).toBe('close')
    expect(computeNodeContentVisibility(finalLevel).lodLevel).toBe(3)
    expect(computeNodeContentVisibility(finalLevel).showEditor).toBe(true)
    expect(computeNodeContentVisibility(finalLevel).showExpandedToolbar).toBe(false)
  })

  it('showPlaceholders stays true when oscillating around far/mid boundary from far', () => {
    // Start at far, oscillate around 0.08
    const values = [0.09, 0.07, 0.09, 0.07]
    const finalLevel = sweepZoom(values, 'far')
    expect(finalLevel).toBe('far')
    expect(computeNodeContentVisibility(finalLevel).showPlaceholders).toBe(true)
  })

  it('showPlaceholders transitions to false when moving clearly into mid', () => {
    // Start at far, move well past threshold+hysteresis into mid
    const finalLevel = computeZoomLevel(0.11, 'far')
    expect(finalLevel).toBe('mid')
    expect(computeNodeContentVisibility(finalLevel).showPlaceholders).toBe(false)
    expect(computeNodeContentVisibility(finalLevel).showLede).toBe(true)
  })

  it('showEditor transitions from false to true when crossing into close', () => {
    // Start at mid (showEditor=false), cross into close
    const finalLevel = computeZoomLevel(0.15, 'mid')
    expect(finalLevel).toBe('close')
    expect(computeNodeContentVisibility(finalLevel).showEditor).toBe(true)
    expect(computeNodeContentVisibility(finalLevel).lodLevel).toBe(3)
  })
})

// --- 6. Exhaustiveness: all levels produce all new fields -----------------
describe('exhaustiveness -- new fields defined at all levels', () => {
  const ALL_LEVELS: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']

  ALL_LEVELS.forEach((level) => {
    it(`"${level}" produces showEditor, showPlaceholders, and lodLevel`, () => {
      const vis = computeNodeContentVisibility(level)
      expect(typeof vis.showEditor).toBe('boolean')
      expect(typeof vis.showPlaceholders).toBe('boolean')
      expect(typeof vis.lodLevel).toBe('number')
      expect(vis.lodLevel).toBeGreaterThanOrEqual(0)
      expect(vis.lodLevel).toBeLessThanOrEqual(4)
    })
  })
})

// --- 7. LOD level progression matches zoom thresholds ---------------------
describe('lodLevel via zoom thresholds', () => {
  it('zoom 0.02 from ultra-far -> lodLevel 0', () => {
    const level = computeZoomLevel(0.02, 'ultra-far')
    expect(computeNodeContentVisibility(level).lodLevel).toBe(0)
  })

  it('zoom 0.08 from ultra-far -> lodLevel 1 (far)', () => {
    const level = computeZoomLevel(0.08, 'ultra-far')
    expect(computeNodeContentVisibility(level).lodLevel).toBe(1)
  })

  it('zoom 0.11 from far -> lodLevel 2 (mid)', () => {
    const level = computeZoomLevel(0.11, 'far')
    expect(computeNodeContentVisibility(level).lodLevel).toBe(2)
  })

  it('zoom 0.15 from mid -> lodLevel 3 (close)', () => {
    const level = computeZoomLevel(0.15, 'mid')
    expect(computeNodeContentVisibility(level).lodLevel).toBe(3)
  })

  it('zoom 1.04 from close -> lodLevel 4 (ultra-close)', () => {
    const level = computeZoomLevel(1.04, 'close')
    expect(computeNodeContentVisibility(level).lodLevel).toBe(4)
  })
})

// --- 8. Full LOD sweep: all new fields through a complete zoom-in ---------
describe('full zoom-in sweep -- new fields progression', () => {
  it('sweeps through all 5 levels with correct new field values', () => {
    // Simulate zooming in from far out
    let level: ZoomLevel = 'ultra-far'

    // L0: ultra-far
    let vis = computeNodeContentVisibility(level)
    expect(vis.lodLevel).toBe(0)
    expect(vis.showEditor).toBe(false)
    expect(vis.showPlaceholders).toBe(false)

    // Zoom in to far
    level = computeZoomLevel(0.08, level)
    vis = computeNodeContentVisibility(level)
    expect(vis.lodLevel).toBe(1)
    expect(vis.showEditor).toBe(false)
    expect(vis.showPlaceholders).toBe(true) // placeholders appear at L1

    // Zoom in to mid
    level = computeZoomLevel(0.11, level)
    vis = computeNodeContentVisibility(level)
    expect(vis.lodLevel).toBe(2)
    expect(vis.showEditor).toBe(false)
    expect(vis.showPlaceholders).toBe(false) // real content replaces placeholders

    // Zoom in to close
    level = computeZoomLevel(0.15, level)
    vis = computeNodeContentVisibility(level)
    expect(vis.lodLevel).toBe(3)
    expect(vis.showEditor).toBe(true) // editor mounts at L3
    expect(vis.showPlaceholders).toBe(false)

    // Zoom in to ultra-close
    level = computeZoomLevel(1.04, level)
    vis = computeNodeContentVisibility(level)
    expect(vis.lodLevel).toBe(4)
    expect(vis.showEditor).toBe(true) // editor stays mounted
    expect(vis.showPlaceholders).toBe(false)
    expect(vis.showExpandedToolbar).toBe(true) // toolbar appears at L4
  })
})
