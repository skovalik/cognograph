/**
 * Graph Intelligence Store (Phase 5: Graph Intelligence)
 *
 * Manages ambient insights and cost tracking for the Spatial Command Bridge.
 * - Insight deduplication by type + affected nodes
 * - Per-node insight index for fast lookups
 * - Cost snapshots and daily budget tracking
 * - Progressive mode integration (Optimization #4)
 */

import { create } from 'zustand'
import type {
  GraphInsight,
  CostSnapshot,
  InsightType,
  InsightStatus,
} from '@shared/types/bridge'

// =============================================================================
// Helpers
// =============================================================================

function computeInsightsByNode(
  insights: GraphInsight[]
): Record<string, GraphInsight[]> {
  const map: Record<string, GraphInsight[]> = {}
  for (const insight of insights) {
    if (insight.status === 'dismissed' || insight.status === 'expired')
      continue
    for (const nodeId of insight.affectedNodeIds) {
      if (!map[nodeId]) map[nodeId] = []
      map[nodeId].push(insight)
    }
  }
  return map
}

// =============================================================================
// Store Interface
// =============================================================================

interface GraphIntelligenceStoreState {
  // Insights
  insights: GraphInsight[]
  maxInsights: number
  insightsByNode: Record<string, GraphInsight[]>

  // Cost tracking
  costHistory: CostSnapshot[]
  currentSessionCost: number
  dailyBudgetUsed: number
  dailyBudgetLimit: number

  // Analysis state
  isAnalyzing: boolean
  lastAnalysisAt: number | null
  analysisEnabled: boolean

  // Actions
  addInsight: (insight: GraphInsight) => void
  addInsights: (insights: GraphInsight[]) => void
  dismissInsight: (insightId: string) => void
  applyInsight: (insightId: string) => void
  viewInsight: (insightId: string) => void
  expireOldInsights: () => void
  addCostSnapshot: (snapshot: CostSnapshot) => void
  recordAmbientCost: (costUSD: number, tokensUsed: number) => void
  clearInsights: () => void
  setAnalysisEnabled: (enabled: boolean) => void
  setIsAnalyzing: (analyzing: boolean) => void
  resetDailyBudget: () => void

  // Selectors (computed)
  getInsightsForNode: (nodeId: string) => GraphInsight[]
  getActiveInsightCount: () => number
  canSpendAmbient: (amount: number) => boolean
}

// =============================================================================
// Store Creation
// =============================================================================

