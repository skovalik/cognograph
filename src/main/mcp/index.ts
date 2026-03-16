// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

// MCP module exports - Phase 14

export { createMCPServer } from './server'
export { FileSyncProvider } from './provider'
export type { MCPSyncProvider, WorkspaceNode, WorkspaceEdge, WorkspaceFileData } from './provider'
export { TOOL_DEFINITIONS } from './tools'
export { handleToolCall } from './handlers'
export { getResourceList, handleResourceRead } from './resources'
export type { MCPResource } from './resources'
