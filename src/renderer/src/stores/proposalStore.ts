/**
 * Proposal Store -- Ghost Node proposal system state management
 *
 * Manages the proposal lifecycle:
 *   Agent proposes changes -> Ghost nodes render -> User approves/rejects -> Applied to workspace
 *
 * Ghost nodes and edges are React Flow elements that render as translucent previews.
 * Proposals expire after configurable timeout (default 5 minutes).
 */

import { create } from 'zustand'
import type { Proposal, ProposedChange, ProposalStatus } from '@shared/types/bridge'
import { DEFAULT_BRIDGE_SETTINGS } from '@shared/types/bridge'
import { useWorkspaceStore } from './workspaceStore'
import type { NodeData } from '@shared/types'

// =============================================================================
// GHOST ELEMENT TYPES
// =============================================================================

export interface GhostNodeElement {
  id: string
  type: 'ghost'
  position: { x: number; y: number }
  data: {
    proposalId: string
    changeId: string
    nodeType: string
    title: string
    previewContent?: string
    agentName: string
    isSelected: boolean
  }
}

export interface GhostEdgeElement {
  id: string
  type: 'ghost'
  source: string
  target: string
  data: {
    proposalId: string
    changeId: string
    label?: string
  }
}

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface ProposalStoreState {
  // Active proposals
  proposals: Record<string, Proposal>
  activeProposalId: string | null

  // Ghost node/edge data for React Flow
  ghostNodes: GhostNodeElement[]
  ghostEdges: GhostEdgeElement[]

  // Actions
  addProposal: (proposal: Proposal) => void
  approveSelected: (proposalId: string, changeIds: string[]) => void
  approveChange: (proposalId: string, changeId: string) => void
  rejectChange: (proposalId: string, changeId: string) => void
  rejectProposal: (proposalId: string) => void
  modifyChangePosition: (proposalId: string, changeId: string, position: { x: number; y: number }) => void
  setActiveProposal: (proposalId: string | null) => void
  expireProposal: (proposalId: string) => void
  clearAllProposals: () => void
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Generate ghost React Flow elements from a proposal's changes */
function generateGhosts(proposal: Proposal): {
  ghostNodes: GhostNodeElement[]
  ghostEdges: GhostEdgeElement[]
} {
  const ghostNodes: GhostNodeElement[] = []
  const ghostEdges: GhostEdgeElement[] = []

  for (const change of proposal.changes) {
    if (change.type === 'create-node' && change.position) {
      ghostNodes.push({
        id: `ghost-${change.id}`,
        type: 'ghost',
        position: change.position,
        data: {
          proposalId: proposal.id,
          changeId: change.id,
          nodeType: change.nodeType || 'note',
          title: (change.nodeData?.title as string) || 'New Node',
          previewContent: (change.nodeData?.description as string) || (change.nodeData?.content as string),
          agentName: change.agentName || 'Agent',
          isSelected: true,
        },
      })
    }

    if (change.type === 'create-edge' && change.edgeData) {
      ghostEdges.push({
        id: `ghost-edge-${change.id}`,
        type: 'ghost',
        source: change.edgeData.source,
        target: change.edgeData.target,
        data: {
          proposalId: proposal.id,
          changeId: change.id,
        },
      })
    }
  }

  return { ghostNodes, ghostEdges }
}

/** Remove all ghost elements associated with a proposal */
function removeGhostsForProposal(
  proposalId: string,
  state: Pick<ProposalStoreState, 'ghostNodes' | 'ghostEdges'>
): { ghostNodes: GhostNodeElement[]; ghostEdges: GhostEdgeElement[] } {
  return {
    ghostNodes: state.ghostNodes.filter(
      n => n.data.proposalId !== proposalId
    ),
    ghostEdges: state.ghostEdges.filter(
      e => e.data.proposalId !== proposalId
    ),
  }
}

/** Apply a single approved change to the workspace store */
function applyChange(
  change: ProposedChange,
  modifications?: Partial<ProposedChange>
): void {
  const store = useWorkspaceStore.getState()
  const position = modifications?.position || change.position

  switch (change.type) {
    case 'create-node': {
      const nodeType = (change.nodeType || 'note') as NodeData['type']
      const nodeId = store.addNode(nodeType, position || { x: 0, y: 0 })
      // Apply additional node data if provided
      if (change.nodeData && nodeId) {
        const { type: _type, ...dataWithoutType } = change.nodeData
        if (Object.keys(dataWithoutType).length > 0) {
          store.updateNode(nodeId, dataWithoutType as Partial<NodeData>)
        }
      }
      break
    }
    case 'create-edge': {
      if (change.edgeData) {
        store.addEdge({
          source: change.edgeData.source,
          target: change.edgeData.target,
          sourceHandle: null,
          targetHandle: null,
        })
      }
      break
    }
    case 'update-node': {
      if (change.targetId && change.nodeData) {
        store.updateNode(change.targetId, change.nodeData as Partial<NodeData>)
      }
      break
    }
    case 'delete-node': {
      if (change.targetId) {
        store.deleteNodes([change.targetId])
      }
      break
    }
    case 'delete-edge': {
      if (change.targetId) {
        store.deleteEdges([change.targetId])
      }
      break
    }
  }
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useProposalStore = create<ProposalStoreState>((set, get) => ({
  proposals: {},
  activeProposalId: null,
  ghostNodes: [],
  ghostEdges: [],

  addProposal: (proposal: Proposal): void => {
    // Generate ghost elements from the proposal
    const { ghostNodes, ghostEdges } = generateGhosts(proposal)

    set((state) => ({
      proposals: { ...state.proposals, [proposal.id]: proposal },
      activeProposalId: proposal.id,
      ghostNodes: [...state.ghostNodes, ...ghostNodes],
      ghostEdges: [...state.ghostEdges, ...ghostEdges],
    }))

    // Set expiration timer
    const timeout = DEFAULT_BRIDGE_SETTINGS.proposalTimeoutMs
    setTimeout(() => {
      get().expireProposal(proposal.id)
    }, timeout)
  },

  approveSelected: (proposalId: string, changeIds: string[]): void => {
    const proposal = get().proposals[proposalId]
    if (!proposal) return

    // Apply selected changes via workspace store
    const changesToApply = proposal.changes.filter(c => changeIds.includes(c.id))
    for (const change of changesToApply) {
      applyChange(change, proposal.userModifications?.[change.id])
    }

    // Update proposal status
    set((state) => {
      const proposals = { ...state.proposals }
      const allChangesApproved = changeIds.length === proposal.changes.length
      proposals[proposalId] = {
        ...proposals[proposalId],
        status: allChangesApproved ? 'applied' : proposals[proposalId].status,
        resolvedAt: allChangesApproved ? Date.now() : undefined,
      }

      // Remove ghost nodes/edges for approved changes
      const ghostNodes = state.ghostNodes.filter(
        n => !(n.data.proposalId === proposalId && changeIds.includes(n.data.changeId))
      )
      const ghostEdges = state.ghostEdges.filter(
        e => !(e.data.proposalId === proposalId && changeIds.includes(e.data.changeId))
      )

      return {
        proposals,
        ghostNodes,
        ghostEdges,
        activeProposalId: allChangesApproved && state.activeProposalId === proposalId
          ? null
          : state.activeProposalId,
      }
    })
  },

  approveChange: (proposalId: string, changeId: string): void => {
    get().approveSelected(proposalId, [changeId])
  },

  rejectChange: (proposalId: string, changeId: string): void => {
    set((state) => {
      const ghostNodes = state.ghostNodes.filter(
        n => !(n.data.proposalId === proposalId && n.data.changeId === changeId)
      )
      const ghostEdges = state.ghostEdges.filter(
        e => !(e.data.proposalId === proposalId && e.data.changeId === changeId)
      )
      return { ghostNodes, ghostEdges }
    })
  },

  rejectProposal: (proposalId: string): void => {
    set((state) => {
      const proposals = { ...state.proposals }
      proposals[proposalId] = {
        ...proposals[proposalId],
        status: 'rejected',
        resolvedAt: Date.now(),
      }
      return {
        proposals,
        ...removeGhostsForProposal(proposalId, state),
        activeProposalId: state.activeProposalId === proposalId ? null : state.activeProposalId,
      }
    })
  },

  modifyChangePosition: (proposalId, changeId, position): void => {
    set((state) => {
      const proposals = { ...state.proposals }
      const proposal = proposals[proposalId]
      if (!proposal) return state

      const modifications = { ...(proposal.userModifications || {}) }
      modifications[changeId] = { ...modifications[changeId], position }
      proposals[proposalId] = { ...proposal, userModifications: modifications }

      // Also update ghost node position on canvas
      const ghostNodes = state.ghostNodes.map(n =>
        (n.data.proposalId === proposalId && n.data.changeId === changeId)
          ? { ...n, position }
          : n
      )

      return { proposals, ghostNodes }
    })
  },

  setActiveProposal: (proposalId): void => {
    set({ activeProposalId: proposalId })
  },

  expireProposal: (proposalId): void => {
    const proposal = get().proposals[proposalId]
    if (!proposal || proposal.status !== 'pending') return

    set((state) => {
      const proposals = { ...state.proposals }
      proposals[proposalId] = {
        ...proposals[proposalId],
        status: 'expired',
        resolvedAt: Date.now(),
      }
      return {
        proposals,
        ...removeGhostsForProposal(proposalId, state),
        activeProposalId: state.activeProposalId === proposalId ? null : state.activeProposalId,
      }
    })
  },

  clearAllProposals: (): void => {
    set({ proposals: {}, ghostNodes: [], ghostEdges: [], activeProposalId: null })
  },
}))
