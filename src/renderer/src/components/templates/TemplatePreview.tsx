/**
 * Template Preview Component
 *
 * Mini visualization of a template's structure showing nodes and connections.
 * Used in SaveTemplateModal and TemplateBrowser.
 */

import { memo, useMemo } from 'react'
import { MessageSquare, FolderKanban, FileText, CheckSquare, File } from 'lucide-react'
import type { NodeTemplate, NodeData } from '@shared/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TemplatePreviewProps {
  template: Pick<NodeTemplate, 'nodes' | 'edges' | 'bounds'>
  className?: string
  maxWidth?: number
  maxHeight?: number
}

// -----------------------------------------------------------------------------
// Node Icon Helper
// -----------------------------------------------------------------------------

function getNodeIcon(type: NodeData['type']): JSX.Element {
  const className = 'w-3 h-3'
  switch (type) {
    case 'conversation':
      return <MessageSquare className={className} />
    case 'project':
      return <FolderKanban className={className} />
    case 'note':
      return <FileText className={className} />
    case 'task':
      return <CheckSquare className={className} />
    case 'artifact':
      return <File className={className} />
    default:
      return <File className={className} />
  }
}

function getNodeColor(type: NodeData['type']): string {
  switch (type) {
    case 'conversation':
      return '#3b82f6' // blue
    case 'project':
      return '#a78bfa' // violet
    case 'note':
      return '#f59e0b' // amber
    case 'task':
      return '#10b981' // emerald
    case 'artifact':
      return '#ec4899' // pink
    default:
      return '#6b7280' // gray
  }
}

// -----------------------------------------------------------------------------
// Preview Component
// -----------------------------------------------------------------------------

function TemplatePreviewComponent({
  template,
  className = '',
  maxWidth = 200,
  maxHeight = 150
}: TemplatePreviewProps): JSX.Element {
  // Calculate scaling to fit preview area
  const { scale, offsetX, offsetY, viewportWidth, viewportHeight } = useMemo(() => {
    if (template.nodes.length === 0) {
      return { scale: 1, offsetX: 0, offsetY: 0, viewportWidth: maxWidth, viewportHeight: maxHeight }
    }

    // Find bounds of all nodes
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of template.nodes) {
      minX = Math.min(minX, node.relativePosition.x)
      minY = Math.min(minY, node.relativePosition.y)
      maxX = Math.max(maxX, node.relativePosition.x + node.dimensions.width)
      maxY = Math.max(maxY, node.relativePosition.y + node.dimensions.height)
    }

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Add padding
    const padding = 20
    const availableWidth = maxWidth - padding * 2
    const availableHeight = maxHeight - padding * 2

    // Calculate scale to fit
    const scaleX = availableWidth / contentWidth
    const scaleY = availableHeight / contentHeight
    const finalScale = Math.min(scaleX, scaleY, 1) // Never scale up

    // Calculate centering offset
    const scaledWidth = contentWidth * finalScale
    const scaledHeight = contentHeight * finalScale
    const finalOffsetX = (maxWidth - scaledWidth) / 2 - minX * finalScale
    const finalOffsetY = (maxHeight - scaledHeight) / 2 - minY * finalScale

    return {
      scale: finalScale,
      offsetX: finalOffsetX,
      offsetY: finalOffsetY,
      viewportWidth: maxWidth,
      viewportHeight: maxHeight
    }
  }, [template.nodes, maxWidth, maxHeight])

  // Transform node position to preview coordinates
  const transformPosition = (x: number, y: number): { x: number; y: number } => ({
    x: x * scale + offsetX,
    y: y * scale + offsetY
  })

  // Render edges as SVG paths
  const renderEdges = (): JSX.Element[] => {
    const nodeMap = new Map(template.nodes.map((n) => [n.templateNodeId, n]))

    return template.edges.map((edge, index) => {
      const sourceNode = nodeMap.get(edge.source)
      const targetNode = nodeMap.get(edge.target)

      if (!sourceNode || !targetNode) return null

      // Calculate edge endpoints (center of nodes)
      const sourceCenter = transformPosition(
        sourceNode.relativePosition.x + sourceNode.dimensions.width / 2,
        sourceNode.relativePosition.y + sourceNode.dimensions.height / 2
      )
      const targetCenter = transformPosition(
        targetNode.relativePosition.x + targetNode.dimensions.width / 2,
        targetNode.relativePosition.y + targetNode.dimensions.height / 2
      )

      return (
        <line
          key={`edge-${index}`}
          x1={sourceCenter.x}
          y1={sourceCenter.y}
          x2={targetCenter.x}
          y2={targetCenter.y}
          stroke="#4b5563"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      )
    }).filter(Boolean) as JSX.Element[]
  }

  // Render nodes as small rectangles
  const renderNodes = (): JSX.Element[] => {
    return template.nodes.map((node, index) => {
      const pos = transformPosition(node.relativePosition.x, node.relativePosition.y)
      const width = node.dimensions.width * scale
      const height = node.dimensions.height * scale
      const color = getNodeColor(node.type)

      // Scale dimensions but keep minimum size for visibility
      const minSize = 20
      const displayWidth = Math.max(width, minSize)
      const displayHeight = Math.max(height, minSize)

      return (
        <g key={`node-${index}`}>
          <rect
            x={pos.x}
            y={pos.y}
            width={displayWidth}
            height={displayHeight}
            rx={4}
            fill={color}
            fillOpacity={0.2}
            stroke={color}
            strokeWidth={1.5}
          />
          {/* Node icon in center */}
          <foreignObject
            x={pos.x + displayWidth / 2 - 6}
            y={pos.y + displayHeight / 2 - 6}
            width={12}
            height={12}
          >
            <div
              style={{ color }}
              className="flex items-center justify-center w-full h-full"
            >
              {getNodeIcon(node.type)}
            </div>
          </foreignObject>
        </g>
      )
    })
  }

  if (template.nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface-panel)]/50 rounded border border-[var(--border-subtle)] ${className}`}
        style={{ width: maxWidth, height: maxHeight }}
      >
        <span className="text-xs text-[var(--text-muted)]">No nodes</span>
      </div>
    )
  }

  return (
    <div
      className={`relative bg-[var(--surface-panel)]/50 rounded border border-[var(--border-subtle)] overflow-hidden ${className}`}
      style={{ width: maxWidth, height: maxHeight }}
    >
      <svg width={viewportWidth} height={viewportHeight} className="absolute inset-0">
        {/* Grid pattern */}
        <defs>
          <pattern
            id="preview-grid"
            width={20}
            height={20}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={10} cy={10} r={0.5} fill="#374151" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#preview-grid)" />

        {/* Edges */}
        {renderEdges()}

        {/* Nodes */}
        {renderNodes()}
      </svg>
    </div>
  )
}

export const TemplatePreview = memo(TemplatePreviewComponent)
