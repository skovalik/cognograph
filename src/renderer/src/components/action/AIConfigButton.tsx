// =============================================================================
// AI CONFIG BUTTON COMPONENT
// =============================================================================
// Button to trigger AI-assisted configuration

import { memo, useState, useCallback, useMemo } from 'react'
import { Wand2 } from 'lucide-react'
import { AIConfigModal } from './AIConfigModal'
import type {
  ActionNodeData,
  ActionTrigger,
  ActionCondition,
  ActionStep,
  AIActionContext,
  AIGeneratedConfig
} from '@shared/actionTypes'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useActionStore } from '../../stores/actionStore'

interface AIConfigButtonProps {
  nodeId: string
  data: ActionNodeData
  description: string
  onApplyConfig: (config: {
    trigger: ActionTrigger
    conditions: ActionCondition[]
    actions: ActionStep[]
    title?: string
  }) => void
}

function AIConfigButtonComponent({
  nodeId,
  data,
  description,
  onApplyConfig
}: AIConfigButtonProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const nodes = useWorkspaceStore(s => s.nodes)
  const edges = useWorkspaceStore(s => s.edges)

  // Build context for AI
  const context = useMemo((): AIActionContext => {
    const actionNode = nodes.find(n => n.id === nodeId)
    if (!actionNode) {
      return {
        connectedNodes: [],
        nearbyNodes: [],
        workspaceStats: {},
        existingConfig: data.trigger && data.trigger.type !== 'manual' ? {
          trigger: data.trigger,
          conditions: data.conditions,
          actions: data.actions
        } : undefined
      }
    }

    // Get connected nodes
    const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId)
    const connectedNodeIds = connectedEdges.map(e => e.source === nodeId ? e.target : e.source)
    const connectedNodes = nodes
      .filter(n => connectedNodeIds.includes(n.id))
      .slice(0, 10)
      .map(n => ({
        id: n.id,
        type: n.type || 'unknown',
        title: (n.data as { title?: string })?.title || 'Untitled'
      }))

    // Get nearby nodes (within 500px)
    const actionPos = actionNode.position
    const nearbyNodes = nodes
      .filter(n => n.id !== nodeId && !connectedNodeIds.includes(n.id))
      .map(n => ({
        node: n,
        distance: Math.sqrt(
          Math.pow(n.position.x - actionPos.x, 2) +
          Math.pow(n.position.y - actionPos.y, 2)
        )
      }))
      .filter(({ distance }) => distance < 500)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(({ node }) => ({
        id: node.id,
        type: node.type || 'unknown',
        title: (node.data as { title?: string })?.title || 'Untitled'
      }))

    // Calculate workspace stats
    const workspaceStats: Record<string, number> = {}
    for (const node of nodes) {
      const type = node.type || 'unknown'
      workspaceStats[type] = (workspaceStats[type] || 0) + 1
    }

    return {
      connectedNodes,
      nearbyNodes,
      workspaceStats,
      existingConfig: data.trigger && data.trigger.type !== 'manual' ? {
        trigger: data.trigger,
        conditions: data.conditions,
        actions: data.actions
      } : undefined
    }
  }, [nodeId, nodes, edges, data])

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleApplyConfig = useCallback((config: AIGeneratedConfig, title?: string) => {
    onApplyConfig({
      trigger: config.trigger,
      conditions: config.conditions,
      actions: config.actions,
      title
    })
    setIsModalOpen(false)
  }, [onApplyConfig])

  // Apply config and immediately trigger execution
  const handleApplyAndRunConfig = useCallback((config: AIGeneratedConfig, title?: string) => {
    const store = useWorkspaceStore.getState()

    // Batch all config updates into a single updateNode call
    // This ensures atomic state update and avoids race conditions
    store.updateNode(nodeId, {
      trigger: config.trigger,
      conditions: config.conditions,
      actions: config.actions,
      enabled: true,
      ...(title && { title })
    })

    setIsModalOpen(false)

    // Use double requestAnimationFrame to ensure React has flushed all state updates
    // This is more reliable than arbitrary setTimeout delays
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        useActionStore.getState().triggerManual(nodeId)
      })
    })
  }, [nodeId])

  const isDisabled = !description?.trim()

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isDisabled}
        className={`
          absolute bottom-1.5 right-1.5 p-1.5 rounded transition-all
          ${isDisabled
            ? 'opacity-40 cursor-not-allowed bg-[var(--surface-panel-secondary)]'
            : 'bg-purple-600 hover:bg-purple-500 hover:scale-105 active:scale-95'
          }
        `}
        title={isDisabled
          ? 'Enter a description first'
          : 'Configure with AI'
        }
      >
        <Wand2 className="w-3.5 h-3.5" />
      </button>

      {isModalOpen && (
        <AIConfigModal
          nodeId={nodeId}
          data={data}
          description={description}
          context={context}
          onApply={handleApplyConfig}
          onApplyAndRun={handleApplyAndRunConfig}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}

export const AIConfigButton = memo(AIConfigButtonComponent)
