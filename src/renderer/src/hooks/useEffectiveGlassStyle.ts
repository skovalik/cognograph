/**
 * useEffectiveGlassStyle Hook
 *
 * Centralizes glass style computation logic (DRY principle).
 * Computes the effective glass style based on user preference, GPU tier, and ambient state.
 */

import { useMemo } from 'react'
import { resolveGlassStyle } from '../utils/glassUtils'
import { useGPUTier } from './useGPUTier'
import type { GlassStyle } from '@shared/types'

export function useEffectiveGlassStyle(
  userPreference: GlassStyle,
  ambientActive: boolean
): 'solid' | 'soft-blur' | 'fluid-glass' {
  const gpuTier = useGPUTier()

  return useMemo(() => resolveGlassStyle(
    userPreference,
    gpuTier.tier,
    ambientActive
  ), [userPreference, gpuTier.tier, ambientActive])
}
