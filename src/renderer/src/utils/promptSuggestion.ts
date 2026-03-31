// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Stefan Kovalik / Aurochs Digital

import type { Node, Edge } from '@xyflow/react'
import type { CommandLogEntry } from '@shared/types'

export function generateSuggestions(
  nodes: Node[],
  edges: Edge[],
  lastCommand?: CommandLogEntry
): string[] {
  const suggestions: string[] = []

  // Empty workspace
  if (nodes.length === 0) {
    suggestions.push('Create a new project')
    suggestions.push('Add a note')
    return suggestions
  }

  // Orphan detection
  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]))
  const orphanCount = nodes.filter(n => !connectedIds.has(n.id)).length
  if (orphanCount >= 3) {
    suggestions.push(`${orphanCount} unconnected nodes — organize them?`)
  }

  // After a successful command
  if (lastCommand?.status === 'done' && lastCommand.affectedNodeIds.length > 0) {
    suggestions.push('Tidy up the layout')
  }

  // Many nodes without a project
  const projectCount = nodes.filter(n => (n.data as any)?.type === 'project').length
  const noteCount = nodes.filter(n => (n.data as any)?.type === 'note').length
  if (projectCount === 0 && nodes.length > 5) {
    suggestions.push('Create a project to organize these nodes')
  }
  if (noteCount > 10) {
    suggestions.push('Summarize your notes')
  }

  return suggestions.slice(0, 3)
}
