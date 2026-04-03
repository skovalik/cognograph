// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { assembleToolPool } from '../assembleToolPool'
import { buildTool } from '../buildTool'
import { resolveAgentTools } from '../resolveAgentTools'
import type { Tool } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTool(
  name: string,
  opts: { isReadOnly?: boolean; isConcurrencySafe?: boolean } = {},
): Tool {
  return buildTool({
    name,
    description: `Tool ${name}`,
    inputSchema: z.object({}),
    isReadOnly: opts.isReadOnly ?? false,
    isConcurrencySafe: opts.isConcurrencySafe ?? false,
    async call() {
      return { content: [{ type: 'text', text: `${name} result` }] }
    },
  })
}

function makePool(tools: Tool[]) {
  return assembleToolPool(tools, [])
}

// ---------------------------------------------------------------------------
// Whitelist
// ---------------------------------------------------------------------------

describe('resolveAgentTools — whitelist', () => {
  it('filters pool to only whitelisted tools', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('search'),
    ])

    const filtered = resolveAgentTools(pool, { tools: ['read_file', 'search'] })

    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file', 'search'])
    expect(filtered.get('write_file')).toBeUndefined()
  })

  it('returns empty pool when whitelist names match nothing', () => {
    const pool = makePool([makeTool('echo')])

    const filtered = resolveAgentTools(pool, { tools: ['nonexistent'] })

    expect(filtered.list()).toHaveLength(0)
  })

  it('handles empty whitelist array (no tools)', () => {
    const pool = makePool([makeTool('echo')])

    // Empty array — treated as "no whitelist" (falls through to no filter)
    const filtered = resolveAgentTools(pool, { tools: [] })

    expect(filtered.list()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------

describe('resolveAgentTools — blacklist', () => {
  it('excludes blacklisted tools from pool', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('delete_file'),
    ])

    const filtered = resolveAgentTools(pool, {
      disallowedTools: ['write_file', 'delete_file'],
    })

    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file'])
  })

  it('returns full pool when blacklist names match nothing', () => {
    const pool = makePool([makeTool('echo'), makeTool('search')])

    const filtered = resolveAgentTools(pool, {
      disallowedTools: ['nonexistent'],
    })

    expect(filtered.list()).toHaveLength(2)
  })

  it('handles empty blacklist array (no filter)', () => {
    const pool = makePool([makeTool('echo')])

    const filtered = resolveAgentTools(pool, { disallowedTools: [] })

    expect(filtered.list()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Whitelist precedence over blacklist
// ---------------------------------------------------------------------------

describe('resolveAgentTools — precedence', () => {
  it('ignores blacklist when whitelist is set', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('search'),
    ])

    const filtered = resolveAgentTools(pool, {
      tools: ['read_file', 'write_file'],
      disallowedTools: ['write_file'], // Should be IGNORED
    })

    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file', 'write_file'])
  })
})

// ---------------------------------------------------------------------------
// ReadOnly filter
// ---------------------------------------------------------------------------

describe('resolveAgentTools — readOnly', () => {
  it('filters to only readOnly tools when readOnly is true', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('list_dir', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('delete_file'),
    ])

    const filtered = resolveAgentTools(pool, { readOnly: true })

    const names = filtered.list().map((t) => t.name)
    // Pool is sorted alphabetically — list_dir < read_file
    expect(names).toEqual(['list_dir', 'read_file'])
  })

  it('readOnly + whitelist: applies both filters', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('search', { isReadOnly: true }),
    ])

    const filtered = resolveAgentTools(pool, {
      tools: ['read_file', 'write_file'],
      readOnly: true,
    })

    // write_file passes whitelist but fails readOnly
    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file'])
  })

  it('readOnly + blacklist: applies both filters', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('list_dir', { isReadOnly: true }),
      makeTool('write_file'),
    ])

    const filtered = resolveAgentTools(pool, {
      disallowedTools: ['list_dir'],
      readOnly: true,
    })

    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file'])
  })

  it('passes all tools when readOnly is false/undefined', () => {
    const pool = makePool([makeTool('read_file', { isReadOnly: true }), makeTool('write_file')])

    const filtered = resolveAgentTools(pool, { readOnly: false })
    expect(filtered.list()).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// No config (pass-through)
// ---------------------------------------------------------------------------

describe('resolveAgentTools — no config', () => {
  it('returns all tools when no filtering is configured', () => {
    const pool = makePool([
      makeTool('read_file', { isReadOnly: true }),
      makeTool('write_file'),
      makeTool('search'),
    ])

    const filtered = resolveAgentTools(pool, {})

    expect(filtered.list()).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// ConnectedAgent compatibility
// ---------------------------------------------------------------------------

describe('resolveAgentTools — ConnectedAgent shape', () => {
  it('accepts a full ConnectedAgent object', () => {
    const pool = makePool([makeTool('read_file', { isReadOnly: true }), makeTool('write_file')])

    // Simulate a ConnectedAgent with tool filtering fields
    const agent = {
      nodeId: 'node-1',
      order: 0,
      conditions: [],
      status: 'idle' as const,
      retryCount: 0,
      tools: ['read_file'],
      readOnly: true,
    }

    const filtered = resolveAgentTools(pool, agent)

    const names = filtered.list().map((t) => t.name)
    expect(names).toEqual(['read_file'])
  })
})
