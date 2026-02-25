import { ipcMain, BrowserWindow, safeStorage } from 'electron'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import type { IPCResponse } from '../shared/ipc-types'
import { createIPCSuccess, createIPCError, IPC_ERROR_CODES } from '../shared/ipc-types'

interface LLMRequest {
  conversationId: string // Identifies which chat panel this request belongs to
  provider: 'anthropic' | 'gemini' | 'openai'
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  systemPrompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

interface EncryptedKeys {
  anthropic?: string
  gemini?: string
  openai?: string
}

const store = new Store()
const activeStreams = new Map<string, AbortController>()

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
    console.error(`[LLM] Error decrypting ${provider} key:`, error)
    return null
  }
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] || null
}

async function streamAnthropic(request: LLMRequest): Promise<void> {
  const { conversationId } = request
  const apiKey = getApiKey('anthropic')
  if (!apiKey) throw new Error('Anthropic API key not set')

  const client = new Anthropic({ apiKey })
  const mainWindow = getMainWindow()
  if (!mainWindow) throw new Error('No main window')

  const controller = new AbortController()
  activeStreams.set(conversationId, controller)

  const messages = request.messages
    .filter(m => m.role !== 'system' && m.content.trim() !== '')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))

  // Diagnostic logging for context/system prompt
  console.log('[LLM:Anthropic] System prompt length:', request.systemPrompt?.length || 0)
  console.log('[LLM:Anthropic] Messages count:', messages.length)
  if (request.systemPrompt && request.systemPrompt.length > 100) {
    console.log('[LLM:Anthropic] System prompt preview:', request.systemPrompt.substring(0, 300) + '...')
  }

  let fullResponse = ''

  const stream = await client.messages.stream({
    model: request.model || 'claude-sonnet-4-20250514',
    max_tokens: request.maxTokens || 4096,
    temperature: request.temperature ?? 0.7,
    system: request.systemPrompt || 'You are a helpful AI assistant.',
    messages
  }, { signal: controller.signal })

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      const delta = event.delta
      if ('text' in delta) {
        fullResponse += delta.text
        mainWindow.webContents.send('llm:chunk', { conversationId, chunk: delta.text })
      }
    }
  }

  // Extract actual token usage from the finalized message (including cache tokens)
  // Note: cache token fields may not be in SDK types yet but exist in API responses
  const finalMessage = await stream.finalMessage()
  const usage = finalMessage.usage ? {
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
    cacheCreationTokens: (finalMessage.usage as any).cache_creation_input_tokens || 0,
    cacheReadTokens: (finalMessage.usage as any).cache_read_input_tokens || 0,
    model: request.model || 'claude-sonnet-4-20250514'
  } : undefined

  activeStreams.delete(conversationId)
  mainWindow.webContents.send('llm:complete', { conversationId, response: fullResponse, usage })
}