export const useGraphIntelligenceStore = create<GraphIntelligenceStoreState>(
  (set, get) => ({
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

    addInsight: (insight: GraphInsight): void => {
      set((state) => {
        // Deduplicate: skip if similar insight already active
        const isDuplicate = state.insights.some(
          (existing) =>
            existing.type === insight.type &&
            existing.status !== 'dismissed' &&
            existing.status !== 'expired' &&
            existing.affectedNodeIds.some((id) =>
              insight.affectedNodeIds.includes(id)
            )
        )
        if (isDuplicate) return state

        const insights = [insight, ...state.insights].slice(
          0,
          state.maxInsights
        )
        return {
          insights,
          insightsByNode: computeInsightsByNode(insights),
        }
      })
    },

    addInsights: (newInsights: GraphInsight[]): void => {
      set((state) => {
        let insights = [...state.insights]

        for (const insight of newInsights) {
          const isDuplicate = insights.some(
            (existing) =>
              existing.type === insight.type &&
              existing.status !== 'dismissed' &&
              existing.status !== 'expired' &&
              existing.affectedNodeIds.some((id) =>
                insight.affectedNodeIds.includes(id)
              )
          )
          if (!isDuplicate) {
            insights = [insight, ...insights]
          }
        }

        insights = insights.slice(0, state.maxInsights)
        return {
          insights,
          insightsByNode: computeInsightsByNode(insights),
        }
      })
    },

    dismissInsight: (insightId: string): void => {
      set((state) => {
        const insights = state.insights.map((i) =>
          i.id === insightId
            ? { ...i, status: 'dismissed' as InsightStatus }
            : i
        )
        return {
          insights,
          insightsByNode: computeInsightsByNode(insights),
        }
      })
    },

    applyInsight: (insightId: string): void => {
      const insight = get().insights.find((i) => i.id === insightId)
      if (!insight?.suggestedChanges) return

      // Mark insight as applied
      set((state) => {
        const insights = state.insights.map((i) =>
          i.id === insightId
            ? { ...i, status: 'applied' as InsightStatus }
            : i
        )
        return {
          insights,
          insightsByNode: computeInsightsByNode(insights),
        }
      })

      // The actual proposal creation is handled by the caller
      // (e.g., the InsightIndicator component or a bridging function)
    },

    viewInsight: (insightId: string): void => {
      set((state) => {
        const insights = state.insights.map((i) =>
          i.id === insightId && i.status === 'new'
            ? { ...i, status: 'viewed' as InsightStatus }
            : i
        )
        return { insights }
      })
    },

    expireOldInsights: (): void => {
      const now = Date.now()
      set((state) => {
        const insights = state.insights.map((i) => {
          if (
            i.expiresAt &&
            i.expiresAt < now &&
            i.status !== 'dismissed' &&
            i.status !== 'applied'
          ) {
            return { ...i, status: 'expired' as InsightStatus }
          }
          return i
        })
        return {
          insights,
          insightsByNode: computeInsightsByNode(insights),
        }
      })
    },

    addCostSnapshot: (snapshot: CostSnapshot): void => {
      set((state) => ({
        costHistory: [...state.costHistory, snapshot].slice(-1000),
        currentSessionCost: snapshot.sessionCostUSD,
        dailyBudgetUsed: snapshot.ambientCostUSD,
      }))
    },

    recordAmbientCost: (costUSD: number, tokensUsed: number): void => {
      set((state) => {
        const newCost = state.dailyBudgetUsed + costUSD
        const now = Date.now()

        // Add to cost history
        const snapshot: CostSnapshot = {
          timestamp: now,
          sessionTokens: tokensUsed,
          sessionCostUSD: state.currentSessionCost + costUSD,
          orchestrationTokens: 0,
          orchestrationCostUSD: 0,
          ambientTokens: tokensUsed,
          ambientCostUSD: newCost,
          budgetRemainingUSD: state.dailyBudgetLimit - newCost,
        }

        return {
          dailyBudgetUsed: newCost,
          currentSessionCost: state.currentSessionCost + costUSD,
          costHistory: [...state.costHistory, snapshot].slice(-1000),
        }
      })
    },

    clearInsights: (): void => {
      set({ insights: [], insightsByNode: {} })
    },

    setAnalysisEnabled: (enabled: boolean): void => {
      set({ analysisEnabled: enabled })
    },

    setIsAnalyzing: (analyzing: boolean): void => {
      set({
        isAnalyzing: analyzing,
        ...(analyzing ? {} : { lastAnalysisAt: Date.now() }),
      })
    },

    resetDailyBudget: (): void => {
      set({ dailyBudgetUsed: 0 })
    },

    // Selectors
    getInsightsForNode: (nodeId: string): GraphInsight[] => {
      return get().insightsByNode[nodeId] || []
    },

    getActiveInsightCount: (): number => {
      return get().insights.filter(
        (i) => i.status === 'new' || i.status === 'viewed'
      ).length
    },

    canSpendAmbient: (amount: number): boolean => {
      const state = get()
      return state.dailyBudgetUsed + amount <= state.dailyBudgetLimit
    },
  })
)

// =============================================================================
// Selectors
// =============================================================================

export const selectInsights = (
  state: GraphIntelligenceStoreState
): GraphInsight[] => state.insights

export const selectActiveInsights = (
  state: GraphIntelligenceStoreState
): GraphInsight[] =>
  state.insights.filter((i) => i.status === 'new' || i.status === 'viewed')

export const selectInsightsByNode = (
  state: GraphIntelligenceStoreState
): Record<string, GraphInsight[]> => state.insightsByNode

export const selectCostHistory = (
  state: GraphIntelligenceStoreState
): CostSnapshot[] => state.costHistory

export const selectDailyBudgetUsed = (
  state: GraphIntelligenceStoreState
): number => state.dailyBudgetUsed

export const selectDailyBudgetLimit = (
  state: GraphIntelligenceStoreState
): number => state.dailyBudgetLimit

export const selectCurrentSessionCost = (
  state: GraphIntelligenceStoreState
): number => state.currentSessionCost

export const selectIsAnalyzing = (
  state: GraphIntelligenceStoreState
): boolean => state.isAnalyzing
