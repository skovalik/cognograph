// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool System — barrel export.
 *
 * Consumers import from '@main/tools' (or relative path).
 */

// Pool assembly
export { assembleToolPool } from './assembleToolPool'

// Factory
export { buildTool } from './buildTool'
export type { AgentToolConfig } from './resolveAgentTools'
// Agent tool filtering
export { resolveAgentTools } from './resolveAgentTools'
// Response parser
export { parseToolCalls } from './responseParser'
export type {
  AbortLevel,
  ConcurrentExecutionConfig,
} from './toolExecutor'
// Executor
export {
  AbortTracker,
  cleanupTempDir,
  executeToolCall,
  executeToolCallsConcurrently,
  FILE_UNCHANGED_STUB,
  ReadWriteLock,
} from './toolExecutor'
// Types
export type {
  AnthropicToolDef,
  ExecutionContext,
  GeminiToolDef,
  InterruptBehavior,
  LLMProvider,
  NormalizedToolCall,
  OpenAIToolDef,
  PermissionVerdict,
  Tool,
  ToolConfig,
  ToolPool,
  ToolResult,
  ToolResultContent,
  ToolResultContentImage,
  ToolResultContentText,
} from './types'
