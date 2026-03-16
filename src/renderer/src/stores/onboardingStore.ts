/**
 * Onboarding Store
 *
 * Manages the 5-step onboarding flow state with localStorage persistence.
 * Separate from programStore's hasCompletedOnboarding (which controls WelcomeOverlay).
 * This store drives the OnboardingOverlay — a glassmorphic guided walkthrough
 * that triggers on first launch when no workspace is loaded.
 *
 * Steps 0-4 are populated by Tasks 24-25.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// =============================================================================
// Types
// =============================================================================

interface OnboardingState {
  /** Current step index (0-4, 5 total steps) */
  step: number
  /** Whether the onboarding flow has been completed or skipped */
  completed: boolean
  /** Template ID selected during onboarding (null = Empty Canvas) */
  selectedTemplate: string | null
  /** Advance to the next step; completes if on the last step */
  advance: () => void
  /** Jump to a specific step (used for skipping steps, e.g. First Node after template) */
  goToStep: (step: number) => void
  /** Set the selected template from the onboarding gallery */
  setSelectedTemplate: (templateId: string | null) => void
  /** Skip the entire onboarding flow */
  skip: () => void
  /** Reset onboarding to the beginning (for testing/dev) */
  reset: () => void
}

// =============================================================================
// Constants
// =============================================================================

const TOTAL_STEPS = 5

// =============================================================================
// Store
// =============================================================================

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 0,
      completed: false,
      selectedTemplate: null,

      advance: () =>
        set((state) => {
          const nextStep = state.step + 1
          if (nextStep >= TOTAL_STEPS) {
            return { step: TOTAL_STEPS - 1, completed: true }
          }
          return { step: nextStep }
        }),

      goToStep: (targetStep: number) =>
        set(() => {
          if (targetStep >= TOTAL_STEPS) {
            return { step: TOTAL_STEPS - 1, completed: true }
          }
          return { step: Math.max(0, targetStep) }
        }),

      setSelectedTemplate: (templateId: string | null) =>
        set({ selectedTemplate: templateId }),

      skip: () => set({ completed: true }),

      reset: () => set({ step: 0, completed: false, selectedTemplate: null })
    }),
    {
      name: 'cognograph.onboarding',
      version: 1,
      partialize: (state) => ({
        step: state.step,
        completed: state.completed,
        selectedTemplate: state.selectedTemplate
      })
    }
  )
)

// =============================================================================
// Selectors
// =============================================================================

export const selectOnboardingStep = (state: OnboardingState): number => state.step
export const selectOnboardingCompleted = (state: OnboardingState): boolean => state.completed
export const selectOnboardingTemplate = (state: OnboardingState): string | null =>
  state.selectedTemplate
