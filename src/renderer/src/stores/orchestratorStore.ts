/**
 * Orchestrator Store
 *
 * Lightweight Zustand store for orchestrator UI state.
 * Persistent data lives on OrchestratorNodeData in the workspace;
 * this store manages transient UI concerns (active run tracking, animations).
 */

import { create } from 'zustand'
import type { OrchestratorRunStatus } from '@shared/types'

// Status update shape from IPC
export interface OrchestratorStatusUpdate {
  orchestratorId: string
  runId: string
  type:
    | 'run-started'
    | 'agent-started'
    | 'agent-completed'
    | 'agent-failed'
    | 'agent-retrying'
    | 'agent-skipped'
    | 'budget-warning'
    | 'budget-exceeded'
    | 'run-paused'
    | 'run-resumed'
    | 'run-completed'
    | 'run-completed-with-errors'
    | 'run-failed'
    | 'run-aborted'
  agentNodeId?: string
  totalTokens?: number
  totalCostUSD?: number
  error?: string
}

interface ActiveRunInfo {
  orchestratorId: string
  runId: string
  status: OrchestratorRunStatus
  currentAgentId: string | null
  progress: number // 0-1
}

interface OrchestratorStoreState {
  // Active runs being tracked in the UI
  activeRuns: Map<string, ActiveRunInfo>

  // Actions
  handleStatusUpdate: (update: OrchestratorStatusUpdate) => void
  startRun: (orchestratorId: string) => Promise<void>
  pauseRun: (orchestratorId: string) => void
  resumeRun: (orchestratorId: string) => void
  abortRun: (orchestratorId: string) => void

  // UI state
  expandedOrchestratorId: string | null
  setExpandedOrchestrator: (id: string | null) => void
}

export const useOrchestratorStore = create<OrchestratorStoreState>((set, get) => ({
  activeRuns: new Map(),
  expandedOrchestratorId: null,

  handleStatusUpdate: (update: OrchestratorStatusUpdate): void => {
    set((state) => {
      const newRuns = new Map(state.activeRuns)

      switch (update.type) {
        case 'run-started': {
          newRuns.set(update.orchestratorId, {
            orchestratorId: update.orchestratorId,
            runId: update.runId,
            status: 'running',
            currentAgentId: null,
            progress: 0,
          })
          break
        }
        case 'agent-started': {
          const existing = newRuns.get(update.orchestratorId)
          if (existing) {
            newRuns.set(update.orchestratorId, {
              ...existing,
              currentAgentId: update.agentNodeId ?? null,
            })
          }
          break
        }
        case 'agent-completed':
        case 'agent-failed':
        case 'agent-skipped':
        case 'agent-retrying': {
          const existing = newRuns.get(update.orchestratorId)
          if (existing) {
            newRuns.set(update.orchestratorId, {
              ...existing,
              currentAgentId: update.type === 'agent-retrying' ? update.agentNodeId ?? null : null,
            })
          }
          break
        }
        case 'run-paused': {
          const existing = newRuns.get(update.orchestratorId)
          if (existing) {
            newRuns.set(update.orchestratorId, { ...existing, status: 'paused' })
          }
          break
        }
        case 'run-resumed': {
          const existing = newRuns.get(update.orchestratorId)
          if (existing) {
            newRuns.set(update.orchestratorId, { ...existing, status: 'running' })
          }
          break
        }
        case 'run-completed': {
          newRuns.delete(update.orchestratorId)
          break
        }
        case 'run-completed-with-errors': {
          newRuns.delete(update.orchestratorId)
          break
        }
        case 'run-failed':
        case 'run-aborted': {
          newRuns.delete(update.orchestratorId)
          break
        }
        case 'budget-warning':
        case 'budget-exceeded': {
          // No structural change, just informational
          break
        }
      }

      return { activeRuns: newRuns }
    })
  },

  startRun: async (orchestratorId: string): Promise<void> => {
    if (!window.api?.orchestrator) {
      console.error('[OrchestratorStore] orchestrator API not available')
      return
    }

    try {
      await window.api.orchestrator.start(orchestratorId)
    } catch (err) {
      console.error('[OrchestratorStore] Failed to start orchestration:', err)
    }
  },

  pauseRun: (orchestratorId: string): void => {
    if (!window.api?.orchestrator) return
    window.api.orchestrator.pause(orchestratorId).catch((err: unknown) => {
      console.error('[OrchestratorStore] Failed to pause:', err)
    })
  },

  resumeRun: (orchestratorId: string): void => {
    if (!window.api?.orchestrator) return
    window.api.orchestrator.resume(orchestratorId).catch((err: unknown) => {
      console.error('[OrchestratorStore] Failed to resume:', err)
    })
  },

  abortRun: (orchestratorId: string): void => {
    if (!window.api?.orchestrator) return
    window.api.orchestrator.abort(orchestratorId).catch((err: unknown) => {
      console.error('[OrchestratorStore] Failed to abort:', err)
    })
  },

  setExpandedOrchestrator: (id: string | null): void => {
    set({ expandedOrchestratorId: id })
  },
}))

// Initialize IPC listener for status updates (called once on app mount)
export function initOrchestratorIPC(): () => void {
  if (!window.api?.orchestrator) {
    return () => {}
  }

  const cleanup = window.api.orchestrator.onStatusUpdate((update: OrchestratorStatusUpdate) => {
    useOrchestratorStore.getState().handleStatusUpdate(update)
  })

  // Resync active runs on renderer mount
  window.api.orchestrator.resync().then((activeRuns) => {
    const store = useOrchestratorStore.getState()
    for (const [orchestratorId, runInfo] of Object.entries(activeRuns)) {
      store.handleStatusUpdate({
        orchestratorId,
        runId: runInfo.runId,
        type: 'run-started',
      })
    }
  }).catch((err: unknown) => {
    console.warn('[OrchestratorStore] Resync failed (orchestrator API may not be registered yet):', err)
  })

  return cleanup
}
