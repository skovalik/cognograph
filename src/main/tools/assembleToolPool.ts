// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool Pool Assembly — merges builtin and MCP tools, resolves collisions,
 * and exposes provider-specific format converters.
 *
 * Builtins win on name collision (MCP tool is replaced, warning logged).
 * The frozen tool list is sorted alphabetically by name for API cache stability.
 * Format converters use zod-to-json-schema to produce provider JSON.
 */

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { AnthropicToolDef, GeminiToolDef, OpenAIToolDef, Tool, ToolPool } from './types'

// ---------------------------------------------------------------------------
// JSON Schema conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a Tool's Zod inputSchema to a JSON Schema object.
 * Falls back to a permissive `{ type: 'object', properties: {} }` on error.
 */
function zodToObjectSchema(tool: Tool): {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = zodToJsonSchema(tool.inputSchema as any, { target: 'jsonSchema7' })
    // zodToJsonSchema may wrap in { $schema, ...rest } — extract the schema body
    const schema = typeof raw === 'object' && raw !== null ? raw : {}
    const obj = schema as Record<string, unknown>

    // Ensure we always have type: 'object'
    return {
      type: 'object',
      properties: (obj.properties as Record<string, unknown>) ?? {},
      ...(Array.isArray(obj.required) && obj.required.length > 0
        ? { required: obj.required as string[] }
        : {}),
      // Preserve additionalProperties if present
      ...(obj.additionalProperties !== undefined
        ? { additionalProperties: obj.additionalProperties }
        : {}),
    }
  } catch (err) {
    console.warn(
      `[ToolPool] Failed to convert Zod schema for tool "${tool.name}":`,
      err instanceof Error ? err.message : err,
    )
    return { type: 'object', properties: {} }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Assemble a ToolPool from builtin tools and MCP tools.
 *
 * - Builtins win on name collision (MCP tool is skipped, warning logged).
 * - The frozen tool list is sorted alphabetically by name for API cache stability.
 * - Returns a frozen ToolPool with .get(), .list(), and format converters.
 */
export function assembleToolPool(builtinTools: Tool[], mcpTools: Tool[]): ToolPool {
  const toolMap = new Map<string, Tool>()

  // Register MCP tools first — they lose on collision
  for (const tool of mcpTools) {
    toolMap.set(tool.name, tool)
  }

  // Register builtins second — they win on collision (trusted source)
  for (const tool of builtinTools) {
    if (toolMap.has(tool.name)) {
      console.warn(
        `[ToolPool] Name collision: builtin tool "${tool.name}" overrides MCP tool with same name`,
      )
    }
    toolMap.set(tool.name, tool)
  }

  // Sort alphabetically for API cache stability, then freeze
  const sortedTools = [...toolMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const frozenList: readonly Tool[] = Object.freeze(sortedTools)

  const pool: ToolPool = {
    get(name: string): Tool | undefined {
      return toolMap.get(name)
    },

    list(): readonly Tool[] {
      return frozenList
    },

    toAnthropicFormat(): AnthropicToolDef[] {
      return frozenList.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: zodToObjectSchema(tool),
      }))
    },

    toOpenAIFormat(): OpenAIToolDef[] {
      return frozenList.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodToObjectSchema(tool),
        },
      }))
    },

    toGeminiFormat(): GeminiToolDef[] {
      return frozenList.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToObjectSchema(tool),
      }))
    },
  }

  return Object.freeze(pool)
}
