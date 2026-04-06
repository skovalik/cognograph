// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it, vi } from 'vitest'
import type { BuiltinToolDeps } from '../builtinTools'
import { createBuiltinTools } from '../builtinTools'
import type { Tool } from '../types'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

function mockDeps(overrides: Partial<BuiltinToolDeps> = {}): BuiltinToolDeps {
  return {
    executeInRenderer: vi.fn().mockResolvedValue({ ok: true }),
    getCurrentConversationId: vi.fn().mockReturnValue('conv-123'),
    readFile: vi
      .fn()
      .mockReturnValue({ success: true, result: { content: 'hello', totalLines: 1 } }),
    writeFile: vi.fn().mockReturnValue({ success: true, result: { path: '/a.ts', bytes: 5 } }),
    editFile: vi
      .fn()
      .mockReturnValue({ success: true, result: { path: '/a.ts', replacements: 1 } }),
    listDirectory: vi.fn().mockReturnValue({ success: true, result: { entries: [], count: 0 } }),
    searchFiles: vi
      .fn()
      .mockReturnValue({ success: true, result: { matches: [], totalMatches: 0 } }),
    executeCommand: vi
      .fn()
      .mockResolvedValue({ success: true, result: { stdout: '', exitCode: 0 } }),
    getSecurityContext: vi
      .fn()
      .mockReturnValue({ allowedPaths: ['/workspace'], allowedCommands: ['ls'] }),
    ...overrides,
  }
}

function findTool(tools: Tool[], name: string): Tool {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new Error(`Tool "${name}" not found in builtin tools`)
  return tool
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('createBuiltinTools', () => {
  it('returns an array of Tool objects', () => {
    const tools = createBuiltinTools(mockDeps())
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThan(0)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(typeof tool.call).toBe('function')
      expect(tool.inputSchema).toBeDefined()
    }
  })

  it('includes all expected canvas tools', () => {
    const tools = createBuiltinTools(mockDeps())
    const names = tools.map((t) => t.name)

    const expectedCanvas = [
      'create_node',
      'batch_create',
      'link_nodes',
      'update_node',
      'delete_node',
      'search_nodes',
      'get_initial_context',
      'get_context_chain',
      'get_selection',
      'get_node',
      'get_todos',
      'add_comment',
      'unlink_nodes',
      'move_node',
    ]

    for (const name of expectedCanvas) {
      expect(names).toContain(name)
    }
  })

  it('includes all filesystem and command tools', () => {
    const tools = createBuiltinTools(mockDeps())
    const names = tools.map((t) => t.name)

    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('edit_file')
    expect(names).toContain('list_directory')
    expect(names).toContain('search_files')
    expect(names).toContain('execute_command')
  })

  it('includes all memory tools', () => {
    const tools = createBuiltinTools(mockDeps())
    const names = tools.map((t) => t.name)

    expect(names).toContain('add_memory')
    expect(names).toContain('get_memory')
    expect(names).toContain('list_memories')
    expect(names).toContain('delete_memory')
  })

  it('all tools are frozen', () => {
    const tools = createBuiltinTools(mockDeps())
    for (const tool of tools) {
      expect(Object.isFrozen(tool)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Canvas tool delegation
// ---------------------------------------------------------------------------

describe('canvas tools — delegation', () => {
  it('create_node delegates to executeInRenderer', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'create_node')

    await tool.call({ type: 'note', title: 'Test' })

    expect(deps.executeInRenderer).toHaveBeenCalledWith(
      'create_node',
      { type: 'note', title: 'Test' },
      'conv-123',
    )
  })

  it('create_node rejects invalid input via Zod', async () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'create_node')

    await expect(tool.call({ type: 'invalid_type', title: 'X' })).rejects.toThrow()
  })

  it('search_nodes is read-only and concurrency-safe', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'search_nodes')

    expect(tool.isReadOnly).toBe(true)
    expect(tool.isConcurrencySafe).toBe(true)
  })

  it('update_node is NOT read-only', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'update_node')

    expect(tool.isReadOnly).toBe(false)
    expect(tool.isConcurrencySafe).toBe(false)
  })

  it('get_selection delegates with empty args', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'get_selection')

    await tool.call({})

    expect(deps.executeInRenderer).toHaveBeenCalledWith('get_selection', {}, 'conv-123')
  })

  it('batch_create delegates with nodes and edges', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'batch_create')

    const input = {
      nodes: [{ temp_id: 'a', type: 'note', title: 'A' }],
      edges: [{ source: 'a', target: 'b' }],
    }
    await tool.call(input)

    expect(deps.executeInRenderer).toHaveBeenCalledWith('batch_create', input, 'conv-123')
  })
})

