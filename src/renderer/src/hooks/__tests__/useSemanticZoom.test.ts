/**
 * useSemanticZoom -- Pure logic tests for 5-level zoom system
 *
 * Tests the extracted pure functions (computeZoomLevel, computeNodeContentVisibility)
 * which are the logic core of the useSemanticZoom/useNodeContentVisibility hooks.
 *
 * Phase 1A: Extend ZoomLevel to 5 levels with directional hysteresis.
 */

import { describe, it, expect } from 'vitest'
import {
  computeZoomLevel,
  computeNodeContentVisibility,
  THRESHOLDS,
  HYSTERESIS,
  HYSTERESIS_WIDE,
  type ZoomLevel,
  type NodeContentVisibility
} from '../useSemanticZoom'

// --- Helper: simulate a zoom sweep ----------------------------------------
/**
 * Sweeps through a series of zoom values, carrying forward the previous
 * zoom level (simulating continuous zooming). Returns the final ZoomLevel.
 */
function sweepZoom(zoomValues: number[], startLevel: ZoomLevel = 'close'): ZoomLevel {
  let level = startLevel
  for (const z of zoomValues) {
    level = computeZoomLevel(z, level)
  }
  return level
}

// --- 1. Basic zoom range -> correct ZoomLevel ------------------------------
describe('computeZoomLevel -- basic ranges', () => {
  it('returns ultra-far for zoom < 0.15', () => {
    expect(computeZoomLevel(0.05, 'ultra-far')).toBe('ultra-far')
    expect(computeZoomLevel(0.10, 'ultra-far')).toBe('ultra-far')
    expect(computeZoomLevel(0.14, 'ultra-far')).toBe('ultra-far')
  })

  it('returns far for 0.15 <= zoom < 0.30', () => {
    expect(computeZoomLevel(0.15, 'far')).toBe('far')
    expect(computeZoomLevel(0.20, 'far')).toBe('far')
    expect(computeZoomLevel(0.29, 'far')).toBe('far')
  })

  it('returns mid for 0.30 <= zoom < 0.55', () => {
    expect(computeZoomLevel(0.30, 'mid')).toBe('mid')
    expect(computeZoomLevel(0.40, 'mid')).toBe('mid')
    expect(computeZoomLevel(0.54, 'mid')).toBe('mid')
  })

  it('returns close for 0.55 <= zoom < 1.0', () => {
    expect(computeZoomLevel(0.55, 'close')).toBe('close')
    expect(computeZoomLevel(0.75, 'close')).toBe('close')
    expect(computeZoomLevel(0.99, 'close')).toBe('close')
  })

  it('returns ultra-close for zoom >= 1.0', () => {
    expect(computeZoomLevel(1.0, 'ultra-close')).toBe('ultra-close')
    expect(computeZoomLevel(1.5, 'ultra-close')).toBe('ultra-close')
    expect(computeZoomLevel(2.0, 'ultra-close')).toBe('ultra-close')
  })
})

// --- 2. Hysteresis prevents jitter at each boundary -----------------------
describe('computeZoomLevel -- hysteresis', () => {
  describe('ultra-far / far boundary (0.15, hysteresis +/-0.02)', () => {
    it('stays ultra-far when zoom is just above threshold', () => {
      // At ultra-far, need to exceed 0.15 + 0.02 = 0.17 to transition
      expect(computeZoomLevel(0.16, 'ultra-far')).toBe('ultra-far')
    })

    it('transitions to far when zoom exceeds threshold + hysteresis', () => {
      expect(computeZoomLevel(0.18, 'ultra-far')).toBe('far')
    })

    it('stays far when zoom drops just below threshold', () => {
      // At far, need to drop below 0.15 - 0.02 = 0.13 to transition back
      expect(computeZoomLevel(0.14, 'far')).toBe('far')
    })

    it('transitions to ultra-far when zoom drops below threshold - hysteresis', () => {
      expect(computeZoomLevel(0.12, 'far')).toBe('ultra-far')
    })
  })

  describe('far / mid boundary (0.30, hysteresis +/-0.02)', () => {
    it('stays far when zoom is just above threshold', () => {
      expect(computeZoomLevel(0.31, 'far')).toBe('far')
    })

    it('transitions to mid when zoom exceeds threshold + hysteresis', () => {
      expect(computeZoomLevel(0.33, 'far')).toBe('mid')
    })

    it('stays mid when zoom drops just below threshold', () => {
      expect(computeZoomLevel(0.29, 'mid')).toBe('mid')
    })

    it('transitions to far when zoom drops below threshold - hysteresis', () => {
      expect(computeZoomLevel(0.27, 'mid')).toBe('far')
    })
  })

  describe('mid / close boundary (0.55, hysteresis +/-0.02)', () => {
    it('stays mid when zoom is just above threshold', () => {
      expect(computeZoomLevel(0.56, 'mid')).toBe('mid')
    })

    it('transitions to close when zoom exceeds threshold + hysteresis', () => {
      expect(computeZoomLevel(0.58, 'mid')).toBe('close')
    })

    it('stays close when zoom drops just below threshold', () => {
      expect(computeZoomLevel(0.54, 'close')).toBe('close')
    })

    it('transitions to mid when zoom drops below threshold - hysteresis', () => {
      expect(computeZoomLevel(0.52, 'close')).toBe('mid')
    })
  })

  describe('close / ultra-close boundary (1.0, wider hysteresis +/-0.03)', () => {
    it('stays close when zoom is just above threshold', () => {
      // At close, need to exceed 1.0 + 0.03 = 1.03 to transition
      expect(computeZoomLevel(1.02, 'close')).toBe('close')
    })

    it('transitions to ultra-close when zoom exceeds threshold + wide hysteresis', () => {
      expect(computeZoomLevel(1.04, 'close')).toBe('ultra-close')
    })

    it('stays ultra-close when zoom drops just below threshold', () => {
      // At ultra-close, need to drop below 1.0 - 0.03 = 0.97 to transition back
      expect(computeZoomLevel(0.98, 'ultra-close')).toBe('ultra-close')
    })

    it('transitions to close when zoom drops below threshold - wide hysteresis', () => {
      expect(computeZoomLevel(0.96, 'ultra-close')).toBe('close')
    })
  })
})

