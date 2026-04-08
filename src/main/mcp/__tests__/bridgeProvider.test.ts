// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Unit tests for BridgeSyncProvider.
 *
 * Strategy: spin up a lightweight HTTP server that returns canned responses,
 * point BridgeSyncProvider at it. This is simpler than mocking http.request.
 */

import http from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock validation module to avoid pulling in real validation logic
// (the provider delegates to it; we just need it not to throw)
// ---------------------------------------------------------------------------

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

import { BridgeSyncProvider } from '../bridgeProvider'

// ---------------------------------------------------------------------------
// Test HTTP Server — returns canned data based on route
// ---------------------------------------------------------------------------

let testServer: http.Server
let testPort: number
const AUTH_TOKEN = 'test-token-abc123'

// Canned workspace data
const WORKSPACE_META = { id: 'ws-001', name: 'Test Workspace' }
const TEST_NODES = [
  { id: 'n1', type: 'note', position: { x: 0, y: 0 }, data: { type: 'note', title: 'Note 1' } },
  { id: 'n2', type: 'task', position: { x: 100, y: 100 }, data: { type: 'task', title: 'Task 1' } },
]
const TEST_EDGES = [
  {
    id: 'n1-n2',
    source: 'n1',
    target: 'n2',
    data: { direction: 'unidirectional', weight: 5, active: true },
  },
]

// Mutable state for the test server — tests can modify these to control responses
let serverNodes = [...TEST_NODES]
let serverEdges = [...TEST_EDGES]
let serverShouldFail = false

function startTestServer(): Promise<{ port: number; server: http.Server }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (serverShouldFail) {
        res.destroy()
        return
      }

      const url = new URL(req.url || '/', `http://127.0.0.1`)
      const method = req.method || 'GET'
      const pathname = url.pathname

      // Collect body for POST/PATCH
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : null

        // Route
        if (pathname === '/workspace' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(WORKSPACE_META))
          return
        }

        if (pathname === '/nodes' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(serverNodes))
          return
        }

        if (pathname === '/edges' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(serverEdges))
          return
        }

        if (pathname === '/nodes' && method === 'POST') {
          // Echo back the created node with an id
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: body?.id ?? 'new-node', success: true }))
          return
        }

        if (pathname.startsWith('/nodes/') && method === 'PATCH') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
          return
        }

        if (pathname.startsWith('/nodes/') && method === 'DELETE') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
          return
        }

        if (pathname === '/edges' && method === 'POST') {
          const edgeId = `${body?.source}-${body?.target}`
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: edgeId, success: true }))
          return
        }

        if (pathname.startsWith('/edges/') && method === 'DELETE') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
          return
        }

        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
      })
    })

    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, server: srv })
    })
  })
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const { port, server } = await startTestServer()
  testPort = port
  testServer = server
})

afterAll(() => {
  testServer?.close()
})

beforeEach(() => {
  serverNodes = [...TEST_NODES]
  serverEdges = [...TEST_EDGES]
  serverShouldFail = false
})

