// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// MCP module exports - Phase 14

export { handleToolCall } from './handlers'
export type { MCPSyncProvider, WorkspaceEdge, WorkspaceFileData, WorkspaceNode } from './provider'
export { FileSyncProvider } from './provider'
export type { MCPResource } from './resources'
export { getResourceList, handleResourceRead } from './resources'
export { createMCPServer } from './server'
export { TOOL_DEFINITIONS } from './tools'
