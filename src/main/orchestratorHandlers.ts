/**
 * Orchestrator IPC Handlers
 *
 * Registers IPC handlers for orchestrator lifecycle commands:
 * - orchestrator:start
 * - orchestrator:pause
 * - orchestrator:resume
 * - orchestrator:abort
 * - orchestrator:resync
 */

import { ipcMain } from 'electron'
import {
  startOrchestration,
  pauseOrchestration,
  resumeOrchestration,
  abortOrchestration,
  getActiveRuns,
} from './services/orchestratorService'
import type { OrchestratorNodeData } from '../shared/types/nodes'

export function registerOrchestratorHandlers(): void {
  ipcMain.handle(
    'orchestrator:start',
    async (_event, orchestratorId: string, parentOrchestrationId?: string) => {
      // The renderer passes orchestratorId. We need the node data to get
      // agent list, strategy, budget, etc. The renderer should send this
      // via the workspace data, but for now we accept the request and
      // the renderer is responsible for providing data via the status update flow.
      // In the full implementation, the main process would read workspace state.

      // For now, create a minimal OrchestratorNodeData from the request
      // The real implementation will read this from workspace state.
      const stubData: OrchestratorNodeData = {
        type: 'orchestrator',
        title: 'Orchestrator',
        strategy: 'sequential',
        failurePolicy: { type: 'retry-and-continue', maxRetries: 1, retryDelayMs: 2000 },
        budget: {},
        connectedAgents: [],
        runHistory: [],
        maxHistoryRuns: 20,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      return startOrchestration(orchestratorId, stubData, parentOrchestrationId)
    }
  )

  ipcMain.handle('orchestrator:pause', async (_event, orchestratorId: string) => {
    return pauseOrchestration(orchestratorId)
  })

  ipcMain.handle('orchestrator:resume', async (_event, orchestratorId: string) => {
    return resumeOrchestration(orchestratorId)
  })

  ipcMain.handle('orchestrator:abort', async (_event, orchestratorId: string) => {
    return abortOrchestration(orchestratorId)
  })

  ipcMain.handle('orchestrator:resync', async () => {
    return getActiveRuns()
  })
}
