/**
 * useTokenEstimate Hook
 *
 * Provides real-time token estimation and cost breakdown for a conversation node.
 * Uses the existing context builder and workspace store to compute estimates.
 */

import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { buildTokenEstimate, type TokenEstimate } from '../utils/tokenEstimator'
import { estimateTokens } from '../utils/tokenEstimation'
import type { ConversationNodeData, NodeData, NoteNodeData, ProjectNodeData, TaskNodeData, ArtifactNodeData, TextNodeData, ActionNodeData, OrchestratorNodeData } from '@shared/types'

/**
 * Get a text representation of a node's content for token estimation.
 */
function getNodeContentText(data: NodeData): string {
  switch (data.type) {
    case 'note': {
      const note = data as NoteNodeData
      return `${note.title}\n${note.content || ''}`
    }
    case 'project': {
      const project = data as ProjectNodeData
      return `${project.title}\n${project.description || ''}`
    }
    case 'task': {
      const task = data as TaskNodeData
      return `${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\n${task.description || ''}`
    }
    case 'artifact': {
      const artifact = data as ArtifactNodeData
      return `${artifact.title}\n${artifact.content || ''}`
    }
    case 'text': {
      const text = data as TextNodeData
      return text.content || ''
    }
    case 'action': {
      const action = data as ActionNodeData
      return `${action.title}\n${action.description || ''}`
    }
    case 'conversation': {
      const conv = data as ConversationNodeData
      return conv.messages.map(m => m.content).join('\n')
    }
    case 'orchestrator': {
      const orch = data as OrchestratorNodeData
      return `${orch.title}\nStrategy: ${orch.strategy}\nAgents: ${orch.connectedAgents.length}\n${orch.description || ''}`
    }
    default:
      return ''
  }
}

/**
 * Hook that provides token estimation for a conversation node.
 *
 * @param nodeId - The conversation node to estimate for
 * @param currentInput - Current message draft text
 * @returns TokenEstimate with breakdown, cost, and usage info
 */
export function useTokenEstimate(nodeId: string, currentInput?: string): TokenEstimate | null {
  const nodes = useWorkspaceStore((state) => state.nodes)
  const edges = useWorkspaceStore((state) => state.edges)
  const contextSettings = useWorkspaceStore((state) => state.contextSettings)
  const getEffectiveLLMSettings = useWorkspaceStore((state) => state.getEffectiveLLMSettings)
  const getContextForNode = useWorkspaceStore((state) => state.getContextForNode)

  return useMemo(() => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.data.type !== 'conversation') return null

    const nodeData = node.data as ConversationNodeData
    const llmSettings = getEffectiveLLMSettings(nodeId)
    const contextText = getContextForNode(nodeId)

    // Build per-node breakdown from connected context nodes
    // Use a simplified BFS matching the store's getContextForNode logic
    const contextBreakdown: { label: string; nodeId?: string; text: string }[] = []
    const visited = new Set<string>()
    const maxDepth = contextSettings.globalDepth

    const getInboundEdges = (targetId: string) =>
      edges.filter(e => e.target === targetId && e.data?.active !== false)

    const getBidirectionalEdges = (targetId: string) =>
      edges.filter(e => e.source === targetId && e.data?.active !== false && e.data?.direction === 'bidirectional')

    interface QueueItem {
      node: typeof nodes[0]
      depth: number
      path: string[]
    }

    const queue: QueueItem[] = []

    // Seed with immediate connections
    const initialInbound = getInboundEdges(nodeId)
    const initialBidirectional = getBidirectionalEdges(nodeId)

    initialInbound.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (sourceNode && sourceNode.data.includeInContext !== false) {
        queue.push({ node: sourceNode, depth: 1, path: [nodeId, sourceNode.id] })
      }
    })

    initialBidirectional.forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (targetNode && targetNode.data.includeInContext !== false && !visited.has(edge.target)) {
        queue.push({ node: targetNode, depth: 1, path: [nodeId, targetNode.id] })
      }
    })

    // BFS
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.node.id)) continue
      if (current.depth > maxDepth) continue

      visited.add(current.node.id)

      const content = getNodeContentText(current.node.data)
      if (content && estimateTokens(content) > 0) {
        const title = (current.node.data as { title?: string }).title || current.node.data.type
        contextBreakdown.push({
          label: title,
          nodeId: current.node.id,
          text: content
        })
      }

      if (current.depth < maxDepth) {
        const nextInbound = getInboundEdges(current.node.id)
        const nextBidirectional = getBidirectionalEdges(current.node.id)

        nextInbound.forEach(edge => {
          if (!visited.has(edge.source) && !current.path.includes(edge.source)) {
            const sourceNode = nodes.find(n => n.id === edge.source)
            if (sourceNode && sourceNode.data.includeInContext !== false) {
              queue.push({ node: sourceNode, depth: current.depth + 1, path: [...current.path, sourceNode.id] })
            }
          }
        })

        nextBidirectional.forEach(edge => {
          if (!visited.has(edge.target) && !current.path.includes(edge.target)) {
            const targetNode = nodes.find(n => n.id === edge.target)
            if (targetNode && targetNode.data.includeInContext !== false) {
              queue.push({ node: targetNode, depth: current.depth + 1, path: [...current.path, targetNode.id] })
            }
          }
        })
      }
    }

    return buildTokenEstimate({
      contextText,
      contextBreakdown: contextBreakdown.length > 0 ? contextBreakdown : undefined,
      messages: nodeData.messages,
      systemPrompt: llmSettings?.systemPrompt,
      currentInput,
      model: llmSettings?.model,
      maxOutputTokens: llmSettings?.maxTokens
    })
  }, [nodeId, currentInput, getEffectiveLLMSettings, getContextForNode, nodes, edges, contextSettings])
}
