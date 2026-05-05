// src/shared/utils/__tests__/computeEffectiveTier.test.ts
import { describe, expect, it } from 'vitest'
import { computeEffectiveTier } from '../computeEffectiveTier'

describe('computeEffectiveTier', () => {
  // Quality mode: full regardless of node-count/zoom inputs (user override wins)
  it('quality + nodeCount/zoom minimal but fps OK → full', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'quality',
        nodeCountTier: 'minimal',
        zoomTier: 'minimal',
        fpsTier: 'full',
      }),
    ).toBe('full')
  })

  // No FPS floor on Quality — user override wins regardless. The previous floor
  // (removed 2026-05-04) caused a self-reinforcing re-render cascade in low-zoom
  // shader scenarios; CPU profile confirmed.
  it('quality + fpsTier=minimal → full (NO FPS floor)', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'quality',
        nodeCountTier: 'full',
        zoomTier: 'full',
        fpsTier: 'minimal',
      }),
    ).toBe('full')
  })

  it('quality + fpsTier=reduced → full', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'quality',
        nodeCountTier: 'full',
        zoomTier: 'full',
        fpsTier: 'reduced',
      }),
    ).toBe('full')
  })

  // Battery mode: always minimal regardless of inputs
  it('battery + all full inputs → minimal', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'battery',
        nodeCountTier: 'full',
        zoomTier: 'full',
        fpsTier: 'full',
      }),
    ).toBe('minimal')
  })

  // Auto mode: worst-of inputs
  it('auto + (full, full, full) → full', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'full',
        zoomTier: 'full',
        fpsTier: 'full',
      }),
    ).toBe('full')
  })

  it('auto + (full, reduced, full) → reduced', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'full',
        zoomTier: 'reduced',
        fpsTier: 'full',
      }),
    ).toBe('reduced')
  })

  it('auto + (full, full, minimal) → minimal', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'full',
        zoomTier: 'full',
        fpsTier: 'minimal',
      }),
    ).toBe('minimal')
  })

  it('auto + (minimal, full, full) → minimal', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'minimal',
        zoomTier: 'full',
        fpsTier: 'full',
      }),
    ).toBe('minimal')
  })

  it('auto + (reduced, reduced, reduced) → reduced', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'reduced',
        zoomTier: 'reduced',
        fpsTier: 'reduced',
      }),
    ).toBe('reduced')
  })

  it('auto + (reduced, full, minimal) → minimal (worst wins)', () => {
    expect(
      computeEffectiveTier({
        perfMode: 'auto',
        nodeCountTier: 'reduced',
        zoomTier: 'full',
        fpsTier: 'minimal',
      }),
    ).toBe('minimal')
  })

  // Default tier when omitted
  it('omitted tiers default to full', () => {
    expect(computeEffectiveTier({ perfMode: 'auto' })).toBe('full')
  })

  // Stateless invariant: hysteresis is computed UPSTREAM by computeZoomPerfTier and stored
  // in perfStore.zoomTier. computeEffectiveTier itself must be stateless — same inputs in,
  // same outputs out. Guards against accidental memoization or hidden state.
  it('stateless: same inputs always return same output', () => {
    const inputs = {
      perfMode: 'auto' as const,
      zoomTier: 'reduced' as const,
      nodeCountTier: 'full' as const,
      fpsTier: 'full' as const,
    }
    const a = computeEffectiveTier(inputs)
    const b = computeEffectiveTier(inputs)
    const c = computeEffectiveTier(inputs)
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(a).toBe('reduced')
  })
})
