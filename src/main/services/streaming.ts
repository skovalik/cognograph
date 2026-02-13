/**
 * Streaming Service
 *
 * Provides unified streaming infrastructure for AI operations.
 * Supports chunk-based streaming with phase markers, cancellation,
 * and progress callbacks.
 *
 * Created as part of Batch 2B: Streaming Service
 */

import { BrowserWindow } from 'electron'
import Anthropic from '@anthropic-ai/sdk'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Phases of plan generation
 */
export type StreamingPhase =
  | 'initializing'
  | 'analyzing'
  | 'planning'
  | 'finalizing'
  | 'complete'
  | 'error'
  | 'cancelled'

/**
 * A chunk of streaming content
 */
export interface StreamChunk {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  toolName?: string
  toolId?: string
}

/**
 * Progress update during streaming
 */
export interface StreamProgress {
  phase: StreamingPhase
  message?: string
  tokensUsed?: number
  estimatedTotal?: number
  requestId?: string
}

/**
 * Result of a completed stream
 */
export interface StreamResult<T> {
  success: boolean
  data?: T
  error?: string
  totalTokens?: number
  duration?: number
  requestId?: string
}

/**
 * Callbacks for streaming events
 */
export interface StreamCallbacks<T> {
  onChunk?: (chunk: StreamChunk) => void
  onPhase?: (progress: StreamProgress) => void
  onComplete?: (result: StreamResult<T>) => void
  onError?: (error: Error) => void
}

/**
 * Options for streaming requests
 */
export interface StreamOptions {
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

// -----------------------------------------------------------------------------
// Streaming Session Manager
// -----------------------------------------------------------------------------

interface ActiveSession {
  id: string
  abortController: AbortController
  startTime: number
  phase: StreamingPhase
}

const activeSessions = new Map<string, ActiveSession>()

/**
 * Create a new streaming session
 */
export function createStreamingSession(sessionId: string): ActiveSession {
  // Cancel any existing session with the same ID
  cancelStreamingSession(sessionId)

  const session: ActiveSession = {
    id: sessionId,
    abortController: new AbortController(),
    startTime: Date.now(),
    phase: 'initializing'
  }

  activeSessions.set(sessionId, session)
  return session
}

/**
 * Get an active streaming session
 */
export function getStreamingSession(sessionId: string): ActiveSession | undefined {
  return activeSessions.get(sessionId)
}

/**
 * Cancel a streaming session
 */
export function cancelStreamingSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.abortController.abort()
    session.phase = 'cancelled'
    activeSessions.delete(sessionId)
    return true
  }
  return false
}

/**
 * Update session phase
 */
export function updateSessionPhase(sessionId: string, phase: StreamingPhase): void {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.phase = phase
  }
}

/**
 * Clean up a completed session
 */
export function cleanupSession(sessionId: string): void {
  activeSessions.delete(sessionId)
}

// -----------------------------------------------------------------------------
// IPC Event Emitters
// -----------------------------------------------------------------------------

/**
 * Send a streaming chunk to the renderer
 */
export function emitStreamChunk(window: BrowserWindow, channel: string, chunk: StreamChunk): void {
  if (!window.isDestroyed()) {
    window.webContents.send(`${channel}:chunk`, chunk)
  }
}

/**
 * Send a phase update to the renderer
 */
export function emitStreamPhase(window: BrowserWindow, channel: string, progress: StreamProgress): void {
  if (!window.isDestroyed()) {
    window.webContents.send(`${channel}:phase`, progress)
  }
}

/**
 * Send completion event to the renderer
 */
export function emitStreamComplete<T>(window: BrowserWindow, channel: string, result: StreamResult<T>): void {
  if (!window.isDestroyed()) {
    window.webContents.send(`${channel}:complete`, result)
  }
}

/**
 * Send error event to the renderer
 */
export function emitStreamError(window: BrowserWindow, channel: string, error: string): void {
  if (!window.isDestroyed()) {
    window.webContents.send(`${channel}:error`, { error })
  }
}

// -----------------------------------------------------------------------------
// Anthropic Streaming Helper
// -----------------------------------------------------------------------------

/**
 * Stream a response from Anthropic with progress updates
 */
export async function streamAnthropicResponse(params: {
  client: Anthropic
  messages: Anthropic.MessageParam[]
  systemPrompt: string
  tools?: Anthropic.Tool[]
  options?: StreamOptions
  callbacks?: StreamCallbacks<string>
  sessionId: string
}): Promise<{ text: string; toolCalls: Anthropic.ToolUseBlock[] }> {
  const { client, messages, systemPrompt, tools, options = {}, callbacks = {}, sessionId } = params
  const { maxTokens = 4096, temperature = 0.3, signal } = options

  const session = getStreamingSession(sessionId)
  if (!session) {
    throw new Error('No active streaming session')
  }

  let fullText = ''
  const toolCalls: Anthropic.ToolUseBlock[] = []

  try {
    // Update phase
    updateSessionPhase(sessionId, 'analyzing')
    callbacks.onPhase?.({ phase: 'analyzing', message: 'Analyzing workspace...' })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {})
    })

    // Check for abort before processing
    if (signal?.aborted || session.abortController.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    // Update phase to planning once we start receiving content
    let hasReceivedContent = false

    for await (const event of stream) {
      // Check for abort during streaming
      if (signal?.aborted || session.abortController.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      if (event.type === 'content_block_delta') {
        if (!hasReceivedContent) {
          hasReceivedContent = true
          updateSessionPhase(sessionId, 'planning')
          callbacks.onPhase?.({ phase: 'planning', message: 'Generating plan...' })
        }

        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text
          callbacks.onChunk?.({
            type: 'text',
            content: event.delta.text
          })
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          callbacks.onChunk?.({
            type: 'tool_use',
            content: '',
            toolName: event.content_block.name,
            toolId: event.content_block.id
          })
        }
      } else if (event.type === 'message_stop') {
        // Extract tool calls from the final message
        const finalMessage = await stream.finalMessage()
        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            toolCalls.push(block)
          }
        }
      }
    }

    // Update to finalizing phase
    updateSessionPhase(sessionId, 'finalizing')
    callbacks.onPhase?.({ phase: 'finalizing', message: 'Finalizing plan...' })

    return { text: fullText, toolCalls }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      updateSessionPhase(sessionId, 'cancelled')
      callbacks.onPhase?.({ phase: 'cancelled', message: 'Generation cancelled' })
      throw error
    }
    updateSessionPhase(sessionId, 'error')
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if a session is still active and not aborted
 */
export function isSessionActive(sessionId: string): boolean {
  const session = activeSessions.get(sessionId)
  return session !== undefined && !session.abortController.signal.aborted
}

/**
 * Get the duration of a session in milliseconds
 */
export function getSessionDuration(sessionId: string): number {
  const session = activeSessions.get(sessionId)
  if (!session) return 0
  return Date.now() - session.startTime
}

/**
 * Get all active session IDs
 */
export function getActiveSessionIds(): string[] {
  return Array.from(activeSessions.keys())
}
