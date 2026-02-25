/**
 * ContextTreePanel — Shows the BFS context tree for a node.
 *
 * Reads the node's inbound context traversal from workspaceStore and renders
 * a depth-indented tree of connected nodes with type icon, title, contextRole
 * badge, and estimated token count.  Each entry is clickable to pan/zoom to
 * that node.
 *
 * Phase 3B artboard panel.
 */

import React, { memo, useCallback, useMemo } from 'react'
import {
  MessageSquare,
  FolderKanban,
  StickyNote,
  CheckSquare,
  Code,
  Globe,
  FileText,
  Zap,
  Workflow,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { ContextTraversalNode } from '../../utils/contextCache'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, React.ElementType> = {
  conversation: MessageSquare,
  project: FolderKanban,
  note: StickyNote,
  task: CheckSquare,
  artifact: Code,
  workspace: Globe,
  text: FileText,
  action: Zap,
  orchestrator: Workflow,
}

const ROLE_COLORS: Record<string, string> = {
  instruction: '#8b5cf6',
  reference: '#3b82f6',
  example: '#f59e0b',
  background: '#6b7280',
  scope: '#10b981',
}

/** Very rough token estimate: ~4 chars per token for English text. */
function estimateTokens(title: string): number {
  return Math.max(1, Math.round(title.length / 4))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ContextTreePanelProps {
  nodeId: string
  className?: string
}

function ContextTreePanelComponent({ nodeId, className }: ContextTreePanelProps): JSX.Element {
  const getContextTraversalForNode = useWorkspaceStore(
    (s) => s.getContextTraversalForNode,
  )
  const setSelectedNodes = useWorkspaceStore((s) => s.setSelectedNodes)

  const traversal = useMemo(
    () => getContextTraversalForNode(nodeId),
    [getContextTraversalForNode, nodeId],
  )

  const handleNodeClick = useCallback(
    (targetId: string) => () => {
      setSelectedNodes([targetId])
    },
    [setSelectedNodes],
  )

  if (traversal.nodes.length === 0) {
    return (
      <div
        className={`context-tree-panel flex items-center justify-center h-full text-xs ${className ?? ''}`}
        style={{ color: 'var(--text-muted, #888)' }}
        aria-label="Context tree"
      >
        No context — connect inbound nodes to inject context.
      </div>
    )
  }

  return (
    <div
      className={`context-tree-panel p-2 space-y-0.5 overflow-auto ${className ?? ''}`}
      aria-label="Context tree"
    >
      <div className="text-[10px] uppercase tracking-wide font-medium mb-1" style={{ color: 'var(--text-muted, #888)' }}>
        Context Sources ({traversal.nodeCount})
      </div>
      {traversal.nodes.map((ctxNode: ContextTraversalNode) => {
        const Icon = TYPE_ICONS[ctxNode.type] ?? FileText
        const roleColor = ROLE_COLORS[ctxNode.role] ?? 'var(--text-muted, #888)'
        const tokens = estimateTokens(ctxNode.title)

        return (
          <button
            key={ctxNode.id}
            className="context-tree-panel__entry flex items-center gap-1.5 w-full text-left px-1.5 py-1 rounded text-xs hover:bg-white/5 transition-colors"
            style={{ paddingLeft: `${8 + ctxNode.depth * 14}px` }}
            onClick={handleNodeClick(ctxNode.id)}
            title={`Pan to ${ctxNode.title}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: roleColor }} />
            <span className="truncate flex-1" style={{ color: 'var(--text-primary, #e0e0e0)' }}>
              {ctxNode.title || 'Untitled'}
            </span>
            {ctxNode.role && (
              <span
                className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-medium"
                style={{
                  backgroundColor: `${roleColor}20`,
                  color: roleColor,
                }}
              >
                {ctxNode.role}
              </span>
            )}
            <span
              className="flex-shrink-0 text-[9px]"
              style={{ color: 'var(--text-muted, #888)' }}
            >
              ~{tokens}t
            </span>
          </button>
        )
      })}
    </div>
  )
}

export const ContextTreePanel = memo(ContextTreePanelComponent)
