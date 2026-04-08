// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * E2E test: BridgeSyncProvider → HTTP → mcpBridge server → mock queryFn.
 *
 * Tests the full wire: provider makes HTTP calls that hit the real bridge
 * server, which calls the mock queryFn, and the response flows back.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock electron and contextWriter BEFORE importing mcpBridge
// ---------------------------------------------------------------------------

const tmpDir = require('os').tmpdir()

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tmpDir),
    isPackaged: false,
  },
  ipcMain: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}))

vi.mock('../../services/contextWriter', () => ({
  buildContextForNode: vi.fn().mockResolvedValue({
    markdown: '# E2E Context',
    entries: [],
  }),
  getAppPath: vi.fn(() => tmpDir),
}))

// Mock validation (pass-through — real validation is tested elsewhere)
vi.mock('../validation', () => ({
  validateCreateNodeData: (_type: string, data: Record<string, unknown>) => ({
    type: _type,
    title: data.title ?? 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...data,
  }),
  validateNodeChanges: (_type: string, changes: Record<string, unknown>) => changes,
}))

import { startBridge, stopBridge } from '../../services/mcpBridge'
import type { QueryFn } from '../../services/mcpBridgeIpc'
import { BridgeSyncProvider } from '../bridgeProvider'

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

const TEST_WORKSPACE_ID = 'test-ws-e2e'

// Mutable data store that the queryFn reads from
let dataStore = {
  nodes: [
    {
      id: 'e2e-n1',
      type: 'note',
      position: { x: 10, y: 20 },
      data: { type: 'note', title: 'E2E Note 1' },
    },
  ],
  edges: [] as Array<{
    id: string
    source: string
    target: string
    data?: Record<string, unknown>
  }>,
}

let mockQueryFn: QueryFn
let provider: BridgeSyncProvider

beforeAll(async () => {
  // Create a queryFn that reads from our mutable data store
  mockQueryFn = vi.fn(async (type: string, params?: Record<string, unknown>) => {
    switch (type) {
      case 'get-workspace-meta':
        return { id: TEST_WORKSPACE_ID, name: 'E2E Test Workspace' }
      case 'get-nodes':
        return dataStore.nodes
      case 'get-node': {
        const node = dataStore.nodes.find((n) => n.id === params?.id)
        return node ?? null
      }
      case 'get-edges':
        return dataStore.edges
      case 'create-node': {
        const newId = (params?.id as string) || `created-${Date.now()}`
        const newNode = {
          id: newId,
          type: (params?.type as string) || 'note',
          position: (params?.position as { x: number; y: number }) || { x: 0, y: 0 },
          data: {
            ...((params?.data as Record<string, unknown>) ?? {}),
            type: params?.type || 'note',
          },
        }
        dataStore.nodes.push(newNode)
        return { id: newId, success: true }
      }
      case 'update-node':
        return { success: true }
      case 'delete-node': {
        dataStore.nodes = dataStore.nodes.filter((n) => n.id !== params?.id)
        return { success: true }
      }
      case 'create-edge': {
        const edgeId = `${params?.source}-${params?.target}`
        dataStore.edges.push({
          id: edgeId,
          source: params?.source as string,
          target: params?.target as string,
        })
        return { id: edgeId, success: true }
      }
      case 'delete-edge':
        return { success: true }
      case 'search-nodes':
        return dataStore.nodes.filter((n) =>
          n.data.title
            ?.toString()
            .toLowerCase()
            .includes(((params?.query as string) || '').toLowerCase()),
        )
      default:
        return null
    }
  })

  // Start the real bridge server with our mock queryFn
  const { port, token } = await startBridge(TEST_WORKSPACE_ID, mockQueryFn)

  // Create a real BridgeSyncProvider pointing at the bridge
  provider = new BridgeSyncProvider(port, token)
})

afterAll(() => {
  provider?.close()
  stopBridge()
})

