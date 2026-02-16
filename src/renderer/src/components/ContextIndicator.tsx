/**
 * Context Indicator Component
 *
 * Shows which nodes are contributing context to the current conversation/agent.
 * Compact badge by default, expands to show full list on click.
 *
 * Implements VISION.md promise: "Automatic with visibility"
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@/stores'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface ContextSource {
  nodeId: string
  title: string
  type: string
  tokens: number
}

interface ContextIndicatorProps {
  nodeId: string
  compact?: boolean
  className?: string
}

/**
 * Parse getContextForNode() output to extract individual sources.
 * Avoids duplicate BFS traversal - reuses existing context string.
 */
function parseContextSources(contextText: string, nodeId: string, allNodes: Array<{ id: string; data: { type: string; title?: string; [key: string]: unknown } }>): ContextSource[] {
  if (!contextText || contextText.trim() === '') {
    return []
  }

  const sources: ContextSource[] = []

  // Context format: "[Role: Title]...content...\n\n---\n\n[Next Role: Title]..."
  // Split by section separator
  const sections = contextText.split('\n\n---\n\n')

  sections.forEach((section) => {
    // Extract title from "[Role: Title]" header
    const headerMatch = section.match(/^\[([^\]]+): ([^\]]+)\]/)
    if (!headerMatch) return

    const role = headerMatch[1]  // e.g., "Reference", "Project Scope"
    const title = headerMatch[2]  // e.g., "Requirements"

    // Find matching node by title
    const node = allNodes.find(n => {
      if (n.id === nodeId) return false  // Exclude self
      return n.data.title === title
    })

    if (node) {
      // Estimate tokens (rough: 4 chars per token)
      const tokens = Math.ceil(section.length / 4)

      sources.push({
        nodeId: node.id,
        title,
        type: node.data.type,
        tokens
      })
    }
  })

  return sources
}

/** Skeleton loader for context indicator */
function ContextSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md",
        "text-xs font-medium text-muted-foreground",
        "border border-border/50",
        className
      )}
      aria-label="Calculating context..."
      role="status"
    >
      <span className="text-[10px]">📎</span>
      <span className="skeleton-loading inline-block w-20 h-3" />
    </div>
  )
}

export function ContextIndicator({ nodeId, compact = true, className }: ContextIndicatorProps) {
  const [expanded, setExpanded] = useState(false)
  const [isCalculating, setIsCalculating] = useState(true)
  const getContextForNode = useWorkspaceStore(state => state.getContextForNode)
  const allNodes = useWorkspaceStore(state => state.nodes)
  const computedRef = useRef(false)

  const { sources, totalTokens } = useMemo(() => {
    const contextText = getContextForNode(nodeId)
    const sources = parseContextSources(contextText, nodeId, allNodes)
    const totalTokens = sources.reduce((sum, s) => sum + s.tokens, 0)
    return { sources, totalTokens }
  }, [nodeId, getContextForNode, allNodes])

  // Show loading skeleton briefly on first render, then reveal computed result
  useEffect(() => {
    if (!computedRef.current) {
      computedRef.current = true
      // Use rAF to defer calculation display so the skeleton is painted first
      requestAnimationFrame(() => {
        setIsCalculating(false)
      })
    }
  }, [])

  // Show skeleton while calculating
  if (isCalculating) {
    return <ContextSkeleton className={className} />
  }

  // No context - show muted message
  if (sources.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        No context nodes connected
      </div>
    )
  }

  // Compact mode - clickable badge
  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-md",
          "text-xs font-medium",
          "bg-primary/10 hover:bg-primary/20",
          "text-primary",
          "transition-colors",
          "border border-primary/20",
          className
        )}
        aria-label={`${sources.length} context source${sources.length !== 1 ? 's' : ''}, ${totalTokens} tokens. Click to expand`}
      >
        <span className="text-[10px]">📎</span>
        <span>{sources.length} context{sources.length !== 1 ? 's' : ''}</span>
        <span className="text-muted-foreground">•</span>
        <span>{totalTokens}t</span>
      </button>
    )
  }

  // Expanded mode - full list
  return (
    <div className={cn("context-indicator-expanded rounded-md border border-border bg-card p-3 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium flex items-center gap-1.5">
          <span className="text-base">📎</span>
          <span>Using context from:</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse context indicator"
        >
          Collapse ▲
        </button>
      </div>

      <ul className="space-y-1.5">
        {sources.map((source, i) => (
          <li key={`${source.nodeId}-${i}`} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {source.type}
            </Badge>
            <span className="flex-1 truncate" title={source.title}>
              {source.title}
            </span>
            <span className="text-muted-foreground text-[10px]">
              ({source.tokens}t)
            </span>
          </li>
        ))}
      </ul>

      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        Total: {sources.length} source{sources.length !== 1 ? 's' : ''} • ~{totalTokens} tokens
      </div>
    </div>
  )
}
