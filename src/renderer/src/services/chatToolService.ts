// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * chatToolService — lightweight tool loop for chat mode.
 *
 * Reuses agent:sendWithTools IPC and executeTool() from agentTools,
 * piggybacking on agentService's stream listener via
 * registerExternalStreamHandler. No main-process changes.
 */

import { v4 as uuid } from 'uuid'
import { toast } from 'react-hot-toast'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useSessionStatsStore } from '../stores/sessionStatsStore'
import {
  initAgentService,
  registerExternalStreamHandler,
  unregisterExternalStreamHandler,
  buildMessagesForAPI
} from './agentService'
import { getChatToolDefinitions, executeTool } from './agentTools'
import type { AgentStreamChunk } from '../../../preload/index'
import type { Message } from '@shared/types'

const MAX_CHAT_TOOL_CALLS = 5

// Active chat tool loops, keyed by conversationId
const activeLoops = new Map<string, { requestId: string; cancelled: boolean }>()

export function isChatToolLoopActive(conversationId: string): boolean {
  return activeLoops.has(conversationId)
}

export function cancelChatToolLoop(conversationId: string): void {
  const loop = activeLoops.get(conversationId)
  if (loop) {
    loop.cancelled = true
    window.api.agent.cancel(loop.requestId).catch(() => {})
    cleanup(conversationId, loop.requestId)
  }
}

function cleanup(conversationId: string, requestId: string): void {
  unregisterExternalStreamHandler(requestId)
  activeLoops.delete(conversationId)
  useWorkspaceStore.getState().setStreaming(conversationId, false)
}

/**
 * Send a chat message with canvas tools. Handles the full tool loop:
 * stream text → detect tool_use → execute → send continuation → repeat.
 */
export async function sendChatWithTools(
  conversationId: string,
  userMessage: string,
  options: {
    model?: string
    maxTokens?: number
    systemPromptPrefix?: string
    context?: string
  }
): Promise<void> {
  const store = useWorkspaceStore.getState()

  // Ensure agentService's stream listener is registered
  initAgentService()

  // Add user message + assistant placeholder
  store.addMessage(conversationId, 'user', userMessage)
  store.addMessage(conversationId, 'assistant', '')
  store.setStreaming(conversationId, true)

  const tools = getChatToolDefinitions()
  let toolCallCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // State for current iteration
  let accumulatedText = ''
  let currentToolUse: { id: string; name: string; inputJson: string } | null = null
  let requestId = uuid()

  const loopState = { requestId, cancelled: false }
  activeLoops.set(conversationId, loopState)

  try {
    while (toolCallCount < MAX_CHAT_TOOL_CALLS && !loopState.cancelled) {
      accumulatedText = ''
      currentToolUse = null

      // Promise that resolves when this iteration's stream completes
      const { stopReason, usage } = await new Promise<{
        stopReason: string
        usage?: { input_tokens: number; output_tokens: number }
      }>((resolve) => {
        // Register stream handler for this requestId
        registerExternalStreamHandler(requestId, {
          onChunk(chunk: AgentStreamChunk) {
            if (chunk.type === 'text_delta') {
              accumulatedText += chunk.content
              store.updateLastMessage(conversationId, accumulatedText)
            } else if (chunk.type === 'tool_use_start') {
              currentToolUse = { id: chunk.toolUseId, name: chunk.toolName, inputJson: '' }
            } else if (chunk.type === 'tool_use_delta' && currentToolUse) {
              currentToolUse.inputJson += chunk.toolInput
            } else if (chunk.type === 'done') {
              resolve({ stopReason: chunk.stopReason, usage: chunk.usage })
            } else if (chunk.type === 'error') {
              resolve({ stopReason: 'error' })
            }
          }
        })

        // Build messages in Anthropic format (handles tool_use/tool_result correctly)
        const convData = store.nodes.find(n => n.id === conversationId)?.data
        const messages = convData ? buildMessagesForAPI(convData.messages || []) : []

        // Send request
        loopState.requestId = requestId
        window.api.agent.sendWithTools({
          requestId,
          conversationId,
          messages,
          context: options.context || '',
          tools,
          model: options.model || 'claude-sonnet-4-20250514',
          systemPromptPrefix: options.systemPromptPrefix
        })
      })

      // Unregister this iteration's handler
      unregisterExternalStreamHandler(requestId)

      // Accumulate tokens
      if (usage) {
        totalInputTokens += usage.input_tokens
        totalOutputTokens += usage.output_tokens
      }

      if (loopState.cancelled) break

      // Handle stop reason
      if (stopReason === 'error' || stopReason === 'timeout') {
        if (!accumulatedText) {
          store.updateLastMessage(conversationId, 'Sorry, an error occurred. Please try again.')
        }
        break
      }

      if (stopReason === 'tool_use' && currentToolUse) {
        toolCallCount++

        // Add tool_use message
        const toolInput = safeJsonParse(currentToolUse.inputJson)
        const toolUseMsg: Message = {
          id: uuid(),
          role: 'tool_use',
          content: `Calling ${currentToolUse.name}`,
          timestamp: Date.now(),
          toolName: currentToolUse.name,
          toolInput,
          toolUseId: currentToolUse.id
        }
        store.addToolMessage(conversationId, toolUseMsg)

        // Execute tool
        const result = await executeTool(currentToolUse.name, toolInput, conversationId)

        // Add tool_result message
        const toolResultMsg: Message = {
          id: uuid(),
          role: 'tool_result',
          content: result.success
            ? JSON.stringify(result.result, null, 2)
            : `Error: ${result.error}`,
          timestamp: Date.now(),
          toolResultFor: currentToolUse.id,
          isError: !result.success
        }
        store.addToolMessage(conversationId, toolResultMsg)

        if (!result.success) {
          toast.error(`Tool error: ${result.error}`)
        }

        // Prepare for continuation
        requestId = uuid()
        loopState.requestId = requestId
        store.addMessage(conversationId, 'assistant', '')
        continue
      }

      // end_turn, stop_sequence, max_tokens — we're done
      break
    }

    // Max tool calls reached
    if (toolCallCount >= MAX_CHAT_TOOL_CALLS && !loopState.cancelled) {
      store.addMessage(
        conversationId,
        'assistant',
        `I've reached the maximum tool calls (${MAX_CHAT_TOOL_CALLS}) for this turn. Let me know if you'd like me to continue.`
      )
    }

    // Record token usage on the last assistant message
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      store.setLastMessageUsage?.(conversationId, {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens
      })
      useSessionStatsStore.getState().recordUsage?.({
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens
      })
    }
  } catch (error) {
    console.error('[ChatToolService] Error:', error)
    store.updateLastMessage(
      conversationId,
      accumulatedText + '\n\nSorry, an error occurred: ' + (error as Error).message
    )
  } finally {
    cleanup(conversationId, requestId)
  }
}

function safeJsonParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json || '{}')
  } catch {
    return {}
  }
}
