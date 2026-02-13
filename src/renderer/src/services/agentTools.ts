import { useWorkspaceStore } from '../stores/workspaceStore'
import type {
  AgentToolDefinition,
  AgentSettings,
  NodeData,
  ArtifactNodeData,
  ConversationNodeData,
  EdgeData,
  MemoryEntry
} from '@shared/types'
import { DEFAULT_AGENT_SETTINGS, DEFAULT_AGENT_MEMORY } from '@shared/types'

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

const QUERY_TOOLS: AgentToolDefinition[] = [
  {
    name: 'get_context',
    description: 'Get the context chain for the current conversation or a specific node',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'Node ID (optional, defaults to current conversation)'
        }
      }
    }
  },
  {
    name: 'find_nodes',
    description: 'Search for nodes by type, title, or tags',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['conversation', 'project', 'note', 'task', 'artifact', 'workspace', 'orchestrator'],
          description: 'Filter by node type'
        },
        titleContains: {
          type: 'string',
          description: 'Filter by title substring (case-insensitive)'
        },
        hasTag: {
          type: 'string',
          description: 'Filter by tag'
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 10)'
        }
      }
    }
  },
  {
    name: 'get_selection',
    description: 'Get currently selected nodes on the canvas',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_node_details',
    description: 'Get full details of a specific node',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The ID of the node to get details for' }
      },
      required: ['nodeId']
    }
  }
]

const CREATE_NODE_TOOL: AgentToolDefinition = {
  name: 'create_node',
  description: 'Create a new node on the canvas',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['conversation', 'project', 'note', 'task', 'artifact', 'orchestrator'],
        description: 'The type of node to create'
      },
      title: {
        type: 'string',
        description: 'The title of the node'
      },
      content: {
        type: 'string',
        description: 'Content for notes/artifacts'
      },
      description: {
        type: 'string',
        description: 'Description for projects/tasks'
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        description: 'Position on canvas. If omitted, positions near the agent conversation.'
      },
      connectTo: {
        type: 'string',
        description: 'Node ID to connect to after creation'
      }
    },
    required: ['type', 'title']
  }
}

const CREATE_EDGE_TOOL: AgentToolDefinition = {
  name: 'create_edge',
  description: 'Create a connection between two nodes',
  input_schema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Source node ID'
      },
      target: {
        type: 'string',
        description: 'Target node ID'
      },
      label: {
        type: 'string',
        description: 'Optional edge label'
      }
    },
    required: ['source', 'target']
  }
}

const UPDATE_NODE_TOOL: AgentToolDefinition = {
  name: 'update_node',
  description: 'Update properties of an existing node',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to update'
      },
      title: {
        type: 'string',
        description: 'New title'
      },
      content: {
        type: 'string',
        description: 'New content (for notes/artifacts)'
      },
      description: {
        type: 'string',
        description: 'New description (for projects/tasks)'
      },
      status: {
        type: 'string',
        enum: ['todo', 'in-progress', 'done'],
        description: 'New status (for tasks)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'New priority (for tasks)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tags array'
      }
    },
    required: ['nodeId']
  }
}

const MOVE_NODE_TOOL: AgentToolDefinition = {
  name: 'move_node',
  description: 'Move a node to a new position on the canvas',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to move'
      },
      position: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' }
        },
        required: ['x', 'y'],
        description: 'New position coordinates'
      }
    },
    required: ['nodeId', 'position']
  }
}

const DELETE_NODE_TOOL: AgentToolDefinition = {
  name: 'delete_node',
  description: 'Delete a node from the canvas',
  input_schema: {
    type: 'object',
    properties: {
      nodeId: {
        type: 'string',
        description: 'The ID of the node to delete'
      }
    },
    required: ['nodeId']
  }
}

const DELETE_EDGE_TOOL: AgentToolDefinition = {
  name: 'delete_edge',
  description: 'Delete a connection between nodes',
  input_schema: {
    type: 'object',
    properties: {
      edgeId: {
        type: 'string',
        description: 'The ID of the edge to delete'
      }
    },
    required: ['edgeId']
  }
}

