// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * SDK Tool Definitions — wraps Cognograph canvas tools for the Agent SDK path.
 *
 * === Phase 2B update ===
 * Tool execution now delegates to the shared toolExecutor via a ToolPool,
 * ensuring consistent Zod validation and permission checks across both
 * API and SDK paths. The executeInRenderer IPC bridge is preserved as a
 * fallback for when no ToolPool is provided (backward compatibility).
 */

import { randomUUID } from 'node:crypto'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import { executeToolCall } from '../tools/toolExecutor'
import type { ExecutionContext, NormalizedToolCall, ToolPool } from '../tools/types'

// ---------------------------------------------------------------------------
// Pending callbacks map — matches graphIntelligence.ts pattern
// ---------------------------------------------------------------------------
const pendingToolCalls = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }
>()

// Permanent listener — registered once at module load, not per-call
ipcMain.on('sdk-tool-result', (_event, data: { id: string; result: unknown; error?: string }) => {
  const pending = pendingToolCalls.get(data.id)
  if (!pending) return
  pendingToolCalls.delete(data.id)
  clearTimeout(pending.timeout)
  if (data.error) {
    pending.reject(new Error(data.error))
  } else {
    pending.resolve(data.result)
  }
})

// ---------------------------------------------------------------------------
// IPC bridge — sends tool calls to the renderer for store execution
// (preserved as fallback when no ToolPool is provided; also used by the
// API-path builtinTools deps via createApiPathBuiltinToolDeps in claudeAgent)
// ---------------------------------------------------------------------------
export async function executeInRenderer(
  toolName: string,
  args: Record<string, unknown>,
  conversationId?: string,
): Promise<unknown> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) throw new Error('No renderer window')

  console.log(`[SDK Tools] executeInRenderer: ${toolName}`, JSON.stringify(args).slice(0, 200))
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timeout = setTimeout(() => {
      pendingToolCalls.delete(id)
      reject(new Error('Tool execution timeout (30s)'))
    }, 30000)

    pendingToolCalls.set(id, { resolve, reject, timeout })
    win.webContents.send('sdk-tool-call', { id, toolName, args, conversationId })
  })
}

// ---------------------------------------------------------------------------
// Conversation context — set before each query() call so tools know which
// conversation node they're operating on (for positioning, context injection)
// ---------------------------------------------------------------------------
let currentConversationId: string | undefined

export function setCurrentConversationId(id: string): void {
  currentConversationId = id
}

export function getCurrentConversationId(): string | undefined {
  return currentConversationId
}

// ---------------------------------------------------------------------------
// Phase 2B: Shared execution context and pool reference
// ---------------------------------------------------------------------------
let activeToolPool: ToolPool | undefined
let activeExecutionContext: ExecutionContext | undefined

/**
 * Set the ToolPool and ExecutionContext for SDK tool execution.
 * Must be called before each query() to wire tools through the shared executor.
 */
export function setSdkToolPool(pool: ToolPool, ctx: ExecutionContext): void {
  activeToolPool = pool
  activeExecutionContext = ctx
}

/**
 * Execute a tool call through the shared toolExecutor if a ToolPool is active,
 * otherwise fall back to the legacy executeInRenderer pattern.
 */
async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  if (activeToolPool && activeExecutionContext) {
    // Phase 2B path: delegate to shared toolExecutor
    const call: NormalizedToolCall = {
      id: randomUUID(),
      name: toolName,
      input: args,
    }
    const { result, updatedContext } = await executeToolCall(
      call,
      activeToolPool,
      activeExecutionContext,
    )
    // Update the active context if the tool modified it
    activeExecutionContext = updatedContext

    // Convert ToolResult content to a single string for SDK format
    const text = result.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')

    if (result.isError) {
      throw new Error(text || `Tool "${toolName}" failed`)
    }
    return text
  }

  // Legacy fallback: direct IPC to renderer
  const result = await executeInRenderer(toolName, args, currentConversationId)
  return JSON.stringify(result)
}

