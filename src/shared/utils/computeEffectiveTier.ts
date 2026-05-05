// src/shared/utils/computeEffectiveTier.ts
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

export type PerfTier = 'full' | 'reduced' | 'minimal'
export type PerfMode = 'auto' | 'quality' | 'battery'

export interface EffectiveTierInputs {
  perfMode: PerfMode
  nodeCountTier?: PerfTier
  zoomTier?: PerfTier
  fpsTier?: PerfTier
}

const TIER_ORDER: Record<PerfTier, number> = { full: 0, reduced: 1, minimal: 2 }

export function computeEffectiveTier(inputs: EffectiveTierInputs): PerfTier {
  // Quality / battery: user override wins, period. NO FPS-driven downgrade.
  //
  // Why no FPS floor on Quality: a previous attempt (commit 592520e) downgraded
  // 'quality' to 'reduced' when fpsTier=minimal, on the theory that sustained
  // <15fps was the canvas asking for help. CPU profile (2026-05-04 diagnose-shader-lag.mjs)
  // proved the opposite: at zoom 0.3 + plasma + 200 nodes, the floor flipped
  // effectiveTier from 'full' to 'reduced', which re-renders every useEffectiveTier
  // consumer — including all 200 CustomEdges. The cascade burned ~557ms of React
  // Flow store-subscription work over 3s (memoizedSelector / shallow /
  // checkIfSnapshotChanged), which kept FPS below 25, which kept the floor engaged,
  // which kept re-rendering — self-reinforcing oscillation. Removing the floor
  // breaks the loop.
  if (inputs.perfMode === 'quality') return 'full'
  if (inputs.perfMode === 'battery') return 'minimal'

  // perfMode === 'auto': worst-of inputs (highest TIER_ORDER value wins)
  const tiers: PerfTier[] = [
    inputs.nodeCountTier ?? 'full',
    inputs.zoomTier ?? 'full',
    inputs.fpsTier ?? 'full',
  ]
  return tiers.reduce((worst, t) => (TIER_ORDER[t] > TIER_ORDER[worst] ? t : worst), 'full')
}
