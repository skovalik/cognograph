// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool System — barrel export.
 *
 * Consumers import from '@main/tools' (or relative path).
 */

// Types
export type {
  ExecutionContext,
  ToolResult,
  ToolResultContent,
  ToolResultContentText,
  ToolResultContentImage,
  Tool,
  ToolConfig,
  PermissionVerdict,
  InterruptBehavior,
  NormalizedToolCall,
  ToolPool,
  AnthropicToolDef,
  OpenAIToolDef,
  GeminiToolDef,
  LLMProvider,
} from './types'

// Factory
export { buildTool } from './buildTool'

// Pool assembly
export { assembleToolPool } from './assembleToolPool'

// Response parser
export { parseToolCalls } from './responseParser'

// Executor
export {
  executeToolCall,
  executeToolCallsConcurrently,
  FILE_UNCHANGED_STUB,
  ReadWriteLock,
  AbortTracker,
  cleanupTempDir,
} from './toolExecutor'
export type {
  ConcurrentExecutionConfig,
  AbortLevel,
} from './toolExecutor'

// Agent tool filtering
export { resolveAgentTools } from './resolveAgentTools'
export type { AgentToolConfig } from './resolveAgentTools'
