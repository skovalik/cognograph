// =============================================================================
// AI CONFIG LEARNING SERVICE
// =============================================================================
// Learns from user interactions to improve suggestions over time

import { nanoid } from 'nanoid'
import type {
  AIConfigPattern,
  AIConfigFeedback,
  AIGeneratedConfig,
  ActionTriggerType,
  ActionStepType
} from '@shared/actionTypes'

const STORAGE_KEY = 'ai_config_learning'
const FEEDBACK_STORAGE_KEY = 'ai_config_feedback'
const PROMPT_HISTORY_KEY = 'ai_config_prompt_history'
const MAX_PATTERNS = 50
const MAX_FEEDBACK_RECORDS = 100
const MAX_PROMPT_HISTORY = 25
const DECAY_HALF_LIFE_DAYS = 30

// Prompt history entry type
export interface PromptHistoryEntry {
  id: string                  // nanoid for unique ID
  prompt: string              // Full original description
  triggerType?: string        // e.g., 'property-change', 'schedule'
  appliedCount: number        // Times user applied this prompt
  lastUsed: number            // timestamp
  wasSuccessful: boolean      // Based on feedback
}

// Stop words to filter out from keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
  'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
])

class AIConfigLearning {
  private patterns: AIConfigPattern[] = []
  private feedbackRecords: AIConfigFeedback[] = []
  private promptHistory: PromptHistoryEntry[] = []

