/**
 * AI Editor Preview
 *
 * Renders preview overlays on the canvas showing proposed changes.
 * Includes ghost nodes, deletion overlays, and movement paths.
 * All elements scale with viewport zoom level.
 */

import { memo, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useAIEditorStore } from '../../stores/aiEditorStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import DeletionOverlay from './DeletionOverlay'
import MovementPath from './MovementPath'
import LiveRegion from '../a11y/LiveRegion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { calculateOptimalHandles, getHandlePosition } from '../../utils/positionResolver'
import type { NodeData } from '@shared/types'

function AIEditorPreviewComponent(): JSX.Element | null {
  const previewState = useAIEditorStore((state) => state.previewState)
  const isPreviewVisible = useAIEditorStore((state) => state.isPreviewVisible)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const reducedMotion = useReducedMotion()

  const { getViewport } = useReactFlow()

  // Get node dimensions lookup
  const nodeDimensionsMap = useMemo(() => {
    const map = new Map<string, { width: number; height: number }>()
    for (const node of nodes) {
      map.set(node.id, {
        width: node.measured?.width ?? node.width ?? 280,
        height: node.measured?.height ?? node.height ?? 140
      })
    }
    return map
  }, [nodes])

  // Get node positions lookup
  const nodePositionsMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    for (const node of nodes) {
      map.set(node.id, node.position)
    }
    return map
  }, [nodes])

  // Get node titles lookup
  const nodeTitlesMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) {
      const data = node.data as NodeData
      let title = 'Untitled'
      if ('title' in data && data.title) {
        title = data.title as string
      }
      map.set(node.id, title)
    }
    return map
  }, [nodes])

  if (!previewState || !isPreviewVisible) {
    return null
  }

  const viewport = getViewport()

  // Build summary for screen readers
  const changeCount =
    previewState.ghostNodes.length +
    previewState.deletionOverlays.length +
    previewState.movementPaths.length +
    previewState.nodeUpdates.length
  const screenReaderSummary = changeCount > 0
    ? `Preview showing ${changeCount} proposed changes: ${previewState.ghostNodes.length} new nodes, ${previewState.deletionOverlays.length} deletions, ${previewState.movementPaths.length} moves, ${previewState.nodeUpdates.length} edits`
    : 'No changes to preview'

  return (
    <div
      className={`ai-editor-preview-container ${reducedMotion ? 'reduced-motion' : ''}`}
      role="region"
      aria-label="AI Editor preview overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Screen reader announcement */}
      <LiveRegion message={screenReaderSummary} priority="polite" />
      {/* Deletion Overlays */}
      {previewState.deletionOverlays.map((overlay) => {
        const position = nodePositionsMap.get(overlay.nodeId)
        const dimensions = nodeDimensionsMap.get(overlay.nodeId)
        const nodeTitle = overlay.nodeTitle || nodeTitlesMap.get(overlay.nodeId)

        if (!position || !dimensions) return null

        // Transform canvas position to screen position
        const screenX = position.x * viewport.zoom + viewport.x
        const screenY = position.y * viewport.zoom + viewport.y
        const screenWidth = dimensions.width * viewport.zoom
        const screenHeight = dimensions.height * viewport.zoom

        return (
          <DeletionOverlay
            key={`delete-${overlay.nodeId}`}
            nodeId={overlay.nodeId}
            reason={overlay.reason}
            position={{ x: screenX, y: screenY }}
            dimensions={{ width: screenWidth, height: screenHeight }}
            zoom={viewport.zoom}
            nodeTitle={nodeTitle}
            preservedIn={overlay.preservedIn}
          />
        )
      })}

      {/* Movement Paths */}
      {previewState.movementPaths.map((path) => {
        const dimensions = nodeDimensionsMap.get(path.nodeId) || { width: 280, height: 140 }
        const nodeTitle = path.nodeTitle || nodeTitlesMap.get(path.nodeId)

        // Transform canvas positions to screen positions
        const fromScreenX = path.from.x * viewport.zoom + viewport.x
        const fromScreenY = path.from.y * viewport.zoom + viewport.y
        const toScreenX = path.to.x * viewport.zoom + viewport.x
        const toScreenY = path.to.y * viewport.zoom + viewport.y

        return (
          <MovementPath
            key={`move-${path.nodeId}`}
            nodeId={path.nodeId}
            from={{ x: fromScreenX, y: fromScreenY }}
            to={{ x: toScreenX, y: toScreenY }}
            nodeDimensions={{
              width: dimensions.width * viewport.zoom,
              height: dimensions.height * viewport.zoom
            }}
            zoom={viewport.zoom}
            nodeTitle={nodeTitle}
          />
        )
      })}

      {/* Node Updates Preview - show what will change */}
      {previewState.nodeUpdates.map((update) => {
        const position = nodePositionsMap.get(update.nodeId)
        const dimensions = nodeDimensionsMap.get(update.nodeId)
        const nodeTitle = nodeTitlesMap.get(update.nodeId)

        if (!position || !dimensions) return null

        const screenX = position.x * viewport.zoom + viewport.x
        const screenY = position.y * viewport.zoom + viewport.y
        const screenWidth = dimensions.width * viewport.zoom
        const screenHeight = dimensions.height * viewport.zoom

        const scaledFontSize = Math.max(9, 11 * viewport.zoom)
        const scaledPadding = Math.max(4, 8 * viewport.zoom)

        return (
          <div
            key={`update-${update.nodeId}`}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenWidth,
              height: screenHeight,
              border: '2px dashed #3b82f6',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'update-pulse 1.5s ease-in-out infinite'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -10 * viewport.zoom,
                right: -10 * viewport.zoom,
                background: '#3b82f6',
                color: 'white',
                fontSize: scaledFontSize,
                fontWeight: 600,
                padding: `${scaledPadding / 2}px ${scaledPadding}px`,
                borderRadius: 4
              }}
            >
              EDIT
            </div>
            <span
              style={{
                color: '#3b82f6',
                fontSize: scaledFontSize,
                fontWeight: 500,
                textAlign: 'center',
                padding: scaledPadding
              }}
            >
              {nodeTitle && `"${nodeTitle}"`}
            </span>
          </div>
        )
      })}

      {/* Edge previews - simple dashed lines */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        <defs>
          <marker
            id="ai-preview-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
          </marker>
          <marker
            id="ai-preview-arrow-delete"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
          </marker>
        </defs>

        {previewState.edgePreviews.map((edge, index) => {
          // Get source and target positions
          let sourcePos = nodePositionsMap.get(edge.source)
          let targetPos = nodePositionsMap.get(edge.target)

          // Check if source or target is a ghost node (tempId)
          const ghostSource = previewState.ghostNodes.find((g) => g.tempId === edge.source)
          const ghostTarget = previewState.ghostNodes.find((g) => g.tempId === edge.target)

          if (ghostSource) {
            sourcePos = ghostSource.position
          }
          if (ghostTarget) {
            targetPos = ghostTarget.position
          }

          if (!sourcePos || !targetPos) return null

          const sourceDim = ghostSource?.dimensions ||
            nodeDimensionsMap.get(edge.source) || { width: 280, height: 140 }
          const targetDim = ghostTarget?.dimensions ||
            nodeDimensionsMap.get(edge.target) || { width: 280, height: 140 }

          // Calculate optimal handles based on relative positions
          const { sourceHandle, targetHandle } = calculateOptimalHandles(
            sourcePos,
            sourceDim,
            targetPos,
            targetDim
          )

          // Get handle positions instead of center points for accurate preview
          const sourceHandlePos = getHandlePosition(sourcePos, sourceDim, sourceHandle)
          const targetHandlePos = getHandlePosition(targetPos, targetDim, targetHandle)

          const sourceX = sourceHandlePos.x * viewport.zoom + viewport.x
          const sourceY = sourceHandlePos.y * viewport.zoom + viewport.y
          const targetX = targetHandlePos.x * viewport.zoom + viewport.x
          const targetY = targetHandlePos.y * viewport.zoom + viewport.y

          const isDeleted = edge.isDeleted
          const stroke = isDeleted ? '#ef4444' : '#22c55e'
          const marker = isDeleted ? 'url(#ai-preview-arrow-delete)' : 'url(#ai-preview-arrow)'
          const strokeWidth = Math.max(1.5, 2 * viewport.zoom)
          const dashArray = isDeleted
            ? `${8 * viewport.zoom} ${4 * viewport.zoom}`
            : `${4 * viewport.zoom} ${4 * viewport.zoom}`

          return (
            <g key={`edge-preview-${index}`}>
              <line
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                markerEnd={marker}
                opacity={0.7}
              />
              {edge.isNew && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 - 8 * viewport.zoom}
                  fill="#22c55e"
                  fontSize={Math.max(8, 10 * viewport.zoom)}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  NEW
                </text>
              )}
              {edge.isDeleted && (
                <text
                  x={(sourceX + targetX) / 2}
                  y={(sourceY + targetY) / 2 - 8 * viewport.zoom}
                  fill="#ef4444"
                  fontSize={Math.max(8, 10 * viewport.zoom)}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  DELETE
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Ghost nodes overlay - positioned absolutely */}
      {previewState.ghostNodes.map((ghost) => {
        const screenX = ghost.position.x * viewport.zoom + viewport.x
        const screenY = ghost.position.y * viewport.zoom + viewport.y
        const screenWidth = ghost.dimensions.width * viewport.zoom
        const screenHeight = ghost.dimensions.height * viewport.zoom

        const scaledTypeFontSize = Math.max(10, 12 * viewport.zoom)
        const scaledTitleFontSize = Math.max(9, 10 * viewport.zoom)
        const scaledBadgeFontSize = Math.max(7, 9 * viewport.zoom)
        const scaledBadgePadding = Math.max(2, 4 * viewport.zoom)

        return (
          <div
            key={`ghost-${ghost.tempId}`}
            className="ghost-preview-node"
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenWidth,
              height: screenHeight,
              border: `${Math.max(1, 2 * viewport.zoom)}px dashed #22c55e`,
              borderRadius: Math.max(4, 8 * viewport.zoom),
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Math.max(2, 4 * viewport.zoom)
            }}
          >
            <span
              style={{
                color: '#22c55e',
                fontSize: scaledTypeFontSize,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}
            >
              {ghost.type}
            </span>
            <span
              style={{
                color: '#4ade80',
                fontSize: scaledTitleFontSize,
                maxWidth: '80%',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {(ghost.data as any)?.title || 'New Node'}
            </span>
            <div
              style={{
                position: 'absolute',
                top: -8 * viewport.zoom,
                right: -8 * viewport.zoom,
                background: '#22c55e',
                color: 'white',
                fontSize: scaledBadgeFontSize,
                fontWeight: 600,
                padding: `${scaledBadgePadding}px ${scaledBadgePadding * 1.5}px`,
                borderRadius: Math.max(2, 4 * viewport.zoom)
              }}
            >
              NEW
            </div>
          </div>
        )
      })}

      {/* Animation keyframes */}
      <style>{`
        @keyframes update-pulse {
          0%, 100% {
            background: rgba(59, 130, 246, 0.05);
            border-color: rgba(59, 130, 246, 0.5);
          }
          50% {
            background: rgba(59, 130, 246, 0.15);
            border-color: rgba(59, 130, 246, 0.8);
          }
        }

        /* Reduced motion - disable all preview animations */
        .ai-editor-preview-container.reduced-motion [style*="animation"] {
          animation: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          [style*="animation: update-pulse"] {
            animation: none !important;
            background: rgba(59, 130, 246, 0.1) !important;
            border-color: rgba(59, 130, 246, 0.7) !important;
          }
        }
      `}</style>
    </div>
  )
}

const AIEditorPreview = memo(AIEditorPreviewComponent)
export default AIEditorPreview
