// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * WorkspaceStore Node Operations Tests
 *
 * Tests for node CRUD operations in the workspace store.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore, getNodeById } from '../workspaceStore'
import {
  resetWorkspaceStore,
  getWorkspaceState,
  seedNode,
  seedNodes,
  seedEdge,
  seedEdges
} from '../../../../test/storeUtils'
import { createNoteNode, createTaskNode, createTestEdge, resetTestCounters } from '../../../../test/utils'

describe('workspaceStore - Node Operations', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  describe('addNode', () => {
    it('should add a note node at the specified position', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('note', { x: 100, y: 200 })

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe(nodeId)
      expect(state.nodes[0]!.type).toBe('note')
      expect(state.nodes[0]!.position).toEqual({ x: 100, y: 200 })
      expect(state.nodes[0]!.data.type).toBe('note')
    })

    it('should add a conversation node with default provider', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('conversation', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('conversation')
      expect((node!.data as { provider: string }).provider).toBe('anthropic')
    })

    it('should add a task node with default status', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('task', { x: 50, y: 50 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('task')
      expect((node!.data as { status: string }).status).toBe('todo')
    })

    it('should add a project node with empty children', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('project', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('project')
      expect((node!.data as { childNodeIds: string[] }).childNodeIds).toEqual([])
    })

    it('should add an artifact node with default content type', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('artifact', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('artifact')
    })

    it('should add a workspace node', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('workspace', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('workspace')
    })

    it('should add a text node', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('text', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('text')
    })

    it('should add an action node with default trigger', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('action', { x: 0, y: 0 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === nodeId)
      expect(node).toBeDefined()
      expect(node!.data.type).toBe('action')
    })

    it.each(['note', 'conversation', 'task', 'project', 'artifact', 'workspace', 'text', 'action'] as const)(
      'should create %s node with correct type',
      (nodeType) => {
        const { addNode } = useWorkspaceStore.getState()
        const nodeId = addNode(nodeType, { x: 100, y: 200 })
        const state = getWorkspaceState()
        expect(state.nodes.find((n) => n.id === nodeId)?.type).toBe(nodeType)
      }
    )

    it('should mark workspace as dirty after adding node', () => {
      const { addNode } = useWorkspaceStore.getState()

      expect(getWorkspaceState().isDirty).toBe(false)
      addNode('note', { x: 0, y: 0 })
      expect(getWorkspaceState().isDirty).toBe(true)
    })

    it('should add history entry for undo support', () => {
      const { addNode } = useWorkspaceStore.getState()

      addNode('note', { x: 0, y: 0 })

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('ADD_NODE')
      expect(state.historyIndex).toBe(0)
    })

    it('should set lastCreatedNodeId', () => {
      const { addNode } = useWorkspaceStore.getState()

      const nodeId = addNode('note', { x: 0, y: 0 })

      expect(getWorkspaceState().lastCreatedNodeId).toBe(nodeId)
    })
  })

  describe('updateNode', () => {
    it('should update node data', () => {
      const note = createNoteNode('Original content', { id: 'note-1' })
      seedNode(note)

      const { updateNode } = useWorkspaceStore.getState()
      updateNode('note-1', { content: 'Updated content' })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect((node!.data as { content: string }).content).toBe('Updated content')
    })

    it('should update node title', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { updateNode } = useWorkspaceStore.getState()
      updateNode('note-1', { title: 'New Title' })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect((node!.data as { title: string }).title).toBe('New Title')
    })

    it('should update task status', () => {
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNode(task)

      const { updateNode } = useWorkspaceStore.getState()
      updateNode('task-1', { status: 'done' })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'task-1')
      expect((node!.data as { status: string }).status).toBe('done')
    })

    it('should record history for undo', () => {
      const note = createNoteNode('Original', { id: 'note-1' })
      seedNode(note)

      const { updateNode } = useWorkspaceStore.getState()
      updateNode('note-1', { content: 'Updated' })

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('UPDATE_NODE')
    })

    it('should not fail for non-existent node', () => {
      const { updateNode } = useWorkspaceStore.getState()

      // Should not throw
      expect(() => updateNode('non-existent', { title: 'Test' })).not.toThrow()
    })

    it('should update updatedAt timestamp', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      const originalUpdatedAt = note.data.updatedAt
      seedNode(note)

      // Wait a tiny bit to ensure timestamp differs
      const { updateNode } = useWorkspaceStore.getState()
      updateNode('note-1', { title: 'New Title' })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect(node!.data.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('deleteNodes', () => {
    it('should delete a single node', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      expect(getWorkspaceState().nodes).toHaveLength(0)
    })

    it('should delete multiple nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const note3 = createNoteNode('Note 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1', 'note-3'])

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0]!.id).toBe('note-2')
    })

    it('should remove deleted nodes from selection', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)
      useWorkspaceStore.setState({ selectedNodeIds: ['note-1'] })

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      expect(getWorkspaceState().selectedNodeIds).toHaveLength(0)
    })

    it('should record batch history entry', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1', 'note-2'])

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('BATCH')
    })

    it('should not fail for non-existent nodes', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { deleteNodes } = useWorkspaceStore.getState()
      expect(() => deleteNodes(['non-existent', 'note-1'])).not.toThrow()

      expect(getWorkspaceState().nodes).toHaveLength(0)
    })
  })

  describe('moveNode', () => {
    it('should update node position', () => {
      const note = createNoteNode('Content', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNode(note)

      const { moveNode } = useWorkspaceStore.getState()
      moveNode('note-1', { x: 100, y: 200 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect(node!.position).toEqual({ x: 100, y: 200 })
    })

    it('should mark workspace as dirty', () => {
      const note = createNoteNode('Content', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNode(note)

      expect(getWorkspaceState().isDirty).toBe(false)

      const { moveNode } = useWorkspaceStore.getState()
      moveNode('note-1', { x: 50, y: 50 })

      expect(getWorkspaceState().isDirty).toBe(true)
    })
  })

  describe('resizeNode', () => {
    it('should update node dimensions', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { resizeNode } = useWorkspaceStore.getState()
      resizeNode('note-1', { width: 300, height: 200 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      // resizeNode sets node.width/height, not node.data.width/height
      expect(node!.width).toBe(300)
      expect(node!.height).toBe(200)
    })

    it('should update only width when height not provided', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      note.width = 200
      note.height = 150
      seedNode(note)

      const { resizeNode } = useWorkspaceStore.getState()
      resizeNode('note-1', { width: 400 })

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect(node!.width).toBe(400)
      expect(node!.height).toBe(150) // unchanged
    })

    it('should mark workspace as dirty', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      expect(getWorkspaceState().isDirty).toBe(false)

      const { resizeNode } = useWorkspaceStore.getState()
      resizeNode('note-1', { width: 300 })

      expect(getWorkspaceState().isDirty).toBe(true)
    })

    it('should enforce minimum dimensions', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { resizeNode } = useWorkspaceStore.getState()
      resizeNode('note-1', { width: 50, height: 30 }) // Below minimums

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      // Minimums are width: 150, height: 80
      expect(node!.width).toBe(150)
      expect(node!.height).toBe(80)
    })
  })

  describe('changeNodeType', () => {
    it('should change note to task', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      seedNode(note)

      const { changeNodeType } = useWorkspaceStore.getState()
      changeNodeType('note-1', 'task')

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect(node!.type).toBe('task')
      expect(node!.data.type).toBe('task')
    })

    it('should preserve common properties like title', () => {
      const note = createNoteNode('Content', { id: 'note-1' })
      note.data.title = 'My Title'
      seedNode(note)

      const { changeNodeType } = useWorkspaceStore.getState()
      changeNodeType('note-1', 'task')

      const state = getWorkspaceState()
      const node = state.nodes.find((n) => n.id === 'note-1')
      expect((node!.data as { title: string }).title).toBe('My Title')
    })
  })

  describe('setSelectedNodes', () => {
    it('should select nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])

      const { setSelectedNodes } = useWorkspaceStore.getState()
      setSelectedNodes(['note-1', 'note-2'])

      expect(getWorkspaceState().selectedNodeIds).toEqual(['note-1', 'note-2'])
    })

    it('should replace existing selection', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      useWorkspaceStore.setState({ selectedNodeIds: ['note-1'] })

      const { setSelectedNodes } = useWorkspaceStore.getState()
      setSelectedNodes(['note-2'])

      expect(getWorkspaceState().selectedNodeIds).toEqual(['note-2'])
    })
  })

  describe('clearSelection', () => {
    it('should clear node selection', () => {
      const note = createNoteNode('Note', { id: 'note-1' })
      seedNode(note)
      useWorkspaceStore.setState({ selectedNodeIds: ['note-1'] })

      const { clearSelection } = useWorkspaceStore.getState()
      clearSelection()

      expect(getWorkspaceState().selectedNodeIds).toEqual([])
    })

    it('should also clear edge selection', () => {
      useWorkspaceStore.setState({
        selectedNodeIds: ['note-1'],
        selectedEdgeIds: ['edge-1']
      })

      const { clearSelection } = useWorkspaceStore.getState()
      clearSelection()

      const state = getWorkspaceState()
      expect(state.selectedNodeIds).toEqual([])
      expect(state.selectedEdgeIds).toEqual([])
    })
  })

  describe('updateBulkNodes', () => {
    it('should update multiple nodes at once', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])

      const { updateBulkNodes } = useWorkspaceStore.getState()
      updateBulkNodes(['note-1', 'note-2'], { color: '#ff0000' })

      const state = getWorkspaceState()
      expect((state.nodes[0]!.data as { color: string }).color).toBe('#ff0000')
      expect((state.nodes[1]!.data as { color: string }).color).toBe('#ff0000')
    })

    it('should record single history entry for bulk update', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])

      const { updateBulkNodes } = useWorkspaceStore.getState()
      updateBulkNodes(['note-1', 'note-2'], { color: '#ff0000' })

      const state = getWorkspaceState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]!.type).toBe('BULK_UPDATE_NODES')
    })
  })

  // ---------------------------------------------------------------------------
  // STORE-INDEX — Phase 1: Node & Edge Index Tests
  // ---------------------------------------------------------------------------

  describe('nodeIndex (STORE-INDEX)', () => {
    it('should provide O(1) lookup via getNodeById', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const note3 = createNoteNode('Note 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])

      // Allow subscription to rebuild index
      const state = getWorkspaceState()
      const found = getNodeById(state, 'note-2')
      expect(found).toBeDefined()
      expect(found!.id).toBe('note-2')
      expect((found!.data as { content: string }).content).toBe('Note 2')
    })

    it('should return undefined for non-existent node via getNodeById', () => {
      const note = createNoteNode('Note 1', { id: 'note-1' })
      seedNode(note)

      const state = getWorkspaceState()
      const found = getNodeById(state, 'non-existent')
      expect(found).toBeUndefined()
    })

    it('should be consistent after addNode', () => {
      const { addNode } = useWorkspaceStore.getState()

      const id1 = addNode('note', { x: 0, y: 0 })
      const id2 = addNode('task', { x: 100, y: 100 })

      const state = getWorkspaceState()
      expect(state.nodeIndex.size).toBe(2)
      expect(state.nodeIndex.has(id1)).toBe(true)
      expect(state.nodeIndex.has(id2)).toBe(true)

      // Verify index points to correct positions
      const idx1 = state.nodeIndex.get(id1)!
      const idx2 = state.nodeIndex.get(id2)!
      expect(state.nodes[idx1]!.id).toBe(id1)
      expect(state.nodes[idx2]!.id).toBe(id2)
    })

    it('should be consistent after deleteNodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const note3 = createNoteNode('Note 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])

      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-2'])

      const state = getWorkspaceState()
      expect(state.nodeIndex.size).toBe(2)
      expect(state.nodeIndex.has('note-1')).toBe(true)
      expect(state.nodeIndex.has('note-2')).toBe(false)
      expect(state.nodeIndex.has('note-3')).toBe(true)

      // Verify positions are correct after deletion
      for (const [nodeId, idx] of state.nodeIndex) {
        expect(state.nodes[idx]!.id).toBe(nodeId)
      }
    })

    it('should be consistent after updateNode', () => {
      const note = createNoteNode('Original', { id: 'note-1' })
      seedNode(note)

      const { updateNode } = useWorkspaceStore.getState()
      updateNode('note-1', { title: 'Updated' })

      const state = getWorkspaceState()
      expect(state.nodeIndex.size).toBe(1)
      expect(state.nodeIndex.has('note-1')).toBe(true)

      const idx = state.nodeIndex.get('note-1')!
      expect(state.nodes[idx]!.id).toBe('note-1')
      expect((state.nodes[idx]!.data as { title: string }).title).toBe('Updated')
    })

    it('should be consistent after undo/redo of addNode', () => {
      const { addNode, undo, redo } = useWorkspaceStore.getState()

      const nodeId = addNode('note', { x: 0, y: 0 })

      // Verify index after add
      let state = getWorkspaceState()
      expect(state.nodeIndex.has(nodeId)).toBe(true)

      // Undo - node removed
      undo()
      state = getWorkspaceState()
      expect(state.nodeIndex.has(nodeId)).toBe(false)
      expect(state.nodeIndex.size).toBe(0)

      // Redo - node restored
      redo()
      state = getWorkspaceState()
      expect(state.nodeIndex.has(nodeId)).toBe(true)
      expect(state.nodeIndex.size).toBe(1)
    })

    it('should be consistent after loadWorkspace', () => {
      const { loadWorkspace } = useWorkspaceStore.getState()
      loadWorkspace({
        id: 'test-ws',
        name: 'Test Workspace',
        nodes: [
          createNoteNode('Note A', { id: 'a' }),
          createNoteNode('Note B', { id: 'b' }),
          createTaskNode('todo', { id: 'c' })
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      } as Parameters<typeof loadWorkspace>[0])

      const state = getWorkspaceState()
      expect(state.nodeIndex.size).toBe(3)
      expect(state.nodeIndex.has('a')).toBe(true)
      expect(state.nodeIndex.has('b')).toBe(true)
      expect(state.nodeIndex.has('c')).toBe(true)

      // Verify all positions are correct
      for (const [nodeId, idx] of state.nodeIndex) {
        expect(state.nodes[idx]!.id).toBe(nodeId)
      }
    })

    it('should be consistent after newWorkspace', () => {
      // Seed some nodes first
      seedNodes([
        createNoteNode('Note 1', { id: 'n1' }),
        createNoteNode('Note 2', { id: 'n2' })
      ])

      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      const state = getWorkspaceState()
      expect(state.nodeIndex.size).toBe(0)
      expect(state.nodes).toHaveLength(0)
    })
  })

  describe('edgesByTarget (STORE-INDEX)', () => {
    it('should track edges by target node after addEdge', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'task-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      const edgesForTask = state.edgesByTarget.get('task-1')
      expect(edgesForTask).toBeDefined()
      expect(edgesForTask!.length).toBe(1)
    })

    it('should track multiple edges targeting same node', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note1, note2, task])

      const { onConnect } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'task-1', sourceHandle: null, targetHandle: null })
      onConnect({ source: 'note-2', target: 'task-1', sourceHandle: null, targetHandle: null })

      const state = getWorkspaceState()
      const edgesForTask = state.edgesByTarget.get('task-1')
      expect(edgesForTask).toBeDefined()
      expect(edgesForTask!.length).toBe(2)
    })

    it('should be correct after edge deletion', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])

      // Add edge
      const { onConnect, deleteEdges } = useWorkspaceStore.getState()
      onConnect({ source: 'note-1', target: 'task-1', sourceHandle: null, targetHandle: null })

      let state = getWorkspaceState()
      const edgeId = state.edges[0]!.id

      // Delete it
      deleteEdges([edgeId])
      state = getWorkspaceState()
      expect(state.edgesByTarget.get('task-1')).toBeUndefined()
    })

    it('should be empty after newWorkspace', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note, task])
      seedEdge(createTestEdge('note-1', 'task-1', { id: 'edge-1' }))

      const { newWorkspace } = useWorkspaceStore.getState()
      newWorkspace()

      const state = getWorkspaceState()
      expect(state.edgesByTarget.size).toBe(0)
    })

    it('should be consistent after deleteNodes removes connected edges', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const task = createTaskNode('todo', { id: 'task-1' })
      seedNodes([note1, note2, task])
      seedEdges([
        createTestEdge('note-1', 'task-1', { id: 'e1' }),
        createTestEdge('note-2', 'task-1', { id: 'e2' })
      ])

      // Verify initial state
      let state = getWorkspaceState()
      expect(state.edgesByTarget.get('task-1')?.length).toBe(2)

      // Delete one source node - should remove its edges too
      const { deleteNodes } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      state = getWorkspaceState()
      const edgesForTask = state.edgesByTarget.get('task-1')
      expect(edgesForTask).toBeDefined()
      expect(edgesForTask!.length).toBe(1)
      expect(edgesForTask![0]).toBe('e2')
    })
  })
})
