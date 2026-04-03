// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Event Bridge — maps AgentLoopEvents to IPC sends on the BrowserWindow.
 *
 * This module is the translation layer between the pure agentLoop (which emits
 * AgentLoopEvents) and the renderer (which listens on named IPC channels).
 *
 * Design contract:
 *   - bridgeEventToIPC handles: text-delta, tool-start, tool-result, node-created
 *   - The 'done' chunk is NOT emitted here — it must be sent by the IPC handler
 *     AFTER runAgentWithToolLoop returns, using the loop's result.stopReason and
 *     result.usage (C-FIX-1). Emitting done inside bridgeEventToIPC would require
 *     the loop result, which isn't available until the loop exits.
 *
 * ToolResult type disambiguation (C-FIX-2):
 *   agentLoop emits tools/types.ts ToolResult: { content: [{type,text}], isError? }
 *   The renderer expects transport/types.ts ToolResult: { success, output?, error? }
 *   bridgeEventToIPC converts between the two at the tool-result case.
 *
 * batch_create node tracking:
 *   agentEventReceiver.handleToolResult already tracks batch_create nodes via the
 *   nodeMap when it receives agent:tool-result. No extra agent:node-created events
 *   need to be emitted here — doing so would double-track every created node.
 *
 * Created as part of Phase B2: renderer-passivization
 */

import type { BrowserWindow } from 'electron'
import type { ToolResult as MainToolResult } from '../tools/types'
import type { AgentLoopEvent } from './agentLoop'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a main-process ToolResult (content[] + isError) to the transport
 * shape that the renderer expects (success / output / error).
 *
 * C-FIX-2: Two distinct types named ToolResult exist in this codebase.
 * This function is the canonical conversion point — do not inline elsewhere.
 */
function toTransportResult(toolResult: MainToolResult): {
  success: boolean
  output?: unknown
  error?: string
} {
  // Iterate to find the first text block — content[0] may be non-text (e.g. image)
  // or the array may be empty; both cases are handled gracefully.
  const firstTextBlock = toolResult.content.find((block) => block.type === 'text')
  const textContent = firstTextBlock?.type === 'text' ? firstTextBlock.text : null

  if (toolResult.isError) {
    return {
      success: false,
      error: textContent ?? 'Tool failed',
    }
  }

  // Edge case: empty content array — output: null is valid for a successful tool with no output
  // Parse the text content as JSON if possible — canvas tools return JSON strings.
  // If parsing fails, surface the raw text as the output.
  let output: unknown = textContent
  if (textContent !== null) {
    try {
      output = JSON.parse(textContent)
    } catch {
      // Not JSON — use raw text
    }
  }

  return {
    success: true,
    output,
  }
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

/**
 * Translate a single AgentLoopEvent into one or more IPC sends on the window.
 *
 * NOTE: The 'done' chunk is intentionally NOT handled here.
 * It must be sent by the IPC handler after runAgentWithToolLoop returns (C-FIX-1).
 * See callers in the agent IPC handler for the done emission pattern.
 */
export function bridgeEventToIPC(
  event: AgentLoopEvent,
  requestId: string,
  conversationId: string,
  window: BrowserWindow,
): void {
  switch (event.type) {
    case 'text-delta': {
      // Forward through the existing agent:stream channel.
      // chatToolService subscribes to agent:stream for text streaming — this
      // channel is also used by the old renderer-side path, so we preserve it
      // for compatibility until the full passivization is complete.
      window.webContents.send('agent:stream', {
        requestId,
        conversationId,
        type: 'text_delta',
        content: event.content,
      })
      break
    }

    case 'tool-start': {
      window.webContents.send('agent:tool-start', {
        conversationId,
        toolName: event.toolName,
        toolId: event.toolId,
        toolInput: event.toolInput,
      })
      break
    }

    case 'tool-result': {
      // C-FIX-2: convert main ToolResult → transport ToolResult
      // agentEventReceiver.handleToolResult handles batch_create node tracking
      // via the nodeMap when it receives this event — no extra node-created
      // events should be emitted here to avoid double-tracking.
      window.webContents.send('agent:tool-result', {
        conversationId,
        toolId: event.toolId,
        toolName: event.toolName,
        result: toTransportResult(event.result),
      })
      break
    }

    case 'node-created': {
      // Emitted by agentLoop for create_node calls (single-node path).
      // batch_create nodes are tracked by agentEventReceiver via the tool-result event.
      window.webContents.send('agent:node-created', {
        conversationId,
        nodeId: event.nodeId,
        type: event.nodeType,
        position: { x: 0, y: 0 },
      })
      break
    }

    case 'turn-start': {
      // Forward turn-start through the agent:stream channel so the existing
      // handleStreamChunk in agentService can create a new assistant placeholder
      // and reset accumulatedText before the next turn's text_delta events arrive.
      window.webContents.send('agent:stream', {
        requestId,
        conversationId,
        type: 'turn_start',
        turnIndex: event.turnIndex,
      })
      break
    }

    default: {
      // Exhaustive check — TypeScript will error here if AgentLoopEvent gains
      // a new variant without a corresponding case.
      const _exhaustive: never = event
      void _exhaustive
      break
    }
  }
}
