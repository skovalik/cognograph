/**
 * useGPUTier Hook
 *
 * Caches GPU tier detection result for the session lifetime.
 * Only detects GPU once, preventing redundant WebGL context creation.
 */

import { useMemo } from 'react'
import { getGPUTier } from '../utils/gpuDetection'

export function useGPUTier() {
  return useMemo(() => getGPUTier(), []) // Empty deps = compute once per component mount
}
