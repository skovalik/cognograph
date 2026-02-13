/**
 * Context Builder
 *
 * Builds AIEditorContext for sending to the LLM for plan generation.
 * Handles truncation to stay within token limits.
 *
 * Enhanced with graph, spatial, and workspace analysis for deeper
 * understanding of workspace structure and relationships.
 */

import type { Node, Edge } from '@xyflow/react'
import type {
  AIEditorContext,
  AIEditorMode,
  AIEditorScope,
  AIEditorNodeSummary,
  AIEditorEdgeSummary,
  NodeData,
  EdgeData,
  ConversationNodeData,
  NoteNodeData,
  TextNodeData,
  ArtifactNodeData,
  TaskNodeData,
  ProjectNodeData,
  WorkspaceNodeData,
  EnhancedContextAnalysis
} from '@shared/types'
import { buildEnhancedContext } from './enhancedContextBuilder'
import { describeContext } from './contextDescriber'
import { estimateTokens, getModelContextLimit } from './tokenEstimation'

// Token budget configuration
const DEFAULT_MAX_CONTEXT_TOKENS = 50000
const CONTENT_PREVIEW_LENGTH = 200
const TOKEN_SAFETY_MARGIN = 0.9 // Keep 10% buffer

// -----------------------------------------------------------------------------
// Context Builder Input
// -----------------------------------------------------------------------------

export interface ContextBuilderInput {
  mode: AIEditorMode
  prompt: string
  scope: AIEditorScope
  nodes: Node<NodeData>[]
  edges: Edge<EdgeData>[]
  selectedNodeIds: string[]
  targetNodeId?: string // For 'single' scope
  viewport: { x: number; y: number; zoom: number }
  viewportBounds: { width: number; height: number }
  workspaceSettings?: {
    defaultProvider: string
    themeMode: 'dark' | 'light'
  }
  /** Include enhanced context analysis (graph, spatial, workspace) */
  includeEnhancedAnalysis?: boolean
  /** Model name for token budget calculation */
  model?: string
  /** Learning data from LearningService (optional) */
  learningData?: {
    preferredMode?: 'generate' | 'edit' | 'organize' | 'automate' | 'ask'
    commonPatterns?: string[]
    avgOperations?: number
    frequentNodeTypes?: string[]
  }
}

// -----------------------------------------------------------------------------
// Main Context Builder Function
// -----------------------------------------------------------------------------

/**
 * Build AIEditorContext from workspace state.
 * Handles truncation and token budget management.
 */
export function buildAIEditorContext(input: ContextBuilderInput): AIEditorContext {
  const {
    mode,
    prompt,
    scope,
    nodes,
    edges,
    selectedNodeIds,
    targetNodeId,
    viewport,
    viewportBounds,
    workspaceSettings,
    includeEnhancedAnalysis = false,
    model
  } = input

  // Calculate token budget based on model
  const maxTokens = model ? getContextTokenBudget(model) : DEFAULT_MAX_CONTEXT_TOKENS

  // Calculate canvas bounds
  const canvasBounds = calculateCanvasBounds(nodes)

  // Get nodes based on scope
  const visibleNodeIds = getVisibleNodeIds(nodes, viewport, viewportBounds)

  // For 'single' scope, use targetNodeId as the sole selected node
  const effectiveSelectedIds = scope === 'single' && targetNodeId
    ? [targetNodeId]
    : selectedNodeIds

  const scopeNodeIds = getScopeNodeIds(scope, effectiveSelectedIds, visibleNodeIds, nodes)

  // Build node summaries with appropriate detail levels
  let selectedNodes: AIEditorNodeSummary[]
  let visibleNodes: AIEditorNodeSummary[]

  if (scope === 'single' && targetNodeId) {
    // Single scope: target node at full detail, connected nodes at summary
    const connectedNodeIds = edges
      .filter((e) => e.source === targetNodeId || e.target === targetNodeId)
      .map((e) => e.source === targetNodeId ? e.target : e.source)

    selectedNodes = nodes
      .filter((n) => n.id === targetNodeId)
      .map((n) => buildNodeSummary(n, 'full'))

    visibleNodes = nodes
      .filter((n) => connectedNodeIds.includes(n.id))
      .map((n) => buildNodeSummary(n, 'summary'))
  } else {
    selectedNodes = nodes
      .filter((n) => effectiveSelectedIds.includes(n.id))
      .map((n) => buildNodeSummary(n, 'full'))

    visibleNodes = nodes
      .filter((n) => visibleNodeIds.includes(n.id) && !effectiveSelectedIds.includes(n.id))
      .map((n) => buildNodeSummary(n, 'summary'))
  }

  // All nodes for canvas scope (minimal info)
  const allNodes = scope === 'canvas'
    ? nodes.map((n) => ({
        id: n.id,
        type: n.data.type,
        title: getNodeTitle(n.data),
        position: { x: n.position.x, y: n.position.y }
      }))
    : undefined

  // Build edge summaries
  const relevantEdges = edges.filter((e) => {
    // Include edges that connect nodes in scope
    return scopeNodeIds.includes(e.source) || scopeNodeIds.includes(e.target)
  })

  const edgeSummaries = relevantEdges.map(buildEdgeSummary)

  // Build enhanced context analysis if requested
  let enhanced: EnhancedContextAnalysis | undefined
  if (includeEnhancedAnalysis) {
    enhanced = buildEnhancedContext(nodes, edges)
  }

  // Build human-readable context descriptions for spatial/edge intelligence
  const contextDescription = describeContext(nodes, edges)

  // Estimate tokens (include enhanced analysis if present)
  const estimatedTokens = estimateContextTokens({
    selectedNodes,
    visibleNodes,
    allNodes,
    edges: edgeSummaries,
    prompt,
    enhanced,
    contextDescription
  })

  return {
    mode,
    prompt,
    scope,
    viewport,
    canvasBounds,
    selectedNodes,
    selectedNodeIds: effectiveSelectedIds,
    visibleNodes,
    allNodes,
    edges: edgeSummaries,
    workspaceSettings,
    estimatedTokens,
    maxTokens,
    enhanced,
    spatialDescription: contextDescription.spatial,
    edgeDescription: contextDescription.edges,
    layoutSuggestions: contextDescription.suggestions,
    learningData: input.learningData
  }
}

