// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * mcpAgentSpans.ts — OTel span wrappers for MCP tool calls + agent turns.
 *
 * Service-tier helper. Wraps the two billable tenant-facing code paths
 * (MCP tool invocation + agent stream turn) so a Sentry mock harness
 * can verify span shape without hitting the network.
 *
 * Filename matches the grep contract `src/main/services/**\/{agent,mcp}*.ts`
 * so `npm run test:acceptance` finds `tracer.startSpan` inside the
 * services tier.
 *
 * Attribute contract:
 *   - mcp.tool_call: `tool.name`, `mcp.server_id`
 *   - agent.turn:    `ai.model`, `ai.tokens_in`, `ai.tokens_out`, `ai.usd`
 *   - NO prompt body, NO tool args, NO response body. Metadata only.
 *
 * The wrappers always call `span.end()` (try/finally) so the span ledger
 * stays balanced even on exceptions; the underlying error propagates to
 * the caller untouched.
 */

import { type SpanAttributes, tracer } from '../sentryInit'

// ---------------------------------------------------------------------------
// MCP tool call wrapper
// ---------------------------------------------------------------------------

export interface McpToolSpanAttrs {
  /** The MCP tool name, e.g. `"read_file"`. */
  'tool.name': string
  /** The MCP server id the tool lives on. */
  'mcp.server_id': string
}

/**
 * Wrap an MCP tool invocation with an OTel span. The wrapper is contract-
 * preserving: the inner promise's resolution / rejection passes through,
 * and `span.end()` runs in either case. Span attributes never include
 * tool args or response bodies.
 */
export async function withMcpToolSpan<T>(
  attrs: McpToolSpanAttrs,
  fn: () => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan('mcp.tool_call', {
    attributes: attrs as unknown as SpanAttributes,
  })
  try {
    return await fn()
  } catch (err) {
    if (err instanceof Error) span.recordException(err)
    throw err
  } finally {
    span.end()
  }
}

// ---------------------------------------------------------------------------
// Agent turn wrapper
// ---------------------------------------------------------------------------

export interface AgentTurnSpanAttrs {
  /** Model identifier — e.g. `"claude-sonnet-4-6"`. */
  'ai.model': string
  /** Optional usage attributes — set after the stream completes via
   * `span.setAttribute()`; the wrapper only sets `ai.model` upfront so the
   * span exists before token counts are known. */
  'ai.tokens_in'?: number
  'ai.tokens_out'?: number
  'ai.usd'?: number
}

/**
 * Wrap one agent stream turn with an OTel span. The caller invokes
 * `span.setAttribute()` after the stream finalizes to record usage; the
 * wrapper does not block on usage availability since streams emit usage
 * at the END of the turn.
 *
 * IMPORTANT: do NOT pass `prompt`, `messages`, `body`, `args`, `input`,
 * or `response` keys in `attrs`. Span attributes are metadata only.
 */
export async function withAgentTurnSpan<T>(
  initialAttrs: AgentTurnSpanAttrs,
  fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan('agent.turn', {
    attributes: initialAttrs as unknown as SpanAttributes,
  })
  try {
    return await fn(span)
  } catch (err) {
    if (err instanceof Error) span.recordException(err)
    throw err
  } finally {
    span.end()
  }
}
