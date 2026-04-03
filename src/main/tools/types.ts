// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool System — Canonical type definitions.
 *
 * These types unify the three competing tool schemas (sdkTools.ts, agentTools.ts,
 * mcpClient.ts) into a single provider-agnostic interface. Downstream consumers
 * (TOOL-WRAP, AGENT-LOOP-CORE) depend on these types exclusively.
 */

import type { ZodSchema } from 'zod'

// ---------------------------------------------------------------------------
// ExecutionContext — carries conversation state through tool calls
// ---------------------------------------------------------------------------

export interface ExecutionContext {
  /** Active workspace identifier */
  workspaceId: string
  /** Conversation node ID for the current agent turn */
  conversationId: string
  /** Filesystem paths the agent is allowed to access */
  allowedPaths: readonly string[]
  /** Accumulated conversation messages (provider-agnostic) */
  messages: readonly unknown[]
  /** Active MCP server IDs for this session */
  activeMcpServerIds: readonly string[]
  /** Arbitrary key-value metadata (tools can extend via contextModifier) */
  metadata: Readonly<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// ToolResult — what a tool call returns
// ---------------------------------------------------------------------------

export interface ToolResultContentText {
  type: 'text'
  text: string
}

export interface ToolResultContentImage {
  type: 'image'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export type ToolResultContent = ToolResultContentText | ToolResultContentImage

export interface ToolResult {
  content: ToolResultContent[]
  /** Optional function that transforms the execution context after this tool runs */
  contextModifier?: (ctx: ExecutionContext) => ExecutionContext
  /** True if this result represents an error condition */
  isError?: boolean
}

// ---------------------------------------------------------------------------
// Tool — the canonical tool interface
// ---------------------------------------------------------------------------

export type PermissionVerdict = 'allow' | 'deny' | 'ask'
export type InterruptBehavior = 'cancel' | 'block'

export interface Tool {
  /** Unique tool name (must be [a-zA-Z0-9_-]+, max 64 chars) */
  readonly name: string
  /** Human-readable description shown to LLMs */
  readonly description: string
  /** Zod schema for validating tool input */
  readonly inputSchema: ZodSchema
  /** Execute the tool with validated input */
  call(input: unknown): Promise<ToolResult>
  /** Optional permission check — runs before call() */
  checkPermissions?(input: unknown): Promise<PermissionVerdict>
  /** True if the tool only reads state (default: false — fail-closed) */
  readonly isReadOnly: boolean
  /** True if safe to run concurrently with other tools (default: false) */
  readonly isConcurrencySafe: boolean
  /** 'cancel' = abort on interrupt, 'block' = must complete */
  readonly interruptBehavior: InterruptBehavior
  /** True if sibling tool errors should cancel this tool */
  readonly errorCascade: boolean
  /** Optional additional context injected into system prompt */
  readonly prompt?: string
}

// ---------------------------------------------------------------------------
// ToolConfig — partial config accepted by buildTool
// ---------------------------------------------------------------------------

export interface ToolConfig {
  name: string
  description: string
  inputSchema: ZodSchema
  call: (input: unknown) => Promise<ToolResult>
  checkPermissions?: (input: unknown) => Promise<PermissionVerdict>
  isReadOnly?: boolean
  isConcurrencySafe?: boolean
  interruptBehavior?: InterruptBehavior
  errorCascade?: boolean
  prompt?: string
}

// ---------------------------------------------------------------------------
// NormalizedToolCall — provider-agnostic tool call extracted from responses
// ---------------------------------------------------------------------------

export interface NormalizedToolCall {
  /** Provider-assigned call ID (or UUID fallback if missing) */
  id: string
  /** Tool name to invoke */
  name: string
  /** Parsed input arguments */
  input: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// ToolPool — typed map with lookup, listing, and format converters
// ---------------------------------------------------------------------------

export interface ToolPool {
  /** Get a tool by name, or undefined if not found */
  get(name: string): Tool | undefined
  /** List all registered tools */
  list(): readonly Tool[]
  /** Generate Anthropic-format tool definitions */
  toAnthropicFormat(): AnthropicToolDef[]
  /** Generate OpenAI-format tool definitions */
  toOpenAIFormat(): OpenAIToolDef[]
  /** Generate Gemini-format tool definitions */
  toGeminiFormat(): GeminiToolDef[]
}

// ---------------------------------------------------------------------------
// Provider-specific tool definition shapes (output of format converters)
// ---------------------------------------------------------------------------

/** Anthropic tool definition — `tools` array element in Messages API */
export interface AnthropicToolDef {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
}

/** OpenAI tool definition — `tools` array element in Chat Completions API */
export interface OpenAIToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
      [key: string]: unknown
    }
  }
}

/** Gemini tool definition — `functionDeclarations` element */
export interface GeminiToolDef {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// Provider identifier
// ---------------------------------------------------------------------------

export type LLMProvider = 'anthropic' | 'openai' | 'gemini'
