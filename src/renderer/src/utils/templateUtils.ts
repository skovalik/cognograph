/**
 * Template Utilities
 *
 * Functions for creating templates from selections and applying templates to canvas.
 */

import type { Node, Edge } from '@xyflow/react'
import { v4 as uuid } from 'uuid'
import type {
  NodeTemplate,
  TemplateNode,
  TemplateEdge,
  NodeData,
  EdgeData,
  PlaceholderDefinition
} from '@shared/types'
import { DEFAULT_EDGE_DATA } from '@shared/types'
import {
  detectPlaceholdersInNodeData,
  buildPlaceholderDefinitions,
  resolvePlaceholdersInNodeData
} from './placeholderParser'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ApplyTemplateResult {
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
  templateNodeIdToRealId: Map<string, string>
}

export interface CreateTemplateResult {
  nodes: TemplateNode[]
  edges: TemplateEdge[]
  bounds: { width: number; height: number }
  rootNodeId: string
  placeholders: PlaceholderDefinition[]
}

// -----------------------------------------------------------------------------
// Template Creation
// -----------------------------------------------------------------------------

/**
 * Create a template from selected nodes and edges
 */
export function createTemplateFromSelection(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  options: {
    includeContent: boolean
    detectPlaceholders?: boolean
  } = { includeContent: true, detectPlaceholders: true }
): CreateTemplateResult {
  if (nodes.length === 0) {
    throw new Error('Cannot create template from empty selection')
  }

  // Find root node (topmost-leftmost, prioritizing y then x)
  const rootNode = nodes.reduce((best, node) => {
    const score = node.position.y * 10000 + node.position.x
    const bestScore = best.position.y * 10000 + best.position.x
    return score < bestScore ? node : best
  })

  // Calculate relative positions and build template nodes
  const templateNodes: TemplateNode[] = nodes.map((node) => {
    const nodeData = options.includeContent
      ? { ...node.data }
      : stripContent(node.data)

    return {
      templateNodeId: node.id,
      type: node.data.type,
      relativePosition: {
        x: node.position.x - rootNode.position.x,
        y: node.position.y - rootNode.position.y
      },
      dimensions: {
        width: node.width || getDefaultNodeWidth(node.data.type),
        height: node.height || getDefaultNodeHeight(node.data.type)
      },
      data: nodeData
    }
  })

  // Filter edges to only include those between selected nodes
  const nodeIds = new Set(nodes.map((n) => n.id))
  const templateEdges: TemplateEdge[] = edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      templateEdgeId: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      data: e.data
    }))

  // Calculate bounds
  const bounds = calculateBounds(nodes)

  // Detect placeholders if enabled
  let placeholders: PlaceholderDefinition[] = []
  if (options.detectPlaceholders) {
    const allDetected = templateNodes.flatMap((tn) =>
      detectPlaceholdersInNodeData(tn.data)
    )
    placeholders = buildPlaceholderDefinitions(allDetected)
  }

  return {
    nodes: templateNodes,
    edges: templateEdges,
    bounds,
    rootNodeId: rootNode.id,
    placeholders
  }
}

/**
 * Strip content from node data, keeping only structure
 */
function stripContent(data: NodeData): Partial<NodeData> {
  const base: Partial<NodeData> = {
    type: data.type
  }

  switch (data.type) {
    case 'conversation':
      return {
        ...base,
        title: '{{title}}',
        messages: [],
        provider: data.provider
      }
    case 'project':
      return {
        ...base,
        title: '{{title}}',
        description: '',
        collapsed: false,
        childNodeIds: [],
        color: data.color
      }
    case 'note':
      return {
        ...base,
        title: '{{title}}',
        content: ''
      }
    case 'task':
      return {
        ...base,
        title: '{{title}}',
        description: '',
        status: 'todo',
        priority: 'medium'
      }
    case 'artifact':
      return {
        ...base,
        title: '{{title}}',
        content: '',
        contentType: data.contentType,
        language: data.language,
        source: data.source,
        version: 1,
        versionHistory: [],
        versioningMode: 'update',
        injectionFormat: 'full',
        collapsed: false,
        previewLines: 5
      }
    case 'orchestrator':
      return {
        ...base,
        title: '{{title}}',
        description: '',
        strategy: 'sequential',
        connectedAgents: [],
        runHistory: [],
        maxHistoryRuns: 20
      }
    default:
      return base
  }
}

/**
 * Calculate the bounding box of nodes
 */
