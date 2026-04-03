// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/shared/transport/index.ts -- Barrel export
// =============================================================================

export type {
  Position,
  TokenUsage,
  AgentStreamChunk,
  ToolResult,
  PermissionRequest,
  PermissionResponse,
  Notification,
  AgentMessage,
  AgentMessageChannel,
  PayloadFor,
  Transport,
} from './types'

export { WebSocketTransport } from './webSocketTransport'
export type { WebSocketTransportConfig } from './webSocketTransport'
