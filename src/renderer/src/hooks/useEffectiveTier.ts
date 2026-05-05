// src/renderer/src/hooks/useEffectiveTier.ts
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { PerfTier } from '@shared/utils/computeEffectiveTier'
import { usePerfStore } from '../stores/perfStore'

export function useEffectiveTier(): PerfTier {
  return usePerfStore((s) => s.effectiveTier)
}