  constructor() {
    this.load()
    this.loadPromptHistory()
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private load(): void {
    try {
      const patternsStored = localStorage.getItem(STORAGE_KEY)
      if (patternsStored) {
        this.patterns = JSON.parse(patternsStored)
      }

      const feedbackStored = localStorage.getItem(FEEDBACK_STORAGE_KEY)
      if (feedbackStored) {
        this.feedbackRecords = JSON.parse(feedbackStored)
      }
    } catch (error) {
      console.warn('Failed to load AI config learning data:', error)
      this.patterns = []
      this.feedbackRecords = []
    }
  }

  private savePatterns(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.patterns))
    } catch (error) {
      console.warn('Failed to save AI config patterns:', error)
    }
  }

  private saveFeedback(): void {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(this.feedbackRecords))
    } catch (error) {
      console.warn('Failed to save AI config feedback:', error)
    }
  }

  // -------------------------------------------------------------------------
  // Prompt History Persistence
  // -------------------------------------------------------------------------

  private loadPromptHistory(): void {
    try {
      const stored = localStorage.getItem(PROMPT_HISTORY_KEY)
      this.promptHistory = stored ? JSON.parse(stored) : []
    } catch {
      this.promptHistory = []
    }
  }

  private savePromptHistory(): void {
    try {
      localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(this.promptHistory))
    } catch {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // Public API: Prompt History
  // -------------------------------------------------------------------------

  recordPrompt(prompt: string, triggerType?: string): void {
    const trimmed = prompt.trim()
    if (trimmed.length < 10) return // Too short

    // Check for duplicate (similar prompt)
    const existing = this.promptHistory.find(
      h => h.prompt.toLowerCase() === trimmed.toLowerCase()
    )

    if (existing) {
      existing.appliedCount++
      existing.lastUsed = Date.now()
      if (triggerType) existing.triggerType = triggerType
    } else {
      this.promptHistory.unshift({
        id: nanoid(8),
        prompt: trimmed,
        triggerType,
        appliedCount: 1,
        lastUsed: Date.now(),
        wasSuccessful: true
      })
      // Limit size
      if (this.promptHistory.length > MAX_PROMPT_HISTORY) {
        this.promptHistory = this.promptHistory.slice(0, MAX_PROMPT_HISTORY)
      }
    }
    this.savePromptHistory()
  }

  getPromptHistory(): PromptHistoryEntry[] {
    // Sort by lastUsed descending
    return [...this.promptHistory].sort((a, b) => b.lastUsed - a.lastUsed)
  }

  deletePromptEntry(id: string): void {
    this.promptHistory = this.promptHistory.filter(h => h.id !== id)
    this.savePromptHistory()
  }

  markPromptFailed(prompt: string): void {
    const entry = this.promptHistory.find(h => h.prompt === prompt)
    if (entry) {
      entry.wasSuccessful = false
      this.savePromptHistory()
    }
  }

  // -------------------------------------------------------------------------
  // Keyword Extraction
  // -------------------------------------------------------------------------

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
      .slice(0, 10) // Limit keywords
  }

  private keywordOverlap(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0
    const intersection = a.filter(x => b.includes(x))
    return intersection.length / Math.max(a.length, b.length)
  }

  // -------------------------------------------------------------------------
  // Pattern Matching
  // -------------------------------------------------------------------------

  private findPattern(keywords: string[], triggerType: ActionTriggerType): AIConfigPattern | undefined {
    return this.patterns.find(
      p => p.triggerType === triggerType && this.keywordOverlap(keywords, p.descriptionKeywords) > 0.8
    )
  }

  private getEffectiveScore(pattern: AIConfigPattern): number {
    const daysSinceUse = (Date.now() - pattern.lastUsed) / (1000 * 60 * 60 * 24)
    const decayFactor = Math.pow(0.5, daysSinceUse / DECAY_HALF_LIFE_DAYS)
    return pattern.successRate * pattern.usageCount * decayFactor
  }

  // -------------------------------------------------------------------------
  // Public API: Record Outcomes
  // -------------------------------------------------------------------------

  recordOutcome(
    description: string,
    config: AIGeneratedConfig,
    accepted: boolean,
    modified: boolean
  ): void {
    const keywords = this.extractKeywords(description)
    const triggerType = config.trigger.type
    const stepTypes = config.actions.map(a => a.type)

    const existing = this.findPattern(keywords, triggerType)

    if (existing) {
      // Update existing pattern
      existing.usageCount++
      existing.lastUsed = Date.now()

      if (accepted && !modified) {
        // Perfect match - increase success rate
        existing.successRate =
          (existing.successRate * (existing.usageCount - 1) + 1) / existing.usageCount
      } else if (!accepted) {
        // Rejected - decrease success rate
        existing.successRate =
          (existing.successRate * (existing.usageCount - 1)) / existing.usageCount
      } else {
        // Accepted with modifications - slight decrease
        existing.successRate =
          (existing.successRate * (existing.usageCount - 1) + 0.5) / existing.usageCount
      }
    } else {
      // Create new pattern
      this.patterns.push({
        descriptionKeywords: keywords,
        triggerType,
        stepTypes,
        successRate: accepted && !modified ? 1 : modified ? 0.5 : 0,
        usageCount: 1,
        lastUsed: Date.now()
      })

      // Limit number of patterns
      if (this.patterns.length > MAX_PATTERNS) {
        // Remove lowest scoring patterns
        this.patterns.sort((a, b) => this.getEffectiveScore(b) - this.getEffectiveScore(a))
        this.patterns = this.patterns.slice(0, MAX_PATTERNS)
      }
    }

    this.savePatterns()
  }

  recordFeedback(feedback: AIConfigFeedback): void {
    this.feedbackRecords.unshift(feedback)

    if (this.feedbackRecords.length > MAX_FEEDBACK_RECORDS) {
      this.feedbackRecords = this.feedbackRecords.slice(0, MAX_FEEDBACK_RECORDS)
    }

    this.saveFeedback()

    // Also update pattern based on feedback
    if (feedback.config) {
      this.recordOutcome(
        '', // No description available from feedback
        feedback.config,
        feedback.rating === 'positive',
        feedback.hadModifications
      )
    }
  }

  // -------------------------------------------------------------------------
  // Public API: Get Suggestions
  // -------------------------------------------------------------------------

  suggestFromHistory(description: string): AIConfigPattern | null {
    const keywords = this.extractKeywords(description)
    if (keywords.length === 0) return null

    const matches = this.patterns
      .filter(p => this.keywordOverlap(keywords, p.descriptionKeywords) > 0.3)
      .sort((a, b) => this.getEffectiveScore(b) - this.getEffectiveScore(a))

    return matches[0] || null
  }

  getTopPatterns(n: number): AIConfigPattern[] {
    return [...this.patterns]
      .sort((a, b) => this.getEffectiveScore(b) - this.getEffectiveScore(a))
      .slice(0, n)
  }

  // -------------------------------------------------------------------------
  // Public API: Statistics
  // -------------------------------------------------------------------------

  getStats(): {
    patternCount: number
    feedbackCount: number
    positiveRate: number
    avgQuestionRounds: number
    topTriggerTypes: Array<{ type: ActionTriggerType; count: number }>
    topStepTypes: Array<{ type: ActionStepType; count: number }>
  } {
    const positiveCount = this.feedbackRecords.filter(r => r.rating === 'positive').length
    const totalRounds = this.feedbackRecords.reduce((sum, r) => sum + r.questionRounds, 0)

    // Count trigger types
    const triggerCounts = new Map<ActionTriggerType, number>()
    this.patterns.forEach(p => {
      triggerCounts.set(p.triggerType, (triggerCounts.get(p.triggerType) || 0) + p.usageCount)
    })

    // Count step types
    const stepCounts = new Map<ActionStepType, number>()
    this.patterns.forEach(p => {
      p.stepTypes.forEach(st => {
        stepCounts.set(st, (stepCounts.get(st) || 0) + p.usageCount)
      })
    })

    return {
      patternCount: this.patterns.length,
      feedbackCount: this.feedbackRecords.length,
      positiveRate: this.feedbackRecords.length > 0 ? positiveCount / this.feedbackRecords.length : 0,
      avgQuestionRounds: this.feedbackRecords.length > 0 ? totalRounds / this.feedbackRecords.length : 0,
      topTriggerTypes: [...triggerCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topStepTypes: [...stepCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  }

  getRecordCount(): number {
    return this.feedbackRecords.length
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  cleanup(): void {
    const cutoffDays = 90
    const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000

    this.patterns = this.patterns.filter(p => p.lastUsed > cutoff)
    this.feedbackRecords = this.feedbackRecords.filter(r => r.timestamp > cutoff)

    this.savePatterns()
    this.saveFeedback()
  }

  // -------------------------------------------------------------------------
  // Reset (for testing/development)
  // -------------------------------------------------------------------------

  reset(): void {
    this.patterns = []
    this.feedbackRecords = []
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(FEEDBACK_STORAGE_KEY)
  }
}

// Singleton instance
export const aiConfigLearning = new AIConfigLearning()
