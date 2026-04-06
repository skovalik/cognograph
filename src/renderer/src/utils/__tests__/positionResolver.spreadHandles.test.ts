// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import { assignSpreadHandles, buildVisibleSlots } from '../positionResolver'

// ─── buildVisibleSlots unit tests ───────────────────────────────────────────

describe('buildVisibleSlots', () => {
  it('single edge always goes to center', () => {
    expect(buildVisibleSlots(1, 0)).toEqual(['c'])
    expect(buildVisibleSlots(1, 2)).toEqual(['c'])
    expect(buildVisibleSlots(1, 4)).toEqual(['c'])
  })

  it('no visible spread handles → all center', () => {
    expect(buildVisibleSlots(2, 0)).toEqual(['c', 'c'])
    expect(buildVisibleSlots(3, 0)).toEqual(['c', 'c', 'c'])
  })

  it('2 edges on 200-400px node → uses inner pair (handle IDs 2,3)', () => {
    // visibleCount=2 → VISIBLE_INDICES[2] = [1,2] → handle IDs [2,3]
    const slots = buildVisibleSlots(2, 2)
    expect(slots).toEqual([2, 3])
  })

  it('2 edges on 400-600px node → uses outer visible pair (handle IDs 1,4)', () => {
    // visibleCount=3 → VISIBLE_INDICES[3] = [0,2,3] → handle IDs [1,3,4]
    const slots = buildVisibleSlots(2, 3)
    expect(slots[0]).toBe(1)
    expect(slots[1]).toBe(4)
  })

  it('2 edges on 600px+ node → uses outer pair (handle IDs 1,4)', () => {
    // visibleCount=4 → VISIBLE_INDICES[4] = [0,1,2,3] → handle IDs [1,2,3,4]
    const slots = buildVisibleSlots(2, 4)
    expect(slots[0]).toBe(1)
    expect(slots[1]).toBe(4)
  })

  it('3 edges on 400-600px node → outer visible + center', () => {
    // visibleCount=3 → handle IDs [1,3,4]
    const slots = buildVisibleSlots(3, 3)
    expect(slots).toEqual([1, 'c', 4])
  })

  it('3 edges on 200-400px node → 2 visible + center overflow', () => {
    // visibleCount=2 → handle IDs [2,3], only 2 visible for 3 edges
    const slots = buildVisibleSlots(3, 2)
    expect(slots.length).toBe(3)
    // Should include the 2 visible handles plus center
    expect(slots.filter((s) => s === 'c').length).toBeGreaterThanOrEqual(1)
    expect(slots.filter((s) => typeof s === 'number').length).toBe(2)
  })

  it('4 edges on 600px+ node → all 4 handles', () => {
    const slots = buildVisibleSlots(4, 4)
    expect(slots).toEqual([1, 2, 3, 4])
  })
})

// ─── assignSpreadHandles integration tests ──────────────────────────────────

