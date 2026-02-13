/**
 * WorkspaceStore Undo/Redo Tests
 *
 * Tests for undo/redo functionality in the workspace store.
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
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'

describe('workspaceStore - Undo/Redo', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  describe('canUndo / canRedo', () => {
    it('should return false when history is empty', () => {
      const { canUndo, canRedo } = useWorkspaceStore.getState()

      expect(canUndo()).toBe(false)
      expect(canRedo()).toBe(false)
    })

    it('should return true for canUndo after an action', () => {
      const { addNode, canUndo, canRedo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })

      expect(canUndo()).toBe(true)
      expect(canRedo()).toBe(false)
    })

    it('should return true for canRedo after undo', () => {
      const { addNode, undo, canUndo, canRedo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      undo()

      expect(canUndo()).toBe(false)
      expect(canRedo()).toBe(true)
    })
  })

  describe('undo ADD_NODE', () => {
    it('should remove the added node', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      expect(getWorkspaceState().nodes).toHaveLength(1)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should restore node with redo', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      const nodeId = addNode('note', { x: 100, y: 200 })
      undo()
      redo()

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe(nodeId)
      expect(state.nodes[0]!.position).toEqual({ x: 100, y: 200 })
    })
  })

  describe('undo DELETE_NODE', () => {
    it('should restore the deleted node', () => {
      const note = createNoteNode('Content', { id: 'note-1', position: { x: 50, y: 50 } })
      seedNode(note)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()

      deleteNodes(['note-1'])
      expect(getWorkspaceState().nodes).toHaveLength(0)

      undo()
      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe('note-1')
      expect(state.nodes[0]!.position).toEqual({ x: 50, y: 50 })
    })

    it('should restore multiple deleted nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()

      deleteNodes(['note-1', 'note-2'])
      expect(getWorkspaceState().nodes).toHaveLength(0)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
    })

    it('should restore deleted edges when node is restored', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      const edge = createTestEdge('note-1', 'task-1', { id: 'edge-1' })
      seedEdge(edge)
      clearHistory()

      const { deleteNodes, undo } = useWorkspaceStore.getState()

      deleteNodes(['note-1'])
      expect(getWorkspaceState().nodes).toHaveLength(1)
      expect(getWorkspaceState().edges).toHaveLength(0)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
      expect(getWorkspaceState().edges).toHaveLength(1)
    })
  })

  describe('undo UPDATE_NODE', () => {
    it('should restore previous node data', () => {
      const note = createNoteNode('Original', { id: 'note-1' })
      note.data.title = 'Original Title'
      seedNode(note)
      clearHistory()

      const { updateNode, undo } = useWorkspaceStore.getState()

      updateNode('note-1', { title: 'Updated Title' })
      expect((getWorkspaceState().nodes[0]!.data as { title: string }).title).toBe('Updated Title')

      undo()
      expect((getWorkspaceState().nodes[0]!.data as { title: string }).title).toBe('Original Title')
    })

    it('should restore previous content', () => {
      const note = createNoteNode('Original content', { id: 'note-1' })
      seedNode(note)
      clearHistory()

      const { updateNode, undo } = useWorkspaceStore.getState()

      updateNode('note-1', { content: 'Updated content' })
      undo()

      expect((getWorkspaceState().nodes[0]!.data as { content: string }).content).toBe(
        'Original content'
      )
    })
  })

  describe('undo BULK_UPDATE_NODES', () => {
    it('should restore all nodes to previous state', () => {
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
  })

  describe('undo ADD_EDGE', () => {
    it('should remove the added edge', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      clearHistory()

      const { onConnect, undo } = useWorkspaceStore.getState()

      onConnect({ source: 'note-1', target: 'task-1', sourceHandle: null, targetHandle: null })
      expect(getWorkspaceState().edges).toHaveLength(1)

      undo()
      expect(getWorkspaceState().edges).toHaveLength(0)
    })
  })

  describe('undo DELETE_EDGE', () => {
    it('should restore the deleted edge', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      const edge = createTestEdge('note-1', 'task-1', { id: 'edge-1' })
      seedEdge(edge)
      clearHistory()

      const { deleteEdges, undo } = useWorkspaceStore.getState()

      deleteEdges(['edge-1'])
      expect(getWorkspaceState().edges).toHaveLength(0)

      undo()
      expect(getWorkspaceState().edges).toHaveLength(1)
      expect(getWorkspaceState().edges[0]!.id).toBe('edge-1')
    })
  })

  describe('undo UPDATE_EDGE', () => {
    it('should restore previous edge data', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      const edge = createTestEdge('note-1', 'task-1', { id: 'edge-1', data: { label: 'original' } })
      seedEdge(edge)
      clearHistory()

      const { updateEdge, undo } = useWorkspaceStore.getState()

      updateEdge('edge-1', { label: 'updated' })
      expect(getWorkspaceState().edges[0]!.data?.label).toBe('updated')

      undo()
      expect(getWorkspaceState().edges[0]!.data?.label).toBe('original')
    })
  })

  describe('undo REVERSE_EDGE', () => {
    it('should restore original edge direction', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      const edge = createTestEdge('note-1', 'task-1', { id: 'edge-1' })
      seedEdge(edge)
      clearHistory()

      const { reverseEdge, undo } = useWorkspaceStore.getState()

      reverseEdge('edge-1')
      expect(getWorkspaceState().edges[0]!.source).toBe('task-1')
      expect(getWorkspaceState().edges[0]!.target).toBe('note-1')

      undo()
      expect(getWorkspaceState().edges[0]!.source).toBe('note-1')
      expect(getWorkspaceState().edges[0]!.target).toBe('task-1')
    })
  })

  describe('undo MOVE_NODE', () => {
    it('should restore original position', () => {
      const note = createNoteNode('Note', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNode(note)

      // Use startNodeDrag and commitNodeDrag for proper undo tracking
      const { startNodeDrag, moveNode, commitNodeDrag, undo } = useWorkspaceStore.getState()

      startNodeDrag(['note-1'])
      moveNode('note-1', { x: 100, y: 100 })
      commitNodeDrag(['note-1'])

      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 100, y: 100 })

      undo()
      expect(getWorkspaceState().nodes[0]!.position).toEqual({ x: 0, y: 0 })
    })
  })

  describe('history management', () => {
    it('should truncate redo history on new action', () => {
      const { addNode, undo, canRedo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 100 })
      undo()
      expect(canRedo()).toBe(true)

      // New action should truncate redo history
      addNode('task', { x: 200, y: 200 })
      expect(canRedo()).toBe(false)
    })

    it('should limit history to 100 entries', () => {
      const { addNode } = useWorkspaceStore.getState()

      // Add 105 nodes
      for (let i = 0; i < 105; i++) {
        addNode('note', { x: i * 10, y: 0 })
      }

      const { history } = getHistoryState()
      expect(history.length).toBeLessThanOrEqual(100)
    })

    it('should update historyIndex correctly', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      expect(getHistoryState().historyIndex).toBe(-1)

      addNode('note', { x: 0, y: 0 })
      expect(getHistoryState().historyIndex).toBe(0)

      addNode('note', { x: 100, y: 0 })
      expect(getHistoryState().historyIndex).toBe(1)

      undo()
      expect(getHistoryState().historyIndex).toBe(0)

      undo()
      expect(getHistoryState().historyIndex).toBe(-1)

      redo()
      expect(getHistoryState().historyIndex).toBe(0)
    })
  })

  describe('multiple undo/redo cycles', () => {
    it('should handle multiple undo operations', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })
      addNode('note', { x: 200, y: 0 })

      expect(getWorkspaceState().nodes).toHaveLength(3)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(2)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should handle undo/redo alternation', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      addNode('note', { x: 100, y: 0 })

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)

      redo()
      expect(getWorkspaceState().nodes).toHaveLength(2)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(1)

      undo()
      expect(getWorkspaceState().nodes).toHaveLength(0)

      redo()
      redo()
      expect(getWorkspaceState().nodes).toHaveLength(2)
    })
  })

  describe('undo does nothing when at beginning', () => {
    it('should not throw when undoing with empty history', () => {
      const { undo } = useWorkspaceStore.getState()

      expect(() => undo()).not.toThrow()
      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should not change state when undoing past beginning', () => {
      const { addNode, undo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      undo()
      undo() // Extra undo should be safe
      undo()

      expect(getWorkspaceState().nodes).toHaveLength(0)
    })
  })

  describe('redo does nothing when at end', () => {
    it('should not throw when redoing with nothing to redo', () => {
      const { redo } = useWorkspaceStore.getState()

      expect(() => redo()).not.toThrow()
    })

    it('should not change state when redoing past end', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })
      undo()
      redo()
      redo() // Extra redo should be safe

      expect(getWorkspaceState().nodes).toHaveLength(1)
    })
  })
})
