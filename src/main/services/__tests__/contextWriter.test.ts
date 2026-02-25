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
})
