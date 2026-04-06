// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Eye, Pencil, Sparkles } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import '../styles/contextual-action-bar.css'

function ContextualActionBarComponent(): JSX.Element | null {
  // ALL hooks before any returns
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useWorkspaceStore((s) => s.selectedEdgeIds)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const enterArtboard = useUIStore((s) => s.enterArtboard)
  const openModal = useAIEditorStore((s) => s.openModal)

  const handleGenerate = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    openModal({ scope: 'single', mode: 'generate', targetNodeId: selectedNodeIds[0] })
  }, [openModal, selectedNodeIds])

  const handleModify = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    openModal({ scope: 'single', mode: 'edit', targetNodeId: selectedNodeIds[0] })
  }, [openModal, selectedNodeIds])

  const handlePreview = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    enterArtboard(selectedNodeIds[0])
  }, [enterArtboard, selectedNodeIds])

  // Conditional returns AFTER all hooks
  if (selectedNodeIds.length !== 1 || selectedEdgeIds.length > 0) return null
  const nodeId = selectedNodeIds[0]
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const nodeType = node.data.type
  const isArtifact = nodeType === 'artifact'
  if (nodeType !== 'artifact' && nodeType !== 'conversation' && nodeType !== 'note') return null

  return (
    <div className="contextual-bar glass-soft">
      <button className="contextual-bar__btn contextual-bar__btn--primary" onClick={handleGenerate}>
        <Sparkles /> Generate
      </button>
      <button className="contextual-bar__btn" onClick={handleModify}>
        <Pencil /> Modify
      </button>
      {isArtifact && (
        <button className="contextual-bar__btn" onClick={handlePreview}>
          <Eye /> Preview
        </button>
      )}
    </div>
  )
}

export const ContextualActionBar = memo(ContextualActionBarComponent)
