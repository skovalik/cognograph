// Calm Mode Store — PFD Phase 6F: Stepped Calm Mode Slider
//
// Replaces the boolean calmMode toggle with a 4-level stepped system.
// Each level progressively reduces visual complexity:
//
// Level 0: Normal (no change)
// Level 1: Shift all nodes one LOD level further (L3→L2, L2→L1, etc.)
// Level 2: Shift two LOD levels + suppress all non-essential animations
// Level 3: Text-only mode — no animations, no density brackets, no status pulses

import { create } from 'zustand'

// --- Types -----------------------------------------------------------------

export type CalmLevel = 0 | 1 | 2 | 3

export interface CalmModeState {
  /** Current calm level (0 = normal, 3 = maximum reduction) */
  calmLevel: CalmLevel
}

export interface CalmModeActions {
  /** Set calm level directly */
  setCalmLevel: (level: CalmLevel) => void
  /** Increment calm level, capped at 3 */
  incrementCalmLevel: () => void
  /** Decrement calm level, capped at 0 */
  decrementCalmLevel: () => void
}

export type CalmModeStore = CalmModeState & CalmModeActions

// --- Store -----------------------------------------------------------------

export const useCalmModeStore = create<CalmModeStore>((set) => ({
  calmLevel: 0,

  setCalmLevel: (level: CalmLevel): void => {
    set({ calmLevel: level })
  },

  incrementCalmLevel: (): void => {
    set((state) => ({
      calmLevel: Math.min(3, state.calmLevel + 1) as CalmLevel
    }))
  },

  decrementCalmLevel: (): void => {
    set((state) => ({
      calmLevel: Math.max(0, state.calmLevel - 1) as CalmLevel
    }))
  }
}))

// --- Selectors (pure functions, exported for use and testing) ---------------

/**
 * Returns the LOD shift offset for the current calm level.
 * Level 0 = 0 shift, Level 1 = 1 shift, Level 2 = 2 shift, Level 3 = 3 shift.
 */
export function getCalmOffset(calmLevel: CalmLevel): number {
  return calmLevel
}

/**
 * Returns true when non-essential animations should be suppressed.
 * Active at calm level 2 and above.
 */
export function shouldSuppressAnimations(calmLevel: CalmLevel): boolean {
  return calmLevel >= 2
}

/**
 * Returns true when text-only mode is active.
 * Only at calm level 3 — no animations, no density brackets, no status pulses.
 */
export function isTextOnlyMode(calmLevel: CalmLevel): boolean {
  return calmLevel === 3
}
