// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { type Options, query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import Anthropic from '@anthropic-ai/sdk'
import { execFile, spawn } from 'child_process'
import { BrowserWindow, ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'
import { promisify } from 'util'
import { callMCPTool, getMCPToolsForServers, listMCPConnections } from '../mcp/mcpClient'
import { getSetting } from '../settings'
import { assembleToolPool } from '../tools/assembleToolPool'
import type { BuiltinToolDeps } from '../tools/builtinTools'
import { createBuiltinTools } from '../tools/builtinTools'
import { adaptMCPTools } from '../tools/mcpToolAdapter'
import type { ToolPool } from '../tools/types'
import { logger } from '../utils/logger'
import {
  editFile as fsEditFile,
  executeCommand as fsExecuteCommand,
  listDirectory as fsListDirectory,
  readFile as fsReadFile,
  searchFiles as fsSearchFiles,
  writeFile as fsWriteFile,
  getSecurityContext,
} from './filesystemTools'
// === Phase 1B additions — preserve across Phase 2 rewrite ===
import { classifyLLMError } from './llmErrors'
import {
  createCognographSdkServer,
  executeInRenderer,
  getCurrentConversationId,
  setCurrentConversationId,
  setSdkToolPool,
} from './sdkTools'
// === end Phase 1B additions ===

// === Phase 3A additions — context budget enforcement ===
import {
  clearContextErrorState,
  contextBudget,
  MAX_CONTEXT_RETRIES,
  recordContextError,
} from './contextBudget'
import { estimateTokens } from './tokenEstimation'

// === end Phase 3A additions ===

export type { AgentLoopConfig, AgentLoopEvent, AgentLoopResult } from './agentLoop'
// === Phase 2B additions — agent loop + tool executor ===
export { runAgentWithToolLoop } from './agentLoop'

// === end Phase 2B additions ===

import { runAgentWithToolLoop as _runAgentLoop } from './agentLoop'
// === Phase B1 additions — event bridge + agentLoop wiring ===
import { bridgeEventToIPC } from './eventBridge'

// === end Phase B1 additions ===

const execFileAsync = promisify(execFile)

// === Phase 1B additions — preserve across Phase 2 rewrite ===
/** Default max_tokens for API calls */
const DEFAULT_MAX_TOKENS = 8192
/** Escalation multiplier when response is truncated (stop_reason: max_tokens) */
const ESCALATION_MULTIPLIER = 4
/** Absolute ceiling for escalated max_tokens */
const MAX_TOKENS_CEILING = 64_000
// === end Phase 1B additions ===

// Types for agent requests
interface MemoryEntry {
  key: string
  value: string
  createdAt: string
  updatedAt?: string
  source: 'agent' | 'user'
}

interface AgentMemory {
  entries: MemoryEntry[]
  maxEntries: number
  maxKeyLength: number
  maxValueLength: number
}

interface AgentRequestPayload {
  requestId: string
  conversationId: string
  messages: Array<{ role: string; content: unknown }>
  context: string
  tools: Anthropic.Tool[]
  model?: string
  maxTokens?: number
  memory?: AgentMemory
  systemPromptPrefix?: string
}

type AgentStreamChunk =
  | {
      requestId: string
      conversationId: string
      type: 'text_delta'
      content: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_start'
      toolUseId: string
      toolName: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_delta'
      toolUseId: string
      toolInput: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'tool_use_end'
      toolUseId: string
    }
  | {
      requestId: string
      conversationId: string
      type: 'done'
      stopReason: string
      usage?: {
        input_tokens: number
        output_tokens: number
        cache_creation_input_tokens?: number
        cache_read_input_tokens?: number
      }
    }
  | {
      requestId: string
      conversationId: string
      type: 'error'
      error: string
    }

interface EncryptedKeys {
  anthropic?: string
  gemini?: string
  openai?: string
}

interface ActiveRequest {
  controller: AbortController
  conversationId: string
}

const store = new Store()
const activeRequests = new Map<string, ActiveRequest>()
let anthropicClient: Anthropic | null = null
let lastApiKey: string | null = null

// ---------------------------------------------------------------------------
// Phase B1: Abort all active requests (called from before-quit handler)
// ---------------------------------------------------------------------------

/**
 * Abort all active agent requests. Called during app shutdown to ensure
 * no orphaned streaming connections survive after the window closes.
 */
export function abortAllRequests(): void {
  for (const [, req] of activeRequests) {
    req.controller.abort(new Error('App quitting'))
  }
  activeRequests.clear()
}

// ---------------------------------------------------------------------------
// Context refresh IPC — C-FIX-3
// ---------------------------------------------------------------------------

/** Pending context requests, keyed by requestId */
const pendingContextRequests = new Map<string, (ctx: string) => void>()

// Permanent listener — registered once at module load
ipcMain.on('context:response', (_event, data: { requestId: string; context: string }) => {
  const resolve = pendingContextRequests.get(data.requestId)
  if (!resolve) return
  pendingContextRequests.delete(data.requestId)
  resolve(data.context)
})

/**
 * Request the current BFS context for a conversation from the renderer.
 *
 * Round-trip: main sends 'context:request' → renderer calls getContextForNode →
 * renderer sends 'context:response'. Resolves within 5s or returns fallback string.
 *
 * Used by agentLoop's onTurnEnd to refresh system prompt after mutating tool calls.
 */
export async function getContextForConversation(conversationId: string): Promise<string> {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return 'No connected context.'

  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timeout = setTimeout(() => {
      pendingContextRequests.delete(requestId)
      resolve('No connected context.')
    }, 5000)

    pendingContextRequests.set(requestId, (ctx) => {
      clearTimeout(timeout)
      resolve(ctx)
    })

    win.webContents.send('context:request', { requestId, conversationId })
  })
}

