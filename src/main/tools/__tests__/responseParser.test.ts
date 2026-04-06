// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import { parseToolCalls } from '../responseParser'

// ---------------------------------------------------------------------------
// UUID format helper
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

describe('parseToolCalls — Anthropic', () => {
  it('extracts tool_use blocks from content array', () => {
    const message = {
      content: [
        { type: 'text', text: 'Let me search for that.' },
        {
          type: 'tool_use',
          id: 'toolu_abc123',
          name: 'search_nodes',
          input: { query: 'test', type: 'note' },
        },
      ],
    }

    const calls = parseToolCalls(message, 'anthropic')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.id).toBe('toolu_abc123')
    expect(calls[0]!.name).toBe('search_nodes')
    expect(calls[0]!.input).toEqual({ query: 'test', type: 'note' })
  })

  it('handles multiple tool_use blocks', () => {
    const message = {
      content: [
        { type: 'tool_use', id: 'id1', name: 'create_node', input: { title: 'A' } },
        { type: 'text', text: 'And also...' },
        { type: 'tool_use', id: 'id2', name: 'link_nodes', input: { source: 'a', target: 'b' } },
      ],
    }

    const calls = parseToolCalls(message, 'anthropic')
    expect(calls).toHaveLength(2)
    expect(calls[0]!.name).toBe('create_node')
    expect(calls[1]!.name).toBe('link_nodes')
  })

  it('generates UUID for missing id', () => {
    const message = {
      content: [{ type: 'tool_use', name: 'test', input: {} }],
    }

    const calls = parseToolCalls(message, 'anthropic')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.id).toMatch(UUID_RE)
  })

  it('returns empty array for text-only response', () => {
    const message = {
      content: [{ type: 'text', text: 'Just a reply.' }],
    }

    expect(parseToolCalls(message, 'anthropic')).toHaveLength(0)
  })

  it('returns empty array for null/undefined', () => {
    expect(parseToolCalls(null, 'anthropic')).toHaveLength(0)
    expect(parseToolCalls(undefined, 'anthropic')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

describe('parseToolCalls — OpenAI', () => {
  it('extracts tool_calls from choices[0].message', () => {
    const message = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'call_xyz',
                type: 'function',
                function: {
                  name: 'search',
                  arguments: '{"query":"hello"}',
                },
              },
            ],
          },
        },
      ],
    }

    const calls = parseToolCalls(message, 'openai')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.id).toBe('call_xyz')
    expect(calls[0]!.name).toBe('search')
    expect(calls[0]!.input).toEqual({ query: 'hello' })
  })

  it('extracts tool_calls from direct message object', () => {
    const message = {
      tool_calls: [
        {
          id: 'call_direct',
          type: 'function',
          function: {
            name: 'read',
            arguments: '{"path":"/tmp"}',
          },
        },
      ],
    }

    const calls = parseToolCalls(message, 'openai')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.id).toBe('call_direct')
    expect(calls[0]!.input).toEqual({ path: '/tmp' })
  })

  it('returns error result on JSON parse failure (NOT silently skip)', () => {
    const message = {
      tool_calls: [
        {
          id: 'call_bad',
          type: 'function',
          function: {
            name: 'broken',
            arguments: '{invalid json!}',
          },
        },
      ],
    }

    const calls = parseToolCalls(message, 'openai')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('broken')
    expect(calls[0]!.input.__parse_error).toBe(true)
    expect(calls[0]!.input.__raw_arguments).toBe('{invalid json!}')
    expect(calls[0]!.input.__error_message).toBeDefined()
  })

  it('generates UUID for missing id', () => {
    const message = {
      tool_calls: [
        {
          type: 'function',
          function: { name: 'test', arguments: '{}' },
        },
      ],
    }

    const calls = parseToolCalls(message, 'openai')
    expect(calls[0]!.id).toMatch(UUID_RE)
  })

  it('handles pre-parsed arguments object', () => {
    const message = {
      tool_calls: [
        {
          id: 'call_pre',
          type: 'function',
          function: {
            name: 'test',
            arguments: { already: 'parsed' },
          },
        },
      ],
    }

    const calls = parseToolCalls(message, 'openai')
    expect(calls[0]!.input).toEqual({ already: 'parsed' })
  })

  it('returns empty array for no tool calls', () => {
    const message = { choices: [{ message: { content: 'Just text' } }] }
    expect(parseToolCalls(message, 'openai')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

describe('parseToolCalls — Gemini', () => {
  it('extracts functionCall from candidates[0].content.parts', () => {
    const message = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: 'create_node',
                  args: { title: 'Hello', type: 'note' },
                },
              },
            ],
          },
        },
      ],
    }

    const calls = parseToolCalls(message, 'gemini')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('create_node')
    expect(calls[0]!.input).toEqual({ title: 'Hello', type: 'note' })
    // Gemini never provides IDs — always UUID
    expect(calls[0]!.id).toMatch(UUID_RE)
  })

  it('extracts from direct content.parts', () => {
    const message = {
      content: {
        parts: [{ functionCall: { name: 'search', args: { q: 'test' } } }],
      },
    }

    const calls = parseToolCalls(message, 'gemini')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('search')
  })

  it('extracts from direct parts array', () => {
    const message = {
      parts: [{ functionCall: { name: 'list', args: {} } }],
    }

    const calls = parseToolCalls(message, 'gemini')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('list')
  })

  it('handles multiple functionCall parts', () => {
    const message = {
      parts: [
        { functionCall: { name: 'a', args: {} } },
        { text: 'some text' },
        { functionCall: { name: 'b', args: { x: 1 } } },
      ],
    }

    const calls = parseToolCalls(message, 'gemini')
    expect(calls).toHaveLength(2)
    expect(calls[0]!.name).toBe('a')
    expect(calls[1]!.name).toBe('b')
  })

  it('returns empty array for text-only response', () => {
    const message = {
      candidates: [{ content: { parts: [{ text: 'No tools' }] } }],
    }
    expect(parseToolCalls(message, 'gemini')).toHaveLength(0)
  })

  it('handles null args gracefully', () => {
    const message = {
      parts: [{ functionCall: { name: 'empty', args: null } }],
    }

    const calls = parseToolCalls(message, 'gemini')
    expect(calls[0]!.input).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('parseToolCalls — ID deduplication', () => {
  it('deduplicates identical IDs within Anthropic response', () => {
    const message = {
      content: [
        { type: 'tool_use', id: 'dup', name: 'a', input: {} },
        { type: 'tool_use', id: 'dup', name: 'b', input: {} },
      ],
    }

    const calls = parseToolCalls(message, 'anthropic')
    expect(calls).toHaveLength(2)
    // First keeps original ID
    expect(calls[0]!.id).toBe('dup')
    // Second gets new UUID
    expect(calls[1]!.id).not.toBe('dup')
    expect(calls[1]!.id).toMatch(UUID_RE)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseToolCalls — edge cases', () => {
  it('handles non-object input gracefully', () => {
    expect(parseToolCalls('string', 'anthropic')).toHaveLength(0)
    expect(parseToolCalls(42, 'openai')).toHaveLength(0)
    expect(parseToolCalls(true, 'gemini')).toHaveLength(0)
  })

  it('handles empty content array', () => {
    expect(parseToolCalls({ content: [] }, 'anthropic')).toHaveLength(0)
  })

  it('handles empty tool_calls array', () => {
    expect(parseToolCalls({ tool_calls: [] }, 'openai')).toHaveLength(0)
  })
})
