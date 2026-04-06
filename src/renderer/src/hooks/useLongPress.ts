// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * useLongPress Hook
 *
 * Detects long-press (touch-hold) gestures on mobile/touch devices.
 * Returns touch event handlers to attach to any element.
 *
 * - Fires callback after `delay` ms of stationary touch
 * - Cancels if touch moves beyond `moveThreshold` px
 * - Cancels on multi-touch (pinch/zoom)
 * - Triggers haptic feedback via navigator.vibrate() if available
 * - Prevents the subsequent contextmenu/click events after a successful long-press
 */

import { useCallback, useRef } from 'react'

interface LongPressOptions {
  /** Delay in ms before long-press fires (default: 500) */
  delay?: number
  /** Movement threshold in px to cancel (default: 15) */
  moveThreshold?: number
  /** Whether the hook is active (default: true) */
  enabled?: boolean
  /** Called when touch starts and timer begins — use for visual feedback */
  onPressStart?: (target: HTMLElement) => void
  /** Called when press is cancelled (moved, lifted, multi-touch) before firing */
  onPressCancel?: () => void
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onTouchCancel: (e: React.TouchEvent) => void
}

type LongPressCallback = (
  position: { clientX: number; clientY: number },
  target: HTMLElement,
) => void

export function useLongPress(
  callback: LongPressCallback,
  options: LongPressOptions = {},
): LongPressHandlers {
  const { delay = 500, moveThreshold = 15, enabled = true, onPressStart, onPressCancel } = options

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const firedRef = useRef(false)
  const targetRef = useRef<HTMLElement | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      // Only call onPressCancel if the press didn't fire
      if (!firedRef.current) {
        onPressCancel?.()
      }
    }
    startPosRef.current = null
    targetRef.current = null
  }, [onPressCancel])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return

      // Only handle single-finger touch
      if (e.touches.length !== 1) {
        clear()
        return
      }

      const touch = e.touches[0]
      startPosRef.current = { x: touch.clientX, y: touch.clientY }
      targetRef.current = e.target as HTMLElement
      firedRef.current = false
      onPressStart?.(e.target as HTMLElement)

      timerRef.current = setTimeout(() => {
        if (startPosRef.current && targetRef.current) {
          firedRef.current = true

          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(30)
          }

          callback(
            { clientX: startPosRef.current.x, clientY: startPosRef.current.y },
            targetRef.current,
          )
        }
        timerRef.current = null
      }, delay)
    },
    [enabled, delay, callback, clear, onPressStart],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current || timerRef.current === null) return

      const touch = e.touches[0]
      const dx = touch.clientX - startPosRef.current.x
      const dy = touch.clientY - startPosRef.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > moveThreshold) {
        clear()
      }
    },
    [moveThreshold, clear],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const didFire = firedRef.current
      clear()
      // Clean up visual feedback regardless
      if (didFire) {
        onPressCancel?.()
        e.preventDefault()
      }
    },
    [clear, onPressCancel],
  )

  const onTouchCancel = useCallback(() => {
    clear()
  }, [clear])

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
}