// --- 3. Sweep tests: continuous zoom up and down --------------------------
describe('computeZoomLevel -- sweep behavior', () => {
  it('sweeps up through all 5 levels', () => {
    expect(sweepZoom([0.05], 'ultra-far')).toBe('ultra-far')
    expect(sweepZoom([0.05, 0.18], 'ultra-far')).toBe('far')
    expect(sweepZoom([0.05, 0.18, 0.33], 'ultra-far')).toBe('mid')
    expect(sweepZoom([0.05, 0.18, 0.33, 0.58], 'ultra-far')).toBe('close')
    expect(sweepZoom([0.05, 0.18, 0.33, 0.58, 1.04], 'ultra-far')).toBe('ultra-close')
  })

  it('sweeps down through all 5 levels', () => {
    expect(sweepZoom([2.0], 'ultra-close')).toBe('ultra-close')
    expect(sweepZoom([2.0, 0.96], 'ultra-close')).toBe('close')
    expect(sweepZoom([2.0, 0.96, 0.52], 'ultra-close')).toBe('mid')
    expect(sweepZoom([2.0, 0.96, 0.52, 0.27], 'ultra-close')).toBe('far')
    expect(sweepZoom([2.0, 0.96, 0.52, 0.27, 0.12], 'ultra-close')).toBe('ultra-far')
  })

  it('handles large jumps correctly', () => {
    // From ultra-far to very high zoom
    const result = computeZoomLevel(2.0, 'ultra-far')
    expect(result).toBe('ultra-close')

    // From ultra-close to very low zoom
    const result2 = computeZoomLevel(0.01, 'ultra-close')
    expect(result2).toBe('ultra-far')
  })
})

// --- 4. Threshold constants are correctly defined -------------------------
describe('threshold constants', () => {
  it('defines 4 thresholds for 5 levels', () => {
    expect(THRESHOLDS.ULTRA_FAR_FAR).toBe(0.15)
    expect(THRESHOLDS.FAR_MID).toBe(0.30)
    expect(THRESHOLDS.MID_CLOSE).toBe(0.55)
    expect(THRESHOLDS.CLOSE_ULTRA_CLOSE).toBe(1.0)
  })

  it('has standard hysteresis of 0.02', () => {
    expect(HYSTERESIS).toBe(0.02)
  })

  it('has wider hysteresis of 0.03 at close/ultra-close boundary', () => {
    expect(HYSTERESIS_WIDE).toBe(0.03)
  })
})