// ---------------------------------------------------------------------------
// API-path BuiltinToolDeps factory
// ---------------------------------------------------------------------------

/**
 * Create BuiltinToolDeps for the API path (agentLoop).
 *
 * Wires:
 * - executeInRenderer → shared sdk-tool-call/sdk-tool-result IPC channels
 *   (renderer-side sdkToolBridge.ts handles and calls executeTool)
 * - getCurrentConversationId → sdkTools module-level current conversation
 * - filesystem ops → filesystemTools.ts (symlink-safe, permission-checked)
 * - getSecurityContext → cached workspace security context (includes trustedSymlinkTargets)
 *
 * H-FIX-5: Canvas tools stay in renderer by design — they need Zustand store
 * access. The IPC round-trip (main → renderer → main) is the bridge.
 */
export function createApiPathBuiltinToolDeps(): BuiltinToolDeps {
  return {
    executeInRenderer,
    getCurrentConversationId,

    readFile: (path, allowedPaths, startLine, endLine) => {
      const ctx = getSecurityContext()
      return fsReadFile(path, allowedPaths, startLine, endLine, ctx.trustedSymlinkTargets)
    },

    writeFile: (path, content, allowedPaths) => {
      const ctx = getSecurityContext()
      return fsWriteFile(path, content, allowedPaths, ctx.trustedSymlinkTargets)
    },

    editFile: (path, oldString, newString, allowedPaths) => {
      const ctx = getSecurityContext()
      return fsEditFile(path, oldString, newString, allowedPaths, ctx.trustedSymlinkTargets)
    },

    listDirectory: (path, allowedPaths) => {
      const ctx = getSecurityContext()
      return fsListDirectory(path, allowedPaths, ctx.trustedSymlinkTargets)
    },

    searchFiles: (path, pattern, allowedPaths, fileGlob) => {
      const ctx = getSecurityContext()
      return fsSearchFiles(path, pattern, allowedPaths, fileGlob, ctx.trustedSymlinkTargets)
    },

    executeCommand: (command, allowedPaths, allowedCommands, cwd) => {
      const ctx = getSecurityContext()
      return fsExecuteCommand(
        command,
        allowedPaths,
        allowedCommands,
        cwd,
        undefined,
        ctx.trustedSymlinkTargets,
      )
    },

    getSecurityContext: () => {
      const ctx = getSecurityContext()
      return { allowedPaths: ctx.allowedPaths, allowedCommands: ctx.allowedCommands }
    },
  }
}

/**
 * Assemble the active ToolPool for an agentLoop call.
 *
 * Merges builtin tools (canvas + filesystem + memory) with tools from all
 * currently-connected MCP servers. MCP tools win on name collision.
 *
 * Called once per agent:sendWithTools request — snapshot of connected servers
 * at request time. Stale pools (after MCP reconnect) are addressed in Phase F.
 */
export function getActiveToolPool(builtinDeps: BuiltinToolDeps): ToolPool {
  const builtins = createBuiltinTools(builtinDeps)

  // Get all active MCP server IDs and their tool definitions
  const connections = listMCPConnections()
  const serverIds = connections.map((c) => c.id)
  const mcpToolDefs = getMCPToolsForServers(serverIds)

  // Adapt MCP tool definitions to canonical Tool objects bound to callMCPTool
  const mcpTools = adaptMCPTools(mcpToolDefs, callMCPTool)

  return assembleToolPool(builtins, mcpTools)
}

// Get API key from encrypted store (replicates llm.ts pattern)
function getApiKey(provider: string): string | null {
  try {
    const encryptedKeys = store.get('encryptedApiKeys', {}) as EncryptedKeys
    const encrypted = encryptedKeys[provider as keyof EncryptedKeys]

    if (!encrypted) {
      return null
    }

    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64')
      return safeStorage.decryptString(buffer)
    }
    return encrypted
  } catch (error) {
    console.error(`[Agent:getApiKey] Error decrypting key:`, error)
    return null
  }
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] || null
}

