// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, expect, it } from 'vitest'
import {
  buildSystemPrompt,
  COGNOGRAPH_IDENTITY,
  flattenSystemPrompt,
  type ToolDefinition,
} from '../promptBuilder'

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_node',
    description: 'Create a node on the canvas',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'search_nodes',
    description: 'Search for nodes by query',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    },
  },
]

const SAMPLE_BFS_CONTEXT = `## Connected Nodes (2)

### [note] Project Plan (depth: 1, role: reference)
This is the main project plan with milestones.

---

### [task] Fix Bug #42 (depth: 1, role: provides-context)
Critical bug in the rendering pipeline.

---`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('promptBuilder', () => {
  // -------------------------------------------------------------------------
  // COGNOGRAPH_IDENTITY constant
  // -------------------------------------------------------------------------

  describe('COGNOGRAPH_IDENTITY', () => {
    it('is a non-empty string', () => {
      expect(typeof COGNOGRAPH_IDENTITY).toBe('string')
      expect(COGNOGRAPH_IDENTITY.length).toBeGreaterThan(100)
    })

    it('contains key identity elements', () => {
      expect(COGNOGRAPH_IDENTITY).toContain('Cognograph')
      expect(COGNOGRAPH_IDENTITY).toContain('spatial')
      expect(COGNOGRAPH_IDENTITY).toContain('canvas')
    })
  })

  // -------------------------------------------------------------------------
  // buildSystemPrompt
  // -------------------------------------------------------------------------

  describe('buildSystemPrompt', () => {
    it('returns static prefix with cache_control marker', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.staticPrefix.cache_control).toBeDefined()
      expect(result.staticPrefix.cache_control).toEqual({ type: 'ephemeral' })
      expect(result.staticPrefix.type).toBe('text')
    })

    it('returns dynamic suffix WITHOUT cache_control marker', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.dynamicSuffix.cache_control).toBeUndefined()
      expect(result.dynamicSuffix.type).toBe('text')
    })

    it('includes identity text in static prefix', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.staticPrefix.text).toContain('Cognograph')
      expect(result.staticPrefix.text).toContain('spatial')
    })

    it('includes sorted tool definitions in static prefix', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.staticPrefix.text).toContain('create_node')
      expect(result.staticPrefix.text).toContain('search_nodes')
      expect(result.staticPrefix.text).toContain('Available Tools')
    })

    it('sorts tools alphabetically for cache stability', () => {
      // Pass tools in reverse order — result should still be sorted
      const reversedTools = [...SAMPLE_TOOLS].reverse()
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, reversedTools, '')

      const createIdx = result.staticPrefix.text.indexOf('### create_node')
      const searchIdx = result.staticPrefix.text.indexOf('### search_nodes')

      expect(createIdx).toBeLessThan(searchIdx)
    })

    it('includes BFS context in dynamic suffix', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.dynamicSuffix.text).toContain('Project Plan')
      expect(result.dynamicSuffix.text).toContain('Fix Bug #42')
      expect(result.dynamicSuffix.text).toContain('Current Context')
    })

    it('does NOT include BFS context in static prefix', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)

      expect(result.staticPrefix.text).not.toContain('Project Plan')
      expect(result.staticPrefix.text).not.toContain('Fix Bug #42')
    })

    it('handles empty BFS context', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, '')

      expect(result.dynamicSuffix.text).toContain('No connected context')
      expect(result.dynamicSuffix.cache_control).toBeUndefined()
    })

    it('handles empty tools array', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, [], SAMPLE_BFS_CONTEXT)

      expect(result.staticPrefix.text).not.toContain('Available Tools')
      expect(result.staticPrefix.cache_control).toEqual({ type: 'ephemeral' })
    })

    it('includes tool input schemas in static prefix', () => {
      const result = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, '')

      // Schema should be serialized as JSON in the static portion
      expect(result.staticPrefix.text).toContain('"type": "string"')
      expect(result.staticPrefix.text).toContain('Input schema')
    })

    it('static prefix is identical regardless of BFS context', () => {
      const result1 = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, 'Context A')
      const result2 = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, 'Context B')

      // Static portions must be identical for cache hits
      expect(result1.staticPrefix.text).toBe(result2.staticPrefix.text)
    })

    it('dynamic suffix changes with different BFS context', () => {
      const result1 = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, 'Context A')
      const result2 = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, 'Context B')

      expect(result1.dynamicSuffix.text).not.toBe(result2.dynamicSuffix.text)
    })
  })

  // -------------------------------------------------------------------------
  // flattenSystemPrompt
  // -------------------------------------------------------------------------

  describe('flattenSystemPrompt', () => {
    it('combines static and dynamic into a single string', () => {
      const built = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)
      const flat = flattenSystemPrompt(built)

      expect(flat).toContain(built.staticPrefix.text)
      expect(flat).toContain(built.dynamicSuffix.text)
    })

    it('preserves content ordering (static before dynamic)', () => {
      const built = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)
      const flat = flattenSystemPrompt(built)

      const identityIdx = flat.indexOf('Cognograph')
      const contextIdx = flat.indexOf('Current Context')

      expect(identityIdx).toBeLessThan(contextIdx)
    })

    it('does not include cache_control markers in flat string', () => {
      const built = buildSystemPrompt(COGNOGRAPH_IDENTITY, SAMPLE_TOOLS, SAMPLE_BFS_CONTEXT)
      const flat = flattenSystemPrompt(built)

      expect(flat).not.toContain('cache_control')
      expect(flat).not.toContain('ephemeral')
    })
  })
})
