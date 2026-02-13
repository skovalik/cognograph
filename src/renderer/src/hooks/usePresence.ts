/**
 * usePresence — Hook for broadcasting local user's cursor and viewport.
 *
 * Throttles awareness updates to ~50ms for smooth remote cursor movement
 * without overwhelming the network.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useCollaborativeProvider } from '../sync'
import { useWorkspaceStore } from '../stores/workspaceStore'

const THROTTLE_MS = 50

export function usePresence(): {
  broadcastCursor: (canvasX: number, canvasY: number) => void
  clearCursor: () => void
} {
  const collaborativeProvider = useCollaborativeProvider()
  const lastUpdateRef = useRef(0)
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null)

  // Broadcast selection changes to awareness
  useEffect(() => {
    if (!collaborativeProvider) return

    const unsub = useWorkspaceStore.subscribe(
      (state) => state.selectedNodeIds,
      (selectedNodeIds) => {
        const awareness = collaborativeProvider.getAwareness()
        awareness.setLocalStateField('selectedNodeIds', selectedNodeIds)
      }
    )

    return unsub
  }, [collaborativeProvider])

  // Keep a ref to the provider to avoid stale closures in timers
  const providerRef = useRef(collaborativeProvider)
  providerRef.current = collaborativeProvider

  // Broadcast viewport changes (debounced more aggressively)
  useEffect(() => {
    if (!collaborativeProvider) return

    let viewportTimer: NodeJS.Timeout | null = null

    const unsub = useWorkspaceStore.subscribe(
      (state) => state.viewport,
      (viewport) => {
        if (viewportTimer) clearTimeout(viewportTimer)
        viewportTimer = setTimeout(() => {
          // Use ref to get latest provider (avoids stale closure)
          const provider = providerRef.current
          if (!provider) return
          const awareness = provider.getAwareness()
          // Approximate viewport bounds from position + zoom
          awareness.setLocalStateField('viewportBounds', {
            x: viewport.x,
            y: viewport.y,
            width: window.innerWidth / viewport.zoom,
            height: window.innerHeight / viewport.zoom
          })
        }, 200)
      }
    )

    return () => {
      unsub()
      if (viewportTimer) clearTimeout(viewportTimer)
    }
  }, [collaborativeProvider])

  const broadcastCursor = useCallback((canvasX: number, canvasY: number) => {
    if (!collaborativeProvider) return

    const now = Date.now()
    if (now - lastUpdateRef.current < THROTTLE_MS) {
      // Throttle: schedule a trailing update
      if (!pendingUpdateRef.current) {
        pendingUpdateRef.current = setTimeout(() => {
          pendingUpdateRef.current = null
          const awareness = collaborativeProvider.getAwareness()
          awareness.setLocalStateField('cursor', { x: canvasX, y: canvasY })
          lastUpdateRef.current = Date.now()
        }, THROTTLE_MS)
      }
      return
    }

    lastUpdateRef.current = now
    const awareness = collaborativeProvider.getAwareness()
    awareness.setLocalStateField('cursor', { x: canvasX, y: canvasY })
  }, [collaborativeProvider])

  const clearCursor = useCallback(() => {
    if (!collaborativeProvider) return
    const awareness = collaborativeProvider.getAwareness()
    awareness.setLocalStateField('cursor', null)
  }, [collaborativeProvider])

  // Clear cursor on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current)
      }
    }
  }, [])

  return { broadcastCursor, clearCursor }
}
