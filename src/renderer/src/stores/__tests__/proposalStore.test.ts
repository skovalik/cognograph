import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useProposalStore } from '../proposalStore'
import type { Proposal, ProposedChange } from '@shared/types/bridge'

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTestProposal(overrides?: Partial<Proposal>): Proposal {
  return {
    id: 'proposal-1',
    status: 'pending',
    changes: [
      {
        id: 'change-1',
        type: 'create-node',
        nodeType: 'note',
        nodeData: { title: 'Test Note', content: 'Test content' },
        position: { x: 100, y: 200 },
        agentNodeId: 'agent-1',
        agentName: 'Test Agent',
      },
      {
        id: 'change-2',
        type: 'create-node',
        nodeType: 'task',
        nodeData: { title: 'Test Task' },
        position: { x: 300, y: 200 },
        agentNodeId: 'agent-1',
        agentName: 'Test Agent',
      },
      {
        id: 'change-3',
        type: 'create-edge',
        edgeData: { source: 'ghost-change-1', target: 'ghost-change-2' },
        agentNodeId: 'agent-1',
      },
    ],
    createdAt: Date.now(),
    source: {
      type: 'command-bar',
      commandText: 'Create a research workflow',
    },
    ...overrides,
  }
}

// =============================================================================
// TEST SETUP
// =============================================================================

// Mock the workspaceStore to avoid actual node/edge creation
vi.mock('../workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => ({
      addNode: vi.fn().mockReturnValue('new-node-id'),
      addEdge: vi.fn(),
      updateNode: vi.fn(),
      deleteNodes: vi.fn(),
      deleteEdges: vi.fn(),
    }),
  },
}))