async function streamGemini(request: LLMRequest): Promise<void> {
  const { conversationId } = request
  const apiKey = getApiKey('gemini')
  if (!apiKey) throw new Error('Gemini API key not set')

  const genAI = new GoogleGenerativeAI(apiKey)
  const mainWindow = getMainWindow()
  if (!mainWindow) throw new Error('No main window')

  // Best-effort cancel: Gemini SDK doesn't support AbortSignal,
  // so we check the controller's signal in the streaming loop
  const controller = new AbortController()
  activeStreams.set(conversationId, controller)

  const model = genAI.getGenerativeModel({
    model: request.model || 'gemini-1.5-flash'
  })

  // Build conversation history
  const history = request.messages
    .filter(m => m.role !== 'system' && m.content.trim() !== '')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

  // Get the last user message
  const lastMessage = history.pop()
  if (!lastMessage) throw new Error('No messages provided')

  const chat = model.startChat({
    history: history as Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
    generationConfig: {
      maxOutputTokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7
    }
  })

  let fullResponse = ''
  const result = await chat.sendMessageStream(lastMessage.parts[0]?.text || '')

  for await (const chunk of result.stream) {
    // Best-effort cancel check — stream continues server-side but client stops processing
    if (controller.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const text = chunk.text()
    fullResponse += text
    mainWindow.webContents.send('llm:chunk', { conversationId, chunk: text })
  }

  // Gemini provides usageMetadata on the aggregated response
  const aggregated = await result.response
  const meta = aggregated.usageMetadata
  const usage = meta ? {
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    model: request.model || 'gemini-1.5-flash'
  } : undefined

  activeStreams.delete(conversationId)
  mainWindow.webContents.send('llm:complete', { conversationId, response: fullResponse, usage })
}

async function streamOpenAI(request: LLMRequest): Promise<void> {
  const { conversationId } = request
  const apiKey = getApiKey('openai')
  if (!apiKey) throw new Error('OpenAI API key not set')

  const client = new OpenAI({ apiKey })
  const mainWindow = getMainWindow()
  if (!mainWindow) throw new Error('No main window')

  const controller = new AbortController()
  activeStreams.set(conversationId, controller)

  const messages = request.messages
    .filter(m => m.content.trim() !== '')
    .map(m => ({
      role: m.role,
      content: m.content
    }))

  if (request.systemPrompt) {
    messages.unshift({ role: 'system', content: request.systemPrompt })
  }

  let fullResponse = ''

  let openaiUsage: { prompt_tokens?: number; completion_tokens?: number } | undefined

  const stream = await client.chat.completions.create({
    model: request.model || 'gpt-4-turbo-preview',
    max_tokens: request.maxTokens || 4096,
    temperature: request.temperature ?? 0.7,
    messages,
    stream: true,
    stream_options: { include_usage: true }
  }, { signal: controller.signal })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    if (content) {
      fullResponse += content
      mainWindow.webContents.send('llm:chunk', { conversationId, chunk: content })
    }
    // OpenAI sends usage in the final chunk when stream_options.include_usage is true
    if (chunk.usage) {
      openaiUsage = chunk.usage
    }
  }

  const usage = openaiUsage ? {
    inputTokens: openaiUsage.prompt_tokens ?? 0,
    outputTokens: openaiUsage.completion_tokens ?? 0,
    model: request.model || 'gpt-4-turbo-preview'
  } : undefined

  activeStreams.delete(conversationId)
  mainWindow.webContents.send('llm:complete', { conversationId, response: fullResponse, usage })
}

// Non-streaming extraction call (uses Haiku for speed)
interface ExtractionRequest {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
}

async function extractionCall(request: ExtractionRequest): Promise<IPCResponse<string>> {
  const apiKey = getApiKey('anthropic')
  if (!apiKey) {
    return createIPCError(IPC_ERROR_CODES.LLM_API_ERROR, 'Anthropic API key not set')
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: request.model || 'claude-3-haiku-20240307',
      max_tokens: request.maxTokens || 1500,
      temperature: 0.3,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }]
    })

    const textContent = response.content.find(block => block.type === 'text')
    return createIPCSuccess(textContent?.text || '')
  } catch (error) {
    console.error('[LLM:extract] Error:', error)
    return createIPCError(
      IPC_ERROR_CODES.LLM_API_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
      error instanceof Error ? error.stack : undefined
    )
  }
}

export function registerLLMHandlers(): void {
  // Non-streaming extraction handler
  ipcMain.handle('llm:extract', async (_event, request: ExtractionRequest) => {
    return extractionCall(request)
  })

  ipcMain.handle('llm:send', async (_event, request: LLMRequest) => {
    const mainWindow = getMainWindow()

    try {
      switch (request.provider) {
        case 'anthropic':
          await streamAnthropic(request)
          break
        case 'gemini':
          await streamGemini(request)
          break
        case 'openai':
          await streamOpenAI(request)
          break
        default:
          throw new Error(`Unknown provider: ${request.provider}`)
      }
    } catch (error) {
      if (mainWindow && error instanceof Error) {
        const { conversationId } = request
        activeStreams.delete(conversationId)
        if (error.name === 'AbortError') {
          // Issue 9: Send cancelled flag so renderer can clean up placeholder messages
          mainWindow.webContents.send('llm:complete', { conversationId, response: '', cancelled: true })
        } else {
          console.error('[LLM] Error:', error.message)
          mainWindow.webContents.send('llm:error', { conversationId, error: error.message })
        }
      }
    }
  })

  ipcMain.handle('llm:cancel', async (_event, conversationId?: string) => {
    if (conversationId) {
      // Cancel specific conversation stream
      const controller = activeStreams.get(conversationId)
      if (controller) {
        controller.abort()
        activeStreams.delete(conversationId)
      }
    } else {
      // Backwards-compatible: cancel all active streams
      for (const [id, controller] of activeStreams) {
        controller.abort()
        activeStreams.delete(id)
      }
    }
  })
}
