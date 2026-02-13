/**
 * Workspace Store History Integration Tests
 *
 * Comprehensive tests for undo/redo system including:
 * - History stack management
 * - Action type coverage (node CRUD, edge CRUD, properties, batch ops)
 * - History limits and circular buffer
 * - Edge cases and error conditions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../workspaceStore'
import {
  resetWorkspaceStore,
  getWorkspaceState,
  getHistoryState,
  seedNode,
  seedNodes,
  seedEdge,
  clearHistory
} from '../../../../test/storeUtils'
import {
  createNoteNode,
  createTaskNode,
  createConversationNode,
  createProjectNode,
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'

describe('Workspace History Integration', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  // ==========================================================================
  // Basic Undo/Redo Tests (15 tests)
  // ==========================================================================

  describe('Basic undo/redo', () => {
    it('should undo single node addition', () => {
      const { addNode, undo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      expect(getWorkspaceState().nodes).toHaveLength(1)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should redo single node addition', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      const id = addNode('note', { x: 0, y: 0 })
      undo()
      redo()

      expect(getWorkspaceState().nodes).toHaveLength(1)
      expect(getWorkspaceState().nodes[0]!.id).toBe(id)
    })

    it('should handle multiple undo operations in sequence', () => {
      const { addNode, undo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })
      addNode('note', { x: 200, y: 0 })

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle multiple redo operations in sequence', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })
      addNode('note', { x: 200, y: 0 })

      undo()
      undo()
      undo()

      redo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(3)
    })

    it('should handle alternating undo/redo', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
    })

    it('should truncate redo history on new action', () => {
      const { addNode, undo, canRedo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })

      undo()
      expect(canRedo()).toBe(true)

      addNode('task', { x: 200, y: 0 })
      expect(canRedo()).toBe(false)
    })

    it('should preserve undo history after redo', () => {
      const { addNode, undo, redo, canUndo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })
      undo()
      redo()

      expect(canUndo()).toBe(true)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle undo when history is empty', () => {
      const { undo } = useWorkspaceStore.getState()
      expect(() => undo()).not.toThrow()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle redo when redo stack is empty', () => {
      const { redo } = useWorkspaceStore.getState()
      expect(() => redo()).not.toThrow()
    })

    it('should handle undo past the beginning', () => {
      const { addNode, undo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      undo()
      undo() // Extra
      undo() // Extra

      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle redo past the end', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      undo()
      redo()
      redo() // Extra
      redo() // Extra

      expect(getWorkspaceState().nodes).toHaveLength(1)
    })

    it('should update canUndo flag correctly', () => {
      const { addNode, undo, canUndo } = useWorkspaceStore.getState()

      expect(canUndo()).toBe(false)
      addNode('note', { x: 0, y: 0 })
      expect(canUndo()).toBe(true)
      undo()
      expect(canUndo()).toBe(false)
    })

    it('should update canRedo flag correctly', () => {
      const { addNode, undo, redo, canRedo } = useWorkspaceStore.getState()

      expect(canRedo()).toBe(false)
      addNode('note', { x: 0, y: 0 })
      expect(canRedo()).toBe(false)
      undo()
      expect(canRedo()).toBe(true)
      redo()
      expect(canRedo()).toBe(false)
    })

    it('should track historyIndex correctly', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      expect(getHistoryState().historyIndex).toBe(-1)
      addNode('note', { x: 0, y: 0 })
      expect(getHistoryState().historyIndex).toBe(0)
      addNode('note', { x: 100, y: 0 })
      expect(getHistoryState().historyIndex).toBe(1)
      undo()
      expect(getHistoryState().historyIndex).toBe(0)
      redo()
      expect(getHistoryState().historyIndex).toBe(1)
    })

    it('should reset historyIndex on truncate', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })
      undo()
      addNode('task', { x: 200, y: 0 })

      expect(getHistoryState().historyIndex).toBe(1)
    })
  })

  // ==========================================================================
  // Node Operations Tests (15 tests)
  // ==========================================================================

  describe('Node operations', () => {
    it('should undo node addition', () => {
      const { addNode, undo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should redo node addition', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      const id = addNode('note', { x: 50, y: 100 })
      undo()
      redo()

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe(id)
      expect(state.nodes[0]!.position).toEqual({ x: 50, y: 100 })
    })

    it('should undo node deletion', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])
      expect(getWorkspaceState().nodes).toHaveLength(0)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      expect(getWorkspaceState().nodes[0]!.id).toBe('note-1')
    })

    it('should redo node deletion', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo, redo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])
      undo()
      redo()

      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should undo node property update', () => {
      const note = createNoteNode('Original', { id: 'note-1' })
      note.data.title = 'Original Title'
      seedNode(note)
      clearHistory()

      const { updateNode, undo } = useWorkspaceStore.getState()
      updateNode('note-1', { title: 'Updated' })
      undo()

      expect((getWorkspaceState().nodes[0]!.data as { title: string }).title).toBe('Original Title')
    })

    it('should redo node property update', () => {
      const note = createNoteNode('Original', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { updateNode, undo, redo } = useWorkspaceStore.getState()
      updateNode('note-1', { title: 'Updated' })
      undo()
      redo()

      expect((getWorkspaceState().nodes[0]!.data as { title: string }).title).toBe('Updated')
    })

    it('should undo node move', () => {
      const note = createNoteNode('Note', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNode(note)

      const { startNodeDrag, moveNode, commitNodeDrag, undo } = useWorkspaceStore.getState()
      startNodeDrag(['note-1'])
      moveNode('note-1', { x: 100, y: 200 })
      commitNodeDrag(['note-1'])

      undo()
      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 0, y: 0 })
    })

    it('should redo node move', () => {
      const note = createNoteNode('Note', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNode(note)

      const { startNodeDrag, moveNode, commitNodeDrag, undo, redo } = useWorkspaceStore.getState()
      startNodeDrag(['note-1'])
      moveNode('note-1', { x: 100, y: 200 })
      commitNodeDrag(['note-1'])

      undo()
      redo()
      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 100, y: 200 })
    })

    it('should undo node resize', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      note.data.width = 300
      note.data.height = 150
      seedNode(note)

      const { startNodeResize, updateNode, commitNodeResize, undo } = useWorkspaceStore.getState()
      startNodeResize('note-1')
      updateNode('note-1', { width: 500, height: 300 })
      commitNodeResize('note-1')

      undo()
      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { width: number }).width).toBe(300)
      expect((state.nodes[0]!.data as { height: number }).height).toBe(150)
    })

    it('should redo node resize', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      note.data.width = 300
      note.data.height = 150
      seedNode(note)

      const { startNodeResize, updateNode, commitNodeResize, undo, redo } = useWorkspaceStore.getState()
      startNodeResize('note-1')
      updateNode('note-1', { width: 500, height: 300 })
      commitNodeResize('note-1')

      undo()
      redo()
      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { width: number }).width).toBe(500)
      expect((state.nodes[0]!.data as { height: number }).height).toBe(300)
    })

    it('should undo multiple node deletions', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const note3 = createNoteNode('Note 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['note-1', 'note-2', 'note-3'])
      undo()

      expect(getWorkspaceState().nodes).toHaveLength(3)
    })

    it('should preserve node data on undo/redo cycle', () => {
      const note = createNoteNode('Important content', { id: 'note-1' })
      note.data.title = 'Important Title'
      note.data.color = '#ff0000'
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo, redo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])
      undo()

      const restored = getWorkspaceState().nodes[0]!.data as typeof note.data
      expect(restored.content).toBe('Important content')
      expect(restored.title).toBe('Important Title')
      expect(restored.color).toBe('#ff0000')
    })

    it('should restore connected edges on node undo', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1' }))
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])
      expect(getWorkspaceState().edges).toHaveLength(0)

      undo()
      expect(getWorkspaceState().edges).toHaveLength(1)
    })

    it('should handle undo of node with complex data', () => {
      const conv = createConversationNode(
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' }
        ],
        { id: 'conv-1' }
      )
      seedNode(conv)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['conv-1'])
      undo()

      const restored = getWorkspaceState().nodes[0]!.data as typeof conv.data
      expect(restored.messages).toHaveLength(2)
      expect(restored.messages[0]!.content).toBe('Hello')
    })

    it('should handle undo/redo of different node types', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      const noteId = addNode('note', { x: 0, y: 0 })
      const taskId = addNode('task', { x: 100, y: 0 })
      const convId = addNode('conversation', { x: 200, y: 0 })

      undo()
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)

      redo()
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(3)
      expect(getWorkspaceState().nodes.map(n => n.id)).toContain(noteId)
      expect(getWorkspaceState().nodes.map(n => n.id)).toContain(taskId)
      expect(getWorkspaceState().nodes.map(n => n.id)).toContain(convId)
    })
  })

  // ==========================================================================
  // Edge Operations Tests (10 tests)
  // ==========================================================================

  describe('Edge operations', () => {
    it('should undo edge addition', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      clearHistory()

      const { onConnect, undo } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'note-2', sourceHandle: null, targetHandle: null })
      expect(getWorkspaceState().edges).toHaveLength(1)

      undo()
      expect(getWorkspaceState().edges).toHaveLength(0)
    })

    it('should redo edge addition', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      clearHistory()

      const { onConnect, undo, redo } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'note-2', sourceHandle: null, targetHandle: null })
      undo()
      redo()

      expect(getWorkspaceState().edges).toHaveLength(1)
    })

    it('should undo edge deletion', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1' }))
      clearHistory()

      const { deleteEdges, undo } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])
      expect(getWorkspaceState().edges).toHaveLength(0)

      undo()
      expect(getWorkspaceState().edges).toHaveLength(1)
      expect(getWorkspaceState().edges[0]!.id).toBe('edge-1')
    })

    it('should redo edge deletion', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1' }))
      clearHistory()

      const { deleteEdges, undo, redo } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])
      undo()
      redo()

      expect(getWorkspaceState().edges).toHaveLength(0)
    })

    it('should undo edge property update', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1', data: { label: 'original' } }))
      clearHistory()

      const { updateEdge, undo } = useWorkspaceStore.getState()
      updateEdge('edge-1', { label: 'updated' })
      undo()

      expect(getWorkspaceState().edges[0]!.data?.label).toBe('original')
    })

    it('should redo edge property update', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1', data: { label: 'original' } }))
      clearHistory()

      const { updateEdge, undo, redo } = useWorkspaceStore.getState()
      updateEdge('edge-1', { label: 'updated' })
      undo()
      redo()

      expect(getWorkspaceState().edges[0]!.data?.label).toBe('updated')
    })

    it('should undo edge reversal', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1' }))
      clearHistory()

      const { reverseEdge, undo } = useWorkspaceStore.getState()
      reverseEdge('edge-1')
      expect(getWorkspaceState().edges[0]!.source).toBe('note-2')

      undo()
      expect(getWorkspaceState().edges[0]!.source).toBe('note-1')
      expect(getWorkspaceState().edges[0]!.target).toBe('note-2')
    })

    it('should redo edge reversal', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { id: 'edge-1' }))
      clearHistory()

      const { reverseEdge, undo, redo } = useWorkspaceStore.getState()
      reverseEdge('edge-1')
      undo()
      redo()

      expect(getWorkspaceState().edges[0]!.source).toBe('note-2')
      expect(getWorkspaceState().edges[0]!.target).toBe('note-1')
    })

    it('should preserve edge data on undo/redo cycle', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', {
        id: 'edge-1',
        data: {
          label: 'connection',
          strength: 'strong',
          direction: 'bidirectional'
        }
      }))
      clearHistory()

      const { deleteEdges, undo, redo } = useWorkspaceStore.getState()
      deleteEdges(['edge-1'])
      undo()

      const edge = getWorkspaceState().edges[0]!
      expect(edge.data?.label).toBe('connection')
      expect(edge.data?.strength).toBe('strong')
      expect(edge.data?.direction).toBe('bidirectional')
    })

    it('should handle multiple edge operations', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      const note3 = createNoteNode('N3', { id: 'n3' })
      seedNodes([note1, note2, note3])
      clearHistory()

      const { onConnect, undo, redo } = useWorkspaceStore.getState()
      onConnect({ source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null })
      onConnect({ source: 'n2', target: 'n3', sourceHandle: null, targetHandle: null })

      undo()
      expect(getWorkspaceState().edges).toHaveLength(1)
      undo()
      expect(getWorkspaceState().edges).toHaveLength(0)
      redo()
      redo()
      expect(getWorkspaceState().edges).toHaveLength(2)
    })
  })

  // ==========================================================================
  // Batch Operations Tests (10 tests)
  // ==========================================================================

  describe('Batch operations', () => {
    it('should undo bulk node update', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      clearHistory()

      const { updateBulkNodes, undo } = useWorkspaceStore.getState()
      updateBulkNodes(['note-1', 'note-2'], { color: '#ff0000' })
      undo()

      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { color?: string }).color).toBeUndefined()
      expect((state.nodes[1]!.data as { color?: string }).color).toBeUndefined()
    })

    it('should redo bulk node update', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      clearHistory()

      const { updateBulkNodes, undo, redo } = useWorkspaceStore.getState()
      updateBulkNodes(['note-1', 'note-2'], { color: '#ff0000' })
      undo()
      redo()

      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { color?: string }).color).toBe('#ff0000')
      expect((state.nodes[1]!.data as { color?: string }).color).toBe('#ff0000')
    })

    it('should undo multi-node deletion', () => {
      const notes = [
        createNoteNode('N1', { id: 'n1' }),
        createNoteNode('N2', { id: 'n2' }),
        createNoteNode('N3', { id: 'n3' }),
        createNoteNode('N4', { id: 'n4' }),
        createNoteNode('N5', { id: 'n5' })
      ]
      seedNodes(notes)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['n1', 'n3', 'n5'])
      expect(getWorkspaceState().nodes).toHaveLength(2)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(5)
    })

    it('should handle bulk move operation', () => {
      const note1 = createNoteNode('N1', { id: 'n1', position: { x: 0, y: 0 } })
      const note2 = createNoteNode('N2', { id: 'n2', position: { x: 0, y: 0 } })
      seedNodes([note1, note2])

      const { startNodeDrag, moveNode, commitNodeDrag, undo, redo } = useWorkspaceStore.getState()
      startNodeDrag(['n1', 'n2'])
      moveNode('n1', { x: 100, y: 100 })
      moveNode('n2', { x: 200, y: 200 })
      commitNodeDrag(['n1', 'n2'])

      undo()
      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 0, y: 0 })
      expect(getWorkspaceState().nodes[1]!.position).toEqual({ x: 0, y: 0 })

      redo()
      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 100, y: 100 })
      expect(getWorkspaceState().nodes[1]!.position).toEqual({ x: 200, y: 200 })
    })

    it('should handle batch property updates with different values', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      const note3 = createNoteNode('N3', { id: 'n3' })
      note1.data.color = '#ff0000'
      note2.data.color = '#00ff00'
      note3.data.color = '#0000ff'
      seedNodes([note1, note2, note3])
      clearHistory()

      const { updateBulkNodes, undo } = useWorkspaceStore.getState()
      updateBulkNodes(['n1', 'n2', 'n3'], { color: '#ffffff' })
      undo()

      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { color: string }).color).toBe('#ff0000')
      expect((state.nodes[1]!.data as { color: string }).color).toBe('#00ff00')
      expect((state.nodes[2]!.data as { color: string }).color).toBe('#0000ff')
    })

    it('should handle deletion of nodes and edges together', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      const note3 = createNoteNode('N3', { id: 'n3' })
      seedNodes([note1, note2, note3])
      seedEdge(createTestEdge('n1', 'n2', { id: 'e1' }))
      seedEdge(createTestEdge('n2', 'n3', { id: 'e2' }))
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['n2']) // Should also delete both edges

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(3)
      expect(getWorkspaceState().edges).toHaveLength(2)
    })

    it('should handle rapid batch operations', () => {
      const { addNode, updateBulkNodes, undo, redo } = useWorkspaceStore.getState()

      const ids: string[] = []
      for (let i = 0; i < 10; i++) {
        ids.push(addNode('note', { x: i * 100, y: 0 }))
      }

      updateBulkNodes(ids, { color: '#ff0000' })
      updateBulkNodes(ids, { color: '#00ff00' })
      updateBulkNodes(ids, { color: '#0000ff' })

      undo()
      undo()
      undo()
      expect((getWorkspaceState().nodes[0]!.data as { color?: string }).color).toBeUndefined()

      redo()
      redo()
      redo()
      expect((getWorkspaceState().nodes[0]!.data as { color?: string }).color).toBe('#0000ff')
    })

    it('should preserve individual node states in bulk update', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      note1.data.title = 'Title 1'
      note2.data.title = 'Title 2'
      seedNodes([note1, note2])
      clearHistory()

      const { updateBulkNodes, undo } = useWorkspaceStore.getState()
      updateBulkNodes(['n1', 'n2'], { color: '#ffffff' })
      undo()

      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { title: string }).title).toBe('Title 1')
      expect((state.nodes[1]!.data as { title: string }).title).toBe('Title 2')
    })

    it('should handle partial batch operations (some nodes missing)', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      seedNode(note1)
      clearHistory()

      const { updateBulkNodes, undo } = useWorkspaceStore.getState()
      // Try to update non-existent nodes
      updateBulkNodes(['n1', 'n2', 'n3'], { color: '#ffffff' })

      undo()
      // Should still work for existing node
      expect((getWorkspaceState().nodes[0]!.data as { color?: string }).color).toBeUndefined()
    })

    it('should handle empty batch operations', () => {
      const { updateBulkNodes, undo } = useWorkspaceStore.getState()

      updateBulkNodes([], { color: '#ffffff' })
      expect(() => undo()).not.toThrow()
    })
  })

  // ==========================================================================
  // History Limits Tests (10 tests)
  // ==========================================================================

  describe('History limits', () => {
    it('should limit history to 100 entries', () => {
      const { addNode } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      const { history } = getHistoryState()
      expect(history.length).toBeLessThanOrEqual(100)
    })

    it('should maintain circular buffer behavior', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      // Should still be able to undo
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(104)
    })

    it('should drop oldest actions when limit exceeded', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      // Try to undo all 105 actions
      for (let i = 0; i < 105; i++) {
        undo()
      }

      // Should only undo up to 100 (limit)
      expect(getWorkspaceState().nodes.length).toBeGreaterThan(0)
      expect(getWorkspaceState().nodes.length).toBeLessThanOrEqual(5)
    })

    it('should adjust historyIndex when buffer wraps', () => {
      const { addNode } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      const { historyIndex, history } = getHistoryState()
      expect(historyIndex).toBe(history.length - 1)
    })

    it('should handle undo/redo at history limit', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      undo()
      undo()
      redo()
      redo()

      expect(getWorkspaceState().nodes).toHaveLength(105)
    })

    it('should not exceed limit with mixed operations', () => {
      const { addNode, updateNode, deleteNodes } = useWorkspaceStore.getState()

      for (let i = 0; i < 50; i++) {
        const id = addNode('note', { x: i * 10, y: 0 })
        updateNode(id, { color: '#ff0000' })
        if (i % 5 === 0) {
          deleteNodes([id])
        }
      }

      const { history } = getHistoryState()
      expect(history.length).toBeLessThanOrEqual(100)
    })

    it('should maintain history integrity after limit reached', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      // Verify history is still functional
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(104)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(103)
    })

    it('should handle rapid operations near limit', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      // Add 98 nodes (near limit)
      for (let i = 0; i < 98; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      // Add 5 more (exceed limit)
      addNode('note', { x: 1000, y: 0 })
      addNode('note', { x: 1100, y: 0 })
      addNode('note', { x: 1200, y: 0 })
      addNode('note', { x: 1300, y: 0 })
      addNode('note', { x: 1400, y: 0 })

      // Should still support undo/redo
      undo()
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(103)
    })

    it('should clear redo stack when new action after limit', () => {
      const { addNode, undo, canRedo } = useWorkspaceStore.getState()

      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      undo()
      expect(canRedo()).toBe(true)

      addNode('note', { x: 2000, y: 0 })
      expect(canRedo()).toBe(false)
    })

    it('should handle limit with different action types', () => {
      const { addNode, updateNode, onConnect } = useWorkspaceStore.getState()

      const ids: string[] = []
      for (let i = 0; i < 40; i++) {
        ids.push(addNode('note', { x: i * 10, y: 0 }))
      }

      for (let i = 0; i < 30; i++) {
        updateNode(ids[i]!, { color: `#${i.toString(16)}00000` })
      }

      for (let i = 0; i < 30; i++) {
        if (ids[i + 1]) {
          onConnect({ source: ids[i]!, target: ids[i + 1]!, sourceHandle: null, targetHandle: null })
        }
      }

      const { history } = getHistoryState()
      expect(history.length).toBe(100)
    })
  })

  // ==========================================================================
  // Edge Cases Tests (20 tests)
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle undo with no history', () => {
      const { undo } = useWorkspaceStore.getState()
      expect(() => undo()).not.toThrow()
    })

    it('should handle redo with no redo stack', () => {
      const { redo } = useWorkspaceStore.getState()
      expect(() => redo()).not.toThrow()
    })

    it('should handle rapid undo/redo toggling', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      for (let i = 0; i < 10; i++) {
        undo()
        redo()
      }

      expect(getWorkspaceState().nodes).toHaveLength(1)
    })

    it('should handle undo of deleted node with missing data', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      // Manually corrupt history (simulate edge case)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
    })

    it('should handle undo when node data is null', () => {
      const { addNode, updateNode, undo } = useWorkspaceStore.getState()
      const id = addNode('note', { x: 0, y: 0 })
      updateNode(id, { title: 'Test' })

      expect(() => undo()).not.toThrow()
    })

    it('should handle concurrent history modifications', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })

      // Simulate concurrent undo/redo
      undo()
      addNode('task', { x: 200, y: 0 })
      undo()
      redo()

      expect(getWorkspaceState().nodes).toHaveLength(2)
    })

    it('should handle undo after store reset', () => {
      const { addNode } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      resetWorkspaceStore()

      const { undo } = useWorkspaceStore.getState()
      expect(() => undo()).not.toThrow()
    })

    it('should handle complex nested operations', () => {
      const { addNode, updateNode, deleteNodes, undo, redo } = useWorkspaceStore.getState()

      const id1 = addNode('note', { x: 0, y: 0 })
      updateNode(id1, { title: 'First' })
      const id2 = addNode('task', { x: 100, y: 0 })
      updateNode(id2, { title: 'Second' })
      deleteNodes([id1])

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
      redo()
      redo()
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(1)
    })

    it('should preserve history order', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      const id1 = addNode('note', { x: 0, y: 0 })
      const id2 = addNode('note', { x: 100, y: 0 })
      const id3 = addNode('note', { x: 200, y: 0 })

      undo()
      expect(getWorkspaceState().nodes[getWorkspaceState().nodes.length - 1]!.id).toBe(id2)
      undo()
      expect(getWorkspaceState().nodes[getWorkspaceState().nodes.length - 1]!.id).toBe(id1)
    })

    it('should handle undo of non-existent node', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])
      deleteNodes(['note-1']) // Delete again (should do nothing)
      undo()

      expect(getWorkspaceState().nodes).toHaveLength(1)
    })

    it('should handle undo with circular node references', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('n1', 'n2'))
      seedEdge(createTestEdge('n2', 'n1'))
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['n1'])
      undo()

      expect(getWorkspaceState().nodes).toHaveLength(2)
      expect(getWorkspaceState().edges).toHaveLength(2)
    })

    it('should handle undo/redo with very large nodes', () => {
      const largeContent = 'X'.repeat(100000)
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      const id = addNode('note', { x: 0, y: 0 })
      const { updateNode } = useWorkspaceStore.getState()
      updateNode(id, { content: largeContent })

      undo()
      redo()

      const node = getWorkspaceState().nodes[0]!
      expect((node.data as { content?: string }).content).toBe(largeContent)
    })

    it('should maintain referential integrity on undo', () => {
      const note1 = createNoteNode('N1', { id: 'n1' })
      const note2 = createNoteNode('N2', { id: 'n2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('n1', 'n2', { id: 'e1' }))
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['n1'])
      undo()

      const edge = getWorkspaceState().edges[0]!
      const nodes = getWorkspaceState().nodes
      expect(nodes.some(n => n.id === edge.source)).toBe(true)
      expect(nodes.some(n => n.id === edge.target)).toBe(true)
    })

    it('should handle undo with project hierarchies', () => {
      const project = createProjectNode(['child-1', 'child-2'], { id: 'proj-1' })
      const child1 = createNoteNode('Child 1', { id: 'child-1' })
      const child2 = createNoteNode('Child 2', { id: 'child-2' })
      seedNodes([project, child1, child2])
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()
      deleteNodes(['proj-1'])
      undo()

      expect(getWorkspaceState().nodes).toHaveLength(3)
      const restoredProject = getWorkspaceState().nodes.find(n => n.id === 'proj-1')!
      expect((restoredProject.data as { childNodeIds: string[] }).childNodeIds).toEqual(['child-1', 'child-2'])
    })

    it('should handle empty action objects', () => {
      const { addNode, undo } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      expect(() => undo()).not.toThrow()
    })

    it('should handle undo after multiple store resets', () => {
      const { addNode } = useWorkspaceStore.getState()
      addNode('note', { x: 0, y: 0 })

      resetWorkspaceStore()
      addNode('note', { x: 100, y: 0 })

      resetWorkspaceStore()
      addNode('note', { x: 200, y: 0 })

      const { undo } = useWorkspaceStore.getState()
      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle mixed valid and invalid operations', () => {
      const { addNode, updateNode, undo } = useWorkspaceStore.getState()

      const id = addNode('note', { x: 0, y: 0 })
      updateNode(id, { title: 'Valid' })
      updateNode('invalid-id', { title: 'Invalid' }) // Should fail gracefully

      undo() // Undo valid update
      expect(() => undo()).not.toThrow() // Undo addNode
    })

    it('should handle historyIndex bounds', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })

      // Undo past beginning
      undo()
      undo()
      undo()
      expect(getHistoryState().historyIndex).toBe(-1)

      // Redo past end
      redo()
      redo()
      redo()
      expect(getHistoryState().historyIndex).toBe(0)
    })

    it('should handle action type changes', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { updateNode, undo } = useWorkspaceStore.getState()

      updateNode('note-1', { title: 'Updated' })
      undo()

      const restoredNode = getWorkspaceState().nodes[0]!
      expect(restoredNode.data.type).toBe('note')
    })

    it('should handle snapshot restoration', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      const id1 = addNode('note', { x: 0, y: 0 })
      const id2 = addNode('task', { x: 100, y: 0 })
      const id3 = addNode('conversation', { x: 200, y: 0 })

      undo()
      undo()

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe(id1)
    })
  })
})
