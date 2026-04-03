// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordUsage,
  getSessionTotal,
  getConversationTotal,
  resetSession,
  _getModelPricing,
  _calculateCost,
} from '../costTracker'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 6 decimal places to avoid floating-point noise in assertions. */
function round(n: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('costTracker', () => {
  beforeEach(() => {
    resetSession()
  })

  // -------------------------------------------------------------------------
  // recordUsage
  // -------------------------------------------------------------------------

  describe('recordUsage', () => {
    it('records usage and returns a complete TokenUsageRecord', () => {
      const record = recordUsage(
        { uncachedInput: 1000, cachedInput: 500, cacheWrite: 200, output: 300 },
        'claude-sonnet-4',
        'anthropic',
      )

      expect(record.uncachedInput).toBe(1000)
      expect(record.cachedInput).toBe(500)
      expect(record.cacheWrite).toBe(200)
      expect(record.output).toBe(300)
      expect(record.model).toBe('claude-sonnet-4')
      expect(record.provider).toBe('anthropic')
      expect(record.timestamp).toBeTruthy()
      expect(record.estimatedCostUSD).toBeGreaterThan(0)
    })

    it('defaults cacheWrite to 0 when not provided', () => {
      const record = recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'claude-sonnet-4',
        'anthropic',
      )

      expect(record.cacheWrite).toBe(0)
    })

    it('returns estimatedCostUSD of 0 for unknown models', () => {
      const record = recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'unknown-model-xyz',
        'unknown-provider',
      )

      expect(record.estimatedCostUSD).toBe(0)
    })

    it('produces a valid ISO timestamp', () => {
      const record = recordUsage(
        { uncachedInput: 100, cachedInput: 0, output: 50 },
        'claude-sonnet-4',
        'anthropic',
      )

      // Should parse without error
      const parsed = new Date(record.timestamp)
      expect(parsed.getTime()).not.toBeNaN()
    })
  })

  // -------------------------------------------------------------------------
  // Cache pricing normalization per provider
  // -------------------------------------------------------------------------

  describe('cache pricing normalization', () => {
    it('Anthropic: cache_read at 0.1x input price', () => {
      const pricing = _getModelPricing()
      const sonnet = pricing['claude-sonnet-4']!

      // Cache read should be 0.1x input
      expect(round(sonnet.cachedInput / sonnet.input)).toBe(0.1)
    })

    it('Anthropic: cache_write at 1.25x input price', () => {
      const pricing = _getModelPricing()
      const sonnet = pricing['claude-sonnet-4']!

      // Cache write should be 1.25x input
      expect(round(sonnet.cacheWrite / sonnet.input)).toBe(1.25)
    })

    it('OpenAI: cached tokens at 0.25x input price (gpt-4.1)', () => {
      const pricing = _getModelPricing()
      const gpt41 = pricing['gpt-4.1']!

      expect(round(gpt41.cachedInput / gpt41.input)).toBe(0.25)
    })

    it('Gemini: has explicit cache pricing distinct from input', () => {
      const pricing = _getModelPricing()
      const geminiPro = pricing['gemini-2.5-pro']!

      // Cache price should differ from input price
      expect(geminiPro.cachedInput).not.toBe(geminiPro.input)
      expect(geminiPro.cachedInput).toBeLessThan(geminiPro.input)
    })

    it('correctly calculates cost with mixed cached and uncached input', () => {
      // 1M uncached input + 1M cached input on claude-sonnet-4
      // uncached: $3.00, cached: $0.30 → total input cost: $3.30
      const cost = _calculateCost(1_000_000, 1_000_000, 0, 0, 'claude-sonnet-4')
      expect(round(cost, 2)).toBe(3.3)
    })

    it('calculates output cost correctly', () => {
      // 1M output tokens on claude-sonnet-4 → $15.00
      const cost = _calculateCost(0, 0, 0, 1_000_000, 'claude-sonnet-4')
      expect(round(cost, 2)).toBe(15.0)
    })

    it('calculates cache write cost correctly for Anthropic', () => {
      // 1M cache write tokens on claude-sonnet-4 → $3.75
      const cost = _calculateCost(0, 0, 1_000_000, 0, 'claude-sonnet-4')
      expect(round(cost, 2)).toBe(3.75)
    })
  })

  // -------------------------------------------------------------------------
  // Session totals
  // -------------------------------------------------------------------------

  describe('getSessionTotal', () => {
    it('returns zero totals when no usage recorded', () => {
      const total = getSessionTotal()
      expect(total.uncachedInput).toBe(0)
      expect(total.cachedInput).toBe(0)
      expect(total.cacheWrite).toBe(0)
      expect(total.output).toBe(0)
      expect(total.estimatedCostUSD).toBe(0)
      expect(total.recordCount).toBe(0)
    })

    it('accumulates multiple usage records', () => {
      recordUsage(
        { uncachedInput: 1000, cachedInput: 500, output: 200 },
        'claude-sonnet-4',
        'anthropic',
      )
      recordUsage(
        { uncachedInput: 2000, cachedInput: 1000, output: 400 },
        'claude-sonnet-4',
        'anthropic',
      )

      const total = getSessionTotal()
      expect(total.uncachedInput).toBe(3000)
      expect(total.cachedInput).toBe(1500)
      expect(total.output).toBe(600)
      expect(total.recordCount).toBe(2)
      expect(total.estimatedCostUSD).toBeGreaterThan(0)
    })

    it('accumulates across different models', () => {
      recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'claude-sonnet-4',
        'anthropic',
      )
      recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'gpt-4.1',
        'openai',
      )

      const total = getSessionTotal()
      expect(total.uncachedInput).toBe(2000)
      expect(total.output).toBe(1000)
      expect(total.recordCount).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // Conversation totals
  // -------------------------------------------------------------------------

  describe('getConversationTotal', () => {
    it('returns zero totals for unknown conversation ID', () => {
      const total = getConversationTotal('nonexistent')
      expect(total.uncachedInput).toBe(0)
      expect(total.recordCount).toBe(0)
    })

    it('tracks usage per conversation independently', () => {
      recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'claude-sonnet-4',
        'anthropic',
        'conv-a',
      )
      recordUsage(
        { uncachedInput: 2000, cachedInput: 0, output: 1000 },
        'claude-sonnet-4',
        'anthropic',
        'conv-b',
      )

      const totalA = getConversationTotal('conv-a')
      const totalB = getConversationTotal('conv-b')

      expect(totalA.uncachedInput).toBe(1000)
      expect(totalA.output).toBe(500)
      expect(totalA.recordCount).toBe(1)

      expect(totalB.uncachedInput).toBe(2000)
      expect(totalB.output).toBe(1000)
      expect(totalB.recordCount).toBe(1)
    })

    it('accumulates multiple records in the same conversation', () => {
      recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'claude-sonnet-4',
        'anthropic',
        'conv-a',
      )
      recordUsage(
        { uncachedInput: 500, cachedInput: 100, output: 200 },
        'claude-sonnet-4',
        'anthropic',
        'conv-a',
      )

      const total = getConversationTotal('conv-a')
      expect(total.uncachedInput).toBe(1500)
      expect(total.cachedInput).toBe(100)
      expect(total.output).toBe(700)
      expect(total.recordCount).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // resetSession
  // -------------------------------------------------------------------------

  describe('resetSession', () => {
    it('clears session totals', () => {
      recordUsage(
        { uncachedInput: 5000, cachedInput: 0, output: 2000 },
        'claude-sonnet-4',
        'anthropic',
      )

      expect(getSessionTotal().recordCount).toBe(1)

      resetSession()

      const total = getSessionTotal()
      expect(total.uncachedInput).toBe(0)
      expect(total.output).toBe(0)
      expect(total.estimatedCostUSD).toBe(0)
      expect(total.recordCount).toBe(0)
    })

    it('clears conversation totals', () => {
      recordUsage(
        { uncachedInput: 1000, cachedInput: 0, output: 500 },
        'claude-sonnet-4',
        'anthropic',
        'conv-x',
      )

      resetSession()

      const total = getConversationTotal('conv-x')
      expect(total.recordCount).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // Model name matching
  // -------------------------------------------------------------------------

  describe('model name matching', () => {
    it('matches versioned model names via prefix', () => {
      const record = recordUsage(
        { uncachedInput: 1_000_000, cachedInput: 0, output: 0 },
        'claude-sonnet-4-20260514',
        'anthropic',
      )

      // Should match claude-sonnet-4 pricing: $3.00 per 1M input tokens
      expect(round(record.estimatedCostUSD, 2)).toBe(3.0)
    })

    it('handles exact model name match', () => {
      const record = recordUsage(
        { uncachedInput: 1_000_000, cachedInput: 0, output: 0 },
        'claude-sonnet-4',
        'anthropic',
      )

      expect(round(record.estimatedCostUSD, 2)).toBe(3.0)
    })
  })
})
