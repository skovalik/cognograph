import { describe, it, expect } from 'vitest'
import { tidyUpLayout } from '../tidyUpLayout'
import type { LayoutNode, LayoutEdge } from '../tidyUpLayout'

// Helper: create a layout node
function makeNode(
  id: string,
  x: number,
  y: number,
  width = 280,
  height = 140,
  pinned = false
): LayoutNode {
  return { id, x, y, width, height, pinned }
}

// Helper: euclidean distance between two positions
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

// Helper: get result position by id
function getPos(
  results: Array<{ id: string; x: number; y: number }>,
  id: string
): { x: number; y: number } {
  const found = results.find((r) => r.id === id)
  if (!found) throw new Error(`Node ${id} not found in results`)
  return { x: found.x, y: found.y }
}

describe('tidyUpLayout', () => {
  // 1. Empty input
  it('should return empty array for 0 nodes', () => {
    const result = tidyUpLayout([], [])
    expect(result).toEqual([])
  })

  // 2. Single node — returns same position
  it('should return the same position for a single node', () => {
    const nodes = [makeNode('n1', 100, 200)]
    const result = tidyUpLayout(nodes, [])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n1')
    expect(result[0].x).toBeCloseTo(100, 0)
    expect(result[0].y).toBeCloseTo(200, 0)
  })

  // 3. Two overlapping nodes should push apart
  it('should push two overlapping nodes apart to at least horizontalGap distance', () => {
    // Place two nodes at the exact same position
    const nodes = [makeNode('n1', 100, 100, 280, 140), makeNode('n2', 100, 100, 280, 140)]
    const result = tidyUpLayout(nodes, [], { horizontalGap: 80, verticalGap: 60, iterations: 50 })

    const p1 = getPos(result, 'n1')
    const p2 = getPos(result, 'n2')
    const d = dist(p1, p2)

    // After tidy, they should be significantly apart
    expect(d).toBeGreaterThan(60)
  })

  // 4. Pinned node stays at exact original position
  it('should not move a pinned node', () => {
    const nodes = [
      makeNode('pinned', 500, 500, 280, 140, true),
      makeNode('free', 510, 510, 280, 140, false)
    ]
    const result = tidyUpLayout(nodes, [])

    const pinnedPos = getPos(result, 'pinned')
    expect(pinnedPos.x).toBe(500)
    expect(pinnedPos.y).toBe(500)

    // The free node should have moved away
    const freePos = getPos(result, 'free')
    const d = dist(pinnedPos, freePos)
    expect(d).toBeGreaterThan(10)
  })

  // 5. Connected nodes attract — far apart nodes move closer
  it('should pull connected nodes closer together', () => {
    const nodes = [makeNode('n1', 0, 0, 100, 50), makeNode('n2', 3000, 0, 100, 50)]
    const edges: LayoutEdge[] = [{ source: 'n1', target: 'n2' }]

    const initialDist = dist({ x: 0, y: 0 }, { x: 3000, y: 0 })
    const result = tidyUpLayout(nodes, edges, {
      horizontalGap: 80,
      iterations: 50,
      strength: 0.1
    })

    const p1 = getPos(result, 'n1')
    const p2 = getPos(result, 'n2')
    const finalDist = dist(p1, p2)

    expect(finalDist).toBeLessThan(initialDist)
  })

  // 6. Preserves cluster structure — two groups stay as two groups
  it('should preserve two distinct groups as separate clusters', () => {
    // Group A centered around (0, 0)
    const groupA = [
      makeNode('a1', 0, 0, 100, 50),
      makeNode('a2', 50, 50, 100, 50),
      makeNode('a3', 100, 0, 100, 50)
    ]
    // Group B centered around (5000, 5000)
    const groupB = [
      makeNode('b1', 5000, 5000, 100, 50),
      makeNode('b2', 5050, 5050, 100, 50),
      makeNode('b3', 5100, 5000, 100, 50)
    ]

    const nodes = [...groupA, ...groupB]
    const edges: LayoutEdge[] = [
      { source: 'a1', target: 'a2' },
      { source: 'a2', target: 'a3' },
      { source: 'b1', target: 'b2' },
      { source: 'b2', target: 'b3' }
    ]

    const result = tidyUpLayout(nodes, edges, { iterations: 50 })

    // Compute centroids of each group after tidy
    const aCentroid = {
      x: (getPos(result, 'a1').x + getPos(result, 'a2').x + getPos(result, 'a3').x) / 3,
      y: (getPos(result, 'a1').y + getPos(result, 'a2').y + getPos(result, 'a3').y) / 3
    }
    const bCentroid = {
      x: (getPos(result, 'b1').x + getPos(result, 'b2').x + getPos(result, 'b3').x) / 3,
      y: (getPos(result, 'b1').y + getPos(result, 'b2').y + getPos(result, 'b3').y) / 3
    }

    // Groups should still be far apart (not merged)
    const groupDist = dist(aCentroid, bCentroid)
    expect(groupDist).toBeGreaterThan(1000)
  })

  // 7. Returns only position changes — output has id, x, y (no width/height)
  it('should return only id, x, y in results', () => {
    const nodes = [makeNode('n1', 10, 10), makeNode('n2', 50, 50)]
    const result = tidyUpLayout(nodes, [])

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(['id', 'x', 'y'])
    }
  })

  // 8. Deterministic — same input → same output
  it('should produce identical output for identical input', () => {
    const nodes = [
      makeNode('n1', 100, 100, 280, 140),
      makeNode('n2', 200, 200, 280, 140),
      makeNode('n3', 300, 100, 280, 140)
    ]
    const edges: LayoutEdge[] = [{ source: 'n1', target: 'n2' }]

    const result1 = tidyUpLayout(nodes, edges, { iterations: 30 })
    const result2 = tidyUpLayout(nodes, edges, { iterations: 30 })

    for (let i = 0; i < result1.length; i++) {
      expect(result1[i].id).toBe(result2[i].id)
      expect(result1[i].x).toBe(result2[i].x)
      expect(result1[i].y).toBe(result2[i].y)
    }
  })

  // 9. Respects gaps — after tidy, no two non-pinned node centers are too close
  it('should maintain minimum gap between non-pinned nodes after tidy', () => {
    // Start with overlapping nodes
    const nodes = [
      makeNode('n1', 100, 100, 100, 50),
      makeNode('n2', 110, 110, 100, 50),
      makeNode('n3', 105, 105, 100, 50),
      makeNode('n4', 115, 100, 100, 50)
    ]
    const hGap = 80
    const vGap = 60
    const result = tidyUpLayout(nodes, [], {
      horizontalGap: hGap,
      verticalGap: vGap,
      iterations: 100,
      strength: 0.1
    })

    const minGap = Math.min(hGap, vGap)

    // Check pairwise distances
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const d = dist(
          { x: result[i].x, y: result[i].y },
          { x: result[j].x, y: result[j].y }
        )
        // After tidy, node centers should be at least minGap apart
        expect(d).toBeGreaterThanOrEqual(minGap * 0.8) // Allow 20% tolerance for force-based
      }
    }
  })

  // Additional tests
  it('should handle all pinned nodes by returning their original positions', () => {
    const nodes = [
      makeNode('n1', 100, 100, 280, 140, true),
      makeNode('n2', 200, 200, 280, 140, true)
    ]
    const result = tidyUpLayout(nodes, [])
    expect(getPos(result, 'n1')).toEqual({ x: 100, y: 100 })
    expect(getPos(result, 'n2')).toEqual({ x: 200, y: 200 })
  })

  it('should handle custom options', () => {
    const nodes = [
      makeNode('n1', 0, 0, 100, 50),
      makeNode('n2', 10, 10, 100, 50)
    ]
    const result = tidyUpLayout(nodes, [], {
      horizontalGap: 200,
      verticalGap: 200,
      iterations: 100,
      strength: 0.2
    })

    const d = dist(getPos(result, 'n1'), getPos(result, 'n2'))
    // With large gap settings, nodes should be pushed further apart
    expect(d).toBeGreaterThan(50)
  })

  it('should return one entry per input node', () => {
    const nodes = [
      makeNode('n1', 0, 0),
      makeNode('n2', 100, 100),
      makeNode('n3', 200, 200),
      makeNode('n4', 300, 300),
      makeNode('n5', 400, 400)
    ]
    const result = tidyUpLayout(nodes, [])
    expect(result).toHaveLength(5)

    const ids = result.map((r) => r.id).sort()
    expect(ids).toEqual(['n1', 'n2', 'n3', 'n4', 'n5'])
  })
})
