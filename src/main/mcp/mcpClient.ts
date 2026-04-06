// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * MCP Client Manager — Cognograph consumes external MCP servers.
 *
 * Manages N concurrent MCP server connections via stdio transport.
 * Each connection has its own child process and tool discovery.
 *
 * Architecture:
 *   Renderer (agentTools.ts) ──IPC──> Main (mcpClient.ts) ──stdio──> MCP Server
 *
 * Lifecycle:
 *   connect(config) → discoverTools(id) → callTool(id, name, args) → disconnect(id)
 *
 * Limits (from spec):
 *   - Max 10 concurrent connections
 *   - 15s server startup timeout
 *   - 30s per tool call timeout
 *   - 500KB max tool result size
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ipcMain } from 'electron'
import { getSafeEnv, mergeSafeEnv } from '../utils/safeEnv'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
  serverName: string
}

export interface MCPToolCallResult {
  success: boolean
  result?: unknown
  error?: string
}

interface MCPConnection {
  id: string
  name: string
  client: Client
  transport: StdioClientTransport
  tools: MCPToolDefinition[]
  connectedAt: number
  // === Phase 1B additions — preserve across Phase 2 rewrite ===
  /** Original config for reconnection */
  config: MCPServerConfig
  // === end Phase 1B additions ===
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MAX_CONNECTIONS = 10
const CONNECT_TIMEOUT_MS = 15_000
const TOOL_CALL_TIMEOUT_MS = 30_000
const MAX_RESULT_SIZE = 500 * 1024 // 500KB

// === Phase 1B additions — preserve across Phase 2 rewrite ===
// Reconnect constants: 3 retries with exponential backoff (1s, 3s, 9s)
const RECONNECT_MAX_RETRIES = 3
const RECONNECT_BACKOFF_BASE_MS = 1_000
const RECONNECT_BACKOFF_MULTIPLIER = 3
// Circuit breaker: after 10 failures per session, stop retrying
const CIRCUIT_BREAKER_THRESHOLD = 10
// === end Phase 1B additions ===

// Allowlist of known-safe MCP server commands.
// Users can run Node/Python/npx scripts but not arbitrary shell commands.
const ALLOWED_MCP_COMMANDS = new Set([
  'node',
  'npx',
  'python',
  'python3',
  'uvx',
  'deno',
  'bun',
  // Common MCP server binaries
  'mcp-server-filesystem',
  'mcp-server-github',
  'mcp-server-slack',
  'mcp-server-sqlite',
  'mcp-server-brave-search',
])

/**
 * Validate an MCP server command for security.
 * - Command must be in allowlist OR be an absolute path to an existing file.
 * - Args must not contain shell metacharacters.
 */
function validateMCPCommand(command: string, args?: string[]): { valid: boolean; error?: string } {
  // Extract basename for allowlist check
  const basename =
    command.includes('/') || command.includes('\\') ? command.split(/[\\/]/).pop() || '' : command

  if (!ALLOWED_MCP_COMMANDS.has(basename) && !ALLOWED_MCP_COMMANDS.has(command)) {
    // Allow absolute paths (user-installed binaries) but log a warning
    const isAbsolutePath = command.startsWith('/') || /^[A-Z]:\\/i.test(command)
    if (!isAbsolutePath) {
      return {
        valid: false,
        error: `MCP command "${command}" is not in the allowed list. Allowed: ${[...ALLOWED_MCP_COMMANDS].join(', ')}`,
      }
    }
    console.warn(`[MCPClient] Running non-allowlisted absolute path: ${command}`)
  }

  // Block shell metacharacters in args
  if (args) {
    const shellMetachars = /[;&|`$(){}!<>]/
    for (const arg of args) {
      if (shellMetachars.test(arg)) {
        return {
          valid: false,
          error: `Shell metacharacters not allowed in MCP server args: "${arg}"`,
        }
      }
    }
  }

  return { valid: true }
}

// -----------------------------------------------------------------------------
// Connection State
// -----------------------------------------------------------------------------

const connections = new Map<string, MCPConnection>()

// === Phase 1B additions — preserve across Phase 2 rewrite ===

/** Per-server failure count for circuit breaker (resets on successful reconnect) */
const reconnectFailures = new Map<string, number>()
/** Servers where the circuit breaker has tripped — stops all reconnection */
const circuitBrokenServers = new Set<string>()
/** Track in-flight reconnection attempts to prevent re-entrancy */
const reconnectingServers = new Set<string>()

/**
 * Emit a notification to the renderer about MCP connection state changes.
 * Used for circuit-breaker alerts and reconnect status.
 */
function emitMCPEvent(event: string, data: Record<string, unknown>): void {
  try {
    const { BrowserWindow } = require('electron')
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send(event, data)
    }
  } catch {
    // Silently fail — window may not exist during shutdown
  }
}

/**
 * Attempt to reconnect a disconnected MCP server.
 * Uses exponential backoff: 1s, 3s, 9s.
 * Circuit breaker trips after 10 cumulative failures per session.
 */
async function attemptReconnect(config: MCPServerConfig): Promise<boolean> {
  const serverId = config.id

  // Guard: circuit breaker already tripped
  if (circuitBrokenServers.has(serverId)) {
    console.warn(`[MCPClient] Circuit breaker open for "${config.name}" — skipping reconnect`)
    return false
  }

  // Guard: already reconnecting
  if (reconnectingServers.has(serverId)) {
    return false
  }

  reconnectingServers.add(serverId)

  try {
    for (let attempt = 0; attempt < RECONNECT_MAX_RETRIES; attempt++) {
      const delayMs = RECONNECT_BACKOFF_BASE_MS * RECONNECT_BACKOFF_MULTIPLIER ** attempt
      console.log(
        `[MCPClient] Reconnect attempt ${attempt + 1}/${RECONNECT_MAX_RETRIES} for "${config.name}" (waiting ${delayMs}ms)`,
      )
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))

      // Clean up stale connection entry before reconnecting
      connections.delete(serverId)

      const result = await connectMCPServer(config)
      if (result.success) {
        console.log(
          `[MCPClient] Reconnected to "${config.name}" — ${result.tools?.length ?? 0} tools re-registered`,
        )
        // Reset failure count on success
        reconnectFailures.set(serverId, 0)
        emitMCPEvent('mcp:reconnected', { serverId, name: config.name, tools: result.tools })
        return true
      }

      // Increment failures
      const failures = (reconnectFailures.get(serverId) ?? 0) + 1
      reconnectFailures.set(serverId, failures)

      // Check circuit breaker
      if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBrokenServers.add(serverId)
        console.error(
          `[MCPClient] Circuit breaker tripped for "${config.name}" after ${failures} failures — no more reconnection attempts`,
        )
        emitMCPEvent('mcp:circuitBroken', {
          serverId,
          name: config.name,
          failures,
          message: `MCP server "${config.name}" failed to reconnect after ${failures} attempts. Automatic reconnection disabled.`,
        })
        return false
      }
    }

    console.warn(
      `[MCPClient] All ${RECONNECT_MAX_RETRIES} reconnect attempts failed for "${config.name}"`,
    )
    emitMCPEvent('mcp:reconnectFailed', { serverId, name: config.name })
    return false
  } finally {
    reconnectingServers.delete(serverId)
  }
}

/**
 * Install transport-level error/close handlers for automatic reconnection.
 * Called after a successful connection.
 */
function installReconnectHandlers(connection: MCPConnection): void {
  const { transport, config } = connection

  // StdioClientTransport emits 'close' when the child process exits
  transport.onerror = (error: Error) => {
    console.error(`[MCPClient] Transport error for "${config.name}":`, error.message)
  }

  transport.onclose = () => {
    // Only attempt reconnect if the connection is still in our map
    // (i.e., it wasn't an intentional disconnect)
    if (connections.has(config.id)) {
      console.warn(`[MCPClient] "${config.name}" disconnected unexpectedly — initiating reconnect`)
      // Remove stale connection
      connections.delete(config.id)
      // Fire-and-forget reconnect — errors are handled internally
      attemptReconnect(config).catch((err) => {
        console.error(`[MCPClient] Reconnect error for "${config.name}":`, err)
      })
    }
  }
}

/**
 * Reset the circuit breaker for a specific server, allowing reconnection again.
 */
export function resetCircuitBreaker(serverId: string): void {
  circuitBrokenServers.delete(serverId)
  reconnectFailures.delete(serverId)
  console.log(`[MCPClient] Circuit breaker reset for server ${serverId}`)
}

/**
 * Check whether the circuit breaker is currently open (tripped) for a server.
 */
export function isCircuitBroken(serverId: string): boolean {
  return circuitBrokenServers.has(serverId)
}

// === end Phase 1B additions ===

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Connect to an external MCP server via stdio transport.
 * Discovers tools immediately after connection.
 */
export async function connectMCPServer(config: MCPServerConfig): Promise<{
  success: boolean
  tools?: MCPToolDefinition[]
  error?: string
}> {
  if (connections.has(config.id)) {
    return { success: false, error: `Server "${config.name}" is already connected.` }
  }

  if (connections.size >= MAX_CONNECTIONS) {
    return { success: false, error: `Maximum of ${MAX_CONNECTIONS} MCP connections reached.` }
  }

  // Validate command before spawning process
  const cmdCheck = validateMCPCommand(config.command, config.args)
  if (!cmdCheck.valid) {
    return { success: false, error: cmdCheck.error }
  }

  let transport: StdioClientTransport | null = null
  let client: Client | null = null

  try {
    const env = mergeSafeEnv(getSafeEnv(), config.env || {})

    transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env,
    })

    client = new Client({
      name: 'cognograph-agent',
      version: '1.0.0',
    })

    // Connect with timeout
    const connectPromise = client.connect(transport)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Connection timed out after ${CONNECT_TIMEOUT_MS / 1000} seconds`)),
        CONNECT_TIMEOUT_MS,
      ),
    )
    await Promise.race([connectPromise, timeoutPromise])

    // Discover tools
    const tools = await discoverToolsFromClient(client, config.id, config.name)

    const connection: MCPConnection = {
      id: config.id,
      name: config.name,
      client,
      transport,
      tools,
      connectedAt: Date.now(),
      config, // Phase 1B: store for reconnection
    }

    connections.set(config.id, connection)

    // === Phase 1B additions — preserve across Phase 2 rewrite ===
    // Install reconnect handlers for automatic recovery on unexpected disconnect
    installReconnectHandlers(connection)
    // === end Phase 1B additions ===

    console.log(`[MCPClient] Connected to "${config.name}" — ${tools.length} tools discovered`)

    return { success: true, tools }
  } catch (error) {
    // Clean up on failure
    try {
      if (client) await client.close()
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (transport) await transport.close()
    } catch {
      // Ignore cleanup errors
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[MCPClient] Failed to connect to "${config.name}":`, message)

    if (message.includes('ENOENT') || message.includes('not found')) {
      return { success: false, error: `Command not found: ${config.command}` }
    }
    if (message.includes('EACCES') || message.includes('permission')) {
      return { success: false, error: `Permission denied: ${config.command}` }
    }
    return { success: false, error: message }
  }
}

/**
 * Disconnect from an MCP server and clean up its child process.
 */
export async function disconnectMCPServer(serverId: string): Promise<{
  success: boolean
  error?: string
}> {
  const connection = connections.get(serverId)
  if (!connection) {
    return { success: false, error: `No connection found for server ID: ${serverId}` }
  }

  try {
    await connection.client.close()
  } catch {
    // Ignore close errors — process may already be dead
  }

  try {
    await connection.transport.close()
  } catch {
    // Ignore transport close errors
  }

  connections.delete(serverId)
  console.log(`[MCPClient] Disconnected from "${connection.name}"`)

  return { success: true }
}

/**
 * Disconnect all connected MCP servers. Called on app shutdown.
 */
export async function disconnectAllMCPServers(): Promise<void> {
  const serverIds = [...connections.keys()]
  for (const id of serverIds) {
    await disconnectMCPServer(id)
  }
}

/**
 * Get the discovered tools for a specific MCP server.
 */
export function getMCPServerTools(serverId: string): MCPToolDefinition[] {
  const connection = connections.get(serverId)
  return connection?.tools ?? []
}

/**
 * Get tools from multiple MCP servers by their IDs.
 * Used by agent tool assembly to merge MCP tools into agent tool list.
 */
export function getMCPToolsForServers(serverIds: string[]): MCPToolDefinition[] {
  const tools: MCPToolDefinition[] = []
  for (const id of serverIds) {
    const connection = connections.get(id)
    if (connection) {
      tools.push(...connection.tools)
    }
  }
  return tools
}

/**
 * Call a tool on a connected MCP server.
 */
export async function callMCPTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<MCPToolCallResult> {
  const connection = connections.get(serverId)
  if (!connection) {
    return { success: false, error: `MCP server "${serverId}" is not connected.` }
  }

  try {
    const callPromise = connection.client.callTool({ name: toolName, arguments: args })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tool call timed out after ${TOOL_CALL_TIMEOUT_MS / 1000} seconds`)),
        TOOL_CALL_TIMEOUT_MS,
      ),
    )

    const result = await Promise.race([callPromise, timeoutPromise])

    // Extract text content from MCP tool result
    const textContent = extractTextFromResult(result)

    // Truncate if too large
    if (textContent.length > MAX_RESULT_SIZE) {
      return {
        success: true,
        result:
          textContent.slice(0, MAX_RESULT_SIZE) +
          `\n... [result truncated, ${textContent.length} bytes total]`,
      }
    }

    return { success: true, result: textContent }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[MCPClient] Tool call "${toolName}" on "${connection.name}" failed:`, message)
    return { success: false, error: message }
  }
}

/**
 * List all currently connected MCP servers and their status.
 */
export function listMCPConnections(): Array<{
  id: string
  name: string
  toolCount: number
  connectedAt: number
}> {
  return [...connections.values()].map((conn) => ({
    id: conn.id,
    name: conn.name,
    toolCount: conn.tools.length,
    connectedAt: conn.connectedAt,
  }))
}

/**
 * Check if a specific MCP server is connected.
 */
export function isMCPServerConnected(serverId: string): boolean {
  return connections.has(serverId)
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

async function discoverToolsFromClient(
  client: Client,
  serverId: string,
  serverName: string,
): Promise<MCPToolDefinition[]> {
  try {
    const result = await client.listTools()
    return (result.tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {
        type: 'object',
        properties: {},
      },
      serverId,
      serverName,
    }))
  } catch {
    // Server may not support tools listing — return empty
    console.warn(`[MCPClient] "${serverName}" does not support tool listing`)
    return []
  }
}

function extractTextFromResult(result: unknown): string {
  if (typeof result === 'string') return result

  // MCP tool results have a content array with type/text objects
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as { content: unknown[] }).content
    if (Array.isArray(content)) {
      return content
        .map((block) => {
          if (typeof block === 'object' && block !== null && 'text' in block) {
            return String((block as { text: unknown }).text)
          }
          if (typeof block === 'string') return block
          return JSON.stringify(block)
        })
        .join('\n')
    }
  }

  return JSON.stringify(result, null, 2)
}

// -----------------------------------------------------------------------------
// IPC Handlers — Register with Electron main process
// -----------------------------------------------------------------------------

export function registerMCPClientHandlers(): void {
  ipcMain.handle('mcp:connect', async (_event, config: MCPServerConfig) => {
    return connectMCPServer(config)
  })

  ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
    return disconnectMCPServer(serverId)
  })

  ipcMain.handle('mcp:discoverTools', async (_event, serverId: string) => {
    const tools = getMCPServerTools(serverId)
    return { success: true, tools }
  })

  ipcMain.handle(
    'mcp:callTool',
    async (_event, serverId: string, toolName: string, args: Record<string, unknown>) => {
      return callMCPTool(serverId, toolName, args)
    },
  )

  ipcMain.handle('mcp:listConnections', async () => {
    return { success: true, connections: listMCPConnections() }
  })

  ipcMain.handle('mcp:getToolsForServers', async (_event, serverIds: string[]) => {
    const tools = getMCPToolsForServers(serverIds)
    return { success: true, tools }
  })

  // === Phase 1B additions — preserve across Phase 2 rewrite ===
  ipcMain.handle('mcp:resetCircuitBreaker', async (_event, serverId: string) => {
    resetCircuitBreaker(serverId)
    return { success: true }
  })

  ipcMain.handle('mcp:isCircuitBroken', async (_event, serverId: string) => {
    return { broken: isCircuitBroken(serverId) }
  })
  // === end Phase 1B additions ===
}
