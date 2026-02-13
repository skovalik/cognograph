/**
 * GhostNode -- Translucent proposed node rendered on canvas
 *
 * Registered as a React Flow custom node type ('ghost').
 * Shows a dashed border, preview content, and inline approve/reject buttons.
 * Draggable to let user modify position before approving.
 * Pulses via CSS animation to distinguish from real nodes.
 */

import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Check, X, GripVertical, Bot, FileText, CheckSquare, MessageSquare, Folder, Globe, Type, Zap, Cog } from 'lucide-react'
import { Button } from '../ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { useProposalStore } from '../../stores/proposalStore'
import { cn } from '../../lib/utils'

// Node type -> icon mapping
const NODE_TYPE_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  task: CheckSquare,
  conversation: MessageSquare,
  project: Folder,
  artifact: Globe,
  workspace: Globe,
  text: Type,
  action: Zap,
  orchestrator: Cog,
}

// Node type -> color mapping (matches CustomEdge NODE_TYPE_COLORS)
const NODE_TYPE_COLORS: Record<string, string> = {
  conversation: '#3b82f6',
  project: '#64748b',
  note: '#eab308',
  task: '#22c55e',
  artifact: '#a855f7',
  workspace: '#6366f1',
  text: '#94a3b8',
  action: '#ef4444',
  orchestrator: '#a855f7',
}

interface GhostNodeData {
  proposalId: string
  changeId: string
  nodeType: string
  title: string
  previewContent?: string
  agentName: string
  isSelected: boolean
  [key: string]: unknown
}

function GhostNodeComponent({ id, data }: NodeProps): JSX.Element {
  const ghostData = data as unknown as GhostNodeData
  const approveChange = useProposalStore(s => s.approveChange)
  const rejectChange = useProposalStore(s => s.rejectChange)

  const nodeColor = NODE_TYPE_COLORS[ghostData.nodeType] || '#94a3b8'
  const NodeIcon = NODE_TYPE_ICONS[ghostData.nodeType] || FileText

  const handleApprove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    approveChange(ghostData.proposalId, ghostData.changeId)
  }, [approveChange, ghostData.proposalId, ghostData.changeId])

  const handleReject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    rejectChange(ghostData.proposalId, ghostData.changeId)
  }, [rejectChange, ghostData.proposalId, ghostData.changeId])

  return (
    <div
      className="ghost-node"
      style={{
        '--ghost-color': nodeColor,
      } as React.CSSProperties}
    >
      {/* Drag handle */}
      <div className="ghost-node-drag-handle">
        <GripVertical className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <NodeIcon className="w-3.5 h-3.5" style={{ color: nodeColor }} />
        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {ghostData.title}
        </span>
      </div>

      {/* Preview content */}
      {ghostData.previewContent && (
        <p
          className="text-[10px] line-clamp-3 mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {ghostData.previewContent}
        </p>
      )}

      {/* Approval buttons */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30"
              onClick={handleApprove}
            >
              <Check className="w-3 h-3 mr-0.5" />
              Accept
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create this node at current position</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
              onClick={handleReject}
            >
              <X className="w-3 h-3 mr-0.5" />
              Reject
            </Button>
          </TooltipTrigger>
          <TooltipContent>Discard this proposed node</TooltipContent>
        </Tooltip>
      </div>

      {/* Attribution */}
      <div
        className="flex items-center gap-1 mt-1.5 pt-1 border-t border-dashed"
        style={{ borderColor: `${nodeColor}40` }}
      >
        <Bot className="w-2.5 h-2.5" style={{ color: 'var(--text-muted)' }} />
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {ghostData.agentName}
        </span>
      </div>
    </div>
  )
}

export const GhostNode = memo(GhostNodeComponent)
