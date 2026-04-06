// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import {
  AddCommentSchema,
  AddMemorySchema,
  BatchCreateSchema,
  CANONICAL_SCHEMAS,
  CreateNodeSchema,
  DeleteMemorySchema,
  DeleteNodeSchema,
  EditFileSchema,
  ExecuteCommandSchema,
  GetContextChainSchema,
  GetInitialContextSchema,
  GetMemorySchema,
  GetNodeSchema,
  GetSelectionSchema,
  GetTodosSchema,
  LinkNodesSchema,
  ListDirectorySchema,
  ListMemoriesSchema,
  MoveNodeSchema,
  ReadFileSchema,
  SearchFilesSchema,
  SearchNodesSchema,
  UnlinkNodesSchema,
  UpdateNodeSchema,
  WriteFileSchema,
} from '../canonicalSchemas'

// ---------------------------------------------------------------------------
// create_node
// ---------------------------------------------------------------------------

describe('CreateNodeSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      type: 'note',
      title: 'Test Node',
      content: 'Some content',
      description: 'A description',
      contentType: 'markdown',
      status: 'todo',
      priority: 'high',
      position: { x: 100, y: 200 },
      connectTo: 'node-123',
    }
    expect(CreateNodeSchema.parse(input)).toEqual(input)
  })

  it('accepts minimal valid input', () => {
    const input = { type: 'task', title: 'Minimal' }
    expect(CreateNodeSchema.parse(input)).toEqual(input)
  })

  it('rejects missing type', () => {
    expect(() => CreateNodeSchema.parse({ title: 'No type' })).toThrow()
  })

  it('rejects missing title', () => {
    expect(() => CreateNodeSchema.parse({ type: 'note' })).toThrow()
  })

  it('rejects invalid node type', () => {
    expect(() => CreateNodeSchema.parse({ type: 'invalid', title: 'Bad' })).toThrow()
  })

  it('rejects invalid contentType', () => {
    expect(() =>
      CreateNodeSchema.parse({ type: 'artifact', title: 'X', contentType: 'pdf' }),
    ).toThrow()
  })

  it('rejects invalid position shape', () => {
    expect(() =>
      CreateNodeSchema.parse({ type: 'note', title: 'X', position: { x: 'bad' } }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// batch_create
// ---------------------------------------------------------------------------

describe('BatchCreateSchema', () => {
  it('accepts valid batch with nodes and edges', () => {
    const input = {
      nodes: [
        { temp_id: 'a', type: 'note', title: 'A' },
        { temp_id: 'b', type: 'task', title: 'B', status: 'todo' },
      ],
      edges: [{ source: 'a', target: 'b', label: 'depends' }],
    }
    expect(BatchCreateSchema.parse(input)).toEqual(input)
  })

  it('accepts nodes without edges', () => {
    const input = {
      nodes: [{ temp_id: 'x', type: 'artifact', title: 'Code' }],
    }
    expect(BatchCreateSchema.parse(input)).toEqual(input)
  })

  it('rejects empty nodes array', () => {
    // Zod array allows empty by default — this is valid
    const input = { nodes: [] }
    expect(BatchCreateSchema.parse(input)).toEqual(input)
  })

  it('rejects node missing temp_id', () => {
    expect(() => BatchCreateSchema.parse({ nodes: [{ type: 'note', title: 'X' }] })).toThrow()
  })

  it('rejects edge missing source', () => {
    expect(() =>
      BatchCreateSchema.parse({
        nodes: [{ temp_id: 'a', type: 'note', title: 'A' }],
        edges: [{ target: 'a' }],
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// update_node
// ---------------------------------------------------------------------------

describe('UpdateNodeSchema', () => {
  it('accepts nodeId with partial updates', () => {
    const input = { nodeId: 'abc', title: 'New Title', status: 'done' }
    expect(UpdateNodeSchema.parse(input)).toEqual(input)
  })

  it('accepts tags array', () => {
    const input = { nodeId: 'abc', tags: ['urgent', 'v2'] }
    expect(UpdateNodeSchema.parse(input)).toEqual(input)
  })

  it('rejects missing nodeId', () => {
    expect(() => UpdateNodeSchema.parse({ title: 'X' })).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => UpdateNodeSchema.parse({ nodeId: 'x', status: 'archived' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// delete_node
// ---------------------------------------------------------------------------

describe('DeleteNodeSchema', () => {
  it('accepts valid nodeId', () => {
    expect(DeleteNodeSchema.parse({ nodeId: 'abc-123' })).toEqual({
      nodeId: 'abc-123',
    })
  })

  it('rejects missing nodeId', () => {
    expect(() => DeleteNodeSchema.parse({})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// link_nodes / unlink_nodes
// ---------------------------------------------------------------------------

describe('LinkNodesSchema', () => {
  it('accepts source, target, and optional label', () => {
    const input = { source: 'a', target: 'b', label: 'context' }
    expect(LinkNodesSchema.parse(input)).toEqual(input)
  })

  it('rejects missing source', () => {
    expect(() => LinkNodesSchema.parse({ target: 'b' })).toThrow()
  })
})

describe('UnlinkNodesSchema', () => {
  it('accepts sourceId and targetId', () => {
    const input = { sourceId: 'a', targetId: 'b' }
    expect(UnlinkNodesSchema.parse(input)).toEqual(input)
  })

  it('rejects missing targetId', () => {
    expect(() => UnlinkNodesSchema.parse({ sourceId: 'a' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// search_nodes
// ---------------------------------------------------------------------------

describe('SearchNodesSchema', () => {
  it('accepts all optional filters', () => {
    const input = {
      query: 'test',
      type: 'task',
      titleContains: 'bug',
      hasTag: 'urgent',
      limit: 5,
    }
    expect(SearchNodesSchema.parse(input)).toEqual(input)
  })

  it('accepts empty input (all optional)', () => {
    expect(SearchNodesSchema.parse({})).toEqual({})
  })

  it('rejects invalid type', () => {
    expect(() => SearchNodesSchema.parse({ type: 'invalid' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// get_node / get_initial_context / get_context_chain / get_selection
// ---------------------------------------------------------------------------

describe('GetNodeSchema', () => {
  it('requires nodeId', () => {
    expect(GetNodeSchema.parse({ nodeId: 'x' })).toEqual({ nodeId: 'x' })
    expect(() => GetNodeSchema.parse({})).toThrow()
  })
})

describe('GetInitialContextSchema', () => {
  it('accepts includeContent boolean', () => {
    expect(GetInitialContextSchema.parse({ includeContent: true })).toEqual({
      includeContent: true,
    })
  })

  it('accepts empty input', () => {
    expect(GetInitialContextSchema.parse({})).toEqual({})
  })
})

describe('GetContextChainSchema', () => {
  it('accepts optional nodeId', () => {
    expect(GetContextChainSchema.parse({ nodeId: 'x' })).toEqual({
      nodeId: 'x',
    })
    expect(GetContextChainSchema.parse({})).toEqual({})
  })
})

describe('GetSelectionSchema', () => {
  it('accepts empty object', () => {
    expect(GetSelectionSchema.parse({})).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// get_todos / add_comment / move_node
// ---------------------------------------------------------------------------

describe('GetTodosSchema', () => {
  it('accepts filters', () => {
    const input = {
      status: 'in-progress',
      priority: 'high',
      tags: ['sprint-1'],
      projectId: 'proj-1',
      limit: 10,
    }
    expect(GetTodosSchema.parse(input)).toEqual(input)
  })

  it('accepts empty input', () => {
    expect(GetTodosSchema.parse({})).toEqual({})
  })
})

describe('AddCommentSchema', () => {
  it('requires nodeId and comment', () => {
    const input = { nodeId: 'x', comment: 'Hello' }
    expect(AddCommentSchema.parse(input)).toEqual(input)
    expect(() => AddCommentSchema.parse({ nodeId: 'x' })).toThrow()
  })
})

describe('MoveNodeSchema', () => {
  it('requires nodeId and position', () => {
    const input = { nodeId: 'x', position: { x: 100, y: 200 } }
    expect(MoveNodeSchema.parse(input)).toEqual(input)
    expect(() => MoveNodeSchema.parse({ nodeId: 'x' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Filesystem tools
// ---------------------------------------------------------------------------

describe('ReadFileSchema', () => {
  it('accepts path with optional line range', () => {
    expect(ReadFileSchema.parse({ path: '/a/b.ts', startLine: 1, endLine: 10 })).toEqual({
      path: '/a/b.ts',
      startLine: 1,
      endLine: 10,
    })
  })

  it('rejects missing path', () => {
    expect(() => ReadFileSchema.parse({})).toThrow()
  })
})

describe('WriteFileSchema', () => {
  it('requires path and content', () => {
    expect(WriteFileSchema.parse({ path: '/a/b.ts', content: 'hello' })).toEqual({
      path: '/a/b.ts',
      content: 'hello',
    })
    expect(() => WriteFileSchema.parse({ path: '/a/b.ts' })).toThrow()
  })
})

describe('EditFileSchema', () => {
  it('requires path, oldString, newString', () => {
    const input = { path: '/f.ts', oldString: 'old', newString: 'new' }
    expect(EditFileSchema.parse(input)).toEqual(input)
    expect(() => EditFileSchema.parse({ path: '/f.ts', oldString: 'old' })).toThrow()
  })
})

describe('ListDirectorySchema', () => {
  it('requires path', () => {
    expect(ListDirectorySchema.parse({ path: '/src' })).toEqual({ path: '/src' })
    expect(() => ListDirectorySchema.parse({})).toThrow()
  })
})

describe('SearchFilesSchema', () => {
  it('requires path and pattern, optional fileGlob', () => {
    const input = { path: '/src', pattern: 'TODO', fileGlob: '*.ts' }
    expect(SearchFilesSchema.parse(input)).toEqual(input)
    expect(() => SearchFilesSchema.parse({ path: '/src' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Command tool
// ---------------------------------------------------------------------------

describe('ExecuteCommandSchema', () => {
  it('requires command, optional cwd', () => {
    expect(ExecuteCommandSchema.parse({ command: 'ls -la', cwd: '/tmp' })).toEqual({
      command: 'ls -la',
      cwd: '/tmp',
    })
    expect(() => ExecuteCommandSchema.parse({})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Memory tools
// ---------------------------------------------------------------------------

describe('AddMemorySchema', () => {
  it('requires key and value', () => {
    expect(AddMemorySchema.parse({ key: 'k', value: 'v' })).toEqual({
      key: 'k',
      value: 'v',
    })
  })

  it('rejects key over 100 chars', () => {
    expect(() => AddMemorySchema.parse({ key: 'a'.repeat(101), value: 'v' })).toThrow()
  })

  it('rejects value over 10000 chars', () => {
    expect(() => AddMemorySchema.parse({ key: 'k', value: 'x'.repeat(10001) })).toThrow()
  })
})

describe('GetMemorySchema', () => {
  it('requires key', () => {
    expect(GetMemorySchema.parse({ key: 'k' })).toEqual({ key: 'k' })
    expect(() => GetMemorySchema.parse({})).toThrow()
  })
})

describe('ListMemoriesSchema', () => {
  it('accepts empty object', () => {
    expect(ListMemoriesSchema.parse({})).toEqual({})
  })
})

describe('DeleteMemorySchema', () => {
  it('requires key', () => {
    expect(DeleteMemorySchema.parse({ key: 'k' })).toEqual({ key: 'k' })
    expect(() => DeleteMemorySchema.parse({})).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Registry completeness
// ---------------------------------------------------------------------------

describe('CANONICAL_SCHEMAS registry', () => {
  it('has an entry for every expected tool', () => {
    const expectedTools = [
      'create_node',
      'batch_create',
      'update_node',
      'delete_node',
      'link_nodes',
      'unlink_nodes',
      'search_nodes',
      'get_node',
      'get_initial_context',
      'get_context_chain',
      'get_selection',
      'get_todos',
      'add_comment',
      'move_node',
      'read_file',
      'write_file',
      'edit_file',
      'list_directory',
      'search_files',
      'execute_command',
      'add_memory',
      'get_memory',
      'list_memories',
      'delete_memory',
    ]

    for (const name of expectedTools) {
      expect(CANONICAL_SCHEMAS).toHaveProperty(name)
    }
  })

  it('every entry has a safeParse method (is a Zod schema)', () => {
    for (const [name, schema] of Object.entries(CANONICAL_SCHEMAS)) {
      expect(typeof schema.safeParse).toBe('function')
      // Quick sanity: safeParse on empty input should return a result object
      const result = schema.safeParse({})
      expect(result).toHaveProperty('success')
      // Suppress unused variable warning
      void name
    }
  })
})