describe('BridgeSyncProvider', () => {
  function createProvider(): BridgeSyncProvider {
    return new BridgeSyncProvider(testPort, AUTH_TOKEN)
  }

  // -------------------------------------------------------------------------
  // load()
  // -------------------------------------------------------------------------

  describe('load()', () => {
    it('fetches workspace metadata and caches nodes/edges', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getWorkspaceId()).toBe('ws-001')
      expect(provider.getWorkspaceName()).toBe('Test Workspace')
      expect(provider.getNodes()).toHaveLength(2)
      expect(provider.getEdges()).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // createNode()
  // -------------------------------------------------------------------------

  describe('createNode()', () => {
    it('adds node to cache and returns a UUID', async () => {
      const provider = createProvider()
      await provider.load()

      const beforeCount = provider.getNodes().length
      const id = provider.createNode('note', { title: 'New Note' }, { x: 50, y: 50 })

      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(provider.getNodes()).toHaveLength(beforeCount + 1)

      const created = provider.getNode(id)
      expect(created).not.toBeNull()
      expect(created!.position).toEqual({ x: 50, y: 50 })
    })

    it('uses position {0,0} when no position provided', async () => {
      const provider = createProvider()
      await provider.load()

      const id = provider.createNode('task', { title: 'No-pos task' })
      const node = provider.getNode(id)
      expect(node!.position).toEqual({ x: 0, y: 0 })
    })

    it('removes phantom node from cache on POST failure', async () => {
      const provider = createProvider()
      await provider.load()

      // Make the server fail for POST
      serverShouldFail = true
      const id = provider.createNode('note', { title: 'Phantom' })

      // Node is in cache immediately (sync)
      expect(provider.getNode(id)).not.toBeNull()

      // Wait for the async POST to fail and clean up
      await new Promise((r) => setTimeout(r, 200))

      // Node should be removed from cache after failure
      expect(provider.getNode(id)).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // updateNode()
  // -------------------------------------------------------------------------

  describe('updateNode()', () => {
    it('validates changes and updates cache', async () => {
      const provider = createProvider()
      await provider.load()

      provider.updateNode('n1', { title: 'Updated Title' })

      const node = provider.getNode('n1')
      expect(node).not.toBeNull()
      expect(node!.data.title).toBe('Updated Title')
      expect(node!.data.updatedAt).toBeGreaterThan(0)
    })

    it('throws for nonexistent node', async () => {
      const provider = createProvider()
      await provider.load()

      expect(() => provider.updateNode('nonexistent', { title: 'X' })).toThrow('Node not found')
    })
  })

  // -------------------------------------------------------------------------
  // deleteNode()
  // -------------------------------------------------------------------------

  describe('deleteNode()', () => {
    it('removes node and connected edges from cache', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getNode('n1')).not.toBeNull()
      expect(provider.getEdges()).toHaveLength(1)

      provider.deleteNode('n1')

      expect(provider.getNode('n1')).toBeNull()
      // Edge n1-n2 should be removed since n1 was a source
      expect(provider.getEdges()).toHaveLength(0)
    })

    it('throws for nonexistent node', async () => {
      const provider = createProvider()
      await provider.load()

      expect(() => provider.deleteNode('nonexistent')).toThrow('Node not found')
    })
  })

  // -------------------------------------------------------------------------
  // createEdge()
  // -------------------------------------------------------------------------

  describe('createEdge()', () => {
    it('adds edge to cache with source-target ID format', async () => {
      const provider = createProvider()
      await provider.load()

      // Use n2→n1 to avoid conflicting with existing n1-n2 edge from fixture
      const edgeId = provider.createEdge('n2', 'n1', { weight: 10 })

      expect(edgeId).toBe('n2-n1')
      const edge = provider.getEdge(edgeId)
      expect(edge).not.toBeNull()
      expect(edge!.source).toBe('n2')
      expect(edge!.target).toBe('n1')
      expect(edge!.data?.weight).toBe(10)
      expect(edge!.data?.direction).toBe('unidirectional')
      expect(edge!.data?.active).toBe(true)
    })

    it('throws if source node does not exist', async () => {
      const provider = createProvider()
      await provider.load()

      expect(() => provider.createEdge('nonexistent', 'n2')).toThrow('Source node not found')
    })

    it('throws if target node does not exist', async () => {
      const provider = createProvider()
      await provider.load()

      expect(() => provider.createEdge('n1', 'nonexistent')).toThrow('Target node not found')
    })
  })

  // -------------------------------------------------------------------------
  // reload()
  // -------------------------------------------------------------------------

  describe('reload()', () => {
    it('refreshes cache with latest server data', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getNodes()).toHaveLength(2)

      // Add a node to the server's data
      serverNodes = [
        ...TEST_NODES,
        {
          id: 'n3',
          type: 'note',
          position: { x: 200, y: 200 },
          data: { type: 'note', title: 'Note 3' },
        },
      ]

      await provider.reload()
      expect(provider.getNodes()).toHaveLength(3)
    })

    it('keeps stale cache on failure (graceful degradation)', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getNodes()).toHaveLength(2)

      // Make the server unavailable
      serverShouldFail = true

      await provider.reload()

      // Should still have the old data
      expect(provider.getNodes()).toHaveLength(2)
      expect(provider.getWorkspaceId()).toBe('ws-001')
    })
  })

  // -------------------------------------------------------------------------
  // getNode() / getEdge()
  // -------------------------------------------------------------------------

  describe('getNode() / getEdge()', () => {
    it('returns node from cache', async () => {
      const provider = createProvider()
      await provider.load()

      const node = provider.getNode('n1')
      expect(node).not.toBeNull()
      expect(node!.id).toBe('n1')
      expect(node!.data.title).toBe('Note 1')
    })

    it('returns null for nonexistent node', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getNode('nonexistent')).toBeNull()
    })

    it('returns edge from cache', async () => {
      const provider = createProvider()
      await provider.load()

      const edge = provider.getEdge('n1-n2')
      expect(edge).not.toBeNull()
      expect(edge!.source).toBe('n1')
      expect(edge!.target).toBe('n2')
    })

    it('returns null for nonexistent edge', async () => {
      const provider = createProvider()
      await provider.load()

      expect(provider.getEdge('nonexistent')).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // deleteEdge()
  // -------------------------------------------------------------------------

  describe('deleteEdge()', () => {
    it('removes edge from cache', async () => {
      const provider = createProvider()
      await provider.load()

      provider.deleteEdge('n1-n2')
      expect(provider.getEdge('n1-n2')).toBeNull()
      expect(provider.getEdges()).toHaveLength(0)
    })

    it('throws for nonexistent edge', async () => {
      const provider = createProvider()
      await provider.load()

      expect(() => provider.deleteEdge('nonexistent')).toThrow('Edge not found')
    })
  })

  // -------------------------------------------------------------------------
  // flush() and close()
  // -------------------------------------------------------------------------

  describe('flush() and close()', () => {
    it('flush is a no-op (returns immediately)', async () => {
      const provider = createProvider()
      await provider.load()

      // Should not throw
      await provider.flush()
    })

    it('close is safe to call', async () => {
      const provider = createProvider()
      await provider.load()

      // Should not throw
      provider.close()
    })
  })
})