// ---------------------------------------------------------------------------
// Tool definitions (8 tools matching agentTools.ts executeTool switch cases)
// ---------------------------------------------------------------------------

const createNodeTool = tool(
  'create_node',
  'Create a node on the Cognograph canvas. Types: note (text content), task (actionable items), artifact (code/HTML/media), project (groups), action (operations).',
  {
    type: z
      .enum(['note', 'task', 'artifact', 'project', 'text', 'conversation'])
      .describe(
        'Node type. Use note for text content, task for actionable items, artifact for HTML/code/media, project for groups.',
      ),
    title: z.string().describe('Node title'),
    content: z.string().optional().describe('Node content (text, HTML, code)'),
    description: z.string().optional().describe('Node description'),
    contentType: z
      .enum(['text', 'markdown', 'code', 'html', 'json', 'svg', 'mermaid'])
      .optional()
      .describe('Content type for artifact nodes. Use "html" for rendered HTML.'),
    status: z.string().optional(),
    priority: z.string().optional(),
  },
  async (args) => {
    const text = await executeTool('create_node', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const batchCreateTool = tool(
  'batch_create',
  'Create multiple nodes and edges in one call. ALWAYS use this when creating 2+ nodes.',
  {
    nodes: z.array(
      z.object({
        temp_id: z.string(),
        type: z.enum(['note', 'task', 'artifact', 'project', 'text', 'conversation']),
        title: z.string(),
        content: z.string().optional(),
        description: z.string().optional(),
        contentType: z.enum(['text', 'markdown', 'code', 'html', 'json']).optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
      }),
    ),
    edges: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          label: z.string().optional(),
        }),
      )
      .optional(),
  },
  async (args) => {
    const text = await executeTool('batch_create', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const linkNodesTool = tool(
  'link_nodes',
  'Connect two nodes with a directed edge.',
  {
    source: z.string().describe('Source node ID'),
    target: z.string().describe('Target node ID'),
    label: z.string().optional().describe('Edge label'),
  },
  async (args) => {
    const text = await executeTool('link_nodes', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const updateNodeTool = tool(
  'update_node',
  'Update properties of an existing node.',
  {
    nodeId: z.string().describe('Node ID to update'),
    title: z.string().optional(),
    content: z.string().optional(),
    description: z.string().optional(),
    contentType: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
  },
  async (args) => {
    const text = await executeTool('update_node', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const searchNodesTool = tool(
  'search_nodes',
  'Search for nodes by title, type, or content.',
  {
    query: z.string().optional().describe('Search query (substring match on title/content)'),
    type: z.string().optional().describe('Filter by node type'),
  },
  async (args) => {
    const text = await executeTool('search_nodes', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const getInitialContextTool = tool(
  'get_initial_context',
  'Get an overview of all nodes and edges on the canvas.',
  {},
  async (args) => {
    const text = await executeTool('get_initial_context', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const getContextChainTool = tool(
  'get_context_chain',
  'Get the content of nodes connected to a specific node.',
  {
    nodeId: z.string().describe('Node ID to get context for'),
  },
  async (args) => {
    const text = await executeTool('get_context_chain', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

const getSelectionTool = tool(
  'get_selection',
  'Get the currently selected nodes on the canvas.',
  {},
  async (args) => {
    const text = await executeTool('get_selection', args)
    return { content: [{ type: 'text' as const, text }] }
  },
)

// ---------------------------------------------------------------------------
// Export the SDK MCP server
// ---------------------------------------------------------------------------
export function createCognographSdkServer() {
  return createSdkMcpServer({
    name: 'cognograph_canvas',
    tools: [
      createNodeTool,
      batchCreateTool,
      linkNodesTool,
      updateNodeTool,
      searchNodesTool,
      getInitialContextTool,
      getContextChainTool,
      getSelectionTool,
    ],
  })
}
