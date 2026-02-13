/**
 * MovementPath Component
 *
 * An SVG path showing where a node will move to.
 * Draws a dashed line from the current position to the new position.
 * Scales with viewport zoom level.
 */

import { memo } from 'react'
import { MoveRight } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface MovementPathProps {
  nodeId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  nodeDimensions?: { width: number; height: number }
  zoom: number
  nodeTitle?: string
}

function MovementPathComponent({
  nodeId: _nodeId,
  from,
  to,
  nodeDimensions = { width: 280, height: 140 },
  zoom,
  nodeTitle
}: MovementPathProps): JSX.Element {
  const reducedMotion = useReducedMotion()

  // Calculate center points
  const fromCenterX = from.x + nodeDimensions.width / 2
  const fromCenterY = from.y + nodeDimensions.height / 2
  const toCenterX = to.x + nodeDimensions.width / 2
  const toCenterY = to.y + nodeDimensions.height / 2

  // Calculate SVG bounds
  const minX = Math.min(fromCenterX, toCenterX) - 20
  const minY = Math.min(fromCenterY, toCenterY) - 20
  const maxX = Math.max(fromCenterX, toCenterX) + 20
  const maxY = Math.max(fromCenterY, toCenterY) + 20
  const width = maxX - minX
  const height = maxY - minY

  // Relative coordinates for SVG
  const relFromX = fromCenterX - minX
  const relFromY = fromCenterY - minY
  const relToX = toCenterX - minX
  const relToY = toCenterY - minY

  // Calculate midpoint for label
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  // Calculate arrow rotation
  const angle = Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)

  // Scale factors
  const strokeWidth = Math.max(1.5, 2 * zoom)
  const dotRadius = Math.max(4, 6 * zoom)
  const arrowSize = Math.max(6, 10 * zoom)
  const badgeFontSize = Math.max(8, 10 * zoom)
  const badgePadding = Math.max(2, 4 * zoom)
  const badgeIconSize = Math.max(8, 12 * zoom)

  return (
    <div
      className={`movement-path-container ${reducedMotion ? 'reduced-motion' : ''}`}
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 999
      }}
    >
      <svg width={width} height={height} className="movement-path-svg">
        {/* Path from current to target */}
        <path
          d={`M ${relFromX} ${relFromY} L ${relToX} ${relToY}`}
          stroke="#f59e0b"
          strokeWidth={strokeWidth}
          strokeDasharray={`${8 * zoom} ${4 * zoom}`}
          fill="none"
          className="movement-path-line"
        />

        {/* Start dot */}
        <circle
          cx={relFromX}
          cy={relFromY}
          r={dotRadius}
          fill="#f59e0b"
          opacity={0.5}
        />

        {/* End arrow */}
        <polygon
          points={`${relToX},${relToY} ${relToX - arrowSize},${relToY - arrowSize / 2} ${relToX - arrowSize},${relToY + arrowSize / 2}`}
          fill="#f59e0b"
          transform={`rotate(${angle} ${relToX} ${relToY})`}
        />
      </svg>

      {/* Target position ghost outline */}
      <div
        className="movement-target-outline"
        style={{
          position: 'absolute',
          left: to.x - minX,
          top: to.y - minY,
          width: nodeDimensions.width,
          height: nodeDimensions.height,
          borderWidth: Math.max(1, 2 * zoom),
          borderRadius: Math.max(4, 8 * zoom)
        }}
      />

      {/* Movement badge */}
      <div
        className="movement-badge"
        style={{
          position: 'absolute',
          left: midX - minX - (nodeTitle ? 40 : 30) * zoom,
          top: midY - minY - 12 * zoom,
          fontSize: badgeFontSize,
          padding: `${badgePadding}px ${badgePadding * 2}px`,
          borderRadius: Math.max(2, 4 * zoom)
        }}
      >
        <MoveRight style={{ width: badgeIconSize, height: badgeIconSize }} />
        <span>{nodeTitle ? `Move "${nodeTitle}"` : 'MOVE'}</span>
      </div>

      <style>{`
        .movement-path-line {
          animation: movement-dash 1s linear infinite;
        }

        .movement-target-outline {
          border-style: dashed;
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          animation: target-pulse 1.5s ease-in-out infinite;
        }

        .movement-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #f59e0b;
          color: white;
          font-weight: 600;
          white-space: nowrap;
        }

        @keyframes movement-dash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -24;
          }
        }

        @keyframes target-pulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }

        /* Reduced motion - static line, no animation */
        .movement-path-container.reduced-motion .movement-path-line {
          animation: none;
        }

        .movement-path-container.reduced-motion .movement-target-outline {
          animation: none;
          opacity: 0.7;
        }

        @media (prefers-reduced-motion: reduce) {
          .movement-path-line {
            animation: none !important;
          }

          .movement-target-outline {
            animation: none !important;
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}

const MovementPath = memo(MovementPathComponent)
export default MovementPath
