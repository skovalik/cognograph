/**
 * Calm Mode Store (Phase 6F) -- Stepped calm level tests
 *
 * Tests the calm mode store actions and pure selector functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useCalmModeStore,
  getCalmOffset,
  shouldSuppressAnimations,
  isTextOnlyMode,
  type CalmLevel
} from '../calmModeStore'

// --- Helpers ---------------------------------------------------------------

function resetStore(): void {
  useCalmModeStore.setState({ calmLevel: 0 })
}

// --- Store action tests ----------------------------------------------------

describe('calmModeStore', () => {
  beforeEach(() => {
    resetStore()
  })

  it('defaults to calm level 0', () => {
    expect(useCalmModeStore.getState().calmLevel).toBe(0)
  })

  it('setCalmLevel sets level 1', () => {
    useCalmModeStore.getState().setCalmLevel(1)
    expect(useCalmModeStore.getState().calmLevel).toBe(1)
  })

  it('setCalmLevel sets level 2', () => {
    useCalmModeStore.getState().setCalmLevel(2)
    expect(useCalmModeStore.getState().calmLevel).toBe(2)
  })

  it('setCalmLevel sets level 3', () => {
    useCalmModeStore.getState().setCalmLevel(3)
    expect(useCalmModeStore.getState().calmLevel).toBe(3)
  })

  it('setCalmLevel can reset back to 0', () => {
    useCalmModeStore.getState().setCalmLevel(3)
    useCalmModeStore.getState().setCalmLevel(0)
    expect(useCalmModeStore.getState().calmLevel).toBe(0)
  })

  it('incrementCalmLevel increments from 0 to 1', () => {
    useCalmModeStore.getState().incrementCalmLevel()
    expect(useCalmModeStore.getState().calmLevel).toBe(1)
  })

  it('incrementCalmLevel caps at 3', () => {
    useCalmModeStore.getState().setCalmLevel(3)
    useCalmModeStore.getState().incrementCalmLevel()
    expect(useCalmModeStore.getState().calmLevel).toBe(3)
  })

  it('decrementCalmLevel decrements from 2 to 1', () => {
    useCalmModeStore.getState().setCalmLevel(2)
    useCalmModeStore.getState().decrementCalmLevel()
    expect(useCalmModeStore.getState().calmLevel).toBe(1)
  })

  it('decrementCalmLevel caps at 0', () => {
    useCalmModeStore.getState().setCalmLevel(0)
    useCalmModeStore.getState().decrementCalmLevel()
    expect(useCalmModeStore.getState().calmLevel).toBe(0)
  })
})

// --- Pure selector tests ---------------------------------------------------

describe('getCalmOffset', () => {
  it('returns 0 for level 0', () => {
    expect(getCalmOffset(0)).toBe(0)
  })

  it('returns 1 for level 1', () => {
    expect(getCalmOffset(1)).toBe(1)
  })

  it('returns 2 for level 2', () => {
    expect(getCalmOffset(2)).toBe(2)
  })

  it('returns 3 for level 3', () => {
    expect(getCalmOffset(3)).toBe(3)
  })
})

describe('shouldSuppressAnimations', () => {
  it('returns false for level 0', () => {
    expect(shouldSuppressAnimations(0)).toBe(false)
  })

  it('returns false for level 1', () => {
    expect(shouldSuppressAnimations(1)).toBe(false)
  })

  it('returns true for level 2', () => {
    expect(shouldSuppressAnimations(2)).toBe(true)
  })

  it('returns true for level 3', () => {
    expect(shouldSuppressAnimations(3)).toBe(true)
  })
})

describe('isTextOnlyMode', () => {
  it('returns false for level 0', () => {
    expect(isTextOnlyMode(0)).toBe(false)
  })

  it('returns false for level 1', () => {
    expect(isTextOnlyMode(1)).toBe(false)
  })

  it('returns false for level 2', () => {
    expect(isTextOnlyMode(2)).toBe(false)
  })

  it('returns true for level 3', () => {
    expect(isTextOnlyMode(3)).toBe(true)
  })
})
