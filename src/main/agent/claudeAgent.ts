import { ipcMain, BrowserWindow, safeStorage } from 'electron'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'

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
- Create, update, delete, and move nodes (conversations, notes, tasks, projects, artifacts)
- Create and manage connections between nodes
- Query the workspace to understand its structure
- Read context from connected nodes

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

## Important
- Only use tools when the user explicitly asks you to modify the workspace
- For general questions or conversation, just respond normally without tools
- If a tool fails, explain what happened and suggest alternatives`
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

export function registerAgentHandlers(): void {
  // Handle agent requests with tool use
  ipcMain.handle('agent:sendWithTools', async (_event, payload: AgentRequestPayload) => {
    const { requestId, conversationId, messages, context, tools, model, maxTokens, memory, systemPromptPrefix } = payload

    console.log(`[Agent] Received request ${requestId} for conversation ${conversationId}`)
    console.log(`[Agent] Tools count: ${tools.length}, Messages count: ${messages.length}`)

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

      console.log(`[Agent] Starting stream with model: ${model || 'claude-sonnet-4-20250514'}`)

      // Make streaming API call
      const stream = await anthropicClient.messages.stream(
        {
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: maxTokens || 4096,
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
          console.log(`[Agent] Request ${requestId} was aborted`)
          break
        }

        const chunk = processStreamEvent(requestId, conversationId, event, currentToolUseId)
        if (chunk) {
          sendStreamChunk(chunk)
        }
      }

      // Get final message to determine stop reason and extract usage
      const finalMessage = await stream.finalMessage()

      console.log(`[Agent] Stream completed with stop_reason: ${finalMessage.stop_reason}`)

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
        console.log(`[Agent] Request ${requestId} cancelled`)
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
    console.log(`[Agent] Cancelling request ${requestId}`)
    const request = activeRequests.get(requestId)
    if (request) {
      request.controller.abort()
      activeRequests.delete(requestId)
    }
  })
}
