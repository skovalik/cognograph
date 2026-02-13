/**
 * GhostNode Component
 *
 * A semi-transparent preview node shown when creating new nodes.
 * Used in the AI Editor preview to show where new nodes will be placed.
 */

import { memo } from 'react'
import { MessageSquare, FileText, CheckSquare, FolderKanban, FileCode2, Boxes, Zap, Type, Workflow } from 'lucide-react'
import type { NodeData } from '@shared/types'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Ghost node data
interface GhostNodeData {
  type: NodeData['type']
  title?: string
  color?: string
}

interface GhostNodeProps {
  data: GhostNodeData
}

const typeIcons: Record<NodeData['type'], React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  conversation: MessageSquare,
  note: FileText,
  task: CheckSquare,
  project: FolderKanban,
  artifact: FileCode2,
  workspace: Boxes,
  action: Zap,
  text: Type,
  orchestrator: Workflow
}

const typeLabels: Record<NodeData['type'], string> = {
  conversation: 'Conversation',
  note: 'Note',
  task: 'Task',
  project: 'Project',
  artifact: 'Artifact',
  workspace: 'Workspace',
  action: 'Action',
  text: 'Text',
  orchestrator: 'Orchestrator'
}

const typeColors: Record<NodeData['type'], string> = {
  conversation: '#3b82f6',
  note: '#f59e0b',
  task: '#10b981',
  project: '#a78bfa',
  artifact: '#06b6d4',
  workspace: '#ef4444',
  action: '#f97316',
  text: '#6b7280',
  orchestrator: '#8b5cf6'
}

function GhostNodeComponent({ data }: GhostNodeProps): JSX.Element {
  const reducedMotion = useReducedMotion()
  const Icon = typeIcons[data.type] || FileText
  const label = typeLabels[data.type] || 'Node'
  const color = data.color || typeColors[data.type] || '#666'
  const title = data.title || `New ${label}`

  return (
    <div
      className={`ghost-node ${reducedMotion ? 'reduced-motion' : ''}`}
      style={{
        borderColor: color,
        backgroundColor: `${color}10`
      }}
    >
      <div className="ghost-node-header" style={{ borderBottomColor: `${color}40` }}>
        <Icon className="ghost-node-icon" style={{ color }} />
        <span className="ghost-node-type">{label}</span>
      </div>
      <div className="ghost-node-title">{title}</div>
      <div className="ghost-node-badge">NEW</div>

      <style>{`
        .ghost-node {
          min-width: 200px;
          border: 2px dashed;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          opacity: 0.7;
          pointer-events: none;
          animation: ghost-pulse 2s ease-in-out infinite;
        }

        .ghost-node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid;
        }

        .ghost-node-icon {
          width: 16px;
          height: 16px;
        }

        .ghost-node-type {
          font-size: 12px;
          font-weight: 500;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ghost-node-title {
          padding: 12px;
          font-size: 14px;
          color: #e0e0e0;
        }

        .ghost-node-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #22c55e;
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }

        @keyframes ghost-pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.01);
          }
        }

        /* Light mode support */
        [data-theme="light"] .ghost-node {
          background: rgba(0, 0, 0, 0.02);
        }

        [data-theme="light"] .ghost-node-title {
          color: #374151;
        }

        [data-theme="light"] .ghost-node-type {
          color: #6b7280;
        }

        /* Reduced motion - instant appear, no animation */
        .ghost-node.reduced-motion {
          animation: none;
          opacity: 0.7;
        }

        @media (prefers-reduced-motion: reduce) {
          .ghost-node {
            animation: none !important;
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}

const GhostNode = memo(GhostNodeComponent)
export default GhostNode
