// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// =============================================================================
// src/shared/transport/index.ts -- Barrel export
// =============================================================================

export type {
  AgentMessage,
  AgentMessageChannel,
  AgentStreamChunk,
  Notification,
  PayloadFor,
  PermissionRequest,
  PermissionResponse,
  Position,
  TokenUsage,
  ToolResult,
  Transport,
} from './types'
export type { WebSocketTransportConfig } from './webSocketTransport'
export { WebSocketTransport } from './webSocketTransport'
