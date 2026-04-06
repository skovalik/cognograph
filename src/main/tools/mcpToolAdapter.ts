// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * MCP Tool Adapter — converts MCP tool definitions into canonical Tool objects.
 *
 * Takes an MCPToolDefinition (name, description, JSON Schema inputSchema, serverId)
 * and produces a Tool that:
 *   - Uses a passthrough Zod schema that accepts any object (MCP tools define
 *     their own JSON Schema; we forward it as-is to providers via the pool's
 *     format converters, and use a permissive Zod schema for runtime validation)
 *   - Delegates call() to the provided MCP client executor function
 *   - Defaults to isReadOnly: false, isConcurrencySafe: false (fail-closed)
 *
 * The passthrough approach is intentional: MCP tool schemas are defined by external
 * servers and may use JSON Schema features beyond what zod-to-json-schema can
 * round-trip. We validate structurally (must be an object) but defer semantic
 * validation to the MCP server itself.
 */

import { z } from 'zod'
import { buildTool } from './buildTool'
import type { Tool, ToolResult } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** MCP tool definition as discovered from an MCP server */
export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
  serverName: string
}

/** Function signature for executing a tool call against an MCP server */
export type MCPToolExecutor = (
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; result?: unknown; error?: string }>

// ---------------------------------------------------------------------------
// Passthrough Zod schema
// ---------------------------------------------------------------------------

/**
 * A permissive Zod schema that accepts any object.
 *
 * MCP tools define their own JSON Schema which gets forwarded to LLM providers
 * via the ToolPool format converters. At runtime, we only enforce that the input
 * is a plain object — the MCP server validates the rest.
 */
const mcpPassthroughSchema = z.record(z.string(), z.unknown())

// ---------------------------------------------------------------------------
// Single tool adapter
// ---------------------------------------------------------------------------

/**
 * Adapt a single MCP tool definition into a canonical Tool.
 *
 * @param mcpTool  — The MCP tool definition from server discovery
 * @param executor — Function that sends tool calls to the MCP client
 * @returns A frozen Tool object ready for assembleToolPool()
 */
export function adaptMCPTool(mcpTool: MCPToolDefinition, executor: MCPToolExecutor): Tool {
  // Prefix MCP tool names with server ID to avoid cross-server collisions.
  // If the name already contains the server prefix (legacy), don't double-prefix.
  const qualifiedName = mcpTool.name.includes('__')
    ? mcpTool.name
    : `${mcpTool.serverId}__${mcpTool.name}`

  // Sanitize the qualified name to match tool name constraints ([a-zA-Z0-9_-])
  const safeName = qualifiedName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

  return buildTool({
    name: safeName,
    description: `[${mcpTool.serverName}] ${mcpTool.description}`,
    inputSchema: mcpPassthroughSchema,
    isReadOnly: false,
    isConcurrencySafe: false,
    interruptBehavior: 'cancel',

    async call(input): Promise<ToolResult> {
      const args = mcpPassthroughSchema.parse(input)

      const result = await executor(
        mcpTool.serverId,
        mcpTool.name, // Use original name for MCP protocol call
        args as Record<string, unknown>,
      )

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: result.error ?? `MCP tool "${mcpTool.name}" failed`,
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
          },
        ],
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Batch adapter
// ---------------------------------------------------------------------------

/**
 * Adapt all MCP tools from a server into canonical Tool objects.
 *
 * @param mcpTools — Array of MCP tool definitions from a single server
 * @param executor — Function that sends tool calls to the MCP client
 * @returns Array of frozen Tool objects
 */
export function adaptMCPTools(mcpTools: MCPToolDefinition[], executor: MCPToolExecutor): Tool[] {
  return mcpTools.map((t) => adaptMCPTool(t, executor))
}
