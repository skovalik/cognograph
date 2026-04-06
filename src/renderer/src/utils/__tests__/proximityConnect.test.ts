import { describe, expect, it } from 'vitest'
import {
  buildEdgePairSet,
  edgeToEdgeDistance,
  findProximityTargets,
  getNodeRect,
  type NodeRect,
  PROXIMITY_THRESHOLD,
} from '../proximityConnect'

describe('edgeToEdgeDistance', () => {
  it('returns 0 for overlapping rects', () => {
    const a: NodeRect = { x: 0, y: 0, width: 100, height: 100 }
    const b: NodeRect = { x: 50, y: 50, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBe(0)
  })

  it('returns 0 for touching rects', () => {
    const a: NodeRect = { x: 0, y: 0, width: 100, height: 100 }
    const b: NodeRect = { x: 100, y: 0, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBe(0)
  })

  it('returns horizontal gap distance', () => {
    const a: NodeRect = { x: 0, y: 0, width: 100, height: 100 }
    const b: NodeRect = { x: 200, y: 0, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBe(100)
  })

  it('returns vertical gap distance', () => {
    const a: NodeRect = { x: 0, y: 0, width: 100, height: 100 }
    const b: NodeRect = { x: 0, y: 250, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBe(150)
  })

  it('returns diagonal distance for corner-separated rects', () => {
    const a: NodeRect = { x: 0, y: 0, width: 100, height: 100 }
    const b: NodeRect = { x: 200, y: 200, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBeCloseTo(141.42, 1)
  })

  it('handles rect contained within another', () => {
    const a: NodeRect = { x: 0, y: 0, width: 300, height: 300 }
    const b: NodeRect = { x: 50, y: 50, width: 50, height: 50 }
    expect(edgeToEdgeDistance(a, b)).toBe(0)
  })

  it('handles negative coordinates', () => {
    const a: NodeRect = { x: -500, y: -300, width: 100, height: 100 }
    const b: NodeRect = { x: -300, y: -300, width: 100, height: 100 }
    expect(edgeToEdgeDistance(a, b)).toBe(100)
  })

  it('handles zero-size rects (point-to-point)', () => {
    const a: NodeRect = { x: 0, y: 0, width: 0, height: 0 }
    const b: NodeRect = { x: 100, y: 0, width: 0, height: 0 }
    expect(edgeToEdgeDistance(a, b)).toBe(100)
  })
})

describe('getNodeRect', () => {
  it('uses explicit width/height when set', () => {
    const node = { position: { x: 10, y: 20 }, width: 300, height: 200 } as any
    const rect = getNodeRect(node)
    expect(rect).toEqual({ x: 10, y: 20, width: 300, height: 200 })
  })

  it('falls back to measured dimensions', () => {
    const node = { position: { x: 0, y: 0 }, measured: { width: 350, height: 180 } } as any
    const rect = getNodeRect(node)
    expect(rect).toEqual({ x: 0, y: 0, width: 350, height: 180 })
  })

  it('uses defaults (280x140) when no dimensions available', () => {
    const node = { position: { x: 5, y: 5 } } as any
    const rect = getNodeRect(node)
    expect(rect).toEqual({ x: 5, y: 5, width: 280, height: 140 })
  })

  it('falls through width=0 to measured (falsy zero)', () => {
    const node = {
      position: { x: 0, y: 0 },
      width: 0,
      measured: { width: 250, height: 130 },
    } as any
    const rect = getNodeRect(node)
    // width 0 is falsy → falls through to measured
    expect(rect.width).toBe(250)
  })
})

describe('findProximityTargets', () => {
  const makeNode = (id: string, type: string, x: number, y: number) => ({
    id,
    position: { x, y },
    data: { type, title: id } as any,
    width: 280,
    height: 140,
    type: 'custom',
  })

  it('finds conversation nodes within threshold', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [
      makeNode('conv1', 'conversation', 350, 0),
      makeNode('conv2', 'conversation', 600, 0),
      makeNode('note1', 'note', 350, 0),
    ]
    const targets = findProximityTargets(draggedRect, nodes as any, ['dragged'], new Set())
    expect(targets).toHaveLength(1)
    expect(targets[0]!.nodeId).toBe('conv1')
  })

  it('excludes conversation nodes with existing forward edge', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv1', 'conversation', 350, 0)]
    const targets = findProximityTargets(
      draggedRect,
      nodes as any,
      ['dragged'],
      new Set(['dragged-conv1']),
    )
    expect(targets).toHaveLength(0)
  })

  it('excludes conversation nodes with existing reverse edge', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv1', 'conversation', 350, 0)]
    // Edge stored as conv1→dragged (reverse direction)
    const targets = findProximityTargets(
      draggedRect,
      nodes as any,
      ['dragged'],
      new Set(['conv1-dragged']),
    )
    expect(targets).toHaveLength(0)
  })

  it('excludes dragged nodes from targets', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv1', 'conversation', 0, 0)]
    const targets = findProximityTargets(draggedRect, nodes as any, ['conv1'], new Set())
    expect(targets).toHaveLength(0)
  })

  it('excludes conversation-to-conversation (caller responsibility, but verify exclusion of dragged conv)', () => {
    // The type !== 'conversation' check on the dragged node is in App.tsx, not findProximityTargets.
    // findProximityTargets only filters TARGET nodes. A dragged conversation node would be
    // excluded by the caller checking the dragged node's type before calling this function.
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv1', 'conversation', 350, 0)]
    // Dragged node IS a conversation, but findProximityTargets doesn't know that —
    // it still returns the target. Caller must gate.
    const targets = findProximityTargets(draggedRect, nodes as any, ['dragged-conv'], new Set())
    expect(targets).toHaveLength(1) // findProximityTargets finds it; caller gates
  })

  it('sorts targets by distance (nearest first)', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [
      makeNode('conv-far', 'conversation', 400, 0),
      makeNode('conv-near', 'conversation', 330, 0),
    ]
    const targets = findProximityTargets(draggedRect, nodes as any, ['dragged'], new Set())
    expect(targets).toHaveLength(2)
    expect(targets[0]!.nodeId).toBe('conv-near')
    expect(targets[1]!.nodeId).toBe('conv-far')
  })

  it('includes node at exact threshold boundary (<=)', () => {
    // 280 (width) + 150 (threshold) = 430. Node at x=430 has edge-to-edge distance of exactly 150.
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv-boundary', 'conversation', 430, 0)]
    const targets = findProximityTargets(draggedRect, nodes as any, ['dragged'], new Set())
    expect(targets).toHaveLength(1)
  })

  it('excludes node just beyond threshold', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const nodes = [makeNode('conv-far', 'conversation', 431, 0)]
    const targets = findProximityTargets(draggedRect, nodes as any, ['dragged'], new Set())
    expect(targets).toHaveLength(0)
  })

  it('returns empty array for empty nodes list', () => {
    const draggedRect: NodeRect = { x: 0, y: 0, width: 280, height: 140 }
    const targets = findProximityTargets(draggedRect, [], ['dragged'], new Set())
    expect(targets).toHaveLength(0)
  })
})

describe('buildEdgePairSet', () => {
  it('creates lookup set from edges', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' },
    ]
    const set = buildEdgePairSet(edges)
    expect(set.has('a-b')).toBe(true)
    expect(set.has('c-d')).toBe(true)
    // Only forward direction stored; findProximityTargets checks both orientations
    expect(set.has('b-a')).toBe(false)
  })

  it('handles empty edge array', () => {
    const set = buildEdgePairSet([])
    expect(set.size).toBe(0)
  })
})
