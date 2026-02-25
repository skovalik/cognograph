// ExecutionStatusOverlay — Phase 5A: Canvas-Level Execution Badges
// Renders ExecutionStatusBadge on all participating nodes during an
// orchestrated execution. Positioned at the canvas level so ANY node
// type can show execution status without modifying its component.

import { memo, useMemo } from 'react'
import { useNodes, useViewport } from '@xyflow/react'
import { useExecutionStatusStore } from '../stores/executionStatusStore'
import { ExecutionStatusBadge } from './ExecutionStatusBadge'

function ExecutionStatusOverlayComponent(): JSX.Element | null {
  const nodeExecutions = useExecutionStatusStore((s) => s.nodeExecutions)
  const viewport = useViewport()
  const rfNodes = useNodes()

  // Build a lookup map: nodeId -> { x, y, width, height }
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>()
    for (const node of rfNodes) {
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: (node.measured?.width ?? node.width ?? 200) as number,
        height: (node.measured?.height ?? node.height ?? 100) as number,
      })
    }
    return map
  }, [rfNodes])

  // Get execution entries that have a corresponding visible node
  const entries = useMemo(() => {
    const result: Array<{
      nodeId: string
      status: typeof nodeExecutions[string]
      pos: { x: number; y: number; width: number; height: number }
    }> = []

    for (const [nodeId, execState] of Object.entries(nodeExecutions)) {
      const pos = nodePositions.get(nodeId)
      if (pos) {
        result.push({ nodeId, status: execState, pos })
      }
    }
    return result
  }, [nodeExecutions, nodePositions])

  if (entries.length === 0) return null

  return (
    <div
      className="execution-status-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      {entries.map(({ nodeId, status, pos }) => {
        // Convert flow coordinates to screen coordinates
        const screenX = pos.x * viewport.zoom + viewport.x + pos.width * viewport.zoom
        const screenY = pos.y * viewport.zoom + viewport.y

        return (
          <div
            key={nodeId}
            style={{
              position: 'absolute',
              left: screenX - 6,
              top: screenY - 6,
              pointerEvents: 'none',
            }}
          >
            <ExecutionStatusBadge
              status={status.status}
              message={status.message}
            />
          </div>
        )
      })}
    </div>
  )
}

export const ExecutionStatusOverlay = memo(ExecutionStatusOverlayComponent)