beforeEach(() => {
  useProposalStore.setState({
    proposals: {},
    activeProposalId: null,
    ghostNodes: [],
    ghostEdges: [],
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// =============================================================================
// TESTS
// =============================================================================

describe('proposalStore', () => {
  describe('addProposal', () => {
    it('adds proposal and generates ghost nodes/edges', () => {
      const proposal = createTestProposal()

      useProposalStore.getState().addProposal(proposal)

      const state = useProposalStore.getState()
      expect(state.proposals['proposal-1']).toBeDefined()
      expect(state.proposals['proposal-1'].status).toBe('pending')
      expect(state.activeProposalId).toBe('proposal-1')
      expect(state.ghostNodes).toHaveLength(2) // 2 create-node changes
      expect(state.ghostEdges).toHaveLength(1) // 1 create-edge change
    })

    it('generates ghost nodes with correct data', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      const ghostNode = useProposalStore.getState().ghostNodes[0]
      expect(ghostNode.id).toBe('ghost-change-1')
      expect(ghostNode.type).toBe('ghost')
      expect(ghostNode.position).toEqual({ x: 100, y: 200 })
      expect(ghostNode.data.proposalId).toBe('proposal-1')
      expect(ghostNode.data.changeId).toBe('change-1')
      expect(ghostNode.data.nodeType).toBe('note')
      expect(ghostNode.data.title).toBe('Test Note')
      expect(ghostNode.data.agentName).toBe('Test Agent')
    })

    it('generates ghost edges with correct data', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      const ghostEdge = useProposalStore.getState().ghostEdges[0]
      expect(ghostEdge.id).toBe('ghost-edge-change-3')
      expect(ghostEdge.type).toBe('ghost')
      expect(ghostEdge.source).toBe('ghost-change-1')
      expect(ghostEdge.target).toBe('ghost-change-2')
      expect(ghostEdge.data.proposalId).toBe('proposal-1')
    })

    it('expires proposal after timeout', () => {
      useProposalStore.getState().addProposal(createTestProposal())
      expect(useProposalStore.getState().proposals['proposal-1'].status).toBe('pending')

      // Advance past default timeout (300000ms = 5 minutes)
      vi.advanceTimersByTime(300100)

      expect(useProposalStore.getState().proposals['proposal-1'].status).toBe('expired')
      expect(useProposalStore.getState().ghostNodes).toHaveLength(0)
      expect(useProposalStore.getState().ghostEdges).toHaveLength(0)
    })
  })

  describe('approveSelected', () => {
    it('approves selected changes and removes their ghost elements', () => {
      useProposalStore.getState().addProposal(createTestProposal())
      expect(useProposalStore.getState().ghostNodes).toHaveLength(2)

      // Approve only the first change
      useProposalStore.getState().approveSelected('proposal-1', ['change-1'])

      const state = useProposalStore.getState()
      // Ghost node for change-1 should be removed
      expect(state.ghostNodes).toHaveLength(1)
      expect(state.ghostNodes[0].data.changeId).toBe('change-2')
    })

    it('sets status to applied when all changes approved', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().approveSelected('proposal-1', ['change-1', 'change-2', 'change-3'])

      const state = useProposalStore.getState()
      expect(state.proposals['proposal-1'].status).toBe('applied')
      expect(state.proposals['proposal-1'].resolvedAt).toBeDefined()
      expect(state.ghostNodes).toHaveLength(0)
      expect(state.ghostEdges).toHaveLength(0)
    })

    it('does nothing for unknown proposal', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().approveSelected('nonexistent', ['change-1'])

      // State unchanged
      expect(useProposalStore.getState().ghostNodes).toHaveLength(2)
    })
  })

  describe('approveChange', () => {
    it('approves a single change', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().approveChange('proposal-1', 'change-1')

      expect(useProposalStore.getState().ghostNodes).toHaveLength(1)
    })
  })

  describe('rejectChange', () => {
    it('removes ghost elements for rejected change', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().rejectChange('proposal-1', 'change-1')

      const state = useProposalStore.getState()
      expect(state.ghostNodes).toHaveLength(1) // Only change-2's ghost remains
      expect(state.ghostNodes[0].data.changeId).toBe('change-2')
    })
  })

  describe('rejectProposal', () => {
    it('rejects entire proposal and removes all ghosts', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().rejectProposal('proposal-1')

      const state = useProposalStore.getState()
      expect(state.proposals['proposal-1'].status).toBe('rejected')
      expect(state.proposals['proposal-1'].resolvedAt).toBeDefined()
      expect(state.ghostNodes).toHaveLength(0)
      expect(state.ghostEdges).toHaveLength(0)
      expect(state.activeProposalId).toBeNull()
    })
  })

  describe('modifyChangePosition', () => {
    it('updates ghost node position and records modification', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().modifyChangePosition('proposal-1', 'change-1', { x: 500, y: 600 })

      const state = useProposalStore.getState()
      // Ghost node position updated
      const ghostNode = state.ghostNodes.find(n => n.data.changeId === 'change-1')
      expect(ghostNode?.position).toEqual({ x: 500, y: 600 })
      // Modification recorded in proposal
      expect(state.proposals['proposal-1'].userModifications?.['change-1']?.position).toEqual({ x: 500, y: 600 })
    })

    it('does nothing for unknown proposal', () => {
      useProposalStore.getState().addProposal(createTestProposal())
      const originalState = useProposalStore.getState()

      useProposalStore.getState().modifyChangePosition('nonexistent', 'change-1', { x: 500, y: 600 })

      expect(useProposalStore.getState().ghostNodes[0].position).toEqual(originalState.ghostNodes[0].position)
    })
  })

  describe('expireProposal', () => {
    it('expires pending proposal', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().expireProposal('proposal-1')

      expect(useProposalStore.getState().proposals['proposal-1'].status).toBe('expired')
    })

    it('does not expire already resolved proposal', () => {
      const proposal = createTestProposal()
      useProposalStore.getState().addProposal(proposal)
      useProposalStore.getState().rejectProposal('proposal-1')

      useProposalStore.getState().expireProposal('proposal-1')

      // Status remains 'rejected', not 'expired'
      expect(useProposalStore.getState().proposals['proposal-1'].status).toBe('rejected')
    })
  })

  describe('clearAllProposals', () => {
    it('clears all state', () => {
      useProposalStore.getState().addProposal(createTestProposal())

      useProposalStore.getState().clearAllProposals()

      const state = useProposalStore.getState()
      expect(state.proposals).toEqual({})
      expect(state.ghostNodes).toEqual([])
      expect(state.ghostEdges).toEqual([])
      expect(state.activeProposalId).toBeNull()
    })
  })

  describe('multiple proposals', () => {
    it('handles multiple proposals simultaneously', () => {
      const proposal1 = createTestProposal({ id: 'proposal-1' })
      const proposal2 = createTestProposal({
        id: 'proposal-2',
        changes: [
          {
            id: 'change-a',
            type: 'create-node',
            nodeType: 'note',
            nodeData: { title: 'Note A' },
            position: { x: 500, y: 500 },
            agentNodeId: 'agent-2',
          },
        ],
      })

      useProposalStore.getState().addProposal(proposal1)
      useProposalStore.getState().addProposal(proposal2)

      const state = useProposalStore.getState()
      expect(Object.keys(state.proposals)).toHaveLength(2)
      expect(state.ghostNodes).toHaveLength(3) // 2 from proposal-1 + 1 from proposal-2
      expect(state.activeProposalId).toBe('proposal-2') // Latest proposal is active
    })

    it('rejecting one proposal does not affect others', () => {
      const proposal1 = createTestProposal({ id: 'proposal-1' })
      const proposal2 = createTestProposal({
        id: 'proposal-2',
        changes: [
          {
            id: 'change-a',
            type: 'create-node',
            nodeType: 'note',
            position: { x: 500, y: 500 },
            agentNodeId: 'agent-2',
          },
        ],
      })

      useProposalStore.getState().addProposal(proposal1)
      useProposalStore.getState().addProposal(proposal2)

      useProposalStore.getState().rejectProposal('proposal-1')

      const state = useProposalStore.getState()
      expect(state.proposals['proposal-1'].status).toBe('rejected')
      expect(state.proposals['proposal-2'].status).toBe('pending')
      // proposal-2's ghost nodes remain
      expect(state.ghostNodes).toHaveLength(1)
      expect(state.ghostNodes[0].data.proposalId).toBe('proposal-2')
    })
  })
})
