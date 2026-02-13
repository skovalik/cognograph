/**
 * Enhanced Context Builder
 *
 * Extends the base context builder with:
 * - Graph analysis (clusters, central nodes, context chains)
 * - Spatial analysis (regions, density)
 * - Workspace-level analysis
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  NodeData,
  EdgeData,
  EnhancedContextAnalysis,
  GraphAnalysis,
  SpatialAnalysis,
  WorkspaceAnalysis,
  NodeCluster,
  ContextChain,
  SpatialRegion
} from '@shared/types'

// Re-export types for convenience
export type {
  EnhancedContextAnalysis,
  GraphAnalysis,
  SpatialAnalysis,
  WorkspaceAnalysis,
  NodeCluster,
  ContextChain,
  SpatialRegion
}

// -----------------------------------------------------------------------------
// Graph Analysis
// -----------------------------------------------------------------------------

export function analyzeGraph(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): GraphAnalysis {
  // Build adjacency list
  const adjacency = new Map<string, Set<string>>()
  for (const node of nodes) {
    adjacency.set(node.id, new Set())
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  // Find clusters using simple connected components
  const clusters = findClusters(nodes, adjacency)

  // Find central nodes (highest degree)
  const centralNodes = findCentralNodes(nodes, adjacency, 5)

  // Find context chains (conversation → note/artifact paths)
  const contextChains = findContextChains(nodes, edges)

  // Find isolated nodes (no connections)
  const isolatedNodes = nodes
    .filter((n) => (adjacency.get(n.id)?.size ?? 0) === 0)
    .map((n) => n.id)

  return {
    clusters,
    centralNodes,
    contextChains,
    isolatedNodes
  }
}

function findClusters(
  nodes: Node<NodeData>[],
  adjacency: Map<string, Set<string>>
): NodeCluster[] {
  const visited = new Set<string>()
  const clusters: NodeCluster[] = []
  let clusterId = 0

  for (const node of nodes) {
    if (visited.has(node.id)) continue

    // BFS to find all nodes in this cluster
    const clusterNodes: string[] = []
    const queue = [node.id]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      clusterNodes.push(current)

      const neighbors = adjacency.get(current)
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor)
          }
        }
      }
    }

    if (clusterNodes.length > 0) {
      // Calculate centroid
      const clusterNodeObjects = nodes.filter((n) => clusterNodes.includes(n.id))
      const centroid = calculateCentroid(clusterNodeObjects)

      // Find dominant type
      const typeCounts: Record<string, number> = {}
      for (const nodeObj of clusterNodeObjects) {
        const type = nodeObj.data.type
        typeCounts[type] = (typeCounts[type] || 0) + 1
      }
      const dominantType = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'

      clusters.push({
        id: `cluster-${clusterId++}`,
        nodes: clusterNodes,
        dominantType,
        centroid
      })
    }
  }

  return clusters
}

function findCentralNodes(
  nodes: Node<NodeData>[],
  adjacency: Map<string, Set<string>>,
  limit: number
): string[] {
  return nodes
    .map((n) => ({ id: n.id, degree: adjacency.get(n.id)?.size ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit)
    .filter((n) => n.degree > 0)
    .map((n) => n.id)
}

function findContextChains(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): ContextChain[] {
  const chains: ContextChain[] = []

  // Find all conversation nodes
  const conversations = nodes.filter((n) => n.data.type === 'conversation')

  for (const conv of conversations) {
    // BFS to find all reachable context sources (notes, artifacts, tasks)
    const visited = new Set<string>()
    const queue: Array<{ id: string; depth: number }> = [{ id: conv.id, depth: 0 }]
    const contextSources: string[] = []
    let maxDepth = 0

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const node = nodes.find((n) => n.id === current)
      if (node && node.id !== conv.id) {
        // Check if it's a context source type
        if (['note', 'artifact', 'task', 'text'].includes(node.data.type)) {
          contextSources.push(node.id)
          maxDepth = Math.max(maxDepth, depth)
        }
      }

      // Follow incoming edges (context flows TO conversation)
      const incoming = edges.filter((e) => e.target === current)
      for (const edge of incoming) {
        if (!visited.has(edge.source)) {
          queue.push({ id: edge.source, depth: depth + 1 })
        }
      }
    }

    if (contextSources.length > 0) {
      chains.push({
        conversationId: conv.id,
        contextSources,
        depth: maxDepth
      })
    }
  }

  return chains
}

// -----------------------------------------------------------------------------
// Spatial Analysis
// -----------------------------------------------------------------------------

export function analyzeSpatial(nodes: Node<NodeData>[]): SpatialAnalysis {
  if (nodes.length === 0) {
    return {
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      density: 0,
      regions: [],
      overlappingNodes: []
    }
  }

  // Calculate bounds
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const width = node.measured?.width ?? 300
    const height = node.measured?.height ?? 150

    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }

  const bounds = { minX, minY, maxX, maxY }

  // Calculate density (nodes per 1000px²)
  const area = (maxX - minX) * (maxY - minY)
  const density = area > 0 ? (nodes.length / area) * 1000000 : 0

  // Find spatial regions (grid-based clustering)
  const regions = findSpatialRegions(nodes, bounds)

  // Find overlapping nodes
  const overlappingNodes = findOverlappingNodes(nodes)

  return {
    bounds,
    density,
    regions,
    overlappingNodes
  }
}

function findSpatialRegions(
  nodes: Node<NodeData>[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): SpatialRegion[] {
  // Divide canvas into grid cells
  const gridSize = 500 // 500px cells
  const regions: SpatialRegion[] = []

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const cols = Math.ceil(width / gridSize)
  const rows = Math.ceil(height / gridSize)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const regionBounds = {
        x: bounds.minX + col * gridSize,
        y: bounds.minY + row * gridSize,
        width: gridSize,
        height: gridSize
      }

      // Find nodes in this region
      const regionNodes = nodes.filter((node) => {
        const nodeWidth = node.measured?.width ?? 300
        const nodeHeight = node.measured?.height ?? 150
        const nodeCenterX = node.position.x + nodeWidth / 2
        const nodeCenterY = node.position.y + nodeHeight / 2

        return (
          nodeCenterX >= regionBounds.x &&
          nodeCenterX < regionBounds.x + regionBounds.width &&
          nodeCenterY >= regionBounds.y &&
          nodeCenterY < regionBounds.y + regionBounds.height
        )
      })

      if (regionNodes.length > 0) {
        regions.push({
          id: `region-${row}-${col}`,
          name: `Region (${row}, ${col})`,
          bounds: regionBounds,
          nodes: regionNodes.map((n) => n.id)
        })
      }
    }
  }

  return regions
}

function findOverlappingNodes(nodes: Node<NodeData>[]): string[][] {
  const overlaps: string[][] = []
  const checked = new Set<string>()

  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i]!
    const aWidth = nodeA.measured?.width ?? 300
    const aHeight = nodeA.measured?.height ?? 150
    const aRect = {
      x: nodeA.position.x,
      y: nodeA.position.y,
      width: aWidth,
      height: aHeight
    }

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j]!
      const bWidth = nodeB.measured?.width ?? 300
      const bHeight = nodeB.measured?.height ?? 150
      const bRect = {
        x: nodeB.position.x,
        y: nodeB.position.y,
        width: bWidth,
        height: bHeight
      }

      // Check if rectangles overlap
      if (
        aRect.x < bRect.x + bRect.width &&
        aRect.x + aRect.width > bRect.x &&
        aRect.y < bRect.y + bRect.height &&
        aRect.y + aRect.height > bRect.y
      ) {
        const key = [nodeA.id, nodeB.id].sort().join('-')
        if (!checked.has(key)) {
          overlaps.push([nodeA.id, nodeB.id])
          checked.add(key)
        }
      }
    }
  }

  return overlaps
}

// -----------------------------------------------------------------------------
// Workspace Analysis
// -----------------------------------------------------------------------------

export function analyzeWorkspace(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): WorkspaceAnalysis {
  // Count nodes by type
  const nodesByType: Record<string, number> = {}
  for (const node of nodes) {
    const type = node.data.type
    nodesByType[type] = (nodesByType[type] || 0) + 1
  }

  // Build project hierarchy
  const projectHierarchy = buildProjectHierarchy(nodes)

  // Find orphaned nodes (no parent project and no connections)
  const connectedNodes = new Set<string>()
  for (const edge of edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  const nodesWithParent = new Set<string>()
  for (const node of nodes) {
    if (node.data.type === 'project') {
      const projectData = node.data as { childNodeIds?: string[] }
      if (projectData.childNodeIds) {
        for (const childId of projectData.childNodeIds) {
          nodesWithParent.add(childId)
        }
      }
    }
  }

  const orphanedNodes = nodes
    .filter((n) => {
      // Not a project, not connected, and has no parent project
      return (
        n.data.type !== 'project' &&
        !connectedNodes.has(n.id) &&
        !nodesWithParent.has(n.id)
      )
    })
    .map((n) => n.id)

  return {
    totalNodes: nodes.length,
    nodesByType,
    projectHierarchy,
    orphanedNodes,
    recentlyModified: [] // Placeholder
  }
}

function buildProjectHierarchy(
  nodes: Node<NodeData>[]
): Array<{ id: string; title: string; childCount: number; depth: number }> {
  const projects = nodes.filter((n) => n.data.type === 'project')
  const result: Array<{ id: string; title: string; childCount: number; depth: number }> = []

  // Build parent-child relationships
  const parentMap = new Map<string, string>()
  for (const project of projects) {
    const projectData = project.data as { childNodeIds?: string[] }
    if (projectData.childNodeIds) {
      for (const childId of projectData.childNodeIds) {
        parentMap.set(childId, project.id)
      }
    }
  }

  // Calculate depth for each project
  const getDepth = (projectId: string, visited = new Set<string>()): number => {
    if (visited.has(projectId)) return 0 // Prevent cycles
    visited.add(projectId)

    const parentId = parentMap.get(projectId)
    if (!parentId) return 0
    return 1 + getDepth(parentId, visited)
  }

  for (const project of projects) {
    const projectData = project.data as { title?: string; childNodeIds?: string[] }
    result.push({
      id: project.id,
      title: projectData.title ?? 'Untitled Project',
      childCount: projectData.childNodeIds?.length ?? 0,
      depth: getDepth(project.id)
    })
  }

  // Sort by depth then by title
  result.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.title.localeCompare(b.title)
  })

  return result
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function calculateCentroid(nodes: Node<NodeData>[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 }

  let sumX = 0
  let sumY = 0

  for (const node of nodes) {
    const width = node.measured?.width ?? 300
    const height = node.measured?.height ?? 150
    sumX += node.position.x + width / 2
    sumY += node.position.y + height / 2
  }

  return {
    x: sumX / nodes.length,
    y: sumY / nodes.length
  }
}

// -----------------------------------------------------------------------------
// Main Enhanced Builder
// -----------------------------------------------------------------------------

export function buildEnhancedContext(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): EnhancedContextAnalysis {
  return {
    graph: analyzeGraph(nodes, edges),
    spatial: analyzeSpatial(nodes),
    workspace: analyzeWorkspace(nodes, edges)
  }
}

export default buildEnhancedContext
