/**
 * Context Builder Integration Tests
 *
 * Comprehensive tests for context injection system, including:
 * - BFS traversal logic
 * - Depth limiting
 * - Circular reference detection
 * - Edge direction handling (inbound, outbound, bidirectional)
 * - Content extraction per node type
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  resetWorkspaceStore,
  seedNode,
  seedNodes,
  seedEdge,
  getWorkspaceState
} from '../../../../test/storeUtils'
import {
  createConversationNode,
  createNoteNode,
  createTaskNode,
  createProjectNode,
  createWorkspaceNode,
  createArtifactNode,
  createTextNode,
  createTestEdge,
  resetTestCounters
} from '../../../../test/utils'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'

describe('Context Injection - BFS Traversal', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
    // Ensure contextSettings are reset to defaults
    useWorkspaceStore.setState({
      contextSettings: { globalDepth: 2, traversalMode: 'all' }
    })
  })

  // ==========================================================================
  // Basic Traversal Tests (20 tests)
  // ==========================================================================

  describe('Basic traversal', () => {
    it('should collect 1-level depth context', () => {
      const note1 = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Context')
    })

    it('should collect 2-level depth context', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 1')
      expect(context).toContain('Level 2')
    })

    it('should collect 3-level depth context', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const note3 = createNoteNode('Level 3', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-3'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 1')
      expect(context).toContain('Level 2')
      expect(context).toContain('Level 3')
    })

    it('should return empty context when no connections', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNode(conv)

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should handle multiple parallel context sources', () => {
      const note1 = createNoteNode('Source A', { id: 'note-1' })
      const note2 = createNoteNode('Source B', { id: 'note-2' })
      const note3 = createNoteNode('Source C', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))
      seedEdge(createTestEdge('note-2', 'conv-1'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Source A')
      expect(context).toContain('Source B')
      expect(context).toContain('Source C')
    })

    it('should handle branching context paths', () => {
      const note1 = createNoteNode('Root', { id: 'note-1' })
      const note2 = createNoteNode('Branch A', { id: 'note-2' })
      const note3 = createNoteNode('Branch B', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-1', 'note-3'))
      seedEdge(createTestEdge('note-2', 'conv-1'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Root')
      expect(context).toContain('Branch A')
      expect(context).toContain('Branch B')
    })

    it('should handle converging context paths', () => {
      const note1 = createNoteNode('Source A', { id: 'note-1' })
      const note2 = createNoteNode('Source B', { id: 'note-2' })
      const note3 = createNoteNode('Merger', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'note-3'))
      seedEdge(createTestEdge('note-2', 'note-3'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Source A')
      expect(context).toContain('Source B')
      expect(context).toContain('Merger')
    })

    it('should respect depth=0 (no context)', () => {
      const note1 = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 0, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should respect depth=1 (immediate connections only)', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 1, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })

    it('should handle deep graphs (5 levels)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 5; i++) {
        notes.push(createNoteNode(`Level ${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      // Chain: note-1 -> note-2 -> note-3 -> note-4 -> note-5 -> conv-1
      for (let i = 1; i <= 4; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-5', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      for (let i = 1; i <= 5; i++) {
        expect(context).toContain(`Level ${i}`)
      }
    })

    it('should handle very deep graphs (10 levels)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 10; i++) {
        notes.push(createNoteNode(`L${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      for (let i = 1; i <= 9; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-10', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 10, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      for (let i = 1; i <= 10; i++) {
        expect(context).toContain(`L${i}`)
      }
    })

    it('should stop at max depth even if graph continues', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const note3 = createNoteNode('Level 3', { id: 'note-3' })
      const note4 = createNoteNode('Level 4', { id: 'note-4' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, note4, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-3'))
      seedEdge(createTestEdge('note-3', 'note-4'))
      seedEdge(createTestEdge('note-4', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 4')
      expect(context).toContain('Level 3')
      expect(context).not.toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })

    it('should handle wide graphs (many parallel connections)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 10; i++) {
        notes.push(createNoteNode(`Source ${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      for (let i = 1; i <= 10; i++) {
        seedEdge(createTestEdge(`note-${i}`, 'conv-1'))
      }

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      for (let i = 1; i <= 10; i++) {
        expect(context).toContain(`Source ${i}`)
      }
    })

    it('should handle diamond-shaped dependency graph', () => {
      const top = createNoteNode('Top', { id: 'top' })
      const left = createNoteNode('Left', { id: 'left' })
      const right = createNoteNode('Right', { id: 'right' })
      const bottom = createNoteNode('Bottom', { id: 'bottom' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([top, left, right, bottom, conv])
      seedEdge(createTestEdge('top', 'left'))
      seedEdge(createTestEdge('top', 'right'))
      seedEdge(createTestEdge('left', 'bottom'))
      seedEdge(createTestEdge('right', 'bottom'))
      seedEdge(createTestEdge('bottom', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Top')
      expect(context).toContain('Left')
      expect(context).toContain('Right')
      expect(context).toContain('Bottom')
    })

    it('should handle star topology (hub-and-spoke)', () => {
      const hub = createNoteNode('Hub', { id: 'hub' })
      const spokes: Node<NodeData>[] = []
      for (let i = 1; i <= 5; i++) {
        spokes.push(createNoteNode(`Spoke ${i}`, { id: `spoke-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([hub, ...spokes, conv])

      for (let i = 1; i <= 5; i++) {
        seedEdge(createTestEdge(`spoke-${i}`, 'hub'))
      }
      seedEdge(createTestEdge('hub', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Hub')
      for (let i = 1; i <= 5; i++) {
        expect(context).toContain(`Spoke ${i}`)
      }
    })

    it('should handle tree topology (hierarchical)', () => {
      const root = createNoteNode('Root', { id: 'root' })
      const child1 = createNoteNode('Child 1', { id: 'child-1' })
      const child2 = createNoteNode('Child 2', { id: 'child-2' })
      const grandchild1 = createNoteNode('Grandchild 1', { id: 'gc-1' })
      const grandchild2 = createNoteNode('Grandchild 2', { id: 'gc-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([root, child1, child2, grandchild1, grandchild2, conv])
      seedEdge(createTestEdge('root', 'child-1'))
      seedEdge(createTestEdge('root', 'child-2'))
      seedEdge(createTestEdge('child-1', 'gc-1'))
      seedEdge(createTestEdge('child-2', 'gc-2'))
      seedEdge(createTestEdge('gc-1', 'conv-1'))
      seedEdge(createTestEdge('gc-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Root')
      expect(context).toContain('Child 1')
      expect(context).toContain('Child 2')
      expect(context).toContain('Grandchild 1')
      expect(context).toContain('Grandchild 2')
    })

    it('should handle mesh topology (many interconnections)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 4; i++) {
        notes.push(createNoteNode(`Node ${i}`, { id: `node-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      // Connect every node to every other node
      for (let i = 1; i <= 4; i++) {
        for (let j = i + 1; j <= 4; j++) {
          seedEdge(createTestEdge(`node-${i}`, `node-${j}`))
        }
      }
      seedEdge(createTestEdge('node-4', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      for (let i = 1; i <= 4; i++) {
        expect(context).toContain(`Node ${i}`)
      }
    })

    it('should handle single node with no edges', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNode(conv)

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should handle node with only outbound edges (no incoming context)', () => {
      const note1 = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, conv])
      seedEdge(createTestEdge('conv-1', 'note-1')) // Outbound from conv

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should handle mixed inbound and outbound edges', () => {
      const note1 = createNoteNode('Inbound', { id: 'note-1' })
      const note2 = createNoteNode('Outbound', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'conv-1')) // Inbound
      seedEdge(createTestEdge('conv-1', 'note-2')) // Outbound

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Inbound')
      expect(context).not.toContain('Outbound')
    })
  })

  // ==========================================================================
  // Edge Type Tests (15 tests)
  // ==========================================================================

  describe('Edge direction handling', () => {
    it('should include inbound-only edges', () => {
      const note = createNoteNode('Source', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Source')
    })

    it('should exclude outbound-only edges', () => {
      const note = createNoteNode('Target', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('conv-1', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).not.toContain('Target')
    })

    it('should include bidirectional edges (source perspective)', () => {
      const note = createNoteNode('Bidirectional', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('conv-1', 'note-1', { data: { direction: 'bidirectional' } })
      seedEdge(edge)

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Bidirectional')
    })

    it('should include bidirectional edges (target perspective)', () => {
      const note = createNoteNode('Bidirectional', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge = createTestEdge('note-1', 'conv-1', { data: { direction: 'bidirectional' } })
      seedEdge(edge)

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Bidirectional')
    })

    it('should handle mixed edge directions', () => {
      const note1 = createNoteNode('Inbound', { id: 'note-1' })
      const note2 = createNoteNode('Outbound', { id: 'note-2' })
      const note3 = createNoteNode('Bidirectional', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))
      seedEdge(createTestEdge('conv-1', 'note-2'))
      seedEdge(createTestEdge('conv-1', 'note-3', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Inbound')
      expect(context).not.toContain('Outbound')
      expect(context).toContain('Bidirectional')
    })

    it('should handle multiple inbound edges from same source', () => {
      const note = createNoteNode('Source', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1', { id: 'edge-1' }))
      seedEdge(createTestEdge('note-1', 'conv-1', { id: 'edge-2' }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Source')
    })

    it('should handle edge strength (strong edges first)', () => {
      const note1 = createNoteNode('Light', { id: 'note-1' })
      const note2 = createNoteNode('Strong', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'conv-1', { data: { strength: 'light' } }))
      seedEdge(createTestEdge('note-2', 'conv-1', { data: { strength: 'strong' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Strong')
      expect(context).toContain('Light')
      // Strong should appear before Light (based on sorting)
      expect(context.indexOf('Strong')).toBeLessThan(context.indexOf('Light'))
    })

    it('should handle inactive edges (exclude them)', () => {
      const note = createNoteNode('Inactive', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1', { data: { active: false } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).not.toContain('Inactive')
    })

    it('should handle mix of active and inactive edges', () => {
      const note1 = createNoteNode('Active', { id: 'note-1' })
      const note2 = createNoteNode('Inactive', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'conv-1', { data: { active: true } }))
      seedEdge(createTestEdge('note-2', 'conv-1', { data: { active: false } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).toContain('Active')
      expect(context).not.toContain('Inactive')
    })

    it('should handle edge strength priority (strong > normal > light)', () => {
      const note1 = createNoteNode('Strong', { id: 'note-1' })
      const note2 = createNoteNode('Normal', { id: 'note-2' })
      const note3 = createNoteNode('Light', { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-3', 'conv-1', { data: { strength: 'light' } }))
      seedEdge(createTestEdge('note-1', 'conv-1', { data: { strength: 'strong' } }))
      seedEdge(createTestEdge('note-2', 'conv-1', { data: { strength: 'normal' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      const strongIdx = context.indexOf('Strong')
      const normalIdx = context.indexOf('Normal')
      const lightIdx = context.indexOf('Light')

      expect(strongIdx).toBeLessThan(normalIdx)
      expect(normalIdx).toBeLessThan(lightIdx)
    })

    it('should handle bidirectional traversal in both directions', () => {
      const note1 = createNoteNode('Node 1', { id: 'note-1' })
      const note2 = createNoteNode('Node 2', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()

      // Check from note-2's perspective (note-1 should be in context)
      const context2 = getContextForNode('note-2')
      expect(context2).toContain('Node 1')

      // Check from note-1's perspective (note-2 should be in context)
      const context1 = getContextForNode('note-1')
      expect(context1).toContain('Node 2')
    })

    it('should handle bidirectional multi-level traversal', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const note3 = createNoteNode('Level 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      seedEdge(createTestEdge('note-1', 'note-2', { data: { direction: 'bidirectional' } }))
      seedEdge(createTestEdge('note-2', 'note-3', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })

      const context3 = getContextForNode('note-3')
      expect(context3).toContain('Level 1')
      expect(context3).toContain('Level 2')
    })

    it('should handle unidirectional edges in mixed graph', () => {
      const note1 = createNoteNode('Uni Source', { id: 'note-1' })
      const note2 = createNoteNode('Bi Node', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'note-2')) // Unidirectional
      seedEdge(createTestEdge('note-2', 'conv-1', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Bi Node')
      expect(context).toContain('Uni Source')
    })

    it('should exclude nodes with includeInContext=false', () => {
      const note1 = createNoteNode('Excluded', { id: 'note-1' })
      note1.data.includeInContext = false
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      expect(context).not.toContain('Excluded')
    })
  })

  // ==========================================================================
  // Circular Reference Tests (10 tests)
  // ==========================================================================

  describe('Circular reference detection', () => {
    it('should handle A↔B circular reference', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('note-1')

      expect(context).toContain('Node B')
      // Should not infinite loop
      expect(context.split('Node B').length).toBeLessThan(5)
    })

    it('should handle A→B→C→A circular reference', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      const note3 = createNoteNode('Node C', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-3'))
      seedEdge(createTestEdge('note-3', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('note-1')

      expect(context).toContain('Node B')
      expect(context).toContain('Node C')
      // Should visit each node only once
      expect(context.split('Node B').length - 1).toBe(1)
      expect(context.split('Node C').length - 1).toBe(1)
    })

    it('should handle self-loop (node pointing to itself)', () => {
      const note = createNoteNode('Self Loop', { id: 'note-1' })
      seedNode(note)
      seedEdge(createTestEdge('note-1', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      // Should not crash or infinite loop
      expect(() => getContextForNode('note-1')).not.toThrow()
    })

    it('should handle multiple circular paths', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      const note3 = createNoteNode('Node C', { id: 'note-3' })
      const note4 = createNoteNode('Node D', { id: 'note-4' })
      seedNodes([note1, note2, note3, note4])
      // Create two cycles with correct edge directions for context injection
      // Context flows: B → A (A receives from B), A → B (circular)
      seedEdge(createTestEdge('note-2', 'note-1'))
      seedEdge(createTestEdge('note-1', 'note-2'))
      // Context flows: D → C, C → D (circular)
      seedEdge(createTestEdge('note-4', 'note-3'))
      seedEdge(createTestEdge('note-3', 'note-4'))
      // Connect the cycles: C → B (B receives from C)
      seedEdge(createTestEdge('note-3', 'note-2'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('note-1')

      expect(context).toContain('Node B')
      expect(context).toContain('Node C')
      expect(context).toContain('Node D')
    })

    it('should handle bidirectional circular references', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2', { data: { direction: 'bidirectional' } }))
      seedEdge(createTestEdge('note-2', 'note-1', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('note-1')

      expect(context).toContain('Node B')
    })

    it('should handle nested circular structures', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 5; i++) {
        notes.push(createNoteNode(`Node ${i}`, { id: `note-${i}` }))
      }
      seedNodes(notes)

      // Create circle: 1→2→3→4→5→1
      for (let i = 1; i <= 4; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-5', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })
      const context = getContextForNode('note-1')

      for (let i = 2; i <= 5; i++) {
        expect(context).toContain(`Node ${i}`)
      }
    })

    it('should handle circular reference with different depths', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      const note3 = createNoteNode('Node C', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      // Correct edge directions for context injection: B → A → C → B (circular)
      seedEdge(createTestEdge('note-2', 'note-1')) // B → A (A receives from B)
      seedEdge(createTestEdge('note-1', 'note-3')) // A → C
      seedEdge(createTestEdge('note-3', 'note-2')) // C → B (closes circle)

      const { getContextForNode, updateContextSettings } = useWorkspaceStore.getState()

      // Test with depth=1 (should see B)
      updateContextSettings({ globalDepth: 1 })
      let context = getContextForNode('note-1')
      expect(context).toContain('Node B')
      expect(context).not.toContain('Node C')

      // Test with depth=2 (should see B and C)
      updateContextSettings({ globalDepth: 2 })
      context = getContextForNode('note-1')
      expect(context).toContain('Node B')
      expect(context).toContain('Node C')
    })

    it('should handle figure-8 topology', () => {
      const center = createNoteNode('Center', { id: 'center' })
      const loop1a = createNoteNode('Loop1A', { id: 'l1a' })
      const loop1b = createNoteNode('Loop1B', { id: 'l1b' })
      const loop2a = createNoteNode('Loop2A', { id: 'l2a' })
      const loop2b = createNoteNode('Loop2B', { id: 'l2b' })
      seedNodes([center, loop1a, loop1b, loop2a, loop2b])

      // Create two loops connected at center
      seedEdge(createTestEdge('center', 'l1a'))
      seedEdge(createTestEdge('l1a', 'l1b'))
      seedEdge(createTestEdge('l1b', 'center'))
      seedEdge(createTestEdge('center', 'l2a'))
      seedEdge(createTestEdge('l2a', 'l2b'))
      seedEdge(createTestEdge('l2b', 'center'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('center')

      expect(context).toContain('Loop1A')
      expect(context).toContain('Loop1B')
      expect(context).toContain('Loop2A')
      expect(context).toContain('Loop2B')
    })

    it('should handle complex multi-cycle graph', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 6; i++) {
        notes.push(createNoteNode(`N${i}`, { id: `n${i}` }))
      }
      seedNodes(notes)

      // Create complex interconnected graph
      seedEdge(createTestEdge('n1', 'n2'))
      seedEdge(createTestEdge('n2', 'n3'))
      seedEdge(createTestEdge('n3', 'n1')) // Cycle 1
      seedEdge(createTestEdge('n3', 'n4'))
      seedEdge(createTestEdge('n4', 'n5'))
      seedEdge(createTestEdge('n5', 'n3')) // Cycle 2
      seedEdge(createTestEdge('n5', 'n6'))
      seedEdge(createTestEdge('n6', 'n1')) // Cycle 3

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })
      const context = getContextForNode('n1')

      for (let i = 2; i <= 6; i++) {
        expect(context).toContain(`N${i}`)
      }
    })

    it('should not revisit nodes in circular paths', () => {
      const note1 = createNoteNode('Node A', { id: 'note-1' })
      const note2 = createNoteNode('Node B', { id: 'note-2' })
      seedNodes([note1, note2])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })
      const context = getContextForNode('note-1')

      // Even with depth=5, each node should only appear once
      expect(context.split('Node B').length - 1).toBe(1)
    })
  })

  // ==========================================================================
  // Node Type Content Extraction Tests (12 tests)
  // ==========================================================================

  describe('Content extraction per node type', () => {
    it('should extract conversation node content', () => {
      const conv = createConversationNode(
        [
          { role: 'user', content: 'Hello AI' },
          { role: 'assistant', content: 'Hello human!' }
        ],
        { id: 'conv-1' }
      )
      const target = createConversationNode([], { id: 'target' })
      seedNodes([conv, target])
      seedEdge(createTestEdge('conv-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Hello AI')
      expect(context).toContain('Hello human')
    })

    it('should extract note node content', () => {
      const note = createNoteNode('Important information here', { id: 'note-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([note, target])
      seedEdge(createTestEdge('note-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Important information here')
    })

    it('should extract task node content', () => {
      const task = createTaskNode('todo', {
        id: 'task-1',
        data: {
          type: 'task',
          title: 'Task Title',
          description: 'Task description content'
        }
      })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([task, target])
      seedEdge(createTestEdge('task-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Task description content')
    })

    it('should extract project node content', () => {
      const project = createProjectNode(['child-1', 'child-2'], {
        id: 'proj-1',
        data: {
          type: 'project',
          title: 'Project',
          description: 'Project details here'
        }
      })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([project, target])
      seedEdge(createTestEdge('proj-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Project details here')
    })

    it('should extract workspace node content', () => {
      const workspace = createWorkspaceNode(['node-1', 'node-2'], {
        id: 'ws-1',
        data: {
          type: 'workspace',
          title: 'Workspace',
          description: 'Workspace context'
        }
      })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([workspace, target])
      seedEdge(createTestEdge('ws-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Workspace context')
    })

    it('should extract artifact node content', () => {
      const artifact = createArtifactNode(
        'const x = 42;',
        { id: 'art-1', data: { title: 'Code Artifact' } }
      )
      const target = createConversationNode([], { id: 'target' })
      seedNodes([artifact, target])
      seedEdge(createTestEdge('art-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('const x = 42;')
    })

    it('should extract text node content', () => {
      const text = createTextNode('Plain text content', { id: 'text-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([text, target])
      seedEdge(createTestEdge('text-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Plain text content')
    })

    it('should handle empty conversation node', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([conv, target])
      seedEdge(createTestEdge('conv-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      // Empty conversation should still contribute something (title, etc)
      expect(context).toBeTruthy()
    })

    it('should handle empty note node', () => {
      const note = createNoteNode('', { id: 'note-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([note, target])
      seedEdge(createTestEdge('note-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      // Even empty notes should be represented
      expect(context).toBeTruthy()
    })

    it('should handle nodes with rich text/markdown', () => {
      const note = createNoteNode('# Header\n\n**Bold** text and *italic*', { id: 'note-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([note, target])
      seedEdge(createTestEdge('note-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      expect(context).toContain('Header')
      expect(context).toContain('Bold')
      expect(context).toContain('italic')
    })

    it('should handle nodes with long content (truncation)', () => {
      const longContent = 'A'.repeat(10000)
      const note = createNoteNode(longContent, { id: 'note-1' })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([note, target])
      seedEdge(createTestEdge('note-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('target')

      // Context should be generated (may be truncated)
      expect(context).toBeTruthy()
      expect(context.length).toBeGreaterThan(0)
    })

    it('should handle mixed node types in context chain', () => {
      const note = createNoteNode('Note content', { id: 'note-1' })
      const task = createTaskNode('todo', { id: 'task-1', data: { description: 'Task content' } })
      const project = createProjectNode([], { id: 'proj-1', data: { description: 'Project content' } })
      const target = createConversationNode([], { id: 'target' })
      seedNodes([note, task, project, target])
      seedEdge(createTestEdge('note-1', 'task-1'))
      seedEdge(createTestEdge('task-1', 'proj-1'))
      seedEdge(createTestEdge('proj-1', 'target'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('target')

      expect(context).toContain('Note content')
      expect(context).toContain('Task content')
      expect(context).toContain('Project content')
    })
  })

  // ==========================================================================
  // Depth Limiting Tests (10 tests - already covered above but adding more)
  // ==========================================================================

  describe('Depth limiting', () => {
    it('should respect maxDepth=0', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 0, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should respect maxDepth=1', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 1, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })

    it('should respect maxDepth=2', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 3; i++) {
        notes.push(createNoteNode(`Level ${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'note-3'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 3')
      expect(context).toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })

    it('should respect maxDepth=3', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 4; i++) {
        notes.push(createNoteNode(`Level ${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])
      for (let i = 1; i <= 3; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-4', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toContain('Level 4')
      expect(context).toContain('Level 3')
      expect(context).toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })

    it('should respect maxDepth=5', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 6; i++) {
        notes.push(createNoteNode(`Level ${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])
      for (let i = 1; i <= 5; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-6', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      for (let i = 2; i <= 6; i++) {
        expect(context).toContain(`Level ${i}`)
      }
      expect(context).not.toContain('Level 1')
    })

    it('should respect maxDepth=10', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 11; i++) {
        notes.push(createNoteNode(`L${i}`, { id: `note-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])
      for (let i = 1; i <= 10; i++) {
        seedEdge(createTestEdge(`note-${i}`, `note-${i + 1}`))
      }
      seedEdge(createTestEdge('note-11', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 10, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      for (let i = 2; i <= 11; i++) {
        expect(context).toContain(`L${i}`)
      }
      // Check that L1 (from note-1 at depth 11) is NOT included
      // Use word boundary to avoid matching L10, L11
      expect(context).not.toMatch(/\bL1\b/)
    })

    it('should handle depth changes dynamically', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'note-2'))
      seedEdge(createTestEdge('note-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()

      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 1, traversalMode: 'all' }
      })
      let context = getContextForNode('conv-1')
      expect(context).not.toContain('Level 1')

      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      context = getContextForNode('conv-1')
      expect(context).toContain('Level 1')
    })

    it('should handle depth with branching correctly', () => {
      const root = createNoteNode('Root', { id: 'root' })
      const branch1 = createNoteNode('Branch1', { id: 'b1' })
      const branch2 = createNoteNode('Branch2', { id: 'b2' })
      const leaf1 = createNoteNode('Leaf1', { id: 'l1' })
      const leaf2 = createNoteNode('Leaf2', { id: 'l2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([root, branch1, branch2, leaf1, leaf2, conv])
      seedEdge(createTestEdge('root', 'b1'))
      seedEdge(createTestEdge('root', 'b2'))
      seedEdge(createTestEdge('b1', 'l1'))
      seedEdge(createTestEdge('b2', 'l2'))
      seedEdge(createTestEdge('l1', 'conv-1'))
      seedEdge(createTestEdge('l2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()

      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 1, traversalMode: 'all' }
      })
      let context = getContextForNode('conv-1')
      expect(context).toContain('Leaf1')
      expect(context).toContain('Leaf2')
      expect(context).not.toContain('Branch1')
      expect(context).not.toContain('Branch2')
      expect(context).not.toContain('Root')

      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 2, traversalMode: 'all' }
      })
      context = getContextForNode('conv-1')
      expect(context).toContain('Branch1')
      expect(context).toContain('Branch2')
      expect(context).not.toContain('Root')

      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 3, traversalMode: 'all' }
      })
      context = getContextForNode('conv-1')
      expect(context).toContain('Root')
    })

    it('should handle depth=0 with multiple nodes', () => {
      const note1 = createNoteNode('Note 1', { id: 'note-1' })
      const note2 = createNoteNode('Note 2', { id: 'note-2' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))
      seedEdge(createTestEdge('note-2', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 0, traversalMode: 'all' }
      })
      const context = getContextForNode('conv-1')

      expect(context).toBe('')
    })

    it('should count depth correctly in bidirectional graphs', () => {
      const note1 = createNoteNode('Level 1', { id: 'note-1' })
      const note2 = createNoteNode('Level 2', { id: 'note-2' })
      const note3 = createNoteNode('Level 3', { id: 'note-3' })
      seedNodes([note1, note2, note3])
      seedEdge(createTestEdge('note-1', 'note-2', { data: { direction: 'bidirectional' } }))
      seedEdge(createTestEdge('note-2', 'note-3', { data: { direction: 'bidirectional' } }))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 1, traversalMode: 'all' }
      })
      const context = getContextForNode('note-3')

      expect(context).toContain('Level 2')
      expect(context).not.toContain('Level 1')
    })
  })

  // ==========================================================================
  // Performance Tests (5 tests)
  // ==========================================================================

  describe('Performance', () => {
    it('should handle 100-node graph efficiently', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 100; i++) {
        notes.push(createNoteNode(`Node ${i}`, { id: `node-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      // Connect all to conv
      for (let i = 1; i <= 100; i++) {
        seedEdge(createTestEdge(`node-${i}`, 'conv-1'))
      }

      const { getContextForNode } = useWorkspaceStore.getState()
      const start = performance.now()
      getContextForNode('conv-1')
      const duration = performance.now() - start

      // Should complete in reasonable time (< 1000ms)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle deep nesting (20 levels)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 20; i++) {
        notes.push(createNoteNode(`L${i}`, { id: `node-${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      for (let i = 1; i <= 19; i++) {
        seedEdge(createTestEdge(`node-${i}`, `node-${i + 1}`))
      }
      seedEdge(createTestEdge('node-20', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 20, traversalMode: 'all' }
      })

      const start = performance.now()
      getContextForNode('conv-1')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1000)
    })

    it('should handle complex graph (50 nodes, 100 edges)', () => {
      const notes: Node<NodeData>[] = []
      for (let i = 1; i <= 50; i++) {
        notes.push(createNoteNode(`N${i}`, { id: `n${i}` }))
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([...notes, conv])

      // Create 100 random edges
      for (let i = 1; i <= 100; i++) {
        const source = Math.floor(Math.random() * 50) + 1
        const target = Math.floor(Math.random() * 50) + 1
        if (source !== target) {
          seedEdge(createTestEdge(`n${source}`, `n${target}`, { id: `edge-${i}` }))
        }
      }
      seedEdge(createTestEdge('n1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 5, traversalMode: 'all' }
      })

      const start = performance.now()
      getContextForNode('conv-1')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(2000)
    })

    it('should handle repeated calls efficiently', () => {
      const note1 = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()

      const start = performance.now()
      for (let i = 0; i < 100; i++) {
        getContextForNode('conv-1')
      }
      const duration = performance.now() - start

      // 100 calls should complete quickly
      expect(duration).toBeLessThan(1000)
    })

    it('should handle large content nodes', () => {
      const largeContent = 'A'.repeat(100000)
      const note1 = createNoteNode(largeContent, { id: 'note-1' })
      const note2 = createNoteNode(largeContent, { id: 'note-2' })
      const note3 = createNoteNode(largeContent, { id: 'note-3' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note1, note2, note3, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))
      seedEdge(createTestEdge('note-2', 'conv-1'))
      seedEdge(createTestEdge('note-3', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const start = performance.now()
      getContextForNode('conv-1')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(2000)
    })
  })

  // ==========================================================================
  // Edge Cases (15 tests)
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle malformed edge (missing source)', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNode(conv)
      seedEdge({ id: 'bad-edge', source: 'missing', target: 'conv-1' } as Edge<EdgeData>)

      const { getContextForNode } = useWorkspaceStore.getState()
      expect(() => getContextForNode('conv-1')).not.toThrow()
    })

    it('should handle malformed edge (missing target)', () => {
      const note = createNoteNode('Source', { id: 'note-1' })
      seedNode(note)
      seedEdge({ id: 'bad-edge', source: 'note-1', target: 'missing' } as Edge<EdgeData>)

      const { getContextForNode } = useWorkspaceStore.getState()
      expect(() => getContextForNode('note-1')).not.toThrow()
    })

    it('should handle deleted source node', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      // Delete source node
      const { deleteNodes, getContextForNode } = useWorkspaceStore.getState()
      deleteNodes(['note-1'])

      const context = getContextForNode('conv-1')
      expect(context).not.toContain('Context')
    })

    it('should handle node with undefined includeInContext', () => {
      const badNode: Node<NodeData> = {
        id: 'bad',
        type: 'note',
        position: { x: 0, y: 0 },
        data: {
          type: 'note',
          title: 'Bad Node',
          content: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now()
          // includeInContext is undefined by default
        }
      }
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([badNode, conv])
      seedEdge(createTestEdge('bad', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      expect(() => getContextForNode('conv-1')).not.toThrow()
    })

    it('should handle non-existent node query', () => {
      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('does-not-exist')
      expect(context).toBe('')
    })

    it('should handle empty node ID', () => {
      const { getContextForNode } = useWorkspaceStore.getState()
      expect(() => getContextForNode('')).not.toThrow()
    })

    it('should handle null/undefined edge data', () => {
      const note = createNoteNode('Source', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      const edge: Edge<EdgeData> = {
        id: 'edge-1',
        source: 'note-1',
        target: 'conv-1',
        data: undefined
      }
      seedEdge(edge)

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toContain('Source')
    })

    it('should handle very long node IDs', () => {
      const longId = 'x'.repeat(1000)
      const note = createNoteNode('Content', { id: longId })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge(longId, 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toContain('Content')
    })

    it('should handle special characters in node IDs', () => {
      const specialId = 'node-!@#$%^&*()_+-=[]{}|;:,.<>?'
      const note = createNoteNode('Special', { id: specialId })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge(specialId, 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toContain('Special')
    })

    it('should handle Unicode in node IDs', () => {
      const unicodeId = 'node-你好-🌟'
      const note = createNoteNode('Unicode', { id: unicodeId })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge(unicodeId, 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toContain('Unicode')
    })

    it('should handle empty edges array', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNode(conv)
      // No edges

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toBe('')
    })

    it('should handle empty nodes array', () => {
      // No nodes seeded
      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')
      expect(context).toBe('')
    })

    it('should handle duplicate edges', () => {
      const note = createNoteNode('Source', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1', { id: 'edge-1' }))
      seedEdge(createTestEdge('note-1', 'conv-1', { id: 'edge-2' }))
      seedEdge(createTestEdge('note-1', 'conv-1', { id: 'edge-3' }))

      const { getContextForNode } = useWorkspaceStore.getState()
      const context = getContextForNode('conv-1')

      // Should only include source once despite multiple edges
      const matches = context.match(/Source/g)
      expect(matches?.length).toBe(1)
    })

    it('should handle nodes with undefined content fields', () => {
      const note = createNoteNode(undefined as any, { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      expect(() => getContextForNode('conv-1')).not.toThrow()
    })

    it('should handle very large depth values', () => {
      const note = createNoteNode('Context', { id: 'note-1' })
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([note, conv])
      seedEdge(createTestEdge('note-1', 'conv-1'))

      const { getContextForNode } = useWorkspaceStore.getState()
      useWorkspaceStore.setState({
        contextSettings: { globalDepth: 999999, traversalMode: 'all' }
      })
      expect(() => getContextForNode('conv-1')).not.toThrow()
    })
  })
})
