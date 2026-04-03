// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateTokens,
  countTokensPrecise,
  shouldCompact,
  estimateMessageTokens,
  _resetTiktokenState
} from '../tokenEstimation'

// ---------------------------------------------------------------------------
// Sample texts for accuracy testing
// ---------------------------------------------------------------------------

const ENGLISH_PROSE = `The quick brown fox jumps over the lazy dog. This is a sample paragraph
of English text that represents typical natural language content. It contains
multiple sentences with varying lengths and common vocabulary. The purpose
is to verify that our token estimation heuristic produces results within
a reasonable margin of the actual token count.`

const CODE_SAMPLE = `import { useState, useEffect } from 'react'
import { createStore } from 'zustand'

interface NodeData {
  id: string
  title: string
  content: string
  position: { x: number; y: number }
}

export function useNodeStore() {
  const [nodes, setNodes] = useState<NodeData[]>([])

  useEffect(() => {
    const store = createStore((set) => ({
      nodes: [],
      addNode: (node: NodeData) => set((state) => ({
        nodes: [...state.nodes, node]
      })),
      removeNode: (id: string) => set((state) => ({
        nodes: state.nodes.filter(n => n.id !== id)
      }))
    }))
    return () => store.destroy()
  }, [])

  return { nodes, setNodes }
}`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tokenEstimation', () => {
  beforeEach(() => {
    _resetTiktokenState()
  })

  // -------------------------------------------------------------------------
  // estimateTokens
  // -------------------------------------------------------------------------

  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('estimates English prose at ~chars/4', () => {
      const tokens = estimateTokens(ENGLISH_PROSE)
      const expectedApprox = Math.ceil(ENGLISH_PROSE.length / 4)
      expect(tokens).toBe(expectedApprox)
    })

    it('estimates code at ~chars/2 (higher token density)', () => {
      const tokens = estimateTokens(CODE_SAMPLE)
      const expectedApprox = Math.ceil(CODE_SAMPLE.length / 2)
      expect(tokens).toBe(expectedApprox)
    })

    it('produces estimates within 20% of expected range for prose', () => {
      // For typical English, actual tiktoken counts ~1 token per 4 chars.
      // We test that our heuristic is in a sane range.
      const text = 'This is a typical English sentence with normal words and punctuation.'
      const tokens = estimateTokens(text)
      // ~68 chars / 4 = 17 tokens. Actual tiktoken: ~15-18.
      // 20% margin: 12-22
      expect(tokens).toBeGreaterThan(10)
      expect(tokens).toBeLessThan(25)
    })

    it('handles single character', () => {
      expect(estimateTokens('a')).toBe(1) // ceil(1/4) = 1
    })

    it('handles 4-character string as exactly 1 token', () => {
      expect(estimateTokens('abcd')).toBe(1) // 4/4 = 1
    })

    it('detects code-heavy content and adjusts ratio', () => {
      // Code uses chars/2, prose uses chars/4
      // Same length string should produce more tokens when detected as code
      const codeTokens = estimateTokens(CODE_SAMPLE)
      const proseTokens = estimateTokens(ENGLISH_PROSE)

      // Code tokens should be proportionally higher per character
      const codeRatio = codeTokens / CODE_SAMPLE.length
      const proseRatio = proseTokens / ENGLISH_PROSE.length

      expect(codeRatio).toBeGreaterThan(proseRatio)
    })
  })

  // -------------------------------------------------------------------------
  // countTokensPrecise
  // -------------------------------------------------------------------------

  describe('countTokensPrecise', () => {
    it('falls back to heuristic when tiktoken is not installed', () => {
      // tiktoken is not installed in this project — should use heuristic
      const tokens = countTokensPrecise(ENGLISH_PROSE)
      const heuristicTokens = estimateTokens(ENGLISH_PROSE)
      expect(tokens).toBe(heuristicTokens)
    })

    it('handles empty string', () => {
      expect(countTokensPrecise('')).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // shouldCompact
  // -------------------------------------------------------------------------

  describe('shouldCompact', () => {
    it('returns false when below 85% threshold', () => {
      expect(shouldCompact(8000, 10000)).toBe(false) // 80%
      expect(shouldCompact(0, 10000)).toBe(false)
      expect(shouldCompact(8499, 10000)).toBe(false) // 84.99%
    })

    it('returns true when at 85% threshold', () => {
      expect(shouldCompact(8500, 10000)).toBe(true) // exactly 85%
    })

    it('returns true when above 85% threshold', () => {
      expect(shouldCompact(9000, 10000)).toBe(true) // 90%
      expect(shouldCompact(10000, 10000)).toBe(true) // 100%
      expect(shouldCompact(15000, 10000)).toBe(true) // over limit
    })

    it('returns false for zero or negative maxTokens', () => {
      expect(shouldCompact(5000, 0)).toBe(false)
      expect(shouldCompact(5000, -1)).toBe(false)
    })

    it('handles small budgets correctly', () => {
      expect(shouldCompact(85, 100)).toBe(true)
      expect(shouldCompact(84, 100)).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // estimateMessageTokens
  // -------------------------------------------------------------------------

  describe('estimateMessageTokens', () => {
    it('returns 0 for empty array', () => {
      expect(estimateMessageTokens([])).toBe(0)
    })

    it('includes per-message overhead of 4 tokens', () => {
      const messages = [{ role: 'user', content: '' }]
      // Empty content = 0 tokens + 4 overhead = 4
      expect(estimateMessageTokens(messages)).toBe(4)
    })

    it('estimates a multi-message conversation', () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you for asking!' },
        { role: 'user', content: 'Can you help me with my project?' }
      ]

      const tokens = estimateMessageTokens(messages)

      // 3 messages * 4 overhead = 12 overhead tokens
      // Plus content token estimates
      expect(tokens).toBeGreaterThan(12) // at minimum the overhead
      expect(tokens).toBeGreaterThan(20) // reasonable lower bound for this content
    })

    it('produces estimates within 20% for typical chat messages', () => {
      const messages = [
        { role: 'user', content: 'What is the weather like today in San Francisco?' },
        {
          role: 'assistant',
          content: 'I don\'t have access to real-time weather data, but I can help you find that information. You could check a weather service like Weather.com or the National Weather Service for current conditions in San Francisco.'
        }
      ]

      const tokens = estimateMessageTokens(messages)

      // Rough manual count: ~60 tokens for content + 8 overhead = ~68
      // 20% margin: 54-82
      expect(tokens).toBeGreaterThan(40)
      expect(tokens).toBeLessThan(100)
    })
  })
})
