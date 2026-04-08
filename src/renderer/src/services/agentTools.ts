// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Tools — tool definitions, filtering, and execution.
 *
 * ARCHITECTURE NOTE (Phase 2C: RENDERER-PASSIVIZE):
 * This file is being refactored. The target architecture has three layers:
 *
 *   1. TOOL DEFINITIONS (stay here) — JSON Schema metadata for UI display,
 *      command palette, tool badges. Pure data, no side effects.
 *
 *   2. TOOL FILTERING (stay here) — getToolsForAgent(), getChatToolDefinitions(),
 *      getMCPToolsForAgent(). Determines which tools an agent can use. Pure logic.
 *
 *   3. TOOL EXECUTION (transitional — moves to main process) — executeTool().
 *      Currently executes canvas/filesystem/MCP tools in the renderer. Will be
 *      replaced by main-process execution via the shared toolExecutor + builtinTools.
 *      Canvas tools (create_node, etc.) will be called via IPC from the main
 *      process's executeInRenderer bridge.
 *
 * Context-chain path derivation (derivePathsFromContext) stays here because it
 * reads from the workspace store which lives in the renderer.
 */

import type {
  AgentSettings,
  AgentToolDefinition,
  ArtifactNodeData,
  ConversationNodeData,
  EdgeData,
  MemoryEntry,
  NodeData,
  ProjectNodeData,
} from '@shared/types'
import { DEFAULT_AGENT_MEMORY, DEFAULT_AGENT_SETTINGS } from '@shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { layoutEvents } from '../utils/layoutEvents'
import { calculateAutoFitDimensions } from '../utils/textMeasure'
import { getAvailableMediaTools } from './media/agentToolRegistry'

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

const QUERY_TOOLS: AgentToolDefinition[] = [
  {
    name: 'get_context_chain',
    description: 'Get the context chain for the current conversation or a specific node',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'Node ID (optional, defaults to current conversation)',
        },
      },
    },
  },
  {
    name: 'search_nodes',
    description: 'Search for nodes by type, title, or tags',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'conversation',
            'project',
            'note',
            'task',
            'artifact',
            'workspace',
            'orchestrator',
          ],
          description: 'Filter by node type',
        },
        titleContains: {
          type: 'string',
          description: 'Filter by title substring (case-insensitive)',
        },
        hasTag: {
          type: 'string',
          description: 'Filter by tag',
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_selection',
    description: 'Get currently selected nodes',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_node',
    description: 'Get full details of a specific node',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The ID of the node to get details for' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'get_initial_context',
    description:
      "Get a complete overview of ALL nodes and edges on the canvas. Use this when asked what exists in the workspace, what the user's canvas looks like, or to detect changes.",
    input_schema: {
      type: 'object',
      properties: {
        includeContent: {
          type: 'boolean',
          description: 'Include full node content in results (default: false for brevity)',
        },
      },
    },
  },
]

const CREATE_NODE_TOOL: AgentToolDefinition = {
  name: 'create_node',
  description: 'Create a new node in the workspace',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['conversation', 'project', 'note', 'task', 'artifact', 'orchestrator'],
        description: 'The type of node to create',
      },
      title: {
        type: 'string',
        description: 'The title of the node',
      },
      content: {
        type: 'string',
        description: 'Content for notes/artifacts',
      },
      description: {
        type: 'string',
        description: 'Description for projects/tasks',
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
        },
        description: 'Position in workspace. If omitted, positions near the agent conversation.',
      },
      connectTo: {
        type: 'string',
        description: 'Node ID to connect to after creation',
      },
      contentType: {
        type: 'string',
        enum: ['text', 'markdown', 'code', 'html', 'json', 'svg', 'mermaid'],
        description:
          'Content type for artifact nodes. Use "html" for HTML documents that render visually as web pages.',
      },
    },
    required: ['type', 'title'],
  },
}

const CREATE_EDGE_TOOL: AgentToolDefinition = {
  name: 'link_nodes',
  description: 'Create a connection between two nodes',
  input_schema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Source node ID',
      },
      target: {
        type: 'string',
        description: 'Target node ID',
      },
      label: {
        type: 'string',
        description: 'Optional edge label',
      },
    },
    required: ['source', 'target'],
  },
}

const BATCH_CREATE_TOOL: AgentToolDefinition = {
  name: 'batch_create',
  description:
    'Create multiple nodes and edges in one call. MUCH faster than creating them one by one. Use this whenever you need to create 2+ nodes. Provide nodes first, then edges referencing nodes by their temp_id.',
  input_schema: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        description: 'Array of nodes to create. Each gets a temp_id you can reference in edges.',
        items: {
          type: 'object',
          properties: {
            temp_id: {
              type: 'string',
              description: 'Temporary ID to reference in edges (e.g. "phase1", "task1")',
            },
            type: {
              type: 'string',
              enum: ['conversation', 'project', 'note', 'task', 'artifact', 'orchestrator'],
            },
            title: { type: 'string' },
            content: { type: 'string', description: 'Content for notes/artifacts' },
            description: { type: 'string', description: 'Description for projects/tasks' },
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'done'],
              description: 'Status for tasks',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Priority for tasks',
            },
            contentType: {
              type: 'string',
              enum: ['text', 'markdown', 'code', 'html', 'json', 'svg', 'mermaid'],
              description:
                'Content type for artifact nodes. Use "html" for HTML documents that render visually as web pages.',
            },
          },
          required: ['temp_id', 'type', 'title'],
        },
      },
      edges: {
        type: 'array',
        description:
          'Array of edges to create. Use temp_ids from the nodes array for source/target.',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source temp_id or real node ID' },
            target: { type: 'string', description: 'Target temp_id or real node ID' },
            label: { type: 'string', description: 'Optional edge label' },
          },
          required: ['source', 'target'],
        },
      },
    },
    required: ['nodes'],
  },
}

