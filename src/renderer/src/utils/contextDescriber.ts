/**
 * Context Describer
 *
 * Converts graph/spatial analysis from enhancedContextBuilder into
 * human-readable descriptions for the AI Editor LLM.
 *
 * This utility sits on top of the existing analysis and produces
 * natural language descriptions that help the AI understand spatial
 * relationships, edge semantics, and layout issues.
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData, EnhancedContextAnalysis } from '@shared/types'
import { buildEnhancedContext } from './enhancedContextBuilder'

export interface ContextDescription {
  /** Human-readable spatial relationships */
  spatial: string
  /** Human-readable edge semantics */
  edges: string
  /** Layout improvement suggestions */
  suggestions: string[]
}

/**
 * Generate human-readable context descriptions for the AI Editor
 */
export function describeContext(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): ContextDescription {
  if (nodes.length === 0) {
    return { spatial: '', edges: '', suggestions: [] }
  }

  const analysis = buildEnhancedContext(nodes, edges)

  return {
    spatial: describeSpatialLayout(nodes, analysis),
    edges: describeEdgeRelationships(nodes, edges, analysis),
    suggestions: generateLayoutSuggestions(nodes, edges, analysis)
  }
}

/**
 * Get a node's display title safely
 */
function getNodeTitle(node: Node<NodeData>): string {
  const data = node.data
  if ('title' in data && typeof data.title === 'string') {
    return data.title || 'Untitled'
  }
  // For text nodes, use content preview
  if (data.type === 'text' && 'content' in data) {
    const content = (data.content as string) || ''
    const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return plainText.slice(0, 30) || 'Text'
  }
  return 'Untitled'
}

/**
 * Describe spatial relationships in natural language
 */
function describeSpatialLayout(
  nodes: Node<NodeData>[],
  analysis: EnhancedContextAnalysis
): string {
  const descriptions: string[] = []

  // Describe extremes (top/bottom/left/right nodes)
  const sortedByY = [...nodes].sort((a, b) => a.position.y - b.position.y)
  const sortedByX = [...nodes].sort((a, b) => a.position.x - b.position.x)

  if (sortedByY.length >= 2) {
    const top = sortedByY[0]
    const bottom = sortedByY[sortedByY.length - 1]
    if (top.id !== bottom.id) {
      descriptions.push(`TOP: "${getNodeTitle(top)}" (${top.data.type})`)
      descriptions.push(`BOTTOM: "${getNodeTitle(bottom)}" (${bottom.data.type})`)
    }
  }

  if (sortedByX.length >= 2) {
    const left = sortedByX[0]
    const right = sortedByX[sortedByX.length - 1]
    // Only add if different from top/bottom to avoid redundancy
    if (
      left.id !== right.id &&
      left.id !== sortedByY[0].id &&
      right.id !== sortedByY[sortedByY.length - 1].id
    ) {
      descriptions.push(`LEFT: "${getNodeTitle(left)}" | RIGHT: "${getNodeTitle(right)}"`)
    }
  }

  // Describe clusters from graph analysis
  for (const cluster of analysis.graph.clusters) {
    if (cluster.nodes.length > 1) {
      const clusterNodes = nodes.filter((n) => cluster.nodes.includes(n.id))
      const titles = clusterNodes
        .slice(0, 4)
        .map((n) => `"${getNodeTitle(n)}"`)
        .join(', ')
      const more = clusterNodes.length > 4 ? ` (+${clusterNodes.length - 4} more)` : ''
      descriptions.push(`CLUSTER (${cluster.dominantType}): ${titles}${more}`)
    }
  }

  // Describe isolated nodes
  if (analysis.graph.isolatedNodes.length > 0) {
    const isolated = nodes.filter((n) => analysis.graph.isolatedNodes.includes(n.id))
    const titles = isolated
      .slice(0, 3)
      .map((n) => `"${getNodeTitle(n)}"`)
      .join(', ')
    const more = isolated.length > 3 ? ` (+${isolated.length - 3} more)` : ''
    descriptions.push(`ISOLATED (no connections): ${titles}${more}`)
  }

  return descriptions.length > 0
    ? 'SPATIAL LAYOUT:\n' + descriptions.map((d) => `- ${d}`).join('\n')
    : ''
}

