// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import { memo, useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { generateSuggestions } from '../utils/promptSuggestion'

interface SuggestedPromptsProps {
  onSelect: (text: string) => void
}

function SuggestedPromptsComponent({ onSelect }: SuggestedPromptsProps): JSX.Element | null {
  const nodes = useWorkspaceStore(s => s.nodes)
  const edges = useWorkspaceStore(s => s.edges)
  const commandLog = useWorkspaceStore(s => s.commandLog)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [visible, setVisible] = useState(true)

  // Debounced regeneration (2s after workspace changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      const lastCommand = commandLog.length > 0 ? commandLog[commandLog.length - 1] : undefined
      setSuggestions(generateSuggestions(nodes, edges, lastCommand))
      setVisible(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [nodes.length, edges.length, commandLog.length])

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!visible || suggestions.length === 0) return
    const timer = setTimeout(() => setVisible(false), 30000)
    return () => clearTimeout(timer)
  }, [visible, suggestions])

  const handleSelect = useCallback((text: string) => {
    onSelect(text)
    setVisible(false)
  }, [onSelect])

  if (!visible || suggestions.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-2 flex-wrap">
      {suggestions.map((text, i) => (
        <button
          key={i}
          className="canvas-badge glass-soft text-xs"
          onClick={() => handleSelect(text)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export const SuggestedPrompts = memo(SuggestedPromptsComponent)