// -----------------------------------------------------------------------------
// Filesystem & Command Tools
// -----------------------------------------------------------------------------

const FILESYSTEM_READ_TOOLS: AgentToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns text content and total line count. Use startLine/endLine for large files.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative file path' },
        startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
        endLine: { type: 'number', description: 'End line (inclusive, optional)' }
      },
      required: ['path']
    }
  },
  {
    name: 'list_directory',
    description: 'List the contents of a directory. Returns file names, types (file/directory), and sizes.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' }
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Search for a regex pattern across files in a directory. Returns matching file paths, line numbers, and content snippets.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search in' },
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        fileGlob: { type: 'string', description: 'Optional file name filter (e.g., "*.ts")' }
      },
      required: ['path', 'pattern']
    }
  }
]

const FILESYSTEM_WRITE_TOOLS: AgentToolDefinition[] = [
  {
    name: 'write_file',
    description: 'Write content to a file, creating it and parent directories if needed. Overwrites existing content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write to' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Make a targeted edit to a file by replacing the first occurrence of an exact string with new content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to edit' },
        oldString: { type: 'string', description: 'Exact string to find (must match exactly)' },
        newString: { type: 'string', description: 'Replacement string' }
      },
      required: ['path', 'oldString', 'newString']
    }
  }
]

const COMMAND_TOOL: AgentToolDefinition = {
  name: 'execute_command',
  description: 'Execute a shell command with 60s timeout. Supports pipes, redirects, and env vars.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional, defaults to first allowed path)' }
    },
    required: ['command']
  }
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
            'A descriptive key for this memory (e.g., "project_root", "test_command", "coding_style"). Max 100 characters.'
        },
        value: {
          type: 'string',
          description: 'The information to remember. Max 10000 characters.'
        }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'get_memory',
    description: 'Retrieve a specific memory entry by key.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the memory entry to retrieve'
        }
      },
      required: ['key']
    }
  },
  {
    name: 'list_memories',
    description: 'List all stored memory entries with their keys and values.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'delete_memory',
    description: 'Delete a specific memory entry by key. Use this to remove outdated or incorrect memories.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key of the memory entry to delete'
        }
      },
      required: ['key']
    }
  }
]

// -----------------------------------------------------------------------------
// Context-Chain Path Derivation (Patent P2 Claim 5)
// -----------------------------------------------------------------------------

