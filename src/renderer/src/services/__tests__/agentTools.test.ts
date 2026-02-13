/**
 * AgentTools Service Tests
 *
 * Tests for agent tool execution and tool selection.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { executeTool, getToolsForAgent } from '../agentTools'
import { resetWorkspaceStore, getWorkspaceState, seedNode, seedNodes } from '../../../../test/storeUtils'
import { createNoteNode, createTaskNode, resetTestCounters } from '../../../../test/utils'
import type { AgentSettings } from '@shared/types'

// Default agent settings with required fields
const defaultSettings: AgentSettings = {
  canCreateNodes: false,
  canCreateEdges: false,
  canModifyNodes: false,
  canDeleteNodes: false,
  canDeleteEdges: false,
  autoExecuteTools: true,
  maxToolCallsPerTurn: 10,
  scopeMode: 'connected',
  canReadFiles: false,
  canWriteFiles: false,
  canExecuteCommands: false,
  allowedPaths: [],
  allowedCommands: [],
  mcpServers: []
}

describe('agentTools', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
  })

  describe('getToolsForAgent', () => {
    it('should always include query tools', () => {
      const settings: AgentSettings = { ...defaultSettings }

      const tools = getToolsForAgent(settings)

      // Query tools: get_context, find_nodes, get_selection, get_node_details
      expect(tools.length).toBeGreaterThanOrEqual(4)
      expect(tools.some((t) => t.name === 'get_context')).toBe(true)
      expect(tools.some((t) => t.name === 'find_nodes')).toBe(true)
      expect(tools.some((t) => t.name === 'get_selection')).toBe(true)
      expect(tools.some((t) => t.name === 'get_node_details')).toBe(true)
    })

    it('should include create_node tool when canCreateNodes is true', () => {
      const settings: AgentSettings = { ...defaultSettings, canCreateNodes: true }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'create_node')).toBe(true)
    })

    it('should include create_edge tool when canCreateEdges is true', () => {
      const settings: AgentSettings = { ...defaultSettings, canCreateEdges: true }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'create_edge')).toBe(true)
    })

    it('should include update_node and move_node tools when canModifyNodes is true', () => {
      const settings: AgentSettings = { ...defaultSettings, canModifyNodes: true }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'update_node')).toBe(true)
      expect(tools.some((t) => t.name === 'move_node')).toBe(true)
    })

    it('should include delete_node tool when canDeleteNodes is true', () => {
      const settings: AgentSettings = { ...defaultSettings, canDeleteNodes: true }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'delete_node')).toBe(true)
    })

    it('should include delete_edge tool when canDeleteEdges is true', () => {
      const settings: AgentSettings = { ...defaultSettings, canDeleteEdges: true }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'delete_edge')).toBe(true)
    })

    it('should include all tools when all permissions are granted', () => {
      const settings: AgentSettings = {
        ...defaultSettings,
        canCreateNodes: true,
        canCreateEdges: true,
        canModifyNodes: true,
        canDeleteNodes: true,
        canDeleteEdges: true
      }

      const tools = getToolsForAgent(settings)

      expect(tools.some((t) => t.name === 'get_context')).toBe(true)
      expect(tools.some((t) => t.name === 'find_nodes')).toBe(true)
      expect(tools.some((t) => t.name === 'get_selection')).toBe(true)
      expect(tools.some((t) => t.name === 'get_node_details')).toBe(true)
      expect(tools.some((t) => t.name === 'create_node')).toBe(true)
      expect(tools.some((t) => t.name === 'create_edge')).toBe(true)
      expect(tools.some((t) => t.name === 'update_node')).toBe(true)
      expect(tools.some((t) => t.name === 'move_node')).toBe(true)
      expect(tools.some((t) => t.name === 'delete_node')).toBe(true)
      expect(tools.some((t) => t.name === 'delete_edge')).toBe(true)
    })
  })

  // Type helper for test result assertions
  type AnyResult = Record<string, unknown>

  describe('executeTool', () => {
    describe('find_nodes', () => {
      it('should find all nodes when no filters provided', async () => {
        const note1 = createNoteNode('Note 1', { id: 'note-1' })
        const note2 = createNoteNode('Note 2', { id: 'note-2' })
        seedNodes([note1, note2])

        const result = await executeTool('find_nodes', {}, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.nodes).toHaveLength(2)
        expect(data.total).toBe(2)
      })

      it('should filter nodes by type', async () => {
        const note = createNoteNode('Note', { id: 'note-1' })
        const task = createTaskNode('todo', { id: 'task-1' })
        seedNodes([note, task])

        const result = await executeTool('find_nodes', { type: 'task' }, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.nodes).toHaveLength(1)
        expect((data.nodes as AnyResult[])[0]!.type).toBe('task')
      })

      it('should filter nodes by title', async () => {
        const note1 = createNoteNode('Meeting Notes', { id: 'note-1' })
        note1.data.title = 'Meeting Notes'
        const note2 = createNoteNode('Todo List', { id: 'note-2' })
        note2.data.title = 'Todo List'
        seedNodes([note1, note2])

        const result = await executeTool('find_nodes', { titleContains: 'Meeting' }, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.nodes).toHaveLength(1)
        expect((data.nodes as AnyResult[])[0]!.title).toBe('Meeting Notes')
      })

      it('should respect limit parameter', async () => {
        const notes = Array.from({ length: 20 }, (_, i) =>
          createNoteNode(`Note ${i}`, { id: `note-${i}` })
        )
        seedNodes(notes)

        const result = await executeTool('find_nodes', { limit: 5 }, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.nodes).toHaveLength(5)
        expect(data.total).toBe(20)
      })
    })

    describe('get_selection', () => {
      it('should return empty array when nothing selected', async () => {
        const note = createNoteNode('Note', { id: 'note-1' })
        seedNode(note)

        const result = await executeTool('get_selection', {}, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.selectedNodes).toHaveLength(0)
      })

      it('should return selected nodes', async () => {
        const note1 = createNoteNode('Note 1', { id: 'note-1' })
        const note2 = createNoteNode('Note 2', { id: 'note-2' })
        seedNodes([note1, note2])

        const { setSelectedNodes } = getWorkspaceState()
        setSelectedNodes(['note-1'])

        const result = await executeTool('get_selection', {}, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.selectedNodes).toHaveLength(1)
        expect((data.selectedNodes as AnyResult[])[0]!.id).toBe('note-1')
      })
    })

    describe('get_node_details', () => {
      it('should return node details', async () => {
        const note = createNoteNode('Test content', { id: 'note-1', position: { x: 100, y: 200 } })
        note.data.title = 'Test Title'
        seedNode(note)

        const result = await executeTool('get_node_details', { nodeId: 'note-1' }, 'agent-conv-id')
        const data = result.result as AnyResult
        const node = data.node as AnyResult

        expect(result.success).toBe(true)
        expect(node.id).toBe('note-1')
        expect(node.type).toBe('note')
        expect(node.title).toBe('Test Title')
        expect(node.position).toEqual({ x: 100, y: 200 })
      })

      it('should return error for non-existent node', async () => {
        const result = await executeTool('get_node_details', { nodeId: 'non-existent' }, 'agent-conv-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Node not found')
      })
    })

    describe('create_node', () => {
      it('should create a new node', async () => {
        const result = await executeTool(
          'create_node',
          { type: 'note', title: 'New Note', content: 'Content' },
          'agent-conv-id'
        )
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.nodeId).toBeDefined()
        expect(data.type).toBe('note')

        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(1)
      })

      it('should create node at specified position', async () => {
        const result = await executeTool(
          'create_node',
          { type: 'note', title: 'New Note', position: { x: 500, y: 300 } },
          'agent-conv-id'
        )

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.nodes[0]!.position).toEqual({ x: 500, y: 300 })
      })

      it('should create edge when connectTo is provided', async () => {
        const existingNote = createNoteNode('Existing', { id: 'existing-1' })
        seedNode(existingNote)

        const result = await executeTool(
          'create_node',
          { type: 'note', title: 'New Note', connectTo: 'existing-1' },
          'agent-conv-id'
        )

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.edges).toHaveLength(1)
        expect(state.edges[0]!.source).toBe('existing-1')
      })
    })

    describe('create_edge', () => {
      it('should create an edge between nodes', async () => {
        const note1 = createNoteNode('Note 1', { id: 'note-1' })
        const note2 = createNoteNode('Note 2', { id: 'note-2' })
        seedNodes([note1, note2])

        const result = await executeTool(
          'create_edge',
          { source: 'note-1', target: 'note-2' },
          'agent-conv-id'
        )

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.edges).toHaveLength(1)
        expect(state.edges[0]!.source).toBe('note-1')
        expect(state.edges[0]!.target).toBe('note-2')
      })
    })

    describe('update_node', () => {
      it('should update node properties', async () => {
        const note = createNoteNode('Original', { id: 'note-1' })
        seedNode(note)

        const result = await executeTool(
          'update_node',
          { nodeId: 'note-1', title: 'Updated Title', content: 'New content' },
          'agent-conv-id'
        )
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.updated).toContain('title')
        expect(data.updated).toContain('content')

        const state = getWorkspaceState()
        const updatedNode = state.nodes.find((n) => n.id === 'note-1')
        expect((updatedNode?.data as { title?: string }).title).toBe('Updated Title')
      })

      it('should return error for non-existent node', async () => {
        const result = await executeTool(
          'update_node',
          { nodeId: 'non-existent', title: 'Test' },
          'agent-conv-id'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Node not found')
      })
    })

    describe('move_node', () => {
      it('should move node to new position', async () => {
        const note = createNoteNode('Note', { id: 'note-1', position: { x: 0, y: 0 } })
        seedNode(note)

        const result = await executeTool(
          'move_node',
          { nodeId: 'note-1', position: { x: 200, y: 300 } },
          'agent-conv-id'
        )

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.nodes[0]!.position).toEqual({ x: 200, y: 300 })
      })

      it('should return error for non-existent node', async () => {
        const result = await executeTool(
          'move_node',
          { nodeId: 'non-existent', position: { x: 0, y: 0 } },
          'agent-conv-id'
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('Node not found')
      })
    })

    describe('delete_node', () => {
      it('should delete a node', async () => {
        const note = createNoteNode('Note', { id: 'note-1' })
        seedNode(note)

        const result = await executeTool('delete_node', { nodeId: 'note-1' }, 'agent-conv-id')
        const data = result.result as AnyResult

        expect(result.success).toBe(true)
        expect(data.deleted).toBe('note-1')

        const state = getWorkspaceState()
        expect(state.nodes).toHaveLength(0)
      })

      it('should return error for non-existent node', async () => {
        const result = await executeTool('delete_node', { nodeId: 'non-existent' }, 'agent-conv-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Node not found')
      })
    })

    describe('delete_edge', () => {
      it('should delete an edge', async () => {
        const note1 = createNoteNode('Note 1', { id: 'note-1' })
        const note2 = createNoteNode('Note 2', { id: 'note-2' })
        seedNodes([note1, note2])

        const { onConnect } = getWorkspaceState()
        onConnect({ source: 'note-1', target: 'note-2', sourceHandle: null, targetHandle: null })

        const edgeId = getWorkspaceState().edges[0]!.id

        const result = await executeTool('delete_edge', { edgeId }, 'agent-conv-id')

        expect(result.success).toBe(true)

        const state = getWorkspaceState()
        expect(state.edges).toHaveLength(0)
      })
    })

    describe('error handling', () => {
      it('should return error for unknown tool', async () => {
        const result = await executeTool('unknown_tool', {}, 'agent-conv-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Unknown tool')
      })
    })
  })
})