function sendStreamChunk(chunk: AgentStreamChunk): void {
  const mainWindow = getMainWindow()
  if (mainWindow) {
    mainWindow.webContents.send('agent:stream', chunk)
  }
}

function buildAgentSystemPrompt(
  context: string,
  memory?: AgentMemory,
  promptPrefix?: string,
): string {
  // Build memory section if entries exist
  let memorySection = ''
  if (memory && memory.entries.length > 0) {
    const memoryLines = memory.entries.map((e) => `- **${e.key}**: ${e.value}`).join('\n')
    memorySection = `\n\n## Your Memory\nThe following are facts you've stored from previous runs:\n\n${memoryLines}\n\nUse add_memory to update or add new memories as you learn things. Use delete_memory to remove outdated entries.`
  }

  // promptPrefix goes BEFORE the default system prompt.
  // This allows presets to establish persona/role/context before
  // the standard agent instructions.
  const prefix = promptPrefix ? promptPrefix + '\n\n' : ''

  return `${prefix}You are an AI assistant integrated into Cognograph, a spatial AI workflow canvas application. You have access to tools that let you manipulate the user's workspace.

## Your Capabilities
You have access to these tools:

### Canvas Tools
- **create_node** — Create nodes (note, task, conversation, text, project, artifact, orchestrator)
- **update_node** — Update node properties (title, content, status, priority, tags, color, etc.)
- **move_node** — Move a node to a new position on the canvas
- **link_nodes** — Create a connection (edge) between two nodes
- **unlink_nodes** — Remove a connection between two nodes
- **add_comment** — Append a timestamped comment to a node

### Query Tools
- **get_node** — Get full details of a node by ID
- **search_nodes** — Search nodes by title/content with optional type filter
- **get_initial_context** — Get full canvas context via BFS traversal from your node
- **get_context_chain** — Get incoming-edge context chain up to a specified depth
- **get_todos** — Get task nodes with optional filters (status, priority, tags, project)
- **get_selection** — Get currently selected nodes

### Tools That Do NOT Exist
You cannot: rename edges, undo actions, or export files. If asked, explain the limitation and suggest alternatives (e.g., unlink + re-link for edge rename).

## Current Context
The following context has been gathered from nodes connected to this conversation:

${context || 'No connected context.'}
${memorySection}

## Guidelines
1. When the user asks you to modify their workspace, use the appropriate tools
2. After making changes, briefly confirm what you did
3. If you're unsure about what to change, ask for clarification
4. Be mindful of the user's workspace organization
5. When creating new nodes, position them sensibly relative to existing content
6. When creating artifact nodes with HTML content, ALWAYS set contentType: "html" so the content renders as a visual web page preview. For code snippets, use contentType: "code". For plain text, use "text" (default).
7. ALWAYS use batch_create when creating 2+ nodes. Put ALL nodes AND ALL edges in a SINGLE batch_create call. Never split across multiple tool calls.

## Important
- Only use tools when the user explicitly asks you to modify the workspace
- For general questions or conversation, just respond normally without tools
- If a tool call returns an error, explain what went wrong and suggest alternatives`
}

// ---------------------------------------------------------------------------
// Agent SDK local mode (uses Claude CLI / Pro subscription instead of API key)
// ---------------------------------------------------------------------------

