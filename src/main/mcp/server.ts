// MCP Server - Phase 14
// Creates and configures the MCP server with stdio transport

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

import type { MCPSyncProvider } from './provider'
import { TOOL_DEFINITIONS } from './tools'
import { handleToolCall } from './handlers'
import { getResourceList, handleResourceRead } from './resources'

/**
 * Create and start an MCP server using the given provider for data access.
 * Returns the server instance (caller manages lifecycle).
 */
export async function createMCPServer(provider: MCPSyncProvider): Promise<Server> {
  const server = new Server(
    {
      name: 'cognograph',
      version: '1.0.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      const result = handleToolCall(provider, name, (args as Record<string, unknown>) || {})
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      }
    }
  })

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = getResourceList(provider)
    return { resources }
  })

  // Read a resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const content = handleResourceRead(provider, request.params.uri)
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: content
          }
        ]
      }
    } catch (error) {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      }
    }
  })

  // Connect stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('[MCP] Cognograph MCP server started')

  return server
}
