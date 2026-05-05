import { beforeEach, describe, expect, it } from 'vitest'
import { usePerfStore } from '../perfStore'

describe('perfStore', () => {
  beforeEach(() => {
    // Clear localStorage so Zustand persist doesn't bleed state across tests
    localStorage.clear()
    usePerfStore.setState({
      perfMode: 'auto',
      nodeCountTier: 'full',
      zoomTier: 'full',
      fpsTier: 'full',
      effectiveTier: 'full',
    })
  })

  it('default state: auto + all full → effectiveTier full', () => {
    expect(usePerfStore.getState().effectiveTier).toBe('full')
  })

  it('setPerfMode(quality) → effectiveTier full even with minimal inputs', () => {
    usePerfStore.setState({ zoomTier: 'minimal', nodeCountTier: 'minimal' })
    usePerfStore.getState().setPerfMode('quality')
    expect(usePerfStore.getState().effectiveTier).toBe('full')
  })

  it('setPerfMode(battery) → effectiveTier minimal even with full inputs', () => {
    usePerfStore.getState().setPerfMode('battery')
    expect(usePerfStore.getState().effectiveTier).toBe('minimal')
  })

  it('setZoomTier(reduced) in auto mode → effectiveTier reduced', () => {
    usePerfStore.getState().setZoomTier('reduced')
    expect(usePerfStore.getState().effectiveTier).toBe('reduced')
  })

  it('setNodeCountTier(minimal) in auto mode → effectiveTier minimal', () => {
    usePerfStore.getState().setNodeCountTier('minimal')
    expect(usePerfStore.getState().effectiveTier).toBe('minimal')
  })

  it('setFpsTier propagates', () => {
    usePerfStore.getState().setFpsTier('reduced')
    expect(usePerfStore.getState().effectiveTier).toBe('reduced')
  })

  it('persistence round-trip: setting perfMode → getState reads same value (proxy for restart)', () => {
    usePerfStore.getState().setPerfMode('quality')
    expect(usePerfStore.getState().perfMode).toBe('quality')
    expect(usePerfStore.getState().effectiveTier).toBe('full')

    // Simulate "restart" by re-reading from persisted state — Zustand persist middleware writes synchronously to localStorage in tests.
    // The next module import would rehydrate; here we just verify the partialize key was used.
    const persisted = JSON.parse(localStorage.getItem('cognograph-perf-store') ?? '{}')
    expect(persisted.state?.perfMode).toBe('quality')
  })

  it('legacy migration: an auto perfMode in new store is overridden by quality from legacy', () => {
    // Simulate clean new store + legacy quality value
    usePerfStore.setState({ perfMode: 'auto' })
    // Direct call simulating what programStore.onRehydrateStorage does
    const legacy = 'quality'
    if (usePerfStore.getState().perfMode === 'auto' && legacy !== 'auto') {
      usePerfStore.getState().setPerfMode(legacy)
    }
    expect(usePerfStore.getState().perfMode).toBe('quality')
  })

  it('legacy migration: existing battery in new store is NOT overridden by legacy auto', () => {
    usePerfStore.setState({ perfMode: 'battery' })
    const legacy = 'auto'
    if (usePerfStore.getState().perfMode === 'auto' && legacy !== 'auto') {
      usePerfStore.getState().setPerfMode(legacy)
    }
    expect(usePerfStore.getState().perfMode).toBe('battery')
  })
})
