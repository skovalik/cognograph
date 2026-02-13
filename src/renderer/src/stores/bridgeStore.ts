/**
 * Bridge Store — Spatial Command Bridge overlay state management
 *
 * Tracks real-time agent activity for visual overlay on canvas.
 * Subscribes to orchestratorStore status events (NOT duplicate IPC listener).
 * Uses RAF batching (Optimization #2) for badge updates.
 * Uses Record<string, T> instead of Map<string, T> for Zustand reactivity.
 */

import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type {
  AgentActivityState,
  OrchestratorActivityState,
  BridgeSettings,
} from '@shared/types/bridge'
import { DEFAULT_BRIDGE_SETTINGS } from '@shared/types/bridge'
import type { OrchestratorStatusUpdate } from './orchestratorStore'

// =============================================================================
// RAF BATCHING (Optimization #2)
// Batches rapid badge updates into single frame for 50x fewer re-renders
// =============================================================================

let pendingBridgeUpdate: Partial<BridgeStoreState> | null = null
let bridgeRafId: number | null = null

function flushBridgeUpdate(): void {
  if (pendingBridgeUpdate) {
    useBridgeStore.setState(pendingBridgeUpdate)
    pendingBridgeUpdate = null
  }
  bridgeRafId = null
}

function scheduleBridgeUpdate(partial: Partial<BridgeStoreState>): void {
  pendingBridgeUpdate = { ...pendingBridgeUpdate, ...partial }
  if (!bridgeRafId) {
    bridgeRafId = requestAnimationFrame(flushBridgeUpdate)
  }
}

// =============================================================================
// PERFORMANCE MODE (Optimization #10)
// Interaction-aware: disable animations during pan/zoom
// =============================================================================

export type PerformanceMode = 'full' | 'reduced' | 'minimal'