// --- 5. NodeContentVisibility -- new flags at each level ------------------
describe('computeNodeContentVisibility', () => {
  describe('ultra-far level', () => {
    it('computes visibility for ultra-far', () => {
      const vis = computeNodeContentVisibility('ultra-far')

      // New flags
      expect(vis.showClusterSummary).toBe(true)
      expect(vis.showHeader).toBe(false)
      expect(vis.showFooter).toBe(false)
      expect(vis.showEmbeddedContent).toBe(false)
      expect(vis.showExpandedToolbar).toBe(false)
      expect(vis.showInteractiveControls).toBe(false)
      expect(vis.effectiveLevel).toBe('ultra-far')

      // Existing flags: ultra-far inherits old 'far' behavior (shapes only)
      expect(vis.showContent).toBe(false)
      expect(vis.showTitle).toBe(false)
      expect(vis.showBadges).toBe(false)
      expect(vis.showLede).toBe(false)
      expect(vis.zoomLevel).toBe('ultra-far')
    })
  })

  describe('far level', () => {
    it('computes visibility for far', () => {
      const vis = computeNodeContentVisibility('far')

      // New flags
      expect(vis.showClusterSummary).toBe(false)
      expect(vis.showHeader).toBe(true)
      expect(vis.showFooter).toBe(false)
      expect(vis.showEmbeddedContent).toBe(false)
      expect(vis.showExpandedToolbar).toBe(false)
      expect(vis.showInteractiveControls).toBe(false)
      expect(vis.effectiveLevel).toBe('far')

      // Existing flags: far now shows title (old 'far' hid it, but
      // the old "shapes only" behavior has moved to ultra-far)
      expect(vis.showContent).toBe(false)
      expect(vis.showTitle).toBe(true)
      expect(vis.showBadges).toBe(true)
      expect(vis.showLede).toBe(false)
      expect(vis.zoomLevel).toBe('far')
    })
  })

  describe('mid level', () => {
    it('computes visibility for mid', () => {
      const vis = computeNodeContentVisibility('mid')

      // New flags
      expect(vis.showClusterSummary).toBe(false)
      expect(vis.showHeader).toBe(true)
      expect(vis.showFooter).toBe(true)
      expect(vis.showEmbeddedContent).toBe(false)
      expect(vis.showExpandedToolbar).toBe(false)
      expect(vis.showInteractiveControls).toBe(false)
      expect(vis.effectiveLevel).toBe('mid')

      // Existing flags: same as old 'mid'
      expect(vis.showContent).toBe(false)
      expect(vis.showTitle).toBe(true)
      expect(vis.showBadges).toBe(true)
      expect(vis.showLede).toBe(true)
      expect(vis.zoomLevel).toBe('mid')
    })
  })

  describe('close level', () => {
    it('computes visibility for close', () => {
      const vis = computeNodeContentVisibility('close')

      // New flags
      expect(vis.showClusterSummary).toBe(false)
      expect(vis.showHeader).toBe(true)
      expect(vis.showFooter).toBe(true)
      expect(vis.showEmbeddedContent).toBe(true)
      expect(vis.showExpandedToolbar).toBe(false)
      expect(vis.showInteractiveControls).toBe(true)
      expect(vis.effectiveLevel).toBe('close')

      // Existing flags: same as old 'close'
      expect(vis.showContent).toBe(true)
      expect(vis.showTitle).toBe(true)
      expect(vis.showBadges).toBe(true)
      expect(vis.showLede).toBe(false)
      expect(vis.zoomLevel).toBe('close')
    })
  })

  describe('ultra-close level', () => {
    it('computes visibility for ultra-close', () => {
      const vis = computeNodeContentVisibility('ultra-close')

      // New flags
      expect(vis.showClusterSummary).toBe(false)
      expect(vis.showHeader).toBe(true)
      expect(vis.showFooter).toBe(true)
      expect(vis.showEmbeddedContent).toBe(true)
      expect(vis.showExpandedToolbar).toBe(true)
      expect(vis.showInteractiveControls).toBe(true)
      expect(vis.effectiveLevel).toBe('ultra-close')

      // Existing flags: ultra-close behaves like old 'close'
      expect(vis.showContent).toBe(true)
      expect(vis.showTitle).toBe(true)
      expect(vis.showBadges).toBe(true)
      expect(vis.showLede).toBe(false)
      expect(vis.zoomLevel).toBe('ultra-close')
    })
  })
})

