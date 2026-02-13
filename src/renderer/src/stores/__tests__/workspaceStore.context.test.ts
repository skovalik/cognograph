/**
 * BFS Context Injection Tests
 *
 * Tests for getContextForNode — the patent-critical BFS traversal
 * that injects context from connected nodes into AI conversations.
 * (Patent P1: Context Chain Injection)
 *
 * The BFS follows INBOUND edges (source → target) and bidirectional edges,
 * respects depth limits, skips inactive edges, and handles cycles.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetWorkspaceStore,
  getWorkspaceState,
  seedNodes,
  seedEdges
} from '../../../../test/storeUtils'
import { useWorkspaceStore } from '../workspaceStore'
import {
  createNoteNode,
  createConversationNode,
  createTaskNode,
  createProjectNode,
  createTestEdge,
  createTestNode,
  resetTestCounters
} from '../../../../test/utils'
import type { NoteNodeData, ArtifactNodeData, ConversationNodeData, EdgeData } from '@shared/types'

describe('getContextForNode (BFS context injection)', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
    // Ensure contextSettings are reset to defaults (resetWorkspaceStore doesn't reset them)
    useWorkspaceStore.setState({
      contextSettings: { globalDepth: 2, traversalMode: 'all' }
    })
  })

  // ---------------------------------------------------------------------------
  // Basic Traversal
  // ---------------------------------------------------------------------------

  describe('basic traversal', () => {
    it('should return empty string when node has no inbound edges', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      seedNodes([conv])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toBe('')
    })

    it('should inject context from a single inbound note', () => {
      const note = createNoteNode('Important reference material', {
        id: 'note-1',
        data: { title: 'Reference Doc' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })
      const edge = createTestEdge('note-1', 'conv-1', { id: 'e-1' })

      seedNodes([note, conv])
      seedEdges([edge])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Reference Doc')
      expect(context).toContain('Important reference material')
    })

    it('should inject context from multiple inbound notes', () => {
      const note1 = createNoteNode('First note content', {
        id: 'note-1',
        data: { title: 'Note A' } as Partial<NoteNodeData>
      })
      const note2 = createNoteNode('Second note content', {
        id: 'note-2',
        data: { title: 'Note B' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([note1, note2, conv])
      seedEdges([
        createTestEdge('note-1', 'conv-1', { id: 'e-1' }),
        createTestEdge('note-2', 'conv-1', { id: 'e-2' })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('First note content')
      expect(context).toContain('Second note content')
    })

    it('should inject task context with status and priority', () => {
      const task = createTaskNode('in-progress', {
        id: 'task-1',
        data: {
          title: 'Fix the bug',
          description: 'There is a crash on startup',
          priority: 'high'
        } as Partial<import('@shared/types').TaskNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([task, conv])
      seedEdges([createTestEdge('task-1', 'conv-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Fix the bug')
      expect(context).toContain('in-progress')
      expect(context).toContain('high')
    })

    it('should inject project context with description', () => {
      const project = createProjectNode([], {
        id: 'proj-1',
        data: {
          title: 'My Project',
          description: 'A great project'
        } as Partial<import('@shared/types').ProjectNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([project, conv])
      seedEdges([createTestEdge('proj-1', 'conv-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('My Project')
      expect(context).toContain('A great project')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge Direction
  // ---------------------------------------------------------------------------

  describe('edge direction', () => {
    it('should NOT follow outbound edges (only inbound provides context)', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      const note = createNoteNode('Should not appear', {
        id: 'note-1',
        data: { title: 'Outbound Note' } as Partial<NoteNodeData>
      })

      seedNodes([conv, note])
      // Edge goes FROM conv TO note — this is outbound from conv's perspective
      seedEdges([createTestEdge('conv-1', 'note-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toBe('')
    })

    it('should follow bidirectional edges where node is source', () => {
      const conv = createConversationNode([], { id: 'conv-1' })
      const note = createNoteNode('Bidirectional content', {
        id: 'note-1',
        data: { title: 'Bidi Note' } as Partial<NoteNodeData>
      })

      seedNodes([conv, note])
      // Edge goes FROM conv TO note, but is bidirectional
      seedEdges([
        createTestEdge('conv-1', 'note-1', {
          id: 'e-1',
          data: { direction: 'bidirectional', active: true } as Partial<EdgeData>
        })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Bidirectional content')
    })
  })

  // ---------------------------------------------------------------------------
  // Depth & Multi-hop
  // ---------------------------------------------------------------------------

  describe('depth traversal', () => {
    it('should traverse depth-2 (note → project → conversation)', () => {
      // Chain: note-1 → proj-1 → conv-1
      const note = createNoteNode('Deep context', {
        id: 'note-1',
        data: { title: 'Deep Note' } as Partial<NoteNodeData>
      })
      const project = createProjectNode([], {
        id: 'proj-1',
        data: { title: 'Middle Project', description: 'Project desc' } as Partial<import('@shared/types').ProjectNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([note, project, conv])
      seedEdges([
        createTestEdge('note-1', 'proj-1', { id: 'e-1' }),
        createTestEdge('proj-1', 'conv-1', { id: 'e-2' })
      ])

      // Default contextSettings.globalDepth is 3
      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Middle Project')
      expect(context).toContain('Deep Note')
      expect(context).toContain('Deep context')
    })

    it('should respect depth limit', () => {
      // Set depth limit to 1
      useWorkspaceStore.setState({ contextSettings: { globalDepth: 1, maxTokens: 16000, traversalMode: 'all', includeDisabledNodes: false } })

      // Chain: note-1 → proj-1 → conv-1 (note is depth 2, should be excluded)
      const note = createNoteNode('Too deep', {
        id: 'note-1',
        data: { title: 'Deep Note' } as Partial<NoteNodeData>
      })
      const project = createProjectNode([], {
        id: 'proj-1',
        data: { title: 'Middle', description: 'Middle desc' } as Partial<import('@shared/types').ProjectNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([note, project, conv])
      seedEdges([
        createTestEdge('note-1', 'proj-1', { id: 'e-1' }),
        createTestEdge('proj-1', 'conv-1', { id: 'e-2' })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Middle')
      expect(context).not.toContain('Too deep')
    })
  })

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  describe('filtering', () => {
    it('should skip inactive edges', () => {
      const note = createNoteNode('Hidden content', {
        id: 'note-1',
        data: { title: 'Hidden Note' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([note, conv])
      seedEdges([
        createTestEdge('note-1', 'conv-1', {
          id: 'e-1',
          data: { active: false } as Partial<EdgeData>
        })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toBe('')
    })

    it('should skip nodes with includeInContext === false', () => {
      const note = createNoteNode('Excluded content', {
        id: 'note-1',
        data: {
          title: 'Excluded Note',
          includeInContext: false
        } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([note, conv])
      seedEdges([createTestEdge('note-1', 'conv-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toBe('')
    })
  })

  // ---------------------------------------------------------------------------
  // Cycle Detection
  // ---------------------------------------------------------------------------

  describe('cycle detection', () => {
    it('should not loop infinitely on circular edges', () => {
      // A → B → C → A (cycle)
      const noteA = createNoteNode('Content A', {
        id: 'note-a',
        data: { title: 'Note A' } as Partial<NoteNodeData>
      })
      const noteB = createNoteNode('Content B', {
        id: 'note-b',
        data: { title: 'Note B' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([noteA, noteB, conv])
      seedEdges([
        createTestEdge('note-a', 'note-b', { id: 'e-1' }),
        createTestEdge('note-b', 'conv-1', { id: 'e-2' }),
        createTestEdge('conv-1', 'note-a', { id: 'e-3' }) // Creates cycle via outbound (harmless)
      ])

      // Should complete without hanging
      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Content B')
      expect(context).toContain('Content A')
    })

    it('should handle bidirectional cycles without infinite loop', () => {
      const noteA = createNoteNode('Content A', {
        id: 'note-a',
        data: { title: 'Note A' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([noteA, conv])
      seedEdges([
        // Bidirectional between conv-1 and note-a
        createTestEdge('note-a', 'conv-1', {
          id: 'e-1',
          data: { direction: 'bidirectional', active: true } as Partial<EdgeData>
        })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      // Should include note-a content (from inbound direction)
      expect(context).toContain('Content A')
    })
  })

  // ---------------------------------------------------------------------------
  // Artifact Injection Formats
  // ---------------------------------------------------------------------------

  describe('artifact injection', () => {
    it('should inject artifact content in full format', () => {
      const artifact = createTestNode<ArtifactNodeData>('artifact', {
        id: 'art-1',
        data: {
          title: 'Code File',
          content: 'const x = 42;',
          contentType: 'code',
          language: 'typescript',
          source: { type: 'created', method: 'manual' },
          version: 1,
          versionHistory: [],
          versioningMode: 'update',
          injectionFormat: 'full',
          collapsed: false,
          previewLines: 10
        } as Partial<ArtifactNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([artifact, conv])
      seedEdges([createTestEdge('art-1', 'conv-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Code File')
      expect(context).toContain('const x = 42;')
      expect(context).toContain('typescript')
    })

    it('should inject artifact in reference-only format', () => {
      const artifact = createTestNode<ArtifactNodeData>('artifact', {
        id: 'art-1',
        data: {
          title: 'Big File',
          content: 'This is a very long content that should not appear',
          contentType: 'code',
          source: { type: 'created', method: 'manual' },
          version: 1,
          versionHistory: [],
          versioningMode: 'update',
          injectionFormat: 'reference-only',
          collapsed: false,
          previewLines: 10
        } as Partial<ArtifactNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([artifact, conv])
      seedEdges([createTestEdge('art-1', 'conv-1', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('conv-1')
      expect(context).toContain('Big File')
      expect(context).toContain('Reference')
      expect(context).not.toContain('This is a very long content')
    })
  })

  // ---------------------------------------------------------------------------
  // Conversation Context
  // ---------------------------------------------------------------------------

  describe('conversation context', () => {
    it('should inject recent messages from connected conversation', () => {
      const sourceConv = createConversationNode(
        [
          { role: 'user', content: 'What is TypeScript?' },
          { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' }
        ],
        { id: 'source-conv', data: { title: 'TS Discussion' } as Partial<ConversationNodeData> }
      )
      const targetConv = createConversationNode([], { id: 'target-conv' })

      seedNodes([sourceConv, targetConv])
      seedEdges([createTestEdge('source-conv', 'target-conv', { id: 'e-1' })])

      const context = getWorkspaceState().getContextForNode('target-conv')
      expect(context).toContain('TS Discussion')
      expect(context).toContain('What is TypeScript?')
      expect(context).toContain('typed superset')
    })
  })

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  describe('sorting', () => {
    it('should put closer nodes before deeper nodes in context', () => {
      // note-deep → note-close → conv
      const noteDeep = createNoteNode('Deep content', {
        id: 'note-deep',
        data: { title: 'Deep' } as Partial<NoteNodeData>
      })
      const noteClose = createNoteNode('Close content', {
        id: 'note-close',
        data: { title: 'Close' } as Partial<NoteNodeData>
      })
      const conv = createConversationNode([], { id: 'conv-1' })

      seedNodes([noteDeep, noteClose, conv])
      seedEdges([
        createTestEdge('note-deep', 'note-close', { id: 'e-1' }),
        createTestEdge('note-close', 'conv-1', { id: 'e-2' })
      ])

      const context = getWorkspaceState().getContextForNode('conv-1')
      const closeIdx = context.indexOf('Close content')
      const deepIdx = context.indexOf('Deep content')
      expect(closeIdx).toBeLessThan(deepIdx)
    })
  })

  // ---------------------------------------------------------------------------
  // Integration: Full workspace fixture
  // ---------------------------------------------------------------------------

  describe('integration', () => {
    it('should work with the standard workspace fixture', () => {
      // This uses the same graph as createWorkspaceFixture:
      // note-1 → conv-1 → task-1
      const conv = createConversationNode(
        [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi!' }],
        { id: 'conv-1' }
      )
      const note = createNoteNode('Important context', {
        id: 'note-1',
        data: { title: 'Context Note' } as Partial<NoteNodeData>
      })
      const task = createTaskNode('todo', { id: 'task-1' })

      seedNodes([conv, note, task])
      seedEdges([
        createTestEdge('note-1', 'conv-1', { id: 'e-note-conv' }),
        createTestEdge('conv-1', 'task-1', { id: 'e-conv-task' })
      ])

      // conv-1 should get context from note-1 (inbound)
      const convContext = getWorkspaceState().getContextForNode('conv-1')
      expect(convContext).toContain('Important context')

      // task-1 should get context from conv-1 (inbound) which includes messages
      const taskContext = getWorkspaceState().getContextForNode('task-1')
      expect(taskContext).toContain('Hello')
    })
  })
})