/**
 * Describe edge relationships with semantic meaning
 */
function describeEdgeRelationships(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  analysis: EnhancedContextAnalysis
): string {
  const descriptions: string[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Group edges by label
  const byLabel = new Map<string, Edge<EdgeData>[]>()
  for (const edge of edges) {
    const label = edge.data?.label || 'unlabeled'
    if (!byLabel.has(label)) byLabel.set(label, [])
    byLabel.get(label)!.push(edge)
  }

  // Summarize edge types with semantic meaning
  for (const [label, labelEdges] of byLabel) {
    if (label === 'provides context') {
      descriptions.push(`Context injection (${labelEdges.length}): These feed info into conversations`)
    } else if (label === 'depends on') {
      descriptions.push(`Dependencies (${labelEdges.length}): Task workflow order`)
    } else if (label === 'child of') {
      descriptions.push(`Hierarchy (${labelEdges.length}): Project containment`)
    } else if (label === 'related to') {
      descriptions.push(`Associations (${labelEdges.length}): Conceptual links`)
    } else if (label === 'extracted from' || label === 'extracted') {
      descriptions.push(`Extractions (${labelEdges.length}): AI-created content from source`)
    } else if (label === 'continues from') {
      descriptions.push(`Workflow sequence (${labelEdges.length}): Sequential steps`)
    } else if (label === 'unlabeled') {
      descriptions.push(`Unlabeled connections: ${labelEdges.length}`)
    } else if (labelEdges.length > 0) {
      descriptions.push(`"${label}" edges: ${labelEdges.length}`)
    }
  }

  // Describe context chains (what feeds into each conversation)
  for (const chain of analysis.graph.contextChains) {
    const conv = nodeMap.get(chain.conversationId)
    if (conv && chain.contextSources.length > 0) {
      const sources = chain.contextSources
        .slice(0, 4)
        .map((id) => nodeMap.get(id))
        .filter(Boolean)
        .map((n) => `"${getNodeTitle(n!)}"`)
        .join(', ')
      const more =
        chain.contextSources.length > 4 ? ` (+${chain.contextSources.length - 4} more)` : ''
      descriptions.push(`"${getNodeTitle(conv)}" receives context from: ${sources}${more}`)
    }
  }

  return descriptions.length > 0
    ? 'EDGE RELATIONSHIPS:\n' + descriptions.map((d) => `- ${d}`).join('\n')
    : ''
}

/**
 * Generate layout improvement suggestions
 */
function generateLayoutSuggestions(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  analysis: EnhancedContextAnalysis
): string[] {
  const suggestions: string[] = []

  // Check for context sources below conversations (bad flow - context should flow down/right INTO conversations)
  const conversations = nodes.filter((n) => n.data.type === 'conversation')
  for (const conv of conversations) {
    const incoming = edges.filter((e) => e.target === conv.id)
    for (const edge of incoming) {
      const source = nodes.find((n) => n.id === edge.source)
      if (source && source.position.y > conv.position.y + 100) {
        suggestions.push(
          `Context source "${getNodeTitle(source)}" is BELOW conversation "${getNodeTitle(conv)}" - consider moving it above`
        )
      }
    }
  }

  // Check for overlapping nodes
  if (analysis.spatial.overlappingNodes.length > 0) {
    const count = analysis.spatial.overlappingNodes.length
    if (count === 1) {
      suggestions.push(`1 node pair is overlapping - consider spreading them apart`)
    } else {
      suggestions.push(`${count} node pairs are overlapping - consider spreading them apart`)
    }
  }

  // Check for orphaned nodes (in workspace analysis)
  if (analysis.workspace.orphanedNodes.length > 0) {
    const count = analysis.workspace.orphanedNodes.length
    suggestions.push(
      `${count} nodes have no connections and no parent project - consider connecting or organizing them`
    )
  }

  // Check for isolated clusters that could be connected
  const isolatedClusters = analysis.graph.clusters.filter((c) => c.nodes.length === 1)
  if (isolatedClusters.length > 2) {
    suggestions.push(
      `${isolatedClusters.length} single-node clusters could be grouped or connected`
    )
  }

  return suggestions
}

export default describeContext