// --- 6. Backward compatibility with existing 3-level behavior -------------
describe('backward compatibility', () => {
  it('mid produces same existing flags as old mid', () => {
    const vis = computeNodeContentVisibility('mid')
    // Old mid: showTitle=true, showContent=false, showBadges=true, showLede=true
    expect(vis.showTitle).toBe(true)
    expect(vis.showContent).toBe(false)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(true)
  })

  it('close produces same existing flags as old close', () => {
    const vis = computeNodeContentVisibility('close')
    // Old close: showTitle=true, showContent=true, showBadges=true, showLede=false
    expect(vis.showTitle).toBe(true)
    expect(vis.showContent).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(false)
  })

  it('ultra-far inherits old far "shapes only" behavior for existing flags', () => {
    const vis = computeNodeContentVisibility('ultra-far')
    // The old "shapes only" mode (showTitle=false, etc.) moves to ultra-far
    expect(vis.showTitle).toBe(false)
    expect(vis.showContent).toBe(false)
    expect(vis.showBadges).toBe(false)
    expect(vis.showLede).toBe(false)
  })

  it('ultra-close inherits old close behavior for existing flags', () => {
    const vis = computeNodeContentVisibility('ultra-close')
    expect(vis.showTitle).toBe(true)
    expect(vis.showContent).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showLede).toBe(false)
  })

  it('far now shows title and badges (upgraded from old far shapes-only)', () => {
    // In the 5-level system, 'far' is the new intermediate between ultra-far and mid.
    // It shows title/badges (like old mid minus lede) while ultra-far is shapes-only.
    const vis = computeNodeContentVisibility('far')
    expect(vis.showTitle).toBe(true)
    expect(vis.showBadges).toBe(true)
    expect(vis.showContent).toBe(false)
    expect(vis.showLede).toBe(false)
  })
})

// --- 7. effectiveLevel equals zoomLevel (placeholder for DoF) -------------
describe('effectiveLevel', () => {
  const levels: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']

  levels.forEach(level => {
    it(`effectiveLevel equals zoomLevel at "${level}" (DoF placeholder)`, () => {
      const vis = computeNodeContentVisibility(level)
      expect(vis.effectiveLevel).toBe(level)
      expect(vis.effectiveLevel).toBe(vis.zoomLevel)
    })
  })
})

// --- 8. TypeScript exhaustiveness: all 5 levels produce valid output ------
describe('exhaustiveness', () => {
  const ALL_LEVELS: ZoomLevel[] = ['ultra-far', 'far', 'mid', 'close', 'ultra-close']

  ALL_LEVELS.forEach(level => {
    it(`computeNodeContentVisibility handles "${level}" without throwing`, () => {
      expect(() => computeNodeContentVisibility(level)).not.toThrow()
      const vis = computeNodeContentVisibility(level)
      // All boolean fields should be defined (not undefined)
      expect(typeof vis.showContent).toBe('boolean')
      expect(typeof vis.showTitle).toBe('boolean')
      expect(typeof vis.showBadges).toBe('boolean')
      expect(typeof vis.showLede).toBe('boolean')
      expect(typeof vis.showClusterSummary).toBe('boolean')
      expect(typeof vis.showEmbeddedContent).toBe('boolean')
      expect(typeof vis.showExpandedToolbar).toBe('boolean')
      expect(typeof vis.showInteractiveControls).toBe('boolean')
      expect(typeof vis.showFooter).toBe('boolean')
      expect(typeof vis.showHeader).toBe('boolean')
      expect(vis.zoomLevel).toBe(level)
      expect(vis.effectiveLevel).toBe(level)
    })
  })

  it('computeZoomLevel returns a valid ZoomLevel for any positive zoom', () => {
    const testZooms = [0.001, 0.1, 0.15, 0.25, 0.3, 0.5, 0.55, 0.75, 1.0, 1.5, 3.0]
    for (const z of testZooms) {
      for (const prev of ALL_LEVELS) {
        const result = computeZoomLevel(z, prev)
        expect(ALL_LEVELS).toContain(result)
      }
    }
  })
})

// --- 9. Multi-step hysteresis: rapid oscillation doesn't cause jitter -----
describe('jitter resistance', () => {
  it('oscillating around the far/mid boundary stays stable', () => {
    // Start at mid, oscillate around 0.30
    const values = [0.31, 0.29, 0.31, 0.29, 0.31, 0.29]
    // All within hysteresis band, should stay mid
    expect(sweepZoom(values, 'mid')).toBe('mid')
  })

  it('oscillating around the close/ultra-close boundary stays stable', () => {
    // Start at close, oscillate around 1.0
    const values = [1.01, 0.99, 1.01, 0.99, 1.01, 0.99]
    // All within wide hysteresis band (+/-0.03), should stay close
    expect(sweepZoom(values, 'close')).toBe('close')
  })

  it('oscillating around the ultra-far/far boundary stays stable', () => {
    // Start at ultra-far, oscillate around 0.15
    const values = [0.16, 0.14, 0.16, 0.14, 0.16]
    // All within hysteresis band, should stay ultra-far
    expect(sweepZoom(values, 'ultra-far')).toBe('ultra-far')
  })

  it('oscillating around the mid/close boundary stays stable', () => {
    // Start at mid, oscillate around 0.55
    const values = [0.56, 0.54, 0.56, 0.54, 0.56]
    // All within hysteresis band, should stay mid
    expect(sweepZoom(values, 'mid')).toBe('mid')
  })
})
