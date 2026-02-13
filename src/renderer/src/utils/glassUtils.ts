/**
 * Glass style resolution utilities.
 *
 * Handles automatic fallback logic based on GPU tier and ambient canvas state.
 * Prevents performance issues from backdrop-filter over WebGL on medium-tier GPUs.
 */

import type { GlassStyle } from '@shared/types'

/**
 * Resolve effective glass style from user preference, GPU tier, and ambient state.
 *
 * Fallback logic:
 * - GPU tier 'low' → force 'solid' (no blur at all)
 * - GPU tier 'medium' + ambient active → cap at 'soft-blur' (CSS only, no shimmer)
 * - GPU tier 'medium' + ambient off → allow 'soft-blur'
 * - GPU tier 'high' → allow 'fluid-glass' (full GPU effects)
 * - User preference overrides auto-detection (except tier 'low' blocks fluid-glass)
 *
 * @param userPref User's chosen glass style
 * @param gpuTier Detected GPU tier ('high', 'medium', 'low')
 * @param ambientActive Whether ambient canvas effect is currently rendering
 * @returns Resolved effective style (never 'auto')
 */
export function resolveGlassStyle(
  userPref: GlassStyle,
  gpuTier: 'high' | 'medium' | 'low',
  ambientActive: boolean
): 'solid' | 'soft-blur' | 'fluid-glass' {
  // User forced a specific style (not auto)
  if (userPref !== 'auto') {
    // Safety: block fluid-glass on low-tier GPUs even if user requested it
    if (userPref === 'fluid-glass' && gpuTier === 'low') {
      return 'solid'
    }
    // Safety: block fluid-glass on medium-tier with ambient active
    if (userPref === 'fluid-glass' && gpuTier === 'medium' && ambientActive) {
      return 'soft-blur'
    }
    return userPref
  }

  // Auto mode: detect best style for hardware
  // GPU tier = low → force solid
  if (gpuTier === 'low') {
    return 'solid'
  }

  // GPU tier = medium + ambient active → cap at soft-blur
  // (backdrop-filter over WebGL is expensive on medium GPUs)
  if (gpuTier === 'medium' && ambientActive) {
    return 'soft-blur'
  }

  // GPU tier = high → allow fluid-glass
  if (gpuTier === 'high') {
    return 'fluid-glass'
  }

  // GPU tier = medium, no ambient → soft-blur (safe default)
  return 'soft-blur'
}
