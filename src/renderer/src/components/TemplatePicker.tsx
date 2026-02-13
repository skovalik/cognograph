/**
 * TemplatePicker - Workspace Starter Template Selector
 *
 * Shows available workspace templates as cards. When selected,
 * instantiates all nodes and edges from the template at viewport center.
 */

import { memo, useCallback } from 'react'
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BookOpen, Kanban, Library, Lightbulb, Layout } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { v4 as uuid } from 'uuid'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { WORKSPACE_TEMPLATES, type WorkspaceTemplate } from '../data/workspaceTemplates'
import { NODE_DEFAULTS, DEFAULT_EDGE_DATA } from '@shared/types'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData } from '@shared/types'

// Map template icon names to Lucide components
const ICON_MAP: Record<string, typeof BookOpen> = {
  BookOpen,
  Kanban,
  Library,
  Lightbulb,
  Layout
}

interface TemplatePickerProps {
  isOpen: boolean
  onClose: () => void
}

function TemplatePickerComponent({ isOpen, onClose }: TemplatePickerProps): JSX.Element | null {
  const { screenToFlowPosition } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()

  const handleApplyTemplate = useCallback((template: WorkspaceTemplate) => {
    // Calculate viewport center in flow coordinates
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const flowCenter = screenToFlowPosition({ x: centerX, y: centerY })

    // Calculate template bounds to center it
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const tNode of template.nodes) {
      const dims = tNode.dimensions || NODE_DEFAULTS[tNode.type] || { width: 280, height: 140 }
      minX = Math.min(minX, tNode.position.x)
      minY = Math.min(minY, tNode.position.y)
      maxX = Math.max(maxX, tNode.position.x + dims.width)
      maxY = Math.max(maxY, tNode.position.y + dims.height)
    }
    const templateWidth = maxX - minX
    const templateHeight = maxY - minY
    const offsetX = flowCenter.x - templateWidth / 2 - minX
    const offsetY = flowCenter.y - templateHeight / 2 - minY

    // Map temp IDs to real UUIDs
    const idMap = new Map<string, string>()
    for (const tNode of template.nodes) {
      idMap.set(tNode.tempId, uuid())
    }

    const now = Date.now()

    // Create nodes
    const newNodes: Node<NodeData>[] = template.nodes.map(tNode => {
      const realId = idMap.get(tNode.tempId)!
      const dims = tNode.dimensions || NODE_DEFAULTS[tNode.type] || { width: 280, height: 140 }

      // Build node data with timestamps
      const nodeData = {
        ...tNode.data,
        createdAt: now,
        updatedAt: now
      } as NodeData

      // For project nodes, map childNodeIds from temp IDs
      if (nodeData.type === 'project') {
        const projectData = nodeData as { childNodeIds?: string[] }
        // Find which template nodes are inside this project's bounds
        const projectPos = tNode.position
        const projectDims = dims
        const childIds: string[] = []
        for (const otherNode of template.nodes) {
          if (otherNode.tempId === tNode.tempId) continue
          // Check if other node is positioned inside this project
          if (
            otherNode.position.x >= projectPos.x &&
            otherNode.position.y >= projectPos.y &&
            otherNode.position.x < projectPos.x + projectDims.width &&
            otherNode.position.y < projectPos.y + projectDims.height
          ) {
            const childRealId = idMap.get(otherNode.tempId)
            if (childRealId) childIds.push(childRealId)
          }
        }
        projectData.childNodeIds = childIds
      }

      return {
        id: realId,
        type: tNode.type,
        position: {
          x: tNode.position.x + offsetX,
          y: tNode.position.y + offsetY
        },
        data: nodeData,
        width: dims.width,
        height: dims.height
      }
    })

    // Create edges
    const newEdges: Edge<EdgeData>[] = template.edges.map(tEdge => ({
      id: uuid(),
      source: idMap.get(tEdge.sourceTempId) || '',
      target: idMap.get(tEdge.targetTempId) || '',
      type: 'custom',
      data: {
        ...DEFAULT_EDGE_DATA,
        label: tEdge.label || undefined,
        bidirectional: tEdge.bidirectional ?? false
      }
    })).filter(e => e.source && e.target)

    // Batch add to workspace
    useWorkspaceStore.setState((state) => {
      const allNodes = [...state.nodes, ...newNodes]
      const allEdges = [...state.edges, ...newEdges]

      // History
      const historyActions = [
        ...newNodes.map(node => ({
          type: 'ADD_NODE' as const,
          node: JSON.parse(JSON.stringify(node))
        })),
        ...newEdges.map(edge => ({
          type: 'ADD_EDGE' as const,
          edge: JSON.parse(JSON.stringify(edge))
        }))
      ]

      const history = state.history.slice(0, state.historyIndex + 1)
      history.push({ type: 'BATCH', actions: historyActions })

      return {
        nodes: allNodes,
        edges: allEdges,
        isDirty: true,
        history,
        historyIndex: history.length - 1
      }
    })

    // Force React Flow to measure nodes and update edge endpoints (fixes misalignment)
    setTimeout(() => {
      newNodes.forEach(node => {
        updateNodeInternals(node.id)
      })
    }, 0)

    toast.success(`Applied "${template.name}" template (${newNodes.length} nodes)`)
    onClose()
  }, [screenToFlowPosition, updateNodeInternals, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* Dialog */}
        <motion.div
          className="relative w-[560px] max-w-[90vw] rounded-xl overflow-hidden gui-panel glass-fluid border gui-border shadow-2xl"
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b gui-border">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5" style={{ color: 'var(--gui-accent-secondary)' }} />
              <h2 className="text-base font-semibold gui-text">Start from a Template</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded gui-text-secondary hover:gui-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="px-5 pt-3 text-xs gui-text-secondary">
            Choose a template to populate your workspace with a starter layout.
          </p>

          {/* Template grid */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {WORKSPACE_TEMPLATES.map(template => {
              const IconComponent = ICON_MAP[template.icon] || Layout
              return (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="text-left p-4 rounded-xl border gui-border hover:border-[var(--gui-accent-secondary)] transition-all group"
                  style={{ background: 'var(--gui-bg)' }}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${template.color}20`, border: `1px solid ${template.color}40` }}
                    >
                      <IconComponent className="w-4 h-4" style={{ color: template.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium gui-text group-hover:text-[var(--gui-accent-secondary)] transition-colors">
                        {template.name}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] gui-text-secondary leading-relaxed">
                    {template.description}
                  </p>
                  <div className="mt-2 text-[10px] gui-text-muted">
                    {template.nodes.length} nodes, {template.edges.length} connections
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 border-t gui-border"
            style={{ background: 'var(--gui-bg-hover)' }}
          >
            <span className="text-[11px] gui-text-secondary">
              Templates add nodes to your current workspace. Use Ctrl+Z to undo.
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export const TemplatePicker = memo(TemplatePickerComponent)
export default TemplatePicker