describe('assignSpreadHandles visibility-aware assignment', () => {
  /** Helper: build nodePositions map */
  function makePositions(
    nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  ) {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const n of nodes) {
      map.set(n.id, { x: n.x, y: n.y, width: n.width, height: n.height })
    }
    return map
  }

  it('single edge between two nodes → center handles', () => {
    const nodePositions = makePositions([
      { id: 'A', x: 0, y: 0, width: 300, height: 180 },
      { id: 'B', x: 0, y: 300, width: 300, height: 180 },
    ])
    const edges = [{ id: 'A-B', source: 'A', target: 'B' }]
    const result = assignSpreadHandles(edges, nodePositions)

    expect(result.size).toBe(1)
    const handles = result.get('A-B')!
    // B is below A → bottom-source, top-target (center handles)
    expect(handles.sourceHandle).toBe('bottom-source')
    expect(handles.targetHandle).toBe('top-target')
  })

  it('2 edges from same side on 300px node → spread to visible handles 2,3', () => {
    // A at top, B and C below on left and right
    const nodePositions = makePositions([
      { id: 'A', x: 200, y: 0, width: 300, height: 180 },
      { id: 'B', x: 0, y: 300, width: 300, height: 180 },
      { id: 'C', x: 400, y: 300, width: 300, height: 180 },
    ])
    const edges = [
      { id: 'A-B', source: 'A', target: 'B' },
      { id: 'A-C', source: 'A', target: 'C' },
    ]
    const result = assignSpreadHandles(edges, nodePositions)

    // Both edges exit A's bottom side. 300px width → visibleCount=2 → handles 2,3
    const abHandles = result.get('A-B')!
    const acHandles = result.get('A-C')!

    // Source handles should be spread on bottom side using visible handle IDs (2 or 3)
    expect(abHandles.sourceHandle).toMatch(/^bottom-source(-[23])?$/)
    expect(acHandles.sourceHandle).toMatch(/^bottom-source(-[23])?$/)

    // They should be different (spread, not stacked)
    expect(abHandles.sourceHandle).not.toBe(acHandles.sourceHandle)

    // Neither should use invisible handles 1 or 4
    expect(abHandles.sourceHandle).not.toMatch(/-1$/)
    expect(abHandles.sourceHandle).not.toMatch(/-4$/)
    expect(acHandles.sourceHandle).not.toMatch(/-1$/)
    expect(acHandles.sourceHandle).not.toMatch(/-4$/)
  })

  it('2 edges from same side on 600px node → spread to outer handles 1,4', () => {
    // B and C must be far enough below A so both edges exit A's bottom side
    const nodePositions = makePositions([
      { id: 'A', x: 200, y: 0, width: 600, height: 180 },
      { id: 'B', x: 100, y: 500, width: 300, height: 180 },
      { id: 'C', x: 500, y: 500, width: 300, height: 180 },
    ])
    const edges = [
      { id: 'A-B', source: 'A', target: 'B' },
      { id: 'A-C', source: 'A', target: 'C' },
    ]
    const result = assignSpreadHandles(edges, nodePositions)

    const abHandles = result.get('A-B')!
    const acHandles = result.get('A-C')!

    // 600px → visibleCount=4 → all handles visible, should use outer pair
    expect(abHandles.sourceHandle).not.toBe(acHandles.sourceHandle)
    // Both should be spread handles (not center)
    const sourceHandles = [abHandles.sourceHandle, acHandles.sourceHandle].sort()
    expect(sourceHandles[0]).toMatch(/^bottom-source-[1234]$/)
    expect(sourceHandles[1]).toMatch(/^bottom-source-[1234]$/)
  })

  it('2 edges on <200px node → both go to center (no visible spread)', () => {
    const nodePositions = makePositions([
      { id: 'A', x: 200, y: 0, width: 150, height: 100 },
      { id: 'B', x: 0, y: 300, width: 150, height: 100 },
      { id: 'C', x: 400, y: 300, width: 150, height: 100 },
    ])
    const edges = [
      { id: 'A-B', source: 'A', target: 'B' },
      { id: 'A-C', source: 'A', target: 'C' },
    ]
    const result = assignSpreadHandles(edges, nodePositions)

    const abHandles = result.get('A-B')!
    const acHandles = result.get('A-C')!

    // <200px → visibleCount=0 → all center
    expect(abHandles.sourceHandle).toBe('bottom-source')
    expect(acHandles.sourceHandle).toBe('bottom-source')
  })

  it('side switching: moving node changes handle sides', () => {
    // A to the left of B → right-source, left-target
    const nodePositions = makePositions([
      { id: 'A', x: 0, y: 0, width: 300, height: 180 },
      { id: 'B', x: 500, y: 0, width: 300, height: 180 },
    ])
    const edges = [{ id: 'A-B', source: 'A', target: 'B' }]
    const result1 = assignSpreadHandles(edges, nodePositions)
    expect(result1.get('A-B')?.sourceHandle).toBe('right-source')
    expect(result1.get('A-B')?.targetHandle).toBe('left-target')

    // Now A is above B → bottom-source, top-target
    nodePositions.set('B', { x: 0, y: 400, width: 300, height: 180 })
    const result2 = assignSpreadHandles(edges, nodePositions)
    expect(result2.get('A-B')?.sourceHandle).toBe('bottom-source')
    expect(result2.get('A-B')?.targetHandle).toBe('top-target')
  })

  it('preserves user-assigned handles', () => {
    const nodePositions = makePositions([
      { id: 'A', x: 0, y: 0, width: 300, height: 180 },
      { id: 'B', x: 0, y: 300, width: 300, height: 180 },
    ])
    const edges = [
      {
        id: 'A-B',
        source: 'A',
        target: 'B',
        sourceHandle: 'left-source',
        targetHandle: 'right-target',
        data: { userAssignedHandle: true },
      },
    ]
    const result = assignSpreadHandles(edges, nodePositions)
    expect(result.get('A-B')?.sourceHandle).toBe('left-source')
    expect(result.get('A-B')?.targetHandle).toBe('right-target')
  })
})
