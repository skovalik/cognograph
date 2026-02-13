/**
 * AutoFitButton Component
 *
 * A button that appears on selected nodes to allow auto-fitting the node
 * dimensions to its content. Double-click to trigger auto-fit.
 */

import { memo, useCallback } from 'react'
import { Maximize2 } from 'lucide-react'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useNodesStore, useHistoryStore } from '../../stores'
import { calculateAutoFitDimensions, AUTO_FIT_CONSTRAINTS } from '../../utils/nodeUtils'
import { toast } from 'react-hot-toast'

interface AutoFitButtonProps {
  nodeId: string
  title: string
  content?: string
  selected: boolean
  nodeColor?: string
  /** Header height in pixels (default: 40) */
  headerHeight?: number
  /** Footer height in pixels (default: 36) */
  footerHeight?: number
  /** Min width override */
  minWidth?: number
  /** Min height override */
  minHeight?: number
}

function AutoFitButtonComponent({
  nodeId,
  title,
  content,
  selected,
  nodeColor = 'var(--gui-accent-primary)',
  headerHeight = 40,
  footerHeight = 36,
  minWidth = AUTO_FIT_CONSTRAINTS.minWidth,
  minHeight = AUTO_FIT_CONSTRAINTS.minHeight
}: AutoFitButtonProps): JSX.Element | null {
  const updateNodeInternals = useUpdateNodeInternals()
  const updateNodeDimensions = useNodesStore((s) => s.updateNodeDimensions)
  const startNodeResize = useHistoryStore((s) => s.startNodeResize)
  const commitNodeResize = useHistoryStore((s) => s.commitNodeResize)

  const handleAutoFit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      // Calculate ideal dimensions
      const { width, height } = calculateAutoFitDimensions(
        title,
        content,
        headerHeight,
        footerHeight
      )

      // Apply constraints
      const finalWidth = Math.max(minWidth, width)
      const finalHeight = Math.max(minHeight, height)

      // Update node dimensions with history tracking
      startNodeResize(nodeId)
      updateNodeDimensions(nodeId, finalWidth, finalHeight)
      updateNodeInternals(nodeId)
      commitNodeResize(nodeId)

      toast.success('Fitted to content', { duration: 1500, icon: '📐' })
    },
    [
      nodeId,
      title,
      content,
      headerHeight,
      footerHeight,
      minWidth,
      minHeight,
      startNodeResize,
      updateNodeDimensions,
      updateNodeInternals,
      commitNodeResize
    ]
  )

  // Only show when selected
  if (!selected) {
    return null
  }

  return (
    <button
      className="auto-fit-button"
      onClick={handleAutoFit}
      onDoubleClick={handleAutoFit}
      title="Fit to content (click or double-click)"
      style={{
        '--button-color': nodeColor
      } as React.CSSProperties}
    >
      <Maximize2 className="w-3 h-3" />
    </button>
  )
}

export const AutoFitButton = memo(AutoFitButtonComponent)
