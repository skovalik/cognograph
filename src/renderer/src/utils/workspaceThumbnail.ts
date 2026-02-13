/**
 * Workspace Thumbnail Generator
 *
 * Creates SVG-based thumbnails of workspace layouts.
 * Shows node positions and types as colored rectangles.
 *
 * ND-friendly: "That's the workspace with the cluster in the top-right"
 * Visual recognition without reading file names.
 */

import type { Node } from '@xyflow/react'
import type { NodeData } from '@shared/types'

// Default node colors (fallback if theme not available)
const DEFAULT_NODE_COLORS: Record<string, string> = {
  conversation: '#4A9EFF',
  note: '#FFB84A',
  task: '#4AFF7F',
  project: '#FF4A7F',
  artifact: '#9B4AFF',
  workspace: '#4AFFFF',
  text: '#AAAAAA',
  action: '#FF9B4A'
}

interface ThumbnailOptions {
  width?: number
  height?: number
  padding?: number
  backgroundColor?: string
  nodeColors?: Record<string, string>
}

/**
 * Generate an SVG thumbnail from workspace nodes
 */
export function generateWorkspaceThumbnail(
  nodes: Node<NodeData>[],
  options: ThumbnailOptions = {}
): string {
  const {
    width = 200,
    height = 150,
    padding = 10,
    backgroundColor = '#0d0d14',
    nodeColors = DEFAULT_NODE_COLORS
  } = options

  if (nodes.length === 0) {
    // Return empty state thumbnail
    return generateEmptyThumbnail(width, height, backgroundColor)
  }

  // Calculate bounds of all nodes
  const bounds = calculateBounds(nodes)

  // Calculate scale to fit all nodes in thumbnail
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  const scaleX = availableWidth / bounds.width
  const scaleY = availableHeight / bounds.height
  const scale = Math.min(scaleX, scaleY, 1) // Don't scale up

  // Generate SVG elements for each node
  const nodeElements = nodes.map(node => {
    const x = padding + (node.position.x - bounds.minX) * scale
    const y = padding + (node.position.y - bounds.minY) * scale
    const nodeWidth = Math.max(4, (node.width || 280) * scale)
    const nodeHeight = Math.max(3, (node.height || 120) * scale)
    const color = nodeColors[node.data.type] || '#666666'

    return `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${color}" rx="2" opacity="0.8"/>`
  }).join('\n    ')

  // Generate SVG
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
  <g>
    ${nodeElements}
  </g>
</svg>`
}

/**
 * Generate a data URL from SVG string
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Generate thumbnail as data URL
 */
export function generateThumbnailDataUrl(
  nodes: Node<NodeData>[],
  options?: ThumbnailOptions
): string {
  const svg = generateWorkspaceThumbnail(nodes, options)
  return svgToDataUrl(svg)
}

/**
 * Calculate bounding box of all nodes
 */
function calculateBounds(nodes: Node<NodeData>[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach(node => {
    const nodeWidth = node.width || 280
    const nodeHeight = node.height || 120

    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + nodeWidth)
    maxY = Math.max(maxY, node.position.y + nodeHeight)
  })

  // Add some padding to bounds
  const boundsPadding = 20
  minX -= boundsPadding
  minY -= boundsPadding
  maxX += boundsPadding
  maxY += boundsPadding

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Generate empty state thumbnail
 */
function generateEmptyThumbnail(
  width: number,
  height: number,
  backgroundColor: string
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#666666" font-size="12" font-family="system-ui">Empty</text>
</svg>`
}
