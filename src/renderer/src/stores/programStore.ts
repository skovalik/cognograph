/**
 * Program Store
 *
 * Manages program-level settings that persist across all workspaces.
 * Stored in localStorage, not workspace files.
 *
 * Created as part of UI Polish Sprint Phase 4A: Accessibility Settings
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subscribeWithSelector } from 'zustand/middleware'

// =============================================================================
// Types
// =============================================================================

export type ReduceMotionPreference = 'system' | 'always' | 'never'

export interface AccessibilitySettings {
  /** Motion preference: 'system' follows OS, 'always' reduces, 'never' keeps animations */
  reduceMotion: ReduceMotionPreference
  /** Enable high contrast focus rings for better visibility */
  highContrastFocus: boolean
  /** Announce actions to screen readers */
  announceActions: boolean
}

export interface AutoSaveSettings {
  /** Whether auto-save is enabled */
  enabled: boolean
  /** Auto-save debounce interval in milliseconds (5000-60000) */
  intervalMs: number
}

export type TutorialStep =
  | 'create-note'
  | 'create-conversation'
  | 'connect-them'
  | 'send-message'
  | 'see-context'
  | 'complete'

export interface ProgramState {
  accessibility: AccessibilitySettings
  autoSave: AutoSaveSettings
  hasCompletedOnboarding: boolean
  hasCompletedTutorial: boolean
  /** User-customized keyboard shortcut overrides: shortcutId → combo string */
  keyboardOverrides: Record<string, string>
  /** IDs of contextual tooltips that have been dismissed (never shown again) */
  dismissedTooltips: string[]
  /** Transient: whether the interactive tutorial is active */
  tutorialActive: boolean
  /** Transient: current tutorial step */
  tutorialStep: TutorialStep
  /** Recent theme preset IDs (most recent first, max 8) */
  recentThemePresets: string[]
  /** Whether user has seen the theme menu tooltip */
  hasSeenThemeMenuTooltip: boolean
}

export interface ProgramActions {
  setReduceMotion: (preference: ReduceMotionPreference) => void
  setHighContrastFocus: (enabled: boolean) => void
  setAnnounceActions: (enabled: boolean) => void
  setAutoSaveEnabled: (enabled: boolean) => void
  setAutoSaveInterval: (intervalMs: number) => void
  resetAccessibilitySettings: () => void
  completeOnboarding: () => void
  resetOnboarding: () => void
  setKeyboardOverride: (shortcutId: string, combo: string) => void
  removeKeyboardOverride: (shortcutId: string) => void
  resetKeyboardOverrides: () => void
  dismissTooltip: (tooltipId: string) => void
  resetDismissedTooltips: () => void
  startTutorial: () => void
  advanceTutorial: () => void
  completeTutorial: () => void
  cancelTutorial: () => void
  addRecentThemePreset: (presetId: string) => void
  markThemeMenuTooltipSeen: () => void
}

export type ProgramStore = ProgramState & ProgramActions

// =============================================================================
// Initial State
// =============================================================================

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  reduceMotion: 'system',
  highContrastFocus: false,
  announceActions: true
}

const DEFAULT_AUTO_SAVE: AutoSaveSettings = {
  enabled: true,
  intervalMs: 2000
}

const TUTORIAL_STEPS: TutorialStep[] = [
  'create-note',
  'create-conversation',
  'connect-them',
  'send-message',
  'see-context',
  'complete'
]

const initialState: ProgramState = {
  accessibility: DEFAULT_ACCESSIBILITY,
  autoSave: DEFAULT_AUTO_SAVE,
  hasCompletedOnboarding: false,
  hasCompletedTutorial: false,
  keyboardOverrides: {},
  dismissedTooltips: [],
  tutorialActive: false,
  tutorialStep: 'create-note',
  recentThemePresets: [],
  hasSeenThemeMenuTooltip: false
}

// =============================================================================
// Store Creation
// =============================================================================