/**
 * Derive allowed filesystem paths from the agent's BFS context chain.
 * Traverses INBOUND + bidirectional edges (same as context injection),
 * finds artifact nodes with filePath properties, and extracts parent directories.
 *
 * This is the patented innovation (P2 Claim 5): spatial topology controls
 * agent permissions. Connect a folder artifact → agent can access that folder.
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
      (e) => e.target === currentId && (e.data as EdgeData | undefined)?.active !== false
    )
    // Follow bidirectional edges (currentId → target with direction: 'bidirectional')
    const bidirectional = edges.filter(
      (e) =>
        e.source === currentId &&
        (e.data as EdgeData | undefined)?.active !== false &&
        (e.data as EdgeData | undefined)?.direction === 'bidirectional'
    )

    const neighborIds = [
      ...inbound.map((e) => e.source),
      ...bidirectional.map((e) => e.target)
    ]

    for (const neighborId of neighborIds) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)

      const node = nodes.find((n) => n.id === neighborId)
      if (!node) continue

      // Check for artifact nodes with filesystem paths (Patent P2 Claim 5)
      if (node.data.type === 'artifact') {
        const data = node.data as ArtifactNodeData

        // Primary: file-drop artifacts have source.originalPath
        if (data.source?.type === 'file-drop' && data.source.originalPath) {
          const pathStr = data.source.originalPath
          const lastSep = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'))
          if (lastSep > 0) {
            paths.push(pathStr.substring(0, lastSep))
          }
          // Skip fallback — source.originalPath takes priority
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

export function getToolsForAgent(settings: AgentSettings, agentNodeId?: string): AgentToolDefinition[] {
  const tools = [...QUERY_TOOLS] // Always include query tools

  if (settings.canCreateNodes) {
    tools.push(CREATE_NODE_TOOL)
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
  if (!result.success || !result.tools) {
    return { tools: [], mcpToolServerMap }
  }

  const tools: AgentToolDefinition[] = result.tools.map(mcpTool => {
    // Prefix MCP tool names with server name to avoid collisions with canvas tools
    const prefixedName = `mcp_${mcpTool.serverId}_${mcpTool.name}`
    mcpToolServerMap.set(prefixedName, mcpTool.serverId)

    return {
      name: prefixedName,
      description: `[${mcpTool.serverName}] ${mcpTool.description}`,
      input_schema: mcpTool.inputSchema as AgentToolDefinition['input_schema']
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
// -----------------------------------------------------------------------------

export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  agentConversationId: string
): Promise<ToolExecutionResult> {
  const store = useWorkspaceStore.getState()

  try {
    switch (toolName) {
      case 'get_context': {
        const nodeId = (input.nodeId as string) || agentConversationId
        const context = store.getContextForNode(nodeId)
        return {
          success: true,
          result: { context: context || 'No context available.' }
        }
      }

      case 'find_nodes': {
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
          position: n.position
        }))

        return {
          success: true,
          result: { nodes: limited, total: results.length }
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
                  title: (node.data as NodeData & { title?: string }).title
                }
              : null
          })
          .filter(Boolean)
        return { success: true, result: { selectedNodes: selected } }
      }

      case 'get_node_details': {
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
              height: node.height
            }
          }
        }
      }

      case 'create_node': {
        const { type, title, content, description, position, connectTo } = input

        // Calculate position if not provided
        const agentNode = store.nodes.find((n) => n.id === agentConversationId)
        const finalPosition = (position as { x: number; y: number }) || {
          x: (agentNode?.position.x || 0) + 350,
          y: agentNode?.position.y || 0
        }

        const nodeId = store.addNode(type as NodeData['type'], finalPosition)

        // Update with additional data
        const updateData: Partial<NodeData> = { title } as Partial<NodeData>
        if (content) (updateData as { content?: string }).content = content as string
        if (description) (updateData as { description?: string }).description = description as string

        store.updateNode(nodeId, updateData)

        // Create edge if requested
        if (connectTo) {
          store.addEdge({
            source: connectTo as string,
            target: nodeId,
            sourceHandle: null,
            targetHandle: null
          })
        }

        return { success: true, result: { nodeId, title, type } }
      }

      case 'create_edge': {
        const { source, target, label } = input

        // Generate edge ID
        const edgeId = `${source}-${target}`

        store.addEdge({
          source: source as string,
          target: target as string,
          sourceHandle: null,
          targetHandle: null
        })

        if (label) {
          store.updateEdge(edgeId, { label: label as string })
        }

        return { success: true, result: { edgeId } }
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

      case 'delete_edge': {
        const { edgeId } = input
        store.deleteEdges([edgeId as string])
        return { success: true, result: { deleted: edgeId } }
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
            error: `Key exceeds maximum length of ${memory.maxKeyLength} characters (got ${keyStr.length})`
          }
        }

        if (valueStr.length > memory.maxValueLength) {
          return {
            success: false,
            error: `Value exceeds maximum length of ${memory.maxValueLength} characters (got ${valueStr.length})`
          }
        }

        // Upsert: update if key exists, create if not
        const existing = memory.entries.findIndex((e) => e.key === keyStr)
        const entry: MemoryEntry = {
          key: keyStr,
          value: valueStr,
          createdAt: existing >= 0 ? memory.entries[existing]!.createdAt : new Date().toISOString(),
          updatedAt: existing >= 0 ? new Date().toISOString() : undefined,
          source: 'agent'
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
          agentMemory: { ...memory, entries: newEntries }
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
            maxEntries: memory.maxEntries
          }
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
          agentMemory: { ...memory, entries: newEntries }
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
          input.endLine as number | undefined
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
          input.fileGlob as string | undefined
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
          allowedPaths
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
          allowedPaths
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
          input.cwd as string | undefined
        )
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
            error: result.error
          }
        }
        return { success: false, error: `Unknown tool: ${toolName}` }
      }
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
