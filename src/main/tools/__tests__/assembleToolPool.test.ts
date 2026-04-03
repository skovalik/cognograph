// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { assembleToolPool } from '../assembleToolPool'
import { buildTool } from '../buildTool'
import type { Tool, ToolResult } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOOP_CALL = async (): Promise<ToolResult> => ({
  content: [{ type: 'text', text: 'ok' }],
})

function makeTool(name: string, schema?: z.ZodSchema): Tool {
  return buildTool({
    name,
    description: `Description for ${name}`,
    inputSchema: schema ?? z.object({ input: z.string() }),
    call: NOOP_CALL,
  })
}

// ---------------------------------------------------------------------------
// Merge behavior
// ---------------------------------------------------------------------------

describe('assembleToolPool — merge', () => {
  it('combines builtin and MCP tools', () => {
    const builtin = [makeTool('read_file'), makeTool('write_file')]
    const mcp = [makeTool('search_web'), makeTool('fetch_url')]

    const pool = assembleToolPool(builtin, mcp)

    expect(pool.list()).toHaveLength(4)
    expect(pool.get('read_file')).toBeDefined()
    expect(pool.get('search_web')).toBeDefined()
  })

  it('builtin wins on name collision (MCP tool is overridden)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const builtinTool = buildTool({
      name: 'search',
      description: 'Builtin search',
      inputSchema: z.object({}),
      call: NOOP_CALL,
      isReadOnly: true,
    })

    const mcpTool = buildTool({
      name: 'search',
      description: 'MCP search override',
      inputSchema: z.object({ query: z.string() }),
      call: NOOP_CALL,
    })

    const pool = assembleToolPool([builtinTool], [mcpTool])

    // Builtin wins — trusted source takes precedence
    expect(pool.get('search')?.description).toBe('Builtin search')
    // Total count is 1 (no duplicates)
    expect(pool.list()).toHaveLength(1)
    // Warning was logged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Name collision'))

    warnSpy.mockRestore()
  })

  it('returns undefined for unknown tool names', () => {
    const pool = assembleToolPool([makeTool('a')], [])
    expect(pool.get('nonexistent')).toBeUndefined()
  })

  it('works with empty arrays', () => {
    const pool = assembleToolPool([], [])
    expect(pool.list()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Format converters
// ---------------------------------------------------------------------------

describe('assembleToolPool — Anthropic format', () => {
  it('produces valid Anthropic tool definitions', () => {
    const pool = assembleToolPool(
      [
        buildTool({
          name: 'greet',
          description: 'Say hello',
          inputSchema: z.object({
            name: z.string().describe('Who to greet'),
          }),
          call: NOOP_CALL,
        }),
      ],
      [],
    )

    const defs = pool.toAnthropicFormat()
    expect(defs).toHaveLength(1)

    const def = defs[0]!
    expect(def.name).toBe('greet')
    expect(def.description).toBe('Say hello')
    expect(def.input_schema.type).toBe('object')
    expect(def.input_schema.properties).toBeDefined()
    expect(def.input_schema.properties.name).toBeDefined()
    expect(def.input_schema.required).toContain('name')
  })
})

describe('assembleToolPool — OpenAI format', () => {
  it('produces valid OpenAI tool definitions', () => {
    const pool = assembleToolPool(
      [
        buildTool({
          name: 'search',
          description: 'Search stuff',
          inputSchema: z.object({
            query: z.string(),
            limit: z.number().optional(),
          }),
          call: NOOP_CALL,
        }),
      ],
      [],
    )

    const defs = pool.toOpenAIFormat()
    expect(defs).toHaveLength(1)

    const def = defs[0]!
    expect(def.type).toBe('function')
    expect(def.function.name).toBe('search')
    expect(def.function.description).toBe('Search stuff')
    expect(def.function.parameters.type).toBe('object')
    expect(def.function.parameters.properties.query).toBeDefined()
  })
})

describe('assembleToolPool — Gemini format', () => {
  it('produces valid Gemini tool definitions', () => {
    const pool = assembleToolPool(
      [
        buildTool({
          name: 'create_node',
          description: 'Create a node',
          inputSchema: z.object({
            title: z.string(),
            content: z.string().optional(),
          }),
          call: NOOP_CALL,
        }),
      ],
      [],
    )

    const defs = pool.toGeminiFormat()
    expect(defs).toHaveLength(1)

    const def = defs[0]!
    expect(def.name).toBe('create_node')
    expect(def.description).toBe('Create a node')
    expect(def.parameters.type).toBe('object')
    expect(def.parameters.properties.title).toBeDefined()
  })
})

describe('assembleToolPool — format converter consistency', () => {
  it('all three formats produce the same number of tools', () => {
    const tools = [makeTool('a'), makeTool('b'), makeTool('c')]
    const pool = assembleToolPool(tools, [])

    expect(pool.toAnthropicFormat()).toHaveLength(3)
    expect(pool.toOpenAIFormat()).toHaveLength(3)
    expect(pool.toGeminiFormat()).toHaveLength(3)
  })

  it('handles tools with empty schemas gracefully', () => {
    const pool = assembleToolPool(
      [
        buildTool({
          name: 'noop',
          description: 'Does nothing',
          inputSchema: z.object({}),
          call: NOOP_CALL,
        }),
      ],
      [],
    )

    const anthro = pool.toAnthropicFormat()[0]!
    expect(anthro.input_schema.type).toBe('object')

    const oai = pool.toOpenAIFormat()[0]!
    expect(oai.function.parameters.type).toBe('object')

    const gem = pool.toGeminiFormat()[0]!
    expect(gem.parameters.type).toBe('object')
  })
})
