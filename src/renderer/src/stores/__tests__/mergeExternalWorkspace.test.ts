import type { WorkspaceData } from '@shared/types'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getWorkspaceState,
  resetWorkspaceStore,
  seedEdges,
  seedNodes,
} from '../../../../test/storeUtils'
import {
  createConversationNode,
  createNoteNode,
  createTestEdge,
  resetTestCounters,
} from '../../../../test/utils'
import { useWorkspaceStore } from '../workspaceStore'

function makeWorkspaceData(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    id: 'test-workspace',
    name: 'Test Workspace',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    ...overrides,
  }
}

describe('mergeExternalWorkspace', () => {
  beforeEach(() => {
    resetWorkspaceStore()
    resetTestCounters()
    useWorkspaceStore.setState({ workspaceId: 'test-workspace' })
  })

  it('prevents position clobber: dragged nodes survive stale MCP file write', () => {
    const node1 = createNoteNode('Note 1', { id: 'n1', position: { x: 0, y: 0 } })
    const node2 = createNoteNode('Note 2', { id: 'n2', position: { x: 100, y: 200 } })
    const node3 = createNoteNode('Note 3', { id: 'n3', position: { x: -50, y: 300 } })
    seedNodes([node1, node2, node3])

    useWorkspaceStore.getState().moveNode('n1', { x: 10, y: 20 })
    useWorkspaceStore.getState().moveNode('n2', { x: 110, y: 210 })
    useWorkspaceStore.getState().moveNode('n3', { x: -40, y: 310 })

    const newMcpNode = createNoteNode('MCP Node', { id: 'n4', position: { x: 500, y: 500 } })
    const staleData = makeWorkspaceData({
      nodes: [
        createNoteNode('Note 1', { id: 'n1', position: { x: 0, y: 0 } }),
        createNoteNode('Note 2', { id: 'n2', position: { x: 100, y: 200 } }),
        createNoteNode('Note 3', { id: 'n3', position: { x: -50, y: 300 } }),
        newMcpNode,
      ],
      edges: [],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(staleData)

    const state = getWorkspaceState()
    expect(state.nodes).toHaveLength(4)

    const n1 = state.nodes.find((n) => n.id === 'n1')!
    const n2 = state.nodes.find((n) => n.id === 'n2')!
    const n3 = state.nodes.find((n) => n.id === 'n3')!
    const n4 = state.nodes.find((n) => n.id === 'n4')!

    expect(n1.position).toEqual({ x: 10, y: 20 })
    expect(n2.position).toEqual({ x: 110, y: 210 })
    expect(n3.position).toEqual({ x: -40, y: 310 })
    expect(n4.position).toEqual({ x: 500, y: 500 })
    expect(state.isDirty).toBe(true)
  })

  it('preserves existing node positions while adding new nodes', () => {
    const node1 = createNoteNode('A', { id: 'a', position: { x: 10, y: 20 } })
    const node2 = createNoteNode('B', { id: 'b', position: { x: 30, y: 40 } })
    const node3 = createNoteNode('C', { id: 'c', position: { x: 50, y: 60 } })
    seedNodes([node1, node2, node3])

    const incoming = makeWorkspaceData({
      nodes: [
        createNoteNode('A', { id: 'a', position: { x: 999, y: 999 } }),
        createNoteNode('B', { id: 'b', position: { x: 888, y: 888 } }),
        createNoteNode('C', { id: 'c', position: { x: 777, y: 777 } }),
        createNoteNode('New', { id: 'd', position: { x: 200, y: 200 } }),
      ],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.nodes).toHaveLength(4)
    expect(state.nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 10, y: 20 })
    expect(state.nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 30, y: 40 })
    expect(state.nodes.find((n) => n.id === 'c')!.position).toEqual({ x: 50, y: 60 })
    expect(state.nodes.find((n) => n.id === 'd')!.position).toEqual({ x: 200, y: 200 })
    expect(state.isDirty).toBe(true)
  })

  it('renderer wins: existing node data is NOT overwritten by stale file data', () => {
    const node = createNoteNode('Edited Title', {
      id: 'x',
      position: { x: 100, y: 100 },
      data: {
        type: 'note',
        title: 'Edited Title',
        content: 'current content',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any,
    })
    seedNodes([node])

    const incoming = makeWorkspaceData({
      nodes: [
        createNoteNode('Old Title', {
          id: 'x',
          position: { x: 200, y: 200 },
          data: {
            type: 'note',
            title: 'Old Title',
            content: 'old content',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as any,
        }),
      ],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    const merged = state.nodes.find((n) => n.id === 'x')!
    expect(merged.data.title).toBe('Edited Title')
    expect(merged.position).toEqual({ x: 100, y: 100 })
  })

  it('does not clobber array fields (conversation messages)', () => {
    const conv = createConversationNode([{ role: 'user', content: 'hello' }], {
      id: 'conv1',
      position: { x: 0, y: 0 },
    })
    seedNodes([conv])

    const emptyConv = createConversationNode([], {
      id: 'conv1',
      position: { x: 0, y: 0 },
    })
    const incoming = makeWorkspaceData({ nodes: [emptyConv] })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    const merged = state.nodes.find((n) => n.id === 'conv1')!
    const messages = (merged.data as any).messages
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('hello')
  })

  it('adds new edges without removing existing ones', () => {
    const n1 = createNoteNode('A', { id: 'n1', position: { x: 0, y: 0 } })
    const n2 = createNoteNode('B', { id: 'n2', position: { x: 100, y: 0 } })
    const n3 = createNoteNode('C', { id: 'n3', position: { x: 200, y: 0 } })
    seedNodes([n1, n2, n3])

    const e1 = createTestEdge('n1', 'n2', { id: 'e1' })
    const e2 = createTestEdge('n2', 'n3', { id: 'e2' })
    seedEdges([e1, e2])

    const incoming = makeWorkspaceData({
      nodes: [n1, n2, n3],
      edges: [createTestEdge('n1', 'n2', { id: 'e1' }), createTestEdge('n1', 'n3', { id: 'e3' })],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.edges).toHaveLength(3)
    const edgeIds = state.edges.map((e) => e.id).sort()
    expect(edgeIds).toEqual(['e1', 'e2', 'e3'])
  })

  it('migrates new edges with handle swap and strength migration', () => {
    const n1 = createNoteNode('A', { id: 'n1', position: { x: 0, y: 0 } })
    const n2 = createNoteNode('B', { id: 'n2', position: { x: 100, y: 0 } })
    seedNodes([n1, n2])

    const incoming = makeWorkspaceData({
      nodes: [n1, n2],
      edges: [
        createTestEdge('n1', 'n2', {
          id: 'migrated-edge',
          sourceHandle: 'handle-target',
          targetHandle: 'handle-source',
          data: { direction: 'unidirectional', weight: 2, active: true },
        }),
      ],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.edges).toHaveLength(1)
    const edge = state.edges[0]!
    expect(edge.sourceHandle).toBe('handle-source')
    expect(edge.targetHandle).toBe('handle-target')
    expect(edge.data!.strength).toBe('light')
    expect(edge.type).toBe('custom')
  })

  it('does not overwrite viewport', () => {
    useWorkspaceStore.setState({ viewport: { x: 100, y: 100, zoom: 2 } })

    const incoming = makeWorkspaceData({
      viewport: { x: 0, y: 0, zoom: 1 },
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.viewport).toEqual({ x: 100, y: 100, zoom: 2 })
  })

  it('handles empty incoming data gracefully', () => {
    const n1 = createNoteNode('A', { id: 'n1', position: { x: 0, y: 0 } })
    const n2 = createNoteNode('B', { id: 'n2', position: { x: 100, y: 0 } })
    const n3 = createNoteNode('C', { id: 'n3', position: { x: 200, y: 0 } })
    seedNodes([n1, n2, n3])

    const e1 = createTestEdge('n1', 'n2', { id: 'e1' })
    const e2 = createTestEdge('n2', 'n3', { id: 'e2' })
    seedEdges([e1, e2])

    const incoming = makeWorkspaceData({ nodes: [], edges: [] })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.nodes).toHaveLength(3)
    expect(state.edges).toHaveLength(2)
  })

  it('is idempotent: double-fire produces no duplicates', () => {
    const n1 = createNoteNode('A', { id: 'n1', position: { x: 0, y: 0 } })
    const n2 = createNoteNode('B', { id: 'n2', position: { x: 100, y: 0 } })
    seedNodes([n1, n2])

    const e1 = createTestEdge('n1', 'n2', { id: 'e1' })
    seedEdges([e1])

    const newNode = createNoteNode('New', { id: 'n3', position: { x: 200, y: 200 } })
    const newEdge = createTestEdge('n1', 'n3', { id: 'e2' })
    const incoming = makeWorkspaceData({
      nodes: [n1, n2, newNode],
      edges: [e1, newEdge],
    })

    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)
    useWorkspaceStore.getState().mergeExternalWorkspace(incoming)

    const state = getWorkspaceState()
    expect(state.nodes).toHaveLength(3)
    expect(state.edges).toHaveLength(2)
  })
})
