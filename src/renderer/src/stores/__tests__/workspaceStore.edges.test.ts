/**
 * WorkspaceStore Edge Operations Tests
 *
 * Tests for edge CRUD operations in the workspace store.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../workspaceStore'
import {
  resetWorkspaceStore,
  getWorkspaceState,
  seedNodes,
  seedEdge,
  seedEdges
} from '../../../../test/storeUtils'
import {
  createNoteNode,
  createConversationNode,
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'

describe('workspaceStore - Edge Operations', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  describe('addEdge (onConnect)', () => {
    it('should add an edge between two nodes', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.source).toBe('note-1')
      expect(state.edges[0]!.target).toBe('conv-1')
    })

    it('should generate unique edge ID', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      expect(state.edges[0]!.id).toBeDefined()
      expect(state.edges[0]!.id.length).toBeGreaterThan(0)
    })

    it('should mark workspace as dirty', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])

      expect(getWorkspaceState().isDirty).toBe(false)

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })

      expect(getWorkspaceState().isDirty).toBe(true)
    })

    it('should add history entry', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('ADD_EDGE')
    })

    it('should not create duplicate edges', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })
      onConnect({ source: 'note-1', target: 'conv-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
    })

    it('should allow self-referential edges (store does not prevent them)', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      seedNodes([note])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'note-1', sourceHandle: null, targetHandle: null })

      // Note: The store currently allows self-referential edges
      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.source).toBe('note-1')
      expect(state.edges[0]!.target).toBe('note-1')
    })
  })

  describe('deleteEdges', () => {
    it('should delete a single edge', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { deleteEdges } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])

      expect(getWorkspaceState().edges).toHaveLength(0)
    })

    it('should delete multiple edges', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      const task = createNoteNode('Task', { id: 'task-1' })
      seedNodes([note, conv, task])
      const edge1 = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      const edge2 = createTestEdge('conv-1', 'task-1', { id: 'edge-2' })
      seedEdges([edge1, edge2])

      const { deleteEdges } = useWorkspaceStore.getState()
      deleteEdges(['edge-1', 'edge-2'])

      expect(getWorkspaceState().edges).toHaveLength(0)
    })

    it('should record individual DELETE_EDGE history entries', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { deleteEdges } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])

      const state = getWorkspaceState()
      // deleteEdges creates individual DELETE_EDGE entries, not BATCH
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('DELETE_EDGE')
    })

    it('should remove deleted edges from selection', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)
      useWorkspaceStore.setState({ selectedEdgeIds: ['edge-1'] })

      const { deleteEdges } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])

      expect(getWorkspaceState().selectedEdgeIds).toHaveLength(0)
    })
  })

  describe('updateEdge', () => {
    it('should update edge data', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { updateEdge } = useWorkspaceStore.getState()
      updateEdge('edge-1', { label: 'context' })

      const state = getWorkspaceState()
      expect(state.edges[0]!.data?.label).toBe('context')
    })

    it('should update edge maxDepth', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { updateEdge } = useWorkspaceStore.getState()
      updateEdge('edge-1', { maxDepth: 2 })

      const state = getWorkspaceState()
      expect(state.edges[0]!.data?.maxDepth).toBe(2)
    })

    it('should record history for undo', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { updateEdge } = useWorkspaceStore.getState()
      updateEdge('edge-1', { label: 'context' })

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('UPDATE_EDGE')
    })
  })

  describe('reverseEdge', () => {
    it('should swap source and target', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { reverseEdge } = useWorkspaceStore.getState()
      reverseEdge('edge-1')

      const state = getWorkspaceState()
      expect(state.edges[0]!.source).toBe('conv-1')
      expect(state.edges[0]!.target).toBe('note-1')
    })

    it('should record history for undo', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { reverseEdge } = useWorkspaceStore.getState()
      reverseEdge('edge-1')

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('REVERSE_EDGE')
    })
  })

  describe('reconnectEdge', () => {
    it('should move edge target to new node', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv1 = createConversationNode([], { id: 'conv-1' })
      const conv2 = createConversationNode([], { id: 'conv-2' })
      seedNodes([note, conv1, conv2])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { reconnectEdge } = useWorkspaceStore.getState()
      reconnectEdge(edge, {
        source: 'note-1',
        target: 'conv-2',
        sourceHandle: null,
        targetHandle: null
      })

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.source).toBe('note-1')
      expect(state.edges[0]!.target).toBe('conv-2')
    })

    it('should move edge source to new node', () => {
      const note1 = createNoteNode('Context 1', { id: 'note-1' })
      const note2 = createNoteNode('Context 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { reconnectEdge } = useWorkspaceStore.getState()
      reconnectEdge(edge, {
        source: 'note-2',
        target: 'conv-1',
        sourceHandle: null,
        targetHandle: null
      })

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.source).toBe('note-2')
      expect(state.edges[0]!.target).toBe('conv-1')
    })

    it('should record history for undo', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv1 = createConversationNode([], { id: 'conv-1' })
      const conv2 = createConversationNode([], { id: 'conv-2' })
      seedNodes([note, conv1, conv2])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { reconnectEdge } = useWorkspaceStore.getState()
      reconnectEdge(edge, {
        source: 'note-1',
        target: 'conv-2',
        sourceHandle: null,
        targetHandle: null
      })

      const state = getWorkspaceState()
      expect(state.history.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('setSelectedEdges', () => {
    it('should select edges', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { setSelectedEdges } = useWorkspaceStore.getState()
      setSelectedEdges(['edge-1'])

      expect(getWorkspaceState().selectedEdgeIds).toEqual(['edge-1'])
    })

    it('should replace existing selection', () => {
      const edge1 = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      const edge2 = createTestEdge('note-2', 'conv-2', { id: 'edge-2' })
      seedEdges([edge1, edge2])
      useWorkspaceStore.setState({ selectedEdgeIds: ['edge-1'] })

      const { setSelectedEdges } = useWorkspaceStore.getState()
      setSelectedEdges(['edge-2'])

      expect(getWorkspaceState().selectedEdgeIds).toEqual(['edge-2'])
    })
  })

  describe('linkSelectedNodes', () => {
    it('should create edges between nodes in chain order', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1', position: { x: 0, y: 0 } })
      const note2 = createNoteNode('Note 2', { id: 'note-2', position: { x: 100, y: 0 } })
      const note3 = createNoteNode('Note 3', { id: 'note-3', position: { x: 200, y: 0 } })
      seedNodes([note1, note2, note3])

      const { linkSelectedNodes } = useWorkspaceStore.getState()
      linkSelectedNodes(['note-1', 'note-2', 'note-3'])

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(2)
      expect(state.edges.some((e) => e.source === 'note-1' && e.target === 'note-2')).toBe(true)
      expect(state.edges.some((e) => e.source === 'note-2' && e.target === 'note-3')).toBe(true)
    })

    it('should do nothing with less than 2 nodes', () => {
      const note = createNoteNode('Note 1', { id: 'note-1' })
      seedNodes([note])

      const { linkSelectedNodes } = useWorkspaceStore.getState()
      linkSelectedNodes(['note-1'])

      expect(getWorkspaceState().edges).toHaveLength(0)
    })
  })

  describe('unlinkSelectedNodes', () => {
    it('should remove edges between selected nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      const edge = createTestEdge('note-1', 'note-2', { id: 'edge-1' })
      seedEdge(edge)

      const { unlinkSelectedNodes } = useWorkspaceStore.getState()
      unlinkSelectedNodes(['note-1', 'note-2'])

      expect(getWorkspaceState().edges).toHaveLength(0)
    })

    it('should not remove edges to unselected nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const note3 = createNoteNode('Note 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      const edge1 = createTestEdge('note-1', 'note-2', { id: 'edge-1' })
      const edge2 = createTestEdge('note-2', 'note-3', { id: 'edge-2' })
      seedEdges([edge1, edge2])

      const { unlinkSelectedNodes } = useWorkspaceStore.getState()
      unlinkSelectedNodes(['note-1', 'note-2'])

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.id).toBe('edge-2')
    })
  })

  describe('edge deletion with node deletion', () => {
    it('should delete connected edges when node is deleted', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      seedEdge(edge)

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.edges).toHaveLength(0)
    })

    it('should delete all edges connected to deleted nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      const edge1 = createTestEdge('note-1', 'conv-1', { id: 'edge-1' })
      const edge2 = createTestEdge('note-2', 'conv-1', { id: 'edge-2' })
      seedEdges([edge1, edge2])

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['conv-1'])

      expect(getWorkspaceState().edges).toHaveLength(0)
    })
  })
})
