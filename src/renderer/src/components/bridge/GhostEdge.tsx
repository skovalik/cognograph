/**
 * GhostEdge -- Dotted proposed edge rendered on canvas
 *
 * Registered as a React Flow custom edge type ('ghost').
 * Shows a dashed animated line between proposed or existing nodes.
 * Color matches the target node type.
 */

import { memo } from 'react'
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { Badge } from '../ui/Badge'

function GhostEdgeComponent({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style,
}: EdgeProps): JSX.Element {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const ghostData = data as { proposalId?: string; changeId?: string; label?: string } | undefined

  return (
    <>
      <path
        className="ghost-edge"
        d={edgePath}
        fill="none"
        stroke={style?.stroke as string || '#94a3b8'}
        style={style}
      />
      {ghostData?.label && (
        <EdgeLabelRenderer>
          <Badge
            variant="outline"
            className="text-[9px] px-1 absolute opacity-60"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            {ghostData.label}
          </Badge>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const GhostEdge = memo(GhostEdgeComponent)
