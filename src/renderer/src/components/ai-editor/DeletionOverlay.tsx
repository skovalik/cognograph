/**
 * DeletionOverlay Component
 *
 * A red overlay shown on nodes that will be deleted.
 * Rendered as an overlay on top of existing nodes.
 * Scales with viewport zoom level.
 */

import { memo } from 'react'
import { Trash2, ArrowRight } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface DeletionOverlayProps {
  nodeId: string
  reason?: string
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  zoom: number
  preservedIn?: string // Title of node that preserves this content
  nodeTitle?: string // Original node title
}

function DeletionOverlayComponent({
  nodeId: _nodeId,
  reason,
  position,
  dimensions,
  zoom,
  preservedIn,
  nodeTitle
}: DeletionOverlayProps): JSX.Element {
  const reducedMotion = useReducedMotion()

  // Scale factors for text and icons
  const scaledIconSize = Math.max(16, 24 * zoom)
  const scaledLabelSize = Math.max(10, 12 * zoom)
  const scaledReasonSize = Math.max(9, 11 * zoom)
  const scaledGap = Math.max(4, 8 * zoom)
  const scaledPadding = Math.max(4, 8 * zoom)

  return (
    <div
      className={`deletion-overlay ${reducedMotion ? 'reduced-motion' : ''}`}
      role="status"
      aria-label={`Node "${nodeTitle || 'Untitled'}" will be deleted${reason ? `: ${reason}` : ''}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: dimensions.width,
        height: dimensions.height
      }}
    >
      <div
        className="deletion-overlay-content"
        style={{ gap: scaledGap, padding: scaledPadding }}
      >
        <Trash2
          className="deletion-icon"
          style={{ width: scaledIconSize, height: scaledIconSize }}
        />
        <span
          className="deletion-label"
          style={{ fontSize: scaledLabelSize }}
        >
          {nodeTitle ? `"${nodeTitle}"` : 'Will be deleted'}
        </span>
        {reason && (
          <span
            className="deletion-reason"
            style={{ fontSize: scaledReasonSize }}
          >
            {reason}
          </span>
        )}
        {preservedIn && (
          <div
            className="deletion-preserved"
            style={{
              fontSize: scaledReasonSize,
              gap: Math.max(2, 4 * zoom),
              marginTop: Math.max(2, 4 * zoom)
            }}
          >
            <ArrowRight style={{ width: scaledReasonSize, height: scaledReasonSize }} />
            <span>Content merged into "{preservedIn}"</span>
          </div>
        )}
      </div>

      <style>{`
        .deletion-overlay {
          background: rgba(239, 68, 68, 0.15);
          border: 2px dashed #ef4444;
          border-radius: 8px;
          pointer-events: none;
          z-index: 1000;
          animation: deletion-pulse 1.5s ease-in-out infinite;
        }

        .deletion-overlay-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .deletion-icon {
          color: #ef4444;
        }

        .deletion-label {
          color: #ef4444;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-align: center;
          max-width: 90%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .deletion-reason {
          color: #f87171;
          text-align: center;
          max-width: 80%;
        }

        .deletion-preserved {
          display: flex;
          align-items: center;
          color: #4ade80;
          background: rgba(34, 197, 94, 0.15);
          padding: 4px 8px;
          border-radius: 4px;
        }

        @keyframes deletion-pulse {
          0%, 100% {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.5);
          }
          50% {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.8);
          }
        }

        /* Light mode support */
        [data-theme="light"] .deletion-overlay {
          background: rgba(239, 68, 68, 0.1);
        }

        [data-theme="light"] .deletion-label {
          color: #dc2626;
        }

        [data-theme="light"] .deletion-reason {
          color: #ef4444;
        }

        /* Reduced motion - no animation */
        .deletion-overlay.reduced-motion {
          animation: none;
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.7);
        }

        @media (prefers-reduced-motion: reduce) {
          .deletion-overlay {
            animation: none !important;
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.7);
          }
        }
      `}</style>
    </div>
  )
}

const DeletionOverlay = memo(DeletionOverlayComponent)
export default DeletionOverlay
