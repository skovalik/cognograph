// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import {
  computeEffectiveTier,
  type PerfMode,
  type PerfTier,
} from '@shared/utils/computeEffectiveTier'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PerfState {
  perfMode: PerfMode
  nodeCountTier: PerfTier
  zoomTier: PerfTier
  fpsTier: PerfTier
  effectiveTier: PerfTier

  setPerfMode: (m: PerfMode) => void
  setNodeCountTier: (t: PerfTier) => void
  setZoomTier: (t: PerfTier) => void
  setFpsTier: (t: PerfTier) => void
}

const recompute = (s: Omit<PerfState, 'effectiveTier' | `set${string}`>): PerfTier =>
  computeEffectiveTier({
    perfMode: s.perfMode,
    nodeCountTier: s.nodeCountTier,
    zoomTier: s.zoomTier,
    fpsTier: s.fpsTier,
  })

export const usePerfStore = create<PerfState>()(
  persist(
    (set, get) => ({
      perfMode: 'auto',
      nodeCountTier: 'full',
      zoomTier: 'full',
      fpsTier: 'full',
      effectiveTier: 'full',

      setPerfMode: (m) => {
        set({ perfMode: m })
        set({ effectiveTier: recompute(get()) })
      },
      setNodeCountTier: (t) => {
        if (get().nodeCountTier === t) return
        set({ nodeCountTier: t })
        set({ effectiveTier: recompute(get()) })
      },
      setZoomTier: (t) => {
        if (get().zoomTier === t) return
        set({ zoomTier: t })
        set({ effectiveTier: recompute(get()) })
      },
      setFpsTier: (t) => {
        if (get().fpsTier === t) return
        set({ fpsTier: t })
        set({ effectiveTier: recompute(get()) })
      },
    }),
    {
      name: 'cognograph-perf-store',
      partialize: (s) => ({ perfMode: s.perfMode }), // only user intent persists
    },
  ),
)
