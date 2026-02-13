/**
 * ActionExecutor Service Tests
 *
 * Tests for action step execution.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { executeActionSteps } from '../actionExecutor'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { resetWorkspaceStore, getWorkspaceState, seedNode, seedNodes, seedEdge } from '../../../../test/storeUtils'
import { createNoteNode, createTestEdge, resetTestCounters } from '../../../../test/utils'
import type { ActionStep, ExecutionContext } from '@shared/actionTypes'

describe('actionExecutor', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  const createContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
    triggerNodeId: 'trigger-node-1',
    actionNodeId: 'action-node-1',
    event: { type: 'property-change', nodeId: 'trigger-node-1', timestamp: Date.now(), data: { property: 'status', value: 'done' } },
    variables: {},
    startedAt: Date.now(),
    ...overrides
  })

  describe('executeActionSteps', () => {
    describe('disabled steps', () => {
      it('should skip disabled steps', async () => {
        const note = createNoteNode('Test', { id: 'trigger-node-1' })
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'update-property',
            onError: 'stop',
            disabled: true,
            config: {
              target: 'trigger-node',
              property: 'title',
              value: 'Updated Title'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)
        expect(result.stepsCompleted).toBe(1)

        // Node should NOT be updated (step was disabled) - title should NOT be 'Updated Title'
        const state = getWorkspaceState()
        const node = state.nodes.find((n) => n.id === 'trigger-node-1')
        expect((node?.data as { title?: string }).title).not.toBe('Updated Title')
      })
    })

    describe('update-property step', () => {
      it('should update trigger node property', async () => {
        const note = createNoteNode('Test', { id: 'trigger-node-1' })
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'update-property',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              property: 'title',
              value: 'Updated Title'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)
        expect(result.stepsCompleted).toBe(1)

        const state = getWorkspaceState()
        const node = state.nodes.find((n) => n.id === 'trigger-node-1')
        expect((node?.data as { title?: string }).title).toBe('Updated Title')
      })

      it('should update action node property', async () => {
        const triggerNote = createNoteNode('Trigger', { id: 'trigger-node-1' })
        const actionNote = createNoteNode('Action', { id: 'action-node-1' })
        seedNodes([triggerNote, actionNote])

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'update-property',
            onError: 'stop',
            config: {
              target: 'action-node',
              property: 'title',
              value: 'Action Updated'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        const actionNode = state.nodes.find((n) => n.id === 'action-node-1')
        expect((actionNode?.data as { title?: string }).title).toBe('Action Updated')
      })

      it('should update specific node property', async () => {
        const note1 = createNoteNode('Note 1', { id: 'note-1' })
        const note2 = createNoteNode('Note 2', { id: 'note-2' })
        seedNodes([note1, note2])

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'update-property',
            onError: 'stop',
            config: {
              target: 'specific-node',
              targetNodeId: 'note-2',
              property: 'title',
              value: 'Specific Update'
            }
          }
        ]

        const context = createContext({ triggerNodeId: 'note-1' })
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        const note2Updated = state.nodes.find((n) => n.id === 'note-2')
        expect((note2Updated?.data as { title?: string }).title).toBe('Specific Update')
      })
    })

    describe('create-node step', () => {
      it('should create a new node', async () => {
        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'note',
              title: 'New Note',
              position: 'absolute',
              absoluteX: 100,
              absoluteY: 200
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(1)
        expect(state.nodes[0]!.data.type).toBe('note')
        expect((state.nodes[0]!.data as { title?: string }).title).toBe('New Note')
      })

      it('should create node relative to trigger node', async () => {
        const triggerNote = createNoteNode('Trigger', {
          id: 'trigger-node-1',
          position: { x: 100, y: 100 }
        })
        seedNode(triggerNote)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'note',
              title: 'Relative Note',
              position: 'near-trigger',
              offsetX: 200,
              offsetY: 50
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        const newNode = state.nodes.find((n) => n.id !== 'trigger-node-1')
        expect(newNode).toBeDefined()
        expect(newNode!.position.x).toBe(300) // 100 + 200
        expect(newNode!.position.y).toBe(150) // 100 + 50
      })
    })

    describe('delete-node step', () => {
      it('should delete trigger node', async () => {
        const note = createNoteNode('Test', { id: 'trigger-node-1' })
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'delete-node',
            onError: 'stop',
            config: {
              target: 'trigger-node'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(0)
      })
    })

    describe('move-node step', () => {
      it('should move node to absolute position', async () => {
        const note = createNoteNode('Test', {
          id: 'trigger-node-1',
          position: { x: 0, y: 0 }
        })
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'move-node',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              position: 'absolute',
              x: 500,
              y: 300
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.nodes[0]!.position).toEqual({ x: 500, y: 300 })
      })
    })

    describe('link-nodes step', () => {
      it('should create edge between nodes', async () => {
        const note1 = createNoteNode('Note 1', { id: 'trigger-node-1' })
        const note2 = createNoteNode('Note 2', { id: 'action-node-1' })
        seedNodes([note1, note2])

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'link-nodes',
            onError: 'stop',
            config: {
              source: 'trigger-node',
              target: 'action-node'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.edges).toHaveLength(1)
        expect(state.edges[0]!.source).toBe('trigger-node-1')
        expect(state.edges[0]!.target).toBe('action-node-1')
      })
    })

    describe('unlink-nodes step', () => {
      it('should remove edge between nodes', async () => {
        const note1 = createNoteNode('Note 1', { id: 'trigger-node-1' })
        const note2 = createNoteNode('Note 2', { id: 'action-node-1' })
        seedNodes([note1, note2])
        const edge = createTestEdge('trigger-node-1', 'action-node-1', { id: 'edge-1' })
        seedEdge(edge)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'unlink-nodes',
            onError: 'stop',
            config: {
              source: 'trigger-node',
              target: 'action-node'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.edges).toHaveLength(0)
      })
    })

    describe('wait step', () => {
      it('should wait for specified duration', async () => {
        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'wait',
            onError: 'stop',
            config: {
              duration: 50 // 50ms
            }
          }
        ]

        const startTime = Date.now()
        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())
        const elapsed = Date.now() - startTime

        expect(result.success).toBe(true)
        expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some timing variance
      })
    })

    describe('condition step', () => {
      it('should skip steps when condition is false', async () => {
        const note = createNoteNode('Test', { id: 'trigger-node-1' })
        note.data.title = 'Original'
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'condition',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              field: 'title',
              operator: 'equals',
              value: 'Not Matching',
              skipCount: 1
            }
          },
          {
            id: 'step-2',
            type: 'update-property',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              property: 'title',
              value: 'Should Be Skipped'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)
        expect(result.stepsCompleted).toBe(2)

        // Update should have been skipped
        const state = getWorkspaceState()
        const node = state.nodes.find((n) => n.id === 'trigger-node-1')
        expect((node?.data as { title?: string }).title).toBe('Original')
      })

      it('should not skip steps when condition is true', async () => {
        const note = createNoteNode('Test', { id: 'trigger-node-1' })
        note.data.title = 'Match Me'
        seedNode(note)

        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'condition',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              field: 'title',
              operator: 'equals',
              value: 'Match Me',
              skipCount: 1
            }
          },
          {
            id: 'step-2',
            type: 'update-property',
            onError: 'stop',
            config: {
              target: 'trigger-node',
              property: 'title',
              value: 'Should Run'
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)

        // Update should have run
        const state = getWorkspaceState()
        const node = state.nodes.find((n) => n.id === 'trigger-node-1')
        expect((node?.data as { title?: string }).title).toBe('Should Run')
      })
    })

    describe('error handling', () => {
      it('should stop on error when onError is "stop"', async () => {
        // Use move-node with non-existent node - it actually validates existence
        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'move-node',
            onError: 'stop',
            config: {
              target: 'specific-node',
              targetNodeId: 'non-existent',
              position: 'absolute',
              x: 100,
              y: 100
            }
          },
          {
            id: 'step-2',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'note',
              title: 'Should Not Run',
              position: 'absolute',
              absoluteX: 0,
              absoluteY: 0
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.stepsCompleted).toBe(0)

        // Second step should not have run
        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(0)
      })

      it('should continue on error when onError is "continue"', async () => {
        // Use move-node with non-existent node - it actually validates existence
        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'move-node',
            onError: 'continue',
            config: {
              target: 'specific-node',
              targetNodeId: 'non-existent',
              position: 'absolute',
              x: 100,
              y: 100
            }
          },
          {
            id: 'step-2',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'note',
              title: 'Should Run',
              position: 'absolute',
              absoluteX: 0,
              absoluteY: 0
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)
        expect(result.stepsCompleted).toBe(2)

        // Second step should have run
        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(1)
      })
    })

    describe('multiple steps', () => {
      it('should execute multiple steps in sequence', async () => {
        const steps: ActionStep[] = [
          {
            id: 'step-1',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'note',
              title: 'First Node',
              position: 'absolute',
              absoluteX: 0,
              absoluteY: 0
            }
          },
          {
            id: 'step-2',
            type: 'create-node',
            onError: 'stop',
            config: {
              nodeType: 'task',
              title: 'Second Node',
              position: 'absolute',
              absoluteX: 200,
              absoluteY: 0
            }
          }
        ]

        const context = createContext()
        const result = await executeActionSteps(steps, context, useWorkspaceStore.getState())

        expect(result.success).toBe(true)
        expect(result.stepsCompleted).toBe(2)

        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(2)
        expect(state.nodes.some((n) => n.data.type === 'note')).toBe(true)
        expect(state.nodes.some((n) => n.data.type === 'task')).toBe(true)
      })
    })
  })
})
