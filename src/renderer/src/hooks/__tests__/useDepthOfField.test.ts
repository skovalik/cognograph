/**
 * useDepthOfField (Phase 6A) -- Hook tests
 *
 * Tests the pure helper functions and the hook CSS class + effective zoom level logic.
 */

import { describe, it, expect } from 'vitest'
import {
  computeEffectiveZoomLevel,
  getDofCssClass,
  ZOOM_LEVEL_ORDER,
  RING_LOD_REDUCTION,
  DISCONNECTED_LOD_REDUCTION,
  DISCONNECTED_CSS_CLASS
} from '../useDepthOfField'
import { DOF_DISCONNECTED } from '../../stores/contextVisualizationStore'
import type { ZoomLevel } from '../useSemanticZoom'

// --- computeEffectiveZoomLevel tests --------------------------------------

describe('computeEffectiveZoomLevel', () => {
  it('ring 0 (focus) does not change zoom level', () => {
    expect(computeEffectiveZoomLevel('ultra-close', 0)).toBe('ultra-close')
    expect(computeEffectiveZoomLevel('close', 0)).toBe('close')
    expect(computeEffectiveZoomLevel('mid', 0)).toBe('mid')
    expect(computeEffectiveZoomLevel('far', 0)).toBe('far')
    expect(computeEffectiveZoomLevel('ultra-far', 0)).toBe('ultra-far')
  })

  it('ring 1 reduces by 1 LOD level', () => {
    expect(computeEffectiveZoomLevel('ultra-close', 1)).toBe('close')
    expect(computeEffectiveZoomLevel('close', 1)).toBe('mid')
    expect(computeEffectiveZoomLevel('mid', 1)).toBe('far')
    expect(computeEffectiveZoomLevel('far', 1)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('ultra-far', 1)).toBe('ultra-far')
  })

  it('ring 2 reduces by 2 LOD levels', () => {
    expect(computeEffectiveZoomLevel('ultra-close', 2)).toBe('mid')
    expect(computeEffectiveZoomLevel('close', 2)).toBe('far')
    expect(computeEffectiveZoomLevel('mid', 2)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('far', 2)).toBe('ultra-far')
  })

  it('ring 3 forces to ultra-far (4 level reduction)', () => {
    expect(computeEffectiveZoomLevel('ultra-close', 3)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('close', 3)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('mid', 3)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('far', 3)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('ultra-far', 3)).toBe('ultra-far')
  })

  it('disconnected (-1) forces to ultra-far', () => {
    expect(computeEffectiveZoomLevel('ultra-close', DOF_DISCONNECTED)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('close', DOF_DISCONNECTED)).toBe('ultra-far')
    expect(computeEffectiveZoomLevel('mid', DOF_DISCONNECTED)).toBe('ultra-far')
  })

  it('never goes below ultra-far (clamped)', () => {
    const lastLevel = ZOOM_LEVEL_ORDER[ZOOM_LEVEL_ORDER.length - 1]
    expect(computeEffectiveZoomLevel('ultra-far', 3)).toBe(lastLevel)
    expect(computeEffectiveZoomLevel('ultra-far', DOF_DISCONNECTED)).toBe(lastLevel)
  })
})
// --- getDofCssClass tests -------------------------------------------------

describe('getDofCssClass', () => {
  it('returns dof-ring-0 for ring 0', () => {
    expect(getDofCssClass(0)).toBe('dof-ring-0')
  })

  it('returns dof-ring-1 for ring 1', () => {
    expect(getDofCssClass(1)).toBe('dof-ring-1')
  })

  it('returns dof-ring-2 for ring 2', () => {
    expect(getDofCssClass(2)).toBe('dof-ring-2')
  })

  it('returns dof-ring-3 for ring 3', () => {
    expect(getDofCssClass(3)).toBe('dof-ring-3')
  })

  it('returns dof-out-of-scope for disconnected (-1)', () => {
    expect(getDofCssClass(DOF_DISCONNECTED)).toBe(DISCONNECTED_CSS_CLASS)
  })

  it('returns dof-out-of-scope for unknown ring numbers', () => {
    expect(getDofCssClass(99)).toBe(DISCONNECTED_CSS_CLASS)
    expect(getDofCssClass(-5)).toBe(DISCONNECTED_CSS_CLASS)
  })
})

// --- ZOOM_LEVEL_ORDER constants -------------------------------------------

describe('ZOOM_LEVEL_ORDER', () => {
  it('has 5 levels from most detail to least', () => {
    expect(ZOOM_LEVEL_ORDER).toHaveLength(5)
    expect(ZOOM_LEVEL_ORDER[0]).toBe('ultra-close')
    expect(ZOOM_LEVEL_ORDER[4]).toBe('ultra-far')
  })
})

// --- RING_LOD_REDUCTION constants -----------------------------------------

describe('RING_LOD_REDUCTION', () => {
  it('ring 0 has 0 reduction', () => {
    expect(RING_LOD_REDUCTION[0]).toBe(0)
  })

  it('ring 1 has 1 reduction', () => {
    expect(RING_LOD_REDUCTION[1]).toBe(1)
  })

  it('ring 2 has 2 reductions', () => {
    expect(RING_LOD_REDUCTION[2]).toBe(2)
  })

  it('ring 3 has 4 reductions (force to ultra-far)', () => {
    expect(RING_LOD_REDUCTION[3]).toBe(4)
  })

  it('DISCONNECTED_LOD_REDUCTION is 4', () => {
    expect(DISCONNECTED_LOD_REDUCTION).toBe(4)
  })
})