const UPDATE_NODE_TOOL: AgentToolDefinition = {
  name: 'update_node',
  description: 'Update properties of an existing node',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to update',
      },
      title: {
        type: 'string',
        description: 'New title',
      },
      content: {
        type: 'string',
        description: 'New content (for notes/artifacts)',
      },
      description: {
        type: 'string',
        description: 'New description (for projects/tasks)',
      },
      status: {
        type: 'string',
        enum: ['todo', 'in-progress', 'done'],
        description: 'New status (for tasks)',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'New priority (for tasks)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tags array',
      },
      contentType: {
        type: 'string',
        enum: ['text', 'markdown', 'code', 'html', 'json', 'svg', 'mermaid'],
        description:
          'Content type for artifact nodes. Use "html" for HTML documents that render visually as web pages.',
      },
    },
    required: ['nodeId'],
  },
}

const MOVE_NODE_TOOL: AgentToolDefinition = {
  name: 'move_node',
  description: 'Move a node to a new position in the workspace',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to move',
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['x', 'y'],
        description: 'New position coordinates',
      },
    },
    required: ['nodeId', 'position'],
  },
}

const DELETE_NODE_TOOL: AgentToolDefinition = {
  name: 'delete_node',
  description: 'Delete a node from the canvas',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to delete',
      },
    },
    required: ['nodeId'],
  },
}

const DELETE_EDGE_TOOL: AgentToolDefinition = {
  name: 'unlink_nodes',
  description: 'Remove an edge between two nodes',
  input_schema: {
    type: 'object',
    properties: {
      sourceId: {
        type: 'string',
        description: 'Source node ID',
      },
      targetId: {
        type: 'string',
        description: 'Target node ID',
      },
    },
    required: ['sourceId', 'targetId'],
  },
}

const GET_TODOS_TOOL: AgentToolDefinition = {
  name: 'get_todos',
  description: 'Get task nodes with optional filters',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['todo', 'in-progress', 'done'],
        description: 'Filter by task status',
      },
      priority: {
        type: 'string',
        enum: ['none', 'low', 'medium', 'high'],
        description: 'Filter by task priority',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (tasks must have all specified tags)',
      },
      projectId: {
        type: 'string',
        description: 'Filter by project node ID (tasks connected to this project)',
      },
      limit: {
        type: 'number',
        description: 'Max results (default: 20)',
      },
    },
  },
}

const ADD_COMMENT_TOOL: AgentToolDefinition = {
  name: 'add_comment',
  description: 'Append a timestamped comment to a node',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to add a comment to',
      },
      comment: {
        type: 'string',
        description: 'The comment text to append',
      },
    },
    required: ['nodeId', 'comment'],
  },
}

// -----------------------------------------------------------------------------
// Filesystem & Command Tools
// -----------------------------------------------------------------------------

const FILESYSTEM_READ_TOOLS: AgentToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file. Returns text content and total line count. Use startLine/endLine for large files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative file path' },
        startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
        endLine: { type: 'number', description: 'End line (inclusive, optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List the contents of a directory. Returns file names, types (file/directory), and sizes.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for a regex pattern across files in a directory. Returns matching file paths, line numbers, and content snippets.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search in' },
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        fileGlob: { type: 'string', description: 'Optional file name filter (e.g., "*.ts")' },
      },
      required: ['path', 'pattern'],
    },
  },
]

const FILESYSTEM_WRITE_TOOLS: AgentToolDefinition[] = [
  {
    name: 'write_file',
    description:
      'Write content to a file, creating it and parent directories if needed. Overwrites existing content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write to' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Make a targeted edit to a file by replacing the first occurrence of an exact string with new content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to edit' },
        oldString: { type: 'string', description: 'Exact string to find (must match exactly)' },
        newString: { type: 'string', description: 'Replacement string' },
      },
      required: ['path', 'oldString', 'newString'],
    },
  },
]

const COMMAND_TOOL: AgentToolDefinition = {
  name: 'execute_command',
  description: 'Execute a shell command with 60s timeout. Supports pipes, redirects, and env vars.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: {
        type: 'string',
        description: 'Working directory (optional, defaults to first allowed path)',
      },
    },
    required: ['command'],
  },
}

// -----------------------------------------------------------------------------
// Memory Tools (available when mode === 'agent')
// -----------------------------------------------------------------------------

const MEMORY_TOOLS: AgentToolDefinition[] = [
  {
    name: 'add_memory',
    description:
      'Store a key-value pair in persistent memory. Use this to remember important information across runs -- project structure, user preferences, decisions made, file locations.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'A descriptive key for this memory (e.g., "project_root", "test_command", "coding_style"). Max 100 characters.',
        },
        value: {
          type: 'string',
          description: 'The information to remember. Max 10000 characters.',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve a specific memory entry by key.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the memory entry to retrieve',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_memories',
    description: 'List all stored memory entries with their keys and values.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_memory',
    description:
      'Delete a specific memory entry by key. Use this to remove outdated or incorrect memories.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the memory entry to delete',
        },
      },
      required: ['key'],
    },
  },
]

// -----------------------------------------------------------------------------
// Context-Chain Path Derivation
// -----------------------------------------------------------------------------

/**
 * Derive allowed filesystem paths from the agent's BFS context chain.
 * Traverses INBOUND + bidirectional edges (same as context injection),
 * finds artifact nodes with filePath properties, and extracts parent directories.
 *
 * Spatial topology controls agent permissions. Connect a folder artifact →
 * agent can access that folder.
 * Disconnect it → access revoked. No configuration UI needed.
 */
