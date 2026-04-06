// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it, vi } from 'vitest'
import type { MCPToolDefinition, MCPToolExecutor } from '../mcpToolAdapter'
import { adaptMCPTool, adaptMCPTools } from '../mcpToolAdapter'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMCPTool(overrides: Partial<MCPToolDefinition> = {}): MCPToolDefinition {
  return {
    name: 'search_docs',
    description: 'Search documentation',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    serverId: 'docs-server',
    serverName: 'Documentation Server',
    ...overrides,
  }
}

function mockExecutor(): MCPToolExecutor {
  return vi.fn().mockResolvedValue({
    success: true,
    result: { matches: ['a', 'b'] },
  })
}

// ---------------------------------------------------------------------------
// adaptMCPTool
// ---------------------------------------------------------------------------

describe('adaptMCPTool', () => {
  it('produces a valid Tool object', () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    expect(tool.name).toBeTruthy()
    expect(tool.description).toContain('Documentation Server')
    expect(tool.description).toContain('Search documentation')
    expect(typeof tool.call).toBe('function')
    expect(tool.inputSchema).toBeDefined()
  })

  it('prefixes tool name with serverId', () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    expect(tool.name).toBe('docs-server__search_docs')
  })

  it('does not double-prefix names that already contain __', () => {
    const tool = adaptMCPTool(makeMCPTool({ name: 'docs-server__search_docs' }), mockExecutor())

    expect(tool.name).toBe('docs-server__search_docs')
  })

  it('sanitizes invalid characters in name', () => {
    const tool = adaptMCPTool(
      makeMCPTool({ name: 'search.docs!v2', serverId: 'my.server' }),
      mockExecutor(),
    )

    // dots and bangs should be replaced with underscores
    expect(tool.name).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('truncates names to 64 characters', () => {
    const tool = adaptMCPTool(
      makeMCPTool({
        name: 'a'.repeat(60),
        serverId: 'server',
      }),
      mockExecutor(),
    )

    expect(tool.name.length).toBeLessThanOrEqual(64)
  })

  it('defaults to isReadOnly: false (fail-closed)', () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    expect(tool.isReadOnly).toBe(false)
  })

  it('defaults to isConcurrencySafe: false (fail-closed)', () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    expect(tool.isConcurrencySafe).toBe(false)
  })

  it('is frozen', () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    expect(Object.isFrozen(tool)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// call() delegation
// ---------------------------------------------------------------------------

describe('adaptMCPTool — call()', () => {
  it('delegates to executor with original tool name and serverId', async () => {
    const executor = mockExecutor()
    const tool = adaptMCPTool(makeMCPTool(), executor)

    await tool.call({ query: 'hello' })

    expect(executor).toHaveBeenCalledWith('docs-server', 'search_docs', { query: 'hello' })
  })

  it('returns ToolResult with serialized result on success', async () => {
    const tool = adaptMCPTool(makeMCPTool(), mockExecutor())

    const result = await tool.call({ query: 'test' })

    expect(result.isError).toBeUndefined()
    expect(result.content.length).toBe(1)
    expect(result.content[0]?.type).toBe('text')

    const text = (result.content[0] as { text: string }).text
    expect(JSON.parse(text)).toEqual({ matches: ['a', 'b'] })
  })

  it('returns string result directly without double-serializing', async () => {
    const executor = vi.fn().mockResolvedValue({
      success: true,
      result: 'plain text result',
    })
    const tool = adaptMCPTool(makeMCPTool(), executor)

    const result = await tool.call({})

    const text = (result.content[0] as { text: string }).text
    expect(text).toBe('plain text result')
  })

  it('returns isError: true on executor failure', async () => {
    const executor = vi.fn().mockResolvedValue({
      success: false,
      error: 'Server not found',
    })
    const tool = adaptMCPTool(makeMCPTool(), executor)

    const result = await tool.call({ query: 'x' })

    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('Server not found')
  })

  it('provides fallback error message when executor error is undefined', async () => {
    const executor = vi.fn().mockResolvedValue({
      success: false,
    })
    const tool = adaptMCPTool(makeMCPTool(), executor)

    const result = await tool.call({})

    expect(result.isError).toBe(true)
    const text = (result.content[0] as { text: string }).text
    expect(text).toContain('search_docs')
  })

  it('accepts any object input (passthrough schema)', async () => {
    const executor = mockExecutor()
    const tool = adaptMCPTool(makeMCPTool(), executor)

    // Should not throw — MCP tools accept arbitrary objects
    await tool.call({ arbitrary: 'data', nested: { deep: true }, num: 42 })

    expect(executor).toHaveBeenCalledWith('docs-server', 'search_docs', {
      arbitrary: 'data',
      nested: { deep: true },
      num: 42,
    })
  })
})

// ---------------------------------------------------------------------------
// adaptMCPTools (batch)
// ---------------------------------------------------------------------------

describe('adaptMCPTools', () => {
  it('adapts multiple tools', () => {
    const tools = adaptMCPTools(
      [makeMCPTool({ name: 'search_docs' }), makeMCPTool({ name: 'get_doc' })],
      mockExecutor(),
    )

    expect(tools.length).toBe(2)
    expect(tools[0]?.name).toBe('docs-server__search_docs')
    expect(tools[1]?.name).toBe('docs-server__get_doc')
  })

  it('returns empty array for empty input', () => {
    const tools = adaptMCPTools([], mockExecutor())

    expect(tools).toEqual([])
  })

  it('each adapted tool delegates to the same executor', async () => {
    const executor = mockExecutor()
    const tools = adaptMCPTools(
      [makeMCPTool({ name: 'tool_a' }), makeMCPTool({ name: 'tool_b' })],
      executor,
    )

    await tools[0]?.call({})
    await tools[1]?.call({})

    expect(executor).toHaveBeenCalledTimes(2)
    expect(executor).toHaveBeenCalledWith('docs-server', 'tool_a', {})
    expect(executor).toHaveBeenCalledWith('docs-server', 'tool_b', {})
  })
})
