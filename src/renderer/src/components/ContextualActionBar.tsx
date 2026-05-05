// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { Pencil, Sparkles } from 'lucide-react'
import { memo, useCallback, useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import '../styles/contextual-action-bar.css'

function ContextualActionBarComponent(): JSX.Element | null {
  // ALL hooks before any returns
  const selectedNodeIds = useWorkspaceStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useWorkspaceStore((s) => s.selectedEdgeIds)
  const nodes = useWorkspaceStore((s) => s.nodes)
  const setCommandBarPrefill = useUIStore((s) => s.setCommandBarPrefill)
  const dismissed = useUIStore((s) => s.contextualActionBarDismissed)
  const setDismissed = useUIStore((s) => s.setContextualActionBarDismissed)

  // Reset dismissal when the selected node changes — user selecting a
  // different single node should re-show the bar.
  const firstSelectedId = selectedNodeIds[0] ?? null
  useEffect(() => {
    setDismissed(false)
  }, [firstSelectedId, setDismissed])

  const handleGenerate = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    setCommandBarPrefill('Generate content for the selected node: ')
    setDismissed(true)
  }, [selectedNodeIds, setCommandBarPrefill, setDismissed])

  const handleModify = useCallback(() => {
    if (selectedNodeIds.length !== 1) return
    setCommandBarPrefill('Modify the selected node: ')
    setDismissed(true)
  }, [selectedNodeIds, setCommandBarPrefill, setDismissed])

  // Conditional returns AFTER all hooks
  if (dismissed) return null
  if (selectedNodeIds.length !== 1 || selectedEdgeIds.length > 0) return null
  const nodeId = selectedNodeIds[0]
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const nodeType = node.data.type
  if (nodeType !== 'artifact' && nodeType !== 'conversation' && nodeType !== 'note') return null

  return (
    <div className="contextual-bar glass-soft">
      <button className="contextual-bar__btn contextual-bar__btn--primary" onClick={handleGenerate}>
        <Sparkles className="w-3.5 h-3.5" /> Generate
      </button>
      <button className="contextual-bar__btn" onClick={handleModify}>
        <Pencil className="w-3.5 h-3.5" /> Modify
      </button>
    </div>
  )
}

export const ContextualActionBar = memo(ContextualActionBarComponent)
