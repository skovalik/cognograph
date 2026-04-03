// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Tool Factory — `buildTool(config)` produces a frozen, validated Tool object.
 *
 * Accepts partial config, fills fail-closed defaults, validates required fields,
 * and returns an immutable Tool.
 */

import type { Tool, ToolConfig } from './types'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TOOL_NAME_RE = /^[a-zA-Z0-9_-]+$/
const TOOL_NAME_MAX_LENGTH = 64

function validateToolConfig(config: ToolConfig): void {
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('Tool config requires a non-empty "name" string')
  }
  if (config.name.length > TOOL_NAME_MAX_LENGTH) {
    throw new Error(`Tool name "${config.name}" exceeds ${TOOL_NAME_MAX_LENGTH} characters`)
  }
  if (!TOOL_NAME_RE.test(config.name)) {
    throw new Error(
      `Tool name "${config.name}" contains invalid characters. Allowed: [a-zA-Z0-9_-]`
    )
  }

  if (!config.description || typeof config.description !== 'string') {
    throw new Error(`Tool "${config.name}": "description" is required`)
  }

  if (!config.inputSchema) {
    throw new Error(`Tool "${config.name}": "inputSchema" (ZodSchema) is required`)
  }
  // Duck-type check for Zod schema — must have .parse or .safeParse
  if (typeof (config.inputSchema as { safeParse?: unknown }).safeParse !== 'function') {
    throw new Error(
      `Tool "${config.name}": "inputSchema" must be a Zod schema (missing .safeParse)`
    )
  }

  if (typeof config.call !== 'function') {
    throw new Error(`Tool "${config.name}": "call" must be a function`)
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a validated, frozen Tool from a partial config.
 *
 * Defaults (fail-closed):
 * - isReadOnly: false
 * - isConcurrencySafe: false
 * - interruptBehavior: 'cancel'
 * - errorCascade: false
 */
export function buildTool(config: ToolConfig): Tool {
  validateToolConfig(config)

  const tool: Tool = {
    name: config.name,
    description: config.description,
    inputSchema: config.inputSchema,
    call: config.call,
    ...(config.checkPermissions ? { checkPermissions: config.checkPermissions } : {}),
    isReadOnly: config.isReadOnly ?? false,
    isConcurrencySafe: config.isConcurrencySafe ?? false,
    interruptBehavior: config.interruptBehavior ?? 'cancel',
    errorCascade: config.errorCascade ?? false,
    ...(config.prompt !== undefined ? { prompt: config.prompt } : {}),
  }

  return Object.freeze(tool)
}
