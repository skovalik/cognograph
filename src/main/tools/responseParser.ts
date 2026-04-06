// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * Response Parser — extracts tool calls from FINAL accumulated LLM messages.
 *
 * Normalizes Anthropic, OpenAI, and Gemini response shapes into a uniform
 * NormalizedToolCall[] array. Works on complete messages only, NOT streaming
 * partials.
 *
 * Parse failures produce error results (never silently skip or fail-open).
 * Missing/duplicate tool call IDs get UUID fallback via crypto.randomUUID().
 */

import { randomUUID } from 'node:crypto'
import type { LLMProvider, NormalizedToolCall } from './types'

// ---------------------------------------------------------------------------
// Anthropic parser
// ---------------------------------------------------------------------------

/**
 * Anthropic Messages API response shape (relevant subset):
 * ```
 * { content: [ { type: 'tool_use', id: string, name: string, input: object }, ... ] }
 * ```
 */
function parseAnthropic(message: unknown): NormalizedToolCall[] {
  const calls: NormalizedToolCall[] = []

  if (!message || typeof message !== 'object') return calls

  const msg = message as Record<string, unknown>
  const content = msg.content
  if (!Array.isArray(content)) return calls

  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_use'
    ) {
      const b = block as Record<string, unknown>
      calls.push({
        id: typeof b.id === 'string' && b.id.length > 0 ? b.id : randomUUID(),
        name: String(b.name ?? ''),
        input: (typeof b.input === 'object' && b.input !== null ? b.input : {}) as Record<
          string,
          unknown
        >,
      })
    }
  }

  return calls
}

// ---------------------------------------------------------------------------
// OpenAI parser
// ---------------------------------------------------------------------------

/**
 * OpenAI Chat Completions response shape (relevant subset):
 * ```
 * {
 *   choices: [{
 *     message: {
 *       tool_calls: [{ id: string, type: 'function', function: { name, arguments: string } }]
 *     }
 *   }]
 * }
 * ```
 *
 * The `message` object may also be passed directly (without the choices wrapper).
 */
function parseOpenAI(message: unknown): NormalizedToolCall[] {
  const calls: NormalizedToolCall[] = []

  if (!message || typeof message !== 'object') return calls

  const msg = message as Record<string, unknown>

  // Support both full response (choices[0].message) and direct message object
  let toolCalls: unknown[] | undefined

  if (Array.isArray(msg.tool_calls)) {
    toolCalls = msg.tool_calls
  } else if (Array.isArray(msg.choices)) {
    const firstChoice = (msg.choices as Record<string, unknown>[])[0]
    if (firstChoice && typeof firstChoice === 'object') {
      const choiceMsg = (firstChoice as Record<string, unknown>).message
      if (choiceMsg && typeof choiceMsg === 'object') {
        const tc = (choiceMsg as Record<string, unknown>).tool_calls
        if (Array.isArray(tc)) {
          toolCalls = tc
        }
      }
    }
  }

  if (!toolCalls) return calls

  for (const tc of toolCalls) {
    if (!tc || typeof tc !== 'object') continue

    const call = tc as Record<string, unknown>
    const fn = call.function
    if (!fn || typeof fn !== 'object') continue

    const fnObj = fn as Record<string, unknown>
    const name = String(fnObj.name ?? '')
    const argsStr = fnObj.arguments

    // Parse failure = error result, NOT silently skip
    let input: Record<string, unknown>
    if (typeof argsStr === 'string') {
      try {
        const parsed: unknown = JSON.parse(argsStr)
        input =
          typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
      } catch {
        // Return a tool call with error info — never silently skip
        input = {
          __parse_error: true,
          __raw_arguments: argsStr,
          __error_message: `Failed to parse tool arguments as JSON`,
        }
      }
    } else if (typeof argsStr === 'object' && argsStr !== null) {
      // Some OpenAI-compatible APIs send pre-parsed arguments
      input = argsStr as Record<string, unknown>
    } else {
      input = {}
    }

    calls.push({
      id: typeof call.id === 'string' && call.id.length > 0 ? call.id : randomUUID(),
      name,
      input,
    })
  }

  return calls
}

// ---------------------------------------------------------------------------
// Gemini parser
// ---------------------------------------------------------------------------

/**
 * Gemini GenerateContent response shape (relevant subset):
 * ```
 * {
 *   candidates: [{
 *     content: {
 *       parts: [{ functionCall: { name: string, args: object } }]
 *     }
 *   }]
 * }
 * ```
 *
 * The `content` object may also be passed directly (without candidates wrapper).
 */
function parseGemini(message: unknown): NormalizedToolCall[] {
  const calls: NormalizedToolCall[] = []

  if (!message || typeof message !== 'object') return calls

  const msg = message as Record<string, unknown>

  // Collect parts from various shapes
  let parts: unknown[] | undefined

  if (Array.isArray(msg.parts)) {
    parts = msg.parts
  } else if (msg.content && typeof msg.content === 'object') {
    const content = msg.content as Record<string, unknown>
    if (Array.isArray(content.parts)) {
      parts = content.parts
    }
  } else if (Array.isArray(msg.candidates)) {
    const firstCandidate = (msg.candidates as Record<string, unknown>[])[0]
    if (firstCandidate && typeof firstCandidate === 'object') {
      const content = (firstCandidate as Record<string, unknown>).content
      if (content && typeof content === 'object') {
        const p = (content as Record<string, unknown>).parts
        if (Array.isArray(p)) {
          parts = p
        }
      }
    }
  }

  if (!parts) return calls

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue

    const p = part as Record<string, unknown>
    const fc = p.functionCall
    if (!fc || typeof fc !== 'object') continue

    const fnCall = fc as Record<string, unknown>
    calls.push({
      // Gemini does not provide call IDs — always generate UUID
      id: randomUUID(),
      name: String(fnCall.name ?? ''),
      input: (typeof fnCall.args === 'object' && fnCall.args !== null ? fnCall.args : {}) as Record<
        string,
        unknown
      >,
    })
  }

  return calls
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Ensure all tool call IDs are unique. Duplicates get a new UUID.
 */
function deduplicateIds(calls: NormalizedToolCall[]): NormalizedToolCall[] {
  const seen = new Set<string>()
  return calls.map((call) => {
    if (seen.has(call.id)) {
      return { ...call, id: randomUUID() }
    }
    seen.add(call.id)
    return call
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse tool calls from a FINAL accumulated LLM message.
 *
 * @param message - The complete response object from the LLM provider
 * @param provider - Which provider format to parse ('anthropic' | 'openai' | 'gemini')
 * @returns Normalized tool calls with guaranteed unique IDs
 */
export function parseToolCalls(message: unknown, provider: LLMProvider): NormalizedToolCall[] {
  let calls: NormalizedToolCall[]

  switch (provider) {
    case 'anthropic':
      calls = parseAnthropic(message)
      break
    case 'openai':
      calls = parseOpenAI(message)
      break
    case 'gemini':
      calls = parseGemini(message)
      break
    default: {
      // Exhaustive check — if a new provider is added, TypeScript will catch it
      const _exhaustive: never = provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }

  return deduplicateIds(calls)
}
