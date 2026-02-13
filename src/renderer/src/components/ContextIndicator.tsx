import { useState } from 'react'
import { Network, ChevronDown, ChevronUp, Settings } from 'lucide-react'
import { useNodesStore, useEdgesStore, useWorkspaceStore } from '../stores'
import type { NodeData } from '@shared/types'

interface ContextIndicatorProps {
  nodeId: string
  onSettingsClick?: () => void
  /** Whether context is currently being injected (triggers flash animation) */
  isInjecting?: boolean
}

export function ContextIndicator({ nodeId, onSettingsClick, isInjecting = false }: ContextIndicatorProps): JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false)
  const nodes = useNodesStore((s) => s.nodes)
  const edges = useEdgesStore((s) => s.edges)
  const contextSettings = useWorkspaceStore((s) => s.contextSettings) // Complex context injection - stays in workspaceStore

  // Calculate context sources using similar logic to getContextForNode
  // but just getting the list of nodes that would be included
  const getContextSources = () => {
    const maxDepth = contextSettings.globalDepth
    const visited = new Set<string>()
    const result: Array<{ id: string; title: string; type: NodeData['type']; depth: number }> = []
    const queue: Array<{ id: string; depth: number }> = []

    // Get inbound edges
    const getInboundEdges = (targetId: string) =>
      edges.filter((e) => {
        if (e.target !== targetId) return false
        if (e.data?.active === false) return false
        return true
      })

    // Get bidirectional outbound edges
    const getBidirectionalEdges = (sourceId: string) =>
      edges.filter((e) => {
        if (e.source !== sourceId) return false
        if (e.data?.active === false) return false
        if (e.data?.direction !== 'bidirectional') return false
        return true
      })

    // Seed queue
    const initialInbound = getInboundEdges(nodeId)
    const initialBidirectional = getBidirectionalEdges(nodeId)

    initialInbound.forEach((edge) => {
      queue.push({ id: edge.source, depth: 1 })
    })
    initialBidirectional.forEach((edge) => {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, depth: 1 })
      }
    })

    // BFS
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.id)) continue
      if (current.depth > maxDepth) continue

      const node = nodes.find((n) => n.id === current.id)
      if (!node || node.data.includeInContext === false) continue

      visited.add(current.id)
      result.push({
        id: current.id,
        title: node.data.title as string,
        type: node.data.type,
        depth: current.depth
      })

      if (current.depth < maxDepth) {
        const nextInbound = getInboundEdges(current.id)
        const nextBidirectional = getBidirectionalEdges(current.id)

        nextInbound.forEach((edge) => {
          if (!visited.has(edge.source)) {
            queue.push({ id: edge.source, depth: current.depth + 1 })
          }
        })
        nextBidirectional.forEach((edge) => {
          if (!visited.has(edge.target)) {
            queue.push({ id: edge.target, depth: current.depth + 1 })
          }
        })
      }
    }

    return result
  }

  const contextSources = getContextSources()

  if (contextSources.length === 0) {
    return null
  }

  const typeColors: Record<NodeData['type'], string> = {
    project: 'bg-violet-500/20 text-violet-400',
    note: 'bg-amber-500/20 text-amber-400',
    task: 'bg-emerald-500/20 text-emerald-400',
    conversation: 'bg-blue-500/20 text-blue-400',
    artifact: 'bg-cyan-500/20 text-cyan-400',
    workspace: 'bg-red-500/20 text-red-400',
    action: 'bg-orange-500/20 text-orange-400',
    text: 'bg-[var(--text-muted)]/20 text-[var(--text-secondary)]',
    orchestrator: 'bg-violet-500/20 text-violet-400'
  }

  // Build className with injection flash state
  const containerClassName = [
    'border-t border-[var(--border-subtle)] bg-[var(--surface-panel)]/50',
    isInjecting && 'context-indicator injecting'
  ].filter(Boolean).join(' ')

  return (
    <div className={containerClassName}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs hover:bg-[var(--surface-panel-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[var(--text-secondary)]">
            Using context from <span className="text-white font-medium">{contextSources.length}</span> {contextSources.length === 1 ? 'node' : 'nodes'}
          </span>
          <span className="text-[var(--text-muted)]">(depth: {contextSettings.globalDepth})</span>
        </div>
        <div className="flex items-center gap-1">
          {onSettingsClick && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSettingsClick()
              }}
              className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors"
              title="Context Settings"
            >
              <Settings className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-1.5 max-h-[150px] overflow-y-auto">
          {contextSources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-2 text-xs"
            >
              <span className={`px-1.5 py-0.5 rounded ${typeColors[source.type]}`}>
                {source.type}
              </span>
              <span className="text-[var(--text-secondary)] truncate flex-1" title={source.title}>
                {source.title}
              </span>
              <span className="text-[var(--text-muted)]">d{source.depth}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
