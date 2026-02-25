/**
 * Spatial Region Auto-Grow Tests
 *
 * Tests for the autoGrowRegion function in spatialRegionStore.
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useSpatialRegionStore } from '../spatialRegionStore'

describe('spatialRegionStore.autoGrowRegion', () => {
  let regionId: string

  beforeEach(() => {
    // Reset store
    useSpatialRegionStore.getState().loadRegions([])

    // Create a test region with known bounds
    regionId = useSpatialRegionStore.getState().addRegion({
      name: 'Test Region',
      bounds: { x: 100, y: 100, width: 400, height: 300 }
    })
  })

  it('expands when node exceeds right boundary', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node that extends 50px past the right edge (100 + 400 = 500, node goes to 550 + 20 padding = 570)
    autoGrowRegion(regionId, { x: 400, y: 200, width: 150, height: 100 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    // Right edge should be at least nodeBounds.x + nodeBounds.width + 20 padding = 570
    expect(region.bounds.x + region.bounds.width).toBeGreaterThanOrEqual(570)
    // Left and top should not change
    expect(region.bounds.x).toBe(100)
    expect(region.bounds.y).toBe(100)
  })

  it('expands when node exceeds bottom boundary', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node that extends past the bottom edge (100 + 300 = 400, node goes to 420 + 20 padding = 440)
    autoGrowRegion(regionId, { x: 200, y: 350, width: 100, height: 70 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    // Bottom edge should be at least 350 + 70 + 20 = 440
    expect(region.bounds.y + region.bounds.height).toBeGreaterThanOrEqual(440)
  })

  it('expands when node exceeds left boundary', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node that extends past the left edge (region starts at x=100, node at x=60, minus 20 padding = 40)
    autoGrowRegion(regionId, { x: 60, y: 200, width: 100, height: 50 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    // Left edge should be at most 60 - 20 = 40
    expect(region.bounds.x).toBeLessThanOrEqual(40)
    // Width should have grown accordingly
    expect(region.bounds.x + region.bounds.width).toBeGreaterThanOrEqual(500) // original right edge preserved
  })

  it('expands when node exceeds top boundary', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node at y=50, region starts at y=100, with 20px padding -> top at 30
    autoGrowRegion(regionId, { x: 200, y: 50, width: 100, height: 30 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    expect(region.bounds.y).toBeLessThanOrEqual(30)
  })

  it('does NOT shrink region when node is within bounds', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node fully within bounds
    autoGrowRegion(regionId, { x: 200, y: 200, width: 100, height: 50 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    expect(region.bounds.x).toBe(100)
    expect(region.bounds.y).toBe(100)
    expect(region.bounds.width).toBe(400)
    expect(region.bounds.height).toBe(300)
  })

  it('no-op when node is fully within bounds (region unchanged)', () => {
    const regionBefore = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    const boundsBefore = { ...regionBefore.bounds }

    const { autoGrowRegion } = useSpatialRegionStore.getState()
    autoGrowRegion(regionId, { x: 150, y: 150, width: 100, height: 100 })

    const regionAfter = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    expect(regionAfter.bounds.x).toBe(boundsBefore.x)
    expect(regionAfter.bounds.y).toBe(boundsBefore.y)
    expect(regionAfter.bounds.width).toBe(boundsBefore.width)
    expect(regionAfter.bounds.height).toBe(boundsBefore.height)
  })

  it('adds 20px padding when expanding', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()

    // Node right at the right edge: region right = 100 + 400 = 500
    // Node right = 490 + 20 = 510, with 20px padding = 530
    autoGrowRegion(regionId, { x: 490, y: 200, width: 20, height: 20 })

    const region = useSpatialRegionStore.getState().regions.find(r => r.id === regionId)!
    const rightEdge = region.bounds.x + region.bounds.width
    // Node ends at 510, plus 20px padding = 530
    expect(rightEdge).toBe(530)
  })

  it('handles non-existent regionId gracefully', () => {
    const { autoGrowRegion } = useSpatialRegionStore.getState()
    // Should not throw
    expect(() => {
      autoGrowRegion('non-existent-id', { x: 0, y: 0, width: 100, height: 100 })
    }).not.toThrow()
  })
})
