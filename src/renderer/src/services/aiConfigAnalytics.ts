// =============================================================================
// AI CONFIG ANALYTICS SERVICE
// =============================================================================
// Tracks usage patterns for the AI configuration feature

import type { AIGeneratedConfig, AIStreamingPhase, AIClarifyingQuestion } from '@shared/actionTypes'

// Analytics event types
interface AIConfigAnalyticsEvents {
  'ai_config.session_start': {
    sessionId: string
    nodeId: string
    hasExistingConfig: boolean
    descriptionLength: number
  }
  'ai_config.streaming_started': {
    sessionId: string
    nodeId: string
  }
  'ai_config.streaming_phase': {
    sessionId: string
    phase: AIStreamingPhase
    durationMs: number
  }
  'ai_config.questions_shown': {
    sessionId: string
    round: number
    questionCount: number
    questionTypes: string[]
  }
  'ai_config.questions_answered': {
    sessionId: string
    round: number
    answerCount: number
    skippedCount: number
  }
  'ai_config.preview_shown': {
    sessionId: string
    confidence: 'high' | 'medium' | 'low'
    triggerType: string
    stepCount: number
    hasWarnings: boolean
  }
  'ai_config.applied': {
    sessionId: string
    triggerType: string
    stepCount: number
    totalDurationMs: number
    questionRounds: number
  }
  'ai_config.cancelled': {
    sessionId: string
    stage: 'streaming' | 'questions' | 'preview'
    reason?: string
  }
  'ai_config.error': {
    sessionId: string
    errorType: 'timeout' | 'parse' | 'validation' | 'connector'
    errorMessage: string
  }
  'ai_config.feedback': {
    sessionId: string
    rating: 'positive' | 'negative'
    hadModifications: boolean
  }
  'ai_config.template_used': {
    sessionId: string
    templateId: string
    category: string
  }
}

type EventName = keyof AIConfigAnalyticsEvents

// Privacy settings
interface PrivacySettings {
  analyticsEnabled: boolean
  shareAnonymousUsage: boolean
}

// Local storage for analytics
const ANALYTICS_STORAGE_KEY = 'ai_config_analytics'
const MAX_LOCAL_EVENTS = 500

interface StoredEvent {
  event: EventName
  properties: Record<string, unknown>
  timestamp: number
}

class AIConfigAnalytics {
  private currentSessionId: string | null = null
  private sessionStart: number = 0
  private phaseStart: number = 0
  private localEvents: StoredEvent[] = []

  constructor() {
    this.loadLocalEvents()
  }

  // -------------------------------------------------------------------------
  // Privacy
  // -------------------------------------------------------------------------

  private getPrivacySettings(): PrivacySettings {
    // For now, default to local-only analytics
    // In the future, this could read from user settings
    return {
      analyticsEnabled: true,
      shareAnonymousUsage: false
    }
  }

  private sanitize(properties: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE_KEYS = ['description', 'title', 'content', 'prompt', 'feedback']
    const sanitized = { ...properties }

    for (const key of SENSITIVE_KEYS) {
      if (key in sanitized && typeof sanitized[key] === 'string') {
        // Replace with length/hash instead of content
        sanitized[key] = {
          length: (sanitized[key] as string).length,
          hash: this.hashString(sanitized[key] as string)
        }
      }
    }

    return sanitized
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return hash.toString(16)
  }

  // -------------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------------

