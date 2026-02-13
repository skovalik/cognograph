/**
 * useNavigationHistory - Track viewport history for back/forward navigation
 *
 * ND-friendly feature: Supports spatial exploration by remembering
 * where you've been. "I was just looking at something..." → press Back.
 *
 * History is recorded when:
 * - User clicks on a node (selection change)
 * - User uses numbered bookmark
 * - User uses focus mode
 * - Significant pan/zoom (debounced)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'

interface ViewportState {
  x: number
  y: number
  zoom: number
  timestamp: number
  trigger?: 'selection' | 'bookmark' | 'focus' | 'pan' | 'zoom'
}

const MAX_HISTORY = 50
const DEBOUNCE_MS = 500
const MIN_MOVE_DISTANCE = 100 // Minimum pixels to consider a significant move

export function useNavigationHistory() {
  const { getViewport, setViewport } = useReactFlow()
  const [history, setHistory] = useState<ViewportState[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const lastRecordedRef = useRef<ViewportState | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Record current viewport to history
  const recordViewport = useCallback((trigger?: ViewportState['trigger']) => {
    const viewport = getViewport()
    const now = Date.now()

    // Check if significantly different from last recorded
    const last = lastRecordedRef.current
    if (last) {
      const dx = Math.abs(viewport.x - last.x)
      const dy = Math.abs(viewport.y - last.y)
      const dz = Math.abs(viewport.zoom - last.zoom)

      // Skip if too similar and recent
      if (dx < MIN_MOVE_DISTANCE && dy < MIN_MOVE_DISTANCE && dz < 0.2 && now - last.timestamp < 1000) {
        return
      }
    }

    const newState: ViewportState = {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
      timestamp: now,
      trigger
    }

    lastRecordedRef.current = newState

    setHistory(prev => {
      // If we're not at the end of history, truncate forward history
      const truncated = prev.slice(0, currentIndex + 1)
      const updated = [...truncated, newState]

      // Keep only last MAX_HISTORY entries
      if (updated.length > MAX_HISTORY) {
        return updated.slice(-MAX_HISTORY)
      }
      return updated
    })

    setCurrentIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1))
  }, [getViewport, currentIndex])

  // Record with debouncing (for pan/zoom)
  const recordViewportDebounced = useCallback((trigger?: ViewportState['trigger']) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      recordViewport(trigger)
      debounceTimerRef.current = null
    }, DEBOUNCE_MS)
  }, [recordViewport])

  // Navigate back in history
  const goBack = useCallback(() => {
    if (currentIndex <= 0) return false

    const newIndex = currentIndex - 1
    const state = history[newIndex]
    if (!state) return false

    setCurrentIndex(newIndex)
    setViewport({ x: state.x, y: state.y, zoom: state.zoom }, { duration: 200 })
    return true
  }, [history, currentIndex, setViewport])

  // Navigate forward in history
  const goForward = useCallback(() => {
    if (currentIndex >= history.length - 1) return false

    const newIndex = currentIndex + 1
    const state = history[newIndex]
    if (!state) return false

    setCurrentIndex(newIndex)
    setViewport({ x: state.x, y: state.y, zoom: state.zoom }, { duration: 200 })
    return true
  }, [history, currentIndex, setViewport])

  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < history.length - 1

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    recordViewport,
    recordViewportDebounced,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    historyLength: history.length,
    currentIndex
  }
}
