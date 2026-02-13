/**
 * UserCursors — Renders remote users' cursors on the canvas.
 *
 * Positioned as a React Flow viewport overlay. Each cursor shows
 * the user's name and a colored pointer matching their assigned color.
 */

import { memo, useState, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCollaborativeProvider } from '../../sync'

const CURSOR_INACTIVITY_MS = 30000 // 30 seconds

interface CursorData {
  id: string
  name: string
  color: string
  x: number
  y: number
  lastUpdate: number // timestamp of last movement
}

export const UserCursors = memo(function UserCursors() {
  const collaborativeProvider = useCollaborativeProvider()
  const [cursors, setCursors] = useState<CursorData[]>([])
  const { flowToScreenPosition } = useReactFlow()
  const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!collaborativeProvider) {
      setCursors([])
      return
    }

    const awareness = collaborativeProvider.getAwareness()

    const updateCursors = (): void => {
      const now = Date.now()
      const newCursors: CursorData[] = []

      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return
        if (!state.user || !state.cursor) return

        newCursors.push({
          id: state.user.id || String(clientId),
          name: state.user.name || 'Anonymous',
          color: state.user.color || '#888888',
          x: state.cursor.x,
          y: state.cursor.y,
          lastUpdate: now
        })
      })

      setCursors(newCursors)
    }

    awareness.on('change', updateCursors)
    updateCursors()

    // Periodically remove stale cursors (inactive for 30s)
    inactivityTimerRef.current = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => prev.filter((c) => now - c.lastUpdate < CURSOR_INACTIVITY_MS))
    }, 5000)

    return () => {
      awareness.off('change', updateCursors)
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current)
        inactivityTimerRef.current = null
      }
    }
  }, [collaborativeProvider])

  if (cursors.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {cursors.map((cursor) => {
        // Convert canvas coordinates to screen coordinates (null safety)
        let screenPos: { x: number; y: number }
        try {
          screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y })
        } catch {
          // flowToScreenPosition can fail if ReactFlow isn't ready
          return null
        }
        if (!screenPos) return null

        return (
          <div
            key={cursor.id}
            className="absolute transition-transform duration-75 ease-linear"
            style={{
              transform: `translate(${screenPos.x}px, ${screenPos.y}px)`
            }}
          >
            {/* Cursor pointer SVG */}
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              className="drop-shadow-sm"
            >
              <path
                d="M0.5 0.5L15 10L8 10.5L5 19L0.5 0.5Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>

            {/* Name label (truncated at 20 chars) */}
            <div
              className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm max-w-[120px] overflow-hidden text-ellipsis"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name.length > 20 ? cursor.name.slice(0, 20) + '...' : cursor.name}
            </div>
          </div>
        )
      })}
    </div>
  )
})
