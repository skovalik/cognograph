/**
 * Graph Intelligence Store Tests
 *
 * Tests for the insight and cost tracking store:
 * - Insight addition and deduplication
 * - Insight lifecycle (new -> viewed -> applied/dismissed)
 * - Per-node insight index
 * - Cost tracking and daily budget
 * - Expiry behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGraphIntelligenceStore } from '../graphIntelligenceStore'
import type { GraphInsight, CostSnapshot } from '@shared/types/bridge'

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
})

// =============================================================================
// Helpers
// =============================================================================

function createMockInsight(
  overrides: Partial<GraphInsight> = {}
): GraphInsight {
  return {
    id: crypto.randomUUID(),
    type: 'orphaned-cluster',
    priority: 'medium',
    status: 'new',
    title: 'Test Insight',
    description: 'Test description',
    affectedNodeIds: ['node-1', 'node-2'],
    confidence: 0.8,
    detectedAt: Date.now(),
    source: 'rule-based',
    ...overrides,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('GraphIntelligenceStore', () => {
  beforeEach(() => {
    useGraphIntelligenceStore.setState({
      insights: [],
      maxInsights: 50,
      insightsByNode: {},
      costHistory: [],
      currentSessionCost: 0,
      dailyBudgetUsed: 0,
      dailyBudgetLimit: 0.16,
      isAnalyzing: false,
      lastAnalysisAt: null,
      analysisEnabled: true,
    })
  })

  // ---------------------------------------------------------------------------
  // Insight Addition
  // ---------------------------------------------------------------------------

  describe('addInsight', () => {
    it('should add a new insight', () => {
      const insight = createMockInsight()
      useGraphIntelligenceStore.getState().addInsight(insight)

      const state = useGraphIntelligenceStore.getState()
      expect(state.insights).toHaveLength(1)
      expect(state.insights[0].id).toBe(insight.id)
    })

    it('should deduplicate by type and affected nodes', () => {
      const insight1 = createMockInsight({
        type: 'orphaned-cluster',
        affectedNodeIds: ['node-1', 'node-2'],
      })
      const insight2 = createMockInsight({
        type: 'orphaned-cluster',
        affectedNodeIds: ['node-2', 'node-3'],
      })

      useGraphIntelligenceStore.getState().addInsight(insight1)
      useGraphIntelligenceStore.getState().addInsight(insight2)

      // Insight2 overlaps with insight1 on node-2 and same type
      expect(useGraphIntelligenceStore.getState().insights).toHaveLength(1)
    })

    it('should allow different types for same nodes', () => {
      const insight1 = createMockInsight({
        type: 'orphaned-cluster',
        affectedNodeIds: ['node-1'],
      })
      const insight2 = createMockInsight({
        type: 'stale-content',
        affectedNodeIds: ['node-1'],
      })

      useGraphIntelligenceStore.getState().addInsight(insight1)
      useGraphIntelligenceStore.getState().addInsight(insight2)

      expect(useGraphIntelligenceStore.getState().insights).toHaveLength(2)
    })

    it('should enforce maxInsights limit', () => {
      useGraphIntelligenceStore.setState({ maxInsights: 3 })

      for (let i = 0; i < 5; i++) {
        useGraphIntelligenceStore.getState().addInsight(
          createMockInsight({
            id: `insight-${i}`,
            type: 'stale-content', // Different IDs, same type but...
            affectedNodeIds: [`unique-node-${i}`], // ...different affected nodes
          })
        )
      }

      expect(useGraphIntelligenceStore.getState().insights).toHaveLength(3)
    })
  })

  // ---------------------------------------------------------------------------
  // Insight Batch Addition
  // ---------------------------------------------------------------------------

  describe('addInsights', () => {
    it('should add multiple insights at once', () => {
      const insights = [
        createMockInsight({
          type: 'orphaned-cluster',
          affectedNodeIds: ['a'],
        }),
        createMockInsight({
          type: 'stale-content',
          affectedNodeIds: ['b'],
        }),
        createMockInsight({
          type: 'missing-connection',
          affectedNodeIds: ['c'],
        }),
      ]

      useGraphIntelligenceStore.getState().addInsights(insights)
      expect(useGraphIntelligenceStore.getState().insights).toHaveLength(3)
    })

    it('should deduplicate within the batch', () => {
      const insights = [
        createMockInsight({
          type: 'orphaned-cluster',
          affectedNodeIds: ['a'],
        }),
        createMockInsight({
          type: 'orphaned-cluster',
          affectedNodeIds: ['a'],
        }),
      ]

      useGraphIntelligenceStore.getState().addInsights(insights)
      expect(useGraphIntelligenceStore.getState().insights).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Insight Lifecycle
  // ---------------------------------------------------------------------------

  describe('insight lifecycle', () => {
    let insightId: string

    beforeEach(() => {
      const insight = createMockInsight({ status: 'new' })
      insightId = insight.id
      useGraphIntelligenceStore.getState().addInsight(insight)
    })

    it('should mark insight as viewed', () => {
      useGraphIntelligenceStore.getState().viewInsight(insightId)

      const insight = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insightId)
      expect(insight?.status).toBe('viewed')
    })

    it('should only view "new" insights', () => {
      useGraphIntelligenceStore.getState().dismissInsight(insightId)
      useGraphIntelligenceStore.getState().viewInsight(insightId)

      const insight = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insightId)
      expect(insight?.status).toBe('dismissed')
    })

    it('should dismiss an insight', () => {
      useGraphIntelligenceStore.getState().dismissInsight(insightId)

      const insight = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insightId)
      expect(insight?.status).toBe('dismissed')
    })

    it('should apply an insight', () => {
      const insight = createMockInsight({
        suggestedChanges: [
          {
            id: 'change-1',
            type: 'create-edge',
            edgeData: { source: 'a', target: 'b' },
            agentNodeId: 'agent-1',
          },
        ],
      })
      useGraphIntelligenceStore.setState({ insights: [insight] })
      useGraphIntelligenceStore.getState().applyInsight(insight.id)

      const updated = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insight.id)
      expect(updated?.status).toBe('applied')
    })
  })

  // ---------------------------------------------------------------------------
  // Per-Node Index
  // ---------------------------------------------------------------------------

  describe('insightsByNode', () => {
    it('should index insights by affected node IDs', () => {
      const insight = createMockInsight({
        affectedNodeIds: ['node-A', 'node-B'],
      })
      useGraphIntelligenceStore.getState().addInsight(insight)

      const byNode = useGraphIntelligenceStore.getState().insightsByNode
      expect(byNode['node-A']).toHaveLength(1)
      expect(byNode['node-B']).toHaveLength(1)
    })

    it('should exclude dismissed insights from index', () => {
      const insight = createMockInsight({
        affectedNodeIds: ['node-A'],
      })
      useGraphIntelligenceStore.getState().addInsight(insight)
      useGraphIntelligenceStore.getState().dismissInsight(insight.id)

      const byNode = useGraphIntelligenceStore.getState().insightsByNode
      expect(byNode['node-A']).toBeUndefined()
    })

    it('should return empty array for nodes without insights', () => {
      const result = useGraphIntelligenceStore
        .getState()
        .getInsightsForNode('nonexistent')
      expect(result).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // Expiry
  // ---------------------------------------------------------------------------

  describe('expireOldInsights', () => {
    it('should expire insights past their expiry time', () => {
      const insight = createMockInsight({
        expiresAt: Date.now() - 1000, // Already expired
      })
      useGraphIntelligenceStore.setState({ insights: [insight], insightsByNode: {} })
      useGraphIntelligenceStore.getState().expireOldInsights()

      const updated = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insight.id)
      expect(updated?.status).toBe('expired')
    })

    it('should not expire insights without expiresAt', () => {
      const insight = createMockInsight({ expiresAt: undefined })
      useGraphIntelligenceStore.setState({ insights: [insight], insightsByNode: {} })
      useGraphIntelligenceStore.getState().expireOldInsights()

      const updated = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insight.id)
      expect(updated?.status).toBe('new')
    })

    it('should not expire dismissed or applied insights', () => {
      const insight = createMockInsight({
        status: 'dismissed',
        expiresAt: Date.now() - 1000,
      })
      useGraphIntelligenceStore.setState({ insights: [insight], insightsByNode: {} })
      useGraphIntelligenceStore.getState().expireOldInsights()

      const updated = useGraphIntelligenceStore
        .getState()
        .insights.find((i) => i.id === insight.id)
      expect(updated?.status).toBe('dismissed')
    })
  })

  // ---------------------------------------------------------------------------
  // Cost Tracking
  // ---------------------------------------------------------------------------

  describe('cost tracking', () => {
    it('should record ambient cost and update budget', () => {
      useGraphIntelligenceStore.getState().recordAmbientCost(0.01, 500)

      const state = useGraphIntelligenceStore.getState()
      expect(state.dailyBudgetUsed).toBeCloseTo(0.01, 6)
      expect(state.currentSessionCost).toBeCloseTo(0.01, 6)
      expect(state.costHistory).toHaveLength(1)
    })

    it('should accumulate costs', () => {
      useGraphIntelligenceStore.getState().recordAmbientCost(0.01, 500)
      useGraphIntelligenceStore.getState().recordAmbientCost(0.02, 1000)

      const state = useGraphIntelligenceStore.getState()
      expect(state.dailyBudgetUsed).toBeCloseTo(0.03, 6)
      expect(state.currentSessionCost).toBeCloseTo(0.03, 6)
    })

    it('should add cost snapshots', () => {
      const snapshot: CostSnapshot = {
        timestamp: Date.now(),
        sessionTokens: 1000,
        sessionCostUSD: 0.05,
        orchestrationTokens: 500,
        orchestrationCostUSD: 0.02,
        ambientTokens: 200,
        ambientCostUSD: 0.01,
        budgetRemainingUSD: 0.15,
      }

      useGraphIntelligenceStore.getState().addCostSnapshot(snapshot)
      expect(useGraphIntelligenceStore.getState().costHistory).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Budget Gate
  // ---------------------------------------------------------------------------

  describe('budget management', () => {
    it('should allow spend within budget', () => {
      const result = useGraphIntelligenceStore.getState().canSpendAmbient(0.01)
      expect(result).toBe(true)
    })

    it('should deny spend exceeding budget', () => {
      useGraphIntelligenceStore.setState({ dailyBudgetUsed: 0.15 })
      const result = useGraphIntelligenceStore.getState().canSpendAmbient(0.02)
      expect(result).toBe(false)
    })

    it('should reset daily budget', () => {
      useGraphIntelligenceStore.setState({ dailyBudgetUsed: 0.15 })
      useGraphIntelligenceStore.getState().resetDailyBudget()
      expect(useGraphIntelligenceStore.getState().dailyBudgetUsed).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Analysis State
  // ---------------------------------------------------------------------------

  describe('analysis state', () => {
    it('should track analyzing state', () => {
      useGraphIntelligenceStore.getState().setIsAnalyzing(true)
      expect(useGraphIntelligenceStore.getState().isAnalyzing).toBe(true)

      useGraphIntelligenceStore.getState().setIsAnalyzing(false)
      expect(useGraphIntelligenceStore.getState().isAnalyzing).toBe(false)
      expect(useGraphIntelligenceStore.getState().lastAnalysisAt).toBeTruthy()
    })

    it('should toggle analysis enabled', () => {
      useGraphIntelligenceStore.getState().setAnalysisEnabled(false)
      expect(useGraphIntelligenceStore.getState().analysisEnabled).toBe(false)
    })

    it('should return active insight count', () => {
      useGraphIntelligenceStore.setState({
        insights: [
          createMockInsight({ status: 'new', type: 'orphaned-cluster', affectedNodeIds: ['a'] }),
          createMockInsight({ status: 'viewed', type: 'stale-content', affectedNodeIds: ['b'] }),
          createMockInsight({ status: 'dismissed', type: 'missing-connection', affectedNodeIds: ['c'] }),
        ],
      })

      expect(useGraphIntelligenceStore.getState().getActiveInsightCount()).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Clear
  // ---------------------------------------------------------------------------

  describe('clearInsights', () => {
    it('should clear all insights', () => {
      useGraphIntelligenceStore.getState().addInsight(createMockInsight())
      useGraphIntelligenceStore.getState().clearInsights()

      const state = useGraphIntelligenceStore.getState()
      expect(state.insights).toHaveLength(0)
      expect(Object.keys(state.insightsByNode)).toHaveLength(0)
    })
  })
})
