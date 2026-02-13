/**
 * Snap-to-Guide System
 *
 * Pure functions for calculating alignment guides when dragging nodes.
 * Shows guide lines when node edges/centers align with other nodes.
 * Snaps position on release (within threshold).
 */

export interface SnapGuide {
  type: 'horizontal' | 'vertical'
  position: number // y for horizontal, x for vertical
  start: number // visual extent start
  end: number // visual extent end
}

export interface SnapResult {
  snappedPosition: { x: number; y: number }
  guides: SnapGuide[]
}

interface NodeRect {
  position: { x: number; y: number }
  width: number
  height: number
}

const SNAP_THRESHOLD = 8 // pixels in flow coordinates

/**
 * Calculate snap guides and snapped position for a dragging node group.
 * Checks alignment of edges and centers against all static (non-dragged) nodes.
 */
export function calculateSnapGuides(
  _draggingNodes: NodeRect[],
  staticNodes: NodeRect[],
  currentPosition: { x: number; y: number },
  primaryNodeRect: NodeRect
): SnapResult {
  if (staticNodes.length === 0) {
    return { snappedPosition: currentPosition, guides: [] }
  }

  const guides: SnapGuide[] = []
  let snapX: number | null = null
  let snapY: number | null = null
  let bestDeltaX = SNAP_THRESHOLD + 1
  let bestDeltaY = SNAP_THRESHOLD + 1

  // Primary node edges and center
  const dragLeft = primaryNodeRect.position.x
  const dragRight = primaryNodeRect.position.x + primaryNodeRect.width
  const dragCenterX = primaryNodeRect.position.x + primaryNodeRect.width / 2
  const dragTop = primaryNodeRect.position.y
  const dragBottom = primaryNodeRect.position.y + primaryNodeRect.height
  const dragCenterY = primaryNodeRect.position.y + primaryNodeRect.height / 2

  for (const staticNode of staticNodes) {
    const staticLeft = staticNode.position.x
    const staticRight = staticNode.position.x + staticNode.width
    const staticCenterX = staticNode.position.x + staticNode.width / 2
    const staticTop = staticNode.position.y
    const staticBottom = staticNode.position.y + staticNode.height
    const staticCenterY = staticNode.position.y + staticNode.height / 2

    // Vertical alignment checks (snap X)
    const verticalChecks: Array<{ dragEdge: number; staticEdge: number }> = [
      { dragEdge: dragLeft, staticEdge: staticLeft },
      { dragEdge: dragLeft, staticEdge: staticRight },
      { dragEdge: dragRight, staticEdge: staticLeft },
      { dragEdge: dragRight, staticEdge: staticRight },
      { dragEdge: dragCenterX, staticEdge: staticCenterX },
    ]

    for (const check of verticalChecks) {
      const delta = Math.abs(check.dragEdge - check.staticEdge)
      if (delta <= SNAP_THRESHOLD && delta < bestDeltaX) {
        bestDeltaX = delta
        snapX = currentPosition.x + (check.staticEdge - check.dragEdge)
      }
    }

    // Horizontal alignment checks (snap Y)
    const horizontalChecks: Array<{ dragEdge: number; staticEdge: number }> = [
      { dragEdge: dragTop, staticEdge: staticTop },
      { dragEdge: dragTop, staticEdge: staticBottom },
      { dragEdge: dragBottom, staticEdge: staticTop },
      { dragEdge: dragBottom, staticEdge: staticBottom },
      { dragEdge: dragCenterY, staticEdge: staticCenterY },
    ]

    for (const check of horizontalChecks) {
      const delta = Math.abs(check.dragEdge - check.staticEdge)
      if (delta <= SNAP_THRESHOLD && delta < bestDeltaY) {
        bestDeltaY = delta
        snapY = currentPosition.y + (check.staticEdge - check.dragEdge)
      }
    }
  }

  // Now generate guide lines for all alignments within threshold
  // Use the snapped position to determine which guides to show
  const finalX = snapX !== null ? snapX : currentPosition.x
  const finalY = snapY !== null ? snapY : currentPosition.y

  const finalLeft = finalX
  const finalRight = finalX + primaryNodeRect.width
  const finalCenterX = finalX + primaryNodeRect.width / 2
  const finalTop = finalY
  const finalBottom = finalY + primaryNodeRect.height
  const finalCenterY = finalY + primaryNodeRect.height / 2

  for (const staticNode of staticNodes) {
    const staticLeft = staticNode.position.x
    const staticRight = staticNode.position.x + staticNode.width
    const staticCenterX = staticNode.position.x + staticNode.width / 2
    const staticTop = staticNode.position.y
    const staticBottom = staticNode.position.y + staticNode.height
    const staticCenterY = staticNode.position.y + staticNode.height / 2

    // Vertical guides (x-axis alignment)
    const verticalAlignments = [
      { drag: finalLeft, stat: staticLeft },
      { drag: finalLeft, stat: staticRight },
      { drag: finalRight, stat: staticLeft },
      { drag: finalRight, stat: staticRight },
      { drag: finalCenterX, stat: staticCenterX },
    ]

    for (const { drag, stat } of verticalAlignments) {
      if (Math.abs(drag - stat) < 1) {
        const minY = Math.min(finalTop, staticTop) - 10
        const maxY = Math.max(finalBottom, staticBottom) + 10
        guides.push({
          type: 'vertical',
          position: stat,
          start: minY,
          end: maxY
        })
      }
    }

    // Horizontal guides (y-axis alignment)
    const horizontalAlignments = [
      { drag: finalTop, stat: staticTop },
      { drag: finalTop, stat: staticBottom },
      { drag: finalBottom, stat: staticTop },
      { drag: finalBottom, stat: staticBottom },
      { drag: finalCenterY, stat: staticCenterY },
    ]

    for (const { drag, stat } of horizontalAlignments) {
      if (Math.abs(drag - stat) < 1) {
        const minX = Math.min(finalLeft, staticLeft) - 10
        const maxX = Math.max(finalRight, staticRight) + 10
        guides.push({
          type: 'horizontal',
          position: stat,
          start: minX,
          end: maxX
        })
      }
    }
  }

  // Deduplicate guides (same type + position)
  const uniqueGuides: SnapGuide[] = []
  const seen = new Set<string>()
  for (const guide of guides) {
    const key = `${guide.type}-${Math.round(guide.position)}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueGuides.push(guide)
    }
  }

  return {
    snappedPosition: { x: finalX, y: finalY },
    guides: uniqueGuides
  }
}
