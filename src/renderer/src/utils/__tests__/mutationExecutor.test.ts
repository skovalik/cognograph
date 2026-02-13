/**
 * Mutation Executor Tests
 *
 * Tests for executeMutationPlan — the two-pass execution engine
 * that applies AI-generated plans to the workspace store.
 * (Patent P4: Plan-Preview-Apply)
 *
 * Two-pass execution:
 * 1. Pass 1: Create all nodes (establish tempId → realId mapping)
 * 2. Pass 2: Execute updates, moves, edges, and deletions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { executeMutationPlan, dryRunMutationPlan } from '../mutationExecutor'
import {
  resetWorkspaceStore,
  resetAIEditorStore,
  getWorkspaceState,
  getAIEditorState,
  seedNodes,
  seedEdges,
  getHistoryState
} from '../../../../test/storeUtils'
import {
  createNoteNode,
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'
import type { MutationPlan, NodeData, NoteNodeData } from '@shared/types'

describe('mutationExecutor', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetAIEditorStore()
    resetTestCounters()
  })

  // ---------------------------------------------------------------------------
  // Node Creation
  // ---------------------------------------------------------------------------

  describe('create-node operations', () => {
    it('should create a single node', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'note',
            position: { type: 'absolute', x: 100, y: 200 },
            data: { title: 'Created Note', content: 'Hello world' }
          }
        ],
        explanation: 'Create a note'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.createdNodeIds).toHaveLength(1)

      const state = getWorkspaceState()
      const createdNode = state.nodes.find((n) => n.id === result.createdNodeIds[0])
      expect(createdNode).toBeDefined()
      expect(createdNode!.data.type).toBe('note')
      expect((createdNode!.data as NoteNodeData).title).toBe('Created Note')
      expect(createdNode!.position).toEqual({ x: 100, y: 200 })
    })

    it('should create multiple nodes with unique IDs', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'note',
            position: { type: 'absolute', x: 0, y: 0 },
            data: { title: 'Note A' }
          },
          {
            op: 'create-node',
            tempId: 'temp-2',
            type: 'task',
            position: { type: 'absolute', x: 300, y: 0 },
            data: { title: 'Task B', status: 'todo', priority: 'medium' }
          }
        ],
        explanation: 'Create note and task'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.createdNodeIds).toHaveLength(2)
      expect(result.createdNodeIds[0]).not.toBe(result.createdNodeIds[1])

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(2)
    })

    it('should register tempId to realId mapping', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-abc',
            type: 'note',
            position: { type: 'absolute', x: 0, y: 0 },
            data: { title: 'Mapped Node' }
          }
        ],
        explanation: 'Test mapping'
      }

      const result = await executeMutationPlan(plan)
      const editorState = getAIEditorState()

      // The tempId should resolve to the real ID
      expect(editorState.resolveId('temp-abc')).toBe(result.createdNodeIds[0])
    })
  })

  // ---------------------------------------------------------------------------
  // Node Deletion
  // ---------------------------------------------------------------------------

  describe('delete-node operations', () => {
    it('should delete an existing node', async () => {
      const note = createNoteNode('To delete', { id: 'note-del' })
      seedNodes([note])

      const plan: MutationPlan = {
        operations: [{ op: 'delete-node', nodeId: 'note-del' }],
        explanation: 'Delete note'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.deletedNodeIds).toContain('note-del')

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(0)
    })

    it('should delete connected edges when deleting a node', async () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdges([createTestEdge('note-1', 'note-2', { id: 'edge-12' })])

      const plan: MutationPlan = {
        operations: [{ op: 'delete-node', nodeId: 'note-1' }],
        explanation: 'Delete note with edge'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.deletedNodeIds).toContain('note-1')
      expect(result.deletedEdgeIds).toContain('edge-12')

      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(1)
      expect(state.edges).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Node Updates
  // ---------------------------------------------------------------------------

  describe('update-node operations', () => {
    it('should update node data properties', async () => {
      const note = createNoteNode('Original content', {
        id: 'note-1',
        data: { title: 'Original Title' } as Partial<NoteNodeData>
      })
      seedNodes([note])

      const plan: MutationPlan = {
        operations: [
          {
            op: 'update-node',
            nodeId: 'note-1',
            data: { title: 'Updated Title', content: 'Updated content' }
          }
        ],
        explanation: 'Update note'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.modifiedNodeIds).toContain('note-1')

      const state = getWorkspaceState()
      const updated = state.nodes.find((n) => n.id === 'note-1')
      expect((updated!.data as NoteNodeData).title).toBe('Updated Title')
      expect((updated!.data as NoteNodeData).content).toBe('Updated content')
    })
  })

  // ---------------------------------------------------------------------------
  // Node Moves
  // ---------------------------------------------------------------------------

  describe('move-node operations', () => {
    it('should move a node to a new position', async () => {
      const note = createNoteNode('Note', { id: 'note-1', position: { x: 0, y: 0 } })
      seedNodes([note])

      const plan: MutationPlan = {
        operations: [
          {
            op: 'move-node',
            nodeId: 'note-1',
            position: { type: 'absolute', x: 500, y: 300 }
          }
        ],
        explanation: 'Move note'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.modifiedNodeIds).toContain('note-1')

      const state = getWorkspaceState()
      expect(state.nodes[0]!.position).toEqual({ x: 500, y: 300 })
    })
  })

  // ---------------------------------------------------------------------------
  // Edge Operations
  // ---------------------------------------------------------------------------

  describe('edge operations', () => {
    it('should create an edge between existing nodes', async () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])

      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-edge',
            source: 'note-1',
            target: 'note-2',
            data: { label: 'related' }
          }
        ],
        explanation: 'Connect notes'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.createdEdgeIds).toHaveLength(1)

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(1)
      expect(state.edges[0]!.source).toBe('note-1')
      expect(state.edges[0]!.target).toBe('note-2')
    })

    it('should create edge with tempId resolution (node created in same plan)', async () => {
      const existingNote = createNoteNode('Existing', { id: 'existing-1' })
      seedNodes([existingNote])

      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-new',
            type: 'note',
            position: { type: 'absolute', x: 300, y: 0 },
            data: { title: 'New Note' }
          },
          {
            op: 'create-edge',
            source: 'existing-1',
            target: 'temp-new'
          }
        ],
        explanation: 'Create and connect'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.createdNodeIds).toHaveLength(1)
      expect(result.createdEdgeIds).toHaveLength(1)

      const state = getWorkspaceState()
      const edge = state.edges[0]!
      expect(edge.source).toBe('existing-1')
      // Target should be the real ID, not 'temp-new'
      expect(edge.target).toBe(result.createdNodeIds[0])
    })

    it('should delete an edge', async () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdges([createTestEdge('note-1', 'note-2', { id: 'edge-to-delete' })])

      const plan: MutationPlan = {
        operations: [{ op: 'delete-edge', edgeId: 'edge-to-delete' }],
        explanation: 'Remove connection'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.deletedEdgeIds).toContain('edge-to-delete')

      const state = getWorkspaceState()
      expect(state.edges).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // History (BATCH undo)
  // ---------------------------------------------------------------------------

  describe('history tracking', () => {
    it('should create a BATCH history action for undo', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'note',
            position: { type: 'absolute', x: 0, y: 0 },
            data: { title: 'History Test' }
          }
        ],
        explanation: 'Test history'
      }

      await executeMutationPlan(plan)

      const { history, historyIndex, canUndo } = getHistoryState()
      expect(canUndo).toBe(true)
      expect(history[historyIndex]!.type).toBe('BATCH')
    })

    it('should track multiple operations in a single BATCH', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'note',
            position: { type: 'absolute', x: 0, y: 0 },
            data: { title: 'Note 1' }
          },
          {
            op: 'create-node',
            tempId: 'temp-2',
            type: 'task',
            position: { type: 'absolute', x: 300, y: 0 },
            data: { title: 'Task 1' }
          },
          {
            op: 'create-edge',
            source: 'temp-1',
            target: 'temp-2'
          }
        ],
        explanation: 'Multi-op batch'
      }

      await executeMutationPlan(plan)

      const { history, historyIndex } = getHistoryState()
      const batchAction = history[historyIndex]!
      expect(batchAction.type).toBe('BATCH')
      // Should contain: 2 ADD_NODE + 1 ADD_EDGE = 3 actions
      expect((batchAction as { actions: unknown[] }).actions).toHaveLength(3)
    })
  })

  // ---------------------------------------------------------------------------
  // Two-pass execution (create before edge)
  // ---------------------------------------------------------------------------

  describe('two-pass execution', () => {
    it('should handle create-edge that references newly created nodes', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-a',
            type: 'note',
            position: { type: 'absolute', x: 0, y: 0 },
            data: { title: 'Node A' }
          },
          {
            op: 'create-node',
            tempId: 'temp-b',
            type: 'note',
            position: { type: 'absolute', x: 300, y: 0 },
            data: { title: 'Node B' }
          },
          {
            op: 'create-edge',
            source: 'temp-a',
            target: 'temp-b'
          }
        ],
        explanation: 'Create graph fragment'
      }

      const result = await executeMutationPlan(plan)

      expect(result.success).toBe(true)
      expect(result.createdNodeIds).toHaveLength(2)
      expect(result.createdEdgeIds).toHaveLength(1)

      const state = getWorkspaceState()
      const edge = state.edges[0]!
      // Both source and target should be real IDs from created nodes
      expect(result.createdNodeIds).toContain(edge.source)
      expect(result.createdNodeIds).toContain(edge.target)
    })
  })

  // ---------------------------------------------------------------------------
  // Dry Run (Preview)
  // ---------------------------------------------------------------------------

  describe('dryRunMutationPlan', () => {
    it('should return resolved positions without modifying store', () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'note',
            position: { type: 'absolute', x: 100, y: 200 },
            data: { title: 'Preview Node' }
          }
        ],
        explanation: 'Preview'
      }

      const { resolvedPositions, tempIdToType } = dryRunMutationPlan(
        plan,
        [],
        [],
        [],
        { x: 0, y: 0, zoom: 1 }
      )

      // Should have position for temp-1
      expect(resolvedPositions.get('temp-1')).toEqual({ x: 100, y: 200 })
      expect(tempIdToType.get('temp-1')).toBe('note')

      // Store should not be modified
      const state = getWorkspaceState()
      expect(state.nodes).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('should handle unknown node type gracefully', async () => {
      const plan: MutationPlan = {
        operations: [
          {
            op: 'create-node',
            tempId: 'temp-1',
            type: 'bogus' as NodeData['type'],
            position: { type: 'absolute', x: 0, y: 0 },
            data: {}
          }
        ],
        explanation: 'Bad type'
      }

      const result = await executeMutationPlan(plan)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
