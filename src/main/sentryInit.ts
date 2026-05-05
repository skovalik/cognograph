// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * sentryInit.ts — Sentry init + tracer.startSpan facade.
 *
 * Provides a `tracer.startSpan(name, { attributes })` shim so call sites
 * (agentLoop.ts + service-tier wrappers in `mcpAgentSpans.ts`) can wrap
 * agent / MCP tool invocations with OpenTelemetry-shaped spans without
 * caring whether the underlying SDK uses `startInactiveSpan` (current
 * @sentry/electron) or future variants.
 *
 * Test contract: consumers (agentLoop.test.ts, etc.) that import this
 * module must `vi.mock('@sentry/electron/main', () => ({ ... }))` at the
 * top of the test file so the static import doesn't pull in electron's
 * `app` module under jsdom. The colocated `mcpAgentSpans.test.ts` shows
 * the canonical mock shape.
 *
 * Span attribute contract:
 *   - `ai.model`, `ai.tokens_in`, `ai.tokens_out`, `ai.usd` for agent turns
 *   - `tool.name`, `mcp.server_id` for MCP tool calls
 *   - **NO** `prompt`, `messages`, `body`, `args`, `input`, or `response`
 *     attributes. Spans carry metadata only — never the PII payload.
 *   - The contract is enforced at the call site (we don't auto-strip
 *     here); the runtime tests assert only the safe attributes are passed.
 */

import * as Sentry from '@sentry/electron/main'

// ---------------------------------------------------------------------------
// Tracer facade — wraps Sentry.startInactiveSpan with a stable interface
// ---------------------------------------------------------------------------

export type SpanAttributeValue = string | number | boolean | undefined | null

export interface SpanAttributes {
  [key: string]: SpanAttributeValue
}

export interface ManagedSpan {
  end(): void
  setAttribute(key: string, value: SpanAttributeValue): void
  recordException(err: Error): void
}

interface SentryInactiveSpan {
  end?: () => void
  setAttribute?: (key: string, value: unknown) => void
}

type StartInactiveSpan = (args: {
  name: string
  attributes?: Record<string, unknown>
}) => SentryInactiveSpan | undefined

function noopSpan(): ManagedSpan {
  return {
    end: () => {},
    setAttribute: () => {},
    recordException: () => {},
  }
}

export const tracer = {
  /**
   * Start an inactive span for a tool / agent call. Caller is responsible
   * for calling `span.end()` (use `try/finally`).
   *
   * Attribute keys must be metadata only — see the module header for the
   * banned-keys contract.
   */
  startSpan(name: string, opts: { attributes?: SpanAttributes } = {}): ManagedSpan {
    const startInactive = (Sentry as unknown as { startInactiveSpan?: StartInactiveSpan })
      .startInactiveSpan
    if (typeof startInactive !== 'function') {
      return noopSpan()
    }

    let underlying: SentryInactiveSpan | undefined
    try {
      underlying = startInactive({
        name,
        attributes: opts.attributes ? sanitizeAttributes(opts.attributes) : undefined,
      })
    } catch {
      return noopSpan()
    }
    if (!underlying) return noopSpan()

    return {
      end: () => {
        try {
          underlying?.end?.()
        } catch {
          // Sentry SDK errors must not leak to the call path.
        }
      },
      setAttribute: (key, value) => {
        try {
          underlying?.setAttribute?.(key, value as unknown)
        } catch {
          // ignore
        }
      },
      recordException: (err) => {
        try {
          Sentry.captureException?.(err)
        } catch {
          // ignore
        }
      },
    }
  },
}

/**
 * Drop attribute values that are explicitly undefined or null so the OTel
 * exporter doesn't serialize them as the literal string "undefined".
 *
 * Does NOT enforce the banned-keys contract — that's the call site's
 * responsibility, validated by the runtime tests.
 */
function sanitizeAttributes(attrs: SpanAttributes): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }
  return out
}
