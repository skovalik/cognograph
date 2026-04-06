// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

/**
 * ProjectArtboard — Expanded project view for ArtboardOverlay.
 *
 * Shows full description, complete child node list with type-color
 * indicators, and child count summary. Expanded version of L3 content.
 */

import type { NodeData, ProjectNodeData } from '@shared/types'
import { DEFAULT_THEME_SETTINGS } from '@shared/types'
import type { Node } from '@xyflow/react'
import { FolderKanban, GripVertical } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { useNodesStore } from '../../stores/nodesStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { EditableText } from '../EditableText'

interface ProjectArtboardProps {
  nodeId: string
}

// Type-to-label mapping
const TYPE_LABELS: Record<string, string> = {
  conversation: 'Conversation',
  note: 'Note',
  task: 'Task',
  artifact: 'Artifact',
  project: 'Project',
  workspace: 'Workspace',
  text: 'Text',
  action: 'Action',
  orchestrator: 'Orchestrator',
}

function ProjectArtboardComponent({ nodeId }: ProjectArtboardProps): JSX.Element {
  const nodes = useNodesStore((s) => s.nodes)
  const updateNode = useWorkspaceStore((s) => s.updateNode)
  const themeSettings = useWorkspaceStore((s) => s.themeSettings)

  const node = nodes.find((n) => n.id === nodeId)
  const nodeData = node?.data as ProjectNodeData | undefined

  const childNodeIds = nodeData?.childNodeIds ?? []

  // Get full child node info
  const childNodes = useWorkspaceStore(
    useCallback(
      (state: { nodes: Node<NodeData>[] }) => {
        return childNodeIds
          .map((cid) => {
            const n = state.nodes.find((nd) => nd.id === cid)
            if (!n) return null
            const d = n.data as Record<string, unknown>
            return {
              id: cid,
              title: (d.title as string) || 'Untitled',
              type: (d.type as string) || 'note',
              status: (d.status as string) || '',
              priority: (d.priority as string) || '',
            }
          })
          .filter(Boolean) as Array<{
          id: string
          title: string
          type: string
          status: string
          priority: string
        }>
      },
      [childNodeIds],
    ),
  )

  // Group by type for summary
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const child of childNodes) {
      counts[child.type] = (counts[child.type] || 0) + 1
    }
    return counts
  }, [childNodes])

  const handleDescriptionChange = useCallback(
    (newDescription: string) => {
      updateNode(nodeId, { description: newDescription })
    },
    [nodeId, updateNode],
  )

  const getTypeColor = useCallback(
    (type: string): string => {
      return (
        (themeSettings.nodeColors as Record<string, string>)[type] ??
        (DEFAULT_THEME_SETTINGS.nodeColors as Record<string, string>)[type] ??
        'var(--gui-text-muted)'
      )
    },
    [themeSettings.nodeColors],
  )

  if (!nodeData) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--gui-text-muted)' }}
      >
        Node not found
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Description area */}
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--gui-border)' }}>
        <EditableText
          value={nodeData.description || ''}
          onChange={handleDescriptionChange}
          placeholder="Add project description..."
          className="text-sm"
        />
      </div>

      {/* Type summary badges */}
      {Object.keys(typeCounts).length > 0 && (
        <div
          className="flex items-center gap-2 px-5 py-2 flex-wrap shrink-0"
          style={{ borderBottom: '1px solid var(--gui-border)' }}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--gui-text-muted)' }}>
            {childNodes.length} items
          </span>
          {Object.entries(typeCounts).map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${getTypeColor(type)} 15%, transparent)`,
                color: getTypeColor(type),
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getTypeColor(type) }}
              />
              {count} {TYPE_LABELS[type] || type}
            </span>
          ))}
        </div>
      )}

      {/* Full child node list */}
      <div className="flex-1 overflow-auto px-5 py-2">
        {childNodes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-2"
            style={{ color: 'var(--gui-text-muted)' }}
          >
            <FolderKanban className="w-8 h-8 opacity-30" />
            <p className="text-sm">No child nodes</p>
            <p className="text-xs">Drag nodes into this project on the canvas</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {childNodes.map((child, idx) => (
              <div
                key={child.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150"
                style={{
                  backgroundColor: 'transparent',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--gui-bg-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {/* Drag handle placeholder */}
                <GripVertical
                  className="w-3.5 h-3.5 opacity-30 flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                />

                {/* Order number */}
                <span
                  className="text-[10px] w-5 text-right flex-shrink-0"
                  style={{ color: 'var(--gui-text-muted)' }}
                >
                  {idx + 1}.
                </span>

                {/* Type color dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getTypeColor(child.type) }}
                />

                {/* Title */}
                <span
                  className="text-sm flex-1 truncate"
                  style={{ color: 'var(--gui-text-primary)' }}
                >
                  {child.title}
                </span>

                {/* Type label */}
                <span
                  className="text-[10px] px-2 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${getTypeColor(child.type)} 10%, transparent)`,
                    color: getTypeColor(child.type),
                  }}
                >
                  {TYPE_LABELS[child.type] || child.type}
                </span>

                {/* Status (if task-like) */}
                {child.status && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded capitalize flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--gui-bg-secondary)',
                      color:
                        child.status === 'done'
                          ? '#22c55e'
                          : child.status === 'in-progress'
                            ? '#f59e0b'
                            : 'var(--gui-text-muted)',
                    }}
                  >
                    {child.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const ProjectArtboard = memo(ProjectArtboardComponent)
