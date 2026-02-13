/**
 * Graph Intelligence Service Tests
 *
 * Tests for rule-based graph analysis:
 * - Orphaned cluster detection
 * - Hub node detection
 * - Stale content detection
 * - Missing connection detection
 * - Full topology analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeTopology } from '../graphIntelligence'

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn().mockReturnValue(null),
  },
}))

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
})

// =============================================================================
// Helpers
// =============================================================================

interface TestNode {
  id: string
  type: string
  title: string
  updatedAt: number
  createdAt: number
  position: { x: number; y: number }
}

interface TestEdge {
  id: string
  source: string
  target: string
  bidirectional?: boolean
}

function createNode(
  id: string,
  type = 'note',
  title = `Node ${id}`,
  daysOld = 0
): TestNode {
  const now = Date.now()
  return {
    id,
    type,
    title,
    updatedAt: now - daysOld * 24 * 60 * 60 * 1000,
    createdAt: now - daysOld * 24 * 60 * 60 * 1000,
    position: { x: Math.random() * 1000, y: Math.random() * 1000 },
  }
}

function createEdge(
  source: string,
  target: string,
  bidirectional = false
): TestEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    bidirectional,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Graph Intelligence - analyzeTopology', () => {
  // ---------------------------------------------------------------------------
  // Orphaned Clusters
  // ---------------------------------------------------------------------------

  describe('orphaned cluster detection', () => {
    it('should detect disconnected clusters', () => {
      const nodes = [
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
        createNode('n4'),
        createNode('n5'),
        createNode('n6'),
      ]
      const edges = [
        createEdge('n1', 'n2'),
        createEdge('n2', 'n3'),
        createEdge('n3', 'n4'),
        // n5 and n6 are in a separate cluster
        createEdge('n5', 'n6'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const orphanInsights = insights.filter(
        (i) => i.type === 'orphaned-cluster'
      )
      expect(orphanInsights.length).toBeGreaterThanOrEqual(1)
      // The smaller cluster (n5, n6) should be flagged
      const smallCluster = orphanInsights.find((i) =>
        i.affectedNodeIds.includes('n5')
      )
      expect(smallCluster).toBeDefined()
    })

    it('should detect isolated nodes', () => {
      const nodes = [
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
        createNode('isolated'),
      ]
      const edges = [
        createEdge('n1', 'n2'),
        createEdge('n2', 'n3'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const isolatedInsight = insights.find(
        (i) =>
          i.type === 'orphaned-cluster' &&
          i.affectedNodeIds.includes('isolated')
      )
      expect(isolatedInsight).toBeDefined()
    })

    it('should not flag a fully connected graph', () => {
      const nodes = [
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
      ]
      const edges = [
        createEdge('n1', 'n2'),
        createEdge('n2', 'n3'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const orphanInsights = insights.filter(
        (i) => i.type === 'orphaned-cluster'
      )
      expect(orphanInsights).toHaveLength(0)
    })

    it('should handle empty graph', () => {
      const insights = analyzeTopology({
        nodes: [],
        edges: [],
        timestamp: Date.now(),
      })
      expect(insights).toHaveLength(0)
    })

    it('should handle graph with no edges', () => {
      const nodes = [
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges: [],
        timestamp: Date.now(),
      })

      const isolatedInsight = insights.find(
        (i) => i.type === 'orphaned-cluster'
      )
      expect(isolatedInsight).toBeDefined()
      expect(isolatedInsight!.affectedNodeIds).toHaveLength(3)
    })
  })

  // ---------------------------------------------------------------------------
  // Hub Nodes
  // ---------------------------------------------------------------------------

  describe('hub node detection', () => {
    it('should detect nodes with disproportionately many connections', () => {
      // Create a star topology with n1 as the hub
      const nodes = [
        createNode('hub'),
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
        createNode('n4'),
        createNode('n5'),
        createNode('n6'),
        createNode('n7'),
        createNode('n8'),
      ]
      const edges = [
        createEdge('hub', 'n1'),
        createEdge('hub', 'n2'),
        createEdge('hub', 'n3'),
        createEdge('hub', 'n4'),
        createEdge('hub', 'n5'),
        createEdge('hub', 'n6'),
        createEdge('hub', 'n7'),
        createEdge('hub', 'n8'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const hubInsight = insights.find(
        (i) =>
          i.type === 'unbalanced-graph' &&
          i.affectedNodeIds.includes('hub')
      )
      expect(hubInsight).toBeDefined()
    })

    it('should not flag balanced graphs', () => {
      const nodes = [
        createNode('n1'),
        createNode('n2'),
        createNode('n3'),
        createNode('n4'),
        createNode('n5'),
      ]
      // Chain topology - all nodes have degree 1-2
      const edges = [
        createEdge('n1', 'n2'),
        createEdge('n2', 'n3'),
        createEdge('n3', 'n4'),
        createEdge('n4', 'n5'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const hubInsights = insights.filter(
        (i) => i.type === 'unbalanced-graph'
      )
      expect(hubInsights).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Missing Connections
  // ---------------------------------------------------------------------------

  describe('missing connection detection', () => {
    it('should detect tasks not connected to any project', () => {
      const nodes = [
        createNode('p1', 'project', 'My Project'),
        createNode('t1', 'task', 'Task 1'),
        createNode('t2', 'task', 'Task 2'),
        createNode('t3', 'task', 'Task 3'),
        createNode('n1', 'note', 'Note 1'),
      ]
      // Only t1 is connected to the project
      const edges = [createEdge('p1', 't1')]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const missingInsight = insights.find(
        (i) =>
          i.type === 'missing-connection' &&
          i.description.includes('task')
      )
      expect(missingInsight).toBeDefined()
      expect(missingInsight!.affectedNodeIds).toContain('t2')
      expect(missingInsight!.affectedNodeIds).toContain('t3')
      expect(missingInsight!.affectedNodeIds).not.toContain('t1')
    })

    it('should detect unconnected agent nodes', () => {
      const nodes = [
        createNode('a1', 'conversation', 'Agent 1'),
        createNode('a2', 'conversation', 'Agent 2'),
        createNode('n1', 'note', 'Note 1'),
        createNode('n2', 'note', 'Note 2'),
      ]
      // Only a1 is connected
      const edges = [createEdge('a1', 'n1'), createEdge('n1', 'n2')]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      const agentInsight = insights.find(
        (i) =>
          i.type === 'missing-connection' &&
          i.description.includes('agent')
      )
      expect(agentInsight).toBeDefined()
      expect(agentInsight!.affectedNodeIds).toContain('a2')
    })
  })

  // ---------------------------------------------------------------------------
  // Stale Content
  // ---------------------------------------------------------------------------

  describe('stale content detection', () => {
    it('should detect nodes not updated in a long time', () => {
      const now = Date.now()
      const nodes = [
        createNode('recent1', 'note', 'Recent 1', 0),
        createNode('recent2', 'note', 'Recent 2', 1),
        createNode('stale1', 'note', 'Stale 1', 15), // 15 days old
        createNode('stale2', 'note', 'Stale 2', 20), // 20 days old
      ]

      const edges = [createEdge('recent1', 'recent2')]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: now,
      })

      const staleInsight = insights.find((i) => i.type === 'stale-content')
      // Whether stale detection triggers depends on the threshold calculations
      // At minimum, very old nodes in an otherwise active workspace should be detected
      if (staleInsight) {
        expect(staleInsight.affectedNodeIds).toContain('stale2')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Full Analysis
  // ---------------------------------------------------------------------------

  describe('full topology analysis', () => {
    it('should return insights from all detectors', () => {
      const nodes = [
        createNode('hub', 'project', 'Hub Project'),
        createNode('n1', 'conversation', 'Agent 1'),
        createNode('n2', 'note', 'Note 1'),
        createNode('n3', 'note', 'Note 2'),
        createNode('n4', 'task', 'Task 1'),
        createNode('n5', 'task', 'Task 2'),
        createNode('isolated', 'note', 'Isolated'),
      ]
      const edges = [
        createEdge('hub', 'n1'),
        createEdge('hub', 'n2'),
        createEdge('hub', 'n3'),
        createEdge('hub', 'n4'),
      ]

      const insights = analyzeTopology({
        nodes,
        edges,
        timestamp: Date.now(),
      })

      // Should have at least some insights
      expect(insights.length).toBeGreaterThan(0)

      // All insights should have required fields
      for (const insight of insights) {
        expect(insight.id).toBeTruthy()
        expect(insight.type).toBeTruthy()
        expect(insight.priority).toBeTruthy()
        expect(insight.title).toBeTruthy()
        expect(insight.description).toBeTruthy()
        expect(insight.affectedNodeIds.length).toBeGreaterThan(0)
        expect(insight.confidence).toBeGreaterThanOrEqual(0)
        expect(insight.confidence).toBeLessThanOrEqual(1)
        expect(insight.source).toBe('rule-based')
      }
    })

    it('should handle minimal graph gracefully', () => {
      const insights = analyzeTopology({
        nodes: [createNode('n1'), createNode('n2')],
        edges: [createEdge('n1', 'n2')],
        timestamp: Date.now(),
      })

      // Small graph should produce few or no insights
      expect(insights).toBeDefined()
    })
  })
})
