// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useEffectiveGlassStyle Hook
 *
 * Centralizes glass style computation logic (DRY principle).
 * Computes the effective glass style based on user preference, GPU tier, and ambient state.
 */

import type { GlassStyle } from '@shared/types'
import { useMemo } from 'react'
import { resolveGlassStyle } from '../utils/glassUtils'
import { useGPUTier } from './useGPUTier'

export function useEffectiveGlassStyle(
  userPreference: GlassStyle,
  ambientActive: boolean,
): 'solid' | 'soft-blur' | 'fluid-glass' {
  const gpuTier = useGPUTier()

  return useMemo(
    () => resolveGlassStyle(userPreference, gpuTier.tier, ambientActive),
    [userPreference, gpuTier.tier, ambientActive],
  )
}
