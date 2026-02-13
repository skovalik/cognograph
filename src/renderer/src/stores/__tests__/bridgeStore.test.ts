import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBridgeStore } from '../bridgeStore'
import { DEFAULT_BRIDGE_SETTINGS } from '@shared/types/bridge'
import type { OrchestratorStatusUpdate } from '../orchestratorStore'
import type { Edge } from '@xyflow/react'

// =============================================================================
// TEST SETUP
// =============================================================================

beforeEach(() => {
  // Reset store to initial state
  useBridgeStore.setState({
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
  })

  // Setup fake timers for testing timeouts
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// =============================================================================
// TESTS
// =============================================================================

describe('bridgeStore', () => {
  describe('handleOrchestratorEvent', () => {
    it('tracks run-started event and creates orchestrator state', () => {
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1',
        runId: 'run-1',
        type: 'run-started',
      })

      // RAF batching: advance frame
      vi.advanceTimersByTime(16)

      const state = useBridgeStore.getState()
      expect(state.activeOrchestrators['orch-1']).toBeDefined()
      expect(state.activeOrchestrators['orch-1'].status).toBe('orchestrating')
      expect(state.totalActiveRuns).toBe(1)
    })

    it('tracks agent-started event', () => {
      const update: OrchestratorStatusUpdate = {
        orchestratorId: 'orch-1',
        runId: 'run-1',
        type: 'agent-started',
        agentNodeId: 'agent-1',
      }

      useBridgeStore.getState().handleOrchestratorEvent(update)
      vi.advanceTimersByTime(16)

      const state = useBridgeStore.getState()
      expect(state.activeAgents['agent-1']).toBeDefined()
      expect(state.activeAgents['agent-1'].status).toBe('running')
      expect(state.totalActiveAgents).toBe(1)
    })

    it('clears completed agent after badge persist duration', () => {
      // Start agent
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-started', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      // Complete agent
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-completed', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      expect(useBridgeStore.getState().activeAgents['agent-1']?.status).toBe('completed')

      // Advance timer past badge persist duration (default 3000ms)
      vi.advanceTimersByTime(3100)

      expect(useBridgeStore.getState().activeAgents['agent-1']).toBeUndefined()
    })

    it('handles all 14 event types without error', () => {
      const eventTypes: OrchestratorStatusUpdate['type'][] = [
        'run-started', 'agent-started', 'agent-completed', 'agent-failed',
        'agent-retrying', 'agent-skipped', 'budget-warning', 'budget-exceeded',
        'run-paused', 'run-resumed', 'run-completed', 'run-completed-with-errors',
        'run-failed', 'run-aborted',
      ]

      for (const type of eventTypes) {
        expect(() => {
          useBridgeStore.getState().handleOrchestratorEvent({
            orchestratorId: 'orch-1', runId: 'run-1', type,
            agentNodeId: 'agent-1',
          })
          vi.advanceTimersByTime(16)
        }).not.toThrow()
      }
    })

    it('persists error badges until manual dismiss', () => {
      // Agent fails
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-failed', agentNodeId: 'agent-1', error: 'Test error',
      })
      vi.advanceTimersByTime(16)

      // Error persists indefinitely
      vi.advanceTimersByTime(60000)
      expect(useBridgeStore.getState().activeAgents['agent-1']?.status).toBe('error')

      // Dismiss manually
      useBridgeStore.getState().dismissAgentError('agent-1')
      expect(useBridgeStore.getState().activeAgents['agent-1']).toBeUndefined()
    })

    it('auto-shows status bar on run-started', () => {
      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(false)

      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1', type: 'run-started',
      })
      vi.advanceTimersByTime(16)

      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(true)
    })

    it('does not auto-show when autoShowOnActivity is disabled', () => {
      useBridgeStore.getState().updateSettings({ autoShowOnActivity: false })

      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1', type: 'run-started',
      })
      vi.advanceTimersByTime(16)

      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(false)
    })

    it('tracks run-paused and run-resumed transitions', () => {
      // Start run
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1', type: 'run-started',
      })
      vi.advanceTimersByTime(16)
      expect(useBridgeStore.getState().activeOrchestrators['orch-1'].status).toBe('orchestrating')

      // Pause
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1', type: 'run-paused',
      })
      vi.advanceTimersByTime(16)
      expect(useBridgeStore.getState().activeOrchestrators['orch-1'].status).toBe('paused')

      // Resume
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1', type: 'run-resumed',
      })
      vi.advanceTimersByTime(16)
      expect(useBridgeStore.getState().activeOrchestrators['orch-1'].status).toBe('orchestrating')
    })

    it('handles agent-retrying by setting status back to running', () => {
      // Start agent
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-started', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      // Agent retrying
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-retrying', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      const state = useBridgeStore.getState()
      expect(state.activeAgents['agent-1'].status).toBe('running')
      expect(state.activeAgents['agent-1'].currentAction).toBe('Retrying...')
    })

    it('tracks token and cost aggregates', () => {
      // Start agent
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-started', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      // Complete with tokens/cost
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-completed', agentNodeId: 'agent-1',
        totalTokens: 500, totalCostUSD: 0.005,
      })
      vi.advanceTimersByTime(16)

      const state = useBridgeStore.getState()
      expect(state.totalTokensUsed).toBe(500)
      expect(state.totalCostUSD).toBe(0.005)
    })
  })

  describe('recomputeAnimatedEdges', () => {
    it('animates inbound edges of running agents', () => {
      // Set agent-1 as running
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-started', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      const edges = [
        { id: 'e1', source: 'note-1', target: 'agent-1' },
        { id: 'e2', source: 'note-2', target: 'agent-1' },
        { id: 'e3', source: 'note-3', target: 'other-node' },
      ] as Edge[]

      useBridgeStore.getState().recomputeAnimatedEdges(edges)

      expect(useBridgeStore.getState().animatedEdgeIds).toEqual(['e1', 'e2'])
    })

    it('caps animated edges at 20', () => {
      useBridgeStore.getState().handleOrchestratorEvent({
        orchestratorId: 'orch-1', runId: 'run-1',
        type: 'agent-started', agentNodeId: 'agent-1',
      })
      vi.advanceTimersByTime(16)

      const edges = Array.from({ length: 30 }, (_, i) => ({
        id: `e${i}`, source: `note-${i}`, target: 'agent-1',
      })) as Edge[]

      useBridgeStore.getState().recomputeAnimatedEdges(edges)

      expect(useBridgeStore.getState().animatedEdgeIds.length).toBe(20)
    })

    it('clears animated edges when no agents are running', () => {
      // Set some animated edges
      useBridgeStore.setState({ animatedEdgeIds: ['e1', 'e2'] })

      useBridgeStore.getState().recomputeAnimatedEdges([])

      expect(useBridgeStore.getState().animatedEdgeIds).toEqual([])
    })
  })

  describe('toggleStatusBar', () => {
    it('toggles visibility', () => {
      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(false)

      useBridgeStore.getState().toggleStatusBar()
      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(true)

      useBridgeStore.getState().toggleStatusBar()
      expect(useBridgeStore.getState().isBridgeStatusBarVisible).toBe(false)
    })

    it('marks userDismissedStatusBar when hiding', () => {
      useBridgeStore.setState({ isBridgeStatusBarVisible: true })

      useBridgeStore.getState().toggleStatusBar()

      expect(useBridgeStore.getState().userDismissedStatusBar).toBe(true)
    })
  })

  describe('resetBridgeState', () => {
    it('clears all state', () => {
      // Set up some state
      useBridgeStore.setState({
        activeAgents: { 'a1': { status: 'running', tokensUsed: 100, costUSD: 0.01, startedAt: 0 } },
        activeOrchestrators: { 'o1': { status: 'orchestrating', runId: 'r1', agentCount: 1, completedAgentCount: 0, totalTokens: 0, totalCostUSD: 0, startedAt: 0 } },
        animatedEdgeIds: ['e1'],
        totalActiveAgents: 1,
        totalTokensUsed: 100,
        isBridgeStatusBarVisible: true,
      })

      useBridgeStore.getState().resetBridgeState()

      const state = useBridgeStore.getState()
      expect(state.activeAgents).toEqual({})
      expect(state.activeOrchestrators).toEqual({})
      expect(state.animatedEdgeIds).toEqual([])
      expect(state.totalActiveAgents).toBe(0)
      expect(state.isBridgeStatusBarVisible).toBe(false)
    })
  })

  describe('updateSettings', () => {
    it('partially updates settings', () => {
      useBridgeStore.getState().updateSettings({ badgePersistDuration: 5000 })

      expect(useBridgeStore.getState().settings.badgePersistDuration).toBe(5000)
      // Other settings unchanged
      expect(useBridgeStore.getState().settings.enableOverlay).toBe(true)
    })
  })
})
