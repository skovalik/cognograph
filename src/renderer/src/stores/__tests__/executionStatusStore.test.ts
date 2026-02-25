import { describe, it, expect, beforeEach } from 'vitest'
import { useExecutionStatusStore } from '../executionStatusStore'
import type { NodeExecutionState } from '../executionStatusStore'

// =============================================================================
// TEST SETUP
// =============================================================================

beforeEach(() => {
  // Reset store to initial state before each test
  useExecutionStatusStore.setState({ nodeExecutions: {} })
})

// =============================================================================
// HELPERS
// =============================================================================

function makeExecution(
  overrides: Partial<NodeExecutionState> = {}
): NodeExecutionState {
  return {
    status: 'active',
    orchestratorId: 'orch-1',
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('executionStatusStore', () => {
  describe('setNodeExecution', () => {
    it('adds an execution entry for a node', () => {
      const exec = makeExecution({ message: 'Running step 1' })
      useExecutionStatusStore.getState().setNodeExecution('node-1', exec)

      const state = useExecutionStatusStore.getState()
      expect(state.nodeExecutions['node-1']).toEqual(exec)
    })

    it('overwrites a previous execution entry for the same node', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'active' }))
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'complete' }))

      const state = useExecutionStatusStore.getState()
      expect(state.nodeExecutions['node-1'].status).toBe('complete')
    })

    it('preserves entries for other nodes when adding', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution())
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution({ orchestratorId: 'orch-2' }))

      const state = useExecutionStatusStore.getState()
      expect(Object.keys(state.nodeExecutions)).toHaveLength(2)
      expect(state.nodeExecutions['node-1']).toBeDefined()
      expect(state.nodeExecutions['node-2']).toBeDefined()
    })
  })

  describe('clearNodeExecution', () => {
    it('removes the execution entry for a specific node', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution())
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution())

      useExecutionStatusStore.getState().clearNodeExecution('node-1')

      const state = useExecutionStatusStore.getState()
      expect(state.nodeExecutions['node-1']).toBeUndefined()
      expect(state.nodeExecutions['node-2']).toBeDefined()
    })

    it('is a no-op if nodeId does not exist', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution())

      useExecutionStatusStore.getState().clearNodeExecution('non-existent')

      const state = useExecutionStatusStore.getState()
      expect(Object.keys(state.nodeExecutions)).toHaveLength(1)
    })
  })

  describe('clearOrchestratorExecutions', () => {
    it('removes all entries for a given orchestrator', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ orchestratorId: 'orch-A' }))
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution({ orchestratorId: 'orch-A' }))
      useExecutionStatusStore.getState().setNodeExecution('node-3', makeExecution({ orchestratorId: 'orch-B' }))

      useExecutionStatusStore.getState().clearOrchestratorExecutions('orch-A')

      const state = useExecutionStatusStore.getState()
      expect(state.nodeExecutions['node-1']).toBeUndefined()
      expect(state.nodeExecutions['node-2']).toBeUndefined()
      expect(state.nodeExecutions['node-3']).toBeDefined()
      expect(state.nodeExecutions['node-3'].orchestratorId).toBe('orch-B')
    })

    it('is a no-op if orchestratorId has no entries', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ orchestratorId: 'orch-A' }))

      useExecutionStatusStore.getState().clearOrchestratorExecutions('orch-NONE')

      expect(Object.keys(useExecutionStatusStore.getState().nodeExecutions)).toHaveLength(1)
    })
  })

  describe('clearAll', () => {
    it('resets the store to empty', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution())
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution())
      useExecutionStatusStore.getState().setNodeExecution('node-3', makeExecution())

      useExecutionStatusStore.getState().clearAll()

      expect(useExecutionStatusStore.getState().nodeExecutions).toEqual({})
    })
  })

  describe('getNodeExecution', () => {
    it('returns execution state for a known node', () => {
      const exec = makeExecution({ stepIndex: 3, message: 'Processing' })
      useExecutionStatusStore.getState().setNodeExecution('node-1', exec)

      const result = useExecutionStatusStore.getState().getNodeExecution('node-1')
      expect(result).toEqual(exec)
    })

    it('returns undefined for an unknown node', () => {
      const result = useExecutionStatusStore.getState().getNodeExecution('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('getActiveOrchestrators', () => {
    it('returns unique orchestrator IDs across all executions', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ orchestratorId: 'orch-A' }))
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution({ orchestratorId: 'orch-A' }))
      useExecutionStatusStore.getState().setNodeExecution('node-3', makeExecution({ orchestratorId: 'orch-B' }))

      const orchestrators = useExecutionStatusStore.getState().getActiveOrchestrators()
      expect(orchestrators).toHaveLength(2)
      expect(orchestrators).toContain('orch-A')
      expect(orchestrators).toContain('orch-B')
    })

    it('returns empty array when no executions exist', () => {
      expect(useExecutionStatusStore.getState().getActiveOrchestrators()).toEqual([])
    })
  })

  describe('isAnyExecutionActive', () => {
    it('returns true when any execution has status active', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'active' }))

      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(true)
    })

    it('returns true when any execution has status queued', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'queued' }))

      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(true)
    })

    it('returns false when all executions are complete', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'complete' }))
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution({ status: 'complete' }))

      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(false)
    })

    it('returns false when all executions are error', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'error', error: 'fail' }))

      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(false)
    })

    it('returns false when no executions exist', () => {
      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(false)
    })

    it('returns true when mix of statuses includes active or queued', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-1', makeExecution({ status: 'complete' }))
      useExecutionStatusStore.getState().setNodeExecution('node-2', makeExecution({ status: 'error' }))
      useExecutionStatusStore.getState().setNodeExecution('node-3', makeExecution({ status: 'queued' }))

      expect(useExecutionStatusStore.getState().isAnyExecutionActive()).toBe(true)
    })
  })

  describe('multiple orchestrators running simultaneously', () => {
    it('supports concurrent executions from different orchestrators', () => {
      useExecutionStatusStore.getState().setNodeExecution('node-A1', makeExecution({
        orchestratorId: 'orch-A',
        status: 'active',
        stepIndex: 0,
      }))
      useExecutionStatusStore.getState().setNodeExecution('node-A2', makeExecution({
        orchestratorId: 'orch-A',
        status: 'queued',
        stepIndex: 1,
      }))
      useExecutionStatusStore.getState().setNodeExecution('node-B1', makeExecution({
        orchestratorId: 'orch-B',
        status: 'active',
        stepIndex: 0,
      }))

      const state = useExecutionStatusStore.getState()
      expect(Object.keys(state.nodeExecutions)).toHaveLength(3)
      expect(state.getActiveOrchestrators()).toHaveLength(2)
      expect(state.isAnyExecutionActive()).toBe(true)

      // Clear one orchestrator, the other persists
      state.clearOrchestratorExecutions('orch-A')
      const after = useExecutionStatusStore.getState()
      expect(Object.keys(after.nodeExecutions)).toHaveLength(1)
      expect(after.nodeExecutions['node-B1']).toBeDefined()
      expect(after.getActiveOrchestrators()).toEqual(['orch-B'])
    })
  })

  describe('full execution lifecycle', () => {
    it('tracks node through queued -> active -> complete lifecycle', () => {
      const { setNodeExecution, getNodeExecution } = useExecutionStatusStore.getState()

      // Queued
      setNodeExecution('node-1', makeExecution({ status: 'queued', stepIndex: 2 }))
      expect(getNodeExecution('node-1')?.status).toBe('queued')

      // Active
      setNodeExecution('node-1', makeExecution({ status: 'active', stepIndex: 2, startedAt: Date.now() }))
      expect(getNodeExecution('node-1')?.status).toBe('active')

      // Complete
      setNodeExecution('node-1', makeExecution({ status: 'complete', stepIndex: 2, completedAt: Date.now() }))
      expect(getNodeExecution('node-1')?.status).toBe('complete')
    })

    it('tracks node through queued -> active -> error lifecycle', () => {
      const { setNodeExecution, getNodeExecution } = useExecutionStatusStore.getState()

      setNodeExecution('node-1', makeExecution({ status: 'queued' }))
      setNodeExecution('node-1', makeExecution({ status: 'active', startedAt: Date.now() }))
      setNodeExecution('node-1', makeExecution({ status: 'error', error: 'API rate limit exceeded' }))

      const result = getNodeExecution('node-1')
      expect(result?.status).toBe('error')
      expect(result?.error).toBe('API rate limit exceeded')
    })
  })
})