// Resolve claude binary path — Electron's main process may not have npm global bin in PATH
// On Windows, .cmd files can't be spawned directly by the Agent SDK (EINVAL error).
// Point to the actual JS entry point instead.
function findClaudeBinary(): string {
  const { join } = require('path')
  const fs = require('fs')

  // On Windows, find the actual JS entry point (not the .cmd wrapper)
  if (process.platform === 'win32') {
    const npmGlobal = join(process.env.APPDATA || '', 'npm')
    const jsEntry = join(npmGlobal, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    try {
      fs.accessSync(jsEntry)
      return jsEntry
    } catch {}
    // Also check local node_modules
    const localEntry = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    try {
      fs.accessSync(localEntry)
      return localEntry
    } catch {}
  }

  const candidates = [
    join(process.env.HOME || '', '.npm-global', 'bin', 'claude'), // custom npm prefix
    join(process.env.HOME || '', '.local', 'bin', 'claude'), // Linux/Mac local
    '/usr/local/bin/claude', // Mac homebrew
    'claude', // system PATH fallback
  ]
  for (const candidate of candidates) {
    if (candidate && candidate !== 'claude') {
      try {
        fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      } catch {}
    }
  }
  return 'claude'
}

// Cache the SDK server (reusable across requests)
// Do NOT cache — each query() connects to the server, and a second connect crashes
// with "Already connected to a transport". Create fresh per request.

async function handleAgentSDKRequest(payload: AgentRequestPayload): Promise<void> {
  const { requestId, conversationId, messages, context, systemPromptPrefix } = payload

  // Fresh server per request — SDK connects on each query() and can't reconnect
  const sdkServer = createCognographSdkServer()

  // Set conversation context so MCP tools know which conversation to operate on
  setCurrentConversationId(conversationId)

  const systemPrompt = buildAgentSystemPrompt(context, undefined, systemPromptPrefix)

  // Extract last user message as the prompt
  const lastUserMsg = messages.filter((m) => m.role === 'user').pop()
  const prompt =
    typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? (lastUserMsg.content as Array<{ text?: string }>).map((b) => b.text || '').join('\n')
        : ''

  // Session resumption for multi-turn context
  const existingSessionId = store.get(`sdkSession:${conversationId}`) as string | undefined

  // Resolve claude binary — Electron's PATH may not include npm global bin
  const claudePath = findClaudeBinary()

  const options: Options = {
    systemPrompt,
    mcpServers: { cognograph_canvas: sdkServer },
    maxTurns: 25,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    model: (payload.model as string) || 'claude-sonnet-4-6',
    pathToClaudeCodeExecutable: claudePath,
    // Restrict to only our MCP tools — use allowedTools to whitelist
    // Do NOT set tools:[] — that disables MCP tools too
    allowedTools: [
      'mcp__cognograph_canvas__create_node',
      'mcp__cognograph_canvas__batch_create',
      'mcp__cognograph_canvas__update_node',
      'mcp__cognograph_canvas__link_nodes',
      'mcp__cognograph_canvas__search_nodes',
      'mcp__cognograph_canvas__get_initial_context',
      'mcp__cognograph_canvas__get_context_chain',
      'mcp__cognograph_canvas__get_selection',
    ],
    ...(existingSessionId ? { resume: existingSessionId } : {}),
  }

  const controller = new AbortController()
  activeRequests.set(requestId, { controller, conversationId })

  try {
    const q = query({ prompt, options: { ...options, abortController: controller } })

    for await (const msg of q) {
      if (controller.signal.aborted) {
        sendStreamChunk({ requestId, conversationId, type: 'done', stopReason: 'cancelled' })
        break
      }

      // Store session ID for future resumption — extract OUTSIDE the msg.type check
      // so it's captured regardless of message type (session_id appears on all messages)
      if ((msg as any).session_id && !existingSessionId) {
        store.set(`sdkSession:${conversationId}`, (msg as any).session_id)
      }

      // Forward assistant text to renderer
      if (msg.type === 'assistant') {
        for (const block of (msg as any).message.content) {
          if (block.type === 'text') {
            sendStreamChunk({
              requestId,
              conversationId,
              type: 'text_delta',
              content: block.text,
            })
          }
        }
      }

      // Forward completion
      if (msg.type === 'result') {
        const resultMsg = msg as any

        sendStreamChunk({
          requestId,
          conversationId,
          type: 'done',
          stopReason:
            resultMsg.subtype === 'success' ? resultMsg.stop_reason || 'end_turn' : 'error',
          usage: resultMsg.usage
            ? {
                input_tokens: resultMsg.usage.input_tokens,
                output_tokens: resultMsg.usage.output_tokens,
              }
            : undefined,
        })
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      sendStreamChunk({ requestId, conversationId, type: 'done', stopReason: 'cancelled' })
    } else {
      const message = error.message || 'Unknown Agent SDK error'
      const isCliMissing = error.code === 'ENOENT' || message.includes('claude')
      sendStreamChunk({
        requestId,
        conversationId,
        type: 'error',
        error: isCliMissing
          ? 'Claude CLI not found. Install from claude.ai/code or disable "Use Claude Pro" in settings.'
          : message,
      })
    }
  } finally {
    activeRequests.delete(requestId)
  }
}

// Process Anthropic stream events into our chunk format
function processStreamEvent(
  requestId: string,
  conversationId: string,
  event: Anthropic.MessageStreamEvent,
  currentToolUseId: { value: string | null },
): AgentStreamChunk | null {
  switch (event.type) {
    case 'content_block_start':
      if (event.content_block.type === 'tool_use') {
        currentToolUseId.value = event.content_block.id
        return {
          requestId,
          conversationId,
          type: 'tool_use_start',
          toolUseId: event.content_block.id,
          toolName: event.content_block.name,
        }
      }
      return null

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        return {
          requestId,
          conversationId,
          type: 'text_delta',
          content: event.delta.text,
        }
      }
      if (event.delta.type === 'input_json_delta') {
        return {
          requestId,
          conversationId,
          type: 'tool_use_delta',
          toolUseId: currentToolUseId.value || '',
          toolInput: event.delta.partial_json,
        }
      }
      return null

    case 'content_block_stop':
      if (currentToolUseId.value) {
        const chunk: AgentStreamChunk = {
          requestId,
          conversationId,
          type: 'tool_use_end',
          toolUseId: currentToolUseId.value,
        }
        currentToolUseId.value = null
        return chunk
      }
      return null

    default:
      return null
  }
}

/**
 * Run an agent for the orchestrator (main-process direct call, no IPC).
 * Returns a structured result with token usage and output text.
 * Used by orchestratorService.ts to bridge the strategy engine to real LLM calls.
 */
export async function runAgentForOrchestrator(opts: {
  agentNodeId: string
  context: string
  prompt: string
  tools?: Anthropic.Tool[]
  model?: string
  maxTokens?: number
  previousOutput?: string
  abortSignal?: AbortSignal
}): Promise<{
  status: 'completed' | 'failed'
  output: string
  error?: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  toolCallCount: number
}> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    return {
      status: 'failed',
      output: '',
      error: 'No Anthropic API key configured.',
      inputTokens: 0,
      outputTokens: 0,
      toolCallCount: 0,
    }
  }

  if (!anthropicClient || lastApiKey !== apiKey) {
    anthropicClient = new Anthropic({ apiKey })
    lastApiKey = apiKey
  }

  // Build context including previous agent output for chaining
  let fullContext = opts.context || 'No connected context.'
  if (opts.previousOutput) {
    fullContext += `\n\n## Previous Agent Output\n${opts.previousOutput}`
  }

  const systemPrompt = buildAgentSystemPrompt(fullContext)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.prompt }]

  try {
    const stream = await anthropicClient.messages.stream(
      {
        model: opts.model || 'claude-sonnet-4-6',
        max_tokens: opts.maxTokens || 64000,
        system: systemPrompt,
        messages,
        tools: opts.tools && opts.tools.length > 0 ? opts.tools : undefined,
      },
      {
        signal: opts.abortSignal,
      },
    )

    // Collect the full response text
    let outputText = ''
    let toolCallCount = 0

    for await (const event of stream) {
      if (opts.abortSignal?.aborted) break

      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolCallCount++
      }
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        outputText += event.delta.text
      }
    }

    const finalMessage = await stream.finalMessage()
    const usage = finalMessage.usage

    return {
      status: 'completed',
      output: outputText,
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
      cacheCreationTokens: (usage as any)?.cache_creation_input_tokens,
      cacheReadTokens: (usage as any)?.cache_read_input_tokens,
      toolCallCount,
    }
  } catch (error) {
    const message = (error as Error).message || 'Unknown error'
    if ((error as Error).name === 'AbortError') {
      return {
        status: 'failed',
        output: '',
        error: 'Agent run was cancelled.',
        inputTokens: 0,
        outputTokens: 0,
        toolCallCount: 0,
      }
    }
    return {
      status: 'failed',
      output: '',
      error: message,
      inputTokens: 0,
      outputTokens: 0,
      toolCallCount: 0,
    }
  }
}