// -----------------------------------------------------------------------------
// Node Summary Building
// -----------------------------------------------------------------------------

type DetailLevel = 'full' | 'summary' | 'minimal'

function buildNodeSummary(
  node: Node<NodeData>,
  detailLevel: DetailLevel
): AIEditorNodeSummary {
  const data = node.data

  const summary: AIEditorNodeSummary = {
    id: node.id,
    type: data.type,
    title: getNodeTitle(data),
    position: { x: node.position.x, y: node.position.y },
    dimensions: node.measured
      ? { width: node.measured.width ?? 0, height: node.measured.height ?? 0 }
      : undefined,
    tags: ((data.properties as Record<string, unknown> | undefined)?.tags as string[] | undefined) || data.tags,
    contextRole: data.contextRole,
    color: data.color
  }

  // Add type-specific info based on detail level
  switch (data.type) {
    case 'conversation': {
      const convData = data as ConversationNodeData
      summary.messageCount = convData.messages.length
      if (detailLevel === 'full' && convData.messages.length > 0) {
        // Include content preview from last few messages
        const lastMessages = convData.messages.slice(-3)
        const preview = lastMessages
          .map((m) => `${m.role}: ${m.content.slice(0, 100)}`)
          .join('\n')
        summary.contentPreview = truncateText(preview, CONTENT_PREVIEW_LENGTH)
      }
      break
    }

    case 'note': {
      const noteData = data as NoteNodeData
      summary.contentPreview = detailLevel !== 'minimal'
        ? truncateText(noteData.content, CONTENT_PREVIEW_LENGTH)
        : undefined
      break
    }

    case 'artifact': {
      const artifactData = data as ArtifactNodeData
      summary.contentPreview = detailLevel !== 'minimal'
        ? truncateText(artifactData.content, CONTENT_PREVIEW_LENGTH)
        : undefined
      break
    }

    case 'task': {
      const taskData = data as TaskNodeData
      summary.status = taskData.status
      if (detailLevel !== 'minimal') {
        summary.contentPreview = truncateText(taskData.description, CONTENT_PREVIEW_LENGTH)
      }
      break
    }

    case 'project': {
      const projectData = data as ProjectNodeData
      summary.childCount = projectData.childNodeIds.length
      if (detailLevel !== 'minimal') {
        summary.contentPreview = truncateText(projectData.description, CONTENT_PREVIEW_LENGTH)
      }
      break
    }

    case 'workspace': {
      const workspaceData = data as WorkspaceNodeData
      summary.memberCount = workspaceData.includedNodeIds.length
      if (detailLevel !== 'minimal') {
        summary.contentPreview = truncateText(workspaceData.description, CONTENT_PREVIEW_LENGTH)
      }
      break
    }

    case 'text': {
      const textData = data as TextNodeData
      summary.contentPreview = detailLevel !== 'minimal'
        ? truncateText(textData.content, CONTENT_PREVIEW_LENGTH)
        : undefined
      break
    }
  }

  return summary
}

