// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useAdaptiveQuality — Runtime FPS monitoring + resolution scaling for ambient effects
 *
 * Ported from aurochs.agency adaptive quality pattern. Delivers quality state via
 * RefObject (not props) to avoid re-renders → OGL context teardowns. Circular buffer
 * FPS monitor is GC-free and O(1) per frame.
 *
 * Scale steps: [0.25, 0.35, 0.5, 0.75, 1.0]
 * Down: <20fps for 1.5s → step down
 * Up: >30fps for 3s → step up
 */

import { useRef, useEffect } from 'react'
import { getGPUTier } from '../utils/gpuDetection'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore } from '../stores/uiStore'
import { useCanvasViewportStore } from '../stores/canvasViewportStore'

// =============================================================================
// Types
// =============================================================================

export interface AdaptiveQualityState {
  resolutionScale: number    // 0.25 → 1.0
  frameSkip: boolean         // true = render every other frame
  shouldRender: boolean      // false when tab hidden
  dprCap: number             // capped devicePixelRatio
}

export type PerformanceModeSetting = 'auto' | 'quality' | 'battery'

// =============================================================================
// Constants
// =============================================================================

const SCALE_STEPS = [0.25, 0.35, 0.5, 0.75, 1.0]
const FRAME_BUF_SIZE = 128
const FPS_CHECK_INTERVAL = 500
const FPS_DOWN_THRESHOLD = 20
const FPS_UP_THRESHOLD = 30
const DOWN_HOLD_MS = 1500
const UP_HOLD_MS = 3000
const INTERACTION_SCALE = 0.35
const DPR_CAP = Math.min(window.devicePixelRatio || 1, 2.0)

// =============================================================================
// Hook
// =============================================================================

export function useAdaptiveQuality(opts?: {
  initialScale?: number
  resetKey?: string
  performanceMode?: PerformanceModeSetting
}): {
  qualityRef: React.RefObject<AdaptiveQualityState>
  reportFrame: () => void
} {
  const performanceMode = opts?.performanceMode ?? 'auto'
  const resetKey = opts?.resetKey

  // Determine initial scale from GPU tier + node count
  const gpuTier = useRef(getGPUTier()).current
  const nodeCount = useRef(useWorkspaceStore.getState().nodes.length).current

  const computeInitialScale = (): number => {
    if (opts?.initialScale != null) return opts.initialScale
    if (nodeCount > 100) return 0.35
    if (nodeCount > 50) return 0.5
    return gpuTier.tier === 'medium' ? 0.5 : 1.0
  }

  const initialScale = useRef(computeInitialScale()).current

  // Lock modes
  const lockedScale = performanceMode === 'quality'
    ? 1.0
    : performanceMode === 'battery'
      ? 0.25
      : null
  const lockedFrameSkip = performanceMode === 'battery' ? true : performanceMode === 'quality' ? false : null

  // Quality state ref — stable identity, read from rAF loops
  const qualityRef = useRef<AdaptiveQualityState>({
    resolutionScale: lockedScale ?? initialScale,
    frameSkip: lockedFrameSkip ?? false,
    shouldRender: !document.hidden,
    dprCap: DPR_CAP,
  })

  // Circular buffer for frame timestamps — GC-free, O(1) per frame
  const frameBuf = useRef(new Float64Array(FRAME_BUF_SIZE))
  const frameBufHead = useRef(0)
  const frameBufCount = useRef(0)

  // Stable function identity — created once, never changes
  const reportFrame = useRef(() => {
    const now = performance.now()
    const buf = frameBuf.current
    buf[frameBufHead.current % FRAME_BUF_SIZE] = now
    frameBufHead.current++
    frameBufCount.current = Math.min(frameBufCount.current + 1, FRAME_BUF_SIZE)
    // Prune >2s old entries
    while (
      frameBufCount.current > 1 &&
      buf[(frameBufHead.current - frameBufCount.current + FRAME_BUF_SIZE) % FRAME_BUF_SIZE] < now - 2000
    ) {
      frameBufCount.current--
    }
  }).current

  // Visibility change handler
  useEffect(() => {
    const onVisibilityChange = () => {
      qualityRef.current = {
        ...qualityRef.current,
        shouldRender: !document.hidden,
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // Reset FPS history when effect changes
  useEffect(() => {
    frameBufHead.current = 0
    frameBufCount.current = 0
    const scale = lockedScale ?? initialScale
    qualityRef.current = {
      ...qualityRef.current,
      resolutionScale: scale,
      frameSkip: lockedFrameSkip ?? false,
    }
  }, [resetKey, initialScale, lockedScale, lockedFrameSkip])

  // FPS analysis on interval (not per-frame)
  useEffect(() => {
    if (performanceMode !== 'auto') return

    let downSince = 0
    let upSince = 0
    let currentStepIndex = SCALE_STEPS.indexOf(
      SCALE_STEPS.reduce((prev, step) =>
        Math.abs(step - qualityRef.current.resolutionScale) < Math.abs(prev - qualityRef.current.resolutionScale) ? step : prev
      )
    )

    const interval = setInterval(() => {
      const now = performance.now()
      const count = frameBufCount.current
      if (count < 2) return

      // Compute FPS from circular buffer
      const newest = frameBuf.current[(frameBufHead.current - 1 + FRAME_BUF_SIZE) % FRAME_BUF_SIZE]
      const oldest = frameBuf.current[(frameBufHead.current - count + FRAME_BUF_SIZE) % FRAME_BUF_SIZE]
      const elapsed = newest - oldest
      if (elapsed <= 0) return
      const fps = ((count - 1) / elapsed) * 1000

      // Check interaction state — drop to minimum during canvas drag/pan/zoom
      const isInteracting = useUIStore.getState().isCanvasInteracting ?? false
      const isFocusMode = useCanvasViewportStore.getState().isFocusModeActive()

      if (isInteracting || isFocusMode) {
        qualityRef.current = {
          ...qualityRef.current,
          resolutionScale: INTERACTION_SCALE,
          frameSkip: true,
        }
        downSince = 0
        upSince = 0
        return
      }

      // Adaptive scaling
      if (fps < FPS_DOWN_THRESHOLD) {
        upSince = 0
        if (downSince === 0) {
          downSince = now
        } else if (now - downSince >= DOWN_HOLD_MS && currentStepIndex > 0) {
          currentStepIndex--
          qualityRef.current = {
            ...qualityRef.current,
            resolutionScale: SCALE_STEPS[currentStepIndex],
            frameSkip: currentStepIndex < 2, // enable frameSkip at 0.25 and 0.35
          }
          downSince = 0 // reset after stepping down
        }
      } else if (fps > FPS_UP_THRESHOLD) {
        downSince = 0
        if (upSince === 0) {
          upSince = now
        } else if (now - upSince >= UP_HOLD_MS && currentStepIndex < SCALE_STEPS.length - 1) {
          currentStepIndex++
          qualityRef.current = {
            ...qualityRef.current,
            resolutionScale: SCALE_STEPS[currentStepIndex],
            frameSkip: currentStepIndex < 2,
          }
          upSince = 0 // reset after stepping up
        }
      } else {
        // In between thresholds — reset timers
        downSince = 0
        upSince = 0
      }

      // Sync quality state to store for R3F effects (they can't read refs across Canvas boundary)
      useUIStore.getState().setAmbientQuality({ ...qualityRef.current })
    }, FPS_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [performanceMode])

  return { qualityRef, reportFrame }
}