export function registerAgentHandlers(): void {
  // Handle agent requests with tool use
  ipcMain.handle('agent:sendWithTools', async (_event, payload: AgentRequestPayload) => {
    // Route to Agent SDK if user has "Use Claude Pro account" enabled
    const useAgentSDK = getSetting('useClaudeProAccount') === true
    logger.debug(
      `[Agent] useClaudeProAccount=${useAgentSDK} (routing to ${useAgentSDK ? 'Agent SDK' : 'API'})`,
    )
    if (useAgentSDK) {
      return handleAgentSDKRequest(payload)
    }

    const {
      requestId,
      conversationId,
      messages,
      context,
      tools,
      model,
      maxTokens,
      memory,
      systemPromptPrefix,
    } = payload

    logger.debug(`[Agent] Received request ${requestId} for conversation ${conversationId}`)
    logger.debug(`[Agent] Tools count: ${tools.length}, Messages count: ${messages.length}`)

    // === B3: Duplicate conversation guard ===
    // Reject the request if there is already an active request for this conversation.
    // This prevents race conditions where two requests share the same conversationId
    // and would both try to append to the same message thread.
    const existingRequest = [...activeRequests.values()].find(
      (r) => r.conversationId === conversationId,
    )
    if (existingRequest) {
      sendStreamChunk({
        requestId,
        conversationId,
        type: 'error',
        error: 'A request is already running for this conversation. Please wait or cancel it.',
      })
      return
    }
    // === end B3 ===

    // === Phase 1B additions — preserve across Phase 2 rewrite ===
    // 1.5c: Pre-persist user message before API call for crash safety.
    // If the process crashes mid-stream, the user's message survives.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMessage) {
      try {
        const pendingKey = `pendingUserMessage:${conversationId}`
        store.set(pendingKey, {
          conversationId,
          message: lastUserMessage,
          timestamp: Date.now(),
          requestId,
        })
        logger.debug(`[Agent] Pre-persisted user message for conversation ${conversationId}`)
      } catch (persistError) {
        // Non-fatal: log but continue — losing the message on crash
        // is better than failing the entire request
        logger.warn(`[Agent] Failed to pre-persist user message:`, persistError)
      }
    }
    // === end Phase 1B additions (1.5c) ===

    // Get API key
    const apiKey = getApiKey('anthropic')
    if (!apiKey) {
      sendStreamChunk({
        requestId,
        conversationId,
        type: 'error',
        error: 'No Anthropic API key configured. Please set your API key in settings.',
      })
      return
    }

    // Initialize client if needed, or recreate if API key changed
    if (!anthropicClient || lastApiKey !== apiKey) {
      anthropicClient = new Anthropic({ apiKey })
      lastApiKey = apiKey
    }

    // Create abort controller for this request
    const controller = new AbortController()
    activeRequests.set(requestId, { controller, conversationId })

    // Track current tool use for streaming
    const currentToolUseId = { value: null as string | null }

    try {
      // Build system prompt with context, memory, and preset prefix
      const systemPrompt = buildAgentSystemPrompt(context, memory, systemPromptPrefix)

      logger.debug(`[Agent] Starting stream with model: ${model || 'claude-sonnet-4-6'}`)

      // === Phase 3A additions — context budget check ===
      const estimatedContextTokens =
        estimateTokens(systemPrompt) + estimateTokens(JSON.stringify(messages))
      contextBudget.trackConversation(conversationId, estimatedContextTokens)

      // Check if this conversation is frozen (budget exceeded)
      if (contextBudget.isFrozen(conversationId)) {
        sendStreamChunk({
          requestId,
          conversationId,
          type: 'error',
          error:
            'This conversation has been frozen due to aggregate context budget limits. Please close some conversations and try again.',
        })
        return
      }

      // Check aggregate budget
      const budgetCheck = contextBudget.checkBudget(conversationId, estimatedContextTokens)
      if (!budgetCheck.allowed) {
        logger.warn(`[Agent] Budget check failed: ${budgetCheck.reason}`)
        sendStreamChunk({
          requestId,
          conversationId,
          type: 'error',
          error: budgetCheck.reason || 'Context budget exceeded.',
        })
        return
      }

      if (budgetCheck.frozenCount > 0) {
        logger.debug(
          `[Agent] Budget enforcement froze ${budgetCheck.frozenCount} conversation(s). ` +
            `Aggregate: ${budgetCheck.aggregateTokens} tokens.`,
        )
      }
      // === end Phase 3A additions ===

      // === Phase B1: Feature flag — agentLoop vs inline streaming ===
      // H-FIX-1: AGENT_LOOP_ENABLED defaults to true. Set to 'false' to fall
      // back to the original inline streaming path for debugging.
      if (process.env.AGENT_LOOP_ENABLED !== 'false') {
        // ---------------------------------------------------------------
        // NEW PATH: delegate to runAgentWithToolLoop
        // ---------------------------------------------------------------
        const mainWindow = getMainWindow()
        if (!mainWindow) throw new Error('No main window available')

        const builtinDeps = createApiPathBuiltinToolDeps()
        const toolPool = getActiveToolPool(builtinDeps)

        const effectiveMaxTokens = maxTokens || DEFAULT_MAX_TOKENS

        const result = await _runAgentLoop({
          client: anthropicClient,
          model: model || 'claude-sonnet-4-6',
          systemPrompt,
          messages: messages as Anthropic.MessageParam[],
          toolPool,
          executionContext: {
            workspaceId: conversationId, // conversation acts as workspace scope
            conversationId,
            allowedPaths: [],
            messages: messages as Anthropic.MessageParam[],
            activeMcpServerIds: [],
            metadata: {},
          },
          maxTokens: effectiveMaxTokens,
          signal: controller.signal,
          onEvent: (event) => bridgeEventToIPC(event, requestId, conversationId, mainWindow),
          onTurnEnd: async ({ lastToolCalls }) => {
            // Refresh BFS context if any mutating tool was called (Final-21)
            const MUTATING = [
              'create_node',
              'link_nodes',
              'update_node',
              'delete_node',
              'unlink_nodes',
              'move_node',
              'batch_create',
            ]
            if (lastToolCalls.some((c) => MUTATING.includes(c.name))) {
              const freshContext = await getContextForConversation(conversationId)
              return {
                systemPrompt: buildAgentSystemPrompt(freshContext, memory, systemPromptPrefix),
              }
            }
          },
        })

        // C-FIX-1: Send done chunk AFTER the loop returns — without this,
        // chatToolService hangs forever waiting for the done signal.
        sendStreamChunk({
          requestId,
          conversationId,
          type: 'done',
          stopReason: result.stopReason,
          usage: result.usage,
        })

        // Clear pre-persisted message on successful completion
        try {
          store.delete(`pendingUserMessage:${conversationId}`)
        } catch {
          // Non-fatal
        }

        // Clear error state + update budget tracker with actual usage
        clearContextErrorState(conversationId)
        if (result.usage) {
          contextBudget.trackConversation(
            conversationId,
            result.usage.input_tokens + result.usage.output_tokens,
          )
        }
      } else {
        // ---------------------------------------------------------------
        // OLD PATH: inline streaming (fallback while AGENT_LOOP_ENABLED=false)
        // ---------------------------------------------------------------

        // === Phase 1B additions — preserve across Phase 2 rewrite ===
        // 1.5b: Output token escalation. Start with DEFAULT_MAX_TOKENS,
        // escalate 4x on max_tokens stop_reason, up to MAX_TOKENS_CEILING.
        let effectiveMaxTokens = maxTokens || DEFAULT_MAX_TOKENS
        // === end Phase 1B additions (1.5b init) ===

        // Make streaming API call with rate-limit retry
        const MAX_RETRIES = 3
        let finalMessage: Anthropic.Message | null = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const stream = await anthropicClient.messages.stream(
              {
                model: model || 'claude-sonnet-4-6',
                max_tokens: effectiveMaxTokens,
                system: systemPrompt,
                messages: messages as Anthropic.MessageParam[],
                tools: tools.length > 0 ? tools : undefined,
              },
              {
                signal: controller.signal,
              },
            )

            // Process stream events
            for await (const event of stream) {
              if (controller.signal.aborted) {
                logger.debug(`[Agent] Request ${requestId} was aborted`)
                break
              }

              const chunk = processStreamEvent(requestId, conversationId, event, currentToolUseId)
              if (chunk) {
                sendStreamChunk(chunk)
              }
            }

            // Get final message to determine stop reason and extract usage
            finalMessage = await stream.finalMessage()

            // === Phase 1B additions — preserve across Phase 2 rewrite ===
            // 1.5b: If response was truncated (max_tokens), escalate and retry
            if (
              finalMessage.stop_reason === 'max_tokens' &&
              effectiveMaxTokens < MAX_TOKENS_CEILING &&
              !controller.signal.aborted
            ) {
              const previousTokens = effectiveMaxTokens
              effectiveMaxTokens = Math.min(
                effectiveMaxTokens * ESCALATION_MULTIPLIER,
                MAX_TOKENS_CEILING,
              )
              logger.warn(
                `[Agent] Output truncated (stop_reason: max_tokens). ` +
                  `Escalating max_tokens: ${previousTokens} → ${effectiveMaxTokens}`,
              )
              sendStreamChunk({
                requestId,
                conversationId,
                type: 'text_delta',
                content: `\n\n*Response was truncated — retrying with higher token limit (${effectiveMaxTokens})...*\n\n`,
              })
              // Don't break — continue the retry loop with escalated tokens
              continue
            }
            // === end Phase 1B additions (1.5b escalation) ===

            break // success — exit retry loop
          } catch (retryError: unknown) {
            // === Phase 1B additions — preserve across Phase 2 rewrite ===
            // Use classifyLLMError for structured error handling
            const classified = classifyLLMError(retryError, 'anthropic')
            // === end Phase 1B additions ===

            if (
              classified.category === 'rate_limit' &&
              attempt < MAX_RETRIES &&
              !controller.signal.aborted
            ) {
              const retryAfterMs = classified.retryAfterMs ?? 60_000
              const waitSeconds = Math.min(Math.ceil(retryAfterMs / 1000) + 5, 120) // add 5s buffer, cap at 2min
              logger.debug(
                `[Agent] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Waiting ${waitSeconds}s before retry...`,
              )

              // Notify UI that we're waiting
              sendStreamChunk({
                requestId,
                conversationId,
                type: 'text_delta',
                content: `\n\n*Rate limit reached — waiting ${waitSeconds}s before continuing...*\n\n`,
              })

              // Wait with abort check
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(resolve, waitSeconds * 1000)
                const onAbort = (): void => {
                  clearTimeout(timeout)
                  resolve()
                }
                controller.signal.addEventListener('abort', onAbort, { once: true })
              })

              if (controller.signal.aborted) throw retryError
              continue // retry
            }

            // === Phase 3A additions — context_length (413) retry with compaction ===
            if (
              classified.category === 'context_length' &&
              classified.status === 413 &&
              !controller.signal.aborted
            ) {
              const errorState = recordContextError(conversationId, classified.message)

              if (!errorState.shouldSurface) {
                // Withhold error — attempt compaction and retry
                logger.debug(
                  `[Agent] Context too large (413), attempt ${errorState.retryCount}/${MAX_CONTEXT_RETRIES}. ` +
                    `Triggering compaction...`,
                )
                sendStreamChunk({
                  requestId,
                  conversationId,
                  type: 'text_delta',
                  content: `\n\n*Context too large — compacting and retrying (${errorState.retryCount}/${MAX_CONTEXT_RETRIES})...*\n\n`,
                })

                // Spill current conversation context to free budget
                const contextContent = JSON.stringify(messages)
                try {
                  contextBudget.spillToDisk(conversationId, contextContent)
                } catch (spillError) {
                  logger.warn(`[Agent] Spill failed during compaction:`, spillError)
                }

                continue // retry with compacted context
              }
              // After MAX_CONTEXT_RETRIES, fall through to throw
            }
            // === end Phase 3A additions ===

            throw retryError // non-retryable or out of retries — let outer catch handle it
          }
        }

        if (!finalMessage) throw new Error('No response received after retries')

        logger.debug(`[Agent] Stream completed with stop_reason: ${finalMessage.stop_reason}`)

        // Extract usage data for token tracking
        // Note: cache token fields may not be in SDK types yet but exist in API responses
        const usage = finalMessage.usage
          ? {
              input_tokens: finalMessage.usage.input_tokens,
              output_tokens: finalMessage.usage.output_tokens,
              cache_creation_input_tokens: (finalMessage.usage as any).cache_creation_input_tokens,
              cache_read_input_tokens: (finalMessage.usage as any).cache_read_input_tokens,
            }
          : undefined

        sendStreamChunk({
          requestId,
          conversationId,
          type: 'done',
          stopReason: finalMessage.stop_reason || 'end_turn',
          usage,
        })

        // === Phase 1B additions — preserve across Phase 2 rewrite ===
        // 1.5c: Clear pre-persisted message on successful completion
        try {
          store.delete(`pendingUserMessage:${conversationId}`)
        } catch {
          // Non-fatal
        }
        // === end Phase 1B additions (1.5c cleanup) ===

        // === Phase 3A additions — clear error state on success ===
        clearContextErrorState(conversationId)
        // Update budget tracker with actual usage
        if (finalMessage?.usage) {
          contextBudget.trackConversation(
            conversationId,
            finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
          )
        }
        // === end Phase 3A additions ===
      }
      // === end Phase B1 feature flag ===
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug(`[Agent] Request ${requestId} cancelled`)
        sendStreamChunk({
          requestId,
          conversationId,
          type: 'done',
          stopReason: 'cancelled',
        })
      } else {
        console.error(`[Agent] Error in request ${requestId}:`, error)

        // === Phase 1B additions — preserve across Phase 2 rewrite ===
        // Use classifyLLMError for structured error messaging
        const classified = classifyLLMError(error, 'anthropic')
        let userMessage = classified.message

        switch (classified.category) {
          case 'auth':
            userMessage = 'API authentication failed. Please check your API key.'
            break
          case 'rate_limit':
            userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
            break
          case 'network':
            userMessage = 'Network error. Please check your internet connection.'
            break
          case 'context_length':
            userMessage =
              'Conversation too long. Try starting a new conversation or removing some context.'
            break
          default:
            // Keep the original classified message
            break
        }
        // === end Phase 1B additions ===

        sendStreamChunk({
          requestId,
          conversationId,
          type: 'error',
          error: userMessage,
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    } finally {
      activeRequests.delete(requestId)
    }
  })

  // Handle cancellation
  ipcMain.handle('agent:cancel', async (_event, requestId: string) => {
    logger.debug(`[Agent] Cancelling request ${requestId}`)
    const request = activeRequests.get(requestId)
    if (request) {
      request.controller.abort()
      activeRequests.delete(requestId)
    }
  })

  // CLI detection for Agent SDK local mode
  const claudeBinary = findClaudeBinary()
  logger.debug(`[Agent] Claude CLI binary resolved to: ${claudeBinary}`)

  ipcMain.handle('agent:checkCli', async () => {
    try {
      // shell: true required on Windows — .cmd files can't be execFile'd directly
      await execFileAsync(claudeBinary, ['--version'], { timeout: 5000, shell: true })
      try {
        await execFileAsync(claudeBinary, ['auth', 'status'], { timeout: 5000, shell: true })
        return { installed: true, loggedIn: true }
      } catch {
        return { installed: true, loggedIn: false }
      }
    } catch (err) {
      console.error('[Agent] CLI check failed:', (err as Error).message)
      return { installed: false, loggedIn: false }
    }
  })

  ipcMain.handle('agent:login', async () => {
    return new Promise((resolve) => {
      const proc = spawn(claudeBinary, ['login'], { stdio: 'inherit', shell: true })
      proc.on('close', (code: number) => resolve({ success: code === 0 }))
      proc.on('error', () => resolve({ success: false }))
    })
  })
}
