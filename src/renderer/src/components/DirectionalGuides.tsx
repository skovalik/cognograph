/**
 * DirectionalGuides — Visual directional navigation aids
 *
 * When keyboard navigation is active and a node is selected, renders thin
 * dashed gold lines extending from the selected node toward the nearest
 * valid navigation target in each cardinal direction. Target nodes receive
 * a faint gold highlight ring.
 *
 * Architecture:
 * - SVG overlay positioned absolutely over the canvas (pointer-events: none)
 * - Reads React Flow viewport to convert world coords to screen coords
 * - Uses the same findNearestInDirection algorithm as useSpatialNavigation
 * - Fades in/out with 200ms CSS transition
 *
 * Task 27: Visual Directional Guides [COULD]
 */

import { memo, useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore, selectKeyboardNavActive } from '../stores/uiStore'

// =============================================================================
// Types
// =============================================================================

type Direction = 'up' | 'down' | 'left' | 'right'

interface NodeCandidate {
  id: string
  centerX: number
  centerY: number
  width: number
  height: number
}

interface GuideTarget {
  direction: Direction
  targetId: string
  targetCenterX: number
  targetCenterY: number
  targetWidth: number
  targetHeight: number
}

// =============================================================================
// Constants
// =============================================================================

/** Guide line opacity */
const LINE_OPACITY = 0.3

/** Target ring opacity */
const RING_OPACITY = 0.2

/** Target ring stroke width */
const RING_STROKE = 2

/** Guide line stroke width */
const LINE_STROKE = 1

/** Ring corner radius */
const RING_RADIUS = 8

/** Padding around target node for ring */
const RING_PADDING = 4

// =============================================================================
// Spatial algorithm (mirrored from useSpatialNavigation.ts)
// =============================================================================

function findNearestInDirection(
  currentX: number,
  currentY: number,
  candidates: NodeCandidate[],
  direction: Direction
): NodeCandidate | null {
  let best: NodeCandidate | null = null
  let bestScore = Infinity

  for (const c of candidates) {
    const dx = c.centerX - currentX
    const dy = c.centerY - currentY
    const distance = Math.sqrt(dx * dx + dy * dy)

    let isInDirection = false
    let score = distance

    switch (direction) {
      case 'up':
        isInDirection = dy < -10 && Math.abs(dx) < Math.abs(dy)
        score = distance + Math.abs(dx) * 2
        break
      case 'down':
        isInDirection = dy > 10 && Math.abs(dx) < Math.abs(dy)
        score = distance + Math.abs(dx) * 2
        break
      case 'left':
        isInDirection = dx < -10 && Math.abs(dy) < Math.abs(dx)
        score = distance + Math.abs(dy) * 2
        break
      case 'right':
        isInDirection = dx > 10 && Math.abs(dy) < Math.abs(dx)
        score = distance + Math.abs(dy) * 2
        break
    }

    if (isInDirection && score < bestScore) {
      bestScore = score
      best = c
    }
  }

  return best
}

// =============================================================================
// World-to-screen coordinate conversion
// =============================================================================

function worldToScreen(
  wx: number,
  wy: number,
  viewport: { x: number; y: number; zoom: number }
): { x: number; y: number } {
  return {
    x: wx * viewport.zoom + viewport.x,
    y: wy * viewport.zoom + viewport.y
  }
}

// =============================================================================
// Component
// =============================================================================

