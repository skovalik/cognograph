import { describe, it, expect, beforeEach } from 'vitest'
import { buildAIEditorContext } from '../contextBuilder'
import {
  createConversationNode,
  createNoteNode,
  createTaskNode,
  createProjectNode,
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'

describe('contextBuilder', () => {
  beforeEach(() => {
    resetTestCounters()
  })

  describe('buildAIEditorContext', () => {
    it('should build context with basic inputs', () => {
      const nodes: Node<NodeData>[] = [
        createConversationNode([], { id: 'conv-1', position: { x: 0, y: 0 } })
      ]
      const edges: Edge<EdgeData>[] = []

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Fix issues',
        scope: 'selection',
        nodes,
        edges,
        selectedNodeIds: ['conv-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.mode).toBe('fix')
      expect(context.prompt).toBe('Fix issues')
      expect(context.scope).toBe('selection')
      expect(context.selectedNodeIds).toEqual(['conv-1'])
      expect(context.selectedNodes.length).toBe(1)
      expect(context.estimatedTokens).toBeGreaterThan(0)
      expect(context.maxTokens).toBe(50000)
    })

    it('should include node type in summaries', () => {
      const nodes: Node<NodeData>[] = [
        createNoteNode('Important note', { id: 'note-1' }),
        createTaskNode('todo', { id: 'task-1' })
      ]

      const context = buildAIEditorContext({
        mode: 'organize',
        prompt: 'Organize nodes',
        scope: 'selection',
        nodes,
        edges: [],
        selectedNodeIds: ['note-1', 'task-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.selectedNodes.length).toBe(2)
      expect(context.selectedNodes.map((n) => n.type)).toContain('note')
      expect(context.selectedNodes.map((n) => n.type)).toContain('task')
    })

    it('should include task status in summary', () => {
      const nodes: Node<NodeData>[] = [
        createTaskNode('in-progress', { id: 'task-1' })
      ]

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Check tasks',
        scope: 'selection',
        nodes,
        edges: [],
        selectedNodeIds: ['task-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.selectedNodes[0]!.status).toBe('in-progress')
    })

    it('should include project child count', () => {
      const nodes: Node<NodeData>[] = [
        createProjectNode(['child-1', 'child-2', 'child-3'], { id: 'proj-1' })
      ]

      const context = buildAIEditorContext({
        mode: 'organize',
        prompt: 'Organize project',
        scope: 'selection',
        nodes,
        edges: [],
        selectedNodeIds: ['proj-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.selectedNodes[0]!.childCount).toBe(3)
    })

    it('should include relevant edges', () => {
      const nodes: Node<NodeData>[] = [
        createConversationNode([], { id: 'conv-1', position: { x: 0, y: 0 } }),
        createNoteNode('Context note', { id: 'note-1', position: { x: -200, y: 0 } })
      ]
      const edges: Edge<EdgeData>[] = [
        createTestEdge('note-1', 'conv-1')
      ]

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Check connections',
        scope: 'selection',
        nodes,
        edges,
        selectedNodeIds: ['conv-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.edges.length).toBe(1)
      expect(context.edges[0]!.source).toBe('note-1')
      expect(context.edges[0]!.target).toBe('conv-1')
    })

    it('should calculate canvas bounds from nodes', () => {
      const nodes: Node<NodeData>[] = [
        createNoteNode('A', { id: 'n1', position: { x: -100, y: -50 } }),
        createNoteNode('B', { id: 'n2', position: { x: 200, y: 300 } })
      ]

      const context = buildAIEditorContext({
        mode: 'organize',
        prompt: 'Layout',
        scope: 'canvas',
        nodes,
        edges: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.canvasBounds.minX).toBe(-100)
      expect(context.canvasBounds.minY).toBe(-50)
      // maxX/maxY include default node dimensions
      expect(context.canvasBounds.maxX).toBeGreaterThan(200)
      expect(context.canvasBounds.maxY).toBeGreaterThan(300)
    })

    it('should handle empty nodes array', () => {
      const context = buildAIEditorContext({
        mode: 'generate',
        prompt: 'Create nodes',
        scope: 'canvas',
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.selectedNodes).toEqual([])
      expect(context.visibleNodes).toEqual([])
      expect(context.canvasBounds).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 })
    })

    it('should handle single scope with targetNodeId', () => {
      const nodes: Node<NodeData>[] = [
        createConversationNode([], { id: 'conv-1', position: { x: 0, y: 0 } }),
        createNoteNode('Connected', { id: 'note-1', position: { x: -200, y: 0 } })
      ]
      const edges: Edge<EdgeData>[] = [
        createTestEdge('note-1', 'conv-1')
      ]

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Fix this node',
        scope: 'single',
        nodes,
        edges,
        selectedNodeIds: ['some-other-id'],
        targetNodeId: 'conv-1',
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      // Single scope should use targetNodeId, not selectedNodeIds
      expect(context.selectedNodeIds).toEqual(['conv-1'])
      expect(context.selectedNodes.length).toBe(1)
      expect(context.selectedNodes[0]!.id).toBe('conv-1')
      // Connected nodes should be in visibleNodes
      expect(context.visibleNodes.length).toBe(1)
      expect(context.visibleNodes[0]!.id).toBe('note-1')
    })

    it('should include allNodes for canvas scope', () => {
      const nodes: Node<NodeData>[] = [
        createNoteNode('A', { id: 'n1', position: { x: 0, y: 0 } }),
        createNoteNode('B', { id: 'n2', position: { x: 100, y: 100 } }),
        createNoteNode('C', { id: 'n3', position: { x: 200, y: 200 } })
      ]

      const context = buildAIEditorContext({
        mode: 'organize',
        prompt: 'Organize all',
        scope: 'canvas',
        nodes,
        edges: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.allNodes).toBeDefined()
      expect(context.allNodes!.length).toBe(3)
    })

    it('should not include allNodes for non-canvas scopes', () => {
      const nodes: Node<NodeData>[] = [
        createNoteNode('A', { id: 'n1' })
      ]

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Fix',
        scope: 'selection',
        nodes,
        edges: [],
        selectedNodeIds: ['n1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.allNodes).toBeUndefined()
    })

    it('should include conversation message count', () => {
      const nodes: Node<NodeData>[] = [
        createConversationNode(
          [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
          ],
          { id: 'conv-1' }
        )
      ]

      const context = buildAIEditorContext({
        mode: 'fix',
        prompt: 'Check conversation',
        scope: 'selection',
        nodes,
        edges: [],
        selectedNodeIds: ['conv-1'],
        viewport: { x: 0, y: 0, zoom: 1 },
        viewportBounds: { width: 1000, height: 800 }
      })

      expect(context.selectedNodes[0]!.messageCount).toBe(3)
    })
  })
})
