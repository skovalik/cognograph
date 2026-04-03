// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { buildTool } from '../buildTool'
import type { ToolConfig, ToolResult } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOOP_CALL = async (): Promise<ToolResult> => ({
  content: [{ type: 'text', text: 'ok' }],
})

function validConfig(overrides: Partial<ToolConfig> = {}): ToolConfig {
  return {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: z.object({ query: z.string() }),
    call: NOOP_CALL,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('buildTool — valid config', () => {
  it('produces a Tool with all required fields', () => {
    const tool = buildTool(validConfig())

    expect(tool.name).toBe('test_tool')
    expect(tool.description).toBe('A test tool')
    expect(tool.inputSchema).toBeDefined()
    expect(typeof tool.call).toBe('function')
  })

  it('fills fail-closed defaults', () => {
    const tool = buildTool(validConfig())

    expect(tool.isReadOnly).toBe(false)
    expect(tool.isConcurrencySafe).toBe(false)
    expect(tool.interruptBehavior).toBe('cancel')
    expect(tool.errorCascade).toBe(false)
  })

  it('respects explicit overrides', () => {
    const tool = buildTool(
      validConfig({
        isReadOnly: true,
        isConcurrencySafe: true,
        interruptBehavior: 'block',
        errorCascade: true,
        prompt: 'Extra context for LLM',
      })
    )

    expect(tool.isReadOnly).toBe(true)
    expect(tool.isConcurrencySafe).toBe(true)
    expect(tool.interruptBehavior).toBe('block')
    expect(tool.errorCascade).toBe(true)
    expect(tool.prompt).toBe('Extra context for LLM')
  })

  it('includes checkPermissions when provided', () => {
    const checker = async () => 'allow' as const
    const tool = buildTool(validConfig({ checkPermissions: checker }))

    expect(tool.checkPermissions).toBeDefined()
    expect(typeof tool.checkPermissions).toBe('function')
  })

  it('omits checkPermissions when not provided', () => {
    const tool = buildTool(validConfig())
    expect(tool.checkPermissions).toBeUndefined()
  })

  it('returns a frozen object', () => {
    const tool = buildTool(validConfig())

    expect(Object.isFrozen(tool)).toBe(true)
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(tool as any).name = 'mutated'
    }).toThrow()
  })

  it('call() works correctly', async () => {
    const tool = buildTool(
      validConfig({
        call: async (input) => ({
          content: [
            { type: 'text', text: `Received: ${JSON.stringify(input)}` },
          ],
        }),
      })
    )

    const result = await tool.call({ query: 'hello' })
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Received: {"query":"hello"}',
    })
  })
})

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('buildTool — validation', () => {
  it('throws on missing name', () => {
    expect(() =>
      buildTool(validConfig({ name: '' }))
    ).toThrow('non-empty "name"')
  })

  it('throws on invalid name characters', () => {
    expect(() =>
      buildTool(validConfig({ name: 'my tool!' }))
    ).toThrow('invalid characters')
  })

  it('throws on name exceeding 64 chars', () => {
    expect(() =>
      buildTool(validConfig({ name: 'a'.repeat(65) }))
    ).toThrow('exceeds 64 characters')
  })

  it('throws on missing description', () => {
    expect(() =>
      buildTool(validConfig({ description: '' }))
    ).toThrow('"description" is required')
  })

  it('throws on missing inputSchema', () => {
    expect(() =>
      buildTool(validConfig({ inputSchema: undefined as unknown as z.ZodSchema }))
    ).toThrow('"inputSchema"')
  })

  it('throws on non-Zod inputSchema', () => {
    expect(() =>
      buildTool(validConfig({ inputSchema: { type: 'object' } as unknown as z.ZodSchema }))
    ).toThrow('Zod schema')
  })

  it('throws on missing call', () => {
    expect(() =>
      buildTool(validConfig({ call: undefined as unknown as ToolConfig['call'] }))
    ).toThrow('"call" must be a function')
  })

  it('allows hyphens and underscores in name', () => {
    const tool = buildTool(validConfig({ name: 'my-test_tool-1' }))
    expect(tool.name).toBe('my-test_tool-1')
  })
})