export const DirectionalGuides = memo(function DirectionalGuides(): JSX.Element | null {
  const keyboardNavActive = useUIStore(selectKeyboardNavActive)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const viewport = useViewport()

  // Compute guide targets for each cardinal direction
  const guides = useMemo((): GuideTarget[] => {
    if (!keyboardNavActive || selectedNodeIds.length === 0) return []

    // Use the last selected node as anchor (consistent with useSpatialNavigation)
    const anchorId = selectedNodeIds[selectedNodeIds.length - 1]!
    const anchorNode = nodes.find((n) => n.id === anchorId)
    if (!anchorNode) return []

    const anchorW = (anchorNode.width as number) || 280
    const anchorH = (anchorNode.height as number) || 140
    const anchorCX = anchorNode.position.x + anchorW / 2
    const anchorCY = anchorNode.position.y + anchorH / 2

    // Build candidates excluding the anchor
    const candidates: NodeCandidate[] = nodes
      .filter((n) => n.id !== anchorId)
      .map((n) => ({
        id: n.id,
        centerX: n.position.x + ((n.width as number) || 280) / 2,
        centerY: n.position.y + ((n.height as number) || 140) / 2,
        width: (n.width as number) || 280,
        height: (n.height as number) || 140
      }))

    const directions: Direction[] = ['up', 'down', 'left', 'right']
    const results: GuideTarget[] = []

    for (const dir of directions) {
      const target = findNearestInDirection(anchorCX, anchorCY, candidates, dir)
      if (target) {
        results.push({
          direction: dir,
          targetId: target.id,
          targetCenterX: target.centerX,
          targetCenterY: target.centerY,
          targetWidth: target.width,
          targetHeight: target.height
        })
      }
    }

    return results
  }, [keyboardNavActive, selectedNodeIds, nodes])

  // Don't render anything when keyboard nav is inactive or no guides
  if (!keyboardNavActive || selectedNodeIds.length === 0) return null

  // Get anchor node screen position
  const anchorId = selectedNodeIds[selectedNodeIds.length - 1]!
  const anchorNode = nodes.find((n) => n.id === anchorId)
  if (!anchorNode) return null

  const anchorW = (anchorNode.width as number) || 280
  const anchorH = (anchorNode.height as number) || 140
  const anchorCX = anchorNode.position.x + anchorW / 2
  const anchorCY = anchorNode.position.y + anchorH / 2
  const anchorScreen = worldToScreen(anchorCX, anchorCY, viewport)

  return (
    <svg
      className="pointer-events-none fixed inset-0 overflow-visible"
      style={{
        zIndex: 998,
        width: '100vw',
        height: '100vh',
        opacity: guides.length > 0 ? 1 : 0,
        transition: 'opacity 200ms ease-in-out'
      }}
      aria-hidden="true"
    >
      <defs>
        <filter id="guide-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
      </defs>

      {guides.map((guide) => {
        const targetScreen = worldToScreen(guide.targetCenterX, guide.targetCenterY, viewport)
        const ringW = guide.targetWidth * viewport.zoom + RING_PADDING * 2
        const ringH = guide.targetHeight * viewport.zoom + RING_PADDING * 2
        const ringX = targetScreen.x - ringW / 2
        const ringY = targetScreen.y - ringH / 2

        return (
          <g key={guide.direction}>
            {/* Dashed guide line from anchor to target */}
            <line
              x1={anchorScreen.x}
              y1={anchorScreen.y}
              x2={targetScreen.x}
              y2={targetScreen.y}
              stroke="var(--accent-glow, #C8963E)"
              strokeWidth={LINE_STROKE}
              strokeDasharray="6 4"
              opacity={LINE_OPACITY}
              style={{ transition: 'opacity 200ms ease-in-out' }}
            />

            {/* Subtle glow behind the line for visibility */}
            <line
              x1={anchorScreen.x}
              y1={anchorScreen.y}
              x2={targetScreen.x}
              y2={targetScreen.y}
              stroke="var(--accent-glow, #C8963E)"
              strokeWidth={LINE_STROKE + 2}
              strokeDasharray="6 4"
              opacity={LINE_OPACITY * 0.3}
              filter="url(#guide-glow)"
              style={{ transition: 'opacity 200ms ease-in-out' }}
            />

            {/* Gold highlight ring around target node */}
            <rect
              x={ringX}
              y={ringY}
              width={ringW}
              height={ringH}
              rx={RING_RADIUS}
              ry={RING_RADIUS}
              fill="none"
              stroke="var(--accent-glow, #C8963E)"
              strokeWidth={RING_STROKE}
              opacity={RING_OPACITY}
              style={{ transition: 'opacity 200ms ease-in-out' }}
            />
          </g>
        )
      })}
    </svg>
  )
})