export function derivePathsFromContext(agentNodeId: string): string[] {
  const { nodes, edges } = useWorkspaceStore.getState()
  const visited = new Set<string>()
  const queue: string[] = [agentNodeId]
  const paths: string[] = []

  visited.add(agentNodeId)

  while (queue.length > 0) {
    const currentId = queue.shift()!

    // Follow inbound edges (source → currentId)
    const inbound = edges.filter(
      (e) => e.target === currentId && (e.data as EdgeData | undefined)?.active !== false,
    )
    // Follow bidirectional edges (currentId → target with direction: 'bidirectional')
    const bidirectional = edges.filter(
      (e) =>
        e.source === currentId &&
        (e.data as EdgeData | undefined)?.active !== false &&
        (e.data as EdgeData | undefined)?.direction === 'bidirectional',
    )

    const neighborIds = [...inbound.map((e) => e.source), ...bidirectional.map((e) => e.target)]

    for (const neighborId of neighborIds) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)

      const node = nodes.find((n) => n.id === neighborId)
      if (!node) continue

      // Check for project nodes with folderPath (Phase 2 folder reference)
      if (node.data.type === 'project') {
        const data = node.data as ProjectNodeData
        if (data.folderPath) {
          paths.push(data.folderPath)
        }
      }

      // Check for artifact nodes with filesystem paths
      if (node.data.type === 'artifact') {
        const data = node.data as ArtifactNodeData

        // Phase 2: explicit folderPath takes highest priority
        if (data.folderPath) {
          paths.push(data.folderPath)
        }
        // Primary: file-drop artifacts have source.originalPath
        else if (data.source?.type === 'file-drop' && data.source.originalPath) {
          const pathStr = data.source.originalPath
          const lastSep = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'))
          if (lastSep > 0) {
            paths.push(pathStr.substring(0, lastSep))
          }
        } else {
          // Fallback: custom property (for user-configured path overrides)
          const customPath = data.properties?.filePath as string | undefined
          if (customPath) {
            const lastSep = Math.max(customPath.lastIndexOf('/'), customPath.lastIndexOf('\\'))
            if (lastSep > 0) {
              paths.push(customPath.substring(0, lastSep))
            }
          }
        }
      }

      queue.push(neighborId)
    }
  }

  return [...new Set(paths)]
}

/**
 * Merge explicit allowedPaths from settings with derived paths from context chain.
 * Only derives from context when scopeMode is 'connected' (the default).
 */
function getEffectiveAllowedPaths(settings: AgentSettings, agentNodeId: string): string[] {
  const explicit = settings.allowedPaths || []
  if (settings.scopeMode === 'connected') {
    const derived = derivePathsFromContext(agentNodeId)
    return [...new Set([...explicit, ...derived])]
  }
  return explicit
}

/**
 * Get agent settings from the store for a conversation node.
 */
function getAgentSettings(conversationId: string): AgentSettings {
  const node = useWorkspaceStore.getState().nodes.find((n) => n.id === conversationId)
  if (!node) return DEFAULT_AGENT_SETTINGS
  const convData = node.data as ConversationNodeData
  return convData.agentSettings || DEFAULT_AGENT_SETTINGS
}

// -----------------------------------------------------------------------------
// Get Tools Based on Permissions
// -----------------------------------------------------------------------------

/**
 * Chat mode tools — query tools + basic mutations.
 * Used by chatToolService for canvas-aware chat without full agent permissions.
 */
export function getChatToolDefinitions(): AgentToolDefinition[] {
  return [
    ...QUERY_TOOLS,
    CREATE_NODE_TOOL,
    CREATE_EDGE_TOOL,
    BATCH_CREATE_TOOL,
    UPDATE_NODE_TOOL,
    MOVE_NODE_TOOL,
    DELETE_EDGE_TOOL,
    GET_TODOS_TOOL,
    ADD_COMMENT_TOOL,
  ]
}

export function getToolsForAgent(
  settings: AgentSettings,
  agentNodeId?: string,
): AgentToolDefinition[] {
  const tools = [...QUERY_TOOLS] // Always include query tools

  if (settings.canCreateNodes) {
    tools.push(CREATE_NODE_TOOL)
    tools.push(BATCH_CREATE_TOOL)
  }
  if (settings.canCreateEdges) {
    tools.push(CREATE_EDGE_TOOL)
  }
  if (settings.canModifyNodes) {
    tools.push(UPDATE_NODE_TOOL)
    tools.push(MOVE_NODE_TOOL)
  }
  if (settings.canDeleteNodes) {
    tools.push(DELETE_NODE_TOOL)
  }
  if (settings.canDeleteEdges) {
    tools.push(DELETE_EDGE_TOOL)
  }

  // Memory tools — always available for agent-mode nodes
  if (agentNodeId) {
    const node = useWorkspaceStore.getState().nodes.find((n) => n.id === agentNodeId)
    if (node && node.data.type === 'conversation') {
      const convData = node.data as ConversationNodeData
      if (convData.mode === 'agent') {
        tools.push(...MEMORY_TOOLS)
      }
    }
  }

  // Filesystem tools — gated by permissions + requires paths to be configured
  const hasFilesystemPaths = agentNodeId
    ? getEffectiveAllowedPaths(settings, agentNodeId).length > 0
    : (settings.allowedPaths?.length ?? 0) > 0

  if (settings.canReadFiles && hasFilesystemPaths) {
    tools.push(...FILESYSTEM_READ_TOOLS)
  }
  if (settings.canWriteFiles && hasFilesystemPaths) {
    tools.push(...FILESYSTEM_WRITE_TOOLS)
  }
  if (settings.canExecuteCommands && hasFilesystemPaths) {
    tools.push(COMMAND_TOOL)
  }

  // Media tools — auto-registered based on available API keys
  tools.push(...getAvailableMediaTools())

  return tools
}

