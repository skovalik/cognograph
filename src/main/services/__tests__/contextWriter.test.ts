// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock electron before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData')
  }
}))

// Mock fs — must be a complete mock (no importOriginal in jsdom env)
const mockMkdir = vi.fn().mockResolvedValue(undefined)
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockReadFile = vi.fn().mockRejectedValue(new Error('not mocked'))

vi.mock('fs', () => ({
  default: {
    promises: {
      mkdir: (...args: unknown[]) => mockMkdir(...args),
      writeFile: (...args: unknown[]) => mockWriteFile(...args),
      readFile: (...args: unknown[]) => mockReadFile(...args),
    }
  },
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  }
}))

// Import after mocking
import {
  bfsTraverse,
  generateMarkdown,
  estimateTokens,
  buildContextForNode,
  writeContextFile,
  getContextFilePath,
  fnv1aHash,
  AdjacencyIndex,
  IncrementalXORHash,
  BFSCache,
  invalidateBFSCaches,
  getAdjacencyIndex,
  getXORHash,
  getBFSCache,
} from '../contextWriter'
import type { ContextEntry, GeneratedContext } from '../contextWriter'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string, data: Record<string, unknown> = {}) {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { type, ...data }
  }
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  data?: Record<string, unknown>
) {
  return { id, source, target, data }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contextWriter', () => {
  beforeEach(() => {
    mockMkdir.mockClear()
    mockWriteFile.mockClear()
    mockReadFile.mockClear()
    // Reset module-level caches between tests
    invalidateBFSCaches()
  })

  // -------------------------------------------------------------------------
  // BFS Traversal
  // -------------------------------------------------------------------------

  describe('bfsTraverse', () => {
    it('produces correct entries for a simple 3-node graph', () => {
      // Graph: A -> B -> C (inbound edges, C is the target)
      // From C's perspective: B is inbound at depth 1, A is inbound at depth 2
      const nodes = [
        makeNode('A', 'note', { title: 'Node A', content: 'Content of A' }),
        makeNode('B', 'task', { title: 'Node B', description: 'Description of B' }),
        makeNode('C', 'conversation', { title: 'Node C' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B', { active: true }),
        makeEdge('e2', 'B', 'C', { active: true, contextRole: 'reference' }),
      ]

      const entries = bfsTraverse('C', nodes, edges)

      expect(entries).toHaveLength(2)

      // B should be at depth 1
      const entryB = entries.find(e => e.nodeId === 'B')
      expect(entryB).toBeDefined()
      expect(entryB!.depth).toBe(1)
      expect(entryB!.nodeType).toBe('task')
      expect(entryB!.title).toBe('Node B')
      expect(entryB!.edgeRole).toBe('reference')

      // A should be at depth 2
      const entryA = entries.find(e => e.nodeId === 'A')
      expect(entryA).toBeDefined()
      expect(entryA!.depth).toBe(2)
      expect(entryA!.nodeType).toBe('note')
      expect(entryA!.title).toBe('Node A')
    })

    it('limits traversal to depth 3 by default', () => {
      // Chain: A -> B -> C -> D -> E (E is root)
      // From E: D=1, C=2, B=3, A should be excluded (depth 4)
      const nodes = [
        makeNode('A', 'note', { title: 'A' }),
        makeNode('B', 'note', { title: 'B' }),
        makeNode('C', 'note', { title: 'C' }),
        makeNode('D', 'note', { title: 'D' }),
        makeNode('E', 'note', { title: 'E' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'B', 'C'),
        makeEdge('e3', 'C', 'D'),
        makeEdge('e4', 'D', 'E'),
      ]

      const entries = bfsTraverse('E', nodes, edges)

      expect(entries).toHaveLength(3) // D, C, B
      expect(entries.map(e => e.nodeId)).toContain('D')
      expect(entries.map(e => e.nodeId)).toContain('C')
      expect(entries.map(e => e.nodeId)).toContain('B')
      expect(entries.map(e => e.nodeId)).not.toContain('A')
    })

    it('respects custom max depth', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'A' }),
        makeNode('B', 'note', { title: 'B' }),
        makeNode('C', 'note', { title: 'C' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'B', 'C'),
      ]

      const entries = bfsTraverse('C', nodes, edges, 1)

      expect(entries).toHaveLength(1) // Only B at depth 1
      expect(entries[0]!.nodeId).toBe('B')
    })

    it('follows bidirectional edges', () => {
      // A -- B (bidirectional edge, source=A, target=B)
      // From A's perspective, B is reachable via the outgoing bidirectional edge
      const nodes = [
        makeNode('A', 'note', { title: 'Node A' }),
        makeNode('B', 'note', { title: 'Node B', content: 'B content' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B', { bidirectional: true }),
      ]

      const entries = bfsTraverse('A', nodes, edges)

      expect(entries).toHaveLength(1)
      expect(entries[0]!.nodeId).toBe('B')
      expect(entries[0]!.depth).toBe(1)
    })

    it('follows bidirectional edges with direction=bidirectional', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'Node A' }),
        makeNode('B', 'note', { title: 'Node B' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B', { direction: 'bidirectional' }),
      ]

      const entries = bfsTraverse('A', nodes, edges)

      expect(entries).toHaveLength(1)
      expect(entries[0]!.nodeId).toBe('B')
    })

    it('skips inactive edges', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'A' }),
        makeNode('B', 'note', { title: 'B' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B', { active: false }),
      ]

      const entries = bfsTraverse('B', nodes, edges)

      expect(entries).toHaveLength(0)
    })

    it('handles isolated node (no edges)', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'Lonely Node' }),
      ]

      const entries = bfsTraverse('A', nodes, [])

      expect(entries).toHaveLength(0)
    })

    it('handles cycles without infinite loop', () => {
      // A -> B -> C -> A (cycle)
      const nodes = [
        makeNode('A', 'note', { title: 'A' }),
        makeNode('B', 'note', { title: 'B' }),
        makeNode('C', 'note', { title: 'C' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'B', 'C'),
        makeEdge('e3', 'C', 'A'),
      ]

      const entries = bfsTraverse('A', nodes, edges)

      // Should visit C (depth 1, inbound to A) and B (depth 2, inbound to C)
      // Should NOT revisit A
      expect(entries.length).toBeLessThanOrEqual(2)
      const ids = entries.map(e => e.nodeId)
      expect(ids).not.toContain('A') // Never includes the start node
    })

    it('extracts content from different node types', () => {
      const nodes = [
        makeNode('root', 'note', { title: 'Root' }),
        makeNode('task-node', 'task', { title: 'My Task', description: 'Task description here' }),
        makeNode('note-node', 'note', { title: 'My Note', content: 'Note content here' }),
      ]

      const edges = [
        makeEdge('e1', 'task-node', 'root'),
        makeEdge('e2', 'note-node', 'root'),
      ]

      const entries = bfsTraverse('root', nodes, edges)

      const taskEntry = entries.find(e => e.nodeId === 'task-node')
      expect(taskEntry!.content).toBe('Task description here')

      const noteEntry = entries.find(e => e.nodeId === 'note-node')
      expect(noteEntry!.content).toBe('Note content here')
    })

    it('uses default edge role when contextRole not set', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'A' }),
        makeNode('B', 'note', { title: 'B' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B'), // No data at all
      ]

      const entries = bfsTraverse('B', nodes, edges)

      expect(entries[0]!.edgeRole).toBe('provides-context')
    })

    it('stops traversal when maxTokens budget is exceeded', () => {
      // 3 nodes with known content lengths, each ~25 tokens (100 chars / 4)
      const content100 = 'a'.repeat(100) // 25 tokens each
      const nodes = [
        makeNode('root', 'note', { title: 'Root' }),
        makeNode('A', 'note', { title: 'A', content: content100 }),
        makeNode('B', 'note', { title: 'B', content: content100 }),
        makeNode('C', 'note', { title: 'C', content: content100 }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'root'),
        makeEdge('e2', 'B', 'root'),
        makeEdge('e3', 'C', 'root'),
      ]

      // Budget of 50 tokens should allow ~2 entries (25 tokens each)
      const entries = bfsTraverse('root', nodes, edges, 3, 50)

      expect(entries.length).toBe(2)
    })

    it('includes all entries when maxTokens is undefined (default behavior)', () => {
      const content100 = 'a'.repeat(100) // 25 tokens each
      const nodes = [
        makeNode('root', 'note', { title: 'Root' }),
        makeNode('A', 'note', { title: 'A', content: content100 }),
        makeNode('B', 'note', { title: 'B', content: content100 }),
        makeNode('C', 'note', { title: 'C', content: content100 }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'root'),
        makeEdge('e2', 'B', 'root'),
        makeEdge('e3', 'C', 'root'),
      ]

      // No budget — should include all 3
      const entries = bfsTraverse('root', nodes, edges)

      expect(entries.length).toBe(3)
    })

    it('returns empty when maxTokens is 0', () => {
      const nodes = [
        makeNode('root', 'note', { title: 'Root' }),
        makeNode('A', 'note', { title: 'A', content: 'Some content here' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'root'),
      ]

      const entries = bfsTraverse('root', nodes, edges, 3, 0)

      expect(entries.length).toBe(0)
    })

    it('respects budget across multiple BFS depths', () => {
      // Chain: A -> B -> C -> root
      // Each node ~25 tokens. Budget 30 should allow only 1 entry.
      const content100 = 'a'.repeat(100)
      const nodes = [
        makeNode('root', 'note', { title: 'Root' }),
        makeNode('C', 'note', { title: 'C', content: content100 }),
        makeNode('B', 'note', { title: 'B', content: content100 }),
        makeNode('A', 'note', { title: 'A', content: content100 }),
      ]

      const edges = [
        makeEdge('e1', 'C', 'root'),
        makeEdge('e2', 'B', 'C'),
        makeEdge('e3', 'A', 'B'),
      ]

      const entries = bfsTraverse('root', nodes, edges, 3, 30)

      // Only C at depth 1 fits (25 tokens), B at depth 2 would exceed 30
      expect(entries.length).toBe(1)
      expect(entries[0]!.nodeId).toBe('C')
    })
  })

  // -------------------------------------------------------------------------
  // Markdown Generation
  // -------------------------------------------------------------------------

  describe('generateMarkdown', () => {
    it('generates markdown with all entries', () => {
      const entries: ContextEntry[] = [
        {
          nodeId: 'n1',
          nodeType: 'note',
          title: 'My Note',
          content: 'Some content',
          edgeRole: 'reference',
          depth: 1,
          tokenEstimate: 3
        },
        {
          nodeId: 'n2',
          nodeType: 'task',
          title: 'My Task',
          content: 'Task desc',
          edgeRole: 'provides-context',
          depth: 2,
          tokenEstimate: 3
        }
      ]

      const md = generateMarkdown('Root Node', entries)

      expect(md).toContain('# Canvas Context for: Root Node')
      expect(md).toContain('## Connected Nodes (2)')
      expect(md).toContain('### [note] My Note (depth: 1, role: reference)')
      expect(md).toContain('Some content')
      expect(md).toContain('### [task] My Task (depth: 2, role: provides-context)')
      expect(md).toContain('Task desc')
    })

    it('generates valid output for empty entries', () => {
      const md = generateMarkdown('Isolated Node', [])

      expect(md).toContain('# Canvas Context for: Isolated Node')
      expect(md).toContain('## Connected Nodes (0)')
      expect(md).toContain('_No connected nodes found._')
    })
  })

  // -------------------------------------------------------------------------
  // Token Estimation
  // -------------------------------------------------------------------------

  describe('estimateTokens', () => {
    it('estimates roughly 4 chars per token', () => {
      expect(estimateTokens('abcd')).toBe(1)        // 4 chars = 1 token
      expect(estimateTokens('abcde')).toBe(2)        // 5 chars = ceil(1.25) = 2 tokens
      expect(estimateTokens('a'.repeat(100))).toBe(25)
    })

    it('handles empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('provides reasonable estimates for typical text', () => {
      const paragraph = 'The quick brown fox jumps over the lazy dog. This is a test sentence with some content.'
      const tokens = estimateTokens(paragraph)
      // ~88 chars / 4 = ~22 tokens. Reasonable range: 15-30
      expect(tokens).toBeGreaterThan(15)
      expect(tokens).toBeLessThan(30)
    })
  })

  // -------------------------------------------------------------------------
  // buildContextForNode
  // -------------------------------------------------------------------------

  describe('buildContextForNode', () => {
    it('returns valid empty context when workspace is null', async () => {
      const result = await buildContextForNode('some-node', null)

      expect(result.entries).toHaveLength(0)
      expect(result.markdown).toContain('Unknown Node')
      expect(result.markdown).toContain('_No connected nodes found._')
      expect(result.totalTokens).toBe(0)
      expect(result.filePath).toContain('context-some-node.md')
    })

    it('builds context from a provided workspace snapshot', async () => {
      const workspace = {
        nodes: [
          makeNode('root', 'note', { title: 'Root Node', content: 'Root content' }),
          makeNode('ctx1', 'note', { title: 'Context 1', content: 'Context content' }),
        ],
        edges: [
          makeEdge('e1', 'ctx1', 'root', { active: true }),
        ]
      }

      const result = await buildContextForNode('root', workspace)

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]!.nodeId).toBe('ctx1')
      expect(result.entries[0]!.title).toBe('Context 1')
      expect(result.markdown).toContain('# Canvas Context for: Root Node')
      expect(result.markdown).toContain('Context content')
      expect(result.totalTokens).toBeGreaterThan(0)
    })

    it('handles node not found in workspace', async () => {
      const workspace = {
        nodes: [makeNode('other', 'note', { title: 'Other' })],
        edges: []
      }

      const result = await buildContextForNode('nonexistent', workspace)

      expect(result.entries).toHaveLength(0)
      expect(result.markdown).toContain('Unknown Node')
    })

    it('respects maxTokens option to limit BFS traversal', async () => {
      const content100 = 'a'.repeat(100) // 25 tokens each
      const workspace = {
        nodes: [
          makeNode('root', 'note', { title: 'Root Node' }),
          makeNode('ctx1', 'note', { title: 'Context 1', content: content100 }),
          makeNode('ctx2', 'note', { title: 'Context 2', content: content100 }),
          makeNode('ctx3', 'note', { title: 'Context 3', content: content100 }),
        ],
        edges: [
          makeEdge('e1', 'ctx1', 'root'),
          makeEdge('e2', 'ctx2', 'root'),
          makeEdge('e3', 'ctx3', 'root'),
        ]
      }

      const result = await buildContextForNode('root', workspace, { maxTokens: 50 })

      // Budget of 50 should fit ~2 entries at 25 tokens each
      expect(result.entries.length).toBe(2)
      expect(result.totalTokens).toBeLessThanOrEqual(50)
    })
  })

  // -------------------------------------------------------------------------
  // writeContextFile
  // -------------------------------------------------------------------------

  describe('writeContextFile', () => {
    it('creates directory and writes file', async () => {
      const context: GeneratedContext = {
        entries: [],
        markdown: '# Test Markdown',
        filePath: '/mock/userData/.cognograph-activity/context-test.md',
        totalTokens: 0
      }

      const result = await writeContextFile(context)

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.cognograph-activity'),
        { recursive: true }
      )
      expect(mockWriteFile).toHaveBeenCalledWith(
        context.filePath,
        '# Test Markdown',
        'utf-8'
      )
      expect(result).toBe(context.filePath)
    })
  })

  // -------------------------------------------------------------------------
  // getContextFilePath
  // -------------------------------------------------------------------------

  describe('getContextFilePath', () => {
    it('returns path under .cognograph-activity', () => {
      const path = getContextFilePath('my-node-123')
      expect(path).toContain('.cognograph-activity')
      expect(path).toContain('context-my-node-123.md')
    })

    it('sanitizes special characters in nodeId', () => {
      const path = getContextFilePath('../../../etc/passwd')
      expect(path).not.toContain('..')
      expect(path).toContain('context-')
      expect(path).toContain('.md')
    })
  })

  // -------------------------------------------------------------------------
  // fnv1aHash
  // -------------------------------------------------------------------------

  describe('fnv1aHash', () => {
    it('returns a consistent hash for the same input', () => {
      const h1 = fnv1aHash('hello world')
      const h2 = fnv1aHash('hello world')
      expect(h1).toBe(h2)
    })

    it('returns different hashes for different inputs', () => {
      const h1 = fnv1aHash('hello')
      const h2 = fnv1aHash('world')
      expect(h1).not.toBe(h2)
    })

    it('returns an unsigned 32-bit integer', () => {
      const h = fnv1aHash('test string')
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xFFFFFFFF)
    })

    it('handles empty string', () => {
      const h = fnv1aHash('')
      expect(h).toBeGreaterThanOrEqual(0)
    })
  })

  // -------------------------------------------------------------------------
  // AdjacencyIndex
  // -------------------------------------------------------------------------

  describe('AdjacencyIndex', () => {
    it('produces correct inbound neighbors', () => {
      const idx = new AdjacencyIndex()
      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'C', 'B'),
        makeEdge('e3', 'A', 'D'),
      ]

      idx.build(edges)

      const inbound = idx.getInbound('B')
      expect(inbound).toHaveLength(2)
      expect(inbound.map(e => e.source).sort()).toEqual(['A', 'C'])
    })

    it('produces correct outbound neighbors', () => {
      const idx = new AdjacencyIndex()
      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'A', 'C'),
        makeEdge('e3', 'B', 'D'),
      ]

      idx.build(edges)

      const outbound = idx.getOutbound('A')
      expect(outbound).toHaveLength(2)
      expect(outbound.map(e => e.target).sort()).toEqual(['B', 'C'])
    })

    it('returns empty arrays for unknown nodes', () => {
      const idx = new AdjacencyIndex()
      idx.build([makeEdge('e1', 'A', 'B')])

      expect(idx.getInbound('Z')).toEqual([])
      expect(idx.getOutbound('Z')).toEqual([])
    })

    it('returns all neighbor IDs via getNeighborIds', () => {
      const idx = new AdjacencyIndex()
      const edges = [
        makeEdge('e1', 'X', 'A'),   // X is inbound to A
        makeEdge('e2', 'A', 'Y'),   // Y is outbound from A
        makeEdge('e3', 'A', 'Z'),   // Z is outbound from A
      ]

      idx.build(edges)

      const neighbors = idx.getNeighborIds('A').sort()
      expect(neighbors).toEqual(['X', 'Y', 'Z'])
    })

    it('invalidates and reports isValid correctly', () => {
      const idx = new AdjacencyIndex()
      expect(idx.isValid).toBe(false)

      idx.build([makeEdge('e1', 'A', 'B')])
      expect(idx.isValid).toBe(true)

      idx.invalidate()
      expect(idx.isValid).toBe(false)
      expect(idx.getInbound('B')).toEqual([])
    })

    it('bfsTraverse produces same results with adjacency index', () => {
      const nodes = [
        makeNode('A', 'note', { title: 'Node A', content: 'Content of A' }),
        makeNode('B', 'task', { title: 'Node B', description: 'Description of B' }),
        makeNode('C', 'conversation', { title: 'Node C' }),
      ]

      const edges = [
        makeEdge('e1', 'A', 'B', { active: true }),
        makeEdge('e2', 'B', 'C', { active: true, contextRole: 'reference' }),
      ]

      // Without index
      const withoutIdx = bfsTraverse('C', nodes, edges)

      // With index
      const idx = new AdjacencyIndex()
      idx.build(edges)
      const withIdx = bfsTraverse('C', nodes, edges, 3, undefined, idx)

      expect(withIdx).toHaveLength(withoutIdx.length)
      expect(withIdx.map(e => e.nodeId).sort()).toEqual(withoutIdx.map(e => e.nodeId).sort())
    })
  })

  // -------------------------------------------------------------------------
  // IncrementalXORHash
  // -------------------------------------------------------------------------

  describe('IncrementalXORHash', () => {
    it('builds a hash from nodes', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([
        { id: 'A', content: 'hello' },
        { id: 'B', content: 'world' },
      ])

      expect(xor.value).toBeGreaterThanOrEqual(0)
      expect(xor.getNodeHash('A')).toBe(fnv1aHash('hello'))
      expect(xor.getNodeHash('B')).toBe(fnv1aHash('world'))
    })

    it('updates correctly on single node change via XOR', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([
        { id: 'A', content: 'hello' },
        { id: 'B', content: 'world' },
      ])

      const hashBefore = xor.value

      // Update node A's content
      xor.updateNode('A', 'goodbye')

      const hashAfter = xor.value

      // Hash should change
      expect(hashAfter).not.toBe(hashBefore)

      // Verify equivalence: build from scratch with updated content
      const xor2 = new IncrementalXORHash()
      xor2.buildFromNodes([
        { id: 'A', content: 'goodbye' },
        { id: 'B', content: 'world' },
      ])

      expect(hashAfter).toBe(xor2.value)
    })

    it('XOR update is equivalent to full rebuild', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([
        { id: 'A', content: 'aaa' },
        { id: 'B', content: 'bbb' },
        { id: 'C', content: 'ccc' },
      ])

      // Change B via incremental update
      xor.updateNode('B', 'BBB')

      // Build fresh with same final state
      const fresh = new IncrementalXORHash()
      fresh.buildFromNodes([
        { id: 'A', content: 'aaa' },
        { id: 'B', content: 'BBB' },
        { id: 'C', content: 'ccc' },
      ])

      expect(xor.value).toBe(fresh.value)
    })

    it('removeNode XORs out the old hash', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([
        { id: 'A', content: 'hello' },
        { id: 'B', content: 'world' },
      ])

      // Remove B — should equal hash of just A
      xor.removeNode('B')

      const single = new IncrementalXORHash()
      single.buildFromNodes([{ id: 'A', content: 'hello' }])

      expect(xor.value).toBe(single.value)
    })

    it('clear resets all state', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([{ id: 'A', content: 'hello' }])

      xor.clear()
      expect(xor.value).toBe(0)
      expect(xor.getNodeHash('A')).toBeUndefined()
    })

    it('adding a new node via updateNode works correctly', () => {
      const xor = new IncrementalXORHash()
      xor.buildFromNodes([{ id: 'A', content: 'hello' }])

      // Add a new node that wasn't in the original build
      xor.updateNode('B', 'world')

      // Should equal building both from scratch
      const fresh = new IncrementalXORHash()
      fresh.buildFromNodes([
        { id: 'A', content: 'hello' },
        { id: 'B', content: 'world' },
      ])

      expect(xor.value).toBe(fresh.value)
    })
  })

  // -------------------------------------------------------------------------
  // BFSCache
  // -------------------------------------------------------------------------

  describe('BFSCache', () => {
    it('returns null on cache miss', () => {
      const cache = new BFSCache()
      expect(cache.get('nonexistent-key')).toBeNull()
    })

    it('stores and retrieves cached BFS results', () => {
      const cache = new BFSCache()
      const entries: ContextEntry[] = [
        {
          nodeId: 'n1',
          nodeType: 'note',
          title: 'Test',
          content: 'content',
          edgeRole: 'provides-context',
          depth: 1,
          tokenEstimate: 5,
        },
      ]

      cache.set('test-key', entries)
      expect(cache.get('test-key')).toEqual(entries)
    })

    it('invalidate clears all entries', () => {
      const cache = new BFSCache()
      cache.set('key1', [])
      cache.set('key2', [])

      cache.invalidate()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
      expect(cache.size).toBe(0)
    })

    it('computeTopologyHash is deterministic', () => {
      const edges = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'B', 'C'),
      ]

      const h1 = BFSCache.computeTopologyHash(edges)
      const h2 = BFSCache.computeTopologyHash(edges)
      expect(h1).toBe(h2)
    })

    it('computeTopologyHash changes when edges change', () => {
      const edges1 = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e2', 'B', 'C'),
      ]
      const edges2 = [
        makeEdge('e1', 'A', 'B'),
        makeEdge('e3', 'D', 'C'), // different edge
      ]

      expect(BFSCache.computeTopologyHash(edges1))
        .not.toBe(BFSCache.computeTopologyHash(edges2))
    })

    it('evicts oldest entry when max capacity reached', () => {
      const cache = new BFSCache(2) // max 2 entries
      cache.set('key1', [])
      cache.set('key2', [])
      cache.set('key3', []) // should evict key1

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).not.toBeNull()
      expect(cache.get('key3')).not.toBeNull()
    })

    it('cache hit on unchanged graph + content', async () => {
      const workspace = {
        nodes: [
          makeNode('root', 'note', { title: 'Root', content: 'Root content' }),
          makeNode('ctx1', 'note', { title: 'Ctx1', content: 'Context 1' }),
        ],
        edges: [
          makeEdge('e1', 'ctx1', 'root'),
        ],
      }

      // First call — cache miss, populates cache
      const result1 = await buildContextForNode('root', workspace)

      // Second call — same workspace, should be cache hit
      const result2 = await buildContextForNode('root', workspace)

      expect(result1.entries).toEqual(result2.entries)
      expect(result1.markdown).toBe(result2.markdown)
      expect(result1.totalTokens).toBe(result2.totalTokens)
    })

    it('cache invalidation on message send to connected node', async () => {
      const workspace1 = {
        nodes: [
          makeNode('root', 'note', { title: 'Root', content: 'Root content' }),
          makeNode('conv', 'conversation', {
            title: 'Chat',
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        ],
        edges: [makeEdge('e1', 'conv', 'root')],
      }

      // First call — populates cache
      const result1 = await buildContextForNode('root', workspace1)

      // Simulate message change — invalidate caches
      invalidateBFSCaches()

      const workspace2 = {
        nodes: [
          makeNode('root', 'note', { title: 'Root', content: 'Root content' }),
          makeNode('conv', 'conversation', {
            title: 'Chat',
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there!' },
            ],
          }),
        ],
        edges: [makeEdge('e1', 'conv', 'root')],
      }

      const result2 = await buildContextForNode('root', workspace2)

      // Content changed, so BFS result should differ
      expect(result2.entries[0]!.content).toContain('Hi there!')
      expect(result1.entries[0]!.content).not.toContain('Hi there!')
    })

    it('cache invalidation on edge add/remove', async () => {
      const workspace1 = {
        nodes: [
          makeNode('root', 'note', { title: 'Root', content: 'Root content' }),
          makeNode('ctx1', 'note', { title: 'Ctx1', content: 'Context 1' }),
          makeNode('ctx2', 'note', { title: 'Ctx2', content: 'Context 2' }),
        ],
        edges: [makeEdge('e1', 'ctx1', 'root')],
      }

      const result1 = await buildContextForNode('root', workspace1)
      expect(result1.entries).toHaveLength(1)

      // Add an edge — invalidate caches
      invalidateBFSCaches()

      const workspace2 = {
        nodes: [...workspace1.nodes],
        edges: [
          makeEdge('e1', 'ctx1', 'root'),
          makeEdge('e2', 'ctx2', 'root'), // new edge
        ],
      }

      const result2 = await buildContextForNode('root', workspace2)
      expect(result2.entries).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // Module-level cache integration
  // -------------------------------------------------------------------------

  describe('module-level caches', () => {
    it('invalidateBFSCaches resets all three caches', () => {
      const idx = getAdjacencyIndex()
      const xor = getXORHash()
      const cache = getBFSCache()

      // Populate
      idx.build([makeEdge('e1', 'A', 'B')])
      xor.buildFromNodes([{ id: 'A', content: 'hello' }])
      cache.set('test-key', [])

      expect(idx.isValid).toBe(true)
      expect(xor.value).not.toBe(0)
      expect(cache.size).toBe(1)

      invalidateBFSCaches()

      expect(idx.isValid).toBe(false)
      expect(xor.value).toBe(0)
      expect(cache.size).toBe(0)
    })

    it('useCache: false bypasses BFS cache', async () => {
      const workspace = {
        nodes: [
          makeNode('root', 'note', { title: 'Root', content: 'Root' }),
          makeNode('A', 'note', { title: 'A', content: 'A content' }),
        ],
        edges: [makeEdge('e1', 'A', 'root')],
      }

      // Call with cache enabled
      await buildContextForNode('root', workspace, { useCache: true })
      expect(getBFSCache().size).toBe(1)

      // Reset cache
      invalidateBFSCaches()

      // Call with cache disabled — should NOT populate cache
      await buildContextForNode('root', workspace, { useCache: false })
      expect(getBFSCache().size).toBe(0)
    })
  })
})
