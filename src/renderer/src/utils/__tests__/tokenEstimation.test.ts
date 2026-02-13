import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  getUsageLevel,
  getModelContextLimit,
  calculateTokenUsage,
  MODEL_CONTEXT_LIMITS
} from '../tokenEstimation'

describe('tokenEstimation', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('should return 0 for null/undefined-like input', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0)
      expect(estimateTokens(undefined as unknown as string)).toBe(0)
    })

    it('should estimate ~4 characters per token', () => {
      // 8 characters = 2 tokens
      expect(estimateTokens('12345678')).toBe(2)
      // 4 characters = 1 token
      expect(estimateTokens('1234')).toBe(1)
      // 5 characters = 2 tokens (ceiling)
      expect(estimateTokens('12345')).toBe(2)
    })

    it('should handle longer text', () => {
      const text = 'a'.repeat(100) // 100 chars = 25 tokens
      expect(estimateTokens(text)).toBe(25)
    })

    it('should handle text with spaces and newlines', () => {
      const text = 'Hello world\nNew line'
      expect(estimateTokens(text)).toBe(Math.ceil(text.length / 4))
    })
  })

  describe('getUsageLevel', () => {
    it('should return "low" for usage under 50%', () => {
      expect(getUsageLevel(0)).toBe('low')
      expect(getUsageLevel(25)).toBe('low')
      expect(getUsageLevel(49)).toBe('low')
    })

    it('should return "medium" for usage 50-75%', () => {
      expect(getUsageLevel(50)).toBe('medium')
      expect(getUsageLevel(60)).toBe('medium')
      expect(getUsageLevel(74)).toBe('medium')
    })

    it('should return "high" for usage 75-90%', () => {
      expect(getUsageLevel(75)).toBe('high')
      expect(getUsageLevel(80)).toBe('high')
      expect(getUsageLevel(89)).toBe('high')
    })

    it('should return "critical" for usage 90%+', () => {
      expect(getUsageLevel(90)).toBe('critical')
      expect(getUsageLevel(95)).toBe('critical')
      expect(getUsageLevel(100)).toBe('critical')
    })
  })

  describe('getModelContextLimit', () => {
    it('should return default limit for undefined model', () => {
      expect(getModelContextLimit(undefined)).toBe(MODEL_CONTEXT_LIMITS['default'])
    })

    it('should return exact match for known models', () => {
      expect(getModelContextLimit('claude-3-opus')).toBe(200000)
      expect(getModelContextLimit('gpt-4')).toBe(8192)
      expect(getModelContextLimit('gemini-pro')).toBe(32000)
    })

    it('should return partial match (case-insensitive)', () => {
      expect(getModelContextLimit('Claude-3-Opus-20240229')).toBe(200000)
      expect(getModelContextLimit('gpt-4-turbo-preview')).toBe(128000)
    })

    it('should return default for unknown models', () => {
      expect(getModelContextLimit('unknown-model-xyz')).toBe(MODEL_CONTEXT_LIMITS['default'])
    })
  })

  describe('calculateTokenUsage', () => {
    it('should calculate token usage correctly', () => {
      const usage = calculateTokenUsage(
        'Context text here', // 17 chars = 5 tokens
        [{ content: 'Message one' }, { content: 'Message two' }], // 11 + 11 = 22 chars = 6 tokens
        'System prompt', // 13 chars = 4 tokens
        'claude-3-opus'
      )

      expect(usage.contextTokens).toBe(5)
      expect(usage.messageTokens).toBe(6)
      expect(usage.systemTokens).toBe(4)
      expect(usage.totalTokens).toBe(15)
      expect(usage.maxTokens).toBe(200000)
      expect(usage.percentage).toBeCloseTo(0.0075, 3)
    })

    it('should handle empty inputs', () => {
      const usage = calculateTokenUsage('', [], undefined)

      expect(usage.contextTokens).toBe(0)
      expect(usage.messageTokens).toBe(0)
      expect(usage.systemTokens).toBe(0)
      expect(usage.totalTokens).toBe(0)
      expect(usage.percentage).toBe(0)
    })

    it('should cap percentage at 100%', () => {
      // Create a huge context that exceeds the limit
      const hugeContext = 'a'.repeat(500000) // 125000 tokens
      const usage = calculateTokenUsage(hugeContext, [], undefined, 'gpt-4') // 8192 limit

      expect(usage.percentage).toBe(100)
    })
  })
})