function calculateBounds(
  nodes: Node<NodeData>[]
): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const w = node.width || getDefaultNodeWidth(node.data.type)
    const h = node.height || getDefaultNodeHeight(node.data.type)

    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  }

  return {
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Get default node width for a node type
 */
function getDefaultNodeWidth(type: NodeData['type']): number {
  switch (type) {
    case 'project':
      return 400
    case 'conversation':
    case 'note':
    case 'task':
    case 'artifact':
    default:
      return 300
  }
}

/**
 * Get default node height for a node type
 */
function getDefaultNodeHeight(type: NodeData['type']): number {
  switch (type) {
    case 'project':
      return 200
    case 'conversation':
      return 150
    case 'note':
    case 'task':
    case 'artifact':
    default:
      return 120
  }
}

// -----------------------------------------------------------------------------
// Template Application
// -----------------------------------------------------------------------------

/**
 * Apply a template at the given position with resolved placeholder values
 */
export function applyTemplate(
  template: NodeTemplate,
  position: { x: number; y: number },
  placeholderValues: Record<string, string>
): ApplyTemplateResult {
  const templateNodeIdToRealId = new Map<string, string>()
  const nodes: Node<NodeData>[] = []
  const edges: Edge<EdgeData>[] = []
  const now = Date.now()

  // Create nodes
  for (const tNode of template.nodes) {
    const realId = uuid()
    templateNodeIdToRealId.set(tNode.templateNodeId, realId)

    // Resolve placeholders in node data
    const resolvedData = resolvePlaceholdersInNodeData(
      tNode.data as Record<string, unknown>,
      placeholderValues
    ) as Partial<NodeData>

    // Create the full node data with required fields
    const fullData = createNodeData(tNode.type, resolvedData, now)

    nodes.push({
      id: realId,
      type: tNode.type,
      position: {
        x: position.x + tNode.relativePosition.x,
        y: position.y + tNode.relativePosition.y
      },
      data: fullData,
      width: tNode.dimensions.width,
      height: tNode.dimensions.height
    })
  }

  // Create edges with mapped IDs
  for (const tEdge of template.edges) {
    const sourceId = templateNodeIdToRealId.get(tEdge.source)
    const targetId = templateNodeIdToRealId.get(tEdge.target)

    if (sourceId && targetId) {
      edges.push({
        id: `${sourceId}-${targetId}-${uuid().slice(0, 8)}`,
        source: sourceId,
        target: targetId,
        sourceHandle: tEdge.sourceHandle,
        targetHandle: tEdge.targetHandle,
        data: {
          ...DEFAULT_EDGE_DATA,
          ...tEdge.data
        }
      })
    }
  }

  return { nodes, edges, templateNodeIdToRealId }
}

/**
 * Create full node data from partial template data
 */
function createNodeData(
  type: NodeData['type'],
  partialData: Partial<NodeData>,
  timestamp: number
): NodeData {
  const base = {
    ...partialData,
    type,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  switch (type) {
    case 'conversation':
      return {
        title: 'New Conversation',
        messages: [],
        provider: 'anthropic',
        ...base
      } as NodeData

    case 'project':
      return {
        title: 'New Project',
        description: '',
        collapsed: false,
        childNodeIds: [],
        color: '#3b82f6',
        ...base
      } as NodeData

    case 'note':
      return {
        title: 'New Note',
        content: '',
        ...base
      } as NodeData

    case 'task':
      return {
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        ...base
      } as NodeData

    case 'artifact':
      return {
        title: 'New Artifact',
        content: '',
        contentType: 'text',
        source: { type: 'created', method: 'manual' },
        version: 1,
        versionHistory: [],
        versioningMode: 'update',
        injectionFormat: 'full',
        collapsed: false,
        previewLines: 5,
        ...base
      } as NodeData

    default:
      return base as NodeData
  }
}

// -----------------------------------------------------------------------------
// Template Helpers
// -----------------------------------------------------------------------------

/**
 * Create an edge to connect template result to an existing node
 */
export function createConnectionEdge(
  templateRootId: string,
  targetNodeId: string,
  options: {
    direction?: 'to-template' | 'from-template'
    label?: string
  } = {}
): Edge<EdgeData> {
  const { direction = 'to-template', label } = options

  const [source, target] =
    direction === 'to-template'
      ? [targetNodeId, templateRootId]
      : [templateRootId, targetNodeId]

  return {
    id: `${source}-${target}-${uuid().slice(0, 8)}`,
    source,
    target,
    data: {
      ...DEFAULT_EDGE_DATA,
      label
    }
  }
}

/**
 * Get a suggested name for a template based on its nodes
 */
export function suggestTemplateName(nodes: Node<NodeData>[]): string {
  if (nodes.length === 0) return 'New Template'

  const firstNode = nodes[0]
  if (!firstNode) return 'New Template'

  // If single node, use its title
  if (nodes.length === 1) {
    return `${firstNode.data.title || 'Untitled'} Template`
  }

  // If multiple nodes, try to find a common pattern
  const types = new Set(nodes.map((n) => n.data.type))
  if (types.size === 1) {
    const type = firstNode.data.type
    const typeName = type.charAt(0).toUpperCase() + type.slice(1)
    return `${nodes.length} ${typeName}s Template`
  }

  // Generic name
  return `${nodes.length} Nodes Template`
}

/**
 * Validate that a template can be applied
 */
export function validateTemplate(template: NodeTemplate): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!template.nodes || template.nodes.length === 0) {
    errors.push('Template has no nodes')
  }

  if (!template.rootNodeId) {
    errors.push('Template has no root node')
  }

  if (template.rootNodeId && !template.nodes.some((n) => n.templateNodeId === template.rootNodeId)) {
    errors.push('Template root node not found in nodes')
  }

  // Validate edges reference existing nodes
  const nodeIds = new Set(template.nodes.map((n) => n.templateNodeId))
  for (const edge of template.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge source ${edge.source} not found in template nodes`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge target ${edge.target} not found in template nodes`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get node count by type in a template
 */
export function getTemplateNodeCounts(
  template: NodeTemplate
): Record<NodeData['type'], number> {
  const counts: Record<NodeData['type'], number> = {
    conversation: 0,
    project: 0,
    note: 0,
    task: 0,
    artifact: 0,
    action: 0,
    text: 0,
    workspace: 0,
    orchestrator: 0
  }

  for (const node of template.nodes) {
    counts[node.type]++
  }

  return counts
}
