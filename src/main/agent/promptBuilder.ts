// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * promptBuilder.ts — Structured system prompt builder for Anthropic prompt caching.
 *
 * Anthropic's prompt caching works by caching content blocks that remain
 * identical between requests. This module splits the system prompt into:
 *
 * 1. **Static prefix** (cache-stable): Identity constant + sorted tool definitions.
 *    Marked with `cache_control: { type: 'ephemeral' }` to enable caching.
 *    This portion remains identical across turns within a session.
 *
 * 2. **Dynamic suffix**: BFS context + conversation history.
 *    Changes every turn, so it's NOT cached.
 *
 * Usage:
 *   const { staticPrefix, dynamicSuffix } = buildSystemPrompt(identity, tools, bfsContext)
 *   // Pass to Anthropic API as separate system content blocks
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tool definition shape matching Anthropic's API tool format */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** Cache control marker for Anthropic's prompt caching */
export interface CacheControl {
  type: 'ephemeral'
}

/** A system prompt content block with optional cache control */
export interface SystemContentBlock {
  type: 'text'
  text: string
  cache_control?: CacheControl
}

/** The built system prompt, split for caching */
export interface BuiltSystemPrompt {
  /** Cache-stable portion: identity + tool definitions. Has cache_control marker. */
  staticPrefix: SystemContentBlock
  /** Per-turn portion: BFS context. No cache_control marker. */
  dynamicSuffix: SystemContentBlock
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Cognograph agent identity — the stable persona preamble.
 * This text is identical across all turns and sessions,
 * making it ideal for prompt caching.
 */
export const COGNOGRAPH_IDENTITY = `You are an AI assistant integrated into Cognograph, a spatial AI workflow canvas application. You have access to tools that let you manipulate the user's workspace.

## Your Capabilities
You can create, update, search, and link nodes on a spatial canvas. Each node has a type (note, task, artifact, project, conversation, text, orchestrator), a title, optional content, and a position on the canvas. Nodes are connected by directed edges that define context flow.

## Guidelines
1. When the user asks you to modify their workspace, use the appropriate tools.
2. After making changes, briefly confirm what you did.
3. If you're unsure about what to change, ask for clarification.
4. Be mindful of the user's workspace organization.
5. When creating new nodes, position them sensibly relative to existing content.
6. When creating artifact nodes with HTML content, ALWAYS set contentType: "html".
7. ALWAYS use batch_create when creating 2+ nodes.

## Important
- Only use tools when the user explicitly asks you to modify the workspace.
- For general questions or conversation, respond normally without tools.
- If a tool call returns an error, explain what went wrong and suggest alternatives.`

// ---------------------------------------------------------------------------
// Tool serialization
// ---------------------------------------------------------------------------

/**
 * Serialize tool definitions into a stable, sorted string.
 * Sorting by name ensures cache hits even if tool registration order varies.
 */
function serializeTools(tools: ToolDefinition[]): string {
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name))

  const sections = sorted.map((tool) => {
    const schemaStr = JSON.stringify(tool.input_schema, null, 2)
    return `### ${tool.name}\n${tool.description}\n\nInput schema:\n\`\`\`json\n${schemaStr}\n\`\`\``
  })

  return `## Available Tools\n\n${sections.join('\n\n')}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a system prompt split into cache-stable and dynamic portions.
 *
 * @param identity - The agent identity preamble (use COGNOGRAPH_IDENTITY constant)
 * @param tools - Tool definitions to include in the static prefix
 * @param bfsContext - BFS-traversed canvas context (changes per turn)
 * @returns Object with staticPrefix (cached) and dynamicSuffix (not cached)
 */
export function buildSystemPrompt(
  identity: string,
  tools: ToolDefinition[],
  bfsContext: string
): BuiltSystemPrompt {
  // Static prefix: identity + sorted tool definitions
  // This portion is identical across turns and benefits from caching
  const toolSection = tools.length > 0 ? `\n\n${serializeTools(tools)}` : ''
  const staticText = `${identity}${toolSection}`

  // Dynamic suffix: BFS context (changes every turn)
  const dynamicText = bfsContext
    ? `## Current Context\nThe following context has been gathered from nodes connected to this conversation:\n\n${bfsContext}`
    : '## Current Context\nNo connected context.'

  return {
    staticPrefix: {
      type: 'text',
      text: staticText,
      cache_control: { type: 'ephemeral' }
    },
    dynamicSuffix: {
      type: 'text',
      text: dynamicText
    }
  }
}

/**
 * Flatten the built prompt into a single string (for non-caching API paths).
 * Used when sending to the Agent SDK which expects a single system prompt string.
 */
export function flattenSystemPrompt(built: BuiltSystemPrompt): string {
  return `${built.staticPrefix.text}\n\n${built.dynamicSuffix.text}`
}
