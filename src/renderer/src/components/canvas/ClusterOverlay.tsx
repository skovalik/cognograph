/**
 * ClusterOverlay — L0 (ultra-far) zoom cluster summary bubbles
 *
 * PFD Phase 6B: At ultra-far zoom, individual nodes are too small to read.
 * Instead, we compute spatial clusters and render summary "bubbles" showing:
 *   - Dominant type icon
 *   - Node count
 *   - Optional status summary (e.g. "3/5 done" for task clusters)
 *
 * Bubbles are clickable: clicking one calls fitView() to zoom into that cluster.
 *
 * Cluster computation is debounced by 300ms to avoid expensive recalculations
 * during rapid panning.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodes, useEdges, useReactFlow, useViewport } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import {
  MessageSquare,
  CheckSquare,
  StickyNote,
  FolderKanban,
  FileText,
  Globe,
  Cpu,
  Zap,
  LayoutGrid
} from 'lucide-react'
import { computeClusters } from '../../utils/clusterEngine'
import type { Cluster, NodePosition, EdgeInfo } from '../../utils/clusterEngine'
import { useNodeContentVisibility } from '../../hooks/useSemanticZoom'

// ---- Exported constants (testable) ----------------------------------------

/** Lucide icon component for each node type */
export const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  conversation: MessageSquare,
  task: CheckSquare,
  note: StickyNote,
  project: FolderKanban,
  artifact: FileText,
  workspace: Globe,
  orchestrator: Cpu,
  action: Zap,
  text: LayoutGrid
}

/** Background color (30% opacity) per node type */
export const TYPE_COLORS: Record<string, string> = {
  conversation: 'rgba(59, 130, 246, 0.3)',
  task: 'rgba(245, 158, 11, 0.3)',
  note: 'rgba(34, 197, 94, 0.3)',
  project: 'rgba(139, 92, 207, 0.3)',
  artifact: 'rgba(239, 68, 68, 0.3)',
  workspace: 'rgba(6, 182, 212, 0.3)',
  orchestrator: 'rgba(249, 115, 22, 0.3)',
  action: 'rgba(236, 72, 153, 0.3)',
  text: 'rgba(107, 114, 128, 0.3)'
}

/** Border color (50% opacity) per node type */
export const TYPE_BORDER_COLORS: Record<string, string> = {
  conversation: 'rgba(59, 130, 246, 0.5)',
  task: 'rgba(245, 158, 11, 0.5)',
  note: 'rgba(34, 197, 94, 0.5)',
  project: 'rgba(139, 92, 207, 0.5)',
  artifact: 'rgba(239, 68, 68, 0.5)',
  workspace: 'rgba(6, 182, 212, 0.5)',
  orchestrator: 'rgba(249, 115, 22, 0.5)',
  action: 'rgba(236, 72, 153, 0.5)',
  text: 'rgba(107, 114, 128, 0.5)'
}

// ---- Pure helpers (exported for testing) ----------------------------------

/**
 * Build human-readable status text for a cluster bubble.
 *
 * - If cluster contains task nodes: "X/Y done" where X = done count, Y = task count
 * - Else if any statuses present: "N status" where status = most common status
 * - Else: null (no status text)
 */
export function buildStatusText(cluster: Cluster): string | null {
  const { typeCounts, statusCounts } = cluster.summary

  // Task cluster: show done progress
  const taskCount = typeCounts['task'] || 0
  if (taskCount > 0) {
    const doneCount = statusCounts['done'] || 0
    return `${doneCount}/${taskCount} done`
  }

  // Non-task cluster: show top status
  const statusEntries = Object.entries(statusCounts)
  if (statusEntries.length === 0) return null

  // Find most common status
  let topStatus = ''
  let topCount = 0
  for (const [status, count] of statusEntries) {
    if (count > topCount) {
      topCount = count
      topStatus = status
    }
  }
  return `${topCount} ${topStatus}`
}

/**
 * Compute bubble diameter from node count.
 * Base 56px + min(nodeCount * 2, 24) bonus.
 */
export function computeBubbleSize(nodeCount: number): number {
  return 56 + Math.min(nodeCount * 2, 24)
}

// ---- Component ------------------------------------------------------------

export const ClusterOverlay = memo(function ClusterOverlay(): JSX.Element | null {
  const { zoomLevel } = useNodeContentVisibility()
  const rfNodes = useNodes()
  const rfEdges = useEdges()
  const viewport = useViewport()
  const { fitView } = useReactFlow()

  const [clusters, setClusters] = useState<Cluster[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Only compute clusters when at ultra-far zoom
  const isUltraFar = zoomLevel === 'ultra-far'

  // Convert React Flow nodes/edges to clusterEngine format
  const nodePositions: NodePosition[] = useMemo(() => {
    if (!isUltraFar) return []
    return rfNodes.map((node: Node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      type: (node.data as { type?: string })?.type || node.type || 'text',
      status: (node.data as { status?: string })?.status
    }))
  }, [rfNodes, isUltraFar])

  const edgeInfos: EdgeInfo[] = useMemo(() => {
    if (!isUltraFar) return []
    return rfEdges.map((edge: Edge) => ({
      source: edge.source,
      target: edge.target
    }))
  }, [rfEdges, isUltraFar])

  // Debounced cluster computation
  useEffect(() => {
    if (!isUltraFar) {
      setClusters([])
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const result = computeClusters(nodePositions, edgeInfos)
      setClusters(result)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [nodePositions, edgeInfos, isUltraFar])

  // Click handler: zoom into cluster
  const handleBubbleClick = useCallback(
    (cluster: Cluster) => {
      fitView({
        nodes: cluster.nodeIds.map((id) => ({ id })),
        duration: 400,
        padding: 0.2
      })
    },
    [fitView]
  )

  if (!isUltraFar || clusters.length === 0) return null

  return (
    <div
      className="cluster-overlay"
      role="group"
      aria-label={`${clusters.length} node clusters at ultra-far zoom`}
    >
      {clusters.map((cluster) => {
        // Convert canvas coords to screen coords
        const screenX = cluster.centroid.x * viewport.zoom + viewport.x
        const screenY = cluster.centroid.y * viewport.zoom + viewport.y
        const size = computeBubbleSize(cluster.summary.nodeCount)
        const halfSize = size / 2

        const IconComponent = TYPE_ICONS[cluster.dominantType] || LayoutGrid
        const bgColor = TYPE_COLORS[cluster.dominantType] || TYPE_COLORS.text
        const borderColor = TYPE_BORDER_COLORS[cluster.dominantType] || TYPE_BORDER_COLORS.text
        const statusText = buildStatusText(cluster)

        return (
          <div
            key={cluster.id}
            className="cluster-bubble"
            style={{
              position: 'absolute',
              left: screenX - halfSize,
              top: screenY - halfSize,
              width: size,
              height: size,
              background: bgColor,
              border: `2px solid ${borderColor}`
            }}
            onClick={() => handleBubbleClick(cluster)}
            role="button"
            aria-label={`Cluster: ${cluster.summary.nodeCount} ${cluster.dominantType} nodes`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleBubbleClick(cluster)
              }
            }}
          >
            <IconComponent size={16} className="cluster-bubble-icon" />
            <span className="cluster-bubble-count">{cluster.summary.nodeCount}</span>
            {statusText && (
              <span className="cluster-bubble-status">{statusText}</span>
            )}
          </div>
        )
      })}
    </div>
  )
})