  private loadLocalEvents(): void {
    try {
      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY)
      if (stored) {
        this.localEvents = JSON.parse(stored)
      }
    } catch {
      this.localEvents = []
    }
  }

  private saveLocalEvents(): void {
    try {
      if (this.localEvents.length > MAX_LOCAL_EVENTS) {
        this.localEvents = this.localEvents.slice(-MAX_LOCAL_EVENTS)
      }
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(this.localEvents))
    } catch {
      // Storage might be full, remove old events
      this.localEvents = this.localEvents.slice(-100)
    }
  }

  // -------------------------------------------------------------------------
  // Core Tracking
  // -------------------------------------------------------------------------

  private track<E extends EventName>(event: E, properties: AIConfigAnalyticsEvents[E]): void {
    const settings = this.getPrivacySettings()
    if (!settings.analyticsEnabled) return

    const sanitized = this.sanitize(properties as Record<string, unknown>)

    // Always store locally
    this.localEvents.push({
      event,
      properties: sanitized,
      timestamp: Date.now()
    })
    this.saveLocalEvents()

    // In the future, could send to backend if shareAnonymousUsage is true
    if (settings.shareAnonymousUsage) {
      // this.sendToBackend(event, sanitized)
    }
  }

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  startSession(nodeId: string, hasExistingConfig: boolean, descriptionLength: number): string {
    this.currentSessionId = crypto.randomUUID()
    this.sessionStart = Date.now()
    this.phaseStart = Date.now()

    this.track('ai_config.session_start', {
      sessionId: this.currentSessionId,
      nodeId,
      hasExistingConfig,
      descriptionLength
    })

    return this.currentSessionId
  }

  getSessionId(): string | null {
    return this.currentSessionId
  }

  // -------------------------------------------------------------------------
  // Streaming Events
  // -------------------------------------------------------------------------

  trackStreamingStarted(nodeId: string): void {
    if (!this.currentSessionId) return

    this.phaseStart = Date.now()
    this.track('ai_config.streaming_started', {
      sessionId: this.currentSessionId,
      nodeId
    })
  }

  trackStreamingPhase(phase: AIStreamingPhase): void {
    if (!this.currentSessionId) return

    const now = Date.now()
    this.track('ai_config.streaming_phase', {
      sessionId: this.currentSessionId,
      phase,
      durationMs: now - this.phaseStart
    })
    this.phaseStart = now
  }

  // -------------------------------------------------------------------------
  // Question Events
  // -------------------------------------------------------------------------

  trackQuestionsShown(round: number, questions: AIClarifyingQuestion[]): void {
    if (!this.currentSessionId) return

    this.track('ai_config.questions_shown', {
      sessionId: this.currentSessionId,
      round,
      questionCount: questions.length,
      questionTypes: questions.map(q => q.type)
    })
  }

  trackQuestionsAnswered(round: number, answerCount: number, skippedCount: number): void {
    if (!this.currentSessionId) return

    this.track('ai_config.questions_answered', {
      sessionId: this.currentSessionId,
      round,
      answerCount,
      skippedCount
    })
  }

  // -------------------------------------------------------------------------
  // Preview Events
  // -------------------------------------------------------------------------

  trackPreviewShown(
    confidence: 'high' | 'medium' | 'low',
    triggerType: string,
    stepCount: number,
    hasWarnings: boolean
  ): void {
    if (!this.currentSessionId) return

    this.track('ai_config.preview_shown', {
      sessionId: this.currentSessionId,
      confidence,
      triggerType,
      stepCount,
      hasWarnings
    })
  }

  // -------------------------------------------------------------------------
  // Outcome Events
  // -------------------------------------------------------------------------

  trackApplied(config: AIGeneratedConfig, questionRounds: number): void {
    if (!this.currentSessionId) return

    this.track('ai_config.applied', {
      sessionId: this.currentSessionId,
      triggerType: config.trigger.type,
      stepCount: config.actions.length,
      totalDurationMs: Date.now() - this.sessionStart,
      questionRounds
    })

    // Session complete
    this.currentSessionId = null
  }

  trackCancelled(stage: 'streaming' | 'questions' | 'preview', reason?: string): void {
    if (!this.currentSessionId) return

    this.track('ai_config.cancelled', {
      sessionId: this.currentSessionId,
      stage,
      reason
    })

    this.currentSessionId = null
  }

  trackError(errorType: 'timeout' | 'parse' | 'validation' | 'connector', errorMessage: string): void {
    if (!this.currentSessionId) return

    this.track('ai_config.error', {
      sessionId: this.currentSessionId,
      errorType,
      errorMessage
    })
  }

  // -------------------------------------------------------------------------
  // Feedback Events
  // -------------------------------------------------------------------------

  trackFeedback(rating: 'positive' | 'negative', hadModifications: boolean): void {
    if (!this.currentSessionId) return

    this.track('ai_config.feedback', {
      sessionId: this.currentSessionId,
      rating,
      hadModifications
    })
  }

  // -------------------------------------------------------------------------
  // Template Events
  // -------------------------------------------------------------------------

  trackTemplateUsed(templateId: string, category: string): void {
    if (!this.currentSessionId) return

    this.track('ai_config.template_used', {
      sessionId: this.currentSessionId,
      templateId,
      category
    })
  }

  // -------------------------------------------------------------------------
  // Aggregation
  // -------------------------------------------------------------------------

  getAggregatedStats(periodDays: number = 7): {
    totalSessions: number
    completedConfigs: number
    cancelledConfigs: number
    avgQuestionRounds: number
    triggerTypeDistribution: Record<string, number>
    errorRate: number
    avgDurationMs: number
  } {
    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000
    const recentEvents = this.localEvents.filter(e => e.timestamp > cutoff)

    const sessions = recentEvents.filter(e => e.event === 'ai_config.session_start')
    const completed = recentEvents.filter(e => e.event === 'ai_config.applied')
    const cancelled = recentEvents.filter(e => e.event === 'ai_config.cancelled')
    const errors = recentEvents.filter(e => e.event === 'ai_config.error')

    const totalRounds = completed.reduce(
      (sum, e) => sum + ((e.properties as { questionRounds?: number }).questionRounds || 0),
      0
    )
    const totalDuration = completed.reduce(
      (sum, e) => sum + ((e.properties as { totalDurationMs?: number }).totalDurationMs || 0),
      0
    )

    // Count trigger types
    const triggerCounts: Record<string, number> = {}
    completed.forEach(e => {
      const triggerType = (e.properties as { triggerType?: string }).triggerType
      if (triggerType) {
        triggerCounts[triggerType] = (triggerCounts[triggerType] || 0) + 1
      }
    })

    return {
      totalSessions: sessions.length,
      completedConfigs: completed.length,
      cancelledConfigs: cancelled.length,
      avgQuestionRounds: completed.length > 0 ? totalRounds / completed.length : 0,
      triggerTypeDistribution: triggerCounts,
      errorRate: sessions.length > 0 ? errors.length / sessions.length : 0,
      avgDurationMs: completed.length > 0 ? totalDuration / completed.length : 0
    }
  }

  // -------------------------------------------------------------------------
  // Reset (for testing/development)
  // -------------------------------------------------------------------------

  reset(): void {
    this.localEvents = []
    this.currentSessionId = null
    localStorage.removeItem(ANALYTICS_STORAGE_KEY)
  }
}

// Singleton instance
export const aiConfigAnalytics = new AIConfigAnalytics()
