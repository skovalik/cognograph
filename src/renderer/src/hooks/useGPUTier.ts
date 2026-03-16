// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

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
