// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/shared/transport/types.ts -- Transport-agnostic message layer
//
// Defines the Transport interface, AgentMessage union type, and all payload
// types. This abstraction allows swapping between Electron IPC (local) and
// WebSocket (cloud) transports without changing agent/renderer code.
//
// Created as part of Phase 1: TRANSPORT-ABSTRACTION
// =============================================================================

// -----------------------------------------------------------------------------
// Geometry (reuse inline — avoids coupling to @xyflow/react which is renderer-only)
// -----------------------------------------------------------------------------

/** Canvas position for node placement. */
export interface Position {
  x: number
  y: number
}

// -----------------------------------------------------------------------------
// Token / Usage Types
// -----------------------------------------------------------------------------

/** Token usage returned on agent completion. */
export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// -----------------------------------------------------------------------------
// Agent Stream Chunk (mirrors existing AgentStreamChunk from preload/index.ts)
// -----------------------------------------------------------------------------

export type AgentStreamChunk =
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
      usage?: TokenUsage
    }
  | {
      requestId: string
      conversationId: string
      type: 'error'
      error: string
      /** Stack trace — included when available so renderer logs can surface it */
      stack?: string
    }

// -----------------------------------------------------------------------------
// Tool Result
// -----------------------------------------------------------------------------

/** Result of a tool execution returned to the renderer. */
export interface ToolResult {
  success: boolean
  output?: unknown
  error?: string
}

// -----------------------------------------------------------------------------
// Permission Display Types (Phase 4B — UX-PERMISSIONS)
// -----------------------------------------------------------------------------

/** Shell command display data — shows command with dangerous subcommand highlighting. */
export interface ShellDisplay {
  type: 'shell'
  command: string
}

/** File edit display data — shows file path and unified diff preview. */
export interface EditDisplay {
  type: 'edit'
  filePath: string
  diff: string
}

/** Mutation display data — shows mutation description and target resource. */
export interface MutationDisplay {
  type: 'mutation'
  description: string
  target: string
  /** create | update | delete */
  mutationType?: 'create' | 'update' | 'delete'
}

/** Discriminated union of all permission display variants. */
export type PermissionDisplay = ShellDisplay | EditDisplay | MutationDisplay

// -----------------------------------------------------------------------------
// Permission Types
// -----------------------------------------------------------------------------

/** Request from agent to renderer asking for user permission. */
export interface PermissionRequest {
  requestId: string
  toolName: string
  description: string
  args?: Record<string, unknown>
  /** Structured display data for specialized permission card rendering. */
  display?: PermissionDisplay
}

/** User's response to a permission request. */
export interface PermissionResponse {
  requestId: string
  granted: boolean
}

// -----------------------------------------------------------------------------
// Notification
// -----------------------------------------------------------------------------

/** Generic notification from main to renderer. */
export interface Notification {
  level: 'info' | 'warning' | 'error'
  title: string
  message: string
  /** Optional node ID to associate the notification with. */
  nodeId?: string
}

// -----------------------------------------------------------------------------
// Agent Message Union
// -----------------------------------------------------------------------------

/**
 * All channels are typed as a discriminated union keyed on `channel`.
 * This is the single contract that both Transport implementations must honor.
 *
 * Payload shapes were enriched in Phase B2 (renderer-passivization) to carry
 * the fields that agentEventReceiver.ts needs:
 *   agent:tool-start  — conversationId + toolInput for badge display (Final-13)
 *   agent:tool-result — conversationId + toolName for batch_create routing (Final-15)
 *   agent:node-created — conversationId + title + tempId for layout tracking
 *   agent:complete    — stopReason for UI display
 */
export type AgentMessage =
  | { channel: 'agent:stream-chunk'; payload: AgentStreamChunk }
  | {
      channel: 'agent:tool-start'
      payload: {
        conversationId: string
        toolName: string
        toolId: string
        toolInput?: Record<string, unknown>
      }
    }
  | {
      channel: 'agent:tool-result'
      payload: {
        conversationId: string
        toolId: string
        toolName: string
        result: ToolResult
      }
    }
  | {
      channel: 'agent:node-created'
      payload: {
        conversationId: string
        nodeId: string
        type: string
        position: Position
        title?: string
        tempId?: string
      }
    }
  | {
      channel: 'agent:complete'
      payload: {
        conversationId: string
        usage: TokenUsage
        stopReason: string
      }
    }
  | { channel: 'permission:request'; payload: PermissionRequest }
  | { channel: 'permission:response'; payload: PermissionResponse }
  | { channel: 'notification'; payload: Notification }

/**
 * Extract the channel names as a union type for type-safe channel filtering.
 */
export type AgentMessageChannel = AgentMessage['channel']

/**
 * Extract the payload type for a given channel.
 */
export type PayloadFor<C extends AgentMessageChannel> = Extract<
  AgentMessage,
  { channel: C }
>['payload']

// -----------------------------------------------------------------------------
// Transport Interface
// -----------------------------------------------------------------------------

/**
 * Transport-agnostic message bus.
 *
 * Implementations:
 *   - ElectronTransport (Phase 1) — wraps webContents.send / ipcMain.on
 *   - WebTransport (Phase 5)      — WebSocket-based for cloud agents
 */
export interface Transport {
  /** Send a message to the other side. */
  send(message: AgentMessage): void

  /** Register a handler for incoming messages. */
  onMessage(handler: (message: AgentMessage) => void): void

  /** Register a handler for transport disconnection (reconnect, window close). */
  onDisconnect(handler: () => void): void

  /** Returns false during reconnect or when the underlying channel is unavailable. */
  isReady(): boolean
}
