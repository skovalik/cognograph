// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Agent Tool Resolver — filters a ToolPool based on ConnectedAgent configuration.
 *
 * Supports three filtering modes:
 *   1. Whitelist (`tools`) — only include named tools
 *   2. Blacklist (`disallowedTools`) — exclude named tools (ignored when whitelist is set)
 *   3. ReadOnly (`readOnly`) — only include tools where `isReadOnly === true`
 *
 * Whitelist takes precedence over blacklist. ReadOnly is applied as a final filter
 * regardless of whitelist/blacklist.
 */

import type { ConnectedAgent } from '@shared/types'
import { assembleToolPool } from './assembleToolPool'
import type { Tool, ToolPool } from './types'

// ---------------------------------------------------------------------------
// Agent tool filtering config (subset of ConnectedAgent relevant to tools)
// ---------------------------------------------------------------------------

export interface AgentToolConfig {
  /** Whitelist: if set, only these tools are available */
  tools?: string[]
  /** Blacklist: if set, these tools are excluded (ignored when `tools` is set) */
  disallowedTools?: string[]
  /** If true, only tools with isReadOnly=true are available */
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter a ToolPool based on a ConnectedAgent's tool configuration.
 *
 * Filtering order:
 *  1. If `config.tools` is set (whitelist), only include tools whose name is
 *     in the list. Blacklist is ignored.
 *  2. If `config.disallowedTools` is set (blacklist) and no whitelist,
 *     exclude tools whose name is in the list.
 *  3. If `config.readOnly` is true, filter to only tools with `isReadOnly === true`.
 *
 * Returns a new ToolPool containing only the filtered tools.
 */
export function resolveAgentTools(
  pool: ToolPool,
  config: AgentToolConfig | ConnectedAgent,
): ToolPool {
  let tools: Tool[] = [...pool.list()]

  // Step 1: Whitelist or blacklist
  if (config.tools && config.tools.length > 0) {
    // Whitelist takes precedence — only include named tools
    const allowedSet = new Set(config.tools)
    tools = tools.filter((t) => allowedSet.has(t.name))
  } else if (config.disallowedTools && config.disallowedTools.length > 0) {
    // Blacklist — exclude named tools
    const blockedSet = new Set(config.disallowedTools)
    tools = tools.filter((t) => !blockedSet.has(t.name))
  }

  // Step 2: ReadOnly filter (applied after whitelist/blacklist)
  if (config.readOnly) {
    tools = tools.filter((t) => t.isReadOnly)
  }

  // Build a new pool from the filtered tools
  return assembleToolPool(tools, [])
}
