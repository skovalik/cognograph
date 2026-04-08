// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock electron before importing anything
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}))

// Mock fs — contextWriter uses it for writeContextFile
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockReadFile = vi.fn().mockRejectedValue(new Error('not mocked'))

vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: (...args: unknown[]) => mockMkdir(...args),
      writeFile: (...args: unknown[]) => mockWriteFile(...args),
      readFile: (...args: unknown[]) => mockReadFile(...args),
    },
  },
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}))

// QA fix: invalidate module-level caches between tests to prevent cross-test leakage
import { invalidateBFSCaches } from '../../services/contextWriter'

// Import the handler dispatch function.
// Signature: handleToolCall(provider, toolName, args) — provider FIRST.
// Verified at handlers.ts:17 and server.ts:48.
import { handleToolCall } from '../handlers'
import type { MCPSyncProvider } from '../provider'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeProvider(
  nodes: Array<{ id: string; data: Record<string, unknown>; position?: { x: number; y: number } }>,
  edges: Array<{ id: string; source: string; target: string; data?: Record<string, unknown> }>,
): MCPSyncProvider {
  return {
    getNodes: () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'default',
        position: n.position ?? { x: 0, y: 0 },
        data: n.data,
      })) as any,
    getEdges: () => edges as any,
    getNode: (id: string) => {
      const n = nodes.find((node) => node.id === id)
      if (!n) return null
      return {
        id: n.id,
        type: 'default',
        position: n.position ?? { x: 0, y: 0 },
        data: n.data,
      } as any
    },
    getEdge: () => null,
    getWorkspaceId: () => 'test-workspace',
    getWorkspaceName: () => 'Test Workspace',
    createNode: () => 'new-id',
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    createEdge: () => 'new-edge-id',
    deleteEdge: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
  } as MCPSyncProvider
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleGetInitialContext', () => {
  const originalEnv = process.env.COGNOGRAPH_NODE_ID

  beforeEach(() => {
    delete process.env.COGNOGRAPH_NODE_ID
    invalidateBFSCaches() // QA fix: prevent stale adjacency index from prior tests
    mockMkdir.mockClear()
    mockWriteFile.mockClear()
    mockReadFile.mockClear()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COGNOGRAPH_NODE_ID = originalEnv
    } else {
      delete process.env.COGNOGRAPH_NODE_ID
    }
  })

  it('returns connected node context from provider data', async () => {
    const provider = makeProvider(
      [
        { id: 'terminal-1', data: { type: 'conversation', title: 'My Terminal' } },
        {
          id: 'note-1',
          data: { type: 'note', title: 'Research Notes', content: 'Some research content' },
        },
      ],
      [{ id: 'edge-1', source: 'note-1', target: 'terminal-1' }],
    )

    const result = (await handleToolCall(provider, 'get_initial_context', {
      nodeId: 'terminal-1',
    })) as any

    expect(result.nodeId).toBe('terminal-1')
    expect(result.entryCount).toBe(1)
    expect(result.markdown).toContain('Research Notes')
    // Verify disk was NOT used (mockReadFile rejects, so if it were called, we'd get an error)
    expect(result.error).toBeUndefined()
  })

  it('returns empty context when node has no connections', async () => {
    const provider = makeProvider(
      [{ id: 'lonely-node', data: { type: 'conversation', title: 'Lonely' } }],
      [],
    )

    const result = (await handleToolCall(provider, 'get_initial_context', {
      nodeId: 'lonely-node',
    })) as any

    expect(result.nodeId).toBe('lonely-node')
    expect(result.entryCount).toBe(0)
    expect(result.markdown).toContain('No connected nodes')
  })

  it('falls back to COGNOGRAPH_NODE_ID env var when nodeId not provided', async () => {
    process.env.COGNOGRAPH_NODE_ID = 'env-node-id'

    const provider = makeProvider(
      [{ id: 'env-node-id', data: { type: 'conversation', title: 'Env Terminal' } }],
      [],
    )

    const result = (await handleToolCall(provider, 'get_initial_context', {})) as any

    expect(result.nodeId).toBe('env-node-id')
  })

  it('returns error when no nodeId available', async () => {
    const provider = makeProvider([], [])

    const result = (await handleToolCall(provider, 'get_initial_context', {})) as any

    expect(result.error).toBe('NO_NODE_ID')
  })

  it('includes multi-hop context (depth 2+)', async () => {
    // Note: MAX_BFS_DEPTH = 3 in contextWriter.ts:82 — this test assumes depth >= 2
    const provider = makeProvider(
      [
        { id: 'terminal', data: { type: 'conversation', title: 'Terminal' } },
        { id: 'note', data: { type: 'note', title: 'Direct Note', content: 'direct' } },
        { id: 'deep-note', data: { type: 'note', title: 'Deep Note', content: 'deeper' } },
      ],
      [
        { id: 'e1', source: 'note', target: 'terminal' },
        { id: 'e2', source: 'deep-note', target: 'note' },
      ],
    )

    const result = (await handleToolCall(provider, 'get_initial_context', {
      nodeId: 'terminal',
    })) as any

    expect(result.entryCount).toBe(2)
    expect(result.markdown).toContain('Direct Note')
    expect(result.markdown).toContain('Deep Note')
  })
})

describe('provider.reload() regression', () => {
  beforeEach(() => {
    invalidateBFSCaches()
    mockMkdir.mockClear()
    mockWriteFile.mockClear()
    mockReadFile.mockClear()
  })

  it('does not crash on provider.reload() (regression: FileSyncProvider fallback)', async () => {
    const provider = makeProvider(
      [{ id: 'term-1', data: { type: 'conversation', title: 'Terminal' } }],
      [],
    )
    const result = (await handleToolCall(provider, 'get_initial_context', {
      nodeId: 'term-1',
    })) as any

    expect(result.error).toBeUndefined()
    expect(provider.reload).toHaveBeenCalled()
  })

  it('does not crash on provider.reload() during add_comment', async () => {
    const provider = makeProvider(
      [{ id: 'node-1', data: { type: 'note', title: 'Note', content: '' } }],
      [],
    )
    const result = (await handleToolCall(provider, 'add_comment', {
      id: 'node-1',
      text: 'test comment',
    })) as any

    expect(result.success).toBe(true)
    expect(provider.reload).toHaveBeenCalled()
  })
})
