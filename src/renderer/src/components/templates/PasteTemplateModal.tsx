/**
 * Paste Template Modal
 *
 * Modal for pasting a template onto the canvas.
 * Allows filling in placeholder values before pasting.
 */

import { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { X, Clipboard, Link2, Layers } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useTemplateStore, usePasteModalState } from '../../stores/templateStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { applyTemplate, createConnectionEdge } from '../../utils/templateUtils'
import { validatePlaceholderValues, resolveDatePlaceholder } from '../../utils/placeholderParser'
import { PlaceholderForm } from './PlaceholderForm'
import { TemplatePreview } from './TemplatePreview'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData, EdgeData, HistoryAction } from '@shared/types'

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function PasteTemplateModalComponent(): JSX.Element | null {
  const { open, context } = usePasteModalState()
  const closePasteModal = useTemplateStore((s) => s.closePasteModal)
  const getTemplate = useTemplateStore((s) => s.getTemplate)
  const incrementUsage = useTemplateStore((s) => s.incrementUsage)
  const addToLastUsed = useTemplateStore((s) => s.addToLastUsed)

  // React Flow for auto-fit after paste
  const { fitView } = useReactFlow()

  // Workspace actions
  const workspaceNodes = useWorkspaceStore((s) => s.nodes)
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)

  // Get the template
  const template = useMemo(() => {
    if (!context?.templateId) return null
    return getTemplate(context.templateId)
  }, [context?.templateId, getTemplate])

  // Local form state
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({})
  const [connectToNode, setConnectToNode] = useState<string | null>(null)
  const [connectionDirection, setConnectionDirection] = useState<'to-template' | 'from-template'>(
    'to-template'
  )
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Initialize form when context changes
  useEffect(() => {
    if (template) {
      // Initialize placeholder values with defaults
      const defaults: Record<string, string> = {}
      for (const p of template.placeholders) {
        if (p.type === 'date' && p.defaultValue) {
          defaults[p.key] = resolveDatePlaceholder(p.defaultValue)
        } else if (p.defaultValue) {
          defaults[p.key] = p.defaultValue
        }
      }
      setPlaceholderValues(defaults)
      setConnectToNode(context?.connectToNodeId || null)
      setError(null)
      setValidationErrors({})
    }
  }, [template, context?.connectToNodeId])

  // Get available nodes for connection
  const availableNodes = useMemo(() => {
    return workspaceNodes.filter((n) => !selectedNodeIds.includes(n.id))
  }, [workspaceNodes, selectedNodeIds])

  // Get selected node for potential connection
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length === 1) {
      return workspaceNodes.find((n) => n.id === selectedNodeIds[0])
    }
    return null
  }, [workspaceNodes, selectedNodeIds])

  // Handlers
  const handleClose = useCallback(() => {
    closePasteModal()
  }, [closePasteModal])

  const handlePlaceholderChange = useCallback((key: string, value: string) => {
    setPlaceholderValues((prev) => ({ ...prev, [key]: value }))
    setValidationErrors((prev) => {
      const { [key]: _, ...rest } = prev
      return rest
    })
  }, [])

  const handlePaste = useCallback(() => {
    if (!template || !context) {
      setError('No template selected')
      return
    }

    // Validate required placeholders
    const validation = validatePlaceholderValues(template.placeholders, placeholderValues)
    if (!validation.valid) {
      const errors: Record<string, string> = {}
      for (const key of validation.missing) {
        errors[key] = 'This field is required'
      }
      setValidationErrors(errors)
      setError('Please fill in all required fields')
      return
    }

    try {
      // Apply template at position
      const result = applyTemplate(template, context.position, placeholderValues)

      // Prepare optional connection edge
      let connectionEdge: Edge<EdgeData> | null = null
      if (connectToNode && result.nodes.length > 0) {
        const rootTemplateNodeId = template.rootNodeId
        const rootRealId = result.templateNodeIdToRealId.get(rootTemplateNodeId)
        if (rootRealId) {
          connectionEdge = createConnectionEdge(rootRealId, connectToNode, {
            direction: connectionDirection
          })
        }
      }

      // Add nodes to workspace with BATCH history
      useWorkspaceStore.setState((state) => {
        // Add all new nodes and edges
        const newNodes = [...state.nodes, ...result.nodes]
        const newEdges = [...state.edges, ...result.edges]

        // Add connection edge if requested
        if (connectionEdge) {
          newEdges.push(connectionEdge)
        }

        // Build BATCH history action for undo
        const historyActions: HistoryAction[] = [
          ...result.nodes.map((node) => ({
            type: 'ADD_NODE' as const,
            node: JSON.parse(JSON.stringify(node))
          })),
          ...result.edges.map((edge) => ({
            type: 'ADD_EDGE' as const,
            edge: JSON.parse(JSON.stringify(edge))
          }))
        ]

        if (connectionEdge) {
          historyActions.push({
            type: 'ADD_EDGE' as const,
            edge: JSON.parse(JSON.stringify(connectionEdge))
          })
        }

        // Truncate history and push BATCH action
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push({ type: 'BATCH', actions: historyActions })

        // Limit history to 100 entries
        const finalHistory = newHistory.length > 100 ? newHistory.slice(-100) : newHistory

        return {
          nodes: newNodes,
          edges: newEdges,
          history: finalHistory,
          historyIndex: finalHistory.length - 1,
          isDirty: true
        }
      })

      // Track usage
      incrementUsage(template.id)
      addToLastUsed(template.id)

      // Close modal first, then fit view to show all created nodes
      handleClose()

      // Fit view after a small delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 500 })
      }, 100)
    } catch (err) {
      setError(`Failed to paste template: ${err}`)
    }
  }, [
    template,
    context,
    placeholderValues,
    connectToNode,
    connectionDirection,
    incrementUsage,
    addToLastUsed,
    handleClose,
    fitView
  ])

  if (!open || !context || !template) return null

  const hasPlaceholders = template.placeholders.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[500px] max-h-[80vh] bg-[var(--surface-panel)] glass-fluid border border-[var(--border-subtle)] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Paste Template</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-[var(--surface-panel-secondary)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Template info */}
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <TemplatePreview template={template} maxWidth={120} maxHeight={90} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-[var(--text-secondary)] mt-1">{template.description}</p>
              )}
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {template.nodes.length} node{template.nodes.length !== 1 ? 's' : ''}
                {template.edges.length > 0 && (
                  <>, {template.edges.length} connection{template.edges.length !== 1 ? 's' : ''}</>
                )}
              </p>
            </div>
          </div>

          {/* Placeholders */}
          {hasPlaceholders && (
            <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Fill in placeholders</h4>
              <PlaceholderForm
                placeholders={template.placeholders}
                values={placeholderValues}
                onChange={handlePlaceholderChange}
                errors={validationErrors}
                mode="fill"
                availableNodes={availableNodes as Node<NodeData>[]}
              />
            </div>
          )}

          {/* Connection option */}
          <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Connect to existing node
            </h4>

            {selectedNode && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                <p className="text-blue-400">
                  Currently selected:{' '}
                  <strong>{(selectedNode.data.title as string) || 'Untitled'}</strong>
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <select
                value={connectToNode || ''}
                onChange={(e) => setConnectToNode(e.target.value || null)}
                className="flex-1 bg-[var(--surface-panel-secondary)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              >
                <option value="">No connection</option>
                {availableNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {(node.data.title as string) || 'Untitled'} ({node.data.type})
                  </option>
                ))}
              </select>
            </div>

            {connectToNode && (
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    checked={connectionDirection === 'to-template'}
                    onChange={() => setConnectionDirection('to-template')}
                    className="text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
                  />
                  <span className="text-[var(--text-secondary)]">Node → Template</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="direction"
                    checked={connectionDirection === 'from-template'}
                    onChange={() => setConnectionDirection('from-template')}
                    className="text-blue-500 focus:ring-blue-500 focus:ring-offset-[var(--surface-panel)]"
                  />
                  <span className="text-[var(--text-secondary)]">Template → Node</span>
                </label>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border-subtle)] flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePaste}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            <Clipboard className="w-4 h-4" />
            Paste Template
          </button>
        </div>
      </div>
    </div>
  )
}

export const PasteTemplateModal = memo(PasteTemplateModalComponent)
