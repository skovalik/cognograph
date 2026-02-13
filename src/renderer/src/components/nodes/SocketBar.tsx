/**
 * Socket Bar Component
 *
 * Visual indicator showing edge connections on node borders.
 * Shows round socket icons on sides where connections exist.
 */

import { memo, useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import { useEdgesStore, useSelectionStore } from '../../stores'
import type { EdgeData } from '@shared/types'

interface SocketBarProps {
  nodeId: string
  position: 'top' | 'bottom' | 'left' | 'right'
  nodeColor: string
}

interface ConnectionInfo {
  edgeId: string
  isSource: boolean // true if this node is the source
  isActive: boolean
  isBidirectional: boolean
  color: string
}

function SocketBarComponent({ nodeId, position, nodeColor }: SocketBarProps): JSX.Element | null {
  const edges = useEdgesStore((s) => s.edges)
  const selectedEdgeIds = useSelectionStore((s) => s.selectedEdgeIds)
  const setSelectedEdges = useSelectionStore((s) => s.setSelectedEdges)
  const { zoom } = useViewport()

  // Scale handle size inversely with zoom so they stay clickable when zoomed out
  // At zoom 1.0 → 14px, at zoom 0.5 → 20px, at zoom 2.0 → 11px (clamped)
  const handleSize = Math.round(Math.min(24, Math.max(10, 14 / Math.max(zoom, 0.3))))

  // Find all edges connected to this node at this position
  const connections = useMemo((): ConnectionInfo[] => {
    const result: ConnectionInfo[] = []

    edges.forEach((edge) => {
      const edgeData = edge.data as EdgeData | undefined
      const isSource = edge.source === nodeId
      const isTarget = edge.target === nodeId

      if (!isSource && !isTarget) return

      // Determine which position this edge connects at
      // For simplicity, assume: top/bottom for vertical connections, left/right for horizontal
      // In reality, this depends on node positions, but we'll use a simplified heuristic
      const sourceHandle = edge.sourceHandle
      const targetHandle = edge.targetHandle

      // Check if this edge connects at the specified position
      const positionMatches = isSource
        ? sourceHandle?.includes(position)
        : targetHandle?.includes(position)

      // If no handle specified, show on all sides for now
      const showOnThisSide = positionMatches || (!sourceHandle && !targetHandle)

      if (showOnThisSide) {
        result.push({
          edgeId: edge.id,
          isSource,
          isActive: edgeData?.active !== false,
          isBidirectional: edgeData?.direction === 'bidirectional',
          color: edgeData?.color || nodeColor
        })
      }
    })

    return result
  }, [edges, nodeId, position, nodeColor])

  // Don't render if no connections
  if (connections.length === 0) return null

  // Scale offset so handles don't float away from node at low zoom
  const handleOffset = Math.round(handleSize * 0.57)
  const arrowFontSize = Math.max(7, Math.round(handleSize * 0.57))

  // Positioning styles based on position
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    gap: '2px',
    pointerEvents: 'all',
    zIndex: 10
  }

  switch (position) {
    case 'top':
      positionStyles.top = -handleOffset
      positionStyles.left = '50%'
      positionStyles.transform = 'translateX(-50%)'
      positionStyles.flexDirection = 'row'
      break
    case 'bottom':
      positionStyles.bottom = -handleOffset
      positionStyles.left = '50%'
      positionStyles.transform = 'translateX(-50%)'
      positionStyles.flexDirection = 'row'
      break
    case 'left':
      positionStyles.left = -handleOffset
      positionStyles.top = '50%'
      positionStyles.transform = 'translateY(-50%)'
      positionStyles.flexDirection = 'column'
      break
    case 'right':
      positionStyles.right = -handleOffset
      positionStyles.top = '50%'
      positionStyles.transform = 'translateY(-50%)'
      positionStyles.flexDirection = 'column'
      break
  }

  // If too many connections, show collapsed view
  const maxVisible = 4
  const visibleConnections = connections.slice(0, maxVisible)
  const hiddenCount = connections.length - maxVisible

  const handleSocketClick = (edgeId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setSelectedEdges([edgeId])
  }

  return (
    <div style={positionStyles}>
      {visibleConnections.map((conn) => {
        const isSelected = selectedEdgeIds.includes(conn.edgeId)
        return (
          <button
            key={conn.edgeId}
            onClick={(e) => handleSocketClick(conn.edgeId, e)}
            className={`rounded-full border-2 transition-all duration-150 ${
              isSelected
                ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900 scale-110'
                : 'hover:scale-110'
            }`}
            style={{
              width: handleSize,
              height: handleSize,
              backgroundColor: conn.isActive ? conn.color : 'transparent',
              borderColor: conn.color,
              opacity: conn.isActive ? 1 : 0.4,
              boxShadow: isSelected
                ? `0 0 6px ${conn.color}`
                : undefined
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${conn.color}80`
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }
            }}
            title={`${conn.isSource ? 'Outgoing' : 'Incoming'} connection${conn.isBidirectional ? ' (bidirectional)' : ''}`}
          >
            {/* Direction indicator - small arrow */}
            <span
              className="block w-full h-full flex items-center justify-center text-white"
              style={{
                fontSize: `${arrowFontSize}px`,
                lineHeight: 1
              }}
            >
              {conn.isBidirectional ? '↔' : (conn.isSource ? '→' : '←')}
            </span>
          </button>
        )
      })}
      {hiddenCount > 0 && (
        <div
          className="rounded-full bg-[var(--surface-panel)] border border-[var(--border-subtle)] flex items-center justify-center text-white"
          style={{
            width: handleSize,
            height: handleSize,
            fontSize: `${arrowFontSize}px`
          }}
          title={`${hiddenCount} more connection${hiddenCount > 1 ? 's' : ''}`}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  )
}

// IMPORTANT: Export SocketBar BEFORE NodeSocketBarsComponent uses it
// (const declarations are NOT hoisted like function declarations)
export const SocketBar = memo(SocketBarComponent)

// Wrapper component that renders all four socket bars
interface NodeSocketBarsProps {
  nodeId: string
  nodeColor: string
  enabled?: boolean
}

function NodeSocketBarsComponent({ nodeId, nodeColor, enabled = true }: NodeSocketBarsProps): JSX.Element | null {
  if (!enabled) return null

  return (
    <>
      <SocketBar nodeId={nodeId} position="top" nodeColor={nodeColor} />
      <SocketBar nodeId={nodeId} position="bottom" nodeColor={nodeColor} />
      <SocketBar nodeId={nodeId} position="left" nodeColor={nodeColor} />
      <SocketBar nodeId={nodeId} position="right" nodeColor={nodeColor} />
    </>
  )
}

export const NodeSocketBars = memo(NodeSocketBarsComponent)
