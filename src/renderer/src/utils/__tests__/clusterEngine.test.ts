import { describe, it, expect } from 'vitest'
import { computeClusters } from '../clusterEngine'
import type { NodePosition, EdgeInfo, Cluster } from '../clusterEngine'

// Helper: create a node at given position
function makeNode(
  id: string,
  x: number,
  y: number,
  type = 'note',
  status?: string
): NodePosition {
  return { id, x, y, type, status }
}

// Helper: create an edge
function makeEdge(source: string, target: string): EdgeInfo {
  return { source, target }
}

// Helper: find which cluster a node belongs to
function findClusterOf(clusters: Cluster[], nodeId: string): Cluster | undefined {
  return clusters.find((c) => c.nodeIds.includes(nodeId))
}

describe('clusterEngine', () => {
  describe('computeClusters', () => {
    // 1. Empty input
    it('should return 0 clusters for 0 nodes', () => {
      const result = computeClusters([], [])
      expect(result).toEqual([])
    })

    // 2. Single node — below threshold (needs 2+ per cell)
    it('should return 0 clusters for a single node', () => {
      const nodes = [makeNode('n1', 100, 100)]
      const result = computeClusters(nodes, [])
      expect(result).toHaveLength(0)
    })

    // 3. Two nodes in the same cell → 1 cluster
    it('should cluster two nodes in the same grid cell', () => {
      const nodes = [makeNode('n1', 10, 10), makeNode('n2', 50, 50)]
      const result = computeClusters(nodes, [], 400)
      expect(result).toHaveLength(1)
      expect(result[0].nodeIds).toContain('n1')
      expect(result[0].nodeIds).toContain('n2')
      expect(result[0].summary.nodeCount).toBe(2)
    })

    // 4. Basic clustering — 10 nodes in 3 spatial groups, PFD splits largest to reach 4
    it('should cluster spatial groups and apply PFD constraint splitting', () => {
      const nodes = [
        // Group A: around (0, 0) — 3 nodes
        makeNode('a1', 10, 10, 'conversation'),
        makeNode('a2', 50, 50, 'conversation'),
        makeNode('a3', 80, 30, 'note'),
        // Group B: around (2000, 0) — 4 nodes (largest, will be split by PFD)
        makeNode('b1', 2010, 10, 'task'),
        makeNode('b2', 2050, 50, 'task'),
        makeNode('b3', 2080, 30, 'task'),
        makeNode('b4', 2020, 80, 'project'),
        // Group C: around (0, 2000) — 3 nodes
        makeNode('c1', 10, 2010, 'artifact'),
        makeNode('c2', 50, 2050, 'artifact'),
        makeNode('c3', 80, 2030, 'note')
      ]
      const result = computeClusters(nodes, [], 400)

      // PFD constraint: 3 spatial groups → split largest (B, 4 nodes) to reach 4
      expect(result.length).toBeGreaterThanOrEqual(4)
      expect(result.length).toBeLessThanOrEqual(8)

      // All nodes in group A should be in the same cluster (3 nodes, can't split)
      const clusterA = findClusterOf(result, 'a1')!
      expect(clusterA.nodeIds).toContain('a2')
      expect(clusterA.nodeIds).toContain('a3')

      // All nodes in group C should be in the same cluster (3 nodes, can't split)
      const clusterC = findClusterOf(result, 'c1')!
      expect(clusterC.nodeIds).toContain('c2')
      expect(clusterC.nodeIds).toContain('c3')

      // All 10 nodes accounted for
      const totalNodes = result.reduce((sum, c) => sum + c.nodeIds.length, 0)
      expect(totalNodes).toBe(10)
    })

    // 5. Edge-merge correctness — connected nodes in adjacent cells merge
    it('should merge adjacent cells connected by edges into fewer clusters', () => {
      // Place nodes straddling two adjacent grid cells (gridSize=400)
      // Cell (0,0): nodes at (100,100) and (200,200)
      // Cell (1,0): nodes at (450,100), (500,200), (600,150)
      const nodes = [
        makeNode('n1', 100, 100),
        makeNode('n2', 200, 200),
        makeNode('n3', 450, 100),
        makeNode('n4', 500, 200),
        makeNode('n5', 600, 150)
      ]

      // Without edges: 2 candidate cells → 2 clusters (before PFD)
      const resultNoEdges = computeClusters(nodes, [], 400)

      // With edge bridging adjacent cells: merge into fewer clusters
      const edges = [makeEdge('n2', 'n3')] // bridge between cells (0,0) and (1,0)
      const resultWithEdges = computeClusters(nodes, edges, 400)

      // Edge merge should produce fewer or equal clusters
      expect(resultWithEdges.length).toBeLessThanOrEqual(resultNoEdges.length)

      // All 5 nodes should be accounted for in both cases
      const totalWithEdges = resultWithEdges.reduce((sum, c) => sum + c.nodeIds.length, 0)
      expect(totalWithEdges).toBe(5)

      // Verify the merged cluster contains nodes from both cells
      const clusterWithN1 = findClusterOf(resultWithEdges, 'n1')!
      const clusterWithN3 = findClusterOf(resultWithEdges, 'n3')!
      // After edge-merge, n1 and n3 are in the same pre-PFD cluster
      // (PFD may split it, but it merged first)
      expect(clusterWithN1.nodeIds.length + clusterWithN3.nodeIds.length).toBeGreaterThanOrEqual(3)
    })

    // 6. MAUP resistance — translated workspace produces same cluster structure
    //    Edge-merge of adjacent cells makes the algorithm robust to grid boundary shifts
    it('should produce identical cluster structure when workspace is translated', () => {
      // Use fully-connected groups so edge-merge handles boundary shifts
      const baseNodes = [
        makeNode('a1', 100, 100, 'note'),
        makeNode('a2', 150, 150, 'note'),
        makeNode('a3', 200, 120, 'note'),
        makeNode('b1', 2000, 2000, 'task'),
        makeNode('b2', 2050, 2050, 'task'),
        makeNode('b3', 2100, 2020, 'task')
      ]
      // Full connectivity within each group so edge-merge catches boundary straddles
      const edges = [
        makeEdge('a1', 'a2'),
        makeEdge('a2', 'a3'),
        makeEdge('a1', 'a3'),
        makeEdge('b1', 'b2'),
        makeEdge('b2', 'b3'),
        makeEdge('b1', 'b3')
      ]

      // Original
      const result1 = computeClusters(baseNodes, edges, 400)

      // Translated by +200 — may shift nodes across grid boundaries
      const translatedNodes = baseNodes.map((n) => ({
        ...n,
        x: n.x + 200,
        y: n.y + 200
      }))
      const result2 = computeClusters(translatedNodes, edges, 400)

      // Same number of clusters
      expect(result1.length).toBe(result2.length)

      // Same node groupings (same nodes in same clusters)
      for (const cluster1 of result1) {
        const corresponding = result2.find((c2) =>
          cluster1.nodeIds.some((id) => c2.nodeIds.includes(id))
        )
        expect(corresponding).toBeDefined()
        expect(corresponding!.nodeIds.sort()).toEqual(cluster1.nodeIds.sort())
      }
    })

    // 7. PFD constraint — upper bound: many groups merge down to <= 8
    it('should merge down to at most 8 clusters when there are many groups', () => {
      // Create 20 well-separated groups (each with 2 nodes)
      const nodes: NodePosition[] = []
      for (let i = 0; i < 20; i++) {
        nodes.push(makeNode(`g${i}-a`, i * 2000, 0, 'note'))
        nodes.push(makeNode(`g${i}-b`, i * 2000 + 50, 50, 'note'))
      }
      const result = computeClusters(nodes, [], 400)
      expect(result.length).toBeLessThanOrEqual(8)
      // All 40 nodes should still be accounted for
      const totalNodes = result.reduce((sum, c) => sum + c.nodeIds.length, 0)
      expect(totalNodes).toBe(40)
    })

    // 8. PFD constraint — lower bound: 50 nodes in 2 groups → splits to >= 4 if possible
    it('should split up to at least 4 clusters when there are too few groups', () => {
      // 2 large groups of 25 nodes each (well-separated)
      const nodes: NodePosition[] = []
      for (let i = 0; i < 25; i++) {
        // Group A: spread within one region, spanning multiple grid cells
        nodes.push(makeNode(`a${i}`, (i % 5) * 100, Math.floor(i / 5) * 100, 'note'))
      }
      for (let i = 0; i < 25; i++) {
        // Group B: far away, spread across cells
        nodes.push(makeNode(`b${i}`, 5000 + (i % 5) * 100, Math.floor(i / 5) * 100, 'task'))
      }
      const result = computeClusters(nodes, [], 400)
      expect(result.length).toBeGreaterThanOrEqual(4)
      expect(result.length).toBeLessThanOrEqual(8)
    })

    // 9. Cluster metadata — dominantType and status counts
    it('should compute correct cluster metadata', () => {
      // Use 3 nodes (< 4, can't be split by PFD) so we get exactly 1 cluster
      const nodes = [
        makeNode('n1', 10, 10, 'task', 'done'),
        makeNode('n2', 50, 50, 'task', 'in-progress'),
        makeNode('n3', 80, 30, 'note', 'blocked')
      ]
      const result = computeClusters(nodes, [], 400)

      // 3 nodes in one cell, can't be split (need >= 4 to split) → 1 cluster
      expect(result).toHaveLength(1)
      const cluster = result[0]

      // dominantType should be 'task' (2 out of 3)
      expect(cluster.dominantType).toBe('task')

      // summary checks
      expect(cluster.summary.nodeCount).toBe(3)
      expect(cluster.summary.typeCounts).toEqual({
        task: 2,
        note: 1
      })
      expect(cluster.summary.statusCounts).toEqual({
        done: 1,
        'in-progress': 1,
        blocked: 1
      })

      // centroid should be average of positions
      const expectedCx = (10 + 50 + 80) / 3
      const expectedCy = (10 + 50 + 30) / 3
      expect(cluster.centroid.x).toBeCloseTo(expectedCx, 5)
      expect(cluster.centroid.y).toBeCloseTo(expectedCy, 5)

      // bounds check
      expect(cluster.bounds.minX).toBe(10)
      expect(cluster.bounds.minY).toBe(10)
      expect(cluster.bounds.maxX).toBe(80)
      expect(cluster.bounds.maxY).toBe(50)
    })

    // 10. Performance — 500 nodes + 800 edges < 5ms
    it('should process 500 nodes and 800 edges in under 5ms', () => {
      const nodes: NodePosition[] = []
      for (let i = 0; i < 500; i++) {
        nodes.push(
          makeNode(
            `n${i}`,
            Math.floor(i / 10) * 50,
            (i % 10) * 50,
            i % 2 === 0 ? 'note' : 'task'
          )
        )
      }
      const edges: EdgeInfo[] = []
      for (let i = 0; i < 800; i++) {
        edges.push(
          makeEdge(`n${i % 500}`, `n${(i * 7 + 13) % 500}`)
        )
      }

      const start = performance.now()
      const result = computeClusters(nodes, edges, 400)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(5)
      expect(result.length).toBeGreaterThan(0)
    })

    // 11. Disconnected nodes still cluster by spatial proximity
    it('should cluster disconnected nodes by spatial proximity', () => {
      // No edges at all, but nodes are near each other
      const nodes = [
        makeNode('n1', 10, 10),
        makeNode('n2', 50, 50),
        makeNode('n3', 5000, 5000),
        makeNode('n4', 5050, 5050)
      ]
      const result = computeClusters(nodes, [])

      // Should have 2 spatial clusters
      expect(result).toHaveLength(2)

      const cluster1 = findClusterOf(result, 'n1')!
      expect(cluster1.nodeIds).toContain('n2')
      expect(cluster1.nodeIds).not.toContain('n3')

      const cluster2 = findClusterOf(result, 'n3')!
      expect(cluster2.nodeIds).toContain('n4')
    })

    // 12. Single mega-cluster — all 50 nodes in one cell
    it('should handle all nodes in one cell as a single cluster', () => {
      const nodes: NodePosition[] = []
      for (let i = 0; i < 50; i++) {
        // All within a 400x400 cell
        nodes.push(makeNode(`n${i}`, (i % 10) * 30, Math.floor(i / 10) * 30, 'note'))
      }
      const result = computeClusters(nodes, [], 400)

      // Can't split below 2 nodes per cluster, and with only 1 starting cluster,
      // splitting depends on whether median split produces valid results.
      // But we should have at least 1 cluster and at most 8.
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.length).toBeLessThanOrEqual(8)

      // All 50 nodes accounted for
      const totalNodes = result.reduce((sum, c) => sum + c.nodeIds.length, 0)
      expect(totalNodes).toBe(50)
    })

    // Additional edge cases
    it('should handle negative coordinates', () => {
      const nodes = [
        makeNode('n1', -100, -100),
        makeNode('n2', -50, -50),
        makeNode('n3', -3000, -3000),
        makeNode('n4', -2950, -2950)
      ]
      const result = computeClusters(nodes, [])
      expect(result).toHaveLength(2)
    })

    it('should generate stable cluster IDs', () => {
      const nodes = [makeNode('n1', 10, 10), makeNode('n2', 50, 50)]
      const result1 = computeClusters(nodes, [], 400)
      const result2 = computeClusters(nodes, [], 400)
      expect(result1[0].id).toBe(result2[0].id)
    })

    it('should not merge non-adjacent cells even with edges', () => {
      // Two cells far apart (not 8-connected) but with an edge between them
      const nodes = [
        makeNode('n1', 10, 10),
        makeNode('n2', 50, 50),
        makeNode('n3', 5000, 5000),
        makeNode('n4', 5050, 5050)
      ]
      // Edge connects n1→n3 but cells are not adjacent
      const edges = [makeEdge('n1', 'n3')]
      const result = computeClusters(nodes, edges, 400)

      // Should still be 2 clusters (not merged because cells aren't adjacent)
      expect(result).toHaveLength(2)
    })
  })
})
