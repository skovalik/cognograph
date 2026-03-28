// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { ipcMain, BrowserWindow, safeStorage } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { getSetting } from '../settings'
import { query, type SDKMessage, type Options } from '@anthropic-ai/claude-agent-sdk'
import { createCognographSdkServer, setCurrentConversationId } from './sdkTools'
import { logger } from '../utils/logger'

const execFileAsync = promisify(execFile)

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
  promptPrefix?: string
): string {
  // Build memory section if entries exist
  let memorySection = ''
  if (memory && memory.entries.length > 0) {
    const memoryLines = memory.entries
      .map((e) => `- **${e.key}**: ${e.value}`)
      .join('\n')
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
You cannot: delete nodes, rename edges, undo actions, or export files. If asked, explain the limitation and suggest alternatives (e.g., manual deletion in UI, unlink + re-link for edge rename).

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
    try { fs.accessSync(jsEntry); return jsEntry } catch {}
    // Also check local node_modules
    const localEntry = join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    try { fs.accessSync(localEntry); return localEntry } catch {}
  }

  const candidates = [
    join(process.env.HOME || '', '.npm-global', 'bin', 'claude'), // custom npm prefix
    join(process.env.HOME || '', '.local', 'bin', 'claude'), // Linux/Mac local
    '/usr/local/bin/claude', // Mac homebrew
    'claude', // system PATH fallback
  ]
  for (const candidate of candidates) {
    if (candidate && candidate !== 'claude') {
      try { fs.accessSync(candidate, fs.constants.X_OK); return candidate } catch {}
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
    ...(existingSessionId ? { resume: existingSessionId } : {})
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
              content: block.text
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
                output_tokens: resultMsg.usage.output_tokens
              }
            : undefined
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
          : message
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
  currentToolUseId: { value: string | null }
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
          toolName: event.content_block.name
        }
      }
      return null

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        return {
          requestId,
          conversationId,
          type: 'text_delta',
          content: event.delta.text
        }
      }
      if (event.delta.type === 'input_json_delta') {
        return {
          requestId,
          conversationId,
          type: 'tool_use_delta',
          toolUseId: currentToolUseId.value || '',
          toolInput: event.delta.partial_json
        }
      }
      return null

    case 'content_block_stop':
      if (currentToolUseId.value) {
        const chunk: AgentStreamChunk = {
          requestId,
          conversationId,
          type: 'tool_use_end',
          toolUseId: currentToolUseId.value
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

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: opts.prompt }
  ]

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
      }
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
    logger.debug(`[Agent] useClaudeProAccount=${useAgentSDK} (routing to ${useAgentSDK ? 'Agent SDK' : 'API'})`)
    if (useAgentSDK) {
      return handleAgentSDKRequest(payload)
    }

    const { requestId, conversationId, messages, context, tools, model, maxTokens, memory, systemPromptPrefix } = payload

    logger.debug(`[Agent] Received request ${requestId} for conversation ${conversationId}`)
    logger.debug(`[Agent] Tools count: ${tools.length}, Messages count: ${messages.length}`)

    // Get API key
    const apiKey = getApiKey('anthropic')
    if (!apiKey) {
      sendStreamChunk({
        requestId,
        conversationId,
        type: 'error',
        error: 'No Anthropic API key configured. Please set your API key in settings.'
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

      // Make streaming API call with rate-limit retry
      const MAX_RETRIES = 3
      let finalMessage: Anthropic.Message | null = null

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const stream = await anthropicClient.messages.stream(
            {
              model: model || 'claude-sonnet-4-6',
              max_tokens: maxTokens || 64000,
              system: systemPrompt,
              messages: messages as Anthropic.MessageParam[],
              tools: tools.length > 0 ? tools : undefined
            },
            {
              signal: controller.signal
            }
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
          break // success — exit retry loop
        } catch (retryError: any) {
          if (retryError?.status === 429 && attempt < MAX_RETRIES && !controller.signal.aborted) {
            const retryAfter = parseInt(retryError?.headers?.['retry-after'] || '60', 10)
            const waitSeconds = Math.min(retryAfter + 5, 120) // add 5s buffer, cap at 2min
            logger.debug(`[Agent] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Waiting ${waitSeconds}s before retry...`)

            // Notify UI that we're waiting
            sendStreamChunk({
              requestId,
              conversationId,
              type: 'text',
              text: `\n\n*Rate limit reached — waiting ${waitSeconds}s before continuing...*\n\n`
            })

            // Wait with abort check
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, waitSeconds * 1000)
              const onAbort = () => { clearTimeout(timeout); resolve() }
              controller.signal.addEventListener('abort', onAbort, { once: true })
            })

            if (controller.signal.aborted) throw retryError
            continue // retry
          }
          throw retryError // non-429 or out of retries — let outer catch handle it
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
            cache_read_input_tokens: (finalMessage.usage as any).cache_read_input_tokens
          }
        : undefined

      sendStreamChunk({
        requestId,
        conversationId,
        type: 'done',
        stopReason: finalMessage.stop_reason || 'end_turn',
        usage
      })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.debug(`[Agent] Request ${requestId} cancelled`)
        sendStreamChunk({
          requestId,
          conversationId,
          type: 'done',
          stopReason: 'cancelled'
        })
      } else {
        console.error(`[Agent] Error in request ${requestId}:`, error)

        // Determine error type for better UI messaging
        const errorMessage = (error as Error).message || 'Unknown error'
        let userMessage = errorMessage

        if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
          userMessage = 'API authentication failed. Please check your API key.'
        } else if (errorMessage.includes('429') || errorMessage.includes('rate')) {
          userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
        } else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
          userMessage = 'Network error. Please check your internet connection.'
        }

        sendStreamChunk({
          requestId,
          conversationId,
          type: 'error',
          error: userMessage
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
