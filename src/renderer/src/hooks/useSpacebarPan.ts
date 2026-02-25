/**
 * Spacebar + Arrow Key Panning Hook
 *
 * Hold Spacebar + Arrow keys to pan the viewport.
 * 50px per single keypress, 200px/s when key held.
 * Only active when no text input is focused.
 * Spacebar alone should NOT trigger (must combine with arrow).
 *
 * PFD Phase 5B: Canvas Interaction Patterns
 */

import { useEffect, useRef, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

const PAN_STEP = 50 // px per single key press
const PAN_SPEED = 200 // px per second when held
const FRAME_INTERVAL = 16 // ~60fps

function isTextInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.getAttribute('contenteditable') === 'true' ||
    !!el.closest?.('[contenteditable="true"]')
  )
}

export function useSpacebarPan(): void {
  const { getViewport, setViewport } = useReactFlow()
  const spaceHeld = useRef(false)
  const arrowsHeld = useRef<Set<string>>(new Set())
  const animFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const pan = useCallback(
    (dx: number, dy: number) => {
      const vp = getViewport()
      setViewport({
        x: vp.x + dx,
        y: vp.y + dy,
        zoom: vp.zoom
      })
    },
    [getViewport, setViewport]
  )

  // Continuous panning loop when keys are held
  const startPanLoop = useCallback(() => {
    if (animFrameRef.current !== null) return

    lastTimeRef.current = performance.now()

    const loop = (now: number): void => {
      const dt = (now - lastTimeRef.current) / 1000 // seconds
      lastTimeRef.current = now

      if (!spaceHeld.current || arrowsHeld.current.size === 0) {
        animFrameRef.current = null
        return
      }

      let dx = 0
      let dy = 0
      const amount = PAN_SPEED * dt

      if (arrowsHeld.current.has('ArrowLeft')) dx += amount
      if (arrowsHeld.current.has('ArrowRight')) dx -= amount
      if (arrowsHeld.current.has('ArrowUp')) dy += amount
      if (arrowsHeld.current.has('ArrowDown')) dy -= amount

      if (dx !== 0 || dy !== 0) {
        pan(dx, dy)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
  }, [pan])

  const stopPanLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isTextInputFocused()) return

      if (e.code === 'Space') {
        // Only prevent default if space is used for panning (with arrows)
        // Track that space is held
        spaceHeld.current = true
        // Prevent scrolling when space is combined with arrows
        if (arrowsHeld.current.size > 0) {
          e.preventDefault()
        }
        return
      }

      const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      if (arrowKeys.includes(e.key) && spaceHeld.current) {
        e.preventDefault()
        e.stopPropagation()

        if (!arrowsHeld.current.has(e.key)) {
          // First press of this arrow: immediate step
          let dx = 0, dy = 0
          if (e.key === 'ArrowLeft') dx = PAN_STEP
          if (e.key === 'ArrowRight') dx = -PAN_STEP
          if (e.key === 'ArrowUp') dy = PAN_STEP
          if (e.key === 'ArrowDown') dy = -PAN_STEP
          pan(dx, dy)

          arrowsHeld.current.add(e.key)
          startPanLoop()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        arrowsHeld.current.clear()
        stopPanLoop()
        return
      }

      if (arrowsHeld.current.has(e.key)) {
        arrowsHeld.current.delete(e.key)
        if (arrowsHeld.current.size === 0) {
          stopPanLoop()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      stopPanLoop()
    }
  }, [pan, startPanLoop, stopPanLoop])
}
