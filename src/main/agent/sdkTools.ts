// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { z } from 'zod'
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { BrowserWindow, ipcMain } from 'electron'

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
// ---------------------------------------------------------------------------
async function executeInRenderer(
  toolName: string,
  args: Record<string, unknown>,
  conversationId?: string
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

// ---------------------------------------------------------------------------
// Tool definitions (8 tools matching agentTools.ts executeTool switch cases)
// ---------------------------------------------------------------------------

const createNodeTool = tool(
  'create_node',
  'Create a node on the Cognograph canvas. Types: note (text content), task (actionable items), artifact (code/HTML/media), project (groups), action (operations).',
  {
    type: z.enum([
      'note',
      'task',
      'artifact',
      'project',
      'text',
      'conversation'
    ]).describe('Node type. Use note for text content, task for actionable items, artifact for HTML/code/media, project for groups.'),
    title: z.string().describe('Node title'),
    content: z.string().optional().describe('Node content (text, HTML, code)'),
    description: z.string().optional().describe('Node description'),
    contentType: z
      .enum(['text', 'markdown', 'code', 'html', 'json', 'svg', 'mermaid'])
      .optional()
      .describe('Content type for artifact nodes. Use "html" for rendered HTML.'),
    status: z.string().optional(),
    priority: z.string().optional()
  },
  async (args) => {
    const result = await executeInRenderer('create_node', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
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
        priority: z.string().optional()
      })
    ),
    edges: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          label: z.string().optional()
        })
      )
      .optional()
  },
  async (args) => {
    const result = await executeInRenderer('batch_create', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
)

const linkNodesTool = tool(
  'link_nodes',
  'Connect two nodes with a directed edge.',
  {
    source: z.string().describe('Source node ID'),
    target: z.string().describe('Target node ID'),
    label: z.string().optional().describe('Edge label')
  },
  async (args) => {
    const result = await executeInRenderer('link_nodes', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
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
    priority: z.string().optional()
  },
  async (args) => {
    const result = await executeInRenderer('update_node', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
)

const searchNodesTool = tool(
  'search_nodes',
  'Search for nodes by title, type, or content.',
  {
    query: z.string().optional().describe('Search query (substring match on title/content)'),
    type: z.string().optional().describe('Filter by node type')
  },
  async (args) => {
    const result = await executeInRenderer('search_nodes', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
)

const getInitialContextTool = tool(
  'get_initial_context',
  'Get an overview of all nodes and edges on the canvas.',
  {},
  async (args) => {
    const result = await executeInRenderer('get_initial_context', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
)

const getContextChainTool = tool(
  'get_context_chain',
  'Get the content of nodes connected to a specific node.',
  {
    nodeId: z.string().describe('Node ID to get context for')
  },
  async (args) => {
    const result = await executeInRenderer('get_context_chain', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
)

const getSelectionTool = tool(
  'get_selection',
  'Get the currently selected nodes on the canvas.',
  {},
  async (args) => {
    const result = await executeInRenderer('get_selection', args, currentConversationId)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  }
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
      getSelectionTool
    ]
  })
}