export function getPerformanceMode(nodeCount: number): PerformanceMode {
  if (nodeCount >= 500) return 'minimal'
  if (nodeCount >= 250) return 'reduced'
  return 'full'
}

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface BridgeStoreState {
  // --- Overlay State ---
  activeAgents: Record<string, AgentActivityState>
  activeOrchestrators: Record<string, OrchestratorActivityState>
  animatedEdgeIds: string[]

  // --- Aggregate Stats ---
  totalActiveAgents: number
  totalTokensUsed: number
  totalCostUSD: number
  totalActiveRuns: number

  // --- UI State ---
  isBridgeStatusBarVisible: boolean
  userDismissedStatusBar: boolean

  // --- Settings ---
  settings: BridgeSettings

  // --- Actions ---
  handleOrchestratorEvent: (update: OrchestratorStatusUpdate) => void
  recomputeAnimatedEdges: (edges: Edge[]) => void
  dismissAgentError: (nodeId: string) => void
  toggleStatusBar: () => void
  updateSettings: (partial: Partial<BridgeSettings>) => void
  resetBridgeState: () => void
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useBridgeStore = create<BridgeStoreState>((set, get) => ({
  // Initial state
  activeAgents: {},
  activeOrchestrators: {},
  animatedEdgeIds: [],
  totalActiveAgents: 0,
  totalTokensUsed: 0,
  totalCostUSD: 0,
  totalActiveRuns: 0,
  isBridgeStatusBarVisible: false,
  userDismissedStatusBar: false,
  settings: { ...DEFAULT_BRIDGE_SETTINGS },

  // --- Handle ALL 14 Orchestrator Event Types ---

  handleOrchestratorEvent: (update: OrchestratorStatusUpdate): void => {
    const state = get()
    const newAgents = { ...state.activeAgents }
    const newOrchestrators = { ...state.activeOrchestrators }
    let showStatusBar = state.isBridgeStatusBarVisible

    switch (update.type) {
      // --- Run Lifecycle ---
      case 'run-started': {
        newOrchestrators[update.orchestratorId] = {
          status: 'orchestrating',
          runId: update.runId,
          agentCount: 0,
          completedAgentCount: 0,
          totalTokens: 0,
          totalCostUSD: 0,
          startedAt: Date.now(),
        }
        // Auto-show status bar on activity
        if (state.settings.autoShowOnActivity) {
          showStatusBar = true
        }
        break
      }
      case 'run-paused': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = { ...orch, status: 'paused' }
        }
        break
      }
      case 'run-resumed': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = { ...orch, status: 'orchestrating' }
        }
        break
      }
      case 'run-completed': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = {
            ...orch,
            status: 'completed',
            totalTokens: update.totalTokens ?? orch.totalTokens,
            totalCostUSD: update.totalCostUSD ?? orch.totalCostUSD,
          }
          // Clear orchestrator after badge persist duration
          setTimeout(() => {
            set((s) => {
              const updated = { ...s.activeOrchestrators }
              delete updated[update.orchestratorId]
              return { activeOrchestrators: updated }
            })
          }, state.settings.badgePersistDuration)
        }
        break
      }
      case 'run-completed-with-errors': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = {
            ...orch,
            status: 'error',
            totalTokens: update.totalTokens ?? orch.totalTokens,
            totalCostUSD: update.totalCostUSD ?? orch.totalCostUSD,
          }
        }
        break
      }
      case 'run-failed':
      case 'run-aborted': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = { ...orch, status: 'error' }
        }
        break
      }

      // --- Agent Lifecycle ---
      case 'agent-started': {
        if (update.agentNodeId) {
          newAgents[update.agentNodeId] = {
            status: 'running',
            currentAction: 'Processing...',
            orchestratorId: update.orchestratorId,
            runId: update.runId,
            tokensUsed: 0,
            costUSD: 0,
            startedAt: Date.now(),
          }
          // Update orchestrator agent count
          const orch = newOrchestrators[update.orchestratorId]
          if (orch) {
            newOrchestrators[update.orchestratorId] = {
              ...orch,
              agentCount: orch.agentCount + 1,
            }
          }
        }
        break
      }
      case 'agent-completed': {
        if (update.agentNodeId) {
          const existing = newAgents[update.agentNodeId]
          newAgents[update.agentNodeId] = {
            status: 'completed',
            orchestratorId: update.orchestratorId,
            runId: update.runId,
            tokensUsed: update.totalTokens ?? existing?.tokensUsed ?? 0,
            costUSD: update.totalCostUSD ?? existing?.costUSD ?? 0,
            startedAt: existing?.startedAt ?? Date.now(),
            completedAt: Date.now(),
          }
          // Auto-clear after configurable duration
          const agentNodeId = update.agentNodeId
          setTimeout(() => {
            set((s) => {
              const updated = { ...s.activeAgents }
              if (updated[agentNodeId]?.status === 'completed') {
                delete updated[agentNodeId]
              }
              return { activeAgents: updated }
            })
          }, state.settings.badgePersistDuration)
          // Update orchestrator completed count
          const orch = newOrchestrators[update.orchestratorId]
          if (orch) {
            newOrchestrators[update.orchestratorId] = {
              ...orch,
              completedAgentCount: orch.completedAgentCount + 1,
            }
          }
        }
        break
      }
      case 'agent-failed': {
        if (update.agentNodeId) {
          const existing = newAgents[update.agentNodeId]
          newAgents[update.agentNodeId] = {
            status: 'error',
            currentAction: update.error ?? 'Unknown error',
            orchestratorId: update.orchestratorId,
            runId: update.runId,
            tokensUsed: existing?.tokensUsed ?? 0,
            costUSD: existing?.costUSD ?? 0,
            startedAt: existing?.startedAt ?? Date.now(),
          }
          // Error badges persist until next run or manual dismiss
        }
        break
      }
      case 'agent-retrying': {
        if (update.agentNodeId) {
          const existing = newAgents[update.agentNodeId]
          if (existing) {
            newAgents[update.agentNodeId] = {
              ...existing,
              status: 'running',
              currentAction: 'Retrying...',
            }
          }
        }
        break
      }
      case 'agent-skipped': {
        if (update.agentNodeId) {
          newAgents[update.agentNodeId] = {
            status: 'completed',
            currentAction: 'Skipped (condition not met)',
            orchestratorId: update.orchestratorId,
            runId: update.runId,
            tokensUsed: 0,
            costUSD: 0,
            startedAt: Date.now(),
            completedAt: Date.now(),
          }
          const agentNodeId = update.agentNodeId
          setTimeout(() => {
            set((s) => {
              const updated = { ...s.activeAgents }
              delete updated[agentNodeId]
              return { activeAgents: updated }
            })
          }, state.settings.badgePersistDuration)
        }
        break
      }

      // --- Budget Events ---
      case 'budget-warning': {
        console.warn('[Bridge] Budget warning for orchestrator:', update.orchestratorId)
        break
      }
      case 'budget-exceeded': {
        const orch = newOrchestrators[update.orchestratorId]
        if (orch) {
          newOrchestrators[update.orchestratorId] = { ...orch, status: 'error' }
        }
        break
      }
    }

    // Recompute aggregates
    const agentEntries = Object.values(newAgents)
    const runningAgents = agentEntries.filter(a =>
      a.status === 'running' || a.status === 'queued'
    )

    // Use RAF batching for high-frequency updates
    scheduleBridgeUpdate({
      activeAgents: newAgents,
      activeOrchestrators: newOrchestrators,
      totalActiveAgents: runningAgents.length,
      totalTokensUsed: agentEntries.reduce((sum, a) => sum + a.tokensUsed, 0),
      totalCostUSD: agentEntries.reduce((sum, a) => sum + a.costUSD, 0),
      totalActiveRuns: Object.values(newOrchestrators)
        .filter(o => o.status === 'orchestrating').length,
      isBridgeStatusBarVisible: showStatusBar,
    })
  },

  recomputeAnimatedEdges: (edges: Edge[]): void => {
    const { activeAgents } = get()
    const runningAgentIds = Object.entries(activeAgents)
      .filter(([_, s]) => s.status === 'running')
      .map(([id]) => id)

    if (runningAgentIds.length === 0) {
      if (get().animatedEdgeIds.length > 0) {
        set({ animatedEdgeIds: [] })
      }
      return
    }

    // Build edge lookup index for O(1) access
    const edgesByTarget = new Map<string, string[]>()
    for (const edge of edges) {
      const existing = edgesByTarget.get(edge.target) || []
      existing.push(edge.id)
      edgesByTarget.set(edge.target, existing)
    }

    const animated: string[] = []
    for (const agentId of runningAgentIds) {
      const inbound = edgesByTarget.get(agentId) || []
      animated.push(...inbound)
    }

    // Cap at 20 animated edges for performance
    set({ animatedEdgeIds: animated.slice(0, 20) })
  },

  dismissAgentError: (nodeId: string): void => {
    set((state) => {
      const updated = { ...state.activeAgents }
      delete updated[nodeId]
      return { activeAgents: updated }
    })
  },

  toggleStatusBar: (): void => {
    set((state) => ({
      isBridgeStatusBarVisible: !state.isBridgeStatusBarVisible,
      userDismissedStatusBar: state.isBridgeStatusBarVisible,
    }))
  },

  updateSettings: (partial: Partial<BridgeSettings>): void => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }))
  },

  resetBridgeState: (): void => {
    set({
      activeAgents: {},
      activeOrchestrators: {},
      animatedEdgeIds: [],
      totalActiveAgents: 0,
      totalTokensUsed: 0,
      totalCostUSD: 0,
      totalActiveRuns: 0,
      isBridgeStatusBarVisible: false,
      userDismissedStatusBar: false,
    })
  },
}))

// =============================================================================
// IPC INITIALIZATION
// Subscribe to orchestrator status updates for bridge overlay
// =============================================================================

export function initBridgeIPC(): () => void {
  if (!window.api?.orchestrator) {
    console.warn('[BridgeStore] orchestrator API not available, bridge disabled')
    return () => {}
  }

  // Subscribe to orchestrator status updates
  // Separate listener from orchestratorStore's listener
  const cleanup = window.api.orchestrator.onStatusUpdate(
    (update: OrchestratorStatusUpdate) => {
      useBridgeStore.getState().handleOrchestratorEvent(update)
    }
  )

  return cleanup
}