/**
 * Fetch MCP tools for an agent from connected MCP servers.
 * Returns tools as AgentToolDefinition[] for merging into the agent's tool list.
 *
 * This is async because it calls IPC to the main process where MCP connections live.
 * The caller should merge these with the result of getToolsForAgent().
 */
export async function getMCPToolsForAgent(settings: AgentSettings): Promise<{
  tools: AgentToolDefinition[]
  mcpToolServerMap: Map<string, string>
}> {
  const mcpToolServerMap = new Map<string, string>()

  if (!settings.mcpServers || settings.mcpServers.length === 0) {
    return { tools: [], mcpToolServerMap }
  }

  if (!window.api?.mcpClient) {
    return { tools: [], mcpToolServerMap }
  }

  const result = await window.api.mcpClient.getToolsForServers(settings.mcpServers)
  if (!result.success || !result.tools || !Array.isArray(result.tools)) {
    return { tools: [], mcpToolServerMap }
  }

  const tools: AgentToolDefinition[] = result.tools.map((mcpTool) => {
    // Prefix MCP tool names with server name to avoid collisions with canvas tools
    const prefixedName = `mcp_${mcpTool.serverId}_${mcpTool.name}`
    mcpToolServerMap.set(prefixedName, mcpTool.serverId)

    return {
      name: prefixedName,
      description: `[${mcpTool.serverName}] ${mcpTool.description}`,
      input_schema: mcpTool.inputSchema as AgentToolDefinition['input_schema'],
    }
  })

  return { tools, mcpToolServerMap }
}

// Active MCP tool-to-server routing map, set before each agent loop iteration
let activeMCPToolServerMap: Map<string, string> = new Map()

/**
 * Set the MCP tool-to-server routing map. Called by agentService before each iteration.
 */
export function setMCPToolServerMap(map: Map<string, string>): void {
  activeMCPToolServerMap = map
}

// -----------------------------------------------------------------------------
// Tool Executor
// TRANSITIONAL: This entire section moves to main process in Phase 2C.
// Canvas tools will be invoked from main via builtinTools.executeInRenderer IPC.
// Filesystem/MCP tools already delegate to main via window.api IPC.
// Media tools will route through main-process media pipeline.
//
// After migration, this file retains only:
//   - Tool definitions (QUERY_TOOLS, CREATE_NODE_TOOL, etc.)
//   - Tool filtering (getToolsForAgent, getChatToolDefinitions, getMCPToolsForAgent)
//   - Context-chain derivation (derivePathsFromContext, getEffectiveAllowedPaths)
//   - ToolExecutionResult type (shared with callers)
// -----------------------------------------------------------------------------