beforeEach(() => {
  // Reset the data store
  dataStore = {
    nodes: [
      {
        id: 'e2e-n1',
        type: 'note',
        position: { x: 10, y: 20 },
        data: { type: 'note', title: 'E2E Note 1' },
      },
    ],
    edges: [],
  }
  vi.mocked(mockQueryFn).mockClear()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BridgeSyncProvider → Bridge Server E2E', () => {
  it('load() populates provider cache via bridge and queryFn', async () => {
    await provider.load()

    expect(provider.getWorkspaceId()).toBe(TEST_WORKSPACE_ID)
    expect(provider.getWorkspaceName()).toBe('E2E Test Workspace')
    expect(provider.getNodes()).toHaveLength(1)
    expect(provider.getNodes()[0]!.id).toBe('e2e-n1')
  })

  it('createNode() triggers queryFn with create-node via bridge', async () => {
    await provider.load()

    const id = provider.createNode('note', { title: 'E2E Created Note' }, { x: 100, y: 200 })

    // The node is in the provider's local cache immediately
    expect(typeof id).toBe('string')
    expect(provider.getNode(id)).not.toBeNull()

    // Wait for the async POST to complete
    await new Promise((r) => setTimeout(r, 300))

    // Verify the queryFn was called with 'createNode'
    const calls = vi.mocked(mockQueryFn).mock.calls
    const createCall = calls.find(([t]) => t === 'create-node')
    expect(createCall).toBeDefined()
  })

  it('reload() picks up new data from the mock queryFn', async () => {
    await provider.load()
    expect(provider.getNodes()).toHaveLength(1)

    // Add a node to the data store (simulating renderer adding a node)
    dataStore.nodes.push({
      id: 'e2e-n2',
      type: 'task',
      position: { x: 300, y: 300 },
      data: { type: 'task', title: 'E2E Task Added Externally' },
    })

    await provider.reload()

    expect(provider.getNodes()).toHaveLength(2)
    const newNode = provider.getNode('e2e-n2')
    expect(newNode).not.toBeNull()
    expect(newNode!.data.title).toBe('E2E Task Added Externally')
  })

  it('full round-trip: createNode → reload → see node in queryFn store', async () => {
    await provider.load()

    // Create via provider (goes through HTTP to bridge to queryFn)
    const nodeId = provider.createNode('task', { title: 'Round Trip Task' })

    // Wait for async POST
    await new Promise((r) => setTimeout(r, 300))

    // The queryFn's store should now have a new node
    // (our mock queryFn pushes to dataStore on createNode)
    expect(dataStore.nodes.length).toBeGreaterThan(1)

    // Reload picks up the authoritative state
    await provider.reload()

    // Provider should see all nodes the store has
    expect(provider.getNodes().length).toBe(dataStore.nodes.length)
  })

  it('updateNode() sends PATCH to bridge', async () => {
    await provider.load()

    provider.updateNode('e2e-n1', { title: 'Updated via E2E' })

    // Wait for async PATCH
    await new Promise((r) => setTimeout(r, 300))

    const calls = vi.mocked(mockQueryFn).mock.calls
    const updateCall = calls.find(([t]) => t === 'update-node')
    expect(updateCall).toBeDefined()
    expect(updateCall![1]?.id).toBe('e2e-n1')
  })

  it('deleteNode() sends DELETE to bridge', async () => {
    await provider.load()

    provider.deleteNode('e2e-n1')

    // Node removed from local cache immediately
    expect(provider.getNode('e2e-n1')).toBeNull()

    // Wait for async DELETE
    await new Promise((r) => setTimeout(r, 300))

    const calls = vi.mocked(mockQueryFn).mock.calls
    const deleteCall = calls.find(([t]) => t === 'delete-node')
    expect(deleteCall).toBeDefined()
  })
})

describe('bridge ↔ renderer type contract', () => {
  // These are the types mcpBridge.ts sends via query().
  // If you change a type here, you MUST update BridgeResponder.ts too.
  const BRIDGE_QUERY_TYPES = [
    'get-workspace-meta',
    'get-nodes',
    'get-node',
    'get-edges',
    'search-nodes',
    'create-node',
    'update-node',
    'delete-node',
    'create-edge',
    'delete-edge',
  ]

  it('all bridge query types are handled by BridgeResponder', () => {
    // Read BridgeResponder.ts source and verify each type has a case label.
    // This prevents the camelCase/kebab-case mismatch from recurring.
    const fs = require('fs')
    const path = require('path')
    const responderSource = fs.readFileSync(
      path.resolve(__dirname, '../../../renderer/src/sync/BridgeResponder.ts'),
      'utf-8',
    )
    for (const type of BRIDGE_QUERY_TYPES) {
      expect(responderSource).toContain(`case '${type}'`)
    }
  })
})
