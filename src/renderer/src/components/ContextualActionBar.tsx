// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Pencil, Sparkles } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useAIEditorStore } from '../stores/aiEditorStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import '../styles/contextual-action-bar.css'

function ContextualActionBarComponent(): JSX.Element | null {
  // ALL hooks before any returns
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useWorkspaceStore((s) => s.selectedEdgeIds)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const openModal = useAIEditorStore((s) => s.openModal)

  const handleGenerate = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    openModal({ scope: 'single', mode: 'generate', targetNodeId: selectedNodeIds[0] })
  }, [openModal, selectedNodeIds])

  const handleModify = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    openModal({ scope: 'single', mode: 'edit', targetNodeId: selectedNodeIds[0] })
  }, [openModal, selectedNodeIds])

  // Conditional returns AFTER all hooks
  if (selectedNodeIds.length !== 1 || selectedEdgeIds.length > 0) return null
  const nodeId = selectedNodeIds[0]
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const nodeType = node.data.type
  if (nodeType !== 'artifact' && nodeType !== 'conversation' && nodeType !== 'note') return null

  return (
    <div className="contextual-bar glass-soft">
      <button className="contextual-bar__btn contextual-bar__btn--primary" onClick={handleGenerate}>
        <Sparkles /> Generate
      </button>
      <button className="contextual-bar__btn" onClick={handleModify}>
        <Pencil /> Modify
      </button>
    </div>
  )
}

export const ContextualActionBar = memo(ContextualActionBarComponent)