export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Execute a tool in the renderer process.
 *
 * @deprecated TRANSITIONAL — Phase 2C RENDERER-PASSIVIZE.
 * This function is called from:
 *   - agentService.ts (API path tool loop) — will be replaced by main-process agentLoop
 *   - chatToolService.ts (chat tool loop) — will be replaced by main-process agentLoop
 *   - sdkToolBridge.ts (SDK path) — already replaced by main-process setSdkToolPool()
 *   - WorkspaceCommandService.ts (workspace commands) — will route through main
 *
 * Do NOT add new callers. New tool execution should go through the main process
 * toolExecutor + builtinTools system.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  agentConversationId: string,
): Promise<ToolExecutionResult> {
  const store = useWorkspaceStore.getState()

  try {
    switch (toolName) {
      case 'get_context_chain': {
        const nodeId = (input.nodeId as string) || agentConversationId
        const context = store.getContextForNode(nodeId)
        return {
          success: true,
          result: { context: context || 'No context available.' },
        }
      }

      case 'search_nodes': {
        const { type, titleContains, hasTag, limit = 10 } = input
        let results = store.nodes

        if (type) {
          results = results.filter((n) => n.data.type === type)
        }
        if (titleContains) {
          const search = (titleContains as string).toLowerCase()
          results = results.filter((n) => {
            const title = ((n.data as NodeData & { title?: string }).title || '').toLowerCase()
            return title.includes(search)
          })
        }
        if (hasTag) {
          results = results.filter((n) => {
            const tags = (n.data as NodeData & { tags?: string[] }).tags || []
            return tags.includes(hasTag as string)
          })
        }

        const limited = results.slice(0, limit as number).map((n) => ({
          id: n.id,
          type: n.data.type,
          title: (n.data as NodeData & { title?: string }).title,
          position: n.position,
        }))

        return {
          success: true,
          result: { nodes: limited, total: results.length },
        }
      }

      case 'get_selection': {
        const selected = store.selectedNodeIds
          .map((id) => {
            const node = store.nodes.find((n) => n.id === id)
            return node
              ? {
                  id,
                  type: node.data.type,
                  title: (node.data as NodeData & { title?: string }).title,
                }
              : null
          })
          .filter(Boolean)
        return { success: true, result: { selectedNodes: selected } }
      }

      case 'get_node': {
        const node = store.nodes.find((n) => n.id === input.nodeId)
        if (!node) {
          return { success: false, error: `Node not found: ${input.nodeId}` }
        }
        return {
          success: true,
          result: {
            node: {
              id: node.id,
              ...node.data,
              position: node.position,
              width: node.width,
              height: node.height,
            },
          },
        }
      }

      case 'get_initial_context': {
        const includeContent = input.includeContent === true
        const nodeList = store.nodes.map((n) => {
          const data = n.data as NodeData & {
            title?: string
            content?: string
            description?: string
          }
          const entry: Record<string, unknown> = {
            id: n.id,
            type: n.data.type,
            title: data.title || '(untitled)',
            position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
          }
          if (includeContent) {
            if (data.content) entry.content = data.content
            if (data.description) entry.description = data.description
          }
          return entry
        })
        const edgeList = store.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: (e.data as EdgeData | undefined)?.label || undefined,
          strength: (e.data as EdgeData | undefined)?.strength || 'normal',
        }))
        return {
          success: true,
          result: {
            nodes: nodeList,
            edges: edgeList,
            summary: `${nodeList.length} nodes, ${edgeList.length} edges`,
          },
        }
      }

      case 'create_node': {
        const { type, title, content, description, position, connectTo, contentType } = input

        // Calculate position: use viewport center as base, stagger to avoid overlapping.
        // The AI has no knowledge of the current viewport, so explicit coordinates from
        // the AI are treated as offsets from origin — usually wrong. We always compute
        // from the user's current view.
        const vp = store.viewport || { x: 0, y: 0, zoom: 1 }
        const zoom = vp.zoom || 1
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 900
        // Convert screen center to flow coordinates
        const viewCenterX = (screenW / 2 - vp.x) / zoom
        const viewCenterY = (screenH / 2 - vp.y) / zoom

        let finalPosition: { x: number; y: number }
        if (position && typeof (position as { x: number }).x === 'number') {
          // AI provided explicit coordinates — use them but only if they seem intentional
          // (i.e. non-zero). Zero coordinates are likely "I don't know where to put it".
          const p = position as { x: number; y: number }
          if (p.x !== 0 || p.y !== 0) {
            finalPosition = p
          } else {
            finalPosition = { x: viewCenterX, y: viewCenterY }
          }
        } else {
          // No position specified — place near viewport center with grid stagger.
          // Rendered node dimensions: widest is 360×280 (Orchestrator), common is 320×200.
          // Spacing = rendered width + 50px padding each side + 100px clear gap between siblings.
          // Horizontal: 320 + 50 + 50 + 100 = 520px. Round up to 540 for visual breathing room.
          // Vertical: 200 + 50 + 50 + 100 = 400px.
          const GRID_COLS = 3
          const COL_SPACING = 540
          const ROW_SPACING = 400
          const nearbyCreated = store.nodes.filter(
            (n) =>
              Math.abs(n.position.x - viewCenterX) < 1600 &&
              Math.abs(n.position.y - viewCenterY) < 1600,
          ).length
          const col = nearbyCreated % GRID_COLS
          const row = Math.floor(nearbyCreated / GRID_COLS)
          const gridOffsetX = -((GRID_COLS - 1) * COL_SPACING) / 2
          finalPosition = {
            x: viewCenterX + gridOffsetX + col * COL_SPACING,
            y: viewCenterY - 150 + row * ROW_SPACING,
          }
        }

        const nodeId = store.addNode(type as NodeData['type'], finalPosition)

        // Update with additional data
        const updateData: Record<string, unknown> = { title }
        if (content) updateData.content = content
        if (description) updateData.description = description
        if (contentType) updateData.contentType = contentType

        store.updateNode(nodeId, updateData as Partial<NodeData>)

        // Resize HTML artifacts to a usable default
        if (contentType === 'html') {
          store.updateNode(nodeId, { width: 480, height: 400 } as Partial<NodeData>)
        }

        // Create edge if requested
        if (connectTo) {
          store.addEdge({
            source: connectTo as string,
            target: nodeId,
            sourceHandle: null,
            targetHandle: null,
          })
        }

        return { success: true, result: { nodeId, title, type } }
      }

      case 'link_nodes': {
        const { source, target, label } = input

        // Generate edge ID
        const edgeId = `${source}-${target}`

        store.addEdge({
          source: source as string,
          target: target as string,
          sourceHandle: null,
          targetHandle: null,
        })

        if (label) {
          store.updateEdge(edgeId, { label: label as string })
        }

        return { success: true, result: { edgeId } }
      }

      case 'batch_create': {
        const { nodes: nodeDefs = [], edges: edgeDefs = [] } = input as {
          nodes: Array<{
            temp_id: string
            type: string
            title: string
            content?: string
            description?: string
            status?: string
            priority?: string
            contentType?: string
          }>
          edges: Array<{ source: string; target: string; label?: string }>
        }

        // Map temp_ids to real node IDs
        const tempToReal = new Map<string, string>()
        const createdNodes: Array<{ tempId: string; nodeId: string; title: string }> = []
        const createdEdges: string[] = []

        // Viewport center for positioning
        const vp = store.viewport || { x: 0, y: 0, zoom: 1 }
        const zoom = vp.zoom || 1
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 900
        const viewCenterX = (screenW / 2 - vp.x) / zoom
        const viewCenterY = (screenH / 2 - vp.y) / zoom

        // Create nodes with grid stagger
        const GRID_COLS = 4
        const COL_SPACING = 400
        const ROW_SPACING = 300
        for (let i = 0; i < nodeDefs.length; i++) {
          const def = nodeDefs[i]
          const col = i % GRID_COLS
          const row = Math.floor(i / GRID_COLS)
          const gridOffsetX = -((GRID_COLS - 1) * COL_SPACING) / 2
          const pos = {
            x: viewCenterX + gridOffsetX + col * COL_SPACING,
            y: viewCenterY - 150 + row * ROW_SPACING,
          }

          const nodeId = store.addNode(def.type as NodeData['type'], pos)
          const updateData: Record<string, unknown> = { title: def.title }
          if (def.content) updateData.content = def.content
          if (def.description) updateData.description = def.description
          if (def.status) updateData.status = def.status
          if (def.priority) updateData.priority = def.priority
          if (def.contentType) updateData.contentType = def.contentType
          store.updateNode(nodeId, updateData as Partial<NodeData>)

          // Resize HTML artifacts to a usable default
          if (def.contentType === 'html') {
            store.updateNode(nodeId, { width: 480, height: 400 } as Partial<NodeData>)
          }

          tempToReal.set(def.temp_id, nodeId)
          createdNodes.push({ tempId: def.temp_id, nodeId, title: def.title })
        }

        // Auto-fit nodes to content dimensions (Fix 1 — demo polish)
        const HEADER_H: Record<string, number> = {
          task: 40,
          note: 44,
          artifact: 48,
          project: 44,
          text: 32,
          conversation: 48,
        }
        const FOOTER_H = 36

        const fitItems: Array<{ nodeId: string; width: number; height: number }> = []
        for (const [_tempId, realId] of tempToReal.entries()) {
          const node = useWorkspaceStore.getState().nodes.find((n) => n.id === realId)
          if (!node) continue
          const nodeData = node.data as any
          const nodeType = nodeData.type || 'note'
          const headerH = HEADER_H[nodeType] ?? 44
          const title = nodeData.title || ''
          const content = nodeData.content || nodeData.description || ''
          const currentW = node.width ?? 280

          const dims = calculateAutoFitDimensions(title, content, headerH, FOOTER_H, currentW)

          const isHtml = nodeData.contentType === 'html'

          // HTML artifacts render in iframes — use fixed reasonable dimensions, not text heuristics
          if (isHtml) {
            const finalW = Math.max(currentW, 680)
            const finalH = Math.max(node.height ?? 140, 520)
            if (finalW > currentW || finalH > (node.height ?? 140)) {
              fitItems.push({ nodeId: realId, width: finalW, height: finalH })
            }
            continue
          }

          const contentFloor =
            content.length > 2000
              ? 900
              : content.length > 1000
                ? 700
                : content.length > 500
                  ? 500
                  : content.length > 200
                    ? 350
                    : 0
          const widthFloor =
            content.length > 500 ? 520 : content.length > 300 ? 480 : content.length > 100 ? 340 : 0

          const finalW = Math.max(currentW, dims.width, widthFloor)
          const finalH = Math.max(node.height ?? 140, dims.height, contentFloor)

          if (finalW > currentW || finalH > (node.height ?? 140)) {
            fitItems.push({ nodeId: realId, width: finalW, height: finalH })
          }
        }

        if (fitItems.length > 0) {
          const freshStore = useWorkspaceStore.getState()
          if (freshStore.batchFitNodesToContent) {
            freshStore.batchFitNodesToContent(fitItems)
          } else {
            for (const item of fitItems) {
              freshStore.updateNodeDimensions(item.nodeId, item.width, item.height)
            }
          }
        }

        // Create edges (resolve temp_ids to real IDs)
        // Re-read store — nodes were just created via addNode() which mutates Zustand synchronously,
        // but the `store` param is a stale snapshot from before the batch started.
        const freshNodes = useWorkspaceStore.getState().nodes
        for (const edgeDef of edgeDefs) {
          const sourceId = tempToReal.get(edgeDef.source as string) || (edgeDef.source as string)
          const targetId = tempToReal.get(edgeDef.target as string) || (edgeDef.target as string)

          // Verify both nodes exist (using fresh store state)
          if (
            !freshNodes.find((n) => n.id === sourceId) ||
            !freshNodes.find((n) => n.id === targetId)
          )
            continue

          const edgeId = `${sourceId}-${targetId}`
          store.addEdge({
            source: sourceId,
            target: targetId,
            sourceHandle: null,
            targetHandle: null,
          })
          if (edgeDef.label) store.updateEdge(edgeId, { label: edgeDef.label as string })
          createdEdges.push(edgeId)
        }

        // Dispatch layout after auto-fit + edge creation (Fix 4 — demo polish)
        const createdNodeIds = Array.from(tempToReal.values())
        const createdEdgeIds = createdEdges

        layoutEvents.dispatchEvent(
          new CustomEvent('run-layout', {
            detail: {
              nodeIds: createdNodeIds,
              edgeIds: createdEdgeIds,
              conversationId: agentConversationId,
            },
          }),
        )

        return {
          success: true,
          result: {
            nodesCreated: createdNodes.length,
            edgesCreated: createdEdges.length,
            nodeMap: Object.fromEntries(createdNodes.map((n) => [n.tempId, n.nodeId])),
          },
        }
      }

      case 'update_node': {
        const { nodeId, ...updates } = input
        const node = store.nodes.find((n) => n.id === nodeId)
        if (!node) {
          return { success: false, error: `Node not found: ${nodeId}` }
        }

        store.updateNode(nodeId as string, updates as Partial<NodeData>)
        return { success: true, result: { nodeId, updated: Object.keys(updates) } }
      }

      case 'move_node': {
        const { nodeId, position } = input
        const node = store.nodes.find((n) => n.id === nodeId)
        if (!node) {
          return { success: false, error: `Node not found: ${nodeId}` }
        }

        // Move node to new position
        store.moveNode(nodeId as string, position as { x: number; y: number })
        return { success: true, result: { nodeId, position } }
      }

      case 'delete_node': {
        const { nodeId } = input
        const node = store.nodes.find((n) => n.id === nodeId)
        if (!node) {
          return { success: false, error: `Node not found: ${nodeId}` }
        }

        store.deleteNodes([nodeId as string])
        return { success: true, result: { deleted: nodeId } }
      }

      case 'unlink_nodes': {
        const { sourceId, targetId } = input
        const edge = store.edges.find((e) => e.source === sourceId && e.target === targetId)
        if (!edge) {
          return { success: false, error: `No edge found from ${sourceId} to ${targetId}` }
        }
        store.deleteEdges([edge.id])
        return { success: true, result: { deleted: edge.id, sourceId, targetId } }
      }

      case 'get_todos': {
        const { status, priority, tags, projectId, limit = 20 } = input
        let tasks = store.nodes.filter((n) => n.data.type === 'task')

        if (status) {
          tasks = tasks.filter((n) => {
            const data = n.data as NodeData & { status?: string }
            return data.status === status
          })
        }
        if (priority) {
          tasks = tasks.filter((n) => {
            const data = n.data as NodeData & { priority?: string }
            return data.priority === priority
          })
        }
        if (tags && Array.isArray(tags)) {
          tasks = tasks.filter((n) => {
            const data = n.data as NodeData & { tags?: string[] }
            const nodeTags = data.tags || []
            return (tags as string[]).every((t) => nodeTags.includes(t))
          })
        }
        if (projectId) {
          const connectedTaskIds = new Set(
            store.edges
              .filter((e) => e.source === projectId || e.target === projectId)
              .flatMap((e) => [e.source, e.target]),
          )
          tasks = tasks.filter((n) => connectedTaskIds.has(n.id))
        }

        const limited = tasks.slice(0, limit as number).map((n) => {
          const data = n.data as NodeData & {
            title?: string
            status?: string
            priority?: string
            tags?: string[]
            description?: string
          }
          return {
            id: n.id,
            title: data.title || '(untitled)',
            status: data.status,
            priority: data.priority,
            tags: data.tags,
            description: data.description,
            position: n.position,
          }
        })

        return {
          success: true,
          result: { tasks: limited, total: tasks.length },
        }
      }

      case 'add_comment': {
        const { nodeId, comment } = input
        const node = store.nodes.find((n) => n.id === nodeId)
        if (!node) {
          return { success: false, error: `Node not found: ${nodeId}` }
        }

        const timestamp = new Date().toISOString()
        const commentBlock = `\n\n---\n**Comment** (${timestamp}):\n${comment}`

        // Append to content or description depending on node type
        const data = node.data as NodeData & { content?: string; description?: string }
        if ('content' in data && data.content !== undefined) {
          store.updateNode(
            nodeId as string,
            {
              content: data.content + commentBlock,
            } as Partial<NodeData>,
          )
        } else {
          store.updateNode(
            nodeId as string,
            {
              description: (data.description || '') + commentBlock,
            } as Partial<NodeData>,
          )
        }

        return { success: true, result: { nodeId, timestamp, comment } }
      }

      // ----- Memory Tools -----

      case 'add_memory': {
        const { key, value } = input
        const node = store.nodes.find((n) => n.id === agentConversationId)
        if (!node) return { success: false, error: 'Agent node not found' }

        const convData = node.data as ConversationNodeData
        const memory = convData.agentMemory || { ...DEFAULT_AGENT_MEMORY }

        // Validate key/value size limits (Fix 2)
        const keyStr = String(key)
        const valueStr = String(value)

        if (keyStr.length > memory.maxKeyLength) {
          return {
            success: false,
            error: `Key exceeds maximum length of ${memory.maxKeyLength} characters (got ${keyStr.length})`,
          }
        }

        if (valueStr.length > memory.maxValueLength) {
          return {
            success: false,
            error: `Value exceeds maximum length of ${memory.maxValueLength} characters (got ${valueStr.length})`,
          }
        }

        // Upsert: update if key exists, create if not
        const existing = memory.entries.findIndex((e) => e.key === keyStr)
        const entry: MemoryEntry = {
          key: keyStr,
          value: valueStr,
          createdAt: existing >= 0 ? memory.entries[existing]!.createdAt : new Date().toISOString(),
          updatedAt: existing >= 0 ? new Date().toISOString() : undefined,
          source: 'agent',
        }

        const newEntries = [...memory.entries]
        if (existing >= 0) {
          newEntries[existing] = entry
        } else {
          // Evict oldest if at capacity
          if (newEntries.length >= memory.maxEntries) {
            newEntries.shift()
          }
          newEntries.push(entry)
        }

        store.updateNode(agentConversationId, {
          agentMemory: { ...memory, entries: newEntries },
        })

        return { success: true, result: { stored: keyStr, totalEntries: newEntries.length } }
      }

      case 'get_memory': {
        const { key } = input
        const node = store.nodes.find((n) => n.id === agentConversationId)
        if (!node) return { success: false, error: 'Agent node not found' }

        const convData = node.data as ConversationNodeData
        const memory = convData.agentMemory || DEFAULT_AGENT_MEMORY

        const keyStr = String(key)
        const entry = memory.entries.find((e) => e.key === keyStr)

        if (!entry) {
          return { success: false, error: `No memory entry found with key: "${keyStr}"` }
        }

        return { success: true, result: { entry } }
      }

      case 'list_memories': {
        const node = store.nodes.find((n) => n.id === agentConversationId)
        if (!node) return { success: false, error: 'Agent node not found' }

        const convData = node.data as ConversationNodeData
        const memory = convData.agentMemory || DEFAULT_AGENT_MEMORY

        return {
          success: true,
          result: {
            entries: memory.entries,
            totalEntries: memory.entries.length,
            maxEntries: memory.maxEntries,
          },
        }
      }

      case 'delete_memory': {
        const { key } = input
        const node = store.nodes.find((n) => n.id === agentConversationId)
        if (!node) return { success: false, error: 'Agent node not found' }

        const convData = node.data as ConversationNodeData
        const memory = convData.agentMemory || DEFAULT_AGENT_MEMORY

        const keyStr = String(key)
        const existingIdx = memory.entries.findIndex((e) => e.key === keyStr)

        if (existingIdx < 0) {
          return { success: false, error: `No memory entry found with key: "${keyStr}"` }
        }

        const newEntries = memory.entries.filter((e) => e.key !== keyStr)

        store.updateNode(agentConversationId, {
          agentMemory: { ...memory, entries: newEntries },
        })

        return { success: true, result: { deleted: keyStr, totalEntries: newEntries.length } }
      }

      // ----- Filesystem Tools (async IPC to main process) -----

      case 'read_file': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canReadFiles) {
          return { success: false, error: 'File reading is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.readFile(
          input.path as string,
          allowedPaths,
          input.startLine as number | undefined,
          input.endLine as number | undefined,
        )
      }

      case 'list_directory': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canReadFiles) {
          return { success: false, error: 'File reading is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.listDirectory(input.path as string, allowedPaths)
      }

      case 'search_files': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canReadFiles) {
          return { success: false, error: 'File reading is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.searchFiles(
          input.path as string,
          input.pattern as string,
          allowedPaths,
          input.fileGlob as string | undefined,
        )
      }

      case 'write_file': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canWriteFiles) {
          return { success: false, error: 'File writing is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.writeFile(
          input.path as string,
          input.content as string,
          allowedPaths,
        )
      }

      case 'edit_file': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canWriteFiles) {
          return { success: false, error: 'File writing is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.editFile(
          input.path as string,
          input.oldString as string,
          input.newString as string,
          allowedPaths,
        )
      }

      case 'execute_command': {
        const settings = getAgentSettings(agentConversationId)
        if (!settings.canExecuteCommands) {
          return { success: false, error: 'Command execution is not enabled for this agent.' }
        }
        const allowedPaths = getEffectiveAllowedPaths(settings, agentConversationId)
        return await window.api.filesystem.executeCommand(
          input.command as string,
          allowedPaths,
          settings.allowedCommands || [],
          input.cwd as string | undefined,
        )
      }

      // ----- Media Tools -----

      case 'generate_image': {
        try {
          const { executeGenerateImage } = await import('./media/tools/generateImage')
          const result = await executeGenerateImage(
            input as Parameters<typeof executeGenerateImage>[0],
          )
          return { success: true, result }
        } catch (error) {
          return { success: false, error: `Failed to generate image: ${(error as Error).message}` }
        }
      }

      case 'edit_image': {
        try {
          const { executeEditImage } = await import('./media/tools/editImage')
          const result = await executeEditImage(input as Parameters<typeof executeEditImage>[0])
          return { success: true, result }
        } catch (error) {
          return { success: false, error: `Failed to edit image: ${(error as Error).message}` }
        }
      }

      case 'generate_audio': {
        try {
          // generate_audio executor not yet implemented — route through IPC media pipeline
          if (!window.api?.media?.generateAudio) {
            return {
              success: false,
              error: 'Audio generation API not available. Provider may not be configured.',
            }
          }
          const result = await window.api.media.generateAudio(input as Record<string, unknown>)
          return { success: true, result }
        } catch (error) {
          return { success: false, error: `Failed to generate audio: ${(error as Error).message}` }
        }
      }

      case 'generate_video': {
        try {
          if (!window.api?.media?.generateVideo) {
            return {
              success: false,
              error: 'Video generation API not available. Provider may not be configured.',
            }
          }
          const result = await window.api.media.generateVideo(input as Record<string, unknown>)
          return { success: true, result }
        } catch (error) {
          return { success: false, error: `Failed to generate video: ${(error as Error).message}` }
        }
      }

      case 'generate_3d': {
        try {
          if (!window.api?.media?.generate3D) {
            return {
              success: false,
              error: '3D generation API not available. Provider may not be configured.',
            }
          }
          const result = await window.api.media.generate3D(input as Record<string, unknown>)
          return { success: true, result }
        } catch (error) {
          return {
            success: false,
            error: `Failed to generate 3D model: ${(error as Error).message}`,
          }
        }
      }

      case 'analyze_media': {
        try {
          if (!window.api?.media?.analyzeMedia) {
            return {
              success: false,
              error: 'Media analysis API not available. Provider may not be configured.',
            }
          }
          const result = await window.api.media.analyzeMedia(input as Record<string, unknown>)
          return { success: true, result }
        } catch (error) {
          return { success: false, error: `Failed to analyze media: ${(error as Error).message}` }
        }
      }

      default: {
        // Check if this is an MCP tool call (prefixed with mcp_)
        const mcpServerId = activeMCPToolServerMap.get(toolName)
        if (mcpServerId && window.api?.mcpClient) {
          // Strip the prefix to get the original MCP tool name
          // Format: mcp_{serverId}_{toolName} → extract toolName
          const prefix = `mcp_${mcpServerId}_`
          const originalToolName = toolName.startsWith(prefix)
            ? toolName.slice(prefix.length)
            : toolName
          const result = await window.api.mcpClient.callTool(mcpServerId, originalToolName, input)
          return {
            success: result.success,
            result: result.result,
            error: result.error,
          }
        }
        return { success: false, error: `Unknown tool: ${toolName}` }
      }
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