// ---------------------------------------------------------------------------
// Filesystem tool delegation
// ---------------------------------------------------------------------------

describe('filesystem tools — delegation', () => {
  it('read_file delegates to deps.readFile', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'read_file')

    const result = await tool.call({ path: '/src/index.ts', startLine: 1, endLine: 10 })

    expect(deps.readFile).toHaveBeenCalledWith('/src/index.ts', ['/workspace'], 1, 10)
    expect(result.isError).toBeUndefined()
  })

  it('read_file is read-only and concurrency-safe', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'read_file')

    expect(tool.isReadOnly).toBe(true)
    expect(tool.isConcurrencySafe).toBe(true)
  })

  it('write_file delegates to deps.writeFile', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'write_file')

    await tool.call({ path: '/out.ts', content: 'hello' })

    expect(deps.writeFile).toHaveBeenCalledWith('/out.ts', 'hello', ['/workspace'])
  })

  it('write_file is NOT read-only', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'write_file')

    expect(tool.isReadOnly).toBe(false)
  })

  it('edit_file validates required fields', async () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'edit_file')

    await expect(tool.call({ path: '/f.ts' })).rejects.toThrow()
  })

  it('search_files passes fileGlob', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'search_files')

    await tool.call({ path: '/src', pattern: 'TODO', fileGlob: '*.ts' })

    expect(deps.searchFiles).toHaveBeenCalledWith('/src', 'TODO', ['/workspace'], '*.ts')
  })

  it('filesystem error propagates as isError result', async () => {
    const deps = mockDeps({
      readFile: vi.fn().mockReturnValue({ success: false, error: 'Permission denied' }),
    })
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'read_file')

    const result = await tool.call({ path: '/secret' })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.type).toBe('text')
    expect((result.content[0] as { text: string }).text).toContain('Permission denied')
  })
})

// ---------------------------------------------------------------------------
// Command tool
// ---------------------------------------------------------------------------

describe('execute_command', () => {
  it('delegates to deps.executeCommand', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'execute_command')

    await tool.call({ command: 'ls -la', cwd: '/tmp' })

    expect(deps.executeCommand).toHaveBeenCalledWith('ls -la', ['/workspace'], ['ls'], '/tmp')
  })

  it('has interruptBehavior: block', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'execute_command')

    expect(tool.interruptBehavior).toBe('block')
  })

  it('is NOT read-only', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'execute_command')

    expect(tool.isReadOnly).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Memory tools
// ---------------------------------------------------------------------------

describe('memory tools', () => {
  it('add_memory delegates to renderer', async () => {
    const deps = mockDeps()
    const tools = createBuiltinTools(deps)
    const tool = findTool(tools, 'add_memory')

    await tool.call({ key: 'project_root', value: '/src' })

    expect(deps.executeInRenderer).toHaveBeenCalledWith(
      'add_memory',
      { key: 'project_root', value: '/src' },
      'conv-123',
    )
  })

  it('get_memory is read-only', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'get_memory')

    expect(tool.isReadOnly).toBe(true)
    expect(tool.isConcurrencySafe).toBe(true)
  })

  it('delete_memory is NOT read-only', () => {
    const tools = createBuiltinTools(mockDeps())
    const tool = findTool(tools, 'delete_memory')

    expect(tool.isReadOnly).toBe(false)
  })
})
