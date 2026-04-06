// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useRatchetHeight — prevents layout shift during streaming.
 *
 * Once a container grows to height H, min-height is locked at H until
 * streaming ends (isStreaming flips false), at which point the ratchet
 * resets so the container can shrink to its natural size.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Computes the next ratchet height. The height can only increase while
 * streaming is active. When streaming is false, returns 0 (reset).
 */
export function computeRatchetHeight(
  currentMin: number,
  observedHeight: number,
  isStreaming: boolean,
): number {
  if (!isStreaming) return 0
  return Math.max(currentMin, observedHeight)
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface RatchetHeightResult {
  /** Attach to the container element */
  ref: (node: HTMLElement | null) => void
  /** Apply as style.minHeight on the container */
  minHeight: number
}

export function useRatchetHeight(isStreaming: boolean): RatchetHeightResult {
  const [minHeight, setMinHeight] = useState(0)
  const nodeRef = useRef<HTMLElement | null>(null)

  // Reset ratchet when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      setMinHeight(0)
    }
  }, [isStreaming])

  // Observe height changes during streaming via ResizeObserver
  useEffect(() => {
    const el = nodeRef.current
    if (!isStreaming || !el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height
        setMinHeight((prev) => Math.max(prev, h))
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [isStreaming])

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node
  }, [])

  return { ref, minHeight }
}
