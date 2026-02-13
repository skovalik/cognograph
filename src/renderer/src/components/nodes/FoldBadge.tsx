/**
 * FoldBadge Component
 *
 * Displays a badge on nodes that have children (via childNodeIds or outgoing edges).
 * Shows the count of hidden children when collapsed.
 * Click to toggle collapsed state.
 */

import { memo, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useNodesStore } from '../../stores'

interface FoldBadgeProps {
  nodeId: string
  nodeColor?: string
}

function FoldBadgeComponent({ nodeId, nodeColor = 'var(--gui-accent-primary)' }: FoldBadgeProps): JSX.Element | null {
  const getChildNodeIds = useNodesStore((s) => s.getChildNodeIds)
  const toggleNodeCollapsed = useNodesStore((s) => s.toggleNodeCollapsed)
  const nodes = useNodesStore((s) => s.nodes)

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId])
  const childIds = useMemo(() => getChildNodeIds(nodeId), [getChildNodeIds, nodeId])
  const isCollapsed = node?.data?.collapsed ?? false
  const childCount = childIds.length

  // Don't show if no children
  if (childCount === 0) {
    return null
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    e.preventDefault()
    toggleNodeCollapsed(nodeId)
  }

  return (
    <button
      className="fold-badge"
      onClick={handleClick}
      title={isCollapsed ? `Expand ${childCount} children (Alt+.)` : `Collapse ${childCount} children (Alt+.)`}
      style={{
        '--badge-color': nodeColor
      } as React.CSSProperties}
    >
      {isCollapsed ? (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="fold-badge__count">+{childCount}</span>
        </>
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
    </button>
  )
}

export const FoldBadge = memo(FoldBadgeComponent)
