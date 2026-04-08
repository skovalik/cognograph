// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Integration tests for the MCP Bridge HTTP server (mcpBridge.ts).
 *
 * Strategy: use startBridge(workspaceId, mockQueryFn) with a mock queryFn
 * so we never touch IPC or Electron. Make real HTTP requests to the bridge.
 */

import http from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock electron BEFORE any imports that use it
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

// Mock contextWriter to avoid real filesystem context building
vi.mock('../contextWriter', () => ({
  buildContextForNode: vi.fn().mockResolvedValue({
    markdown: '# Test Context',
    entries: [],
  }),
  getAppPath: vi.fn(() => tmpDir),
}))

// Mock validation (pass-through)
vi.mock('../../mcp/validation', () => ({
  validateCreateNodeData: (_type: string, data: Record<string, unknown>) => ({
    type: _type,
    title: data.title ?? 'Untitled',
    ...data,
  }),
  validateNodeChanges: (_type: string, changes: Record<string, unknown>) => changes,
}))

// Import after mocks are set up
import { getBridgeConfig, startBridge, stopBridge } from '../mcpBridge'
import type { QueryFn } from '../mcpBridgeIpc'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_WORKSPACE_ID = 'test-ws-integration'

const TEST_NODES = [
  { id: 'n1', type: 'note', position: { x: 0, y: 0 }, data: { type: 'note', title: 'Note 1' } },
  { id: 'n2', type: 'task', position: { x: 100, y: 100 }, data: { type: 'task', title: 'Task 1' } },
]

const TEST_EDGES = [
  { id: 'n1-n2', source: 'n1', target: 'n2', data: { direction: 'unidirectional' } },
]

// ---------------------------------------------------------------------------
// Mock QueryFn
// ---------------------------------------------------------------------------

let mockQueryFn: QueryFn

function createMockQueryFn(): QueryFn {
  return vi.fn(async (type: string, params?: Record<string, unknown>) => {
    switch (type) {
      case 'get-workspace-meta':
        return { id: TEST_WORKSPACE_ID, name: 'Test Workspace' }
      case 'get-nodes':
        return TEST_NODES
      case 'get-node': {
        const node = TEST_NODES.find((n) => n.id === params?.id)
        return node ?? null
      }
      case 'get-edges':
        return TEST_EDGES
      case 'create-node':
        return { id: 'created-node-id', success: true }
      case 'update-node':
        return { success: true }
      case 'delete-node':
        return { success: true }
      case 'create-edge':
        return { id: `${params?.source}-${params?.target}`, success: true }
      case 'delete-edge':
        return { success: true }
      case 'search-nodes':
        return []
      default:
        return null
    }
  })
}

// ---------------------------------------------------------------------------
// HTTP Request Helper
// ---------------------------------------------------------------------------

function httpRequest(
  port: number,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; data: unknown; raw: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const reqHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload !== undefined
        ? {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(payload)),
          }
        : {}),
      ...headers,
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
        timeout: 5000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8')
          let data: unknown
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          resolve({ status: res.statusCode ?? 0, data, raw })
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

let bridgePort: number
let bridgeToken: string

beforeAll(async () => {
  mockQueryFn = createMockQueryFn()
  const config = await startBridge(TEST_WORKSPACE_ID, mockQueryFn)
  bridgePort = config.port
  bridgeToken = config.token
})

afterAll(() => {
  stopBridge()
})

beforeEach(() => {
  // Reset the mock between tests
  vi.mocked(mockQueryFn).mockClear()
})

describe('MCP Bridge HTTP Server', () => {
  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  describe('authentication', () => {
    it('rejects requests without auth token (401)', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes')
      expect(res.status).toBe(401)
      expect((res.data as Record<string, unknown>).error).toBe('Unauthorized')
    })

    it('rejects requests with wrong token (401)', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes', 'wrong-token')
      expect(res.status).toBe(401)
      expect((res.data as Record<string, unknown>).error).toBe('Unauthorized')
    })

    it('rejects requests with Origin header (403)', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes', bridgeToken, undefined, {
        Origin: 'http://evil.com',
      })
      expect(res.status).toBe(403)
    })
  })

  // -----------------------------------------------------------------------
  // Health Check
  // -----------------------------------------------------------------------

  describe('GET /status', () => {
    it('returns ok WITHOUT auth', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/status')
      expect(res.status).toBe(200)
      expect((res.data as Record<string, unknown>).status).toBe('ok')
    })
  })

  // -----------------------------------------------------------------------
  // GET /workspace
  // -----------------------------------------------------------------------

  describe('GET /workspace', () => {
    it('returns workspace metadata WITH auth', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/workspace', bridgeToken)
      expect(res.status).toBe(200)
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe(TEST_WORKSPACE_ID)
      expect(data.name).toBe('Test Workspace')
    })
  })

  // -----------------------------------------------------------------------
  // GET /nodes
  // -----------------------------------------------------------------------

  describe('GET /nodes', () => {
    it('returns nodes with correct auth', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes', bridgeToken)
      expect(res.status).toBe(200)
      const data = res.data as unknown[]
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
    })
  })

  // -----------------------------------------------------------------------
  // POST /nodes
  // -----------------------------------------------------------------------

  describe('POST /nodes', () => {
    it('creates node (201)', async () => {
      const res = await httpRequest(bridgePort, 'POST', '/nodes', bridgeToken, {
        type: 'note',
        title: 'New Test Note',
      })
      expect(res.status).toBe(201)
      const data = res.data as Record<string, unknown>
      expect(data.id).toBeDefined()
    })

    it('rejects POST without Content-Type (415)', async () => {
      // Send raw request without Content-Type
      const res = await new Promise<{ status: number; data: unknown }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: bridgePort,
            path: '/nodes',
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bridgeToken}`,
            },
          },
          (r) => {
            const chunks: Buffer[] = []
            r.on('data', (c: Buffer) => chunks.push(c))
            r.on('end', () => {
              const raw = Buffer.concat(chunks).toString()
              resolve({ status: r.statusCode ?? 0, data: JSON.parse(raw) })
            })
          },
        )
        req.on('error', reject)
        req.write('{}')
        req.end()
      })
      expect(res.status).toBe(415)
    })
  })

  // -----------------------------------------------------------------------
  // GET /nodes/:id
  // -----------------------------------------------------------------------

  describe('GET /nodes/:id', () => {
    it('returns 404 for unknown node', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes/nonexistent', bridgeToken)
      expect(res.status).toBe(404)
    })

    it('returns existing node', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/nodes/n1', bridgeToken)
      expect(res.status).toBe(200)
      const data = res.data as Record<string, unknown>
      expect(data.id).toBe('n1')
    })
  })

  // -----------------------------------------------------------------------
  // 404 for unknown routes
  // -----------------------------------------------------------------------

  describe('unknown routes', () => {
    it('returns 404', async () => {
      const res = await httpRequest(bridgePort, 'GET', '/does-not-exist', bridgeToken)
      expect(res.status).toBe(404)
    })
  })

  // -----------------------------------------------------------------------
  // getBridgeConfig
  // -----------------------------------------------------------------------

  describe('getBridgeConfig()', () => {
    it('returns port and token while bridge is running', () => {
      const config = getBridgeConfig()
      expect(config).not.toBeNull()
      expect(config!.port).toBe(bridgePort)
      expect(config!.token).toBe(bridgeToken)
    })
  })
})
