// Execution Status Store — Phase 5A: Visible Execution State Badges
// Tracks per-node execution state during orchestrated AI workflows.
// Each node participating in an orchestrator pipeline gets a status
// entry (active, queued, complete, error) that drives visual badges.

import { create } from 'zustand'

export type ExecutionStatus = 'active' | 'queued' | 'complete' | 'error'

export interface NodeExecutionState {
  status: ExecutionStatus
  orchestratorId: string  // which orchestrator is running this
  stepIndex?: number      // position in pipeline
  message?: string        // optional status message
  startedAt?: number      // timestamp
  completedAt?: number    // timestamp
  error?: string          // error message if status === 'error'
}

interface ExecutionStatusStore {
  // Map of nodeId -> execution state
  nodeExecutions: Record<string, NodeExecutionState>

  // Actions
  setNodeExecution: (nodeId: string, state: NodeExecutionState) => void
  clearNodeExecution: (nodeId: string) => void
  clearOrchestratorExecutions: (orchestratorId: string) => void
  clearAll: () => void

  // Selectors (as methods for convenience; also usable inline)
  getNodeExecution: (nodeId: string) => NodeExecutionState | undefined
  getActiveOrchestrators: () => string[]
  isAnyExecutionActive: () => boolean
}

export const useExecutionStatusStore = create<ExecutionStatusStore>()((set, get) => ({
  nodeExecutions: {},

  setNodeExecution: (nodeId, state) => {
    set((prev) => ({
      nodeExecutions: {
        ...prev.nodeExecutions,
        [nodeId]: state,
      },
    }))
  },

  clearNodeExecution: (nodeId) => {
    set((prev) => {
      const next = { ...prev.nodeExecutions }
      delete next[nodeId]
      return { nodeExecutions: next }
    })
  },

  clearOrchestratorExecutions: (orchestratorId) => {
    set((prev) => {
      const next: Record<string, NodeExecutionState> = {}
      for (const [nodeId, state] of Object.entries(prev.nodeExecutions)) {
        if (state.orchestratorId !== orchestratorId) {
          next[nodeId] = state
        }
      }
      return { nodeExecutions: next }
    })
  },

  clearAll: () => {
    set({ nodeExecutions: {} })
  },

  getNodeExecution: (nodeId) => {
    return get().nodeExecutions[nodeId]
  },

  getActiveOrchestrators: () => {
    const seen = new Set<string>()
    for (const state of Object.values(get().nodeExecutions)) {
      seen.add(state.orchestratorId)
    }
    return Array.from(seen)
  },

  isAnyExecutionActive: () => {
    for (const state of Object.values(get().nodeExecutions)) {
      if (state.status === 'active' || state.status === 'queued') {
        return true
      }
    }
    return false
  },
}))
