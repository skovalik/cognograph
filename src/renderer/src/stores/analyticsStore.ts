/**
 * Analytics Store
 *
 * Tracks onboarding metrics and user activation events.
 * Used to measure the effectiveness of templates, tutorials, and first-time user experience.
 *
 * Created as part of Track 5 Phase 5.0: Analytics Baseline
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// =============================================================================
// Types
// =============================================================================

export interface OnboardingMetrics {
  /** Timestamp when app was first launched */
  appFirstLaunched: number | null
  /** Time from launch to creating first node (milliseconds) */
  timeToFirstNode: number | null
  /** Time from launch to creating first connection (milliseconds) */
  timeToFirstConnection: number | null
  /** Time from launch to sending first AI message (milliseconds) */
  timeToFirstChat: number | null
  /** Whether the interactive tutorial was started */
  tutorialStarted: boolean
  /** Whether the tutorial was completed (not skipped) */
  tutorialCompleted: boolean
  /** Array of completed tutorial step IDs */
  tutorialStepsCompleted: string[]
  /** ID of workspace template used (if any) */
  templateUsed: string | null
  /** Timestamp when template was loaded */
  templateLoadedAt: number | null
  /** Total number of templates tried in first session */
  templatesExplored: number
  /** Whether user reached "aha! moment" (sent message in conversation with context) */
  ahaAchieved: boolean
  /** Timestamp when aha moment was achieved */
  ahaAchievedAt: number | null
}

export interface AnalyticsState {
  metrics: OnboardingMetrics
  /** Session start time (resets on app launch) */
  sessionStartTime: number
}

export interface AnalyticsActions {
  // Event tracking
  recordAppLaunch: () => void
  recordFirstNode: () => void
  recordFirstConnection: () => void
  recordFirstChat: () => void
  recordTutorialStarted: () => void
  recordTutorialStepCompleted: (stepId: string) => void
  recordTutorialCompleted: () => void
  recordTemplateUsed: (templateId: string) => void
  recordAhaMoment: () => void

  // Utilities
  resetMetrics: () => void
  getActivationScore: () => number
}

export type AnalyticsStore = AnalyticsState & AnalyticsActions

// =============================================================================
// Initial State
// =============================================================================

const DEFAULT_METRICS: OnboardingMetrics = {
  appFirstLaunched: null,
  timeToFirstNode: null,
  timeToFirstConnection: null,
  timeToFirstChat: null,
  tutorialStarted: false,
  tutorialCompleted: false,
  tutorialStepsCompleted: [],
  templateUsed: null,
  templateLoadedAt: null,
  templatesExplored: 0,
  ahaAchieved: false,
  ahaAchievedAt: null
}

const initialState: AnalyticsState = {
  metrics: DEFAULT_METRICS,
  sessionStartTime: Date.now()
}

// =============================================================================
// Store Creation
// =============================================================================

export const useAnalyticsStore = create<AnalyticsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordAppLaunch: () => {
        const state = get()
        // Only record on true first launch (not subsequent opens)
        if (state.metrics.appFirstLaunched === null) {
          set({
            metrics: {
              ...state.metrics,
              appFirstLaunched: Date.now()
            },
            sessionStartTime: Date.now()
          })
        } else {
          // Update session start on subsequent launches
          set({ sessionStartTime: Date.now() })
        }
      },

      recordFirstNode: () => {
        const state = get()
        if (state.metrics.timeToFirstNode !== null) return // Already recorded

        const elapsed = Date.now() - state.sessionStartTime
        set({
          metrics: {
            ...state.metrics,
            timeToFirstNode: elapsed
          }
        })
      },

      recordFirstConnection: () => {
        const state = get()
        if (state.metrics.timeToFirstConnection !== null) return

        const elapsed = Date.now() - state.sessionStartTime
        set({
          metrics: {
            ...state.metrics,
            timeToFirstConnection: elapsed
          }
        })
      },

      recordFirstChat: () => {
        const state = get()
        if (state.metrics.timeToFirstChat !== null) return

        const elapsed = Date.now() - state.sessionStartTime
        set({
          metrics: {
            ...state.metrics,
            timeToFirstChat: elapsed
          }
        })
      },

      recordTutorialStarted: () => {
        set((state) => ({
          metrics: {
            ...state.metrics,
            tutorialStarted: true
          }
        }))
      },

      recordTutorialStepCompleted: (stepId: string) => {
        set((state) => {
          const steps = state.metrics.tutorialStepsCompleted
          if (steps.includes(stepId)) return state // Already recorded

          return {
            metrics: {
              ...state.metrics,
              tutorialStepsCompleted: [...steps, stepId]
            }
          }
        })
      },

      recordTutorialCompleted: () => {
        set((state) => ({
          metrics: {
            ...state.metrics,
            tutorialCompleted: true
          }
        }))
      },

      recordTemplateUsed: (templateId: string) => {
        const state = get()
        const isFirstTemplate = state.metrics.templateUsed === null

        set({
          metrics: {
            ...state.metrics,
            templateUsed: isFirstTemplate ? templateId : state.metrics.templateUsed,
            templateLoadedAt: isFirstTemplate ? Date.now() : state.metrics.templateLoadedAt,
            templatesExplored: state.metrics.templatesExplored + 1
          }
        })
      },

      recordAhaMoment: () => {
        const state = get()
        if (state.metrics.ahaAchieved) return // Already achieved

        set({
          metrics: {
            ...state.metrics,
            ahaAchieved: true,
            ahaAchievedAt: Date.now()
          }
        })
      },

      resetMetrics: () => {
        set({
          metrics: DEFAULT_METRICS,
          sessionStartTime: Date.now()
        })
      },

      /**
       * Calculate activation score (0-100)
       *
       * Scoring:
       * - Created first node: 15 points
       * - Created first connection: 15 points
       * - Sent first AI message: 20 points
       * - Started tutorial: 10 points
       * - Completed tutorial: 15 points
       * - Used a template: 15 points
       * - Achieved "aha moment": 10 points
       *
       * Total: 100 points
       */
      getActivationScore: () => {
        const m = get().metrics
        let score = 0

        if (m.timeToFirstNode !== null) score += 15
        if (m.timeToFirstConnection !== null) score += 15
        if (m.timeToFirstChat !== null) score += 20
        if (m.tutorialStarted) score += 10
        if (m.tutorialCompleted) score += 15
        if (m.templateUsed !== null) score += 15
        if (m.ahaAchieved) score += 10

        return score
      }
    }),
    {
      name: 'cognograph-analytics',
      version: 1,
      partialize: (state) => ({
        metrics: state.metrics
        // sessionStartTime is transient, not persisted
      })
    }
  )
)

// =============================================================================
// Selectors
// =============================================================================

export const selectMetrics = (state: AnalyticsStore) => state.metrics
export const selectActivationScore = (state: AnalyticsStore) => state.getActivationScore()
export const selectTimeToFirstNode = (state: AnalyticsStore) => state.metrics.timeToFirstNode
export const selectTimeToFirstConnection = (state: AnalyticsStore) => state.metrics.timeToFirstConnection
export const selectTimeToFirstChat = (state: AnalyticsStore) => state.metrics.timeToFirstChat
export const selectTutorialCompleted = (state: AnalyticsStore) => state.metrics.tutorialCompleted
export const selectTemplateUsed = (state: AnalyticsStore) => state.metrics.templateUsed
export const selectAhaAchieved = (state: AnalyticsStore) => state.metrics.ahaAchieved