export const useProgramStore = create<ProgramStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...initialState,

        setReduceMotion: (preference) => {
          set((state) => ({
            accessibility: { ...state.accessibility, reduceMotion: preference }
          }))
          // Apply to document for CSS to pick up
          applyReduceMotionToDocument(preference)
        },

        setHighContrastFocus: (enabled) => {
          set((state) => ({
            accessibility: { ...state.accessibility, highContrastFocus: enabled }
          }))
          // Apply to document for CSS to pick up
          applyHighContrastFocusToDocument(enabled)
        },

        setAnnounceActions: (enabled) => {
          set((state) => ({
            accessibility: { ...state.accessibility, announceActions: enabled }
          }))
        },

        setAutoSaveEnabled: (enabled) => {
          set((state) => ({
            autoSave: { ...state.autoSave, enabled }
          }))
        },

        setAutoSaveInterval: (intervalMs) => {
          set((state) => ({
            autoSave: { ...state.autoSave, intervalMs: Math.max(2000, Math.min(60000, intervalMs)) }
          }))
        },

        resetAccessibilitySettings: () => {
          set({ accessibility: DEFAULT_ACCESSIBILITY })
          applyReduceMotionToDocument(DEFAULT_ACCESSIBILITY.reduceMotion)
          applyHighContrastFocusToDocument(DEFAULT_ACCESSIBILITY.highContrastFocus)
        },

        completeOnboarding: () => {
          set({ hasCompletedOnboarding: true })
        },

        resetOnboarding: () => {
          set({ hasCompletedOnboarding: false })
        },

        setKeyboardOverride: (shortcutId, combo) => {
          set((state) => ({
            keyboardOverrides: { ...state.keyboardOverrides, [shortcutId]: combo }
          }))
        },

        removeKeyboardOverride: (shortcutId) => {
          set((state) => {
            const next = { ...state.keyboardOverrides }
            delete next[shortcutId]
            return { keyboardOverrides: next }
          })
        },

        resetKeyboardOverrides: () => {
          set({ keyboardOverrides: {} })
        },

        dismissTooltip: (tooltipId) => {
          set((state) => {
            if (state.dismissedTooltips.includes(tooltipId)) return state
            return { dismissedTooltips: [...state.dismissedTooltips, tooltipId] }
          })
        },

        resetDismissedTooltips: () => {
          set({ dismissedTooltips: [] })
        },

        startTutorial: () => {
          set({ tutorialActive: true, tutorialStep: 'create-note' })
        },

        advanceTutorial: () => {
          set((state) => {
            const currentIndex = TUTORIAL_STEPS.indexOf(state.tutorialStep)
            if (currentIndex < 0 || currentIndex >= TUTORIAL_STEPS.length - 1) {
              return { tutorialActive: false, hasCompletedTutorial: true }
            }
            return { tutorialStep: TUTORIAL_STEPS[currentIndex + 1] }
          })
        },

        completeTutorial: () => {
          set({ tutorialActive: false, tutorialStep: 'create-note', hasCompletedTutorial: true })
        },

        cancelTutorial: () => {
          set({ tutorialActive: false, tutorialStep: 'create-note' })
        },

        addRecentThemePreset: (presetId) => {
          set((state) => {
            const filtered = state.recentThemePresets.filter(id => id !== presetId)
            const updated = [presetId, ...filtered].slice(0, 8) // Keep max 8
            return { recentThemePresets: updated }
          })
        },

        markThemeMenuTooltipSeen: () => {
          set({ hasSeenThemeMenuTooltip: true })
        }
      }),
      {
        name: 'cognograph-program-settings',
        version: 7, // Bumped for new theme fields
        partialize: (state) => ({
          accessibility: state.accessibility,
          autoSave: state.autoSave,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          hasCompletedTutorial: state.hasCompletedTutorial,
          keyboardOverrides: state.keyboardOverrides,
          dismissedTooltips: state.dismissedTooltips,
          recentThemePresets: state.recentThemePresets,
          hasSeenThemeMenuTooltip: state.hasSeenThemeMenuTooltip
        }),
        migrate: (persisted: unknown, version: number) => {
          const data = persisted as Record<string, unknown>
          if (version < 2) {
            data.autoSave = DEFAULT_AUTO_SAVE
          }
          if (version < 3) {
            data.hasCompletedOnboarding = false
          }
          if (version < 4) {
            data.keyboardOverrides = {}
          }
          if (version < 5) {
            data.dismissedTooltips = []
          }
          if (version < 6) {
            data.hasCompletedTutorial = false
          }
          return data as ProgramState
        },
        onRehydrateStorage: () => (state) => {
          // Apply settings on app start
          if (state) {
            applyReduceMotionToDocument(state.accessibility.reduceMotion)
            applyHighContrastFocusToDocument(state.accessibility.highContrastFocus)
          }
        }
      }
    )
  )
)

// =============================================================================
// DOM Helpers
// =============================================================================

/**
 * Apply reduce motion preference to the document root.
 * This sets a data attribute that CSS can use.
 */
function applyReduceMotionToDocument(preference: ReduceMotionPreference): void {
  const root = document.documentElement

  // Remove existing attribute
  root.removeAttribute('data-reduce-motion')

  if (preference === 'always') {
    root.setAttribute('data-reduce-motion', 'reduce')
  } else if (preference === 'never') {
    root.setAttribute('data-reduce-motion', 'no-preference')
  }
  // 'system' = no attribute, let CSS media query handle it
}

/**
 * Apply high contrast focus setting to the document root.
 */
function applyHighContrastFocusToDocument(enabled: boolean): void {
  const root = document.documentElement

  if (enabled) {
    root.setAttribute('data-high-contrast-focus', 'true')
  } else {
    root.removeAttribute('data-high-contrast-focus')
  }
}

// =============================================================================
// Selectors
// =============================================================================

export const selectAccessibilitySettings = (state: ProgramStore) => state.accessibility
export const selectReduceMotion = (state: ProgramStore) => state.accessibility.reduceMotion
export const selectHighContrastFocus = (state: ProgramStore) => state.accessibility.highContrastFocus
export const selectAnnounceActions = (state: ProgramStore) => state.accessibility.announceActions
export const selectHasCompletedOnboarding = (state: ProgramStore) => state.hasCompletedOnboarding
export const selectHasCompletedTutorial = (state: ProgramStore) => state.hasCompletedTutorial
export const selectTutorialActive = (state: ProgramStore) => state.tutorialActive
export const selectTutorialStep = (state: ProgramStore) => state.tutorialStep
export const selectKeyboardOverrides = (state: ProgramStore) => state.keyboardOverrides
export const selectDismissedTooltips = (state: ProgramStore) => state.dismissedTooltips

// =============================================================================
// Hooks for computed values
// =============================================================================

/**
 * Returns true if reduced motion should be applied based on user preference and OS setting.
 */
export function useEffectiveReducedMotion(): boolean {
  const preference = useProgramStore(selectReduceMotion)

  if (preference === 'always') return true
  if (preference === 'never') return false

  // 'system' - check OS preference
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return false
}