// -----------------------------------------------------------------------------
// Edge Summary Building
// -----------------------------------------------------------------------------

function buildEdgeSummary(edge: Edge<EdgeData>): AIEditorEdgeSummary {
  const data = edge.data

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: data?.label,
    strength: data?.strength,
    direction: data?.direction
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getNodeTitle(data: NodeData): string {
  switch (data.type) {
    case 'conversation':
      return (data as ConversationNodeData).title
    case 'note':
      return (data as NoteNodeData).title
    case 'task':
      return (data as TaskNodeData).title
    case 'project':
      return (data as ProjectNodeData).title
    case 'artifact':
      return (data as ArtifactNodeData).title
    case 'workspace':
      return (data as WorkspaceNodeData).title
    case 'text': {
      const textData = data as TextNodeData
      // Use first line of plain text content as title
      const plainText = textData.content
        ? textData.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
      return plainText.slice(0, 50) || 'Text'
    }
    case 'orchestrator':
      return (data as { title: string }).title
    default:
      return 'Untitled'
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

function calculateCanvasBounds(
  nodes: Node<NodeData>[]
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
  }

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

  return { minX, minY, maxX, maxY }
}

function getVisibleNodeIds(
  nodes: Node<NodeData>[],
  viewport: { x: number; y: number; zoom: number },
  viewportBounds: { width: number; height: number }
): string[] {
  // Calculate visible area in canvas coordinates
  const visibleMinX = -viewport.x / viewport.zoom
  const visibleMinY = -viewport.y / viewport.zoom
  const visibleMaxX = visibleMinX + viewportBounds.width / viewport.zoom
  const visibleMaxY = visibleMinY + viewportBounds.height / viewport.zoom

  return nodes
    .filter((node) => {
      const width = node.measured?.width ?? 300
      const height = node.measured?.height ?? 150

      // Check if node intersects visible area
      return (
        node.position.x + width >= visibleMinX &&
        node.position.x <= visibleMaxX &&
        node.position.y + height >= visibleMinY &&
        node.position.y <= visibleMaxY
      )
    })
    .map((n) => n.id)
}

function getScopeNodeIds(
  scope: AIEditorScope,
  selectedNodeIds: string[],
  visibleNodeIds: string[],
  nodes: Node<NodeData>[]
): string[] {
  switch (scope) {
    case 'single':
      return selectedNodeIds // For single, this is [targetNodeId]
    case 'selection':
      return selectedNodeIds
    case 'view':
      return visibleNodeIds
    case 'canvas':
      return nodes.map((n) => n.id)
    default:
      return selectedNodeIds
  }
}

/**
 * Estimate total tokens for the context using consistent token estimation.
 * Uses the centralized estimateTokens utility for accuracy.
 */
function estimateContextTokens(data: {
  selectedNodes: AIEditorNodeSummary[]
  visibleNodes: AIEditorNodeSummary[]
  allNodes?: Array<{ id: string; type: NodeData['type']; title: string; position: { x: number; y: number } }>
  edges: AIEditorEdgeSummary[]
  prompt: string
  enhanced?: EnhancedContextAnalysis
  contextDescription?: { spatial: string; edges: string; suggestions: string[] }
}): number {
  let totalTokens = 0

  // Prompt tokens
  totalTokens += estimateTokens(data.prompt)

  // Selected nodes (full detail)
  for (const node of data.selectedNodes) {
    totalTokens += estimateTokens(JSON.stringify(node))
  }

  // Visible nodes (summary)
  for (const node of data.visibleNodes) {
    totalTokens += estimateTokens(JSON.stringify(node))
  }

  // All nodes (minimal)
  if (data.allNodes) {
    for (const node of data.allNodes) {
      totalTokens += estimateTokens(JSON.stringify(node))
    }
  }

  // Edges
  for (const edge of data.edges) {
    totalTokens += estimateTokens(JSON.stringify(edge))
  }

  // Enhanced analysis
  if (data.enhanced) {
    totalTokens += estimateTokens(JSON.stringify(data.enhanced))
  }

  // Context descriptions (spatial, edge, suggestions)
  if (data.contextDescription) {
    totalTokens += estimateTokens(data.contextDescription.spatial)
    totalTokens += estimateTokens(data.contextDescription.edges)
    totalTokens += estimateTokens(data.contextDescription.suggestions.join('\n'))
  }

  // Add overhead for JSON structure, system prompt, and response buffer
  totalTokens += 500

  return totalTokens
}

/**
 * Get max token budget for a given model.
 * Applies safety margin to leave room for response.
 */
export function getContextTokenBudget(model?: string): number {
  const limit = getModelContextLimit(model)
  return Math.floor(limit * TOKEN_SAFETY_MARGIN)
}
